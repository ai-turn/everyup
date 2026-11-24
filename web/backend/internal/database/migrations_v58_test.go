package database

import (
	"database/sql"
	"testing"
)

func setupV58(t *testing.T, statements ...string) {
	t.Helper()
	if err := Connect(":memory:"); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { Close() })
	beforeV61(t)
	for _, statement := range statements {
		if _, err := DB.Exec(statement); err != nil {
			t.Fatalf("seed: %v\n%s", err, statement)
		}
	}
	if err := migrateV58(); err != nil {
		t.Fatalf("migrateV58: %v", err)
	}
}

const v58Project = `INSERT INTO projects (id, name, created_at, updated_at) VALUES ('P', 'Prod', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`

func v58Host(id, name, project string) string {
	return `INSERT INTO hosts (id, name, collector_type, project_id) VALUES ('` + id + `', '` + name + `', 'otel-collector', ` + project + `)`
}

func v58App(id, name, project string) string {
	return `INSERT INTO observed_services (id, name, project_id, created_at, updated_at) VALUES ('` + id + `', '` + name + `', ` + project + `, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
}

func v58Monitor(id, name, kind, project string) string {
	return `INSERT INTO services (id, name, type, project_id) VALUES ('` + id + `', '` + name + `', '` + kind + `', ` + project + `)`
}

func v58ServerID(t *testing.T, table, id string) sql.NullString {
	t.Helper()
	var serverID sql.NullString
	if err := DB.QueryRow(`SELECT server_id FROM `+table+` WHERE id = ?`, id).Scan(&serverID); err != nil {
		t.Fatalf("read %s.server_id of %s: %v", table, id, err)
	}
	return serverID
}

func v58ServerCount(t *testing.T) int {
	t.Helper()
	var n int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM servers`).Scan(&n); err != nil {
		t.Fatalf("count servers: %v", err)
	}
	return n
}

var v58Grouped = []string{
	v58Project,
	v58Host("h1", "web-01", "'P'"),
	v58App("a1", " Web-01 ", "'P'"),
	v58Monitor("m1", "web-01", "http", "'P'"),
}

func TestMigrateV58GroupsTargetsWithSameNameAndProject(t *testing.T) {
	setupV58(t, v58Grouped...)

	if n := v58ServerCount(t); n != 1 {
		t.Fatalf("servers = %d, want 1", n)
	}
	var id, name string
	var project sql.NullString
	if err := DB.QueryRow(`SELECT id, name, project_id FROM servers`).Scan(&id, &name, &project); err != nil {
		t.Fatalf("read server: %v", err)
	}
	if name != "web-01" || project.String != "P" {
		t.Fatalf("server = (%q, %v), want (web-01, P)", name, project)
	}
	for _, target := range [][2]string{{"hosts", "h1"}, {"observed_services", "a1"}, {"services", "m1"}} {
		if got := v58ServerID(t, target[0], target[1]); got.String != id {
			t.Errorf("%s %s server_id = %v, want %s", target[0], target[1], got, id)
		}
	}
}

func TestMigrateV58KeepsDifferentGroupsApart(t *testing.T) {
	setupV58(t, v58Project, v58App("a1", "api", "'P'"), v58App("a2", "api", "NULL"))

	rows, err := DB.Query(`SELECT project_id FROM servers ORDER BY project_id`)
	if err != nil {
		t.Fatalf("read servers: %v", err)
	}
	var projects []sql.NullString
	for rows.Next() {
		var p sql.NullString
		if err := rows.Scan(&p); err != nil {
			t.Fatalf("scan: %v", err)
		}
		projects = append(projects, p)
	}
	rows.Close()
	if len(projects) != 2 || projects[0].Valid || projects[1].String != "P" {
		t.Fatalf("server projects = %v, want [NULL P]", projects)
	}
	if v58ServerID(t, "observed_services", "a1") == v58ServerID(t, "observed_services", "a2") {
		t.Fatal("apps in different groups share a server")
	}
}

