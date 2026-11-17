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
	if got, err := nextFreeServerNameTx(tx, "db", ""); err != nil || got != "db (3)" {
		t.Fatalf("ungrouped = (%q, %v), want db (3)", got, err)
	}
	if got, err := nextFreeServerNameTx(tx, "db", "P"); err != nil || got != "db" {
		t.Fatalf("group P = (%q, %v), want db", got, err)
	}
}
