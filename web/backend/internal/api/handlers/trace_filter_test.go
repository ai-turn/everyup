package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestTargetScopedTelemetryEndpointsFilterByTraceID(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	agentRepo := database.NewAgentRepository()
	agent := models.Agent{ID: "agent-trace-filter", Name: "production", LastSeenAt: time.Now()}
	if err := agentRepo.UpsertAgent(agent); err != nil {
		t.Fatal(err)
	}
	service := models.AgentService{AgentID: agent.ID, Key: "api", Name: "orders-api", CheckType: "http", Endpoint: "http://orders", Healthy: true, Seen: true}
	if err := agentRepo.UpsertServices(agent.ID, time.Now(), []models.AgentService{service}); err != nil {
		t.Fatal(err)
	}

	logRepo := database.NewLogRepository()
	for _, row := range []models.Log{
		{AgentID: agent.ID, ServiceName: service.Name, Level: models.LogLevelInfo, Message: "trace A", TraceID: "trace-a", CreatedAt: time.Now()},
		{AgentID: agent.ID, ServiceName: service.Name, Level: models.LogLevelInfo, Message: "trace B", TraceID: "trace-b", CreatedAt: time.Now()},
	} {
		row := row
		if err := logRepo.Create(&row); err != nil {
			t.Fatal(err)
		}
	}

	requestRepo := database.NewApiRequestRepository()
	requests := []models.ApiRequest{
		{AgentID: agent.ID, ServiceName: service.Name, RequestID: "agent-a", Method: "GET", Path: "/a", StatusCode: 200, TraceID: "trace-a", CreatedAt: time.Now()},
		{AgentID: agent.ID, ServiceName: service.Name, RequestID: "agent-b", Method: "GET", Path: "/b", StatusCode: 200, TraceID: "trace-b", CreatedAt: time.Now()},
	}
	if _, err := requestRepo.CreateBatch(requests); err != nil {
		t.Fatal(err)
	}

	assertSingleTraceRow(t, ts, "/api/v1/agents/"+agent.ID+"/services/api/logs?traceId=trace-a", "trace-a", auth)
	assertSingleTraceRow(t, ts, "/api/v1/agents/"+agent.ID+"/services/api/requests?traceId=trace-a", "trace-a", auth)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
		"name": "direct-orders", "signals": []string{"traces"},
	}, auth...)
	if !createResult.Success {
		t.Fatalf("create observed service: %+v", createResult.Error)
	}
	var observed struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(createResult.Data, &observed); err != nil {
		t.Fatal(err)
	}
	if _, err := requestRepo.CreateBatch([]models.ApiRequest{
		{ServiceID: observed.ID, ServiceName: "direct-orders", RequestID: "direct-a", Method: "GET", Path: "/a", StatusCode: 200, TraceID: "trace-a", CreatedAt: time.Now()},
		{ServiceID: observed.ID, ServiceName: "direct-orders", RequestID: "direct-b", Method: "GET", Path: "/b", StatusCode: 200, TraceID: "trace-b", CreatedAt: time.Now()},
	}); err != nil {
		t.Fatal(err)
	}
	assertSingleTraceRow(t, ts, "/api/v1/observed-services/"+observed.ID+"/requests?traceId=trace-a", "trace-a", auth)
}

func assertSingleTraceRow(t *testing.T, ts *testServer, path, traceID string, auth []string) {
	t.Helper()
	resp, result := ts.doRequest(t, "GET", path, nil, auth...)
	if resp.StatusCode != http.StatusOK || !result.Success {
		t.Fatalf("GET %s: status=%d error=%+v", path, resp.StatusCode, result.Error)
	}
	var payload struct {
		Data []struct {
			TraceID string `json:"traceId"`
		} `json:"data"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(result.Data, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Total != 1 || len(payload.Data) != 1 || payload.Data[0].TraceID != traceID {
		t.Fatalf("GET %s returned %+v, want only %s", path, payload, traceID)
	}
}
