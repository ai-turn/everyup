package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// parseLatencyMs converts a Go duration string (e.g. "123ms", "1.5s", "400µs") to milliseconds.
// Returns float so sub-millisecond latencies (e.g. "400µs" → 0.4) survive instead of truncating to 0.
// ponytail: latency_ms column is INTEGER-affinity, but SQLite stores non-integer values as REAL — no migration needed.
func parseLatencyMs(s string) float64 {
	if s == "" {
		return 0
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0
	}
	return float64(d) / float64(time.Millisecond)
}

type AgentRepository struct{}

func NewAgentRepository() *AgentRepository {
	return &AgentRepository{}
}

func (r *AgentRepository) UpsertAgent(agent models.Agent) error {
	now := time.Now()
	if agent.LastSeenAt.IsZero() {
		agent.LastSeenAt = now
	}
	_, err := DB.Exec(`
INSERT INTO agents(id, name, version, last_seen_at, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	version = excluded.version,
	last_seen_at = excluded.last_seen_at,
	updated_at = excluded.updated_at`,
		agent.ID, agent.Name, agent.Version, agent.LastSeenAt, now, now)
	return err
}

// FindAgentByKeyHash looks up an active agent by SHA-256 hex of its API key.
func (r *AgentRepository) FindAgentByKeyHash(hash string) (models.Agent, bool, error) {
	var agent models.Agent
	err := DB.QueryRow(`
SELECT id, name, version, COALESCE(status,'active'), last_seen_at, created_at, updated_at
FROM agents
WHERE api_key_hash = ? AND COALESCE(status,'active') = 'active'
LIMIT 1`, hash).Scan(&agent.ID, &agent.Name, &agent.Version, &agent.Status, &agent.LastSeenAt, &agent.CreatedAt, &agent.UpdatedAt)
	if err == sql.ErrNoRows {
		return models.Agent{}, false, nil
	}
	if err != nil {
		return models.Agent{}, false, err
	}
	return agent, true, nil
}

// CreateAgent inserts a new pre-registered agent with a hashed API key (for auth)
// and the AES-encrypted key (so it can be revealed later in the UI).
func (r *AgentRepository) CreateAgent(agent models.Agent, keyHash, keyEnc string) error {
	now := time.Now()
	profile, err := encodeAgentProfile(agent.Profile)
	if err != nil {
		return err
	}
	_, err = DB.Exec(`
INSERT INTO agents(id, name, version, api_key_hash, api_key_enc, status, profile_kind, profile_capabilities, last_seen_at, created_at, updated_at)
VALUES (?, ?, '', ?, ?, 'active', ?, ?, ?, ?, ?)`,
		agent.ID, agent.Name, keyHash, keyEnc, profile.Kind, profile.Capabilities, now, now, now)
	return err
}

// CreateAgentWithJoinCode atomically creates a project and its initial
// short-lived installer credential. The join code itself is never persisted.
func (r *AgentRepository) CreateAgentWithJoinCode(agent models.Agent, keyHash, keyEnc, joinCodeHash string, expiresAt time.Time) error {
	now := time.Now()
	profile, err := encodeAgentProfile(agent.Profile)
	if err != nil {
		return err
	}
	return Transaction(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`
INSERT INTO agents(id, name, version, api_key_hash, api_key_enc, status, profile_kind, profile_capabilities, last_seen_at, created_at, updated_at)
VALUES (?, ?, '', ?, ?, 'active', ?, ?, ?, ?, ?)`,
			agent.ID, agent.Name, keyHash, keyEnc, profile.Kind, profile.Capabilities, now, now, now); err != nil {
			return err
		}
		_, err := tx.Exec(`
INSERT INTO agent_join_codes(code_hash, agent_id, expires_at, created_at)
VALUES (?, ?, ?, ?)`, joinCodeHash, agent.ID, expiresAt, now)
		return err
	})
}

