package database_test

import (
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestAgentJoinCodeCanOnlyBeConsumedOnce(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	now := time.Now().UTC().Truncate(time.Second)
	agent := models.Agent{
		ID:      "agent-join",
		Name:    "join-target",
		Profile: models.AgentProfile{Kind: models.AgentProfileBasic, Capabilities: []string{models.AgentCapabilityUptime, models.AgentCapabilityLogs}},
	}
	if err := repo.CreateAgentWithJoinCode(agent, "api-hash", "encrypted-api-key", "join-hash", now.Add(10*time.Minute)); err != nil {
		t.Fatalf("CreateAgentWithJoinCode: %v", err)
	}

	credential, err := repo.ConsumeJoinCode("join-hash", now)
	if err != nil {
		t.Fatalf("ConsumeJoinCode: %v", err)
	}
	if credential.AgentID != agent.ID || credential.AgentName != agent.Name || credential.KeyEnc != "encrypted-api-key" {
		t.Fatalf("unexpected credential: %+v", credential)
	}
	if credential.Profile.Kind != models.AgentProfileBasic || !credential.Profile.Has(models.AgentCapabilityLogs) || credential.Profile.Has(models.AgentCapabilityAPI) {
		t.Fatalf("unexpected credential profile: %+v", credential.Profile)
	}
	if _, err := repo.ConsumeJoinCode("join-hash", now); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("second ConsumeJoinCode error = %v, want sql.ErrNoRows", err)
	}
}

func TestAgentJoinCodeExpiryAndReplacement(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	now := time.Now().UTC().Truncate(time.Second)
	agent := models.Agent{ID: "agent-expiry", Name: "expiry-target"}
	if err := repo.CreateAgentWithJoinCode(agent, "api-hash-2", "encrypted-api-key", "expired-hash", now.Add(-time.Second)); err != nil {
		t.Fatalf("CreateAgentWithJoinCode: %v", err)
	}
	if _, err := repo.ConsumeJoinCode("expired-hash", now); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expired ConsumeJoinCode error = %v, want sql.ErrNoRows", err)
	}

	if err := repo.IssueJoinCode(agent.ID, "replacement-hash", now.Add(10*time.Minute)); err != nil {
		t.Fatalf("IssueJoinCode: %v", err)
	}
	if _, err := repo.ConsumeJoinCode("replacement-hash", now); err != nil {
		t.Fatalf("replacement ConsumeJoinCode: %v", err)
	}
	if err := repo.IssueJoinCode("missing-agent", "unused", now.Add(time.Minute)); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("missing agent IssueJoinCode error = %v, want sql.ErrNoRows", err)
	}
}

func TestAgentRepositoryRoundTrip(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	agent := models.Agent{
		ID:         "agent-1",
		Name:       "edge-agent",
		Version:    "dev",
		LastSeenAt: time.Now().UTC().Truncate(time.Second),
	}
	if err := repo.UpsertAgent(agent); err != nil {
		t.Fatalf("UpsertAgent returned error: %v", err)
	}

	if err := repo.UpsertServices(agent.ID, agent.LastSeenAt, []models.AgentService{{
		AgentID:    agent.ID,
		Key:        "container-1",
		Name:       "api",
		CheckType:  "http",
		Endpoint:   "http://api:8080/health",
		Healthy:    true,
		Seen:       true,
		ObservedAt: agent.LastSeenAt,
	}}); err != nil {
		t.Fatalf("UpsertServices returned error: %v", err)
	}
	report := models.CapabilityReport{
		CheckedAt:           agent.LastSeenAt,
		Host:                models.HostCompatibility{OS: "Ubuntu 24.04 LTS", Arch: "amd64", KernelVersion: "6.8.0", BTF: true, Lockdown: "none"},
		ContainerMonitoring: models.CapabilityStatus{State: "available"},
		HostMetrics:         models.CapabilityStatus{State: "available"},
		AutomaticTracing:    models.CapabilityStatus{State: "degraded", Reason: "observer_not_running"},
		ContextPropagation:  models.CapabilityStatus{State: "unavailable", Reason: "automatic_tracing_unavailable"},
	}
	if err := repo.UpdateCapabilityReport(agent.ID, report); err != nil {
		t.Fatalf("UpdateCapabilityReport returned error: %v", err)
	}

	if err := repo.InsertEvents(agent.ID, []models.AgentEvent{{
		Time:        agent.LastSeenAt,
		Type:        "alert_sent",
		ServiceName: "api",
		TargetKey:   "container-1",
		Message:     "api failed",
		Metadata:    map[string]interface{}{"source": "test"},
	}}); err != nil {
		t.Fatalf("InsertEvents returned error: %v", err)
	}

	agents, err := repo.GetAllAgents()
	if err != nil {
		t.Fatalf("GetAllAgents returned error: %v", err)
	}
	if len(agents) != 1 || agents[0].ID != agent.ID {
		t.Fatalf("unexpected agents: %+v", agents)
	}
	if agents[0].Capabilities == nil || agents[0].Capabilities.Host.KernelVersion != "6.8.0" || agents[0].Capabilities.AutomaticTracing.Reason != "observer_not_running" {
		t.Fatalf("unexpected capability report: %+v", agents[0].Capabilities)
	}
	if agents[0].Profile.Kind != models.AgentProfileAllInOne || !agents[0].Profile.Has(models.AgentCapabilityAPI) {
		t.Fatalf("existing Agent must retain the default all-in-one profile: %+v", agents[0].Profile)
	}
	services, err := repo.GetServices(agent.ID)
	if err != nil {
		t.Fatalf("GetServices returned error: %v", err)
	}
	if len(services) != 1 || services[0].Name != "api" || !services[0].Healthy {
		t.Fatalf("unexpected services: %+v", services)
	}

	events, err := repo.GetEvents(agent.ID, 10)
	if err != nil {
		t.Fatalf("GetEvents returned error: %v", err)
	}
	if len(events) != 1 || events[0].Type != "alert_sent" {
		t.Fatalf("unexpected events: %+v", events)
	}
}

