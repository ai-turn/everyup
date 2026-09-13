package handlers_test

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
)

func TestDirectMetricsSetupReadAlertAndDelete(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
		"name":    "billing-api",
		"signals": []string{"metrics"},
	}, auth...)
	if !createResult.Success {
		t.Fatalf("create direct metrics target: %+v", createResult.Error)
	}
	var created struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		ApiKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(createResult.Data, &created); err != nil {
		t.Fatal(err)
	}

	var agentCount int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM agents`).Scan(&agentCount); err != nil {
		t.Fatal(err)
	}
	if agentCount != 0 {
		t.Fatalf("direct metrics setup created %d Agent rows, want 0", agentCount)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", created.ApiKey, &collectorlogspb.ExportLogsServiceRequest{}); status != 403 {
		t.Fatalf("metrics-scoped key logs status=%d, want 403", status)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/traces", created.ApiKey, &collectortracepb.ExportTraceServiceRequest{}); status != 403 {
		t.Fatalf("metrics-scoped key traces status=%d, want 403", status)
	}

	stamp := uint64(time.Now().UTC().UnixNano())
	metricRequest := &collectormetricspb.ExportMetricsServiceRequest{
		ResourceMetrics: []*metricspb.ResourceMetrics{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{
				Key: "service.name", Value: stringValue("spoofed-service"),
			}}},
			ScopeMetrics: []*metricspb.ScopeMetrics{{Metrics: []*metricspb.Metric{{
				Name: "process.runtime.go.memory.usage",
				Unit: "By",
				Data: &metricspb.Metric_Gauge{Gauge: &metricspb.Gauge{DataPoints: []*metricspb.NumberDataPoint{{
					TimeUnixNano: stamp,
					Value:        &metricspb.NumberDataPoint_AsInt{AsInt: 42},
				}}}},
			}}}},
		}},
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", created.ApiKey, metricRequest); status != 200 {
		t.Fatalf("direct metrics status=%d, want 200", status)
	}
	assertSetupReceipt(t, ts, token, "/api/v1/observed-services/"+created.ID, "metrics")

	_, namesResult := ts.doRequest(t, "GET", "/api/v1/observed-services/"+created.ID+"/otel-metrics", nil, auth...)
	if !namesResult.Success {
		t.Fatalf("list direct metric names: %+v", namesResult.Error)
	}
	var names []models.OtelMetricName
	if err := json.Unmarshal(namesResult.Data, &names); err != nil {
		t.Fatal(err)
	}
	if len(names) != 1 || names[0].MetricName != "process.runtime.go.memory.usage" {
		t.Fatalf("unexpected direct metric names: %+v", names)
	}

	_, pointsResult := ts.doRequest(t, "GET", "/api/v1/observed-services/"+created.ID+"/otel-metrics/points?name=process.runtime.go.memory.usage", nil, auth...)
	var points []models.OtelMetric
	if err := json.Unmarshal(pointsResult.Data, &points); err != nil {
		t.Fatal(err)
	}
	if len(points) != 1 || points[0].Value != 42 || points[0].ServiceID != created.ID || points[0].ServiceName != created.Name {
		t.Fatalf("unexpected direct metric points: %+v", points)
	}

	_, representativesResult := ts.doRequest(t, "GET", "/api/v1/observed-services/service-metrics", nil, auth...)
	var representatives []models.OtelServiceMetric
	if err := json.Unmarshal(representativesResult.Data, &representatives); err != nil {
		t.Fatal(err)
	}
	if len(representatives) != 1 || representatives[0].ServiceID != created.ID || representatives[0].Value != 42 {
		t.Fatalf("unexpected direct representative metrics: %+v", representatives)
	}

	_, alertResult := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name":       "direct goroutine pressure",
		"type":       "service",
		"serviceId":  created.ID,
		"metric":     "otel_metric",
		"metricName": "process.runtime.go.memory.usage",
		"operator":   "gt",
		"threshold":  100,
	}, auth...)
	if !alertResult.Success {
		t.Fatalf("create direct metric alert: %+v", alertResult.Error)
	}
	var alertRule models.AlertRule
	if err := json.Unmarshal(alertResult.Data, &alertRule); err != nil {
		t.Fatal(err)
	}
	rules, err := database.NewAlertRuleRepository().GetEnabledOtelMetricRules(created.ID, "", created.Name)
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].ID != alertRule.ID {
		t.Fatalf("direct metric alert selection = %+v", rules)
	}
	leaked, err := database.NewAlertRuleRepository().GetEnabledOtelMetricRules("different-service", "", "other")
	if err != nil {
		t.Fatal(err)
	}
	if len(leaked) != 0 {
		t.Fatalf("direct metric alert leaked to another target: %+v", leaked)
	}

	deleteRequest := httptest.NewRequest("DELETE", "/api/v1/observed-services/"+created.ID, nil)
	deleteRequest.Header.Set(auth[0], auth[1])
	deleteResponse, err := ts.App.Test(deleteRequest, -1)
	if err != nil {
		t.Fatal(err)
	}
	deleteResponse.Body.Close()
	if deleteResponse.StatusCode != 204 {
		t.Fatalf("delete direct metrics target status=%d, want 204", deleteResponse.StatusCode)
	}
	for table, column := range map[string]string{
		"otel_metrics": "service_id",
		"alert_rules":  "service_id",
	} {
		var count int
		if err := database.DB.QueryRow("SELECT COUNT(*) FROM "+table+" WHERE "+column+" = ?", created.ID).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("%s rows after direct target deletion = %d, want 0", table, count)
		}
	}
}
