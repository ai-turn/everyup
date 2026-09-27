package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
)

func TestOTLPIngest_LogStorageFailureRollsBackBatch(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)
	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "log-retry"}, auth...)
	if !created.Success {
		t.Fatalf("create agent: %v", created.Error)
	}
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatal(err)
	}
	apiKey := revealAgentAPIKey(t, ts, agent.ID, auth...)
	if _, err := database.DB.Exec(`CREATE TRIGGER reject_otlp_log BEFORE INSERT ON logs
WHEN NEW.message = 'reject me' BEGIN SELECT RAISE(ABORT, 'rejected'); END`); err != nil {
		t.Fatal(err)
	}
	request := &collectorlogspb.ExportLogsServiceRequest{ResourceLogs: []*logspb.ResourceLogs{{
		ScopeLogs: []*logspb.ScopeLogs{{LogRecords: []*logspb.LogRecord{
			{Body: stringValue("keep me"), SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_INFO},
			{Body: stringValue("reject me"), SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_INFO},
		}}},
	}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", apiKey, request); status != 500 {
		t.Fatalf("failed batch status = %d, want 500", status)
	}
	var count int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM logs WHERE agent_id = ?`, agent.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("failed batch stored %d logs, want none", count)
	}
	if _, err := database.DB.Exec(`DROP TRIGGER reject_otlp_log`); err != nil {
		t.Fatal(err)
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", apiKey, request); status != 200 {
		t.Fatalf("retry status = %d, want 200", status)
	}
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM logs WHERE agent_id = ?`, agent.ID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("retry stored %d logs, want 2", count)
	}
}

// TestOTLPIngest_AgentKeyUnifiesLogsUnderService verifies the unified flow: the
// single project (agent) key authenticates OTLP log ingestion, and a log tagged
// with an OTLP service.name surfaces under the matching agent service — keyed by
// (agent_id, service_name), with no legacy services-table row involved.
func TestOTLPIngest_AgentKeyUnifiesLogsUnderService(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create a project via the UI path, then explicitly reveal its ingestion key.
	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "proj-1"}, auth...)
	if !created.Success {
		t.Fatalf("create agent failed: %v", created.Error)
	}
	var agent struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatalf("decode agent: %v", err)
	}
	if agent.ID == "" {
		t.Fatalf("missing agent id/key: %+v", agent)
	}
	agent.APIKey = revealAgentAPIKey(t, ts, agent.ID, auth...)

	// Sync one service under the project (key != name, mirroring real discovery).
	const svcKey = "container-abc"
	const svcName = "checkout-api"
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{
		AgentID: agent.ID, Key: svcKey, Name: svcName, CheckType: "http", Endpoint: "http://x/health",
	}}); err != nil {
		t.Fatalf("seed agent service: %v", err)
	}

	// Send an OTLP log with the SAME project key, tagged service.name=checkout-api.
	logReq := &collectorlogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
				{Key: "service.name", Value: stringValue(svcName)},
			}},
			ScopeLogs: []*logspb.ScopeLogs{{
				LogRecords: []*logspb.LogRecord{{
					TimeUnixNano:   uint64(time.Date(2026, 6, 25, 12, 0, 0, 0, time.UTC).UnixNano()),
					SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_INFO,
					Body:           stringValue("agent-key log entry"),
				}},
			}},
		}},
	}
	postOTLP(t, ts, "/api/v1/otlp/v1/logs", agent.APIKey, logReq)

	// Read it back through the agent service endpoint (joined by agent_id + name).
	_, logs := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/logs", nil, auth...)
	if !logs.Success {
		t.Fatalf("get service logs failed: %v", logs.Error)
	}
	var logPayload struct {
		Data  []models.Log `json:"data"`
		Total int          `json:"total"`
	}
	if err := json.Unmarshal(logs.Data, &logPayload); err != nil {
		t.Fatalf("decode logs: %v", err)
	}
	entries := logPayload.Data
	if len(entries) != 1 {
		t.Fatalf("want 1 log under the agent service, got %d: %+v", len(entries), entries)
	}
	if entries[0].Message != "agent-key log entry" || entries[0].ServiceName != svcName {
		t.Fatalf("unexpected log: %+v", entries[0])
	}
	if entries[0].AgentID != agent.ID {
		t.Fatalf("log not tied to agent: agentId=%q want %q", entries[0].AgentID, agent.ID)
	}
}

// TestOTLPIngest_PerServiceLogFilter verifies the UI-set per-service ingest filter:
// after restricting a service to error-only, an info log is dropped at ingest while
// an error log is stored. The filter is set by (agent,key) and read by name.
func TestOTLPIngest_PerServiceLogFilter(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "proj-f"}, auth...)
	var agent struct {
		ID     string `json:"id"`
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatalf("decode agent: %v", err)
	}
	agent.APIKey = revealAgentAPIKey(t, ts, agent.ID, auth...)

	const svcKey = "c-1"
	const svcName = "billing-api"
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{
		AgentID: agent.ID, Key: svcKey, Name: svcName, CheckType: "http", Endpoint: "http://x",
	}}); err != nil {
		t.Fatalf("seed agent service: %v", err)
	}

	// Restrict ingest to error-only via the new endpoint.
	_, setRes := ts.doRequest(t, "PUT",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/log-filter",
		map[string]interface{}{"levels": []string{"error"}}, auth...)
	if !setRes.Success {
		t.Fatalf("set log filter failed: %v", setRes.Error)
	}

	mkLog := func(sev logspb.SeverityNumber, msg string) *collectorlogspb.ExportLogsServiceRequest {
		return &collectorlogspb.ExportLogsServiceRequest{
			ResourceLogs: []*logspb.ResourceLogs{{
				Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
					{Key: "service.name", Value: stringValue(svcName)},
				}},
				ScopeLogs: []*logspb.ScopeLogs{{
					LogRecords: []*logspb.LogRecord{{SeverityNumber: sev, Body: stringValue(msg)}},
				}},
			}},
		}
	}
	postOTLP(t, ts, "/api/v1/otlp/v1/logs", agent.APIKey, mkLog(logspb.SeverityNumber_SEVERITY_NUMBER_INFO, "info dropped"))
	postOTLP(t, ts, "/api/v1/otlp/v1/logs", agent.APIKey, mkLog(logspb.SeverityNumber_SEVERITY_NUMBER_ERROR, "error kept"))

	_, logs := ts.doRequest(t, "GET",
		"/api/v1/agents/"+agent.ID+"/services/"+svcKey+"/logs", nil, auth...)
	var logPayload struct {
		Data  []models.Log `json:"data"`
		Total int          `json:"total"`
	}
	if err := json.Unmarshal(logs.Data, &logPayload); err != nil {
		t.Fatalf("decode logs: %v", err)
	}
	entries := logPayload.Data
	if len(entries) != 1 || entries[0].Message != "error kept" {
		t.Fatalf("filter not applied: want only [error kept], got %+v", entries)
	}
}

// TestOTLPIngest_RejectsUnknownKey ensures a bogus key is refused at the OTLP boundary.
func TestOTLPIngest_RejectsUnknownKey(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")

	logReq := &collectorlogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
				{Key: "service.name", Value: stringValue("nope")},
			}},
			ScopeLogs: []*logspb.ScopeLogs{{
				LogRecords: []*logspb.LogRecord{{Body: stringValue("x")}},
			}},
		}},
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", "evup_svc_does_not_exist", logReq); status != 401 {
		t.Fatalf("unknown key status = %d, want 401", status)
	}
}
