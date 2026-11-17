package handlers_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

type monitorResponse struct {
	ID        string `json:"id"`
	ServerID  string `json:"serverId"`
	ProjectID string `json:"projectId"`
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

func mustCreateServer(t *testing.T, ts *testServer, auth []string, name, projectID string) serverResponse {
	t.Helper()
	resp, result := ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": name, "projectId": projectID}, auth...)
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

	edge := mustCreateServer(t, ts, auth, "edge", "")
	if got := mustCreateMonitor(t, ts, auth, "probe", edge.ID); got.ServerID != edge.ID {
		t.Fatalf("explicit serverId: got %s, want %s", got.ServerID, edge.ID)
	}

	projectID := createTestProject(t, ts, auth, "Production")
	grouped := mustCreateServer(t, ts, auth, "grouped", projectID)
	if got := mustCreateMonitor(t, ts, auth, "grouped-probe", grouped.ID); got.ProjectID != projectID {
		t.Fatalf("create response projectId: got %q, want %q", got.ProjectID, projectID)
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
	edge := mustCreateServer(t, ts, auth, "edge", "")
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
}

func TestLegacyMonitorGroupAssignmentMovesTheServer(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	projectID := createTestProject(t, ts, auth, "Production")
	monitor := mustCreateMonitor(t, ts, auth, "public-dns", "")
	endpoint := "/api/v1/projects/" + projectID + "/monitors/" + monitor.ID

	groupOf := func() (string, string) {
		_, result := ts.doRequest(t, "GET", "/api/v1/services/"+monitor.ID, nil, auth...)
		got := decodeMonitor(t, result)
		_, result = ts.doRequest(t, "GET", "/api/v1/servers/"+got.ServerID, nil, auth...)
		return got.ProjectID, decodeServer(t, result).ProjectID
	}

	resp, result := ts.doRequest(t, "PUT", endpoint, nil, auth...)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("assign: %d %+v", resp.StatusCode, result.Error)
	}
	if monitorGroup, serverGroup := groupOf(); monitorGroup != projectID || serverGroup != projectID {
		t.Fatalf("after assign: monitor=%q server=%q, want %q", monitorGroup, serverGroup, projectID)
	}

	resp, _ = ts.doRequest(t, "DELETE", endpoint, nil, auth...)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("unassign: %d", resp.StatusCode)
	}
	if monitorGroup, serverGroup := groupOf(); monitorGroup != "" || serverGroup != "" {
		t.Fatalf("after unassign: monitor=%q server=%q", monitorGroup, serverGroup)
	}

	ungrouped := mustCreateServer(t, ts, auth, "dup", "")
	grouped := mustCreateServer(t, ts, auth, "dup", projectID)
	loose := mustCreateMonitor(t, ts, auth, "dup-a", ungrouped.ID)
	mustCreateMonitor(t, ts, auth, "dup-b", grouped.ID)
	resp, result = ts.doRequest(t, "PUT", "/api/v1/projects/"+projectID+"/monitors/"+loose.ID, nil, auth...)
	expectError(t, resp, result, http.StatusConflict, "SERVER_NAME_TAKEN")
}

type appResponse struct {
	ID        string `json:"id"`
	ServerID  string `json:"serverId"`
	ProjectID string `json:"projectId"`
	ApiKey    string `json:"apiKey"`
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
	projectID := createTestProject(t, ts, auth, "Production")

	app := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "projectId": projectID})
	if app.ServerID == "" || app.ProjectID != projectID || app.ApiKey == "" {
		t.Fatalf("unexpected create response: %+v", app)
	}
	if server := getServer(t, ts, auth, app.ServerID); server.ProjectID != projectID || server.Name != "checkout" {
		t.Fatalf("unexpected server: %+v", server)
	}

	web := mustCreateServer(t, ts, auth, "web", "")
	worker := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "worker", "signals": []string{"logs"}, "serverId": web.ID, "projectId": projectID})
	if worker.ServerID != web.ID || worker.ProjectID != "" {
		t.Fatalf("explicit serverId must win over projectId: %+v", worker)
	}
}

func TestObservedServiceUpdateWithServerIdIgnoresProjectId(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	projectID := createTestProject(t, ts, auth, "Production")
	app := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "projectId": projectID})

	got := mustUpdateApp(t, ts, auth, app.ID, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "serverId": app.ServerID})
	if got.ServerID != app.ServerID || got.ProjectID != projectID {
		t.Fatalf("same serverId must keep the group: %+v", got)
	}

	other := mustCreateServer(t, ts, auth, "other", "")
	got = mustUpdateApp(t, ts, auth, app.ID, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "serverId": other.ID})
	if got.ServerID != other.ID {
		t.Fatalf("move: got %s, want %s", got.ServerID, other.ID)
	}
}

