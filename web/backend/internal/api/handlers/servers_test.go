package handlers_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
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
