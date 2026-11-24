package database

import (
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// setupV59 seeds data after the startup migrations ran on an empty database, then runs
// migrateV59 again, the way an upgrade meets existing Docker environments.
func setupV59(t *testing.T, statements ...string) {
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
	if err := migrateV59(); err != nil {
		t.Fatalf("migrateV59: %v", err)
	}
}

func v59Agent(id, name, project, status, createdAt string) string {
	return `INSERT INTO agents (id, name, version, api_key_hash, status, project_id, last_seen_at, created_at, updated_at)
		VALUES ('` + id + `', '` + name + `', '0.3.0', 'hash-` + id + `', '` + status + `', ` + project + `, CURRENT_TIMESTAMP, '` + createdAt + `', CURRENT_TIMESTAMP)`
}

func v59Server(id, name, project string) string {
	return `INSERT INTO servers (id, name, project_id, created_at, updated_at) VALUES ('` + id + `', '` + name + `', ` + project + `, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
}

const (
	v59ProjectP = `INSERT INTO projects (id, name, created_at, updated_at) VALUES ('P', 'Prod', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
	v59ProjectQ = `INSERT INTO projects (id, name, created_at, updated_at) VALUES ('Q', 'Stage', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
)

// Environments in two groups and none, a name taken by a direct server, two environments with
// one name, a group that no longer exists, and a deactivated environment.
var v59Mixed = []string{
	v59ProjectP,
	v59ProjectQ,
	v59Server("direct-prod", "prod-server", "'P'"),
	v59Agent("agent_a", "prod-server", "'P'", "active", "2026-01-01 00:00:00"),
	v59Agent("agent_b", "prod-server", "'Q'", "active", "2026-01-02 00:00:00"),
	v59Agent("agent_c", "edge", "NULL", "active", "2026-01-03 00:00:00"),
	v59Agent("agent_d", " EDGE ", "NULL", "active", "2026-01-04 00:00:00"),
	v59Agent("agent_e", "orphan", "'gone'", "active", "2026-01-05 00:00:00"),
	v59Agent("agent_f", "retired", "'P'", "inactive", "2026-01-06 00:00:00"),
}

type v59Row struct {
	name    string
	project sql.NullString
}

func v59ServerRow(t *testing.T, id string) (v59Row, bool) {
	t.Helper()
	var row v59Row
	err := DB.QueryRow(`SELECT name, project_id FROM servers WHERE id = ?`, id).Scan(&row.name, &row.project)
	if errors.Is(err, sql.ErrNoRows) {
		return row, false
	}
	if err != nil {
		t.Fatalf("read server %s: %v", id, err)
	}
	return row, true
}

func v59AgentServer(t *testing.T, id string) sql.NullString {
	t.Helper()
	var serverID sql.NullString
	if err := DB.QueryRow(`SELECT server_id FROM agents WHERE id = ?`, id).Scan(&serverID); err != nil {
		t.Fatalf("read agents.server_id of %s: %v", id, err)
	}
	return serverID
}

func TestMigrateV59MakesEachActiveEnvironmentAServer(t *testing.T) {
	setupV59(t, v59Mixed...)

	want := map[string]v59Row{
		// A direct server already has the name in this group: a suffix, never a merge.
		"agent_a": {"prod-server (2)", sql.NullString{String: "P", Valid: true}},
		// Same name in another group is free.
		"agent_b": {"prod-server", sql.NullString{String: "Q", Valid: true}},
		// Two environments with one name: the older keeps it.
		"agent_c": {"edge", sql.NullString{}},
		"agent_d": {"EDGE (2)", sql.NullString{}},
		// A deleted group leaves the server ungrouped, and the environment with it.
		"agent_e": {"orphan", sql.NullString{}},
	}
	for agentID, expected := range want {
		row, ok := v59ServerRow(t, agentID)
		if !ok {
			t.Fatalf("no server with the id of %s", agentID)
		}
		if row != expected {
			t.Errorf("server %s = %+v, want %+v", agentID, row, expected)
		}
		if got := v59AgentServer(t, agentID); got.String != agentID {
			t.Errorf("agents.server_id of %s = %v, want %s", agentID, got, agentID)
		}
	}
	var orphanProject sql.NullString
	if err := DB.QueryRow(`SELECT project_id FROM agents WHERE id = 'agent_e'`).Scan(&orphanProject); err != nil || orphanProject.Valid {
		t.Errorf("agent_e project = %v (%v), want NULL like its server", orphanProject, err)
	}

	if _, ok := v59ServerRow(t, "agent_f"); ok {
		t.Error("a deactivated environment got a server")
	}
	if got := v59AgentServer(t, "agent_f"); got.Valid {
		t.Errorf("agents.server_id of agent_f = %v, want NULL", got)
	}
	// The direct server is untouched.
	if row, _ := v59ServerRow(t, "direct-prod"); row.name != "prod-server" || row.project.String != "P" {
		t.Errorf("direct server = %+v, want prod-server in P", row)
	}
}

func TestMigrateV59IsSafeToRerun(t *testing.T) {
	setupV59(t, v59Mixed...)
	before := v58ServerCount(t)
	for i := 0; i < 2; i++ {
		if err := migrateV59(); err != nil {
			t.Fatalf("rerun %d: %v", i, err)
		}
	}
	if after := v58ServerCount(t); after != before {
		t.Fatalf("servers %d -> %d after rerun, want unchanged", before, after)
	}
	if row, _ := v59ServerRow(t, "agent_d"); row.name != "EDGE (2)" {
		t.Fatalf("rerun renamed agent_d's server to %q", row.name)
	}
}

func TestMigrateV59KeepsCollectionKeys(t *testing.T) {
	setupV59(t,
		v59Agent("agent_a", "prod-server", "NULL", "active", "2026-01-01 00:00:00"),
		`INSERT INTO agent_services (agent_id, key, name, check_type, endpoint, healthy, observed_at) VALUES ('agent_a', 'shop:api', 'api', 'http', 'http://api', 1, CURRENT_TIMESTAMP)`,
		`INSERT INTO agent_events (agent_id, time, type, target_key) VALUES ('agent_a', CURRENT_TIMESTAMP, 'deploy', 'shop:api')`,
	)
	var services, metrics int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM agent_services WHERE agent_id = 'agent_a'`).Scan(&services); err != nil {
		t.Fatal(err)
	}
	if err := DB.QueryRow(`SELECT COUNT(*) FROM agent_events WHERE agent_id = 'agent_a'`).Scan(&metrics); err != nil {
		t.Fatal(err)
	}
	if services != 1 || metrics != 1 {
		t.Fatalf("collection rows keyed by the agent id: services=%d events=%d, want 1 and 1", services, metrics)
	}
}

func TestDockerServersStayOutOfDirectServerRules(t *testing.T) {
	setupV59(t, v59ProjectP, v59Agent("agent_a", "web-01", "'P'", "active", "2026-01-01 00:00:00"))
	repo := NewServerRepository()

	// Hidden from the server list until the screens show Docker servers.
	servers, err := repo.GetAll(false)
	if err != nil {
		t.Fatal(err)
	}
	if len(servers) != 0 {
		t.Fatalf("GetAll = %+v, want no Docker server", servers)
	}
	withDocker, err := repo.GetAll(true)
	if err != nil || len(withDocker) != 1 || withDocker[0].ID != "agent_a" {
		t.Fatalf("GetAll(includeDocker) = %+v (%v), want the Docker server", withDocker, err)
	}

	// A direct target named like the environment never joins its server.
	serverID, err := repo.ResolveForTarget(ServerTargetApp, "", "web-01")
	if err != nil {
		t.Fatal(err)
	}
	if serverID == "agent_a" {
		t.Fatal("a direct app joined the Docker server by name")
	}
	if row, _ := v59ServerRow(t, serverID); row.name != "web-01 (2)" {
		t.Fatalf("direct server name = %q, want web-01 (2)", row.name)
	}

	// Merging with a Docker server is the confirmed same-host merge (server_merge_docker_test.go).
}

func TestDeactivatingADockerEnvironmentRemovesItsServer(t *testing.T) {
	setupV59(t, v59Agent("agent_a", "prod-server", "NULL", "active", "2026-01-01 00:00:00"))

	// Deactivating removes the server when nothing else is on it.
	agents := &AgentRepository{}
	if err := agents.DeactivateAgent("agent_a"); err != nil {
		t.Fatal(err)
	}
	if _, ok := v59ServerRow(t, "agent_a"); ok {
		t.Fatal("the server of a deactivated environment stayed")
	}
}

func TestNewEnvironmentGetsAServer(t *testing.T) {
	setupV59(t, v59Server("direct", "build", "NULL"))
	agents := &AgentRepository{}
	agent := models.Agent{ID: "agent_new", Name: "build", Profile: models.DefaultAgentProfile()}
	if err := agents.CreateAgentWithJoinCode(&agent, "hash", "enc", "join", time.Now().Add(time.Minute), "", ""); err != nil {
		t.Fatal(err)
	}
	if row, ok := v59ServerRow(t, "agent_new"); !ok || row.name != "build (2)" {
		t.Fatalf("server = %+v (%v), want build (2)", row, ok)
	}
	if got := v59AgentServer(t, "agent_new"); got.String != "agent_new" {
		t.Fatalf("agents.server_id = %v, want agent_new", got)
	}
}
