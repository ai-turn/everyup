package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

// TestTraceDiscovery_ReachesUnprojectedSpans ingests a Kafka consumer trace and
// an HTTP one. Only the HTTP trace becomes an api_request, so the consumer
// trace is reachable through the trace list and nowhere else.
func TestTraceDiscovery_ReachesUnprojectedSpans(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "proj-t"}, auth...)
	var agent struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatalf("decode agent: %v", err)
	}
	agent.APIKey = revealAgentAPIKey(t, ts, agent.ID, auth...)

	const svcKey = "c-traces"
	const svcName = "orders-api"
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{
		AgentID: agent.ID, Key: svcKey, Name: svcName, CheckType: "http", Endpoint: "http://x",
	}}); err != nil {
		t.Fatalf("seed agent service: %v", err)
	}

	start := uint64(time.Now().Add(-time.Minute).UnixNano())
	ms := uint64(time.Millisecond)
	postOTLP(t, ts, "/api/v1/otlp/v1/traces", agent.APIKey, &collectortracepb.ExportTraceServiceRequest{
		ResourceSpans: []*tracepb.ResourceSpans{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
				{Key: "service.name", Value: stringValue(svcName)},
			}},
			ScopeSpans: []*tracepb.ScopeSpans{{
				Spans: []*tracepb.Span{
					{
						// No HTTP method or status: dropped by spanToAPIRequest.
						TraceId: []byte("consumertrace16b"), SpanId: []byte("conspan1"),
						Name: "orders.process", Kind: tracepb.Span_SPAN_KIND_CONSUMER,
						StartTimeUnixNano: start, EndTimeUnixNano: start + 2500*ms,
						Status: &tracepb.Status{Code: tracepb.Status_STATUS_CODE_ERROR},
					},
					{
						TraceId: []byte("httptrace0000016"), SpanId: []byte("htspan01"),
						Name: "GET /orders", Kind: tracepb.Span_SPAN_KIND_SERVER,
						StartTimeUnixNano: start, EndTimeUnixNano: start + 40*ms,
						Attributes: []*commonpb.KeyValue{
							{Key: "http.request.method", Value: stringValue("GET")},
							{Key: "http.response.status_code", Value: intValue(200)},
							{Key: "url.path", Value: stringValue("/orders")},
						},
					},
				},
			}},
		}},
	})

	base := "/api/v1/agents/" + agent.ID + "/services/" + svcKey + "/traces"
	list := func(t *testing.T, query string) []models.TraceSummary {
		t.Helper()
		_, res := ts.doRequest(t, "GET", base+query, nil, auth...)
		if !res.Success {
			t.Fatalf("trace list%s failed: %v", query, res.Error)
		}
		var traces []models.TraceSummary
		if err := json.Unmarshal(res.Data, &traces); err != nil {
			t.Fatalf("decode traces: %v", err)
		}
		return traces
	}

	// Both traces are discoverable, including the one api_requests never saw.
	all := list(t, "")
	if len(all) != 2 {
		t.Fatalf("got %d traces, want 2: %+v", len(all), all)
	}

	slowest := list(t, "?sort=slowest")
	if slowest[0].Name != "orders.process" || slowest[0].DurationMs != 2500 {
		t.Fatalf("slowest = %+v, want orders.process at 2500ms", slowest[0])
	}
	if slowest[0].Kind != "CONSUMER" || slowest[0].ErrorCount != 1 {
		t.Errorf("consumer trace described as %q with %d errors, want CONSUMER/1", slowest[0].Kind, slowest[0].ErrorCount)
	}

	failing := list(t, "?errorsOnly=true")
	if len(failing) != 1 || failing[0].Name != "orders.process" {
		t.Fatalf("errorsOnly gave %+v, want just the consumer trace", failing)
	}

	slow := list(t, "?minDurationMs=1000")
	if len(slow) != 1 || slow[0].Name != "orders.process" {
		t.Fatalf("minDurationMs gave %+v, want just the consumer trace", slow)
	}

	// Only the HTTP span was projected, which is what makes the list necessary.
	_, reqRes := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/requests", nil, auth...)
	var requests struct {
		Data  []models.ApiRequest `json:"data"`
		Total int                 `json:"total"`
	}
	if err := json.Unmarshal(reqRes.Data, &requests); err != nil {
		t.Fatalf("decode requests: %v", err)
	}
	if requests.Total != 1 || requests.Data[0].Path != "/orders" {
		t.Fatalf("api_requests = %+v, want only the HTTP trace", requests)
	}

	// The listed trace ID opens the existing trace detail view.
	_, detail := ts.doRequest(t, "GET", "/api/v1/traces/"+slowest[0].TraceID, nil, auth...)
	if !detail.Success {
		t.Fatalf("trace detail for %s failed: %v", slowest[0].TraceID, detail.Error)
	}
}
