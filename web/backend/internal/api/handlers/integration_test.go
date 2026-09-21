package handlers_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/api"
	"github.com/aiturn/everyup/internal/api/websocket"
	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/collector"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// testServer holds all components needed for integration tests.
type testServer struct {
	App          *fiber.App
	scheduler    *checker.Scheduler
	collectorMgr *collector.CollectorManager
	alertMgr     *alerter.Manager
}

// setupTestServer creates a Fiber app with in-memory SQLite, real routes, and real middleware.
// Call cleanup() when done (usually via t.Cleanup).
func setupTestServer(t *testing.T) *testServer {
	t.Helper()

	// 1. In-memory SQLite ??fresh DB per test
	if err := database.Connect(":memory:"); err != nil {
		t.Fatalf("DB connect: %v", err)
	}

	// 2. Crypto init (auto-generates keys in DB)
	if err := crypto.InitFromDB(database.DB); err != nil {
		t.Fatalf("Crypto init: %v", err)
	}
	if err := crypto.InitJWTSecret(database.DB); err != nil {
		t.Fatalf("JWT init: %v", err)
	}

	// 3. Components
	app := fiber.New(fiber.Config{
		// Disable error logging in tests
		DisableStartupMessage: true,
		// Mirror production: decode percent-encoded path params so service keys
		// like "env:demo-prod" (sent as "env%3Ademo-prod") resolve correctly.
		UnescapePath: true,
	})

	hub := websocket.NewHub()
	go hub.Run()

	sched := checker.NewScheduler()
	sched.SetBroadcast(hub.GetBroadcastFunc())

	collMgr := collector.NewCollectorManager(5, 60)
	collMgr.SetBroadcast(hub.GetBroadcastFunc())

	alertMgr := alerter.NewManager()
	evaluator := alerter.NewRuleEvaluator(alertMgr, 5)
	collMgr.SetOnMetricCollected(evaluator.Evaluate)

	serviceEval := alerter.NewServiceRuleEvaluator(alertMgr)
	sched.SetServiceEvaluator(serviceEval)

	// 4. Routes — allow all origins for tests
	api.SetupRoutes(app, sched, collMgr, evaluator, serviceEval, "*", "test")

	// 5. Start scheduler with empty config
	if err := sched.Start([]config.ServiceConfig{}); err != nil {
		t.Fatalf("Scheduler start: %v", err)
	}

	ts := &testServer{
		App:          app,
		scheduler:    sched,
		collectorMgr: collMgr,
		alertMgr:     alertMgr,
	}

	t.Cleanup(func() {
		alertMgr.Shutdown()
		sched.Stop()
		collMgr.Stop()
		app.Shutdown()
		database.Close()
	})

	return ts
}

