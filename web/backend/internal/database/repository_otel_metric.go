package database

import (
	"database/sql"
	"encoding/json"
	"sort"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// migrateV52 keeps explicit histogram buckets alongside the flattened average.
// Without the bucket vector a histogram collapses to a mean, which hides tail
// latency; these columns are what HistogramQuantiles reads. Empty for gauges,
// sums, and the exponential/summary shapes we still store as an average only.
// Added: 2026-09-18
func migrateV52() error {
	for _, stmt := range []string{
		`ALTER TABLE otel_metrics ADD COLUMN bucket_bounds TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE otel_metrics ADD COLUMN bucket_counts TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE otel_metrics ADD COLUMN temporality INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE otel_metrics ADD COLUMN exemplars TEXT NOT NULL DEFAULT ''`,
	} {
		if _, err := DB.Exec(stmt); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}
	return nil
}

// OtelMetricRepository handles OTLP metric data point persistence.
type OtelMetricRepository struct{}

// NewOtelMetricRepository creates a new OTLP metric repository.
func NewOtelMetricRepository() *OtelMetricRepository {
	return &OtelMetricRepository{}
}

// CreateBatch inserts metric data points.
func (r *OtelMetricRepository) CreateBatch(metrics []models.OtelMetric) (int, error) {
	if len(metrics) == 0 {
		return 0, nil
	}

	count := 0
	err := Transaction(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`
			INSERT INTO otel_metrics (
				service_id, agent_id, service_name, metric_name, metric_type, unit,
				attributes, value, count, total, time_unix_nano, created_at,
				bucket_bounds, bucket_counts, temporality, exemplars
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, m := range metrics {
			if _, err := stmt.Exec(
				m.ServiceID, m.AgentID, m.ServiceName, m.MetricName, m.MetricType, m.Unit,
				m.Attributes, m.Value, m.Count, m.Total, m.TimeUnixNano, m.CreatedAt,
				jsonOrEmpty(m.BucketBounds), jsonOrEmpty(m.BucketCounts), m.Temporality, jsonOrEmpty(m.Exemplars),
			); err != nil {
				return err
			}
			count++
		}
		return nil
	})
	return count, err
}

// ListNames returns the distinct metrics matching the filter scope, newest
// first, for the metric picker. last_at reads the bare created_at column of
// each group's newest row: the modernc driver only maps DATETIME to time.Time
// when the value traces back to the declared column type — MAX(created_at)
// strips that (see repository_notification.go).
func (r *OtelMetricRepository) ListNames(f *models.OtelMetricFilter) ([]models.OtelMetricName, error) {
	where, args := otelMetricScope(f)
	rows, err := DB.Query(`
		SELECT metric_name, metric_type, unit, created_at AS last_at
		FROM otel_metrics
		WHERE id IN (
			SELECT MAX(id) FROM otel_metrics
			WHERE `+where+`
			GROUP BY metric_name, metric_type, unit
		)
		ORDER BY created_at DESC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []models.OtelMetricName
	for rows.Next() {
		var n models.OtelMetricName
		if err := rows.Scan(&n.MetricName, &n.MetricType, &n.Unit, &n.LastAt); err != nil {
			return nil, err
		}
		names = append(names, n)
	}
	return names, rows.Err()
}

// ListPoints returns data points for one metric in the filter scope, oldest
// first (chart order).
func (r *OtelMetricRepository) ListPoints(f *models.OtelMetricFilter) ([]models.OtelMetric, error) {
	where, args := otelMetricScope(f)
	where += " AND metric_name = ?"
	args = append(args, f.MetricName)
	if !f.From.IsZero() {
		where += " AND created_at >= ?"
		args = append(args, f.From)
	}
	if !f.To.IsZero() {
		where += " AND created_at <= ?"
		args = append(args, f.To)
	}
	limit := f.Limit
	if limit <= 0 || limit > 5000 {
		limit = 5000
	}
	args = append(args, limit)

	// Newest N points selected, then re-sorted ascending for the chart.
	rows, err := DB.Query(`
		SELECT * FROM (
			SELECT id, service_id, agent_id, service_name, metric_name, metric_type, unit,
				attributes, value, count, total, time_unix_nano, created_at
			FROM otel_metrics
			WHERE `+where+`
			ORDER BY created_at DESC
			LIMIT ?
		) ORDER BY created_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []models.OtelMetric
	for rows.Next() {
		var m models.OtelMetric
		var attributes sql.NullString
		if err := rows.Scan(
			&m.ID, &m.ServiceID, &m.AgentID, &m.ServiceName, &m.MetricName, &m.MetricType, &m.Unit,
			&attributes, &m.Value, &m.Count, &m.Total, &m.TimeUnixNano, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		if attributes.Valid {
			m.Attributes = []byte(attributes.String)
		}
		points = append(points, m)
	}
	return points, rows.Err()
}

// LatestValuesByService returns the latest value of each metric every service
// under the agent has exported since the cutoff — one row per
// (service_name, metric_name), newest point per group. The caller picks each
// service's representative metric from these. ponytail: a metric with multiple
// attribute series collapses to whichever series holds the newest id; a glance
// card doesn't need per-series aggregation.
func (r *OtelMetricRepository) LatestValuesByService(agentID string, since time.Time) ([]models.OtelServiceMetric, error) {
	rows, err := DB.Query(`
		SELECT service_name, metric_name, metric_type, unit, value
		FROM otel_metrics
		WHERE id IN (
			SELECT MAX(id) FROM otel_metrics
			WHERE agent_id = ? AND created_at >= ?
			GROUP BY service_name, metric_name
		)
	`, agentID, since.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.OtelServiceMetric
	for rows.Next() {
		var m models.OtelServiceMetric
		if err := rows.Scan(&m.ServiceName, &m.MetricName, &m.MetricType, &m.Unit, &m.Value); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// LatestValuesByObservedService returns the newest value of every metric for
// every direct Observed Service since the cutoff. Legacy service_id rows are
// excluded by joining observed_services.
func (r *OtelMetricRepository) LatestValuesByObservedService(since time.Time) ([]models.OtelServiceMetric, error) {
	rows, err := DB.Query(`
		SELECT m.service_id, m.service_name, m.metric_name, m.metric_type, m.unit, m.value
		FROM otel_metrics m
		WHERE m.id IN (
			SELECT MAX(points.id)
			FROM otel_metrics points
			JOIN observed_services target ON target.id = points.service_id
			WHERE points.created_at >= ?
			GROUP BY points.service_id, points.metric_name
		)
	`, since.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.OtelServiceMetric
	for rows.Next() {
		var m models.OtelServiceMetric
		if err := rows.Scan(&m.ServiceID, &m.ServiceName, &m.MetricName, &m.MetricType, &m.Unit, &m.Value); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// DeleteOlderThan removes metric points older than the cutoff.
func (r *OtelMetricRepository) DeleteOlderThan(cutoff time.Time) (int64, error) {
	result, err := DB.Exec(`DELETE FROM otel_metrics WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func otelMetricScope(f *models.OtelMetricFilter) (string, []interface{}) {
	if f.AgentID != "" {
		return "agent_id = ? AND service_name = ?", []interface{}{f.AgentID, f.ServiceName}
	}
	return "service_id = ?", []interface{}{f.ServiceID}
}

func jsonOrEmpty(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	return string(raw)
}

// HistogramQuantiles recovers p50/p95/p99 for one explicit-bucket histogram
// metric over the filter's window. Points are aggregated per attribute series
// first — a cumulative series is the last point minus the first, a delta series
// is the sum — and only then merged, so a busy series cannot be double counted.
//
// ponytail: exponential histograms and summaries are skipped, not approximated.
// They store an average only (see flattenMetric); adding scale decoding when a
// service actually exports one beats guessing bounds now.
func (r *OtelMetricRepository) HistogramQuantiles(f *models.OtelMetricFilter) (*models.OtelHistogramQuantiles, error) {
	where, args := otelMetricScope(f)
	where += " AND metric_name = ? AND metric_type = 'histogram' AND bucket_bounds != ''"
	args = append(args, f.MetricName)
	if !f.From.IsZero() {
		where += " AND created_at >= ?"
		args = append(args, f.From)
	}
	if !f.To.IsZero() {
		where += " AND created_at <= ?"
		args = append(args, f.To)
	}

	rows, err := DB.Query(`
		SELECT unit, attributes, bucket_bounds, bucket_counts, temporality, exemplars
		FROM otel_metrics
		WHERE `+where+`
		ORDER BY created_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Keyed by bounds signature then attribute series: different bucket layouts
	// cannot be summed elementwise, so they are accumulated apart.
	type seriesAccumulator struct {
		bounds  []float64
		first   []uint64
		last    []uint64
		delta   []uint64
		isDelta bool
	}
	layouts := map[string]map[string]*seriesAccumulator{}
	unit := ""

	var exemplars []models.MetricExemplar
	for rows.Next() {
		var rowUnit, attributes, boundsJSON, countsJSON, exemplarJSON string
		var temporality int
		if err := rows.Scan(&rowUnit, &attributes, &boundsJSON, &countsJSON, &temporality, &exemplarJSON); err != nil {
			return nil, err
		}
		if exemplarJSON != "" {
			var pointExemplars []models.MetricExemplar
			if json.Unmarshal([]byte(exemplarJSON), &pointExemplars) == nil {
				exemplars = append(exemplars, pointExemplars...)
			}
		}
		var bounds []float64
		var counts []uint64
		if json.Unmarshal([]byte(boundsJSON), &bounds) != nil || json.Unmarshal([]byte(countsJSON), &counts) != nil {
			continue
		}
		if len(counts) != len(bounds)+1 {
			continue
		}
		if unit == "" {
			unit = rowUnit
		}

		series, ok := layouts[boundsJSON]
		if !ok {
			series = map[string]*seriesAccumulator{}
			layouts[boundsJSON] = series
		}
		accumulator, ok := series[attributes]
		if !ok {
			// Temporality 2 is cumulative; delta and unspecified both sum, which
			// is the safe read when an exporter omits the field.
			accumulator = &seriesAccumulator{bounds: bounds, delta: make([]uint64, len(counts)), isDelta: temporality != 2}
			series[attributes] = accumulator
		}
		if accumulator.isDelta {
			for i, count := range counts {
				accumulator.delta[i] += count
			}
			continue
		}
		if accumulator.first == nil {
			accumulator.first = counts
		}
		accumulator.last = counts
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Pick the layout holding the most observations rather than merging
	// mismatched bounds; a metric almost always has exactly one.
	var best []uint64
	var bestBounds []float64
	var bestTotal uint64
	for _, series := range layouts {
		var merged []uint64
		var bounds []float64
		for _, accumulator := range series {
			resolved := accumulator.delta
			if !accumulator.isDelta {
				resolved = cumulativeDelta(accumulator.first, accumulator.last)
			}
			if merged == nil {
				merged = make([]uint64, len(resolved))
				bounds = accumulator.bounds
			}
			for i := range resolved {
				merged[i] += resolved[i]
			}
		}
		total := uint64(0)
		for _, count := range merged {
			total += count
		}
		if total > bestTotal {
			best, bestBounds, bestTotal = merged, bounds, total
		}
	}
	if bestTotal == 0 {
		return nil, nil
	}

	p95 := bucketQuantile(bestBounds, best, bestTotal, 0.95)
	return &models.OtelHistogramQuantiles{
		MetricName: f.MetricName,
		Unit:       unit,
		Count:      bestTotal,
		P50:        bucketQuantile(bestBounds, best, bestTotal, 0.50),
		P95:        p95,
		P99:        bucketQuantile(bestBounds, best, bestTotal, 0.99),
		Exemplars:  tailExemplars(exemplars, p95),
	}, nil
}

// maxTailExemplars caps how many traces the tail offers; a handful is enough
// to open one, and the rest would just be a longer list of the same story.
const maxTailExemplars = 5

// tailExemplars keeps the slowest measurements at or above p95, so the trace
// offered is one that actually belongs to the tail being asked about. When no
// exemplar reaches p95 the slowest available ones are returned instead, which
// still beats sending the reader away with nothing.
func tailExemplars(all []models.MetricExemplar, p95 float64) []models.MetricExemplar {
	if len(all) == 0 {
		return nil
	}
	sorted := append([]models.MetricExemplar(nil), all...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Value > sorted[j].Value })

	tail := sorted
	if sorted[0].Value >= p95 {
		cut := len(sorted)
		for i, exemplar := range sorted {
			if exemplar.Value < p95 {
				cut = i
				break
			}
		}
		tail = sorted[:cut]
	}
	if len(tail) > maxTailExemplars {
		tail = tail[:maxTailExemplars]
	}
	return tail
}

// cumulativeDelta subtracts the window's first cumulative snapshot from its
// last. A bucket that went backwards means the exporter restarted, so the last
// snapshot is taken whole rather than producing a negative count.
func cumulativeDelta(first, last []uint64) []uint64 {
	if last == nil {
		return nil
	}
	if first == nil || len(first) != len(last) {
		return last
	}
	for i := range last {
		if last[i] < first[i] {
			return last
		}
	}
	out := make([]uint64, len(last))
	for i := range last {
		out[i] = last[i] - first[i]
	}
	return out
}

// bucketQuantile interpolates within the bucket the requested rank lands in.
// counts is one longer than bounds; that final slot is the +Inf overflow, which
// has no upper edge and so reports the highest finite bound.
func bucketQuantile(bounds []float64, counts []uint64, total uint64, q float64) float64 {
	if total == 0 || len(bounds) == 0 {
		return 0
	}
	rank := q * float64(total)
	cumulative := uint64(0)
	for i, count := range counts {
		if count == 0 {
			continue
		}
		if float64(cumulative+count) < rank {
			cumulative += count
			continue
		}
		if i >= len(bounds) {
			return bounds[len(bounds)-1]
		}
		lower := 0.0
		if i > 0 {
			lower = bounds[i-1]
		}
		return lower + (bounds[i]-lower)*((rank-float64(cumulative))/float64(count))
	}
	return bounds[len(bounds)-1]
}
