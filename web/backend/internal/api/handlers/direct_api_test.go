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
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

func directServerSpan(traceID, spanID []byte, path string, status int64, start uint64) *tracepb.Span {
	return &tracepb.Span{
		TraceId: traceID, SpanId: spanID, Name: "GET " + path,
		Kind:              tracepb.Span_SPAN_KIND_SERVER,
		StartTimeUnixNano: start, EndTimeUnixNano: start + uint64(25*time.Millisecond),
		Status: &tracepb.Status{Code: tracepb.Status_STATUS_CODE_OK},
		Attributes: []*commonpb.KeyValue{
			{Key: "http.request.method", Value: stringValue("GET")},
			{Key: "url.path", Value: stringValue(path)},
			{Key: "http.response.status_code", Value: intValue(status)},
		},
	}
}

func TestDirectApiSetupProjectionCorrelationAlertAndDelete(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
		"name":    "orders-api",
		"signals": []string{"traces"},
	}, auth...)
	if !createResult.Success {
		t.Fatalf("create direct API target: %+v", createResult.Error)
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
		t.Fatalf("direct API setup created %d Agent rows, want 0", agentCount)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", created.ApiKey, &collectorlogspb.ExportLogsServiceRequest{}); status != 403 {
		t.Fatalf("trace-scoped key logs status=%d, want 403", status)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/metrics", created.ApiKey, &collectormetricspb.ExportMetricsServiceRequest{}); status != 403 {
		t.Fatalf("trace-scoped key metrics status=%d, want 403", status)
	}

	_, exclusionsResult := ts.doRequest(t, "PUT", "/api/v1/observed-services/"+created.ID+"/api-exclusions", map[string]interface{}{
		"paths": []string{"/health*"},
	}, auth...)
	if !exclusionsResult.Success {
		t.Fatalf("set direct API exclusions: %+v", exclusionsResult.Error)
	}

	ordersTraceID := []byte{0xaa, 0xbb, 0xcc, 0xdd, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c}
	ordersSpanID := []byte{0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17}
	healthTraceID := []byte{0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c}
	healthSpanID := []byte{0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27}
	start := uint64(time.Now().UTC().UnixNano())
	traceRequest := &collectortracepb.ExportTraceServiceRequest{ResourceSpans: []*tracepb.ResourceSpans{{
		Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{Key: "service.name", Value: stringValue("spoofed-api")}}},
		ScopeSpans: []*tracepb.ScopeSpans{{Spans: []*tracepb.Span{
			directServerSpan(ordersTraceID, ordersSpanID, "/orders/42", 503, start),
			directServerSpan(healthTraceID, healthSpanID, "/health/ready", 200, start),
		}}},
	}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/traces", created.ApiKey, traceRequest); status != 200 {
		t.Fatalf("direct traces status=%d, want 200", status)
	}
	assertSetupReceipt(t, ts, token, "/api/v1/observed-services/"+created.ID, "traces")

	_, requestsResult := ts.doRequest(t, "GET", "/api/v1/observed-services/"+created.ID+"/requests", nil, auth...)
	var requests struct {
		Data  []models.ApiRequest `json:"data"`
		Total int                 `json:"total"`
	}
	if err := json.Unmarshal(requestsResult.Data, &requests); err != nil {
		t.Fatal(err)
	}
	if requests.Total != 1 || len(requests.Data) != 1 || requests.Data[0].Path != "/orders/42" {
		t.Fatalf("direct request projections/exclusions: %+v", requests)
	}
	if requests.Data[0].ServiceID != created.ID || requests.Data[0].ServiceName != created.Name || requests.Data[0].TraceID != "aabbccdd0102030405060708090a0b0c" {
		t.Fatalf("direct request identity/correlation: %+v", requests.Data[0])
	}

	_, statsResult := ts.doRequest(t, "GET", "/api/v1/observed-services/"+created.ID+"/request-stats", nil, auth...)
	var stats []models.ApiRequestStatBucket
	if err := json.Unmarshal(statsResult.Data, &stats); err != nil || len(stats) != 1 || stats[0].Count != 1 || stats[0].ErrorCount != 1 {
		t.Fatalf("direct request stats: %+v, err=%v", stats, err)
	}
	_, summaryResult := ts.doRequest(t, "GET", "/api/v1/observed-services/"+created.ID+"/request-status-summary", nil, auth...)
	var summary models.ApiRequestStatusSummary
	if err := json.Unmarshal(summaryResult.Data, &summary); err != nil || summary.Count5xx != 1 || summary.Top5xxPath != "/orders/:id" {
		// NormalizePath turns the numeric segment into :id.
		t.Fatalf("direct request summary: %+v, err=%v", summary, err)
	}

	_, alertResult := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name": "direct API failures", "type": "log", "serviceId": created.ID,
		"metric": "api_status_code", "operator": "gte", "threshold": 500,
	}, auth...)
	if !alertResult.Success {
		t.Fatalf("create direct API alert: %+v", alertResult.Error)
	}
	var alert models.AlertRule
	if err := json.Unmarshal(alertResult.Data, &alert); err != nil {
		t.Fatal(err)
	}
	rules, err := database.NewAlertRuleRepository().GetEnabledApiRequestRules(created.ID, "", created.Name)
	if err != nil || len(rules) != 1 || rules[0].ID != alert.ID {
		t.Fatalf("direct API alert selection: %+v, err=%v", rules, err)
	}
	leaked, err := database.NewAlertRuleRepository().GetEnabledApiRequestRules("other-service", "", "other")
	if err != nil || len(leaked) != 0 {
		t.Fatalf("direct API alert leaked: %+v, err=%v", leaked, err)
	}

	// Add Logs to the same target and prove trace detail correlates both signals.
	_, updateResult := ts.doRequest(t, "PUT", "/api/v1/observed-services/"+created.ID, map[string]interface{}{
		"name": created.Name, "signals": []string{"logs", "traces"},
	}, auth...)
	if !updateResult.Success {
		t.Fatalf("attach logs to direct API target: %+v", updateResult.Error)
	}
	logRequest := &collectorlogspb.ExportLogsServiceRequest{ResourceLogs: []*logspb.ResourceLogs{{
		Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{Key: "service.name", Value: stringValue("another-spoof")}}},
		ScopeLogs: []*logspb.ScopeLogs{{LogRecords: []*logspb.LogRecord{{
			TimeUnixNano: start, SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_INFO,
			Body: stringValue("correlated direct API log"), TraceId: ordersTraceID, SpanId: ordersSpanID,
		}}}},
	}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", created.ApiKey, logRequest); status != 200 {
		t.Fatalf("expanded direct key logs status=%d, want 200", status)
	}

	_, traceResult := ts.doRequest(t, "GET", "/api/v1/traces/aabbccdd0102030405060708090a0b0c", nil, auth...)
	var traceDetail struct {
		Spans       []models.Span       `json:"spans"`
		Logs        []models.Log        `json:"logs"`
		ApiRequests []models.ApiRequest `json:"apiRequests"`
	}
	if err := json.Unmarshal(traceResult.Data, &traceDetail); err != nil {
		t.Fatal(err)
	}
	if len(traceDetail.Spans) != 1 || len(traceDetail.Logs) != 1 || len(traceDetail.ApiRequests) != 1 {
		t.Fatalf("direct trace correlation: %+v", traceDetail)
	}

	deleteRequest := httptest.NewRequest("DELETE", "/api/v1/observed-services/"+created.ID, nil)
	deleteRequest.Header.Set(auth[0], auth[1])
	deleteResponse, err := ts.App.Test(deleteRequest, -1)
	if err != nil {
		t.Fatal(err)
	}
	deleteResponse.Body.Close()
	if deleteResponse.StatusCode != 204 {
		t.Fatalf("delete direct API target status=%d, want 204", deleteResponse.StatusCode)
	}
	for table, column := range map[string]string{
		"spans": "service_id", "api_requests": "service_id", "logs": "service_id", "alert_rules": "service_id",
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
