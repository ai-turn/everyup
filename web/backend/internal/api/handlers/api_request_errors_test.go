package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/models"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

func TestDirectRequestErrorsUseOTelStatusAndHTTP5xx(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	_, created := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
		"name": "error-semantics", "signals": []string{"traces"},
	}, auth...)
	var service models.ObservedServiceSetup
	if err := json.Unmarshal(created.Data, &service); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		path      string
		status    int64
		otelError bool
	}{{"/ok", 200, false}, {"/marked", 200, true}, {"/missing", 404, false}, {"/failed", 500, false}}
	var spans []*tracepb.Span
	for i, tc := range cases {
		traceID, spanID := make([]byte, 16), make([]byte, 8)
		traceID[15], spanID[7] = byte(i+1), byte(i+1)
		span := directServerSpan(traceID, spanID, tc.path, tc.status, uint64(time.Now().UnixNano()))
		if tc.otelError {
			span.Status.Code = tracepb.Status_STATUS_CODE_ERROR
		}
		spans = append(spans, span)
	}
	traces := &collectortracepb.ExportTraceServiceRequest{ResourceSpans: []*tracepb.ResourceSpans{{
		Resource:   &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{Key: "service.name", Value: stringValue(service.Name)}}},
		ScopeSpans: []*tracepb.ScopeSpans{{Spans: spans}},
	}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/traces", service.ApiKey, traces); status != 200 {
		t.Fatalf("trace ingest status=%d", status)
	}
	_, response := ts.doRequest(t, "GET", "/api/v1/observed-services/"+service.ID+"/requests?errorsOnly=true", nil, auth...)
	var result struct {
		Data  []models.ApiRequest `json:"data"`
		Total int                 `json:"total"`
	}
	if err := json.Unmarshal(response.Data, &result); err != nil {
		t.Fatal(err)
	}
	if result.Total != 2 {
		t.Fatalf("errors must include marked 200 and 500, not unmarked 404: %+v", result)
	}
	found := map[string]bool{}
	for _, row := range result.Data {
		found[row.Path] = true
	}
	if !found["/marked"] || !found["/failed"] {
		t.Fatalf("wrong error requests: %+v", result.Data)
	}
	_, response = ts.doRequest(t, "GET", "/api/v1/observed-services/"+service.ID+"/request-stats", nil, auth...)
	var stats models.ApiRequestStats
	if err := json.Unmarshal(response.Data, &stats); err != nil {
		t.Fatal(err)
	}
	var count, errors int
	for _, bucket := range stats.Buckets {
		count += bucket.Count
		errors += bucket.ErrorCount
	}
	if count != 4 || errors != 2 {
		t.Fatalf("stats count/errors=%d/%d, want 4/2", count, errors)
	}
}