// IssueJoinCode replaces any still-unused code for an active Agent.
func (r *AgentRepository) IssueJoinCode(agentID, joinCodeHash string, expiresAt time.Time) error {
	return Transaction(func(tx *sql.Tx) error {
		var exists int
		if err := tx.QueryRow(`SELECT 1 FROM agents WHERE id = ? AND COALESCE(status, 'active') = 'active'`, agentID).Scan(&exists); err != nil {
			return err
		}
		if _, err := tx.Exec(`DELETE FROM agent_join_codes WHERE agent_id = ? AND used_at IS NULL`, agentID); err != nil {
			return err
		}
		if _, err := tx.Exec(`DELETE FROM agent_join_codes WHERE expires_at <= ?`, time.Now()); err != nil {
			return err
		}
		_, err := tx.Exec(`
INSERT INTO agent_join_codes(code_hash, agent_id, expires_at, created_at)
VALUES (?, ?, ?, ?)`, joinCodeHash, agentID, expiresAt, time.Now())
		return err
	})
}

type AgentInstallCredential struct {
	AgentID   string
	AgentName string
	KeyEnc    string
	Profile   models.AgentProfile
}

// ConsumeJoinCode atomically marks a valid code as used and returns the
// encrypted long-lived Agent credential needed to build the local Compose
// file. Concurrent or repeated exchanges can only succeed once.
func (r *AgentRepository) ConsumeJoinCode(joinCodeHash string, now time.Time) (AgentInstallCredential, error) {
	var credential AgentInstallCredential
	err := Transaction(func(tx *sql.Tx) error {
		result, err := tx.Exec(`
UPDATE agent_join_codes
SET used_at = ?
WHERE code_hash = ?
  AND used_at IS NULL
  AND expires_at > ?
  AND EXISTS (
	SELECT 1 FROM agents
	WHERE agents.id = agent_join_codes.agent_id
	  AND COALESCE(agents.status, 'active') = 'active'
  )`, now, joinCodeHash, now)
		if err != nil {
			return err
		}
		rows, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if rows != 1 {
			return sql.ErrNoRows
		}

		var keyEnc sql.NullString
		var profileCapabilities string
		if err := tx.QueryRow(`
SELECT a.id, a.name, a.api_key_enc, COALESCE(a.profile_kind, 'all-in-one'), COALESCE(a.profile_capabilities, '[]')
FROM agent_join_codes j
JOIN agents a ON a.id = j.agent_id
WHERE j.code_hash = ?`, joinCodeHash).Scan(&credential.AgentID, &credential.AgentName, &keyEnc, &credential.Profile.Kind, &profileCapabilities); err != nil {
			return err
		}
		credential.KeyEnc = keyEnc.String
		profile, err := decodeAgentProfile(credential.Profile.Kind, profileCapabilities)
		if err != nil {
			return err
		}
		credential.Profile = profile
		return nil
	})
	return credential, err
}

// GetAgentKeyEnc returns the stored encrypted API key for an agent. found is
// false when no agent row exists; enc is "" for agents created before key
// storage was added (only the hash exists, so the key cannot be revealed).
func (r *AgentRepository) GetAgentKeyEnc(id string) (enc string, found bool, err error) {
	var keyEnc sql.NullString
	err = DB.QueryRow(`SELECT api_key_enc FROM agents WHERE id = ?`, id).Scan(&keyEnc)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return keyEnc.String, true, nil
}