func TestMigrateV58SuffixesSecondInfrastructureResource(t *testing.T) {
	setupV58(t, v58Project,
		v58Host("h1", "db", "'P'"),
		v58Host("h2", "db", "'P'"),
		v58App("a1", "db (2)", "'P'"),
	)

	if n := v58ServerCount(t); n != 2 {
		t.Fatalf("servers = %d, want 2", n)
	}
	h1, h2 := v58ServerID(t, "hosts", "h1"), v58ServerID(t, "hosts", "h2")
	if h1 == h2 {
		t.Fatal("two infrastructure resources share a server")
	}
	var suffixed string
	if err := DB.QueryRow(`SELECT id FROM servers WHERE name = 'db (2)' AND project_id = 'P'`).Scan(&suffixed); err != nil {
		t.Fatalf("read db (2) server: %v", err)
	}
	if got := v58ServerID(t, "observed_services", "a1"); got.String != suffixed {
		t.Fatalf("app server_id = %v, want db (2) server %s", got, suffixed)
	}
}

func TestMigrateV58IgnoresDanglingProject(t *testing.T) {
	setupV58(t, v58Monitor("m1", "site", "http", "'gone'"))

	var project sql.NullString
	if err := DB.QueryRow(`SELECT project_id FROM servers`).Scan(&project); err != nil {
		t.Fatalf("read server: %v", err)
	}
	if project.Valid {
		t.Fatalf("server project_id = %q, want NULL", project.String)
	}
}

func TestMigrateV58LeavesOtherRowsAlone(t *testing.T) {
	setupV58(t,
		v58Monitor("l1", "logs", "log", "NULL"),
		`INSERT INTO hosts (id, name, collector_type) VALUES ('h1', 'old', '')`,
	)

	if got := v58ServerID(t, "services", "l1"); got.Valid {
		t.Errorf("log service server_id = %q, want NULL", got.String)
	}
	if got := v58ServerID(t, "hosts", "h1"); got.Valid {
		t.Errorf("non-collector host server_id = %q, want NULL", got.String)
	}
	if n := v58ServerCount(t); n != 0 {
		t.Fatalf("servers = %d, want 0", n)
	}
}

func TestMigrateV58IsIdempotent(t *testing.T) {
	setupV58(t, v58Grouped...)
	before := []sql.NullString{v58ServerID(t, "hosts", "h1"), v58ServerID(t, "observed_services", "a1"), v58ServerID(t, "services", "m1")}

	for i := 0; i < 2; i++ {
		if err := migrateV58(); err != nil {
			t.Fatalf("migrateV58 rerun %d: %v", i, err)
		}
	}

	if n := v58ServerCount(t); n != 1 {
		t.Fatalf("servers = %d, want 1", n)
	}
	after := []sql.NullString{v58ServerID(t, "hosts", "h1"), v58ServerID(t, "observed_services", "a1"), v58ServerID(t, "services", "m1")}
	for i := range before {
		if before[i] != after[i] {
			t.Errorf("target %d server_id changed: %v -> %v", i, before[i], after[i])
		}
	}
}

func TestMigrateV58LeavesNoDirectTargetWithoutServer(t *testing.T) {
	setupV58(t, v58Project,
		v58Host("h1", "db", "'P'"),
		v58Host("h2", "cache", "NULL"),
		v58App("a1", "checkout", "'P'"),
		v58App("a2", "db", "'P'"),
		v58Monitor("m1", "site", "http", "NULL"),
		v58Monitor("m2", "redis", "tcp", "'gone'"),
	)

	var orphans int
	if err := DB.QueryRow(`SELECT
		(SELECT COUNT(*) FROM services WHERE type IN ('http','tcp') AND server_id IS NULL) +
		(SELECT COUNT(*) FROM observed_services WHERE server_id IS NULL) +
		(SELECT COUNT(*) FROM hosts WHERE collector_type = 'otel-collector' AND server_id IS NULL)`).Scan(&orphans); err != nil {
		t.Fatalf("count orphans: %v", err)
	}
	if orphans != 0 {
		t.Fatalf("direct targets without a server = %d, want 0", orphans)
	}
}

