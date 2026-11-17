package handlers_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/aiturn/everyup/internal/database"
)

type serverResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	ProjectID   string `json:"projectId"`
}

func createTestProject(t *testing.T, ts *testServer, auth []string, name string) string {
	t.Helper()
	_, result := ts.doRequest(t, "POST", "/api/v1/projects", map[string]string{"name": name}, auth...)
	var project struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(result.Data, &project); err != nil || project.ID == "" {
		t.Fatalf("create project: %v, %s", err, result.Data)
	}
	return project.ID
}

func decodeServer(t *testing.T, result apiResponse) serverResponse {
	t.Helper()
	var server serverResponse
	if err := json.Unmarshal(result.Data, &server); err != nil {
		t.Fatalf("invalid server response: %v, %s", err, result.Data)
	}
	return server
}

func expectError(t *testing.T, resp *http.Response, result apiResponse, status int, code string) {
	t.Helper()
	if resp.StatusCode != status || result.Error == nil || result.Error.Code != code {
		t.Fatalf("expected %d %s, got %d %+v", status, code, resp.StatusCode, result.Error)
	}
}

func TestServerCRUD(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	resp, result := ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": " web-01 ", "description": "front"}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create: %d %+v", resp.StatusCode, result.Error)
	}
	created := decodeServer(t, result)
	if created.Name != "web-01" || created.ID == "" || created.Description != "front" {
		t.Fatalf("unexpected created server: %+v", created)
	}

	_, result = ts.doRequest(t, "GET", "/api/v1/servers", nil, auth...)
	var all []serverResponse
	if err := json.Unmarshal(result.Data, &all); err != nil || len(all) != 1 {
		t.Fatalf("list: %v, %s", err, result.Data)
	}

	resp, result = ts.doRequest(t, "GET", "/api/v1/servers/"+created.ID, nil, auth...)
	if resp.StatusCode != http.StatusOK || decodeServer(t, result).ID != created.ID {
		t.Fatalf("get: %d %s", resp.StatusCode, result.Data)
	}

	projectID := createTestProject(t, ts, auth, "Production")
	resp, result = ts.doRequest(t, "PUT", "/api/v1/servers/"+created.ID, map[string]string{"name": "web-01", "projectId": projectID}, auth...)
	if resp.StatusCode != http.StatusOK || decodeServer(t, result).ProjectID != projectID {
		t.Fatalf("assign group: %d %s", resp.StatusCode, result.Data)
	}

	resp, result = ts.doRequest(t, "PUT", "/api/v1/servers/"+created.ID, map[string]string{"name": "web-01"}, auth...)
	var raw map[string]interface{}
	if err := json.Unmarshal(result.Data, &raw); err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("clear group: %d %v %s", resp.StatusCode, err, result.Data)
	}
	if _, ok := raw["projectId"]; ok {
		t.Fatalf("projectId should be cleared: %s", result.Data)
	}
	_, result = ts.doRequest(t, "GET", "/api/v1/servers/"+created.ID, nil, auth...)
	if got := decodeServer(t, result); got.ProjectID != "" || got.Description != "" {
		t.Fatalf("PUT should replace the whole server: %+v", got)
	}

	resp, result = ts.doRequest(t, "GET", "/api/v1/servers/missing", nil, auth...)
	expectError(t, resp, result, http.StatusNotFound, "NOT_FOUND")
	resp, result = ts.doRequest(t, "PUT", "/api/v1/servers/missing", map[string]string{"name": "x"}, auth...)
	expectError(t, resp, result, http.StatusNotFound, "NOT_FOUND")
}

func TestServerValidation(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	resp, result := ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "  "}, auth...)
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")

	resp, result = ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": strings.Repeat("a", 201)}, auth...)
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")

	resp, result = ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "x", "projectId": "nope"}, auth...)
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")
	if result.Error.Message != "group not found" {
		t.Fatalf("unexpected message: %q", result.Error.Message)
	}

	resp, _ = ts.doRequest(t, "GET", "/api/v1/servers", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestServerNameIsUniqueWithinGroup(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	resp, _ := ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "web"}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create web: %d", resp.StatusCode)
	}
	resp, result := ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "WEB "}, auth...)
	expectError(t, resp, result, http.StatusConflict, "SERVER_NAME_TAKEN")

	projectID := createTestProject(t, ts, auth, "Production")
	resp, result = ts.doRequest(t, "POST", "/api/v1/servers", map[string]string{"name": "web", "projectId": projectID}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("same name in another group: %d %+v", resp.StatusCode, result.Error)
	}
	grouped := decodeServer(t, result)

	resp, result = ts.doRequest(t, "PUT", "/api/v1/servers/"+grouped.ID, map[string]string{"name": "web"}, auth...)
	expectError(t, resp, result, http.StatusConflict, "SERVER_NAME_TAKEN")
}

func expectStatus(t *testing.T, ts *testServer, auth []string, method, path string, status int) {
	t.Helper()
	if resp, result := ts.doRequest(t, method, path, nil, auth...); resp.StatusCode != status {
		t.Fatalf("%s %s: got %d %+v, want %d", method, path, resp.StatusCode, result.Error, status)
	}
}

