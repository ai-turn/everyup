package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func decodeData[T any](t *testing.T, data any) T {
	t.Helper()
	raw, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("re-marshal data: %v", err)
	}
	var out T
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("decode data: %v", err)
	}
	return out
}

func seedMonitors(t *testing.T, ids ...string) {
	t.Helper()
	repo := database.NewServiceRepository()
	for _, id := range ids {
		if err := repo.Create(&models.Service{
			ID: id, Name: id, Type: "http", IsActive: true,
			URL: "https://" + id + ".example.com", Method: "GET", Interval: 60, Timeout: 5000,
		}); err != nil {
			t.Fatalf("create monitor: %v", err)
		}
	}
}

// The monitor detail lists that monitor's outage episodes only — the
// cross-target timeline already exists on the overview.
func TestUptimeMonitorIncidentsAreScopedToTheMonitor(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "uptime-incidents-1")
	now := time.Now()
	seedMonitors(t, "mon-a", "mon-b")
	for _, seed := range []struct {
		service  string
		started  time.Time
		resolved any
		message  string
	}{
		{"mon-a", now.Add(-5 * time.Hour), now.Add(-4 * time.Hour), "503 from origin"},
		{"mon-a", now.Add(-30 * time.Minute), nil, "connection refused"},
		{"mon-b", now.Add(-1 * time.Hour), nil, "other monitor"},
	} {
		if _, err := database.DB.Exec(
			`INSERT INTO incidents (service_id, type, message, started_at, resolved_at) VALUES (?, 'down', ?, ?, ?)`,
			seed.service, seed.message, seed.started, seed.resolved,
		); err != nil {
			t.Fatalf("seed incident: %v", err)
		}
	}

	_, result := ts.doRequest(t, "GET", "/api/v1/services/mon-a/incidents?days=90", nil, authHeader(token)...)
	if !result.Success {
		t.Fatalf("incidents request failed: %+v", result.Error)
	}
	episodes := decodeData[[]models.TimelineIncident](t, result.Data)
	if len(episodes) != 2 {
		t.Fatalf("want mon-a's 2 episodes only, got %d: %+v", len(episodes), episodes)
	}
	open, resolved := episodes[0], episodes[1]
	if !open.Active || open.Message != "connection refused" || open.EndedAt != nil {
		t.Errorf("newest episode should be the open one: %+v", open)
	}
	if resolved.Active || resolved.DurationSec != 3600 || resolved.Message != "503 from origin" {
		t.Errorf("resolved episode wrong: %+v", resolved)
	}
}

// Buckets average successful checks only and keep every check's count.
func TestUptimeMonitorHistoryRanges(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "uptime-history-1")
	now := time.Now()
	seedMonitors(t, "mon-h")
	metricRepo := database.NewMetricRepository()
	for _, m := range []models.Metric{
		{ServiceID: "mon-h", Status: models.CheckStatusSuccess, ResponseTime: 100, CheckedAt: now.Add(-3 * time.Minute)},
		{ServiceID: "mon-h", Status: models.CheckStatusFailure, ResponseTime: 5000, CheckedAt: now.Add(-2 * time.Minute)},
		{ServiceID: "mon-h", Status: models.CheckStatusSuccess, ResponseTime: 300, CheckedAt: now.Add(-1 * time.Minute)},
		{ServiceID: "mon-h", Status: models.CheckStatusSuccess, ResponseTime: 999, CheckedAt: now.Add(-3 * time.Hour)},
	} {
		m := m
		if err := metricRepo.Create(&m); err != nil {
			t.Fatalf("seed metric: %v", err)
		}
	}

	_, result := ts.doRequest(t, "GET", "/api/v1/services/mon-h/metrics/history?range=24h", nil, authHeader(token)...)
	if !result.Success {
		t.Fatalf("history 24h failed: %+v", result.Error)
	}
	day := decodeData[[]models.ServiceHistoryPoint](t, result.Data)
	total, success := 0, 0.0
	for _, p := range day {
		total += p.Total
		success += p.UptimePct * float64(p.Total) / 100
	}
	if total != 4 || success != 3 {
		t.Fatalf("24h buckets should hold all 4 checks, 3 successful: total=%d success=%v %+v", total, success, day)
	}
	for _, p := range day {
		if p.LatencyMs >= 5000 {
			t.Errorf("a failed check's timeout leaked into a bucket average: %+v", p)
		}
	}
}

// Certificate expiry is recorded by the checker and returned with the monitor.
func TestUptimeMonitorReturnsCertificateExpiry(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "uptime-cert-1")
	seedMonitors(t, "mon-tls")
	expires := time.Date(2027, 1, 15, 12, 0, 0, 0, time.UTC)
	if err := database.NewServiceRepository().SetCertExpiry("mon-tls", expires); err != nil {
		t.Fatalf("SetCertExpiry: %v", err)
	}

	_, result := ts.doRequest(t, "GET", "/api/v1/services/mon-tls", nil, authHeader(token)...)
	if !result.Success {
		t.Fatalf("get monitor failed: %+v", result.Error)
	}
	monitor := decodeData[map[string]any](t, result.Data)
	got, _ := time.Parse(time.RFC3339, monitor["certExpiresAt"].(string))
	if !got.Equal(expires) {
		t.Errorf("certExpiresAt = %v, want %v", monitor["certExpiresAt"], expires)
	}
}
