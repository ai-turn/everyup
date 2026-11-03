package database_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestMetricQuerySelectionAndLimits(t *testing.T) {
	openTestDB(t)
	repo := database.NewOtelMetricRepository()
	now := time.Now().UTC()
	var points []models.OtelMetric
	for i := 0; i < 202; i++ {
		points = append(points, models.OtelMetric{ServiceID: "direct", MetricName: "queue", MetricType: "sum", Unit: "1", Attributes: json.RawMessage(fmt.Sprintf(`{"instance":"%03d"}`, i)), Value: float64(i), CreatedAt: now.Add(-time.Minute), Temporality: 2, IsMonotonic: true, StartTimeUnixNano: uint64(now.Add(-time.Hour).UnixNano())})
	}
	// A busy recent series previously hid all other series behind the point cap.
	for i := 0; i < 5000; i++ {
		point := points[0]
		point.CreatedAt = now.Add(-time.Duration(i) * time.Millisecond)
		points = append(points, point)
	}
	other := points[0]
	other.ServiceID = "other"
	other.Attributes = json.RawMessage(`{"instance":"leak"}`)
	points = append(points, other)
	if _, err := repo.CreateBatch(points); err != nil {
		t.Fatal(err)
	}
	f := &models.OtelMetricFilter{ServiceID: "direct", MetricName: "queue", MetricType: "sum", Unit: "1", From: now.Add(-time.Hour), To: now}
	result, err := repo.Query(f)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Series) != 200 || !result.SeriesTruncated || len(result.SelectedSeries) != 6 || len(result.Points) != 5000 || !result.PointsTruncated {
		t.Fatalf("unexpected bounded query: series=%d selected=%d points=%d flags=%v/%v", len(result.Series), len(result.SelectedSeries), len(result.Points), result.SeriesTruncated, result.PointsTruncated)
	}
	if !result.Points[0].IsMonotonic || result.Points[0].Temporality != 2 || result.Points[0].StartTimeUnixNano == 0 {
		t.Fatal("sum metadata was lost")
	}
	f.Series = []string{`{"instance":"201"}`}
	result, err = repo.Query(f)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Points) != 1 || result.Points[0].Value != 201 || result.PointsTruncated {
		t.Fatalf("selected series outside catalog cap was lost: %+v", result)
	}
	f.Series = []string{`{"instance":"000"}`}
	// Exactly the cap is complete; the 5,001st point is the truncation sentinel.
	f.From = now.Add(-5 * time.Second)
	result, err = repo.Query(f)
	if err != nil {
		t.Fatal(err)
	}
	if result.PointsTruncated || len(result.Points) != 5000 {
		t.Fatal("exact cap reported as truncated")
	}
	f.Series = []string{}
	result, err = repo.Query(f)
	if err != nil || len(result.Points) != 0 {
		t.Fatalf("empty selection: %+v %v", result, err)
	}
}

func TestMetricAttributeFiltersScopePointsAndDistribution(t *testing.T) {
	openTestDB(t)
	repo := database.NewOtelMetricRepository()
	now := time.Now().UTC()
	for i, attrs := range []string{`{"http.method":"GET","code":1,"ok":true,"empty":null}`, `{"http.method":"GET","code":"1","ok":true}`, `{"http.method":"POST","code":1,"ok":false}`, `{"code":1,"ok":true}`} {
		p := histogramPoint(t, []uint64{uint64(i + 1), 0, 0, 0, 0}, 1, attrs, now)
		if _, err := repo.CreateBatch([]models.OtelMetric{p}); err != nil {
			t.Fatal(err)
		}
	}
	for _, test := range []struct {
		attrs  map[string]interface{}
		count  uint64
		series int
	}{
		{map[string]interface{}{"http.method": "GET", "code": float64(1)}, 1, 1},
		{map[string]interface{}{"code": "1"}, 2, 1},
		{map[string]interface{}{"ok": false}, 3, 1},
		{map[string]interface{}{"empty": nil}, 1, 1},
		{map[string]interface{}{"missing": nil}, 0, 0},
		{map[string]interface{}{"x' OR 1=1 --": "GET"}, 0, 0},
	} {
		f := &models.OtelMetricFilter{ServiceID: "svc-1", MetricName: "http.server.duration", Attributes: test.attrs}
		got, err := repo.Query(f)
		if err != nil || len(got.Series) != test.series {
			t.Fatalf("filter %v: %+v %v", test.attrs, got, err)
		}
		f.Series = got.SelectedSeries
		q, err := repo.HistogramQuantiles(f)
		if err != nil {
			t.Fatal(err)
		}
		if test.count == 0 {
			if q != nil {
				t.Fatalf("empty filter returned distribution: %+v", q)
			}
			continue
		}
		if q == nil || q.Count != test.count {
			t.Fatalf("distribution ignored typed filters: %v %+v", test.attrs, q)
		}
	}
}

func TestMetricQueryKeepsResourceStreamsApart(t *testing.T) {
	openTestDB(t)
	repo := database.NewOtelMetricRepository()
	now := time.Now()
	var points []models.OtelMetric
	for index, value := range []uint64{10, 100, 20, 140} {
		point := histogramPoint(t, []uint64{value, 0, 0, 0, 0}, 2, `{}`, now.Add(time.Duration(index-4)*time.Minute))
		point.StreamKey = []string{"a", "b"}[index%2]
		point.StreamLabel = "replica-" + point.StreamKey
		points = append(points, point)
	}
	if _, err := repo.CreateBatch(points); err != nil {
		t.Fatal(err)
	}
	f := &models.OtelMetricFilter{ServiceID: "svc-1", MetricName: "http.server.duration"}
	result, err := repo.Query(f)
	if err != nil || len(result.Series) != 2 || len(result.Points) != 4 {
		t.Fatalf("streams merged: %+v %v", result, err)
	}
	f.Series = []string{result.Series[0].ID}
	result, err = repo.Query(f)
	if err != nil || len(result.Points) != 2 || result.Points[0].StreamKey != result.Points[1].StreamKey {
		t.Fatalf("selection mixed streams: %+v %v", result, err)
	}
	f.Series = nil
	q, err := repo.HistogramQuantiles(f)
	if err != nil || q == nil || q.Count != 50 {
		t.Fatalf("distribution merged cumulative streams before differencing: %+v %v", q, err)
	}
}

func TestHistogramDistributionCapDoesNotReturnPartialStatistics(t *testing.T) {
	openTestDB(t)
	repo := database.NewOtelMetricRepository()
	point := histogramPoint(t, []uint64{1, 0, 0, 0, 0}, 1, `{}`, time.Now())
	points := make([]models.OtelMetric, 50001)
	for i := range points {
		points[i] = point
	}
	if _, err := repo.CreateBatch(points); err != nil {
		t.Fatal(err)
	}
	q, err := repo.HistogramQuantiles(&models.OtelMetricFilter{ServiceID: point.ServiceID, MetricName: point.MetricName})
	if err != nil || q == nil || !q.Truncated || q.Count != 0 {
		t.Fatalf("partial distribution presented as complete: %+v %v", q, err)
	}
}
