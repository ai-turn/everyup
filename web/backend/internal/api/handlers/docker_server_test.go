package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

// A Docker environment is a server (ADR 0012). The default server list hides Docker servers for old
// clients, and deleting one would orphan its Docker Collector.
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

// Same-host merge (ADR 0012, stage 3): the Docker server merges into the direct server of the same
// host after the user confirms; the API asks which infrastructure source to keep when both collect.
func TestSameHostMergeThroughTheAPI(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	createDocker := func(name string) string {
		resp, result := ts.doRequest(t, "POST", "/api/v1/agents", map[string]interface{}{"name": name}, auth...)
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("create environment status=%d %s", resp.StatusCode, result.Data)
		}
		var created struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(result.Data, &created); err != nil {
			t.Fatal(err)
		}
		return created.ID
	}
	docker := createDocker("prod-server (2)")
	other := createDocker("edge-node")
	_, result := ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "prod-server"}, auth...)
	direct := decodeServer(t, result)
	resp, result := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]string{"name": "prod-server", "serverId": direct.ID}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create infrastructure status=%d %s", resp.StatusCode, result.Data)
	}

	merge := func(source, target, infrastructure string) (int, string) {
		body := map[string]string{"targetServerId": target}
		if infrastructure != "" {
			body["infrastructure"] = infrastructure
		}
		resp, result := ts.doRequest(t, "POST", "/api/v1/servers/"+source+"/merge", body, auth...)
		if result.Error != nil {
			return resp.StatusCode, result.Error.Code
		}
		return resp.StatusCode, ""
	}
	if status, code := merge(docker, other, ""); status != http.StatusConflict || code != "SERVER_HAS_TWO_DOCKER" {
		t.Fatalf("merge two Docker servers = %d %s, want 409 SERVER_HAS_TWO_DOCKER", status, code)
	}
	if status, code := merge(docker, direct.ID, "both"); status != http.StatusBadRequest || code != "VALIDATION_ERROR" {
		t.Fatalf("merge with an unknown source = %d %s, want 400 VALIDATION_ERROR", status, code)
	}
	// The default profile collects host metrics, and the direct server has an OpenTelemetry resource.
	if status, code := merge(docker, direct.ID, ""); status != http.StatusConflict || code != "INFRASTRUCTURE_SOURCE_REQUIRED" {
		t.Fatalf("merge without a source = %d %s, want 409 INFRASTRUCTURE_SOURCE_REQUIRED", status, code)
	}
	if status, code := merge(docker, direct.ID, "docker"); status != http.StatusOK {
		t.Fatalf("merge keeping Docker = %d %s, want 200", status, code)
	}

	// The Docker Collector keeps its id and now belongs to the direct server; the Docker server is gone.
	_, result = ts.doRequest(t, "GET", "/api/v1/agents", nil, auth...)
	var agents []struct {
		ID       string `json:"id"`
		ServerID string `json:"serverId"`
	}
	if err := json.Unmarshal(result.Data, &agents); err != nil {
		t.Fatal(err)
	}
	for _, agent := range agents {
		if agent.ID == docker && agent.ServerID != direct.ID {
			t.Fatalf("Docker Collector server = %s, want %s", agent.ServerID, direct.ID)
		}
	}
	if resp, _ := ts.doRequest(t, "GET", "/api/v1/servers/"+docker, nil, auth...); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("merged Docker server status=%d, want 404", resp.StatusCode)
	}
	// The merged server is a Docker server now: it cannot be deleted, only its Docker Collector deactivated.
	resp, result = ts.doRequest(t, "DELETE", "/api/v1/servers/"+direct.ID, nil, auth...)
	if resp.StatusCode != http.StatusConflict || result.Error == nil || result.Error.Code != "SERVER_HAS_DOCKER" {
		t.Fatalf("delete the merged server status=%d %+v, want 409 SERVER_HAS_DOCKER", resp.StatusCode, result.Error)
	}
}