func TestMigrateV58UpgradesAPreV58Database(t *testing.T) {
	originalDB := DB
	db, err := sql.Open("sqlite", "file::memory:?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	DB = db
	t.Cleanup(func() { DB = originalDB; db.Close() })

	// V57 shape of the tables migrateV58 touches, with their real column definitions.
	for _, statement := range []string{
		`CREATE TABLE projects (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE services (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'http',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			project_id TEXT
		)`,
		`CREATE TABLE observed_services (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, project_id TEXT,
			created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
			FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
		)`,
		`CREATE TABLE hosts (
			id TEXT PRIMARY KEY, name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			project_id TEXT, collector_type TEXT NOT NULL DEFAULT ''
		)`,
		`INSERT INTO projects VALUES ('P', 'Production', '', '2026-01-01 00:00:00', '2026-01-01 00:00:00')`,
		`INSERT INTO hosts (id, name, collector_type, project_id, created_at, updated_at) VALUES
			('h1', 'web-01', 'otel-collector', 'P', '2026-01-02 00:00:00', '2026-01-02 00:00:00'),
			('h2', 'legacy-host', '', NULL, '2026-01-03 00:00:00', '2026-01-03 00:00:00')`,
		// observed_services.project_id has a foreign key, so a dangling group can only
		// exist in a DB written with foreign keys off; seed it that way.
		`PRAGMA foreign_keys = OFF`,
		`INSERT INTO observed_services (id, name, project_id, created_at, updated_at) VALUES
			('o1', 'web-01', 'P', '2026-01-04 00:00:00', '2026-01-04 00:00:00'),
			('o2', 'worker', 'gone', '2026-01-05 00:00:00', '2026-01-05 00:00:00')`,
		`PRAGMA foreign_keys = ON`,
		`INSERT INTO services (id, name, type, project_id, created_at, updated_at) VALUES
			('s1', 'web-01', 'http', 'P', '2026-01-06 00:00:00', '2026-01-06 00:00:00'),
			('s2', 'public-dns', 'tcp', NULL, '2026-01-07 00:00:00', '2026-01-07 00:00:00'),
			('s3', 'old-log', 'log', NULL, '2026-01-08 00:00:00', '2026-01-08 00:00:00')`,
	} {
		if _, err := DB.Exec(statement); err != nil {
			t.Fatalf("seed: %v\n%s", err, statement)
		}
	}
	var fk int
	if err := DB.QueryRow(`PRAGMA foreign_keys`).Scan(&fk); err != nil || fk != 1 {
		t.Fatalf("foreign_keys = %d (%v), want 1", fk, err)
	}

	if err := migrateV58(); err != nil {
		t.Fatalf("migrateV58: %v", err)
	}

	serverID := func(name string, wantProject sql.NullString) string {
		t.Helper()
		var id string
		var project sql.NullString
		if err := DB.QueryRow(`SELECT id, project_id FROM servers WHERE name = ?`, name).Scan(&id, &project); err != nil {
			t.Fatalf("read server %s: %v", name, err)
		}
		if project != wantProject {
			t.Fatalf("server %s project_id = %v, want %v", name, project, wantProject)
		}
		return id
	}
	if n := v58ServerCount(t); n != 3 {
		t.Fatalf("servers = %d, want 3", n)
	}
	web := serverID("web-01", sql.NullString{String: "P", Valid: true})
	worker := serverID("worker", sql.NullString{})
	dns := serverID("public-dns", sql.NullString{})

	targets := []struct {
		table, id, name, createdAt string
		server                     sql.NullString
	}{
		{"hosts", "h1", "web-01", "2026-01-02 00:00:00", sql.NullString{String: web, Valid: true}},
		{"hosts", "h2", "legacy-host", "2026-01-03 00:00:00", sql.NullString{}},
		{"observed_services", "o1", "web-01", "2026-01-04 00:00:00", sql.NullString{String: web, Valid: true}},
		{"observed_services", "o2", "worker", "2026-01-05 00:00:00", sql.NullString{String: worker, Valid: true}},
		{"services", "s1", "web-01", "2026-01-06 00:00:00", sql.NullString{String: web, Valid: true}},
		{"services", "s2", "public-dns", "2026-01-07 00:00:00", sql.NullString{String: dns, Valid: true}},
		{"services", "s3", "old-log", "2026-01-08 00:00:00", sql.NullString{}},
	}
	checkTargets := func(run string) {
		t.Helper()
		for _, target := range targets {
			if got := v58ServerID(t, target.table, target.id); got != target.server {
				t.Errorf("%s: %s %s server_id = %v, want %v", run, target.table, target.id, got, target.server)
			}
		}
	}
	checkTargets("first run")

	for _, target := range targets {
		var unchanged bool
		if err := DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM `+target.table+` WHERE id = ? AND name = ? AND created_at = ?)`,
			target.id, target.name, target.createdAt).Scan(&unchanged); err != nil {
			t.Fatalf("read %s %s: %v", target.table, target.id, err)
		}
		if !unchanged {
			t.Errorf("%s %s name or created_at changed", target.table, target.id)
		}
	}
	for table, want := range map[string]int{"hosts": 2, "observed_services": 2, "services": 3} {
		var n int
		if err := DB.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		if n != want {
			t.Errorf("%s rows = %d, want %d", table, n, want)
		}
	}

	if err := migrateV58(); err != nil {
		t.Fatalf("migrateV58 second run: %v", err)
	}
	if n := v58ServerCount(t); n != 3 {
		t.Fatalf("servers after second run = %d, want 3", n)
	}
	checkTargets("second run")

	for _, index := range []string{"idx_servers_name_group", "idx_hosts_server_id"} {
		var exists bool
		if err := DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?)`, index).Scan(&exists); err != nil {
			t.Fatalf("read index %s: %v", index, err)
		}
		if !exists {
			t.Errorf("index %s missing", index)
		}
	}
}

