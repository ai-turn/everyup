package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// GET /agents/overview: per-agent KPI rollup (30d uptime, active incidents,
// 24h requests, latest p95) for the home project cards.
func TestAgentOverview(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")

	repo := database.NewAgentRepository()
	agent := models.Agent{ID: "agent-ov", Name: "prod", LastSeenAt: time.Now()}
	if err := repo.UpsertAgent(agent); err != nil {
		t.Fatalf("UpsertAgent: %v", err)
	}
	svc := func(key string, healthy bool) models.AgentService {
		return models.AgentService{AgentID: agent.ID, Key: key, Name: key, CheckType: "http", Endpoint: "http://x", Healthy: healthy, Seen: true}
	}
	// Two syncs of two services: all healthy → "b" goes down and stays down.
	// History: 4 checks, 3 healthy (75%) + one open incident.
	now := time.Now()
	if err := repo.UpsertServices(agent.ID, now.Add(-time.Hour), []models.AgentService{svc("a", true), svc("b", true)}); err != nil {
		t.Fatalf("UpsertServices: %v", err)
	}
	if err := repo.UpsertServices(agent.ID, now.Add(-30*time.Minute), []models.AgentService{svc("a", true), svc("b", false)}); err != nil {
		t.Fatalf("UpsertServices: %v", err)
	}

	reqRepo := database.NewApiRequestRepository()
	mk := func(id string, dur int, at time.Time) models.ApiRequest {
		return models.ApiRequest{
			ServiceID: "svc-a", AgentID: agent.ID, ServiceName: "a", RequestID: id,
			Method: "GET", Path: "/x", PathTemplate: "/x",
			StatusCode: 200, DurationMs: dur, CreatedAt: at,
		}
	}
	// Anchor to the truncated hour so all three land in ONE 60-min stat bucket
	// regardless of when the test runs (now-Xm timestamps split across buckets
	// near the hour boundary and flake the p95 assertion).
	hour := now.Truncate(time.Hour)
	if _, err := reqRepo.CreateBatch([]models.ApiRequest{
		mk("r1", 10, hour.Add(1*time.Minute)),
		mk("r2", 200, hour.Add(2*time.Minute)),
		mk("r3", 30, hour.Add(3*time.Minute)),
	}); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	resp, result := ts.doRequest(t, "GET", "/api/v1/agents/overview", nil, authHeader(token)...)
	if resp.StatusCode != http.StatusOK || !result.Success {
		t.Fatalf("overview failed: status=%d result=%+v", resp.StatusCode, result)
	}
	var rows []models.AgentOverview
	if err := json.Unmarshal(result.Data, &rows); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(rows) != 1 || rows[0].AgentID != agent.ID {
		t.Fatalf("rows = %+v, want exactly one for %s", rows, agent.ID)
	}
	ov := rows[0]
	if ov.UptimePct == nil || *ov.UptimePct != 75 {
		t.Errorf("uptimePct = %v, want 75 (3 healthy of 4 checks)", ov.UptimePct)
	}
	if ov.ActiveIncidents != 1 {
		t.Errorf("activeIncidents = %d, want 1", ov.ActiveIncidents)
	}
	if ov.Requests24h != 3 {
		t.Errorf("requests24h = %d, want 3", ov.Requests24h)
	}
	if ov.P95Ms == nil || *ov.P95Ms != 200 {
		t.Errorf("p95Ms = %v, want 200 (nearest-rank p95 of 10/200/30)", ov.P95Ms)
	}

	// Per-service slice: "a" stayed healthy and owns the requests; "b" went
	// down once and has no requests (p95 unknown, not 0).
	byKey := map[string]models.ServiceOverview{}
	for _, s := range ov.Services {
		byKey[s.Key] = s
	}
	if len(byKey) != 2 {
		t.Fatalf("services = %+v, want a and b", ov.Services)
	}
	if a := byKey["a"]; a.UptimePct == nil || *a.UptimePct != 100 || a.Requests24h != 3 || a.P95Ms == nil || *a.P95Ms != 200 {
		t.Errorf("service a = %+v, want 100%% uptime, 3 requests, p95 200", a)
	}
	if b := byKey["b"]; b.UptimePct == nil || *b.UptimePct != 50 || b.Requests24h != 0 || b.P95Ms != nil {
		t.Errorf("service b = %+v, want 50%% uptime, 0 requests, nil p95", b)
	}
}
