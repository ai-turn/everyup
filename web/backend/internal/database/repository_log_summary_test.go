package database_test

import (
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestLogFingerprint_MasksVariableParts(t *testing.T) {
	fp := func(message string) string { return database.LogFingerprint("agent-x:api", "error", message) }

	same := [][2]string{
		{"user 123 not found", "user 98765 not found"},
		{"upstream timeout after 5000ms", "upstream timeout after 250ms"},
		{"order 3f2a9c1e-7b4d-4e8a-9f10-2c3d4e5f6a7b rejected", "order 0e1d2c3b-4a59-4687-b9a0-f1e2d3c4b5a6 rejected"},
		{"dial tcp 10.0.0.5:5432: connection refused", "dial tcp 172.16.3.40:5432: connection refused"},
		{"cache miss for key a1b2c3d4", "cache miss for key 9f8e7d6c"},
		{"결제 12건 실패", "결제 7건 실패"},
	}
	for _, pair := range same {
		if fp(pair[0]) != fp(pair[1]) {
			t.Errorf("%q and %q should share a pattern", pair[0], pair[1])
		}
	}

	if fp("user 1 not found") == fp("order 1 not found") {
		t.Error("different words must stay different patterns")
	}
	// Words made only of hex letters are words, not ids.
	if fp("cache added") == fp("cache faced") {
		t.Error("hex-letter words without digits must not be masked")
	}
	if database.LogFingerprint("agent-x:api", "error", "boom") == database.LogFingerprint("agent-x:worker", "error", "boom") {
		t.Error("the same message from another service is another pattern")
	}
	if database.LogFingerprint("agent-x:api", "error", "boom") == database.LogFingerprint("agent-x:api", "warn", "boom") {
		t.Error("the same message at another level is another pattern")
	}
}

// Rows from before the masking must group with new ones, once, and only the
// levels the logs page groups are rewritten.
func TestMigrateV54_RekeysErrorFingerprintsOnce(t *testing.T) {
	openTestDB(t)
	repo := database.NewLogRepository()
	now := time.Now()
	rows := []*models.Log{
		{AgentID: "agent-x", ServiceName: "api", Level: models.LogLevelError, Message: "user 123 not found", Fingerprint: "legacy-1", CreatedAt: now},
		{ServiceID: "direct-1", Level: models.LogLevelWarn, Message: "retry 3 of 5", Fingerprint: "legacy-2", CreatedAt: now},
		{AgentID: "agent-x", ServiceName: "api", Level: models.LogLevelInfo, Message: "served 42 requests", Fingerprint: "legacy-3", CreatedAt: now},
		// Server-generated rows never had a fingerprint and stay out of patterns.
		{ServiceID: "uptime-1", Level: models.LogLevelError, Message: "Service down: 503", CreatedAt: now},
	}
	for _, row := range rows {
		if err := repo.Create(row); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	// The fresh DB already ran the migration (and set its marker) on an empty table.
	if _, err := database.DB.Exec(`DELETE FROM app_settings WHERE key = 'log_fingerprint_masked'`); err != nil {
		t.Fatal(err)
	}

	if err := database.MigrateV54ForTest(); err != nil {
		t.Fatalf("migrateV54: %v", err)
	}
	fingerprint := func(id int64) string {
		t.Helper()
		var fp string
		if err := database.DB.QueryRow(`SELECT COALESCE(fingerprint, '') FROM logs WHERE id = ?`, id).Scan(&fp); err != nil {
			t.Fatal(err)
		}
		return fp
	}
	want := map[int64]string{
		rows[0].ID: database.LogFingerprint("agent-x:api", "error", "user 123 not found"),
		rows[1].ID: database.LogFingerprint("direct-1", "warn", "retry 3 of 5"),
		rows[2].ID: "legacy-3",
		rows[3].ID: "",
	}
	for id, fp := range want {
		if got := fingerprint(id); got != fp {
			t.Errorf("row %d fingerprint = %q, want %q", id, got, fp)
		}
	}

	// The marker keeps later startups from walking the table again.
	if _, err := database.DB.Exec(`UPDATE logs SET fingerprint = 'touched' WHERE id = ?`, rows[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := database.MigrateV54ForTest(); err != nil {
		t.Fatalf("migrateV54 second run: %v", err)
	}
	if got := fingerprint(rows[0].ID); got != "touched" {
		t.Errorf("second run rewrote fingerprint to %q", got)
	}
}

// A service with more rows than the histogram reads must lose its oldest
// buckets, not its newest — an empty right edge reads as logs having stopped.
func TestLogRepo_HistogramKeepsNewestPastCap(t *testing.T) {
	openTestDB(t)
	old := time.Now().Add(-3 * time.Hour).Truncate(time.Hour)
	if _, err := database.DB.Exec(`
		WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 100000)
		INSERT INTO logs (agent_id, service_name, level, message, source, created_at)
		SELECT 'agent-x', 'api', 'info', 'tick', 'otlp', ? FROM n`, old); err != nil {
		t.Fatalf("seed old rows: %v", err)
	}
	recent := time.Now().Truncate(time.Hour)
	if err := database.NewLogRepository().Create(&models.Log{
		AgentID: "agent-x", ServiceName: "api", Level: models.LogLevelError, Message: "latest", CreatedAt: recent,
	}); err != nil {
		t.Fatal(err)
	}

	buckets, err := database.NewLogRepository().Histogram(models.LogFilter{AgentID: "agent-x", ServiceName: "api"}, 60)
	if err != nil {
		t.Fatalf("Histogram: %v", err)
	}
	if len(buckets) == 0 {
		t.Fatal("no buckets")
	}
	last := buckets[len(buckets)-1]
	if !last.Time.Equal(recent) || last.Error != 1 {
		t.Fatalf("last bucket = %+v, want the newest row's bucket %s with 1 error", last, recent)
	}
	for i := 1; i < len(buckets); i++ {
		if !buckets[i-1].Time.Before(buckets[i].Time) {
			t.Fatalf("buckets out of order: %s then %s", buckets[i-1].Time, buckets[i].Time)
		}
	}
}
