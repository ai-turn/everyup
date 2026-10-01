package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// Service syncs become deploy markers when the container is rolled out again
// (new image, or recreated on the same tag) — not on first sight, not on a
// crash restart, not when nothing changed.
func TestAgentDeploysFromServiceSync(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	repo := database.NewAgentRepository()
	if err := repo.UpsertAgent(models.Agent{ID: "agent-dep", Name: "prod", LastSeenAt: time.Now()}); err != nil {
		t.Fatalf("seed agent: %v", err)
	}
	t0 := time.Now().Add(-time.Hour).Truncate(time.Second)
	sync := func(image string, started time.Time, restarts int) {
		t.Helper()
		err := repo.UpsertServices("agent-dep", time.Now(), []models.AgentService{{
			AgentID: "agent-dep", Key: "k-api", Name: "api", CheckType: "http",
			Image: image, StartedAt: started, RestartCount: restarts, Healthy: true, Seen: true,
		}})
		if err != nil {
			t.Fatalf("sync: %v", err)
		}
	}

	sync("api:1.0", t0, 0)                     // first sight
	sync("api:1.0", t0, 0)                     // unchanged
	sync("api:1.1", t0.Add(10*time.Minute), 0) // new image → deploy
	sync("api:1.1", t0.Add(20*time.Minute), 1) // crash restart
	sync("api:1.1", t0.Add(30*time.Minute), 0) // recreated on the same tag → deploy

	_, result := ts.doRequest(t, "GET", "/api/v1/agents/agent-dep/deploys?key=k-api&from="+t0.Add(-time.Minute).UTC().Format(time.RFC3339), nil, auth...)
	if !result.Success {
		t.Fatalf("get deploys: %v", result.Error)
	}
	var deploys []models.AgentEvent
	if err := json.Unmarshal(result.Data, &deploys); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(deploys) != 2 {
		t.Fatalf("deploys = %d, want 2: %+v", len(deploys), deploys)
	}
	if !deploys[0].Time.Equal(t0.Add(10*time.Minute)) || deploys[0].Metadata["previousImage"] != "api:1.0" {
		t.Errorf("first deploy = %v %v, want image change at t0+10m", deploys[0].Time, deploys[0].Metadata)
	}
	if !deploys[1].Time.Equal(t0.Add(30 * time.Minute)) {
		t.Errorf("second deploy at %v, want t0+30m", deploys[1].Time)
	}

	// The window bound excludes older deploys.
	_, result = ts.doRequest(t, "GET", "/api/v1/agents/agent-dep/deploys?from="+t0.Add(15*time.Minute).UTC().Format(time.RFC3339), nil, auth...)
	json.Unmarshal(result.Data, &deploys)
	if len(deploys) != 1 {
		t.Errorf("deploys since t0+15m = %d, want 1", len(deploys))
	}
}
