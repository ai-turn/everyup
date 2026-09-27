package handlers_test

import (
	"encoding/json"
	"net/url"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
)

// TestLogSummaryAndPatterns walks the logs page's reads end to end: OTLP logs
// from a Docker service are counted per service with the newest error quoted,
// messages that differ only in an id fold into one pattern, and the pattern's
// fingerprint narrows that service's own log list and histogram.
func TestLogSummaryAndPatterns(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	_, created := ts.doRequest(t, "POST", "/api/v1/agents", map[string]string{"name": "shop"}, auth...)
	if !created.Success {
		t.Fatalf("create agent: %v", created.Error)
	}
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(created.Data, &agent); err != nil {
		t.Fatal(err)
	}
	apiKey := revealAgentAPIKey(t, ts, agent.ID, auth...)
	const svcKey, svcName = "container-abc", "checkout-api"
	if err := database.NewAgentRepository().UpsertServices(agent.ID, time.Now(), []models.AgentService{{
		AgentID: agent.ID, Key: svcKey, Name: svcName, CheckType: "http", Endpoint: "http://x/health",
	}}); err != nil {
		t.Fatalf("seed agent service: %v", err)
	}

	now := time.Now()
	record := func(ago time.Duration, severity logspb.SeverityNumber, body string) *logspb.LogRecord {
		return &logspb.LogRecord{TimeUnixNano: uint64(now.Add(-ago).UnixNano()), SeverityNumber: severity, Body: stringValue(body)}
	}
	const errorLevel, warnLevel, infoLevel = logspb.SeverityNumber_SEVERITY_NUMBER_ERROR, logspb.SeverityNumber_SEVERITY_NUMBER_WARN, logspb.SeverityNumber_SEVERITY_NUMBER_INFO
	postOTLP(t, ts, "/api/v1/otlp/v1/logs", apiKey, &collectorlogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{{
			Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{{Key: "service.name", Value: stringValue(svcName)}}},
			ScopeLogs: []*logspb.ScopeLogs{{LogRecords: []*logspb.LogRecord{
				// Outside the window: not counted, but it dates the pattern.
				record(30*time.Hour, errorLevel, "user 1 not found"),
				record(50*time.Minute, errorLevel, "user 123 not found"),
				record(40*time.Minute, errorLevel, "user 456 not found"),
				record(30*time.Minute, errorLevel, "payment gateway timeout after 5000ms"),
				// Newer than every error, yet the card should still quote the error.
				record(10*time.Minute, warnLevel, "retry 2 of 5"),
				record(5*time.Minute, infoLevel, "served request"),
			}}},
		}},
	})

	// A direct connection is keyed by its service id, not by name.
	if err := database.NewLogRepository().Create(&models.Log{
		ServiceID: "direct-1", ServiceName: "billing", Level: models.LogLevelWarn,
		Message: "slow query", Fingerprint: "fp-direct", CreatedAt: now.UTC().Add(-time.Hour),
	}); err != nil {
		t.Fatal(err)
	}
	// A service that has not logged within the window still reports when it last did.
	if err := (&database.ConnectionSetupRepository{}).Record("agent", agent.ID, "quiet-worker", "logs"); err != nil {
		t.Fatal(err)
	}

	var summaries []models.LogServiceSummary
	getJSON(t, ts, "/api/v1/logs/summary", &summaries, auth...)
	find := func(match func(models.LogServiceSummary) bool) models.LogServiceSummary {
		t.Helper()
		for _, s := range summaries {
			if match(s) {
				return s
			}
		}
		t.Fatalf("summary not found in %+v", summaries)
		return models.LogServiceSummary{}
	}

	checkout := find(func(s models.LogServiceSummary) bool { return s.AgentID == agent.ID && s.ServiceName == svcName })
	if checkout.Error != 3 || checkout.Warn != 1 {
		t.Errorf("checkout counts = %d error / %d warn, want 3 / 1", checkout.Error, checkout.Warn)
	}
	if checkout.Latest == nil || checkout.Latest.Level != models.LogLevelError || checkout.Latest.Message != "payment gateway timeout after 5000ms" {
		t.Errorf("checkout latest = %+v, want the newest error", checkout.Latest)
	}
	if checkout.LastReceivedAt == nil {
		t.Error("checkout lastReceivedAt missing — ingest records a receipt")
	}
	bucketErrors, bucketWarns := 0, 0
	for _, b := range checkout.Buckets {
		bucketErrors += b.Error
		bucketWarns += b.Warn
	}
	if bucketErrors != 3 || bucketWarns != 1 {
		t.Errorf("checkout buckets sum to %d/%d, want 3/1", bucketErrors, bucketWarns)
	}

	billing := find(func(s models.LogServiceSummary) bool { return s.ServiceID == "direct-1" })
	if billing.AgentID != "" || billing.Warn != 1 || billing.Latest == nil || billing.Latest.Message != "slow query" {
		t.Errorf("direct summary = %+v", billing)
	}

	quiet := find(func(s models.LogServiceSummary) bool { return s.AgentID == agent.ID && s.ServiceName == "quiet-worker" })
	if quiet.Error != 0 || quiet.Warn != 0 || quiet.LastReceivedAt == nil || quiet.Buckets == nil {
		t.Errorf("quiet summary = %+v, want zero counts, a receipt and an empty bucket list", quiet)
	}

	// Errors come before warnings; within a level the busiest pattern leads.
	var patterns []models.LogPattern
	getJSON(t, ts, "/api/v1/logs/patterns", &patterns, auth...)
	if len(patterns) != 4 {
		t.Fatalf("patterns = %+v, want 4 (users, payment, retry, slow query)", patterns)
	}
	users := patterns[0]
	if users.Count != 2 || users.Message != "user 456 not found" || users.AgentID != agent.ID || users.ServiceName != svcName {
		t.Errorf("top pattern = %+v, want the two user-not-found errors quoting the newest", users)
	}
	if !users.FirstSeen.Before(now.Add(-24 * time.Hour)) {
		t.Errorf("firstSeen = %s, want the 30h-old occurrence outside the window", users.FirstSeen)
	}
	if !users.LastSeen.After(users.FirstSeen) {
		t.Errorf("lastSeen %s should follow firstSeen %s", users.LastSeen, users.FirstSeen)
	}
	if patterns[1].Message != "payment gateway timeout after 5000ms" || patterns[2].Level != models.LogLevelWarn {
		t.Errorf("pattern order = %+v", patterns)
	}

	// The pattern link opens the service's logs narrowed to that fingerprint.
	from := url.QueryEscape(now.Add(-24 * time.Hour).UTC().Format(time.RFC3339))
	base := "/api/v1/agents/" + agent.ID + "/services/" + svcKey
	var list struct {
		Data  []models.Log `json:"data"`
		Total int          `json:"total"`
	}
	getJSON(t, ts, base+"/logs?fingerprint="+users.Fingerprint+"&from="+from, &list, auth...)
	if list.Total != 2 {
		t.Errorf("fingerprint-filtered logs = %d, want 2: %+v", list.Total, list.Data)
	}
	var buckets []models.LogHistogramBucket
	getJSON(t, ts, base+"/log-histogram?bucketMins=60&fingerprint="+users.Fingerprint+"&from="+from, &buckets, auth...)
	histogramTotal := 0
	for _, b := range buckets {
		histogramTotal += b.Error + b.Warn + b.Info
	}
	if histogramTotal != 2 {
		t.Errorf("fingerprint-filtered histogram counts %d logs, want 2", histogramTotal)
	}
}

// getJSON fetches a JSON endpoint and decodes its data envelope into out.
func getJSON(t *testing.T, ts *testServer, path string, out interface{}, auth ...string) {
	t.Helper()
	resp, result := ts.doRequest(t, "GET", path, nil, auth...)
	if resp.StatusCode != 200 || !result.Success {
		t.Fatalf("GET %s: status=%d err=%v", path, resp.StatusCode, result.Error)
	}
	if err := json.Unmarshal(result.Data, out); err != nil {
		t.Fatalf("decode %s: %v", path, err)
	}
}
