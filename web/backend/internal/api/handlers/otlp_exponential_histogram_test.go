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

// An exponential histogram is rewritten into explicit bounds at ingest, so the
// same quantile path serves both shapes. Scale 0 gives base 2, so bucket j
// covers (2^(offset+j), 2^(offset+j+1)].
func TestOTLPIngest_ExponentialHistogramQuantiles(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "proj-e"}, auth...)
	var agent struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatalf("decode agent: %v", err)
	}
	agent.APIKey = revealAgentAPIKey(t, ts, agent.ID, auth...)

	const svcKey = "c-exp"
	const svcName = "exp-api"
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{
		AgentID: agent.ID, Key: svcKey, Name: svcName, CheckType: "http", Endpoint: "http://x",
	}}); err != nil {
		t.Fatalf("seed agent service: %v", err)
	}

	post := func(t *testing.T, name string, dp *metricspb.ExponentialHistogramDataPoint) {
		t.Helper()
		postOTLP(t, ts, "/api/v1/otlp/v1/metrics", agent.APIKey, &collectormetricspb.ExportMetricsServiceRequest{
			ResourceMetrics: []*metricspb.ResourceMetrics{{
				Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
					{Key: "service.name", Value: stringValue(svcName)},
				}},
				ScopeMetrics: []*metricspb.ScopeMetrics{{
					Metrics: []*metricspb.Metric{{
						Name: name,
						Unit: "ms",
						Data: &metricspb.Metric_ExponentialHistogram{ExponentialHistogram: &metricspb.ExponentialHistogram{
							AggregationTemporality: metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_DELTA,
							DataPoints:             []*metricspb.ExponentialHistogramDataPoint{dp},
						}},
					}},
				}},
			}},
		})
	}

	quantiles := func(t *testing.T, name string) *models.OtelHistogramQuantiles {
		t.Helper()
		_, res := ts.doRequest(t, "GET",
			"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/otel-metrics/quantiles?name="+name, nil, auth...)
		if !res.Success {
			t.Fatalf("quantiles for %s failed: %v", name, res.Error)
		}
		if string(res.Data) == "null" {
			return nil
		}
		var got models.OtelHistogramQuantiles
		if err := json.Unmarshal(res.Data, &got); err != nil {
			t.Fatalf("decode quantiles: %v", err)
		}
		return &got
	}

	stamp := uint64(time.Now().UnixNano())
	sum := 640.0

	t.Run("scale 0 buckets become explicit bounds", func(t *testing.T) {
		post(t, "rpc.duration", &metricspb.ExponentialHistogramDataPoint{
			TimeUnixNano: stamp, Count: 100, Sum: &sum, Scale: 0, ZeroCount: 12,
			Positive: &metricspb.ExponentialHistogramDataPoint_Buckets{
				Offset: 0, BucketCounts: []uint64{10, 40, 30, 8},
			},
		})
		got := quantiles(t, "rpc.duration")
		if got == nil {
			t.Fatal("no quantiles: the exponential buckets were not converted")
		}
		if got.Count != 100 {
			t.Errorf("count = %d, want 100", got.Count)
		}
		for _, c := range []struct {
			name string
			got  float64
			want float64
		}{
			{"p50", got.P50, 3.4}, // lands mid (2, 4]
			{"p95", got.P95, 11},  // lands mid (8, 16]
			{"p99", got.P99, 15},
		} {
			if math.Abs(c.got-c.want) > 1e-9 {
				t.Errorf("%s = %v, want %v", c.name, c.got, c.want)
			}
		}
	})

	t.Run("negative buckets fall back to the average", func(t *testing.T) {
		// This projection has no representation for negative buckets, so a
		// distribution must not be reported rather than silently undercounted.
		post(t, "signed.gauge.delta", &metricspb.ExponentialHistogramDataPoint{
			TimeUnixNano: stamp, Count: 20, Sum: &sum, Scale: 0,
			Positive: &metricspb.ExponentialHistogramDataPoint_Buckets{Offset: 0, BucketCounts: []uint64{10}},
			Negative: &metricspb.ExponentialHistogramDataPoint_Buckets{Offset: 0, BucketCounts: []uint64{10}},
		})
		if got := quantiles(t, "signed.gauge.delta"); got != nil {
			t.Fatalf("got %+v, want no quantiles for a point with negative buckets", got)
		}
	})

	t.Run("bucketless point falls back to the average", func(t *testing.T) {
		post(t, "empty.hist", &metricspb.ExponentialHistogramDataPoint{
			TimeUnixNano: stamp, Count: 0, Sum: &sum, Scale: 0,
		})
		if got := quantiles(t, "empty.hist"); got != nil {
			t.Fatalf("got %+v, want no quantiles without buckets", got)
		}
	})
}
