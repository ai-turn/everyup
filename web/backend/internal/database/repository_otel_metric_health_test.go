package database_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestMetricHealthUnrenderedSeriesAndDelayedReceipt(t *testing.T) {
	openTestDB(t)
	repo := database.NewOtelMetricRepository()
	now := time.Now().UTC().Truncate(time.Second)
	var points []models.OtelMetric
	for i := 0; i < 20; i++ {
		points = append(points, models.OtelMetric{ServiceID: "health", MetricName: fmt.Sprintf("metric.%02d", i), MetricType: "gauge", Unit: "ms", Value: 1, CreatedAt: now.Add(-time.Minute)})
	}
	for i := 0; i < 220; i++ {
		points = append(points, models.OtelMetric{ServiceID: "health", MetricName: "metric.19", MetricType: "gauge", Unit: "ms", Value: float64(i), Attributes: json.RawMessage(fmt.Sprintf(`{"instance":%d}`, i)), CreatedAt: now})
	}
	// This arrives later but must not replace the newer measurement of its series.
	points = append(points, models.OtelMetric{ServiceID: "health", MetricName: "metric.19", MetricType: "gauge", Unit: "ms", Value: 0, Attributes: json.RawMessage(`{"instance":219}`), CreatedAt: now.Add(-time.Hour)})
	points = append(points, models.OtelMetric{ServiceID: "other", MetricName: "leak", MetricType: "gauge", Value: 999, CreatedAt: now})
	if _, err := repo.CreateBatch(points); err != nil {
		t.Fatal(err)
	}
	health, err := repo.MetricHealth(&models.OtelMetricFilter{ServiceID: "health"}, []models.AlertRule{{MetricName: "metric.19", Operator: "gt", Threshold: 218}}, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(health.Metrics) != 20 {
		t.Fatalf("definitions = %d", len(health.Metrics))
	}
	for _, m := range health.Metrics {
		if m.LastReceivedAt == nil || m.LastReceivedAt.Before(now) {
			t.Fatalf("missing server receipt: %+v", m)
		}
		if m.MetricName == "metric.19" && (!m.Breached || m.FreshSeries != 221 || !m.LastAt.Equal(now)) {
			t.Fatalf("hidden series or late measurement broke health: %+v", m)
		}
	}
	// Same name in another unit cannot safely use a name-only threshold rule.
	if _, err := repo.CreateBatch([]models.OtelMetric{{ServiceID: "health", MetricName: "metric.19", MetricType: "gauge", Unit: "s", Value: 999, CreatedAt: now}}); err != nil {
		t.Fatal(err)
	}
	health, err = repo.MetricHealth(&models.OtelMetricFilter{ServiceID: "health"}, []models.AlertRule{{MetricName: "metric.19", Operator: "gt", Threshold: 218}}, now)
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range health.Metrics {
		if m.MetricName == "metric.19" && (!m.Conflicting || m.Breached) {
			t.Fatalf("ambiguous threshold evaluated: %+v", m)
		}
	}
}

func TestMetricReceiptUnknownAndMetadataRoundTrip(t *testing.T) {
	openTestDB(t)
	repo := database.NewOtelMetricRepository()
	measured := time.Now().UTC().Add(-time.Hour)
	point := models.OtelMetric{ServiceID: "metadata", MetricName: "latency", MetricType: "histogram", Unit: "ms", CreatedAt: measured, Description: "request duration", Resource: json.RawMessage(`{"service.version":"v2"}`), Scope: json.RawMessage(`{"name":"http","version":"1"}`), StartTimeUnixNano: 123}
	if _, err := repo.CreateBatch([]models.OtelMetric{point}); err != nil {
		t.Fatal(err)
	}
	points, err := repo.ListPoints(&models.OtelMetricFilter{ServiceID: "metadata", MetricName: "latency"})
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 1 || points[0].ReceivedAt == nil || !points[0].ReceivedAt.After(measured) || points[0].Description != point.Description || string(points[0].Resource) != string(point.Resource) || string(points[0].Scope) != string(point.Scope) || points[0].StartTimeUnixNano != 123 {
		t.Fatalf("metadata lost: %+v", points)
	}
	// Pre-migration rows retain unknown receipt time, never backfilled from measurement.
	if _, err := database.DB.Exec("UPDATE otel_metrics SET received_at = 0"); err != nil {
		t.Fatal(err)
	}
	names, err := repo.ListNames(&models.OtelMetricFilter{ServiceID: "metadata"})
	if err != nil {
		t.Fatal(err)
	}
	if names[0].LastReceivedAt != nil || !names[0].LastAt.Equal(measured) {
		t.Fatalf("invented receipt: %+v", names[0])
	}
}

func TestHistogramStartSeparatesCounterRestarts(t *testing.T) {
	openTestDB(t)
	repo := database.NewOtelMetricRepository()
	now := time.Now().UTC()
	var points []models.OtelMetric
	for i, count := range []uint64{100, 110, 200, 220} {
		p := histogramPoint(t, []uint64{count, 0, 0, 0, 0}, 2, `{}`, now.Add(time.Duration(i)*time.Minute))
		p.StartTimeUnixNano = 1
		if i >= 2 {
			p.StartTimeUnixNano = 2
		}
		points = append(points, p)
	}
	if _, err := repo.CreateBatch(points); err != nil {
		t.Fatal(err)
	}
	q, err := repo.HistogramQuantiles(&models.OtelMetricFilter{ServiceID: "svc-1", MetricName: "http.server.duration"})
	if err != nil {
		t.Fatal(err)
	}
	if q == nil || q.Count != 30 {
		t.Fatalf("restart must not bridge cumulative epochs: %+v", q)
	}
}
