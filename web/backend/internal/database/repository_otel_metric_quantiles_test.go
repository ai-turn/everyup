package database_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// bounds/counts chosen so the rank lands mid-bucket: p50 and p95 exercise the
// interpolation, p99 falls in the +Inf overflow slot that has no upper edge.
var quantileBounds = []float64{10, 50, 100, 500}

const (
	wantP50 = 40.0
	wantP95 = 350.0
	wantP99 = 500.0
)

func histogramPoint(t *testing.T, counts []uint64, temporality int, attrs string, at time.Time) models.OtelMetric {
	t.Helper()
	bounds, err := json.Marshal(quantileBounds)
	if err != nil {
		t.Fatalf("marshal bounds: %v", err)
	}
	raw, err := json.Marshal(counts)
	if err != nil {
		t.Fatalf("marshal counts: %v", err)
	}
	total := uint64(0)
	for _, c := range counts {
		total += c
	}
	return models.OtelMetric{
		ServiceID:    "svc-1",
		MetricName:   "http.server.duration",
		MetricType:   "histogram",
		Unit:         "ms",
		Attributes:   json.RawMessage(attrs),
		Value:        1,
		Count:        total,
		Total:        1,
		BucketBounds: bounds,
		BucketCounts: raw,
		Temporality:  temporality,
		CreatedAt:    at,
	}
}

func assertQuantiles(t *testing.T, got *models.OtelHistogramQuantiles, wantCount uint64) {
	t.Helper()
	if got == nil {
		t.Fatal("HistogramQuantiles returned nil, want quantiles")
	}
	if got.Count != wantCount {
		t.Errorf("count = %d, want %d", got.Count, wantCount)
	}
	if got.P50 != wantP50 || got.P95 != wantP95 || got.P99 != wantP99 {
		t.Errorf("p50/p95/p99 = %v/%v/%v, want %v/%v/%v", got.P50, got.P95, got.P99, wantP50, wantP95, wantP99)
	}
	if got.Unit != "ms" {
		t.Errorf("unit = %q, want ms", got.Unit)
	}
}

func TestHistogramQuantiles(t *testing.T) {
	now := time.Now()
	filter := &models.OtelMetricFilter{ServiceID: "svc-1", MetricName: "http.server.duration"}

	t.Run("delta points sum", func(t *testing.T) {
		openTestDB(t)
		repo := database.NewOtelMetricRepository()
		// Two delta exports that together make the reference distribution.
		if _, err := repo.CreateBatch([]models.OtelMetric{
			histogramPoint(t, []uint64{12, 25, 18, 5, 1}, 1, `{}`, now.Add(-2*time.Minute)),
			histogramPoint(t, []uint64{8, 15, 12, 3, 1}, 1, `{}`, now.Add(-time.Minute)),
		}); err != nil {
			t.Fatalf("CreateBatch: %v", err)
		}
		got, err := repo.HistogramQuantiles(filter)
		if err != nil {
			t.Fatalf("HistogramQuantiles: %v", err)
		}
		assertQuantiles(t, got, 100)
	})

	t.Run("cumulative points subtract", func(t *testing.T) {
		openTestDB(t)
		repo := database.NewOtelMetricRepository()
		// Summing these would give 60/100/70/8/2 — wrong. Only last-first is right.
		if _, err := repo.CreateBatch([]models.OtelMetric{
			histogramPoint(t, []uint64{10, 10, 10, 0, 0}, 2, `{}`, now.Add(-2*time.Minute)),
			histogramPoint(t, []uint64{20, 40, 30, 0, 0}, 2, `{}`, now.Add(-90*time.Second)),
			histogramPoint(t, []uint64{30, 50, 40, 8, 2}, 2, `{}`, now.Add(-time.Minute)),
		}); err != nil {
			t.Fatalf("CreateBatch: %v", err)
		}
		got, err := repo.HistogramQuantiles(filter)
		if err != nil {
			t.Fatalf("HistogramQuantiles: %v", err)
		}
		assertQuantiles(t, got, 100)
	})

	t.Run("counter reset takes the last snapshot whole", func(t *testing.T) {
		openTestDB(t)
		repo := database.NewOtelMetricRepository()
		// The exporter restarted: the later snapshot is smaller than the earlier.
		if _, err := repo.CreateBatch([]models.OtelMetric{
			histogramPoint(t, []uint64{30, 50, 40, 8, 2}, 2, `{}`, now.Add(-2*time.Minute)),
			histogramPoint(t, []uint64{20, 40, 30, 8, 2}, 2, `{}`, now.Add(-time.Minute)),
		}); err != nil {
			t.Fatalf("CreateBatch: %v", err)
		}
		got, err := repo.HistogramQuantiles(filter)
		if err != nil {
			t.Fatalf("HistogramQuantiles: %v", err)
		}
		assertQuantiles(t, got, 100)
	})

	t.Run("attribute series merge", func(t *testing.T) {
		openTestDB(t)
		repo := database.NewOtelMetricRepository()
		if _, err := repo.CreateBatch([]models.OtelMetric{
			histogramPoint(t, []uint64{10, 20, 15, 4, 1}, 1, `{"http.route":"/a"}`, now.Add(-time.Minute)),
			histogramPoint(t, []uint64{10, 20, 15, 4, 1}, 1, `{"http.route":"/b"}`, now.Add(-time.Minute)),
		}); err != nil {
			t.Fatalf("CreateBatch: %v", err)
		}
		got, err := repo.HistogramQuantiles(filter)
		if err != nil {
			t.Fatalf("HistogramQuantiles: %v", err)
		}
		assertQuantiles(t, got, 100)
	})

	t.Run("window excludes older points", func(t *testing.T) {
		openTestDB(t)
		repo := database.NewOtelMetricRepository()
		if _, err := repo.CreateBatch([]models.OtelMetric{
			histogramPoint(t, []uint64{999, 0, 0, 0, 0}, 1, `{}`, now.Add(-2*time.Hour)),
			histogramPoint(t, []uint64{20, 40, 30, 8, 2}, 1, `{}`, now.Add(-time.Minute)),
		}); err != nil {
			t.Fatalf("CreateBatch: %v", err)
		}
		scoped := &models.OtelMetricFilter{ServiceID: "svc-1", MetricName: "http.server.duration", From: now.Add(-30 * time.Minute)}
		got, err := repo.HistogramQuantiles(scoped)
		if err != nil {
			t.Fatalf("HistogramQuantiles: %v", err)
		}
		assertQuantiles(t, got, 100)
	})

	t.Run("non-histogram metric has no quantiles", func(t *testing.T) {
		openTestDB(t)
		repo := database.NewOtelMetricRepository()
		if _, err := repo.CreateBatch([]models.OtelMetric{{
			ServiceID: "svc-1", MetricName: "process.cpu", MetricType: "gauge",
			Attributes: json.RawMessage(`{}`), Value: 12, CreatedAt: now,
		}}); err != nil {
			t.Fatalf("CreateBatch: %v", err)
		}
		got, err := repo.HistogramQuantiles(&models.OtelMetricFilter{ServiceID: "svc-1", MetricName: "process.cpu"})
		if err != nil {
			t.Fatalf("HistogramQuantiles: %v", err)
		}
		if got != nil {
			t.Fatalf("got %+v, want nil for a gauge", got)
		}
	})
}
