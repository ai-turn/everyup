package database

import (
	"errors"
	"testing"
)

// Same-host merge (ADR 0012, stage 3): a Docker server merges into a direct server like any other
// server, keeping its Docker Collector id, while a server keeps at most one Docker Collector and one
// source of host metrics.

func mergeFixture(t *testing.T, profile string) *ServerRepository {
	t.Helper()
	setupV59(t, v59ProjectP, v59ProjectQ,
		v59Server("direct", "prod-server", "'P'"),
		v59Agent("agent_a", "prod-server", "'Q'", "active", "2026-01-01 00:00:00"),
		`INSERT INTO services (id, name, type, server_id) VALUES ('m1', 'Storefront', 'http', 'direct')`,
	)
	if _, err := DB.Exec(`UPDATE agents SET profile_kind = 'custom', profile_capabilities = ? WHERE id = 'agent_a'`, profile); err != nil {
		t.Fatal(err)
	}
	return NewServerRepository()
}

func agentProfileCapabilities(t *testing.T, id string) string {
	t.Helper()
	var capabilities string
	if err := DB.QueryRow(`SELECT profile_capabilities FROM agents WHERE id = ?`, id).Scan(&capabilities); err != nil {
		t.Fatal(err)
	}
	return capabilities
}

func TestMergeMovesTheDockerCollectorIntoTheTargetServer(t *testing.T) {
	repo := mergeFixture(t, `["uptime","logs"]`)
	// The Docker server (agent_a, group Q) merges into the direct server (group P).
	if err := repo.Merge("agent_a", "direct", ""); err != nil {
		t.Fatalf("Merge: %v", err)
	}
	if got := v59AgentServer(t, "agent_a"); got.String != "direct" {
		t.Fatalf("agents.server_id = %v, want direct", got)
	}
	var project string
	if err := DB.QueryRow(`SELECT COALESCE(project_id, '') FROM agents WHERE id = 'agent_a'`).Scan(&project); err != nil {
		t.Fatal(err)
	}
	if project != "P" {
		t.Fatalf("Docker Collector group = %q, want the target's group P", project)
	}
	if _, ok := v59ServerRow(t, "agent_a"); ok {
		t.Fatal("the merged Docker server still exists")
	}
	if has, err := repo.HasDocker("direct"); err != nil || !has {
		t.Fatalf("HasDocker(direct) = %v, %v, want true", has, err)
	}
	if got := v58ServerID(t, "services", "m1"); got.String != "direct" {
		t.Fatalf("monitor server = %v, want direct", got)
	}
}

func TestMergeIntoADockerServerKeepsItsCollector(t *testing.T) {
	repo := mergeFixture(t, `["uptime","logs"]`)
	if err := repo.Merge("direct", "agent_a", ""); err != nil {
		t.Fatalf("Merge: %v", err)
	}
	if got := v59AgentServer(t, "agent_a"); got.String != "agent_a" {
		t.Fatalf("agents.server_id = %v, want agent_a", got)
	}
	if got := v58ServerID(t, "services", "m1"); got.String != "agent_a" {
		t.Fatalf("monitor server = %v, want agent_a", got)
	}
}

func TestMergeRefusesTwoDockerCollectors(t *testing.T) {
	repo := mergeFixture(t, `["uptime"]`)
	if _, err := DB.Exec(v59Agent("agent_b", "prod-server", "'P'", "active", "2026-01-02 00:00:00")); err != nil {
		t.Fatal(err)
	}
	if err := migrateV59(); err != nil {
		t.Fatal(err)
	}
	if err := repo.Merge("agent_a", "agent_b", ""); !errors.Is(err, ErrServerHasTwoDocker) {
		t.Fatalf("Merge of two Docker servers = %v, want ErrServerHasTwoDocker", err)
	}
	if got := v59AgentServer(t, "agent_a"); got.String != "agent_a" {
		t.Fatalf("a refused merge moved the Docker Collector to %v", got)
	}
}

