package database

import (
	"database/sql"
	"testing"
)

// A database from before migrateV61: names unique within a group, servers, a Docker Collector and
// targets in groups. Rows are listed oldest first per name.
func setupV61(t *testing.T) {
	t.Helper()
	if err := Connect(":memory:"); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { Close() })
	beforeV61(t)
	server := func(id, name, project, createdAt string) string {
		return `INSERT INTO servers (id, name, project_id, created_at, updated_at) VALUES ('` + id + `', '` + name + `', ` + project + `, '` + createdAt + `', '` + createdAt + `')`
	}
	for _, statement := range []string{
		`INSERT INTO projects (id, name, created_at, updated_at) VALUES ('P', 'Prod', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		`INSERT INTO projects (id, name, created_at, updated_at) VALUES ('S', 'Staging', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		// A group without servers.
		`INSERT INTO projects (id, name, created_at, updated_at) VALUES ('E', 'Empty', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		// "api" in three places: the oldest keeps it.
		server("api-prod", "api", "'P'", "2026-01-01 00:00:00"),
		// Its group suffix is taken by an ungrouped server, so it also gets " (2)".
		server("api-staging", " API ", "'S'", "2026-01-02 00:00:00"),
		// An ungrouped duplicate has no group name to add.
		server("api-none", "api", "NULL", "2026-01-03 00:00:00"),
		server("api-staging-name", "api (staging)", "NULL", "2026-01-04 00:00:00"),
		// A unique name in a group stays.
		server("web", "web", "'S'", "2026-01-05 00:00:00"),
		// A server whose group row is gone (written while foreign keys were off).
		server("db-prod", "db", "'P'", "2026-01-06 00:00:00"),
		`PRAGMA foreign_keys = OFF`,
		server("db-gone", "DB", "'gone'", "2026-01-07 00:00:00"),
		`PRAGMA foreign_keys = ON`,
		v59Agent("agent_a", "web", "'S'", "active", "2026-01-08 00:00:00"),
		v58Monitor("m1", "Storefront", "http", "'P'"),
		v58App("o1", "orders", "'S'"),
		v58Host("h1", "db", "'P'"),
	} {
		if _, err := DB.Exec(statement); err != nil {
			t.Fatalf("seed: %v\n%s", err, statement)
		}
	}
}

func v61Names(t *testing.T) map[string]string {
	t.Helper()
	rows, err := DB.Query(`SELECT id, name FROM servers`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	names := map[string]string{}
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			t.Fatal(err)
		}
		names[id] = name
	}
	return names
}

func TestMigrateV61MakesServerNamesUniqueWithoutMerging(t *testing.T) {
	setupV61(t)
	if err := migrateV61(); err != nil {
		t.Fatalf("migrateV61: %v", err)
	}

	want := map[string]string{
		"api-prod":         "api",
		"api-staging":      "API (Staging) (2)",
		"api-none":         "api (2)",
		"api-staging-name": "api (staging)",
		"web":              "web",
		"db-prod":          "db",
		"db-gone":          "DB (2)",
	}
	got := v61Names(t)
	for id, name := range want {
		if got[id] != name {
			t.Errorf("server %s = %q, want %q", id, got[id], name)
		}
	}
	// migrateV59 is not part of this fixture, so no other server appeared; none was merged away.
	if len(got) != len(want) {
		t.Errorf("servers = %v, want exactly %v", got, want)
	}

	// Membership is gone everywhere.
	for _, table := range []string{"servers", "agents", "services", "observed_services", "hosts"} {
		var grouped int
		if err := DB.QueryRow(`SELECT COUNT(*) FROM ` + table + ` WHERE project_id IS NOT NULL`).Scan(&grouped); err != nil {
			t.Fatal(err)
		}
		if grouped != 0 {
			t.Errorf("%s has %d rows in a group", table, grouped)
		}
	}
	// The retired table stays for a rollback; nothing reads it.
	var groups int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM projects`).Scan(&groups); err != nil || groups != 3 {
		t.Errorf("projects = %d (%v), want the 3 rows kept", groups, err)
	}

	// Names are unique overall now, ignoring case and surrounding spaces.
	repo := NewServerRepository()
	if _, err := DB.Exec(`INSERT INTO servers (id, name, created_at, updated_at) VALUES ('x', ' WEB ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); serverNameError(err) != ErrServerNameTaken {
		t.Errorf("insert of a taken name = %v, want ErrServerNameTaken", err)
	}
	server, err := repo.GetByID("api-none")
	if err != nil || server == nil {
		t.Fatalf("GetByID: %v %v", server, err)
	}
	server.Name = "Web"
	if err := repo.Update(server); err != ErrServerNameTaken {
		t.Errorf("rename to a taken name = %v, want ErrServerNameTaken", err)
	}
	var groupIndex bool
	if err := DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name = 'idx_servers_name_group')`).Scan(&groupIndex); err != nil || groupIndex {
		t.Errorf("the per-group index is still there (%v)", err)
	}
}

// migrateV58, V59 and V61 run on every start. The second run changes nothing, and migrateV58 does
// not bring the per-group index back.
func TestMigrateV61IsIdempotent(t *testing.T) {
	setupV61(t)
	if err := migrateV61(); err != nil {
		t.Fatal(err)
	}
	first := v61Names(t)
	var updated sql.NullString
	if err := DB.QueryRow(`SELECT updated_at FROM servers WHERE id = 'api-none'`).Scan(&updated); err != nil {
		t.Fatal(err)
	}
	// The migrations that write server names run again in their order.
	for _, run := range []func() error{migrateV58, migrateV59, migrateV61} {
		if err := run(); err != nil {
			t.Fatalf("migrate again: %v", err)
		}
	}
	second := v61Names(t)
	for id, name := range first {
		if second[id] != name {
			t.Errorf("server %s renamed again: %q -> %q", id, name, second[id])
		}
	}
	var again sql.NullString
	if err := DB.QueryRow(`SELECT updated_at FROM servers WHERE id = 'api-none'`).Scan(&again); err != nil || again != updated {
		t.Errorf("updated_at changed on rerun: %v -> %v (%v)", updated, again, err)
	}
	var groupIndex bool
	if err := DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name = 'idx_servers_name_group')`).Scan(&groupIndex); err != nil || groupIndex {
		t.Errorf("migrate brought the per-group index back (%v)", err)
	}
}

// A database without groups or duplicates (a fresh install) is left as it is.
func TestMigrateV61KeepsUngroupedUniqueServers(t *testing.T) {
	if err := Connect(":memory:"); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { Close() })
	if _, err := DB.Exec(`INSERT INTO servers (id, name, created_at, updated_at) VALUES ('a', 'a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), ('b', 'b', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	if err := migrateV61(); err != nil {
		t.Fatal(err)
	}
	if got := v61Names(t); got["a"] != "a" || got["b"] != "b" || len(got) != 2 {
		t.Errorf("servers = %v, want a and b unchanged", got)
	}
}
