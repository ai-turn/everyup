package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

type monitorResponse struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ServerID string `json:"serverId"`
}

func createTestMonitor(t *testing.T, ts *testServer, auth []string, name, serverID string) (*http.Response, apiResponse) {
	t.Helper()
	body := map[string]interface{}{"name": name, "type": "tcp", "host": "1.1.1.1", "port": 53, "interval": 5}
	if serverID != "" {
		body["serverId"] = serverID
	}
	return ts.doRequest(t, "POST", "/api/v1/services", body, auth...)
}

func decodeMonitor(t *testing.T, result apiResponse) monitorResponse {
	t.Helper()
	var monitor monitorResponse
	if err := json.Unmarshal(result.Data, &monitor); err != nil || monitor.ID == "" {
		t.Fatalf("invalid monitor response: %v, %s", err, result.Data)
	}
	return monitor
}

func mustCreateMonitor(t *testing.T, ts *testServer, auth []string, name, serverID string) monitorResponse {
	t.Helper()
	resp, result := createTestMonitor(t, ts, auth, name, serverID)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create monitor %s: %d %+v", name, resp.StatusCode, result.Error)
	}
	return decodeMonitor(t, result)
}

func mustCreateServer(t *testing.T, ts *testServer, auth []string, name string) serverResponse {
	t.Helper()
	resp, result := ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": name}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create server %s: %d %+v", name, resp.StatusCode, result.Error)
	}
	return decodeServer(t, result)
}

func listMonitors(t *testing.T, ts *testServer, auth []string) []monitorResponse {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/services?type=http,tcp", nil, auth...)
	var monitors []monitorResponse
	if err := json.Unmarshal(result.Data, &monitors); err != nil {
		t.Fatalf("list monitors: %v, %s", err, result.Data)
	}
	return monitors
}

func TestMonitorJoinsServer(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	first := mustCreateMonitor(t, ts, auth, "public-dns", "")
	if first.ServerID == "" {
		t.Fatal("monitor without serverId must join a server")
	}
	_, result := ts.doRequest(t, "GET", "/api/v1/servers", nil, auth...)
	var servers []serverResponse
	if err := json.Unmarshal(result.Data, &servers); err != nil {
		t.Fatal(err)
	}
	if len(servers) != 1 || servers[0].Name != "public-dns" || servers[0].ID != first.ServerID {
		t.Fatalf("expected one public-dns server, got %+v", servers)
	}

	second := mustCreateMonitor(t, ts, auth, "public-dns", "")
	if second.ServerID != first.ServerID {
		t.Fatalf("same name must join the same server: %s vs %s", second.ServerID, first.ServerID)
	}
	_, result = ts.doRequest(t, "GET", "/api/v1/servers", nil, auth...)
	if err := json.Unmarshal(result.Data, &servers); err != nil || len(servers) != 1 {
		t.Fatalf("expected one server, got %v %s", err, result.Data)
	}

	edge := mustCreateServer(t, ts, auth, "edge")
	if got := mustCreateMonitor(t, ts, auth, "probe", edge.ID); got.ServerID != edge.ID {
		t.Fatalf("explicit serverId: got %s, want %s", got.ServerID, edge.ID)
	}

	before := len(listMonitors(t, ts, auth))
	resp, result := createTestMonitor(t, ts, auth, "lost", "nope")
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")
	if result.Error.Message != "server not found" {
		t.Fatalf("unexpected message: %q", result.Error.Message)
	}
	if after := len(listMonitors(t, ts, auth)); after != before {
		t.Fatalf("monitor count changed: %d -> %d", before, after)
	}
}

