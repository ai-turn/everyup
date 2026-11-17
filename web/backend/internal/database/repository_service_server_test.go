package database_test

import (
	"database/sql"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func storedServiceServerID(t *testing.T, id string) sql.NullString {
	t.Helper()
	var serverID sql.NullString
	if err := database.DB.QueryRow(`SELECT server_id FROM services WHERE id = ?`, id).Scan(&serverID); err != nil {
		t.Fatalf("read server_id of %s: %v", id, err)
	}
	return serverID
}

func serverCount(t *testing.T, where string, args ...any) int {
	t.Helper()
	var count int
	if err := database.DB.QueryRow(`SELECT COUNT(*) FROM servers WHERE `+where, args...).Scan(&count); err != nil {
		t.Fatalf("count servers: %v", err)
	}
	return count
}

func TestServiceCreateWithoutServerIDJoinsServer(t *testing.T) {
	openTestDB(t)
	repo := database.NewServiceRepository()
	now := time.Now()

	if err := repo.Create(&models.Service{ID: "from-config", Name: "from-config", Type: models.ServiceTypeTCP,
		IsActive: true, Interval: 60, Timeout: 30, CreatedAt: now, UpdatedAt: now}); err != nil {
		t.Fatalf("create tcp monitor: %v", err)
	}
	if serverID := storedServiceServerID(t, "from-config"); !serverID.Valid {
		t.Fatal("tcp monitor created without a server id must join a server")
	}
	if got := serverCount(t, "name = ?", "from-config"); got != 1 {
		t.Fatalf("servers named from-config: got %d, want 1", got)
	}

	before := serverCount(t, "1 = 1")
	if err := repo.Create(&models.Service{ID: "app-logs", Name: "app-logs", Type: models.ServiceTypeLog,
		IsActive: true, CreatedAt: now, UpdatedAt: now}); err != nil {
		t.Fatalf("create log service: %v", err)
	}
	if serverID := storedServiceServerID(t, "app-logs"); serverID.Valid {
		t.Fatalf("log service must keep a NULL server_id, got %q", serverID.String)
	}
	if after := serverCount(t, "1 = 1"); after != before {
		t.Fatalf("log service created a server: %d -> %d", before, after)
	}
}
