package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

// Installing a Docker Collector on an existing server, and the one-source rule for host metrics
// (ADR 0012, stage 3): every path that would make a Docker Collector and an OpenTelemetry Collector
// collect the same host asks which one to keep.
func TestInstallDockerCollectorOnAnExistingServer(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	_, result := ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "web-01"}, auth...)
	server := decodeServer(t, result)
	resp, result := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]string{"name": "web-01", "serverId": server.ID}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create infrastructure status=%d %s", resp.StatusCode, result.Data)
	}

	install := func(body map[string]interface{}) (int, string, json.RawMessage) {
		resp, result := ts.doRequest(t, "POST", "/api/v1/agents", body, auth...)
		if result.Error != nil {
			return resp.StatusCode, result.Error.Code, nil
		}
		return resp.StatusCode, "", result.Data
	}
	// The default profile collects host metrics, and the server has an OpenTelemetry Collector.
	if status, code, _ := install(map[string]interface{}{"name": "web-01", "serverId": server.ID}); status != http.StatusConflict || code != "INFRASTRUCTURE_SOURCE_REQUIRED" {
		t.Fatalf("install without a source = %d %s, want 409 INFRASTRUCTURE_SOURCE_REQUIRED", status, code)
	}
	if status, code, _ := install(map[string]interface{}{"name": "web-01", "serverId": "missing"}); status != http.StatusBadRequest {
		t.Fatalf("install on a missing server = %d %s, want 400", status, code)
	}
	status, code, data := install(map[string]interface{}{"name": "web-01", "serverId": server.ID, "infrastructure": "otel"})
	if status != http.StatusCreated {
		t.Fatalf("install keeping OpenTelemetry = %d %s", status, code)
	}
	var created struct {
		ID      string `json:"id"`
		Profile struct {
			Capabilities []string `json:"capabilities"`
		} `json:"profile"`
	}
	if err := json.Unmarshal(data, &created); err != nil {
		t.Fatal(err)
	}
	for _, capability := range created.Profile.Capabilities {
		if capability == "infrastructure" {
			t.Fatalf("profile still collects host metrics: %v", created.Profile.Capabilities)
		}
	}
	// The Docker Collector belongs to the existing server; no new server is made.
	_, result = ts.doRequest(t, "GET", "/api/v1/agents", nil, auth...)
	var agents []struct {
		ID       string `json:"id"`
		ServerID string `json:"serverId"`
	}
	if err := json.Unmarshal(result.Data, &agents); err != nil || len(agents) != 1 || agents[0].ServerID != server.ID {
		t.Fatalf("agents = %+v (%v), want one on %s", agents, err, server.ID)
	}
	_, result = ts.doRequest(t, "GET", "/api/v1/servers?include=docker", nil, auth...)
	var servers []serverResponse
	if err := json.Unmarshal(result.Data, &servers); err != nil || len(servers) != 1 {
		t.Fatalf("servers = %+v (%v), want only web-01", servers, err)
	}
	// One Docker Collector per server.
	if status, code, _ := install(map[string]interface{}{"name": "web-01 again", "profile": map[string]interface{}{"kind": "basic"}, "serverId": server.ID}); status != http.StatusConflict || code != "SERVER_HAS_DOCKER" {
		t.Fatalf("second install = %d %s, want 409 SERVER_HAS_DOCKER", status, code)
	}

	// Adding host metrics back to the profile asks the same question; docker stops the OpenTelemetry resource.
	profile := map[string]interface{}{"kind": "custom", "capabilities": []string{"uptime", "logs", "infrastructure"}}
	resp, result = ts.doRequest(t, "PUT", "/api/v1/agents/"+created.ID+"/profile", profile, auth...)
	if resp.StatusCode != http.StatusConflict || result.Error == nil || result.Error.Code != "INFRASTRUCTURE_SOURCE_REQUIRED" {
		t.Fatalf("add infrastructure = %d %+v, want 409 INFRASTRUCTURE_SOURCE_REQUIRED", resp.StatusCode, result.Error)
	}
	resp, _ = ts.doRequest(t, "PUT", "/api/v1/agents/"+created.ID+"/profile?infrastructure=docker", profile, auth...)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("add infrastructure keeping Docker = %d", resp.StatusCode)
	}
	_, result = ts.doRequest(t, "GET", "/api/v1/infrastructure-resources", nil, auth...)
	var resources []struct {
		Adapter  string `json:"adapter"`
		IsActive bool   `json:"isActive"`
	}
	if err := json.Unmarshal(result.Data, &resources); err != nil {
		t.Fatal(err)
	}
	for _, resource := range resources {
		if resource.Adapter == "otel-collector" && resource.IsActive {
			t.Fatal("the OpenTelemetry resource still collects")
		}
	}
}

