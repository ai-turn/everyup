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

// Exemplars carry the trace ID of an individual measurement, which is what
// turns "p95 is 350ms" into a request you can open. Only the tail ones are
// offered, and only those that actually carry a trace ID.
func TestOTLPIngest_HistogramExemplars(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "proj-x"}, auth...)
	var agent struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatalf("decode agent: %v", err)
	}
	agent.APIKey = revealAgentAPIKey(t, ts, agent.ID, auth...)

	const svcKey = "c-exemplar"
	const svcName = "exemplar-api"
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{
		AgentID: agent.ID, Key: svcKey, Name: svcName, CheckType: "http", Endpoint: "http://x",
	}}); err != nil {
		t.Fatalf("seed agent service: %v", err)
	}

	exemplar := func(traceID string, value float64) *metricspb.Exemplar {
		return &metricspb.Exemplar{
			TraceId:      []byte(traceID),
			SpanId:       []byte("span0001"),
			TimeUnixNano: uint64(time.Now().UnixNano()),
			Value:        &metricspb.Exemplar_AsDouble{AsDouble: value},
		}
	}

	sum := 3.4
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
							TimeUnixNano:   uint64(time.Now().UnixNano()),
							Count:          100,
							Sum:            &sum,
							ExplicitBounds: []float64{0.01, 0.05, 0.1, 0.5},
							BucketCounts:   []uint64{20, 40, 30, 8, 2},
							Exemplars: []*metricspb.Exemplar{
								exemplar("fastfasttrace16b", 0.012),
								exemplar("slowesttrace016b", 0.480),
								exemplar("slowishtrace016b", 0.360),
								// No trace ID: it cannot lead anywhere, so it is dropped.
								{TimeUnixNano: uint64(time.Now().UnixNano()), Value: &metricspb.Exemplar_AsDouble{AsDouble: 0.9}},
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
		t.Fatalf("quantiles failed: %v", res.Error)
	}
	var got models.OtelHistogramQuantiles
	if err := json.Unmarshal(res.Data, &got); err != nil {
		t.Fatalf("decode quantiles: %v", err)
	}

	// p95 is 0.35 for this distribution, so only the two slow exemplars qualify.
	if len(got.Exemplars) != 2 {
		t.Fatalf("got %d exemplars, want 2 at or above p95 (%v): %+v", len(got.Exemplars), got.P95, got.Exemplars)
	}
	if got.Exemplars[0].Value <= got.Exemplars[1].Value {
		t.Errorf("exemplars not slowest-first: %+v", got.Exemplars)
	}
	for _, exemplar := range got.Exemplars {
		if exemplar.TraceID == "" {
			t.Errorf("exemplar without a trace ID was kept: %+v", exemplar)
		}
		if exemplar.Value < got.P95 {
			t.Errorf("exemplar %v is below p95 %v", exemplar.Value, got.P95)
		}
	}

	// The offered trace ID opens the existing trace detail view.
	_, detail := ts.doRequest(t, "GET", "/api/v1/traces/"+got.Exemplars[0].TraceID, nil, auth...)
	if !detail.Success {
		t.Fatalf("trace detail for exemplar %s failed: %v", got.Exemplars[0].TraceID, detail.Error)
	}
}