func TestMonitorMovesBetweenServers(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	monitor := mustCreateMonitor(t, ts, auth, "public-dns", "")
	edge := mustCreateServer(t, ts, auth, "edge")
	body := map[string]interface{}{"name": "public-dns", "type": "tcp", "host": "1.1.1.1", "port": 53, "interval": 5}

	body["serverId"] = edge.ID
	resp, result := ts.doRequest(t, "PUT", "/api/v1/services/"+monitor.ID, body, auth...)
	if resp.StatusCode != http.StatusOK || decodeMonitor(t, result).ServerID != edge.ID {
		t.Fatalf("move: %d %s", resp.StatusCode, result.Data)
	}

	delete(body, "serverId")
	resp, result = ts.doRequest(t, "PUT", "/api/v1/services/"+monitor.ID, body, auth...)
	if resp.StatusCode != http.StatusOK || decodeMonitor(t, result).ServerID != edge.ID {
		t.Fatalf("omitted serverId must keep the server: %d %s", resp.StatusCode, result.Data)
	}
	_, result = ts.doRequest(t, "GET", "/api/v1/services/"+monitor.ID, nil, auth...)
	if got := decodeMonitor(t, result); got.ServerID != edge.ID {
		t.Fatalf("stored serverId: got %s, want %s", got.ServerID, edge.ID)
	}

	grouped := mustCreateServer(t, ts, auth, "other")
	body["serverId"] = grouped.ID
	resp, result = ts.doRequest(t, "PUT", "/api/v1/services/"+monitor.ID, body, auth...)
	if got := decodeMonitor(t, result); resp.StatusCode != http.StatusOK || got.ServerID != grouped.ID {
		t.Fatalf("move to other server: %d %s", resp.StatusCode, result.Data)
	}

	body["serverId"] = "nope"
	body["name"] = "renamed"
	resp, result = ts.doRequest(t, "PUT", "/api/v1/services/"+monitor.ID, body, auth...)
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")
	_, result = ts.doRequest(t, "GET", "/api/v1/services/"+monitor.ID, nil, auth...)
	if got := decodeMonitor(t, result); got.Name != "public-dns" || got.ServerID != grouped.ID {
		t.Fatalf("failed move must change nothing: %+v", got)
	}
}

func listServers(t *testing.T, ts *testServer, auth []string) []serverResponse {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/servers", nil, auth...)
	var servers []serverResponse
	if err := json.Unmarshal(result.Data, &servers); err != nil {
		t.Fatalf("list servers: %v, %s", err, result.Data)
	}
	return servers
}

type appResponse struct {
	ID       string `json:"id"`
	ServerID string `json:"serverId"`
	ApiKey   string `json:"apiKey"`
}

func decodeApp(t *testing.T, result apiResponse) appResponse {
	t.Helper()
	var app appResponse
	if err := json.Unmarshal(result.Data, &app); err != nil || app.ID == "" {
		t.Fatalf("invalid app response: %v, %s", err, result.Data)
	}
	return app
}

func mustCreateApp(t *testing.T, ts *testServer, auth []string, body map[string]interface{}) appResponse {
	t.Helper()
	resp, result := ts.doRequest(t, "POST", "/api/v1/observed-services", body, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create app: %d %+v", resp.StatusCode, result.Error)
	}
	return decodeApp(t, result)
}

func mustUpdateApp(t *testing.T, ts *testServer, auth []string, id string, body map[string]interface{}) appResponse {
	t.Helper()
	resp, result := ts.doRequest(t, "PUT", "/api/v1/observed-services/"+id, body, auth...)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("update app: %d %+v", resp.StatusCode, result.Error)
	}
	return decodeApp(t, result)
}

func getServer(t *testing.T, ts *testServer, auth []string, id string) serverResponse {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/servers/"+id, nil, auth...)
	return decodeServer(t, result)
}

func TestObservedServiceJoinsServer(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	// A former projectId in the body is ignored.
	app := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "projectId": "P"})
	if app.ServerID == "" || app.ApiKey == "" {
		t.Fatalf("unexpected create response: %+v", app)
	}
	if server := getServer(t, ts, auth, app.ServerID); server.Name != "checkout" {
		t.Fatalf("unexpected server: %+v", server)
	}
	// The same name joins the same server.
	if again := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "Checkout", "signals": []string{"metrics"}}); again.ServerID != app.ServerID {
		t.Fatalf("same name must join the same server: %s vs %s", again.ServerID, app.ServerID)
	}

	web := mustCreateServer(t, ts, auth, "web")
	worker := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "worker", "signals": []string{"logs"}, "serverId": web.ID})
	if worker.ServerID != web.ID {
		t.Fatalf("explicit serverId: %+v", worker)
	}
}