func TestConnectingOpenTelemetryInfrastructureToADockerServerChoosesOneSource(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	_, result := ts.doRequest(t, "POST", "/api/v1/agents", map[string]interface{}{"name": "prod-server"}, auth...)
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(result.Data, &agent); err != nil {
		t.Fatal(err)
	}
	// The Docker server's id is its Docker Collector's id; the default profile collects host metrics.
	resp, result := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]string{"name": "prod-server", "serverId": agent.ID}, auth...)
	if resp.StatusCode != http.StatusConflict || result.Error == nil || result.Error.Code != "INFRASTRUCTURE_SOURCE_REQUIRED" {
		t.Fatalf("connect OpenTelemetry = %d %+v, want 409 INFRASTRUCTURE_SOURCE_REQUIRED", resp.StatusCode, result.Error)
	}
	resp, result = ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]string{"name": "prod-server", "serverId": agent.ID, "infrastructure": "otel"}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("connect OpenTelemetry keeping it = %d %s", resp.StatusCode, result.Data)
	}
	_, result = ts.doRequest(t, "GET", "/api/v1/agents/"+agent.ID+"/setup-status", nil, auth...)
	var status struct {
		Profile struct {
			Capabilities []string `json:"capabilities"`
		} `json:"profile"`
	}
	if err := json.Unmarshal(result.Data, &status); err != nil {
		t.Fatal(err)
	}
	for _, capability := range status.Profile.Capabilities {
		if capability == "infrastructure" {
			t.Fatalf("the Docker Collector still collects host metrics: %v", status.Profile.Capabilities)
		}
	}
}

// "Not the same host" is stored on the server, so the suggestion stays dismissed for every user.
func TestSameHostDismissals(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	_, result := ts.doRequest(t, "POST", "/api/v1/agents", map[string]interface{}{"name": "web-01 (2)"}, auth...)
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(result.Data, &agent); err != nil {
		t.Fatal(err)
	}
	_, result = ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "web-01"}, auth...)
	server := decodeServer(t, result)

	pair := map[string]string{"dockerServerId": agent.ID, "serverId": server.ID}
	for range 2 { // repeating is a no-op
		if resp, result := ts.doRequest(t, "POST", "/api/v1/same-host-dismissals", pair, auth...); resp.StatusCode != http.StatusCreated {
			t.Fatalf("dismiss = %d %+v", resp.StatusCode, result.Error)
		}
	}
	if resp, _ := ts.doRequest(t, "POST", "/api/v1/same-host-dismissals", map[string]string{"dockerServerId": agent.ID, "serverId": "missing"}, auth...); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("dismiss with a missing server = %d, want 400", resp.StatusCode)
	}
	list := func() []map[string]string {
		_, result := ts.doRequest(t, "GET", "/api/v1/same-host-dismissals", nil, auth...)
		var pairs []map[string]string
		if err := json.Unmarshal(result.Data, &pairs); err != nil {
			t.Fatal(err)
		}
		return pairs
	}
	if pairs := list(); len(pairs) != 1 || pairs[0]["dockerServerId"] != agent.ID || pairs[0]["serverId"] != server.ID {
		t.Fatalf("dismissals = %+v", pairs)
	}
	// Deleting a server removes its records.
	if resp, _ := ts.doRequest(t, "DELETE", "/api/v1/servers/"+server.ID, nil, auth...); resp.StatusCode >= 300 {
		t.Fatalf("delete status=%d", resp.StatusCode)
	}
	if pairs := list(); len(pairs) != 0 {
		t.Fatalf("dismissals after delete = %+v, want none", pairs)
	}
}
