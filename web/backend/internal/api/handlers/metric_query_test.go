package handlers_test

import (
	"encoding/json"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
)

func TestMetricExplorerQueryBothConnectionPaths(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)
	_, created := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{"name": "worker", "signals": []string{"metrics"}}, auth...)
	var direct struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &direct); err != nil {
		t.Fatal(err)
	}
	_, agentCreated := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "docker"}, auth...)
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(agentCreated.Data, &agent); err != nil {
		t.Fatal(err)
	}
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{AgentID: agent.ID, Key: "worker-key", Name: "worker", CheckType: "http", Endpoint: "http://x"}}); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	for _, scope := range []models.OtelMetric{{ServiceID: direct.ID}, {AgentID: agent.ID, ServiceName: "worker"}} {
		scope.MetricName = "jobs"
		scope.MetricType = "sum"
		scope.Unit = "1"
		scope.Attributes = json.RawMessage(`{"queue":"fast"}`)
		scope.Value = 42
		scope.CreatedAt = now
		if scope.ServiceID != "" {
			scope.Value = 7
		}
		if _, err := database.NewOtelMetricRepository().CreateBatch([]models.OtelMetric{scope}); err != nil {
			t.Fatal(err)
		}
	}
	paths := []string{"/api/v1/observed-services/" + direct.ID + "/otel-metrics/query", "/api/v1/agents/" + agent.ID + "/services/worker-key/otel-metrics/query"}
	// Percent-encoded attributes and six series IDs can exceed Fiber's default
	// 4 KB request-header buffer before handler validation gets a chance to run.
	longFilters, _ := json.Marshal(map[string]string{"queue": strings.Repeat("가", 600)})
	status, longResult := ts.doRequest(t, "GET", paths[0]+"?name=jobs&attributes="+url.QueryEscape(string(longFilters)), nil, auth...)
	if status.StatusCode != 200 || !longResult.Success {
		t.Fatalf("valid long metric query rejected: %d", status.StatusCode)
	}
	for index, path := range paths {
		healthPath := strings.TrimSuffix(path, "/query") + "/health"
		unauthorized, _ := ts.doRequest(t, "GET", healthPath, nil)
		if unauthorized.StatusCode != 401 {
			t.Fatalf("unauthenticated health: %d", unauthorized.StatusCode)
		}
		_, healthResponse := ts.doRequest(t, "GET", healthPath, nil, auth...)
		var health models.OtelMetricHealth
		if err := json.Unmarshal(healthResponse.Data, &health); err != nil {
			t.Fatal(err)
		}
		if !healthResponse.Success || len(health.Metrics) != 1 || health.Metrics[0].MetricName != "jobs" || health.Metrics[0].LastReceivedAt == nil || health.Metrics[0].FreshSeries != 1 {
			t.Fatalf("health scope/receipt: %+v", health)
		}
		status, _ := ts.doRequest(t, "GET", path+"?name=jobs", nil)
		if status.StatusCode != 401 {
			t.Fatalf("unauthenticated query status %d", status.StatusCode)
		}
		_, response := ts.doRequest(t, "GET", path+"?name=jobs&type=sum&unit=1&attributes="+url.QueryEscape(`{"queue":"fast"}`), nil, auth...)
		var data models.OtelMetricQueryResult
		if err := json.Unmarshal(response.Data, &data); err != nil {
			t.Fatal(err)
		}
		want := 7.0
		if index == 1 {
			want = 42
		}
		if !response.Success || len(data.Points) != 1 || data.Points[0].Value != want || len(data.Series) != 1 {
			t.Fatalf("scope leaked or query failed: %+v %+v", response.Error, data)
		}
		for _, query := range []string{"", "name=jobs&attributes=null", "name=jobs&attributes=[]", "name=jobs&attributes=" + url.QueryEscape(`{"queue":[]}`), "name=jobs&series=null", "name=jobs&series=" + url.QueryEscape(`["null"]`), "name=jobs&from=invalid", "name=jobs&type=unknown", "name=jobs&from=" + now.Add(-25*time.Hour).Format(time.RFC3339) + "&to=" + now.Format(time.RFC3339)} {
			status, response := ts.doRequest(t, "GET", path+"?"+query, nil, auth...)
			if status.StatusCode != 400 || response.Error == nil {
				t.Fatalf("invalid query %q accepted: %d %+v", query, status.StatusCode, response)
			}
		}
	}

	// Real protobuf ingest must preserve the metadata rate calculation depends on.
	start := uint64(now.Add(-time.Minute).UnixNano())
	request := &collectormetricspb.ExportMetricsServiceRequest{ResourceMetrics: []*metricspb.ResourceMetrics{{ScopeMetrics: []*metricspb.ScopeMetrics{{Metrics: []*metricspb.Metric{{Name: "completed", Data: &metricspb.Metric_Sum{Sum: &metricspb.Sum{IsMonotonic: true, AggregationTemporality: metricspb.AggregationTemporality_AGGREGATION_TEMPORALITY_CUMULATIVE, DataPoints: []*metricspb.NumberDataPoint{{StartTimeUnixNano: start, TimeUnixNano: uint64(now.UnixNano()), Value: &metricspb.NumberDataPoint_AsInt{AsInt: 100}}}}}}}}}}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", direct.APIKey, request); status != 200 {
		t.Fatalf("ingest status %d", status)
	}
	_, response := ts.doRequest(t, "GET", paths[0]+"?name=completed", nil, auth...)
	var data models.OtelMetricQueryResult
	if err := json.Unmarshal(response.Data, &data); err != nil {
		t.Fatal(err)
	}
	if len(data.Points) != 1 || data.Points[0].Temporality != 2 || !data.Points[0].IsMonotonic || data.Points[0].StartTimeUnixNano != start || data.Points[0].StreamKey == "" {
		t.Fatalf("ingest lost rate metadata: %+v", data)
	}
}
