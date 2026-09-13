package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
)

func TestExistingCollectorProfileAndFreshSetupStatus(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]any{"name": "production", "profile": map[string]any{"kind": "basic"}}, authHeader(token)...)
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatal(err)
	}
	path := "/api/v1/agents/" + agent.ID
	_, keyBefore := ts.doRequest(t, "GET", path+"/key", nil, authHeader(token)...)
	var key struct {
		APIKey string `json:"apiKey"`
	}
	if err := json.Unmarshal(keyBefore.Data, &key); err != nil {
		t.Fatal(err)
	}
	resp, status := ts.doRequest(t, "GET", path+"/setup-status", nil, authHeader(token)...)
	if resp.StatusCode != 200 {
		t.Fatalf("setup status unavailable: %d", resp.StatusCode)
	}
	var setup struct {
		Connected     bool   `json:"connected"`
		ConfigApplied bool   `json:"configApplied"`
		DesiredHash   string `json:"desiredHash"`
	}
	json.Unmarshal(status.Data, &setup)
	if setup.Connected {
		t.Fatal("registration must not count as collector contact")
	}
	_, updated := ts.doRequest(t, "PUT", path+"/profile", map[string]any{"kind": "custom", "capabilities": []string{"uptime", "logs", "api"}}, authHeader(token)...)
	if !updated.Success {
		t.Fatalf("profile update failed: %v", updated.Error)
	}
	_, after := ts.doRequest(t, "GET", path+"/key", nil, authHeader(token)...)
	if string(after.Data) != string(keyBefore.Data) {
		t.Fatal("profile change rotated credential")
	}
	_, status = ts.doRequest(t, "GET", path+"/setup-status", nil, authHeader(token)...)
	json.Unmarshal(status.Data, &setup)
	if setup.DesiredHash == "" || setup.ConfigApplied {
		t.Fatal("requested config must remain pending")
	}
	sync := map[string]any{"agentId": agent.ID, "observedAt": time.Now(), "services": []any{}, "configHash": "old-config"}
	sendSync := func() {
		data, _ := json.Marshal(sync)
		req := httptest.NewRequest("POST", path+"/services", bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+key.APIKey)
		response, err := ts.App.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != 204 {
			t.Fatalf("sync failed: %d", response.StatusCode)
		}
	}
	sendSync()
	_, status = ts.doRequest(t, "GET", path+"/setup-status", nil, authHeader(token)...)
	json.Unmarshal(status.Data, &setup)
	if !setup.Connected || setup.ConfigApplied {
		t.Fatal("old config report must not acknowledge desired config")
	}
	sync["configHash"] = setup.DesiredHash
	sendSync()
	_, status = ts.doRequest(t, "GET", path+"/setup-status", nil, authHeader(token)...)
	json.Unmarshal(status.Data, &setup)
	if !setup.ConfigApplied {
		t.Fatal("matching report should acknowledge config")
	}
	if _, err := database.DB.Exec(`UPDATE collector_setup SET last_contact_ms=? WHERE agent_id=?`, time.Now().Add(-3*time.Minute).UnixMilli(), agent.ID); err != nil {
		t.Fatal(err)
	}
	_, status = ts.doRequest(t, "GET", path+"/setup-status", nil, authHeader(token)...)
	if err := json.Unmarshal(status.Data, &setup); err != nil {
		t.Fatal(err)
	}
	if setup.Connected || setup.ConfigApplied {
		t.Fatal("stale collector report must not count as connected")
	}
	resp, _ = ts.doRequest(t, "PUT", path+"/profile", map[string]any{"kind": "custom", "capabilities": []string{"invalid"}}, authHeader(token)...)
	if resp.StatusCode != 400 {
		t.Fatal("invalid capability accepted")
	}
}

func TestSignalReceiptRequiresStoredData(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	_, result := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]any{"name": "receipt-test", "signals": []string{"logs", "metrics"}}, authHeader(token)...)
	var service models.ObservedServiceSetup
	if err := json.Unmarshal(result.Data, &service); err != nil {
		t.Fatal(err)
	}
	read := func() []models.SignalReceipt {
		response, result := ts.doRequest(t, "GET", "/api/v1/observed-services/"+service.ID+"/setup-status", nil, authHeader(token)...)
		if response.StatusCode != 200 {
			t.Fatalf("receipt status=%d", response.StatusCode)
		}
		var receipts []models.SignalReceipt
		if err := json.Unmarshal(result.Data, &receipts); err != nil {
			t.Fatal(err)
		}
		return receipts
	}
	if len(read()) != 0 {
		t.Fatal("registration is not a signal receipt")
	}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", service.ApiKey, &collectorlogspb.ExportLogsServiceRequest{}); status != 200 {
		t.Fatalf("empty export: %d", status)
	}
	if len(read()) != 0 {
		t.Fatal("empty export is not a signal receipt")
	}
	record := &logspb.LogRecord{SeverityNumber: logspb.SeverityNumber_SEVERITY_NUMBER_DEBUG, Body: stringValue("test"), TimeUnixNano: uint64(time.Now().Add(-24 * time.Hour).UnixNano())}
	payload := &collectorlogspb.ExportLogsServiceRequest{ResourceLogs: []*logspb.ResourceLogs{{ScopeLogs: []*logspb.ScopeLogs{{LogRecords: []*logspb.LogRecord{record}}}}}}
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", service.ApiKey, payload); status != 200 {
		t.Fatalf("filtered export: %d", status)
	}
	if len(read()) != 0 {
		t.Fatal("filtered logs must not claim stored data")
	}
	record.SeverityNumber = logspb.SeverityNumber_SEVERITY_NUMBER_INFO
	before := time.Now().Add(-time.Second)
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", service.ApiKey, payload); status != 200 {
		t.Fatalf("logs export: %d", status)
	}
	receipts := read()
	if len(receipts) != 1 || receipts[0].Signal != "logs" || receipts[0].ServiceName != service.Name || receipts[0].LastReceivedAt.Before(before) {
		t.Fatalf("unexpected receipt: %+v", receipts)
	}
	first := receipts[0].FirstReceivedAt
	if status := postOTLPStatus(t, ts, "/api/v1/otlp/v1/logs", service.ApiKey, payload); status != 200 {
		t.Fatalf("second export: %d", status)
	}
	if !read()[0].FirstReceivedAt.Equal(first) {
		t.Fatal("first receipt time was overwritten")
	}
}

func TestConnectionSettingsEndpointRequiresAuthentication(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	resp, _ := ts.doRequest(t, "GET", "/api/v1/settings/connection", nil)
	if resp.StatusCode != 401 {
		t.Fatal("connection settings must require login")
	}
	resp, result := ts.doRequest(t, "GET", "/api/v1/settings/connection", nil, authHeader(token)...)
	if resp.StatusCode != 200 || !strings.Contains(string(result.Data), "publicUrl") {
		t.Fatal("missing connection settings")
	}
}

func assertSetupReceipt(t *testing.T, ts *testServer, token, path, signal string) {
	t.Helper()
	resp, result := ts.doRequest(t, "GET", path+"/setup-status", nil, authHeader(token)...)
	if resp.StatusCode != 200 {
		t.Fatalf("setup status=%d", resp.StatusCode)
	}
	var receipts []models.SignalReceipt
	if err := json.Unmarshal(result.Data, &receipts); err != nil {
		t.Fatal(err)
	}
	if len(receipts) != 1 || receipts[0].Signal != signal {
		t.Fatalf("unexpected receipts: %+v", receipts)
	}
}