func TestObservedServiceUpdateMovesOnlyWithServerId(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	app := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}})

	got := mustUpdateApp(t, ts, auth, app.ID, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "serverId": app.ServerID})
	if got.ServerID != app.ServerID {
		t.Fatalf("same serverId must keep the server: %+v", got)
	}

	other := mustCreateServer(t, ts, auth, "other")
	got = mustUpdateApp(t, ts, auth, app.ID, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "serverId": other.ID})
	if got.ServerID != other.ID {
		t.Fatalf("move: got %s, want %s", got.ServerID, other.ID)
	}

	// Without serverId the app stays on its server.
	got = mustUpdateApp(t, ts, auth, app.ID, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "projectId": "P"})
	if got.ServerID != other.ID {
		t.Fatalf("omitted serverId moved the app: got %s, want %s", got.ServerID, other.ID)
	}
}

func TestObservedServiceServerErrors(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	server := mustCreateServer(t, ts, auth, "dup")
	loose := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "loose", "signals": []string{"logs"}, "serverId": server.ID})

	resp, result := ts.doRequest(t, "PUT", "/api/v1/observed-services/"+loose.ID, map[string]interface{}{"name": "loose", "signals": []string{"logs"}, "serverId": "nope"}, auth...)
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")

	resp, _ = ts.doRequest(t, "PUT", "/api/v1/observed-services/missing", map[string]interface{}{"name": "x", "signals": []string{"logs"}}, auth...)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("missing app: got %d, want 404", resp.StatusCode)
	}
}

type infraResponse struct {
	ID       string `json:"id"`
	Adapter  string `json:"adapter"`
	ServerID string `json:"serverId"`
}

func decodeInfra(t *testing.T, result apiResponse) infraResponse {
	t.Helper()
	var resource infraResponse
	if err := json.Unmarshal(result.Data, &resource); err != nil || resource.ID == "" {
		t.Fatalf("invalid infrastructure response: %v, %s", err, result.Data)
	}
	return resource
}

func mustCreateInfra(t *testing.T, ts *testServer, auth []string, body map[string]interface{}) infraResponse {
	t.Helper()
	resp, result := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", body, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create infrastructure resource: %d %+v", resp.StatusCode, result.Error)
	}
	return decodeInfra(t, result)
}

func TestInfrastructureResourceJoinsServer(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	first := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-01"})
	if first.ServerID == "" {
		t.Fatal("resource without serverId must join a server")
	}
	if server := getServer(t, ts, auth, first.ServerID); server.Name != "db-01" {
		t.Fatalf("first server name: %q", server.Name)
	}

	second := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-01"})
	if second.ServerID == "" || second.ServerID == first.ServerID {
		t.Fatalf("second resource must get its own server: %s vs %s", second.ServerID, first.ServerID)
	}
	if server := getServer(t, ts, auth, second.ServerID); server.Name != "db-01 (2)" {
		t.Fatalf("second server name: %q", server.Name)
	}

	resp, result := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources",
		map[string]interface{}{"name": "db-02", "serverId": first.ServerID}, auth...)
	expectError(t, resp, result, http.StatusConflict, "SERVER_HAS_INFRASTRUCTURE")
}

func TestInfrastructureResourceJoinsExistingServerWithoutInfrastructure(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	app := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "shared", "signals": []string{"logs"}})
	resource := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "shared"})
	if resource.ServerID != app.ServerID {
		t.Fatalf("resource must join the app's server: %s vs %s", resource.ServerID, app.ServerID)
	}
	_, result := ts.doRequest(t, "GET", "/api/v1/servers", nil, auth...)
	var servers []serverResponse
	if err := json.Unmarshal(result.Data, &servers); err != nil || len(servers) != 1 {
		t.Fatalf("expected one server, got %v %s", err, result.Data)
	}
}