func TestNextFreeServerNameSkipsTakenSuffix(t *testing.T) {
	setupV58(t,
		v58Project,
		`INSERT INTO servers (id, name, created_at, updated_at) VALUES ('s1', 'db', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		`INSERT INTO servers (id, name, created_at, updated_at) VALUES ('s2', 'db (2)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
	)

	tx, err := DB.Begin()
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback()
	ungrouped, group := "", "P"
	if got, err := nextFreeServerNameTx(tx, "db", &ungrouped); err != nil || got != "db (3)" {
		t.Fatalf("ungrouped = (%q, %v), want db (3)", got, err)
	}
	if got, err := nextFreeServerNameTx(tx, "db", &group); err != nil || got != "db" {
		t.Fatalf("group P = (%q, %v), want db", got, err)
	}
	// Since migrateV61 names are unique overall.
	if got, err := nextFreeServerNameTx(tx, "DB", nil); err != nil || got != "DB (3)" {
		t.Fatalf("overall = (%q, %v), want DB (3)", got, err)
	}
}

// beforeV61 turns a freshly migrated database back into one that has not reached migrateV61, where
// server names were unique within a group: migrateV58 and migrateV59 run on such databases first.
func beforeV61(t *testing.T) {
	t.Helper()
	for _, statement := range []string{
		`DROP INDEX IF EXISTS idx_servers_name`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_name_group ON servers(lower(trim(name)), COALESCE(project_id, ''))`,
	} {
		if _, err := DB.Exec(statement); err != nil {
			t.Fatalf("before v61: %v", err)
		}
	}
}
