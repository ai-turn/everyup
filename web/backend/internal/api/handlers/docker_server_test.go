package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

// A Docker environment is a server from stage 1 of the server and Docker unification, but the
// screens do not show Docker servers yet: the server API hides them and refuses the writes that
// would orphan the Docker Collector or merge without confirmation.
func TestDockerEnvironmentIsAHiddenServerUntilTheScreensShowIt(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	resp, result := ts.doRequest(t, "POST", "/api/v1/agents", map[string]interface{}{"name": "prod-server"}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create environment status=%d %s", resp.StatusCode, result.Data)
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(result.Data, &created); err != nil || created.ID == "" {
		t.Fatalf("create environment: %v %s", err, result.Data)
	}

	// The environment reports its server, which has the environment's id.
	_, result = ts.doRequest(t, "GET", "/api/v1/agents", nil, auth...)
	var agents []struct {
		ID       string `json:"id"`
		ServerID string `json:"serverId"`
	}
	if err := json.Unmarshal(result.Data, &agents); err != nil || len(agents) != 1 || agents[0].ServerID != created.ID {
		t.Fatalf("agents = %+v (%v), want serverId %s", agents, err, created.ID)
	}

	// Hidden from the server list; the old screens would show it as an empty server.
	_, result = ts.doRequest(t, "GET", "/api/v1/servers", nil, auth...)
	var servers []serverResponse
	if err := json.Unmarshal(result.Data, &servers); err != nil || len(servers) != 0 {
		t.Fatalf("servers = %+v (%v), want none", servers, err)
	}
	// The screens that show Docker servers ask for them.
	_, result = ts.doRequest(t, "GET", "/api/v1/servers?include=docker", nil, auth...)
	if err := json.Unmarshal(result.Data, &servers); err != nil || len(servers) != 1 || servers[0].ID != created.ID || servers[0].Name != "prod-server" {
		t.Fatalf("servers?include=docker = %+v (%v), want the Docker server", servers, err)
	}

	// A direct server with the same name is a different server.
	resp, result = ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "prod-server (direct)"}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create direct server status=%d %s", resp.StatusCode, result.Data)
	}
	direct := decodeServer(t, result)

	resp, result = ts.doRequest(t, "POST", "/api/v1/servers/"+direct.ID+"/merge", map[string]string{"targetServerId": created.ID}, auth...)
	if resp.StatusCode != http.StatusConflict || result.Error == nil || result.Error.Code != "SERVER_HAS_DOCKER" {
		t.Fatalf("merge into the Docker server status=%d %+v, want 409 SERVER_HAS_DOCKER", resp.StatusCode, result.Error)
	}
	resp, result = ts.doRequest(t, "DELETE", "/api/v1/servers/"+created.ID, nil, auth...)
	if resp.StatusCode != http.StatusConflict || result.Error == nil || result.Error.Code != "SERVER_HAS_DOCKER" {
		t.Fatalf("delete the Docker server status=%d %+v, want 409 SERVER_HAS_DOCKER", resp.StatusCode, result.Error)
	}

	// Deactivating the environment removes its empty server.
	resp, _ = ts.doRequest(t, "DELETE", "/api/v1/agents/"+created.ID, nil, auth...)
	if resp.StatusCode >= 300 {
		t.Fatalf("deactivate status=%d", resp.StatusCode)
	}
	resp, _ = ts.doRequest(t, "GET", "/api/v1/servers/"+created.ID, nil, auth...)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("server after deactivation status=%d, want 404", resp.StatusCode)
	}
}
