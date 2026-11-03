package database

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/aiturn/everyup/internal/models"
)

// Old sums deliberately retain unspecified metadata: their rate is unknown.
func migrateV56() error {
	for _, statement := range []string{
		`ALTER TABLE otel_metrics ADD COLUMN start_time_unix_nano INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE otel_metrics ADD COLUMN is_monotonic INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE otel_metrics ADD COLUMN stream_key TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE otel_metrics ADD COLUMN stream_label TEXT NOT NULL DEFAULT ''`,
	} {
		if _, err := DB.Exec(statement); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}
	return nil
}

const MetricSeriesLimit = 200
const MetricPointLimit = 5000

const metricAttributesSQL = `COALESCE(NULLIF(CAST(attributes AS TEXT), ''), '{}')`
const metricSeriesIDSQL = `CASE WHEN stream_key = '' THEN ` + metricAttributesSQL + ` ELSE json_object('stream', stream_key, 'attributes', json(` + metricAttributesSQL + `)) END`

// metricQueryScope is shared by series, points and histogram distribution.
// json_each binds keys as values, including keys containing dots or quotes.
func metricQueryScope(f *models.OtelMetricFilter) (string, []interface{}) {
	where, args := otelMetricScope(f)
	where += " AND metric_name = ?"
	args = append(args, f.MetricName)
	if f.MetricType != "" {
		where += " AND metric_type = ? AND unit = ?"
		args = append(args, f.MetricType, f.Unit)
	}
	if !f.From.IsZero() {
		where += " AND created_at >= ?"
		args = append(args, f.From)
	}
	if !f.To.IsZero() {
		where += " AND created_at <= ?"
		args = append(args, f.To)
	}
	keys := make([]string, 0, len(f.Attributes))
	for key := range f.Attributes {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		value := f.Attributes[key]
		kind := "null"
		switch v := value.(type) {
		case string:
			kind = "text"
		case float64:
			kind = "number"
		case bool:
			if v {
				kind = "true"
			} else {
				kind = "false"
			}
		}
		where += ` AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(attributes) THEN attributes ELSE '{}' END) a WHERE a.key = ? AND (a.type = ? OR (? = 'number' AND a.type IN ('integer', 'real'))) AND a.atom IS ?)`
		args = append(args, key, kind, kind, value)
	}
	return where, args
}

func metricSeriesScope(where string, args []interface{}, series []string) (string, []interface{}) {
	if series == nil {
		return where, args
	}
	if len(series) == 0 {
		return where + " AND 0", args
	}
	where += ` AND (` + metricSeriesIDSQL + `) IN (` + strings.TrimSuffix(strings.Repeat("?,", len(series)), ",") + ")"
	for _, id := range series {
		args = append(args, id)
	}
	return where, args
}

// Query discovers series independently of the point cap, then reads only the
// selected series. A high-volume series cannot hide the existence of another.
func (r *OtelMetricRepository) Query(f *models.OtelMetricFilter) (*models.OtelMetricQueryResult, error) {
	where, args := metricQueryScope(f)
	rows, err := DB.Query(`SELECT DISTINCT `+metricSeriesIDSQL+` AS signature, `+metricAttributesSQL+`, stream_key, stream_label FROM otel_metrics WHERE `+where+` ORDER BY signature LIMIT ?`, append(args, MetricSeriesLimit+1)...)
	if err != nil {
		return nil, err
	}
	result := &models.OtelMetricQueryResult{Series: []models.OtelMetricSeries{}, Points: []models.OtelMetric{}, PointLimit: MetricPointLimit}
	for rows.Next() {
		var item models.OtelMetricSeries
		var attrs string
		if err := rows.Scan(&item.ID, &attrs, &item.StreamKey, &item.StreamLabel); err != nil {
			rows.Close()
			return nil, err
		}
		item.Attributes = json.RawMessage(attrs)
		result.Series = append(result.Series, item)
	}
	err = rows.Err()
	rows.Close() // SQLite has one connection; close before reading points.
	if err != nil {
		return nil, err
	}
	if len(result.Series) > MetricSeriesLimit {
		result.SeriesTruncated = true
		result.Series = result.Series[:MetricSeriesLimit]
	}
	selected := f.Series
	if selected == nil {
		selected = []string{}
		for i, series := range result.Series {
			if i == 6 {
				break
			}
			selected = append(selected, series.ID)
		}
	}
	result.SelectedSeries = selected
	filter := *f
	filter.Series = selected
	points, err := r.listPoints(&filter, MetricPointLimit+1)
	if err != nil {
		return nil, err
	}
	if len(points) > MetricPointLimit {
		result.PointsTruncated = true
		points = points[1:] // listPoints returns ascending time order.
	}
	if points != nil {
		result.Points = points
	}
	return result, nil
}