// A failed check's latency is how long it waited before giving up, not a
// response time — it must not inflate the bucket's average.
func TestServiceHistoryLatencyAveragesHealthyChecksOnly(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	agent := models.Agent{ID: "agent-lat", Name: "lat", LastSeenAt: time.Now()}
	if err := repo.UpsertAgent(agent); err != nil {
		t.Fatalf("UpsertAgent: %v", err)
	}
	bucket := time.Now().UTC().Truncate(time.Hour).Add(-2 * time.Hour)
	checks := []struct {
		healthy bool
		latency string
	}{{true, "100ms"}, {false, "5s"}, {true, "200ms"}}
	for i, c := range checks {
		svc := models.AgentService{AgentID: agent.ID, Key: "web", Name: "web", CheckType: "http", Endpoint: "http://x", Healthy: c.healthy, Seen: true, LastLatency: c.latency}
		if err := repo.UpsertServices(agent.ID, bucket.Add(time.Duration(i)*time.Minute), []models.AgentService{svc}); err != nil {
			t.Fatalf("UpsertServices: %v", err)
		}
	}
	// A bucket where every check failed carries no latency.
	down := models.AgentService{AgentID: agent.ID, Key: "web", Name: "web", CheckType: "http", Endpoint: "http://x", Healthy: false, Seen: true, LastLatency: "5s"}
	if err := repo.UpsertServices(agent.ID, bucket.Add(30*time.Minute), []models.AgentService{down}); err != nil {
		t.Fatalf("UpsertServices: %v", err)
	}

	points, err := repo.GetServiceHistoryBuckets(agent.ID, "web", bucket.Add(-time.Minute), 20)
	if err != nil {
		t.Fatalf("GetServiceHistoryBuckets: %v", err)
	}
	if len(points) != 2 {
		t.Fatalf("expected 2 buckets, got %+v", points)
	}
	if points[0].LatencyMs != 150 || points[0].Total != 3 {
		t.Fatalf("mixed bucket: latency=%v total=%d, want 150 over 3 checks", points[0].LatencyMs, points[0].Total)
	}
	if points[1].LatencyMs != 0 || points[1].UptimePct != 0 {
		t.Fatalf("all-failed bucket: %+v, want latency 0 and uptime 0", points[1])
	}
}