func TestInfrastructureResourceMoveRules(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	resource := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-01"})
	other := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-02"})
	endpoint := "/api/v1/infrastructure-resources/" + resource.ID

	resp, result := ts.doRequest(t, "PUT", endpoint, map[string]interface{}{"name": "db-01", "serverId": resource.ServerID}, auth...)
	if resp.StatusCode != http.StatusOK || decodeInfra(t, result).ServerID != resource.ServerID {
		t.Fatalf("same server: %d %s", resp.StatusCode, result.Data)
	}

	empty := mustCreateServer(t, ts, auth, "empty")
	resp, result = ts.doRequest(t, "PUT", endpoint, map[string]interface{}{"name": "db-01", "serverId": empty.ID}, auth...)
	if resp.StatusCode != http.StatusOK || decodeInfra(t, result).ServerID != empty.ID {
		t.Fatalf("move to empty server: %d %s", resp.StatusCode, result.Data)
	}

	resp, result = ts.doRequest(t, "PUT", endpoint, map[string]interface{}{"name": "db-01", "serverId": other.ServerID}, auth...)
	expectError(t, resp, result, http.StatusConflict, "SERVER_HAS_INFRASTRUCTURE")
	_, result = ts.doRequest(t, "GET", endpoint, nil, auth...)
	if got := decodeInfra(t, result); got.ServerID != empty.ID {
		t.Fatalf("serverId changed after conflict: got %s, want %s", got.ServerID, empty.ID)
	}
}

func TestInfrastructureResourceErrorsAndUpdateWithoutServerId(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	resp, result := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]interface{}{"name": "db-01", "serverId": "nope"}, auth...)
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")

	server := mustCreateServer(t, ts, auth, "db-host")
	resource := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-01", "serverId": server.ID})
	endpoint := "/api/v1/infrastructure-resources/" + resource.ID

	// Without serverId the resource stays on its server; a former projectId is ignored.
	resp, result = ts.doRequest(t, "PUT", endpoint, map[string]interface{}{"name": "db-01", "projectId": "P"}, auth...)
	if got := decodeInfra(t, result); resp.StatusCode != http.StatusOK || got.ServerID != server.ID {
		t.Fatalf("update without serverId: %d %s", resp.StatusCode, result.Data)
	}

	resp, _ = ts.doRequest(t, "PUT", "/api/v1/infrastructure-resources/missing", map[string]interface{}{"name": "x"}, auth...)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("missing resource: got %d, want 404", resp.StatusCode)
	}
}

// A Docker environment is the server with the same id (ADR 0012), so its host metrics belong to that server.
func TestInfrastructureListPutsDockerBackedResourcesOnTheirDockerServer(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	_, result := ts.doRequest(t, "POST", "/api/v1/agents", map[string]interface{}{
		"name": "prod-host", "profile": map[string]interface{}{"kind": "custom", "capabilities": []string{"infrastructure"}},
	}, auth...)
	if !result.Success {
		t.Fatalf("create agent: %+v", result.Error)
	}
	mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-01"})

	_, result = ts.doRequest(t, "GET", "/api/v1/infrastructure-resources", nil, auth...)
	var resources []infraResponse
	if err := json.Unmarshal(result.Data, &resources); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, resource := range resources {
		seen[resource.Adapter] = true
		switch resource.Adapter {
		case "everyup-agent":
			if resource.ServerID != resource.ID {
				t.Fatalf("Docker-backed resource must belong to the Docker server with its id: %+v", resource)
			}
		case "otel-collector":
			if resource.ServerID == "" {
				t.Fatalf("direct resource must have a serverId: %+v", resource)
			}
		}
	}
	if !seen["everyup-agent"] || !seen["otel-collector"] {
		t.Fatalf("expected both adapters, got %+v", resources)
	}
}