// apiResponse is the standard JSON envelope.
type apiResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   *apiError       `json:"error,omitempty"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// doRequest sends an HTTP request to the test server and returns the parsed response.
func (ts *testServer) doRequest(t *testing.T, method, path string, body interface{}, headers ...string) (*http.Response, apiResponse) {
	t.Helper()

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")

	// Apply extra headers (key-value pairs)
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}

	resp, err := ts.App.Test(req, -1)
	if err != nil {
		t.Fatalf("request %s %s: %v", method, path, err)
	}

	var result apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	resp.Body.Close()

	return resp, result
}

// setupAdmin creates the first admin user via /auth/setup and returns the JWT token.
func (ts *testServer) setupAdmin(t *testing.T, username, password string) string {
	t.Helper()

	_, result := ts.doRequest(t, "POST", "/api/v1/auth/setup", map[string]string{
		"username": username,
		"password": password,
	})
	if !result.Success {
		t.Fatalf("admin setup failed: %s", result.Error.Message)
	}

	// Extract token from Set-Cookie header
	resp, _ := ts.doRequest(t, "POST", "/api/v1/auth/login", map[string]string{
		"username": username,
		"password": password,
	})
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "jwt_token" {
			return cookie.Value
		}
	}

	t.Fatal("jwt_token cookie not found after login")
	return ""
}

// authHeader returns Authorization header key-value pair for use with doRequest.
func authHeader(token string) []string {
	return []string{"Authorization", "Bearer " + token}
}

func revealAgentAPIKey(t *testing.T, ts *testServer, agentID string, auth ...string) string {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/agents/"+agentID+"/key", nil, auth...)
	if !result.Success {
		t.Fatalf("reveal agent key failed: %v", result.Error)
	}
	var revealed struct {
		APIKey    string `json:"apiKey"`
		Available bool   `json:"available"`
	}
	if err := json.Unmarshal(result.Data, &revealed); err != nil {
		t.Fatalf("decode revealed agent key: %v", err)
	}
	if !revealed.Available || revealed.APIKey == "" {
		t.Fatalf("agent key unavailable: %+v", revealed)
	}
	return revealed.APIKey
}

// ??? Auth Flow Tests ???????????????????????????????????????????????

func TestSetupStatus_NoUsers(t *testing.T) {
	ts := setupTestServer(t)

	resp, result := ts.doRequest(t, "GET", "/api/v1/auth/setup/status", nil)

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if !result.Success {
		t.Error("expected success=true")
	}

	var data struct {
		NeedsSetup bool `json:"needs_setup"`
	}
	json.Unmarshal(result.Data, &data)
	if !data.NeedsSetup {
		t.Error("expected needs_setup=true when no users exist")
	}
}

func TestSetup_CreatesAdmin(t *testing.T) {
	ts := setupTestServer(t)

	_, result := ts.doRequest(t, "POST", "/api/v1/auth/setup", map[string]string{
		"username": "admin",
		"password": "testpass123",
	})

	if !result.Success {
		t.Fatalf("setup failed: %v", result.Error)
	}

	var data struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}
	json.Unmarshal(result.Data, &data)
	if data.Username != "admin" {
		t.Errorf("username = %q, want %q", data.Username, "admin")
	}
	if data.Role != "admin" {
		t.Errorf("role = %q, want %q", data.Role, "admin")
	}
}

func TestSetup_RejectsSecondSetup(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")

	resp, result := ts.doRequest(t, "POST", "/api/v1/auth/setup", map[string]string{
		"username": "hacker",
		"password": "testpass123",
	})

	if resp.StatusCode != 403 {
		t.Errorf("status = %d, want 403", resp.StatusCode)
	}
	if result.Success {
		t.Error("expected success=false for second setup")
	}
}

func TestSetup_RejectsShortPassword(t *testing.T) {
	ts := setupTestServer(t)

	resp, result := ts.doRequest(t, "POST", "/api/v1/auth/setup", map[string]string{
		"username": "admin",
		"password": "short",
	})

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
	if result.Success {
		t.Error("expected success=false for short password")
	}
}

func TestLogin_ValidCredentials(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")

	resp, result := ts.doRequest(t, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin",
		"password": "testpass123",
	})

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if !result.Success {
		t.Error("expected login success")
	}

	// Verify cookie is set
	found := false
	for _, c := range resp.Cookies() {
		if c.Name == "jwt_token" && c.Value != "" {
			found = true
			if !c.HttpOnly {
				t.Error("jwt_token cookie should be HttpOnly")
			}
		}
	}
	if !found {
		t.Error("jwt_token cookie not found")
	}
}

func TestLogin_InvalidCredentials(t *testing.T) {
	ts := setupTestServer(t)
	ts.setupAdmin(t, "admin", "testpass123")

	resp, _ := ts.doRequest(t, "POST", "/api/v1/auth/login", map[string]string{
		"username": "admin",
		"password": "wrongpass",
	})

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestMe_WithValidToken(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")

	resp, result := ts.doRequest(t, "GET", "/api/v1/auth/me", nil, authHeader(token)...)

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}

	var data struct {
		Username string `json:"username"`
	}
	json.Unmarshal(result.Data, &data)
	if data.Username != "admin" {
		t.Errorf("username = %q, want %q", data.Username, "admin")
	}
}

func TestMe_WithoutToken(t *testing.T) {
	ts := setupTestServer(t)

	resp, _ := ts.doRequest(t, "GET", "/api/v1/auth/me", nil)

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

// ??? Service CRUD Tests ????????????????????????????????????????????

func TestServiceCreate_RequiresAuth(t *testing.T) {
	ts := setupTestServer(t)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"id": "svc-noauth", "name": "NoAuth", "type": "log",
	})

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

// ??? Host Tests ????????????????????????????????????????????????????

// ??? Health Check Tests ????????????????????????????????????????????

func TestHealth(t *testing.T) {
	ts := setupTestServer(t)

	req := httptest.NewRequest("GET", "/api/v1/health", nil)
	resp, err := ts.App.Test(req, -1)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("parse body: %v", err)
	}
	if result["success"] != true {
		t.Errorf("success = %v, want true", result["success"])
	}
	data, ok := result["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("data field missing or not an object")
	}
	if data["status"] != "healthy" {
		t.Errorf("status = %v, want healthy", data["status"])
	}
}

// ??? Notification Channel Tests ????????????????????????????????????

func TestNotificationChannel_CRUD(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create
	_, createResult := ts.doRequest(t, "POST", "/api/v1/notifications", map[string]interface{}{
		"name": "Test Discord",
		"type": "discord",
		"config": map[string]string{
			"webhookUrl": "https://discord.com/api/webhooks/123/abc",
		},
	}, auth...)

	if !createResult.Success {
		t.Fatalf("create channel failed: %v", createResult.Error)
	}

	var channel struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Type string `json:"type"`
	}
	json.Unmarshal(createResult.Data, &channel)
	if channel.Name != "Test Discord" {
		t.Errorf("name = %q, want %q", channel.Name, "Test Discord")
	}

	// List
	_, listResult := ts.doRequest(t, "GET", "/api/v1/notifications", nil, auth...)
	if !listResult.Success {
		t.Fatalf("list channels failed: %v", listResult.Error)
	}

	// Toggle
	_, toggleResult := ts.doRequest(t, "POST", "/api/v1/notifications/"+channel.ID+"/toggle", nil, auth...)
	if !toggleResult.Success {
		t.Fatalf("toggle failed: %v", toggleResult.Error)
	}

	// Delete
	_, deleteResult := ts.doRequest(t, "DELETE", "/api/v1/notifications/"+channel.ID, nil, auth...)
	if !deleteResult.Success {
		t.Fatalf("delete failed: %v", deleteResult.Error)
	}
}

func TestNotificationChannel_GetHealth(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create a channel so it can show up in health (only channels with history/rule links appear)
	_, _ = ts.doRequest(t, "POST", "/api/v1/notifications", map[string]interface{}{
		"name": "HC Discord",
		"type": "discord",
		"config": map[string]string{
			"webhookUrl": "https://discord.com/api/webhooks/123/abc",
		},
	}, auth...)

	resp, result := ts.doRequest(t, "GET", "/api/v1/notifications/health?days=7", nil, auth...)
	if resp.StatusCode != 200 {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("expected success, got error: %v", result.Error)
	}

	var entries []map[string]interface{}
	if err := json.Unmarshal(result.Data, &entries); err != nil {
		t.Fatalf("decode health: %v", err)
	}
	// With no notification_history rows and no rule links, the array should be empty
	if len(entries) != 0 {
		t.Errorf("expected empty health list, got %d entries", len(entries))
	}
}

func TestNotificationChannel_InvalidType(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	resp, _ := ts.doRequest(t, "POST", "/api/v1/notifications", map[string]interface{}{
		"name":   "Bad Type",
		"type":   "email",
		"config": map[string]string{},
	}, auth...)

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400 for invalid type", resp.StatusCode)
	}
}

func TestNotificationChannel_TestConfigValidatesWithoutSaving(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	resp, result := ts.doRequest(t, "POST", "/api/v1/notifications/test", map[string]interface{}{
		"name": "Telegram Draft",
		"type": "telegram",
		"config": map[string]string{
			"botToken": "",
			"chatId":   "",
		},
	}, auth...)

	if resp.StatusCode != 400 {
		t.Errorf("status = %d, want 400 for invalid draft config", resp.StatusCode)
	}
	if result.Success {
		t.Fatal("expected success=false for invalid draft config")
	}
	if result.Error == nil || result.Error.Code != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %v", result.Error)
	}

	_, listResult := ts.doRequest(t, "GET", "/api/v1/notifications", nil, auth...)
	if !listResult.Success {
		t.Fatalf("list channels failed: %v", listResult.Error)
	}

	var channels []map[string]interface{}
	if err := json.Unmarshal(listResult.Data, &channels); err != nil {
		t.Fatalf("decode channels: %v", err)
	}
	if len(channels) != 0 {
		t.Fatalf("expected no saved channels after draft test validation failure, got %d", len(channels))
	}
}

func TestLogList_NotInterceptedByLogIngestApiKeyAuth(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	resp, result := ts.doRequest(t, "GET", "/api/v1/logs", nil, auth...)

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if !result.Success {
		t.Fatalf("get logs failed: %v", result.Error)
	}
}

// TestLogList_ServerSideFilters verifies GET /api/v1/logs narrows by
// serviceName/search/level server-side and reports the unpaged total, so the
// aggregate logs page can stop filtering the loaded page client-side.
func TestLogList_ServerSideFilters(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	repo := database.NewLogRepository()
	seed := []models.Log{
		{ServiceName: "api", Level: models.LogLevelError, Message: "connection timeout to upstream"},
		{ServiceName: "api", Level: models.LogLevelInfo, Message: "server listening"},
		{ServiceName: "worker", Level: models.LogLevelError, Message: "connection timeout to broker"},
	}
	for i := range seed {
		seed[i].CreatedAt = time.Now().Add(time.Duration(-i) * time.Minute)
		if err := repo.Create(&seed[i]); err != nil {
			t.Fatalf("seed log %d: %v", i, err)
		}
	}

	var list struct {
		Data []struct {
			ServiceName string `json:"serviceName"`
			Level       string `json:"level"`
			Message     string `json:"message"`
		} `json:"data"`
		Total int `json:"total"`
	}
	get := func(query string) {
		t.Helper()
		resp, result := ts.doRequest(t, "GET", "/api/v1/logs"+query, nil, auth...)
		if resp.StatusCode != 200 || !result.Success {
			t.Fatalf("GET /logs%s: status=%d err=%v", query, resp.StatusCode, result.Error)
		}
		list.Data = nil
		if err := json.Unmarshal(result.Data, &list); err != nil {
			t.Fatalf("decode /logs%s: %v", query, err)
		}
	}

	get("")
	if list.Total != 3 || len(list.Data) != 3 {
		t.Fatalf("unfiltered = %d rows / total %d, want 3/3", len(list.Data), list.Total)
	}

	get("?serviceName=api")
	if list.Total != 2 || len(list.Data) != 2 {
		t.Fatalf("serviceName=api = %d rows / total %d, want 2/2", len(list.Data), list.Total)
	}

	get("?search=broker")
	if list.Total != 1 || len(list.Data) != 1 || list.Data[0].ServiceName != "worker" {
		t.Fatalf("search=broker = %+v, want the single worker row", list)
	}

	get("?serviceName=api&level=error")
	if list.Total != 1 || len(list.Data) != 1 || list.Data[0].Level != "error" {
		t.Fatalf("serviceName=api&level=error = %+v, want the single api error row", list)
	}

	// total is the unpaged count, not the page size — the page prints both.
	get("?limit=1")
	if list.Total != 3 || len(list.Data) != 1 {
		t.Fatalf("limit=1 = %d rows / total %d, want 1 row / total 3", len(list.Data), list.Total)
	}
}

// TestLogService_DefaultLogLevelFilter verifies that a new log service defaults
// its logLevelFilter to [error, warn, info] (DEBUG/TRACE are opt-in). Service
// creation moved out of the HTTP API in the agent-only architecture, so the
// service is seeded directly via the repository (which applies ToService's
// defaults) and read back through GET /services/:id.
func TestLogService_DefaultLogLevelFilter(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	seedLogService(t, "log-default-filter", "Default Filter")

	_, getResult := ts.doRequest(t, "GET", "/api/v1/services/log-default-filter", nil, auth...)
	if !getResult.Success {
		t.Fatalf("get service failed: %v", getResult.Error)
	}
	var svc struct {
		LogLevelFilter []string `json:"logLevelFilter"`
	}
	if err := json.Unmarshal(getResult.Data, &svc); err != nil {
		t.Fatalf("unmarshal service: %v", err)
	}

	if len(svc.LogLevelFilter) != 3 {
		t.Fatalf("logLevelFilter len = %d, want 3 — got %v", len(svc.LogLevelFilter), svc.LogLevelFilter)
	}
	want := map[string]bool{"error": true, "warn": true, "info": true}
	for _, l := range svc.LogLevelFilter {
		if !want[l] {
			t.Errorf("unexpected level %q in default filter", l)
		}
	}
}

// seedLogService inserts a log-type service directly via the repository and
// returns the plaintext API key for authenticating OTLP/log ingest. The
// POST /services write path was removed in the agent-only architecture, so
// tests seed fixtures through the repository instead. ToService applies the
// same defaults (e.g. logLevelFilter) the old create handler relied on.
func seedLogService(t *testing.T, id, name string) (*models.Service, string) {
	t.Helper()
	apiKey := "evup_" + id
	svc := (&models.ServiceCreateRequest{ID: id, Name: name, Type: models.ServiceTypeLog}).ToService()
	svc.ApiKey = apiKey
	svc.ApiKeyMasked = "evup_****"
	if err := database.NewServiceRepository().Create(svc); err != nil {
		t.Fatalf("seed log service %q: %v", id, err)
	}
	return svc, apiKey
}

// ??? Alert Rule Tests ??????????????????????????????????????????????

func TestAlertRule_CRUD(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create
	_, createResult := ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{
		"name":      "High CPU",
		"type":      "resource",
		"metric":    "cpu",
		"operator":  ">",
		"threshold": 90,
		"duration":  5,
		"severity":  "critical",
		"cooldown":  300,
		"hostId":    "local",
	}, auth...)

	if !createResult.Success {
		t.Fatalf("create rule failed: %v", createResult.Error)
	}

	var rule struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	json.Unmarshal(createResult.Data, &rule)

	// Toggle
	_, toggleResult := ts.doRequest(t, "POST", "/api/v1/alert-rules/"+rule.ID+"/toggle", nil, auth...)
	if !toggleResult.Success {
		t.Fatalf("toggle failed: %v", toggleResult.Error)
	}

	// Delete
	_, deleteResult := ts.doRequest(t, "DELETE", "/api/v1/alert-rules/"+rule.ID, nil, auth...)
	if !deleteResult.Success {
		t.Fatalf("delete failed: %v", deleteResult.Error)
	}
}

// ─── Agent (Project) API Key Tests ──────────────────────────────────

// TestAgentApiKey_RevealAndRotate verifies project creation exposes a one-time
// installer code rather than the API key, while explicit reveal and rotation
// remain available to an authenticated administrator.
func TestAgentApiKey_RevealAndRotate(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create a project — only a short-lived installer code is returned.
	_, createResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "payments"}, auth...)
	if !createResult.Success {
		t.Fatalf("create failed: %v", createResult.Error)
	}
	var created struct {
		ID        string    `json:"id"`
		JoinCode  string    `json:"joinCode"`
		ExpiresAt time.Time `json:"expiresAt"`
		APIKey    string    `json:"apiKey"`
	}
	json.Unmarshal(createResult.Data, &created)
	if created.ID == "" || created.JoinCode == "" || created.ExpiresAt.IsZero() {
		t.Fatalf("expected id and join code, got %+v", created)
	}
	if created.APIKey != "" {
		t.Fatal("create response must not expose the long-lived API key")
	}

	// Explicit reveal remains available to the authenticated administrator.
	_, keyResult := ts.doRequest(t, "GET", "/api/v1/agents/"+created.ID+"/key", nil, auth...)
	if !keyResult.Success {
		t.Fatalf("get key failed: %v", keyResult.Error)
	}
	var revealed struct {
		APIKey    string `json:"apiKey"`
		Available bool   `json:"available"`
	}
	json.Unmarshal(keyResult.Data, &revealed)
	if !revealed.Available {
		t.Error("expected available=true for a freshly created project")
	}
	if revealed.APIKey == "" {
		t.Error("expected a non-empty revealed key")
	}
	originalAPIKey := revealed.APIKey

	// The bootstrap script is public but contains no project secret.
	scriptResp, err := ts.App.Test(httptest.NewRequest("GET", "/api/v1/agents/install.sh", nil))
	if err != nil {
		t.Fatalf("get installer script: %v", err)
	}
	scriptBody, _ := io.ReadAll(scriptResp.Body)
	if scriptResp.StatusCode != http.StatusOK || !strings.Contains(string(scriptBody), "Exchanging the one-time EveryUp join code") || strings.Contains(string(scriptBody), originalAPIKey) {
		t.Fatalf("unexpected installer script response: status=%d body=%q", scriptResp.StatusCode, string(scriptBody))
	}

	// Input validation runs before consumption, so a typo can be corrected with
	// the same code instead of forcing a reissue.
	badForm := url.Values{"baseUrl": {"not-a-url"}}
	badReq := httptest.NewRequest("POST", "/api/v1/agents/join", strings.NewReader(badForm.Encode()))
	badReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	badReq.Header.Set("Authorization", "Bearer "+created.JoinCode)
	badResp, err := ts.App.Test(badReq)
	if err != nil {
		t.Fatalf("invalid base URL request: %v", err)
	}
	if badResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid base URL status=%d, want 400", badResp.StatusCode)
	}

	// Exchange succeeds once and returns a Compose bundle containing the key.
	form := url.Values{"baseUrl": {"https://everyup.example.com"}}
	joinReq := httptest.NewRequest("POST", "/api/v1/agents/join", strings.NewReader(form.Encode()))
	joinReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	joinReq.Header.Set("Authorization", "Bearer "+created.JoinCode)
	joinResp, err := ts.App.Test(joinReq)
	if err != nil {
		t.Fatalf("join request: %v", err)
	}
	joinBody, _ := io.ReadAll(joinResp.Body)
	if joinResp.StatusCode != http.StatusOK || !strings.Contains(string(joinBody), originalAPIKey) || !strings.Contains(string(joinBody), "https://everyup.example.com") {
		t.Fatalf("unexpected join response: status=%d body=%q", joinResp.StatusCode, string(joinBody))
	}

	secondReq := httptest.NewRequest("POST", "/api/v1/agents/join", strings.NewReader(form.Encode()))
	secondReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	secondReq.Header.Set("Authorization", "Bearer "+created.JoinCode)
	secondResp, err := ts.App.Test(secondReq)
	if err != nil {
		t.Fatalf("second join request: %v", err)
	}
	if secondResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("second join status = %d, want 401", secondResp.StatusCode)
	}

	// An administrator can replace an expired/used code without rotating the
	// long-lived Agent key.
	_, reissueResult := ts.doRequest(t, "POST", "/api/v1/agents/"+created.ID+"/join-code", nil, auth...)
	if !reissueResult.Success {
		t.Fatalf("reissue join code failed: %v", reissueResult.Error)
	}
	var reissued struct {
		JoinCode  string    `json:"joinCode"`
		ExpiresAt time.Time `json:"expiresAt"`
	}
	json.Unmarshal(reissueResult.Data, &reissued)
	if reissued.JoinCode == "" || reissued.JoinCode == created.JoinCode || reissued.ExpiresAt.IsZero() {
		t.Fatalf("unexpected reissued join code: %+v", reissued)
	}

	// Rotate — returns a new, different key.
	_, rotateResult := ts.doRequest(t, "POST", "/api/v1/agents/"+created.ID+"/rotate-key", nil, auth...)
	if !rotateResult.Success {
		t.Fatalf("rotate failed: %v", rotateResult.Error)
	}
	var rotated struct {
		APIKey string `json:"apiKey"`
	}
	json.Unmarshal(rotateResult.Data, &rotated)
	if rotated.APIKey == "" || rotated.APIKey == originalAPIKey {
		t.Errorf("rotated key = %q, want a new key different from %q", rotated.APIKey, originalAPIKey)
	}

	// Reveal again — now returns the rotated key (rotation persisted).
	_, keyResult2 := ts.doRequest(t, "GET", "/api/v1/agents/"+created.ID+"/key", nil, auth...)
	var revealed2 struct {
		APIKey string `json:"apiKey"`
	}
	json.Unmarshal(keyResult2.Data, &revealed2)
	if revealed2.APIKey != rotated.APIKey {
		t.Errorf("after rotation revealed = %q, want %q", revealed2.APIKey, rotated.APIKey)
	}

	// Unknown project → 404.
	resp, _ := ts.doRequest(t, "GET", "/api/v1/agents/agent_does_not_exist/key", nil, auth...)
	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404 for unknown project", resp.StatusCode)
	}
}

// ─── Agent (Project) Deletion Tests ─────────────────────────────────

// TestAgentDelete_RemovesProjectFromListings verifies a deleted (deactivated)
// project — and its reported services — disappear from the list endpoints.
// Regression test: deactivation set status='inactive' but the listing queries
// did not filter on status, so deleted projects/cards lingered in the UI.
func TestAgentDelete_RemovesProjectFromListings(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	// Create a project.
	_, createResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "to-delete"}, auth...)
	if !createResult.Success {
		t.Fatalf("create failed: %v", createResult.Error)
	}
	var created struct {
		ID string `json:"id"`
	}
	json.Unmarshal(createResult.Data, &created)

	// Seed a reported service so it shows up in the services listing.
	repo := database.NewAgentRepository()
	if err := repo.UpsertServices(created.ID, time.Now(), []models.AgentService{{
		AgentID: created.ID, Key: "api", Name: "api", CheckType: "http",
		Endpoint: "http://api/health", Healthy: true, Seen: true, ObservedAt: time.Now(),
	}}); err != nil {
		t.Fatalf("seed services: %v", err)
	}

	// Sanity: project + service are listed before deletion.
	if !listHasAgent(t, ts, auth, created.ID) {
		t.Fatal("project should be listed before deletion")
	}
	if !servicesHaveAgent(t, ts, auth, created.ID) {
		t.Fatal("service should be listed before deletion")
	}

	// Delete (soft-delete / deactivate) — returns 204 No Content (empty body),
	// so bypass doRequest's JSON decode and check the status directly.
	req := httptest.NewRequest("DELETE", "/api/v1/agents/"+created.ID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	delResp, err := ts.App.Test(req, -1)
	if err != nil {
		t.Fatalf("delete request: %v", err)
	}
	delResp.Body.Close()
	if delResp.StatusCode != 204 {
		t.Fatalf("delete status = %d, want 204", delResp.StatusCode)
	}

	// The deleted project must disappear from both listings.
	if listHasAgent(t, ts, auth, created.ID) {
		t.Error("deleted project still appears in GET /agents")
	}
	if servicesHaveAgent(t, ts, auth, created.ID) {
		t.Error("deleted project's service still appears in GET /agents/services/all")
	}
}

func listHasAgent(t *testing.T, ts *testServer, auth []string, id string) bool {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/agents", nil, auth...)
	var agents []struct {
		ID string `json:"id"`
	}
	json.Unmarshal(result.Data, &agents)
	for _, a := range agents {
		if a.ID == id {
			return true
		}
	}
	return false
}

func servicesHaveAgent(t *testing.T, ts *testServer, auth []string, id string) bool {
	t.Helper()
	_, result := ts.doRequest(t, "GET", "/api/v1/agents/services/all", nil, auth...)
	var svcs []struct {
		AgentID string `json:"agentId"`
	}
	json.Unmarshal(result.Data, &svcs)
	for _, s := range svcs {
		if s.AgentID == id {
			return true
		}
	}
	return false
}

// TestAgentServiceLogs_KeyResolution is a regression test for two bugs that
// broke the per-service logs/requests endpoints:
//  1. GetServiceLogs filtered on a non-existent column l.service_name → DATABASE_ERROR.
//  2. Fiber's default UnescapePath=false left percent-encoded keys (env:demo-prod
//     arrives as env%3Ademo-prod) undecoded, so the lookup returned NOT_FOUND.
//
// Both the colon-containing env key and a hash-style key must resolve to 200,
// while an unknown key still returns 404.
func TestAgentServiceLogs_KeyResolution(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, createResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "logs-proj"}, auth...)
	if !createResult.Success {
		t.Fatalf("create failed: %v", createResult.Error)
	}
	var created struct {
		ID string `json:"id"`
	}
	json.Unmarshal(createResult.Data, &created)

	// Seed two services: one env-style key (with a colon) and one hash-style key.
	const hashKey = "06190025aa11d5f9716dbe0cd42a0e1ebb474e896eb39681bbb787dda832ebd1"
	repo := database.NewAgentRepository()
	if err := repo.UpsertServices(created.ID, time.Now(), []models.AgentService{
		{AgentID: created.ID, Key: "env:demo-prod", Name: "demo-prod", CheckType: "http", Healthy: true, Seen: true, ObservedAt: time.Now()},
		{AgentID: created.ID, Key: hashKey, Name: "discovered-api", CheckType: "http", Healthy: true, Seen: true, ObservedAt: time.Now()},
	}); err != nil {
		t.Fatalf("seed services: %v", err)
	}

	// The env key is sent percent-encoded by the frontend (encodeURIComponent).
	base := "/api/v1/agents/" + created.ID + "/services/"
	cases := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{"env key (percent-encoded colon)", base + "env%3Ademo-prod/logs", 200},
		{"hash key", base + hashKey + "/logs", 200},
		{"env key requests", base + "env%3Ademo-prod/requests", 200},
		{"unknown key", base + "env%3Anope/logs", 404},
		// log-filter must agree with logs/requests on existence (was always 200).
		{"log-filter known key", base + hashKey + "/log-filter", 200},
		{"log-filter unknown key", base + "env%3Anope/log-filter", 404},
	}
	for _, tc := range cases {
		resp, result := ts.doRequest(t, "GET", tc.path, nil, auth...)
		if resp.StatusCode != tc.wantStatus {
			t.Errorf("%s: status = %d (%v), want %d", tc.name, resp.StatusCode, result.Error, tc.wantStatus)
		}
		if tc.wantStatus == 200 && !result.Success {
			t.Errorf("%s: success = false, error = %v", tc.name, result.Error)
		}
	}
}

// The overview timeline merges two subsystems that record outages differently:
// uptime monitors write explicit rows to `incidents`, Docker services only leave
// health samples in `agent_service_history`. This asserts both arrive in one
// newest-first list with links the client can follow without branching.
func TestIncidentTimelineMergesUptimeAndDockerSources(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "timeline-pass-1")
	now := time.Now()

	// --- uptime monitor with a resolved outage ---
	svcRepo := database.NewServiceRepository()
	monitor := models.Service{
		ID: "mon-1", Name: "Storefront", Type: "http", IsActive: true,
		URL: "https://store.example.com/health", Method: "GET",
		ExpectedStatus: 200, Interval: 60, Timeout: 5000,
	}
	if err := svcRepo.Create(&monitor); err != nil {
		t.Fatalf("create monitor: %v", err)
	}
	resolved := now.Add(-4 * time.Hour)
	if _, err := database.DB.Exec(
		`INSERT INTO incidents (service_id, type, message, started_at, resolved_at) VALUES (?, ?, ?, ?, ?)`,
		monitor.ID, "down", "503 from origin", now.Add(-5*time.Hour), resolved,
	); err != nil {
		t.Fatalf("seed incident: %v", err)
	}

	// --- Docker service still down, more recent than the uptime episode ---
	agentRepo := database.NewAgentRepository()
	if err := agentRepo.UpsertAgent(models.Agent{ID: "agent-1", Name: "prod-server", LastSeenAt: now}); err != nil {
		t.Fatalf("UpsertAgent: %v", err)
	}
	dockerSvc := func(healthy bool) models.AgentService {
		// A ':' in the key must survive the round trip into a URL path segment.
		return models.AgentService{
			AgentID: "agent-1", Key: "shop:payment-worker", Name: "payment-worker",
			CheckType: "http", Endpoint: "http://payment-worker:8090/health", Healthy: healthy,
		}
	}
	for _, step := range []struct {
		at time.Time
		ok bool
	}{
		{now.Add(-3 * time.Hour), true},
		{now.Add(-2 * time.Hour), false},
		{now.Add(-1 * time.Hour), false},
	} {
		if err := agentRepo.UpsertServices("agent-1", step.at, []models.AgentService{dockerSvc(step.ok)}); err != nil {
			t.Fatalf("UpsertServices: %v", err)
		}
	}

	_, result := ts.doRequest(t, "GET", "/api/v1/incidents/timeline?days=7&limit=20", nil, authHeader(token)...)
	if !result.Success {
		t.Fatalf("timeline request failed: %+v", result.Error)
	}

	raw, err := json.Marshal(result.Data)
	if err != nil {
		t.Fatalf("re-marshal data: %v", err)
	}
	var episodes []models.TimelineIncident
	if err := json.Unmarshal(raw, &episodes); err != nil {
		t.Fatalf("decode timeline: %v", err)
	}
	if len(episodes) != 2 {
		t.Fatalf("expected one episode per source, got %d: %+v", len(episodes), episodes)
	}

	// Newest first: the Docker outage started 2h ago, the uptime one 5h ago.
	docker, uptime := episodes[0], episodes[1]
	if docker.Source != models.IncidentSourceDocker || uptime.Source != models.IncidentSourceUptime {
		t.Fatalf("wrong order or sources: %+v", episodes)
	}
	if !docker.Active || docker.EndedAt != nil {
		t.Fatalf("docker episode should still be open: %+v", docker)
	}
	if docker.TargetName != "payment-worker" || docker.TargetPath != "/services/agent-1/shop%3Apayment-worker" {
		t.Fatalf("docker link is not followable: %+v", docker)
	}
	if uptime.Active || uptime.EndedAt == nil {
		t.Fatalf("uptime episode should be resolved: %+v", uptime)
	}
	if uptime.TargetName != "Storefront" || uptime.TargetPath != "/uptime/mon-1" {
		t.Fatalf("uptime link is not followable: %+v", uptime)
	}
	if uptime.Message != "503 from origin" {
		t.Fatalf("uptime message dropped: %+v", uptime)
	}
	if uptime.DurationSec != 3600 {
		t.Fatalf("resolved duration should be start→resolve, got %d", uptime.DurationSec)
	}
}