func TestServerDeleteRemovesTargetsAndTheirData(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	web := mustCreateServer(t, ts, auth, "web", "")
	resp, result := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"name": "probe", "type": "tcp", "host": "1.1.1.1", "port": 53, "interval": 5,
		"serverId": web.ID, "alertOnDown": true,
	}, auth...)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create monitor: %d %+v", resp.StatusCode, result.Error)
	}
	monitor := decodeMonitor(t, result)
	app := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "serverId": web.ID})
	infra := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-01", "serverId": web.ID})

	var rules int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM alert_rules WHERE service_id = ?`, monitor.ID).Scan(&rules); err != nil || rules == 0 {
		t.Fatalf("expected monitor alert rules before delete: %d %v", rules, err)
	}

	expectStatus(t, ts, auth, "DELETE", "/api/v1/servers/"+web.ID, http.StatusNoContent)
	expectStatus(t, ts, auth, "GET", "/api/v1/servers/"+web.ID, http.StatusNotFound)
	expectStatus(t, ts, auth, "GET", "/api/v1/services/"+monitor.ID, http.StatusNotFound)
	expectStatus(t, ts, auth, "GET", "/api/v1/observed-services/"+app.ID, http.StatusNotFound)
	expectStatus(t, ts, auth, "GET", "/api/v1/infrastructure-resources/"+infra.ID, http.StatusNotFound)

	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM alert_rules WHERE service_id = ?`, monitor.ID).Scan(&rules); err != nil || rules != 0 {
		t.Fatalf("monitor alert rules must be deleted: %d %v", rules, err)
	}

	resp, result = ts.doRequest(t, "DELETE", "/api/v1/servers/missing", nil, auth...)
	expectError(t, resp, result, http.StatusNotFound, "NOT_FOUND")
}

func TestServerMerge(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	a := mustCreateServer(t, ts, auth, "a", "")
	b := mustCreateServer(t, ts, auth, "b", "")
	monitor := mustCreateMonitor(t, ts, auth, "probe", a.ID)
	appA := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "checkout", "signals": []string{"logs"}, "serverId": a.ID})
	appB := mustCreateApp(t, ts, auth, map[string]interface{}{"name": "worker", "signals": []string{"logs"}, "serverId": b.ID})
	infra := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-01", "serverId": b.ID})

	resp, result := ts.doRequest(t, "POST", "/api/v1/servers/"+a.ID+"/merge", map[string]string{"targetServerId": b.ID}, auth...)
	if resp.StatusCode != http.StatusOK || decodeServer(t, result).ID != b.ID {
		t.Fatalf("merge: %d %s %+v", resp.StatusCode, result.Data, result.Error)
	}

	_, result = ts.doRequest(t, "GET", "/api/v1/servers", nil, auth...)
	var servers []serverResponse
	if err := json.Unmarshal(result.Data, &servers); err != nil || len(servers) != 1 || servers[0].ID != b.ID {
		t.Fatalf("expected only server b, got %v %s", err, result.Data)
	}

	_, result = ts.doRequest(t, "GET", "/api/v1/services/"+monitor.ID, nil, auth...)
	if got := decodeMonitor(t, result).ServerID; got != b.ID {
		t.Fatalf("monitor serverId: got %s, want %s", got, b.ID)
	}
	for _, id := range []string{appA.ID, appB.ID} {
		_, result = ts.doRequest(t, "GET", "/api/v1/observed-services/"+id, nil, auth...)
		if got := decodeApp(t, result).ServerID; got != b.ID {
			t.Fatalf("app %s serverId: got %s, want %s", id, got, b.ID)
		}
	}
	_, result = ts.doRequest(t, "GET", "/api/v1/infrastructure-resources/"+infra.ID, nil, auth...)
	if got := decodeInfra(t, result).ServerID; got != b.ID {
		t.Fatalf("infra serverId: got %s, want %s", got, b.ID)
	}
}

func TestServerMergeConflicts(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	first := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-01"})
	second := mustCreateInfra(t, ts, auth, map[string]interface{}{"name": "db-02"})

	resp, result := ts.doRequest(t, "POST", "/api/v1/servers/"+first.ServerID+"/merge", map[string]string{"targetServerId": second.ServerID}, auth...)
	expectError(t, resp, result, http.StatusConflict, "SERVER_HAS_INFRASTRUCTURE")
	expectStatus(t, ts, auth, "GET", "/api/v1/servers/"+first.ServerID, http.StatusOK)
	expectStatus(t, ts, auth, "GET", "/api/v1/servers/"+second.ServerID, http.StatusOK)
	for _, resource := range []infraResponse{first, second} {
		_, result = ts.doRequest(t, "GET", "/api/v1/infrastructure-resources/"+resource.ID, nil, auth...)
		if got := decodeInfra(t, result).ServerID; got != resource.ServerID {
			t.Fatalf("infra %s serverId changed: got %s, want %s", resource.ID, got, resource.ServerID)
		}
	}

	resp, result = ts.doRequest(t, "POST", "/api/v1/servers/"+first.ServerID+"/merge", map[string]string{"targetServerId": first.ServerID}, auth...)
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")
	resp, result = ts.doRequest(t, "POST", "/api/v1/servers/"+first.ServerID+"/merge", map[string]string{"targetServerId": ""}, auth...)
	expectError(t, resp, result, http.StatusBadRequest, "VALIDATION_ERROR")
	resp, result = ts.doRequest(t, "POST", "/api/v1/servers/"+first.ServerID+"/merge", map[string]string{"targetServerId": "missing"}, auth...)
	expectError(t, resp, result, http.StatusNotFound, "NOT_FOUND")
	resp, result = ts.doRequest(t, "POST", "/api/v1/servers/missing/merge", map[string]string{"targetServerId": first.ServerID}, auth...)
	expectError(t, resp, result, http.StatusNotFound, "NOT_FOUND")
}
