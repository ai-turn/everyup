package handlers_test

import (
	"encoding/json"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"testing"
	"time"
)

func TestInstrumentationRunSelectionAuthorizationAndReceipt(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	_, response := ts.doRequest(t, "POST", "/api/v1/agents", map[string]any{"name": "production"}, authHeader(token)...)
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(response.Data, &agent); err != nil {
		t.Fatal(err)
	}
	path := "/api/v1/agents/" + agent.ID
	_, response = ts.doRequest(t, "GET", path+"/key", nil, authHeader(token)...)
	var credential struct {
		Key string `json:"apiKey"`
	}
	if err := json.Unmarshal(response.Data, &credential); err != nil {
		t.Fatal(err)
	}
	repo := database.NewAgentRepository()
	if err := repo.UpsertServices(agent.ID, time.Now(), []models.AgentService{{Key: "shop:api", Name: "api", Runtime: "node", Seen: true}}); err != nil {
		t.Fatal(err)
	}
	for _, keys := range [][]string{{"shop:unknown"}, {"other:api"}, {"shop:api", "shop:api"}} {
		resp, _ := ts.doRequest(t, "POST", path+"/instrumentation-runs", map[string]any{"project": "shop", "keys": keys}, authHeader(token)...)
		if resp.StatusCode != 400 {
			t.Fatalf("invalid selection accepted: %v", keys)
		}
	}
	create := func() models.InstrumentationRun {
		resp, result := ts.doRequest(t, "POST", path+"/instrumentation-runs", map[string]any{"project": "shop", "keys": []string{"shop:api"}}, authHeader(token)...)
		if resp.StatusCode != 201 {
			t.Fatalf("create status=%d", resp.StatusCode)
		}
		var run models.InstrumentationRun
		if err := json.Unmarshal(result.Data, &run); err != nil {
			t.Fatal(err)
		}
		return run
	}
	run := create()
	reportPath := path + "/instrumentation-runs/" + run.ID + "/report"
	payload := map[string]any{"status": "applying", "project": "shop", "targets": "api=node", "captureBodies": false}
	resp, _ := ts.doRequest(t, "POST", reportPath, payload, authHeader(token)...)
	if resp.StatusCode != 401 {
		t.Fatal("browser JWT must not acknowledge host execution")
	}
	payload["targets"] = "other=node"
	resp, _ = ts.doRequest(t, "POST", reportPath, payload, authHeader(credential.Key)...)
	if resp.StatusCode != 400 {
		t.Fatal("host selection must match the reviewed plan")
	}
	payload["targets"] = "api=node"
	payload["status"] = "verified"
	resp, _ = ts.doRequest(t, "POST", reportPath, payload, authHeader(credential.Key)...)
	if resp.StatusCode != 400 {
		t.Fatal("cannot verify an unstarted run")
	}
	payload["status"] = "applying"
	resp, _ = ts.doRequest(t, "POST", reportPath, payload, authHeader(credential.Key)...)
	if resp.StatusCode != 200 {
		t.Fatalf("start status=%d", resp.StatusCode)
	}
	payload["status"] = "verified"
	resp, _ = ts.doRequest(t, "POST", reportPath, payload, authHeader(credential.Key)...)
	if resp.StatusCode != 200 {
		t.Fatal("configuration should verify without traffic")
	}
	receiptRepo := database.ConnectionSetupRepository{}
	if err := receiptRepo.Record("agent", agent.ID, "api", "traces"); err != nil {
		t.Fatal(err)
	}
	if _, err := database.DB.Exec(`UPDATE signal_receipts SET last_received_ms=?`, time.Now().Add(-time.Hour).UnixMilli()); err != nil {
		t.Fatal(err)
	}
	read := func() models.InstrumentationRun {
		_, result := ts.doRequest(t, "GET", path+"/instrumentation-runs/"+run.ID, nil, authHeader(token)...)
		var current models.InstrumentationRun
		if err := json.Unmarshal(result.Data, &current); err != nil {
			t.Fatal(err)
		}
		return current
	}
	if current := read(); current.Status != "verified" || len(current.Signals) != 0 {
		t.Fatalf("old data claimed fresh receipt: %+v", current)
	}
	if err := receiptRepo.Record("agent", agent.ID, "api", "traces"); err != nil {
		t.Fatal(err)
	}
	if len(read().Signals) != 1 {
		t.Fatal("fresh selected service trace not shown")
	}
	payload["status"] = "rolled_back"
	payload["reason"] = "manual_rollback"
	resp, _ = ts.doRequest(t, "POST", reportPath, payload, authHeader(credential.Key)...)
	if resp.StatusCode != 200 {
		t.Fatal("rollback report failed")
	}
	payload["status"] = "applying"
	payload["reason"] = ""
	resp, _ = ts.doRequest(t, "POST", reportPath, payload, authHeader(credential.Key)...)
	if resp.StatusCode != 400 {
		t.Fatal("completed plan was replayed")
	}
	expired := create()
	if _, err := database.DB.Exec(`UPDATE instrumentation_runs SET created_ms=? WHERE id=?`, time.Now().Add(-2*time.Hour).UnixMilli(), expired.ID); err != nil {
		t.Fatal(err)
	}
	resp, _ = ts.doRequest(t, "POST", path+"/instrumentation-runs/"+expired.ID+"/report", payload, authHeader(credential.Key)...)
	if resp.StatusCode != 400 {
		t.Fatal("expired plan was started")
	}
}
