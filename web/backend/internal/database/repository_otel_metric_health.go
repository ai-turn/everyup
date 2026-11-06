package database

import (
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// Historical measurements cannot tell us when the server received them.
func migrateV57() error {
	for _, statement := range []string{
		`ALTER TABLE otel_metrics ADD COLUMN received_at INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE otel_metrics ADD COLUMN description TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE otel_metrics ADD COLUMN resource TEXT NOT NULL DEFAULT '{}'`,
		`ALTER TABLE otel_metrics ADD COLUMN scope TEXT NOT NULL DEFAULT '{}'`,
		`CREATE INDEX IF NOT EXISTS idx_otel_metric_health_direct ON otel_metrics(service_id, metric_name, metric_type, unit, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_otel_metric_health_agent ON otel_metrics(agent_id, service_name, metric_name, metric_type, unit, created_at)`,
	} {
		if _, err := DB.Exec(statement); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}
	return nil
}

func receiptTime(milliseconds int64) *time.Time {
	if milliseconds == 0 {
		return nil
	}
	at := time.UnixMilli(milliseconds).UTC()
	return &at
}

// MetricHealth examines every retained definition and every fresh series,
// independently from the chart's 12 panels / 6 series / 5,000 points limits.
// It describes current raw-value thresholds, not historical alert incidents.
func (r *OtelMetricRepository) MetricHealth(f *models.OtelMetricFilter, rules []models.AlertRule, now time.Time) (*models.OtelMetricHealth, error) {
	names, err := r.ListNames(f)
	if err != nil {
		return nil, err
	}
	if names == nil {
		names = []models.OtelMetricName{}
	}
	result := &models.OtelMetricHealth{Metrics: names, CheckedAt: now, FreshnessSeconds: 300}
	variants := map[string]int{}
	byIdentity := map[string]int{}
	for i, metric := range names {
		variants[metric.MetricName]++
		byIdentity[metric.MetricName+"\x00"+metric.MetricType+"\x00"+metric.Unit] = i
	}
	for i := range result.Metrics {
		result.Metrics[i].Conflicting = variants[result.Metrics[i].MetricName] > 1
	}
	where, args := otelMetricScope(f)
	args = append(args, now.Add(-5*time.Minute), now)
	rows, err := DB.Query(`SELECT metric_name, metric_type, unit, value FROM (
		SELECT metric_name, metric_type, unit, value,
		ROW_NUMBER() OVER (PARTITION BY metric_name, metric_type, unit, stream_key, `+metricAttributesSQL+` ORDER BY created_at DESC, id DESC) AS rank
		FROM otel_metrics WHERE `+where+` AND created_at >= ? AND created_at <= ?
	) WHERE rank = 1`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name, kind, unit string
		var value float64
		if err := rows.Scan(&name, &kind, &unit, &value); err != nil {
			return nil, err
		}
		index, exists := byIdentity[name+"\x00"+kind+"\x00"+unit]
		if !exists {
			continue
		}
		metric := &result.Metrics[index]
		metric.FreshSeries++
		// Existing rules identify names only. Never apply one numeric threshold
		// to two different units/types and pretend the result is trustworthy.
		if metric.Conflicting {
			continue
		}
		for _, rule := range rules {
			if rule.MetricName != name {
				continue
			}
			breached := false
			switch rule.Operator {
			case "gt":
				breached = value > rule.Threshold
			case "gte":
				breached = value >= rule.Threshold
			case "lt":
				breached = value < rule.Threshold
			case "lte":
				breached = value <= rule.Threshold
			case "eq":
				breached = value == rule.Threshold
			}
			metric.Breached = metric.Breached || breached
		}
	}
	return result, rows.Err()
}