func TestLegacyObservedServiceUpdateSetsServerGroup(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	app := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}})
	p2 := createTestProject(t, ts, auth, "Staging")

	got := mustUpdateApp(t, ts, auth, app.ID, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "projectId": p2})
	if got.ProjectID != p2 || getServer(t, ts, auth, got.ServerID).ProjectID != p2 {
		t.Fatalf("legacy group assignment: %+v", got)
	}

	got = mustUpdateApp(t, ts, auth, app.ID, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}})
	if got.ProjectID != "" || getServer(t, ts, auth, got.ServerID).ProjectID != "" {
		t.Fatalf("legacy group clear: %+v", got)
	}
}

type infraResponse struct {
	ID        string `json:"id"`
	Adapter   string `json:"adapter"`
	ServerID  string `json:"serverId"`
	ProjectID string `json:"projectId"`
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

	empty := mustCreateServer(t, ts, auth, "empty", "")
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

type projectCountsResponse struct {
	ID                          string `json:"id"`
	ServerCount                 int    `json:"serverCount"`
	MonitorCount                int    `json:"monitorCount"`
	ObservedServiceCount        int    `json:"observedServiceCount"`
	InfrastructureResourceCount int    `json:"infrastructureResourceCount"`
}

func projectCounts(t *testing.T, ts *testServer, auth []string, projectID string) projectCountsResponse {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/projects", nil, auth...)
	var projects []projectCountsResponse
	if err := json.Unmarshal(result.Data, &projects); err != nil {
		t.Fatalf("list projects: %v, %s", err, result.Data)
	}
	for _, project := range projects {
		if project.ID == projectID {
			return project
		}
	}
	t.Fatalf("project %s not listed: %s", projectID, result.Data)
	return projectCountsResponse{}
}

func TestProjectCountsFollowServers(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	projectID := createTestProject(t, ts, auth, "P")

	web := mustCreateServer(t, ts, auth, "web", projectID)
	mustCreateMonitor(t, ts, auth, "web-probe", web.ID)
	mustCreateApp(t, ts, auth, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "serverId": web.ID})
	mustCreateApp(t, ts, auth, map[string]interface{}{"name": "worker", "signals": []string{"logs"}, "serverId": web.ID})

	got := projectCounts(t, ts, auth, projectID)
	want := projectCountsResponse{ID: projectID, ServerCount: 1, MonitorCount: 1, ObservedServiceCount: 2}
	if got != want {
		t.Fatalf("grouped counts: got %+v, want %+v", got, want)
	}

	resp, result := ts.doRequest(t, "PUT", "/api/v1/servers/"+web.ID, map[string]string{"name": "web"}, auth...)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ungroup server: %d %+v", resp.StatusCode, result.Error)
	}
	if got := projectCounts(t, ts, auth, projectID); got != (projectCountsResponse{ID: projectID}) {
		t.Fatalf("counts after ungrouping: %+v", got)
	}
}

func TestProjectDeleteRenamesCollidingServers(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	projectID := createTestProject(t, ts, auth, "P")

	mustCreateServer(t, ts, auth, "web", "")
	groupedWeb := mustCreateServer(t, ts, auth, "web", projectID)
	mustCreateServer(t, ts, auth, "api", projectID)
	monitor := mustCreateMonitor(t, ts, auth, "web-probe", groupedWeb.ID)

	resp, _ := ts.doRequest(t, "DELETE", "/api/v1/projects/"+projectID, nil, auth...)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete project: %d", resp.StatusCode)
	}

	_, result := ts.doRequest(t, "GET", "/api/v1/servers", nil, auth...)
	var servers []serverResponse
	if err := json.Unmarshal(result.Data, &servers); err != nil || len(servers) != 3 {
		t.Fatalf("expected three servers, got %v %s", err, result.Data)
	}
	wantNames := []string{"api", "web", "web (2)"}
	for i, server := range servers {
		if server.ProjectID != "" || server.Name != wantNames[i] {
			t.Fatalf("server %d: got %+v, want name %q without group", i, server, wantNames[i])
		}
	}
	if servers[2].ID != groupedWeb.ID {
		t.Fatalf("renamed server: got %s, want %s", servers[2].ID, groupedWeb.ID)
	}
	_, result = ts.doRequest(t, "GET", "/api/v1/services/"+monitor.ID, nil, auth...)
	if got := decodeMonitor(t, result); got.ServerID != groupedWeb.ID {
		t.Fatalf("monitor serverId: got %s, want %s", got.ServerID, groupedWeb.ID)
	}
}

func TestInfrastructureListKeepsDockerBackedResourcesWithoutServer(t *testing.T) {
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
			if resource.ServerID != "" {
				t.Fatalf("Docker-backed resource must have no serverId: %+v", resource)
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
