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