// UpdateAgentKey rotates an agent's API key (hash for auth, enc for reveal).
func (r *AgentRepository) UpdateAgentKey(id, keyHash, keyEnc string) error {
	res, err := DB.Exec(`UPDATE agents SET api_key_hash = ?, api_key_enc = ?, updated_at = ? WHERE id = ?`,
		keyHash, keyEnc, time.Now(), id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeactivateAgent sets an agent's status to 'inactive', preventing further enrollments.
func (r *AgentRepository) DeactivateAgent(id string) error {
	res, err := DB.Exec(`UPDATE agents SET status = 'inactive', updated_at = ? WHERE id = ?`, time.Now(), id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *AgentRepository) GetAllAgents() ([]models.Agent, error) {
	rows, err := DB.Query(`SELECT id, name, COALESCE(project_id, ''), version, COALESCE(status,'active'), last_seen_at, created_at, updated_at, COALESCE(profile_kind, 'all-in-one'), COALESCE(profile_capabilities, '[]'), COALESCE(capability_report, '{}') FROM agents WHERE COALESCE(status,'active') = 'active' ORDER BY last_seen_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	agents := make([]models.Agent, 0)
	for rows.Next() {
		var agent models.Agent
		var capabilityReport, profileCapabilities string
		if err := rows.Scan(&agent.ID, &agent.Name, &agent.ProjectID, &agent.Version, &agent.Status, &agent.LastSeenAt, &agent.CreatedAt, &agent.UpdatedAt, &agent.Profile.Kind, &profileCapabilities, &capabilityReport); err != nil {
			return nil, err
		}
		profile, err := decodeAgentProfile(agent.Profile.Kind, profileCapabilities)
		if err != nil {
			return nil, fmt.Errorf("decode agent %s profile: %w", agent.ID, err)
		}
		agent.Profile = profile
		var report models.CapabilityReport
		if err := json.Unmarshal([]byte(capabilityReport), &report); err != nil {
			return nil, fmt.Errorf("decode agent %s capability report: %w", agent.ID, err)
		}
		if !report.CheckedAt.IsZero() {
			agent.Capabilities = &report
		}
		agents = append(agents, agent)
	}
	return agents, rows.Err()
}

type storedAgentProfile struct {
	Kind         string
	Capabilities string
}

func encodeAgentProfile(profile models.AgentProfile) (storedAgentProfile, error) {
	if profile.Kind == "" {
		profile = models.DefaultAgentProfile()
	}
	data, err := json.Marshal(profile.Capabilities)
	if err != nil {
		return storedAgentProfile{}, err
	}
	return storedAgentProfile{Kind: profile.Kind, Capabilities: string(data)}, nil
}

func decodeAgentProfile(kind, capabilities string) (models.AgentProfile, error) {
	if kind == "" || kind == models.AgentProfileAllInOne {
		if capabilities == "" || capabilities == "[]" {
			return models.DefaultAgentProfile(), nil
		}
	}
	var enabled []string
	if err := json.Unmarshal([]byte(capabilities), &enabled); err != nil {
		return models.AgentProfile{}, err
	}
	return models.AgentProfile{Kind: kind, Capabilities: enabled}, nil
}

// UpdateCapabilityReport persists diagnostics independently from the service
// rows so older Agents that omit the report remain wire-compatible.
func (r *AgentRepository) UpdateCapabilityReport(agentID string, report models.CapabilityReport) error {
	data, err := json.Marshal(report)
	if err != nil {
		return err
	}
	result, err := DB.Exec(`UPDATE agents SET capability_report = ?, updated_at = ? WHERE id = ?`, string(data), time.Now(), agentID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *AgentRepository) UpsertServices(agentID string, observedAt time.Time, services []models.AgentService) error {
	if observedAt.IsZero() {
		observedAt = time.Now()
	}
	return Transaction(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`UPDATE agents SET last_seen_at = ?, updated_at = ? WHERE id = ?`, observedAt, time.Now(), agentID); err != nil {
			return err
		}
		for _, service := range services {
			if service.UpdatedAt.IsZero() {
				service.UpdatedAt = observedAt
			}
			if _, err := tx.Exec(`
INSERT INTO agent_services(agent_id, key, name, check_type, endpoint, runtime, image, restart_count, started_at, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(agent_id, key) DO UPDATE SET
	name = excluded.name,
	check_type = excluded.check_type,
	endpoint = excluded.endpoint,
	runtime = excluded.runtime,
	image = excluded.image,
	restart_count = excluded.restart_count,
	started_at = excluded.started_at,
	healthy = excluded.healthy,
	seen = excluded.seen,
	silenced = excluded.silenced,
	last_error = excluded.last_error,
	last_status = excluded.last_status,
	last_latency = excluded.last_latency,
	updated_at = excluded.updated_at,
	observed_at = excluded.observed_at`,
				agentID, service.Key, service.Name, service.CheckType, service.Endpoint, service.Runtime, service.Image, service.RestartCount, nullableTime(service.StartedAt), boolInt(service.Healthy), boolInt(service.Seen),
				boolInt(service.Silenced), service.LastError, service.LastStatus, service.LastLatency, service.UpdatedAt, observedAt); err != nil {
				return err
			}
			// Record each sync as a history point for time-series charts.
			if _, err := tx.Exec(`
INSERT INTO agent_service_history(agent_id, key, healthy, latency_ms, recorded_at)
VALUES (?, ?, ?, ?, ?)`,
				agentID, service.Key, boolInt(service.Healthy), parseLatencyMs(service.LastLatency), observedAt); err != nil {
				return err
			}
		}
		// Remove services that are no longer in the agent's current list.
		if len(services) > 0 {
			placeholders := make([]string, len(services))
			args := make([]interface{}, 0, 1+len(services))
			args = append(args, agentID)
			for i, s := range services {
				placeholders[i] = "?"
				args = append(args, s.Key)
			}
			q := fmt.Sprintf(
				"DELETE FROM agent_services WHERE agent_id = ? AND key NOT IN (%s)",
				strings.Join(placeholders, ", "),
			)
			if _, err := tx.Exec(q, args...); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *AgentRepository) DeleteService(agentID, key string) error {
	_, err := DB.Exec(`DELETE FROM agent_services WHERE agent_id = ? AND key = ?`, agentID, key)
	return err
}

func (r *AgentRepository) GetServices(agentID string) ([]models.AgentService, error) {
	rows, err := DB.Query(`
SELECT agent_id, key, name, check_type, endpoint, runtime, image, restart_count, started_at, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at
FROM agent_services WHERE agent_id = ? ORDER BY name`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	services := make([]models.AgentService, 0)
	for rows.Next() {
		var service models.AgentService
		var healthy, seen, silenced int
		var startedAt sql.NullTime
		if err := rows.Scan(&service.AgentID, &service.Key, &service.Name, &service.CheckType, &service.Endpoint, &service.Runtime,
			&service.Image, &service.RestartCount, &startedAt,
			&healthy, &seen, &silenced, &service.LastError, &service.LastStatus, &service.LastLatency, &service.UpdatedAt, &service.ObservedAt); err != nil {
			return nil, err
		}
		service.StartedAt = startedAt.Time
		service.Healthy = healthy == 1
		service.Seen = seen == 1
		service.Silenced = silenced == 1
		services = append(services, service)
	}
	return services, rows.Err()
}

func (r *AgentRepository) GetServiceByKey(agentID, key string) (*models.AgentService, error) {
	var service models.AgentService
	var healthy, seen, silenced int
	var startedAt sql.NullTime
	err := DB.QueryRow(`
SELECT agent_id, key, name, check_type, endpoint, runtime, image, restart_count, started_at, healthy, seen, silenced, last_error, last_status, last_latency, updated_at, observed_at
FROM agent_services WHERE agent_id = ? AND key = ?`, agentID, key).Scan(
		&service.AgentID, &service.Key, &service.Name, &service.CheckType, &service.Endpoint, &service.Runtime,
		&service.Image, &service.RestartCount, &startedAt,
		&healthy, &seen, &silenced, &service.LastError, &service.LastStatus, &service.LastLatency, &service.UpdatedAt, &service.ObservedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	service.StartedAt = startedAt.Time
	service.Healthy = healthy == 1
	service.Seen = seen == 1
	service.Silenced = silenced == 1
	return &service, nil
}

// LogLevelFilterByName returns the per-service ingest log-level filter for the
// agent service whose name matches the OTLP service.name. Stored as CSV on
// agent_services; empty/missing = accept all levels. UpsertServices never writes
// this column, so a user-set filter survives agent re-syncs.
func (r *AgentRepository) LogLevelFilterByName(agentID, name string) []models.LogLevel {
	var csv string
	err := DB.QueryRow(
		`SELECT log_level_filter FROM agent_services WHERE agent_id = ? AND name = ? LIMIT 1`,
		agentID, name,
	).Scan(&csv)
	if err != nil || strings.TrimSpace(csv) == "" {
		return nil
	}
	parts := strings.Split(csv, ",")
	levels := make([]models.LogLevel, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			levels = append(levels, models.LogLevel(p))
		}
	}
	return levels
}

// GetLogLevelFilterByKey returns the per-service ingest filter as a level list,
// addressed by (agent_id, key) — the unit the UI edits. Empty = accept all.
func (r *AgentRepository) GetLogLevelFilterByKey(agentID, key string) ([]string, error) {
	var csv string
	err := DB.QueryRow(
		`SELECT log_level_filter FROM agent_services WHERE agent_id = ? AND key = ?`,
		agentID, key,
	).Scan(&csv)
	if err == sql.ErrNoRows {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	out := make([]string, 0)
	for _, p := range strings.Split(csv, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out, nil
}

// SetLogLevelFilter persists the per-service ingest filter (CSV; empty = accept all).
func (r *AgentRepository) SetLogLevelFilter(agentID, key, csv string) error {
	_, err := DB.Exec(
		`UPDATE agent_services SET log_level_filter = ? WHERE agent_id = ? AND key = ?`,
		csv, agentID, key,
	)
	return err
}

func (r *AgentRepository) InsertEvents(agentID string, events []models.AgentEvent) error {
	if len(events) == 0 {
		return nil
	}
	now := time.Now()
	return Transaction(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`UPDATE agents SET last_seen_at = ?, updated_at = ? WHERE id = ?`, now, now, agentID); err != nil {
			return err
		}
		for _, event := range events {
			if event.Time.IsZero() {
				event.Time = now
			}
			metadata, err := json.Marshal(event.Metadata)
			if err != nil {
				return err
			}
			if _, err := tx.Exec(`
INSERT INTO agent_events(agent_id, time, type, service_name, target_key, message, metadata_json, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				agentID, event.Time, event.Type, event.ServiceName, event.TargetKey, event.Message, string(metadata), now); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *AgentRepository) GetEvents(agentID string, limit int) ([]models.AgentEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := DB.Query(`
SELECT id, agent_id, time, type, service_name, target_key, message, metadata_json, created_at
FROM agent_events WHERE agent_id = ? ORDER BY time DESC LIMIT ?`, agentID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]models.AgentEvent, 0)
	for rows.Next() {
		var event models.AgentEvent
		var metadata string
		if err := rows.Scan(&event.ID, &event.AgentID, &event.Time, &event.Type, &event.ServiceName, &event.TargetKey, &event.Message, &metadata, &event.CreatedAt); err != nil {
			return nil, err
		}
		if metadata != "" {
			_ = json.Unmarshal([]byte(metadata), &event.Metadata)
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

// GetAllServicesFlat returns all agent services joined with agent name for list views.
func (r *AgentRepository) GetAllServicesFlat() ([]models.AgentServiceFlat, error) {
	rows, err := DB.Query(`
SELECT s.agent_id, s.key, s.name, s.check_type, s.endpoint, s.runtime, s.image, s.restart_count, s.started_at, s.healthy, s.seen, s.silenced,
       s.last_error, s.last_status, s.last_latency, s.updated_at, s.observed_at, a.name
FROM agent_services s
JOIN agents a ON a.id = s.agent_id
WHERE COALESCE(a.status,'active') = 'active'
ORDER BY a.name, s.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.AgentServiceFlat, 0)
	for rows.Next() {
		var f models.AgentServiceFlat
		var healthy, seen, silenced int
		var startedAt sql.NullTime
		if err := rows.Scan(
			&f.AgentID, &f.Key, &f.Name, &f.CheckType, &f.Endpoint, &f.Runtime,
			&f.Image, &f.RestartCount, &startedAt,
			&healthy, &seen, &silenced,
			&f.LastError, &f.LastStatus, &f.LastLatency,
			&f.UpdatedAt, &f.ObservedAt, &f.AgentName,
		); err != nil {
			return nil, err
		}
		f.StartedAt = startedAt.Time
		f.Healthy = healthy == 1
		f.Seen = seen == 1
		f.Silenced = silenced == 1
		out = append(out, f)
	}
	return out, rows.Err()
}

// GetServiceHistoryBuckets returns time-bucketed history points for response-time charts.
// Records are fetched raw then bucketed in Go to avoid complex SQLite time math.
func (r *AgentRepository) GetServiceHistoryBuckets(agentID, key string, since time.Time, bucketMins int) ([]models.ServiceHistoryPoint, error) {
	rows, err := DB.Query(`
SELECT healthy, latency_ms, recorded_at
FROM agent_service_history
WHERE agent_id = ? AND key = ? AND recorded_at >= ?
ORDER BY recorded_at`,
		agentID, key, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type raw struct {
		healthy    int
		latencyMs  float64
		recordedAt time.Time
	}
	var records []raw
	for rows.Next() {
		var r raw
		if err := rows.Scan(&r.healthy, &r.latencyMs, &r.recordedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(records) == 0 {
		return []models.ServiceHistoryPoint{}, nil
	}

	// Bucket by truncating to the nearest N-minute interval.
	bucketDur := time.Duration(bucketMins) * time.Minute
	type bucket struct {
		sumLatency float64
		healthy    int
		total      int
	}
	ordered := make([]time.Time, 0)
	buckets := make(map[time.Time]*bucket)
	for _, rec := range records {
		t := rec.recordedAt.Truncate(bucketDur)
		if _, ok := buckets[t]; !ok {
			buckets[t] = &bucket{}
			ordered = append(ordered, t)
		}
		b := buckets[t]
		b.total++
		b.healthy += rec.healthy
		b.sumLatency += rec.latencyMs
	}

	points := make([]models.ServiceHistoryPoint, 0, len(ordered))
	for _, t := range ordered {
		b := buckets[t]
		avgLat := 0.0
		if b.total > 0 {
			avgLat = b.sumLatency / float64(b.total)
		}
		uptimePct := 0.0
		if b.total > 0 {
			uptimePct = float64(b.healthy) * 100.0 / float64(b.total)
		}
		points = append(points, models.ServiceHistoryPoint{
			Time:      t.UTC().Format(time.RFC3339),
			LatencyMs: avgLat,
			UptimePct: uptimePct,
			Total:     b.total,
		})
	}
	return points, nil
}

// GetServiceUptimeByDay returns per-day uptime percentages for up to `days` days.
// Day grouping is done in Go, not SQL: recorded_at is stored as an RFC3339 string
// with a timezone offset, which SQLite's date() can't parse (returns NULL, so a
// SQL date() filter drops every row). Scanning time.Time and bucketing by local
// calendar date here matches how the bar chart reads days.
func (r *AgentRepository) GetServiceUptimeByDay(agentID, key string, days int) ([]models.ServiceUptimeDay, error) {
	since := time.Now().AddDate(0, 0, -days)
	return uptimeByDay(`
SELECT healthy, recorded_at
FROM agent_service_history
WHERE agent_id = ? AND key = ? AND recorded_at >= ?
ORDER BY recorded_at`,
		agentID, key, since)
}

// GetAgentUptimeByDay rolls daily uptime up across every service of one agent
// (project dashboard: 30-day uptime KPI + 90-day calendar).
func (r *AgentRepository) GetAgentUptimeByDay(agentID string, days int) ([]models.ServiceUptimeDay, error) {
	since := time.Now().AddDate(0, 0, -days)
	return uptimeByDay(`
SELECT healthy, recorded_at
FROM agent_service_history
WHERE agent_id = ? AND recorded_at >= ?
ORDER BY recorded_at`,
		agentID, since)
}

func uptimeByDay(query string, args ...interface{}) ([]models.ServiceUptimeDay, error) {
	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type acc struct {
		healthy int
		total   int
	}
	byDay := make(map[string]*acc)
	order := make([]string, 0)
	for rows.Next() {
		var healthy int
		var recordedAt time.Time
		if err := rows.Scan(&healthy, &recordedAt); err != nil {
			return nil, err
		}
		day := recordedAt.Format("2006-01-02")
		a, ok := byDay[day]
		if !ok {
			a = &acc{}
			byDay[day] = a
			order = append(order, day)
		}
		a.total++
		a.healthy += healthy
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]models.ServiceUptimeDay, 0, len(order))
	for _, day := range order {
		a := byDay[day]
		d := models.ServiceUptimeDay{Date: day, HealthyChecks: a.healthy, TotalChecks: a.total}
		if a.total > 0 {
			d.UptimePct = float64(a.healthy) * 100.0 / float64(a.total)
		}
		out = append(out, d)
	}
	return out, nil
}

// GetAgentIncidents derives unhealthy episodes per service from
// agent_service_history: a run of healthy=0 checks is one incident, closed by
// the first healthy check after it. Newest first, capped at limit.
func (r *AgentRepository) GetAgentIncidents(agentID string, days, limit int) ([]models.AgentIncident, error) {
	return r.agentIncidents(agentID, days, limit)
}

// GetAllAgentIncidents applies the same derivation across every agent. Episodes
// are grouped by (agent_id, key), not key alone — the same service key can exist
// under two agents, and merging them would invent one long fake outage.
func (r *AgentRepository) GetAllAgentIncidents(days, limit int) ([]models.AgentIncident, error) {
	return r.agentIncidents("", days, limit)
}

// agentIncidents is the shared derivation; agentID == "" scans every agent.
func (r *AgentRepository) agentIncidents(agentID string, days, limit int) ([]models.AgentIncident, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	since := time.Now().AddDate(0, 0, -days)
	query := `
SELECT h.agent_id, h.key, COALESCE(s.name, h.key), h.healthy, h.recorded_at
FROM agent_service_history h
LEFT JOIN agent_services s ON s.agent_id = h.agent_id AND s.key = h.key
WHERE h.recorded_at >= ?`
	args := []any{since}
	if agentID != "" {
		query += ` AND h.agent_id = ?`
		args = append(args, agentID)
	}
	query += ` ORDER BY h.agent_id, h.key, h.recorded_at`

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	incidents := make([]models.AgentIncident, 0)
	var open *models.AgentIncident
	prevAgent, prevKey := "", ""
	for rows.Next() {
		var agent, key, name string
		var healthy int
		var recordedAt time.Time
		if err := rows.Scan(&agent, &key, &name, &healthy, &recordedAt); err != nil {
			return nil, err
		}
		if agent != prevAgent || key != prevKey {
			// group boundary: an episode still open for the previous one stays active
			if open != nil {
				incidents = append(incidents, *open)
				open = nil
			}
			prevAgent, prevKey = agent, key
		}
		switch {
		case healthy == 0 && open == nil:
			open = &models.AgentIncident{AgentID: agent, Key: key, ServiceName: name, StartedAt: recordedAt, Active: true}
		case healthy == 1 && open != nil:
			ended := recordedAt
			open.EndedAt = &ended
			open.DurationSec = int64(ended.Sub(open.StartedAt).Seconds())
			open.Active = false
			incidents = append(incidents, *open)
			open = nil
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if open != nil {
		incidents = append(incidents, *open)
	}
	now := time.Now()
	for i := range incidents {
		if incidents[i].Active {
			incidents[i].DurationSec = int64(now.Sub(incidents[i].StartedAt).Seconds())
		}
	}
	sort.Slice(incidents, func(i, j int) bool { return incidents[i].StartedAt.After(incidents[j].StartedAt) })
	if len(incidents) > limit {
		incidents = incidents[:limit]
	}
	return incidents, nil
}

// GetServiceKeyEvents returns agent_events filtered to a specific service key.
func (r *AgentRepository) GetServiceKeyEvents(agentID, key string, limit int) ([]models.AgentEvent, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := DB.Query(`
SELECT id, agent_id, time, type, service_name, target_key, message, metadata_json, created_at
FROM agent_events
WHERE agent_id = ? AND target_key = ?
ORDER BY time DESC LIMIT ?`,
		agentID, key, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]models.AgentEvent, 0)
	for rows.Next() {
		var event models.AgentEvent
		var metadata string
		if err := rows.Scan(&event.ID, &event.AgentID, &event.Time, &event.Type, &event.ServiceName, &event.TargetKey, &event.Message, &metadata, &event.CreatedAt); err != nil {
			return nil, err
		}
		if metadata != "" {
			_ = json.Unmarshal([]byte(metadata), &event.Metadata)
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

// nullableTime stores the zero time as SQL NULL (e.g. non-container services
// have no container start time), so scans distinguish "never set" from year 1.
func nullableTime(t time.Time) interface{} {
	if t.IsZero() {
		return nil
	}
	return t
}