// Agent-level uptime rollup + incident derivation from history transitions.
func TestAgentUptimeAndIncidents(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	agent := models.Agent{ID: "agent-1", Name: "prod", LastSeenAt: time.Now()}
	if err := repo.UpsertAgent(agent); err != nil {
		t.Fatalf("UpsertAgent: %v", err)
	}

	svc := func(key string, healthy bool) models.AgentService {
		return models.AgentService{AgentID: agent.ID, Key: key, Name: key + "-svc", CheckType: "http", Endpoint: "http://x", Healthy: healthy, Seen: true}
	}
	// t0: all healthy → t1,t2: a down → t3: a recovered, c goes down (still open)
	now := time.Now()
	steps := []struct {
		at       time.Time
		aOK, cOK bool
	}{
		{now.Add(-3 * time.Hour), true, true},
		{now.Add(-2 * time.Hour), false, true},
		{now.Add(-1 * time.Hour), false, true},
		{now.Add(-30 * time.Minute), true, false},
	}
	for _, s := range steps {
		if err := repo.UpsertServices(agent.ID, s.at, []models.AgentService{svc("a", s.aOK), svc("b", true), svc("c", s.cOK)}); err != nil {
			t.Fatalf("UpsertServices: %v", err)
		}
	}

	days, err := repo.GetAgentUptimeByDay(agent.ID, 90)
	if err != nil {
		t.Fatalf("GetAgentUptimeByDay: %v", err)
	}
	total, healthy := 0, 0
	for _, d := range days {
		total += d.TotalChecks
		healthy += d.HealthyChecks
	}
	if total != 12 || healthy != 9 { // 4 syncs × 3 services, 3 unhealthy points (a×2, c×1)
		t.Fatalf("uptime rollup: total=%d healthy=%d, want 12/9", total, healthy)
	}

	incidents, err := repo.GetAgentIncidents(agent.ID, 30, 20)
	if err != nil {
		t.Fatalf("GetAgentIncidents: %v", err)
	}
	if len(incidents) != 2 {
		t.Fatalf("expected 2 incidents, got %+v", incidents)
	}
	// newest first: c is still open, a was resolved
	if incidents[0].Key != "c" || !incidents[0].Active || incidents[0].EndedAt != nil {
		t.Fatalf("unexpected open incident: %+v", incidents[0])
	}
	if incidents[0].ServiceName != "c-svc" || incidents[0].DurationSec <= 0 {
		t.Fatalf("open incident name/duration: %+v", incidents[0])
	}
	if incidents[1].Key != "a" || incidents[1].Active || incidents[1].EndedAt == nil {
		t.Fatalf("unexpected resolved incident: %+v", incidents[1])
	}
	// a: started -2h, first healthy check again at -30m → 90min
	if got := incidents[1].DurationSec; got < 5300 || got > 5500 {
		t.Fatalf("resolved incident duration: %d", got)
	}
}

// GetAllAgentIncidents must group episodes by (agent_id, key). Two agents
// running a service under the same key are different targets; merging them
// would splice their samples into one long fake outage.
func TestAllAgentIncidentsGroupByAgentAndKey(t *testing.T) {
	openTestDB(t)

	repo := database.NewAgentRepository()
	now := time.Now()
	for _, id := range []string{"agent-a", "agent-b"} {
		if err := repo.UpsertAgent(models.Agent{ID: id, Name: id, LastSeenAt: now}); err != nil {
			t.Fatalf("UpsertAgent %s: %v", id, err)
		}
	}

	svc := func(agentID string, healthy bool) models.AgentService {
		// Same key on both agents — that is the whole point of this test.
		return models.AgentService{AgentID: agentID, Key: "api", Name: "api", CheckType: "http", Endpoint: "http://x", Healthy: healthy}
	}
	// agent-a is STILL DOWN at the end of its samples; agent-b recovers.
	// Rows arrive ordered by agent_id, so agent-a's open episode is live exactly
	// when agent-b's first healthy sample is read. Grouping by key alone would
	// let that sample close agent-a's episode — the episode would report as
	// resolved, with an end timestamp that precedes its own start.
	steps := []struct {
		at  time.Time
		aOK bool
		bOK bool
	}{
		{now.Add(-3 * time.Hour), true, true},
		{now.Add(-2 * time.Hour), false, false},
		{now.Add(-1 * time.Hour), false, true},
	}
	for _, s := range steps {
		if err := repo.UpsertServices("agent-a", s.at, []models.AgentService{svc("agent-a", s.aOK)}); err != nil {
			t.Fatalf("UpsertServices agent-a: %v", err)
		}
		if err := repo.UpsertServices("agent-b", s.at, []models.AgentService{svc("agent-b", s.bOK)}); err != nil {
			t.Fatalf("UpsertServices agent-b: %v", err)
		}
	}

	all, err := repo.GetAllAgentIncidents(30, 20)
	if err != nil {
		t.Fatalf("GetAllAgentIncidents: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("expected one episode per agent, got %d: %+v", len(all), all)
	}

	byAgent := map[string]models.AgentIncident{}
	for _, in := range all {
		if in.AgentID == "" {
			t.Fatalf("episode is missing AgentID, cross-agent links would break: %+v", in)
		}
		byAgent[in.AgentID] = in
	}
	if a, ok := byAgent["agent-a"]; !ok || !a.Active || a.EndedAt != nil {
		t.Fatalf("agent-a should still be down, not closed by agent-b's sample: %+v", byAgent["agent-a"])
	}
	if b, ok := byAgent["agent-b"]; !ok || b.Active || b.EndedAt == nil {
		t.Fatalf("agent-b should have a closed episode: %+v", byAgent["agent-b"])
	}

	// The per-agent entry point must keep its original behaviour.
	scoped, err := repo.GetAgentIncidents("agent-b", 30, 20)
	if err != nil {
		t.Fatalf("GetAgentIncidents: %v", err)
	}
	if len(scoped) != 1 || scoped[0].AgentID != "agent-b" {
		t.Fatalf("scoped query leaked other agents: %+v", scoped)
	}
}
