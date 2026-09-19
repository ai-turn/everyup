package handlers_test

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
)

// TestOTLPIngest_HistogramQuantiles walks an explicit-bucket histogram from the
// OTLP wire through storage to the quantiles endpoint. The average alone cannot
// express the tail — this is the check that the bucket vector survives ingest.
func TestOTLPIngest_HistogramQuantiles(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "proj-q"}, auth...)
	var agent struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatalf("decode agent: %v", err)
	}
	agent.APIKey = revealAgentAPIKey(t, ts, agent.ID, auth...)

	const svcKey = "c-quantiles"
	const svcName = "orders-api"
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{
		AgentID: agent.ID, Key: svcKey, Name: svcName, CheckType: "http", Endpoint: "http://x",
	}}); err != nil {
		t.Fatalf("seed agent service: %v", err)
	}

	// 100 observations: mostly fast, with a thin tail past 100ms. The mean is
	// ~34ms while p95 is 350ms — reporting only the average would hide that.
	bounds := []float64{0.01, 0.05, 0.1, 0.5}
	counts := []uint64{20, 40, 30, 8, 2}
	stamp := uint64(time.Now().UnixNano())
	postOTLP(t, ts, "/api/v1/otlp/v1/metrics", agent.APIKey, &collectormetricspb.ExportMetricsServiceRequest{
		ResourceMetrics: []*metricspb.ResourceMetrics{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
				{Key: "service.name", Value: stringValue(svcName)},
			}},
			ScopeMetrics: []*metricspb.ScopeMetrics{{
				Metrics: []*metricspb.Metric{{
					Name: "http.server.request.duration",
					Unit: "s",
					Data: &metricspb.Metric_Histogram{Histogram: &metricspb.Histogram{
						AggregationTemporality: metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_DELTA,
						DataPoints: []*metricspb.HistogramDataPoint{{
							TimeUnixNano:   stamp,
							Count:          100,
							Sum:            floatPtr(3.4),
							ExplicitBounds: bounds,
							BucketCounts:   counts,
							Attributes: []*commonpb.KeyValue{
								{Key: "http.route", Value: stringValue("/orders")},
							},
						}},
					}},
				}},
			}},
		}},
	})

	_, res := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/otel-metrics/quantiles?name=http.server.request.duration", nil, auth...)
	if !res.Success {
		t.Fatalf("quantiles request failed: %v", res.Error)
	}
	var got models.OtelHistogramQuantiles
	if err := json.Unmarshal(res.Data, &got); err != nil {
		t.Fatalf("decode quantiles: %v", err)
	}
	if got.Count != 100 {
		t.Errorf("count = %d, want 100", got.Count)
	}
	if got.Unit != "s" {
		t.Errorf("unit = %q, want s", got.Unit)
	}
	for _, c := range []struct {
		name string
		got  float64
		want float64
	}{
		{"p50", got.P50, 0.04},
		{"p95", got.P95, 0.35},
		{"p99", got.P99, 0.5},
	} {
		if math.Abs(c.got-c.want) > 1e-9 {
			t.Errorf("%s = %v, want %v", c.name, c.got, c.want)
		}
	}

	// A gauge has no buckets, so the endpoint reports no distribution.
	_, gaugeRes := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/otel-metrics/quantiles?name=nothing.here", nil, auth...)
	if !gaugeRes.Success || string(gaugeRes.Data) != "null" {
		t.Fatalf("unknown metric = %s (success=%v), want null data", gaugeRes.Data, gaugeRes.Success)
	}

	resp, _ := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/otel-metrics/quantiles", nil, auth...)
	if resp.StatusCode != 400 {
		t.Fatalf("quantiles without name = %d, want 400", resp.StatusCode)
	}
}
