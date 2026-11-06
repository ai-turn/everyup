package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
)

func TestMetricIngestRetainsBoundedMetadataAndHistogramStart(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	_, created := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{"name": "worker", "signals": []string{"metrics"}}, auth...)
	var direct struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &direct); err != nil {
		t.Fatal(err)
	}
	measured := time.Now().UTC().Add(-time.Hour)
	start := uint64(measured.Add(-time.Minute).UnixNano())
	text := func(key, value string) *commonpb.KeyValue {
		return &commonpb.KeyValue{Key: key, Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: value}}}
	}
	request := &collectormetricspb.ExportMetricsServiceRequest{ResourceMetrics: []*metricspb.ResourceMetrics{{
		Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{text("service.version", "v2"), text("deployment.environment.name", "production"), text("user.id", "private")}},
		ScopeMetrics: []*metricspb.ScopeMetrics{{Scope: &commonpb.InstrumentationScope{Name: "http", Version: "1.0"}, Metrics: []*metricspb.Metric{{
			Name: "duration", Description: "Request duration", Unit: "s", Data: &metricspb.Metric_Histogram{Histogram: &metricspb.Histogram{AggregationTemporality: metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_CUMULATIVE, DataPoints: []*metricspb.HistogramDataPoint{{StartTimeUnixNano: start, TimeUnixNano: uint64(measured.UnixNano()), Count: 2, ExplicitBounds: []float64{1}, BucketCounts: []uint64{1, 1}}}}},
		}}}},
	}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", direct.APIKey, request); status != 200 {
		t.Fatalf("ingest: %d", status)
	}
	points, err := database.NewOtelMetricRepository().ListPoints(&models.OtelMetricFilter{ServiceID: direct.ID, MetricName: "duration"})
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 1 {
		t.Fatalf("points: %d", len(points))
	}
	p := points[0]
	var resource map[string]string
	if err := json.Unmarshal(p.Resource, &resource); err != nil {
		t.Fatal(err)
	}
	if p.StartTimeUnixNano != start || p.Description != "Request duration" || p.ReceivedAt == nil || !p.ReceivedAt.After(measured) || resource["service.version"] != "v2" || resource["user.id"] != "" {
		t.Fatalf("metadata: %+v %s", p, p.Resource)
	}
	var scope map[string]string
	if err := json.Unmarshal(p.Scope, &scope); err != nil {
		t.Fatal(err)
	}
	if scope["name"] != "http" || scope["version"] != "1.0" {
		t.Fatalf("scope: %v", scope)
	}
}