func TestMergeAsksForTheInfrastructureSourceWhenBothCollect(t *testing.T) {
	repo := mergeFixture(t, `["uptime","infrastructure"]`)
	if _, err := DB.Exec(`INSERT INTO hosts (id, name, collector_type, server_id, is_active) VALUES ('h1', 'prod-server', 'otel-collector', 'direct', 1)`); err != nil {
		t.Fatal(err)
	}
	if err := repo.Merge("agent_a", "direct", ""); !errors.Is(err, ErrInfrastructureSourceRequired) {
		t.Fatalf("Merge without a source = %v, want ErrInfrastructureSourceRequired", err)
	}
	if got := v59AgentServer(t, "agent_a"); got.String != "agent_a" {
		t.Fatalf("a refused merge moved the Docker Collector to %v", got)
	}

	// Keeping the Docker Collector stops the OpenTelemetry resource; its row (history) stays.
	if err := repo.Merge("agent_a", "direct", MergeInfrastructureDocker); err != nil {
		t.Fatalf("Merge keeping Docker: %v", err)
	}
	var active bool
	if err := DB.QueryRow(`SELECT is_active FROM hosts WHERE id = 'h1'`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active {
		t.Fatal("the OpenTelemetry resource still collects")
	}
	if got := agentProfileCapabilities(t, "agent_a"); got != `["uptime","infrastructure"]` {
		t.Fatalf("profile = %s, want it unchanged", got)
	}
}

func TestMergeKeepingOpenTelemetryRemovesInfrastructureFromTheProfile(t *testing.T) {
	repo := mergeFixture(t, `["uptime","infrastructure","logs"]`)
	if _, err := DB.Exec(`INSERT INTO hosts (id, name, collector_type, server_id, is_active) VALUES ('h1', 'prod-server', 'otel-collector', 'direct', 1)`); err != nil {
		t.Fatal(err)
	}
	if err := repo.Merge("agent_a", "direct", MergeInfrastructureOTel); err != nil {
		t.Fatalf("Merge keeping OpenTelemetry: %v", err)
	}
	if got := agentProfileCapabilities(t, "agent_a"); got != `["uptime","logs"]` {
		t.Fatalf("profile = %s, want infrastructure removed", got)
	}
	var active bool
	if err := DB.QueryRow(`SELECT is_active FROM hosts WHERE id = 'h1'`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if !active {
		t.Fatal("the OpenTelemetry resource was stopped")
	}
}

func TestMergeWithoutDockerHostMetricsNeedsNoSource(t *testing.T) {
	repo := mergeFixture(t, `["uptime","logs"]`)
	if _, err := DB.Exec(`INSERT INTO hosts (id, name, collector_type, server_id, is_active) VALUES ('h1', 'prod-server', 'otel-collector', 'direct', 1)`); err != nil {
		t.Fatal(err)
	}
	if err := repo.Merge("agent_a", "direct", ""); err != nil {
		t.Fatalf("Merge: %v", err)
	}
}

// Moving a target to another group merges same-name direct servers, but never a Docker server:
// that is the confirmed same-host merge.
func TestGroupMoveNeverMergesADockerServer(t *testing.T) {
	repo := mergeFixture(t, `["uptime"]`)
	if _, err := DB.Exec(`INSERT INTO services (id, name, type, server_id) VALUES ('m2', 'Docs', 'http', 'agent_a')`); err != nil {
		t.Fatal(err)
	}
	// The monitor's server is the Docker server; moving it into P meets the direct prod-server.
	if err := repo.SetProjectForTarget(ServerTargetMonitor, "m2", "P"); err != nil {
		t.Fatal(err)
	}
	if got := v58ServerID(t, "services", "m2"); got.String != "agent_a" {
		t.Fatalf("monitor moved to %v, want it to stay on the Docker server", got)
	}
	if row, ok := v59ServerRow(t, "agent_a"); !ok || row.name != "prod-server (2)" || row.project.String != "P" {
		t.Fatalf("Docker server = %+v (%v), want prod-server (2) in P", row, ok)
	}
}

// migrateV60 runs on every start: running it again keeps the recorded pairs.
func TestMigrateV60IsIdempotent(t *testing.T) {
	repo := mergeFixture(t, `["uptime"]`)
	if err := repo.DismissSameHost(SameHostDismissal{DockerServerID: "agent_a", ServerID: "direct"}); err != nil {
		t.Fatal(err)
	}
	if err := migrateV60(); err != nil {
		t.Fatal(err)
	}
	if pairs, err := repo.SameHostDismissals(); err != nil || len(pairs) != 1 {
		t.Fatalf("dismissals after migrateV60 again = %+v (%v), want the pair", pairs, err)
	}
	// Merging the Docker server away removes the pair with it.
	if err := repo.Merge("agent_a", "direct", ""); err != nil {
		t.Fatal(err)
	}
	if pairs, err := repo.SameHostDismissals(); err != nil || len(pairs) != 0 {
		t.Fatalf("dismissals after merge = %+v (%v), want none", pairs, err)
	}
}
