package database

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
	"github.com/google/uuid"
)

var (
	ErrServerMissing           = errors.New("server not found")
	ErrServerNameTaken         = errors.New("server name already exists in this group")
	ErrServerHasInfrastructure = errors.New("server already has an infrastructure resource")
	ErrServerHasDocker         = errors.New("server has a Docker Collector")
)

// dockerServerIDs selects the servers that own a Docker Collector (a Docker environment is a
// server, plans/server-docker-unify-2026-11-22.md). Until the screens show them (stage 2), these
// servers stay out of the server list, and name lookups never attach direct targets to them or
// merge into them.
const dockerServerIDs = `SELECT server_id FROM agents WHERE server_id IS NOT NULL`

type ServerRepository struct{}

func NewServerRepository() *ServerRepository { return &ServerRepository{} }

const serverColumns = `id, name, description, COALESCE(project_id, ''), created_at, updated_at`

func scanServer(row interface{ Scan(...any) error }) (models.Server, error) {
	var server models.Server
	err := row.Scan(&server.ID, &server.Name, &server.Description, &server.ProjectID, &server.CreatedAt, &server.UpdatedAt)
	return server, err
}

// GetAll lists the servers. Servers that own a Docker Collector are listed only with
// includeDocker, until every screen shows them (server and Docker unification, stage 2).
func (r *ServerRepository) GetAll(includeDocker bool) ([]models.Server, error) {
	query := `SELECT ` + serverColumns + ` FROM servers`
	if !includeDocker {
		query += ` WHERE id NOT IN (` + dockerServerIDs + `)`
	}
	rows, err := DB.Query(query + ` ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	servers := make([]models.Server, 0)
	for rows.Next() {
		server, err := scanServer(rows)
		if err != nil {
			return nil, err
		}
		servers = append(servers, server)
	}
	return servers, rows.Err()
}

func (r *ServerRepository) GetByID(id string) (*models.Server, error) {
	server, err := scanServer(DB.QueryRow(`SELECT `+serverColumns+` FROM servers WHERE id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &server, nil
}

func (r *ServerRepository) Create(server *models.Server) error {
	now := time.Now()
	server.CreatedAt, server.UpdatedAt = now, now
	_, err := DB.Exec(`INSERT INTO servers (id, name, description, project_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`, server.ID, server.Name, server.Description, nullableProjectID(server.ProjectID), now, now)
	return serverNameError(err)
}

// Update replaces name, description and project; CreatedAt is reloaded so the
// caller can return the stored row.
func (r *ServerRepository) Update(server *models.Server) error {
	server.UpdatedAt = time.Now()
	err := Transaction(func(tx *sql.Tx) error {
		if err := tx.QueryRow(`UPDATE servers SET name = ?, description = ?, project_id = ?, updated_at = ?
			WHERE id = ? RETURNING created_at`,
			server.Name, server.Description, nullableProjectID(server.ProjectID), server.UpdatedAt, server.ID).Scan(&server.CreatedAt); err != nil {
			return err
		}
		// The Docker Collector's data follows its group (ADR 0003), so it moves with the server.
		_, err := tx.Exec(`UPDATE agents SET project_id = ? WHERE server_id = ?`, nullableProjectID(server.ProjectID), server.ID)
		return err
	})
	return serverNameError(err)
}

type ServerTargetKind string

const (
	ServerTargetMonitor ServerTargetKind = "monitor" // services, type http/tcp
	ServerTargetApp     ServerTargetKind = "app"     // observed_services
	ServerTargetInfra   ServerTargetKind = "infra"   // hosts, collector_type otel-collector
)

// table returns the target table and the filter that limits it to directly configured rows.
func (kind ServerTargetKind) table() (string, string) {
	switch kind {
	case ServerTargetMonitor:
		return "services", "type IN ('http','tcp')"
	case ServerTargetApp:
		return "observed_services", "1 = 1"
	case ServerTargetInfra:
		return "hosts", "collector_type = 'otel-collector'"
	}
	panic("unknown server target kind: " + string(kind))
}

// ResolveForTarget returns the server a new target should join. With serverID it
// verifies the server exists (ErrServerMissing) and, for infra, that it has no
// infrastructure resource yet (ErrServerHasInfrastructure). Without serverID it
// applies the find-or-create rule with name and projectID.
func (r *ServerRepository) ResolveForTarget(kind ServerTargetKind, serverID, name, projectID string) (string, error) {
	err := Transaction(func(tx *sql.Tx) error {
		if serverID != "" {
			return checkTargetServerTx(tx, kind, serverID)
		}
		var err error
		serverID, err = resolveServerTx(tx, strings.TrimSpace(name), projectID, kind == ServerTargetInfra, true, time.Now())
		return err
	})
	if err != nil {
		return "", err
	}
	return serverID, nil
}

// MoveTarget re-parents an existing target. Moving to the current server is a no-op.
// Errors: sql.ErrNoRows (target missing), ErrServerMissing, ErrServerHasInfrastructure.
func (r *ServerRepository) MoveTarget(kind ServerTargetKind, targetID, serverID string) error {
	table, filter := kind.table()
	return Transaction(func(tx *sql.Tx) error {
		var current string
		if err := tx.QueryRow(`SELECT COALESCE(server_id, '') FROM `+table+` WHERE id = ? AND `+filter, targetID).Scan(&current); err != nil {
			return err
		}
		if current == serverID {
			return nil
		}
		if err := checkTargetServerTx(tx, kind, serverID); err != nil {
			return err
		}
		_, err := tx.Exec(`UPDATE `+table+` SET server_id = ? WHERE id = ?`, serverID, targetID)
		return err
	})
}

// SetProjectForTarget writes projectID ("" clears) to the server that owns the target.
// This is the legacy group-assignment path, whose screens know nothing of servers, so
// a same-name server in projectID never fails it (spec 5.5): the owning server merges
// into that one, or, when both own an infrastructure resource, takes a suffixed name.
// Errors: sql.ErrNoRows (target missing).
func (r *ServerRepository) SetProjectForTarget(kind ServerTargetKind, targetID, projectID string) error {
	table, filter := kind.table()
	return Transaction(func(tx *sql.Tx) error {
		var serverID, name, current string
		if err := tx.QueryRow(`SELECT s.id, s.name, COALESCE(s.project_id, '')
			FROM `+table+` t JOIN servers s ON s.id = t.server_id
			WHERE t.id = ? AND `+filter, targetID).Scan(&serverID, &name, &current); err != nil {
			return err
		}
		if current == projectID {
			return nil
		}
		// A same-name server that owns a Docker Collector is never merged into: a name only
		// suggests the same host. The moving server takes a suffixed name instead.
		var sameNameID string
		err := tx.QueryRow(`SELECT id FROM servers
			WHERE lower(trim(name)) = lower(trim(?)) AND COALESCE(project_id, '') = ?
			AND id NOT IN (`+dockerServerIDs+`)`, name, projectID).Scan(&sameNameID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if err == nil {
			// mergeServersTx checks for two infrastructure resources before writing anything.
			if err := mergeServersTx(tx, serverID, sameNameID); !errors.Is(err, ErrServerHasInfrastructure) {
				return err
			}
		}
		if name, err = nextFreeServerNameTx(tx, name, projectID); err != nil {
			return err
		}
		_, err = tx.Exec(`UPDATE servers SET name = ?, project_id = ?, updated_at = ? WHERE id = ?`,
			name, nullableProjectID(projectID), time.Now(), serverID)
		return err
	})
}

type ServerTargets struct {
	MonitorIDs         []string
	ObservedServiceIDs []string
	InfrastructureID   string // "" when none
}

func (r *ServerRepository) Targets(serverID string) (ServerTargets, error) {
	var targets ServerTargets
	for _, kind := range []ServerTargetKind{ServerTargetMonitor, ServerTargetApp, ServerTargetInfra} {
		table, filter := kind.table()
		rows, err := DB.Query(`SELECT id FROM `+table+` WHERE server_id = ? AND `+filter+` ORDER BY id`, serverID)
		if err != nil {
			return targets, err
		}
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return targets, err
			}
			ids = append(ids, id)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return targets, err
		}
		switch kind {
		case ServerTargetMonitor:
			targets.MonitorIDs = ids
		case ServerTargetApp:
			targets.ObservedServiceIDs = ids
		case ServerTargetInfra:
			if len(ids) > 0 {
				targets.InfrastructureID = ids[0]
			}
		}
	}
	return targets, nil
}

// Merge moves every target of sourceID to targetID and deletes sourceID, in one transaction.
// Errors: ErrServerMissing (either id), ErrServerHasInfrastructure (both own one).
func (r *ServerRepository) Merge(sourceID, targetID string) error {
	return Transaction(func(tx *sql.Tx) error {
		return mergeServersTx(tx, sourceID, targetID)
	})
}

// mergeServersTx is Merge inside tx. Its errors are returned before any write.
func mergeServersTx(tx *sql.Tx, sourceID, targetID string) error {
	var sourceExists, targetExists, sourceHasInfra, targetHasInfra bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM servers WHERE id = ?), EXISTS(SELECT 1 FROM servers WHERE id = ?),
		EXISTS(SELECT 1 FROM hosts WHERE server_id = ? AND collector_type = 'otel-collector'),
		EXISTS(SELECT 1 FROM hosts WHERE server_id = ? AND collector_type = 'otel-collector')`,
		sourceID, targetID, sourceID, targetID).Scan(&sourceExists, &targetExists, &sourceHasInfra, &targetHasInfra); err != nil {
		return err
	}
	if !sourceExists || !targetExists {
		return ErrServerMissing
	}
	// Merging with a Docker server is the same-host merge, which asks for confirmation (stage 3).
	var hasDocker bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM agents WHERE server_id IN (?, ?))`, sourceID, targetID).Scan(&hasDocker); err != nil {
		return err
	}
	if hasDocker {
		return ErrServerHasDocker
	}
	if sourceHasInfra && targetHasInfra {
		return ErrServerHasInfrastructure
	}
	for _, kind := range []ServerTargetKind{ServerTargetMonitor, ServerTargetApp, ServerTargetInfra} {
		table, filter := kind.table()
		if _, err := tx.Exec(`UPDATE `+table+` SET server_id = ? WHERE server_id = ? AND `+filter, targetID, sourceID); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`UPDATE servers SET updated_at = ? WHERE id = ?`, time.Now(), targetID); err != nil {
		return err
	}
	_, err := tx.Exec(`DELETE FROM servers WHERE id = ?`, sourceID)
	return err
}

// HasDocker reports whether a Docker Collector belongs to the server.
func (r *ServerRepository) HasDocker(id string) (bool, error) {
	var has bool
	err := DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM agents WHERE server_id = ?)`, id).Scan(&has)
	return has, err
}

// DeleteEmpty deletes a server that owns no targets. sql.ErrNoRows when missing.
func (r *ServerRepository) DeleteEmpty(id string) error {
	result, err := DB.Exec(`DELETE FROM servers WHERE id = ?`, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func checkTargetServerTx(tx *sql.Tx, kind ServerTargetKind, serverID string) error {
	var exists, hasInfra bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM servers WHERE id = ?),
		EXISTS(SELECT 1 FROM hosts WHERE server_id = ? AND collector_type = 'otel-collector')`,
		serverID, serverID).Scan(&exists, &hasInfra); err != nil {
		return err
	}
	if !exists {
		return ErrServerMissing
	}
	if kind == ServerTargetInfra && hasInfra {
		return ErrServerHasInfrastructure
	}
	return nil
}

func serverNameError(err error) error {
	if err != nil && strings.Contains(err.Error(), "idx_servers_name_group") {
		return ErrServerNameTaken
	}
	return err
}

// migrateV58 introduces servers and moves every directly configured target
// that has no server yet under one (spec 5.4).
func migrateV58() error {
	for _, statement := range []string{
		`CREATE TABLE IF NOT EXISTS servers (
			id          TEXT PRIMARY KEY,
			name        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
			created_at  DATETIME NOT NULL,
			updated_at  DATETIME NOT NULL
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_name_group
			ON servers(lower(trim(name)), COALESCE(project_id, ''))`,
		`ALTER TABLE services          ADD COLUMN server_id TEXT REFERENCES servers(id)`,
		`ALTER TABLE observed_services ADD COLUMN server_id TEXT REFERENCES servers(id)`,
		`ALTER TABLE hosts             ADD COLUMN server_id TEXT REFERENCES servers(id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_server_id ON hosts(server_id) WHERE server_id IS NOT NULL`,
	} {
		if _, err := DB.Exec(statement); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}

	// Infrastructure first: a host name is the best server name.
	kinds := []struct {
		table, filter string
		forInfra      bool
	}{
		{"hosts", "t.collector_type = 'otel-collector'", true},
		{"observed_services", "1 = 1", false},
		{"services", "t.type IN ('http','tcp')", false},
	}
	now := time.Now()
	return Transaction(func(tx *sql.Tx) error {
		for _, kind := range kinds {
			// project_id may point at a deleted group: services and hosts have no foreign key on it,
			// and observed_services rows may have been written while foreign keys were off.
			rows, err := tx.Query(`SELECT t.id, t.name, COALESCE(p.id, '')
				FROM ` + kind.table + ` t LEFT JOIN projects p ON p.id = t.project_id
				WHERE t.server_id IS NULL AND ` + kind.filter + `
				ORDER BY t.created_at, t.id`)
			if err != nil {
				return err
			}
			var targets [][3]string
			for rows.Next() {
				var target [3]string
				if err := rows.Scan(&target[0], &target[1], &target[2]); err != nil {
					rows.Close()
					return err
				}
				targets = append(targets, target)
			}
			rows.Close()
			if err := rows.Err(); err != nil {
				return err
			}
			for _, target := range targets {
				// No Docker server exists before migrateV59, and agents.server_id does not either.
				serverID, err := resolveServerTx(tx, strings.TrimSpace(target[1]), target[2], kind.forInfra, false, now)
				if err != nil {
					return fmt.Errorf("%s %s: %w", kind.table, target[0], err)
				}
				if _, err := tx.Exec(`UPDATE `+kind.table+` SET server_id = ? WHERE id = ?`, serverID, target[0]); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// resolveServerTx applies the find-or-create rule (spec 5.4) and returns the server id.
// projectID "" means no group. forInfra makes a matching server that already owns an
// otel-collector host ineligible, so a suffixed server is created instead. excludeDocker
// skips servers that own a Docker Collector: a name only suggests the same host.
func resolveServerTx(tx *sql.Tx, name, projectID string, forInfra, excludeDocker bool, now time.Time) (string, error) {
	query := `SELECT id FROM servers WHERE lower(trim(name)) = lower(trim(?)) AND COALESCE(project_id, '') = ?`
	if excludeDocker {
		query += ` AND id NOT IN (` + dockerServerIDs + `)`
	}
	var id string
	err := tx.QueryRow(query, name, projectID).Scan(&id)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	if err == nil {
		if !forInfra {
			return id, nil
		}
		var hasInfra bool
		if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM hosts
			WHERE server_id = ? AND collector_type = 'otel-collector')`, id).Scan(&hasInfra); err != nil {
			return "", err
		}
		if !hasInfra {
			return id, nil
		}
	}

	freeName, err := nextFreeServerNameTx(tx, name, projectID)
	if err != nil {
		return "", err
	}
	id = uuid.NewString()
	if _, err := tx.Exec(`INSERT INTO servers (id, name, project_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)`, id, freeName, nullableProjectID(projectID), now, now); err != nil {
		return "", err
	}
	return id, nil
}

// nextFreeServerNameTx returns name, or name + " (2)", " (3)", ... — the first
// candidate not taken (case-insensitively, trimmed) within projectID.
func nextFreeServerNameTx(tx *sql.Tx, name, projectID string) (string, error) {
	candidate := name
	for n := 2; ; n++ {
		var taken bool
		if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM servers
			WHERE lower(trim(name)) = lower(trim(?)) AND COALESCE(project_id, '') = ?)`, candidate, projectID).Scan(&taken); err != nil {
			return "", err
		}
		if !taken {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s (%d)", name, n)
	}
}

// migrateV59 makes every active Docker environment a server (stage 1 of the server and Docker
// unification, plans/server-docker-unify-2026-11-22.md). Each agent gets a server with the
// agent's id, name and group; agents.server_id records the ownership, one Docker Collector per
// server. Same-name servers are never merged: the new server takes a suffix (" (2)") and a merge
// is suggested later. Collection keys (agent ids) do not change. Safe to rerun: only agents
// without a server are touched.
func migrateV59() error {
	for _, statement := range []string{
		`ALTER TABLE agents ADD COLUMN server_id TEXT REFERENCES servers(id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_server_id ON agents(server_id) WHERE server_id IS NOT NULL`,
	} {
		if _, err := DB.Exec(statement); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}
	return Transaction(func(tx *sql.Tx) error {
		// project_id may point at a deleted group: agents.project_id has no foreign key.
		rows, err := tx.Query(`SELECT a.id, a.name, COALESCE(p.id, '')
			FROM agents a LEFT JOIN projects p ON p.id = a.project_id
			WHERE a.server_id IS NULL AND COALESCE(a.status, 'active') = 'active'
			ORDER BY a.created_at, a.id`)
		if err != nil {
			return err
		}
		var agents [][3]string
		for rows.Next() {
			var agent [3]string
			if err := rows.Scan(&agent[0], &agent[1], &agent[2]); err != nil {
				rows.Close()
				return err
			}
			agents = append(agents, agent)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		now := time.Now()
		for _, agent := range agents {
			if err := attachAgentServerTx(tx, agent[0], agent[1], agent[2], now); err != nil {
				return fmt.Errorf("agent %s: %w", agent[0], err)
			}
		}
		return nil
	})
}

// attachAgentServerTx creates the server of a Docker environment (id = agent id) unless it
// exists, and records the ownership. The name is the environment's, suffixed when the group
// already has a server with that name.
func attachAgentServerTx(tx *sql.Tx, agentID, name, projectID string, now time.Time) error {
	var exists bool
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM servers WHERE id = ?)`, agentID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		freeName, err := nextFreeServerNameTx(tx, strings.TrimSpace(name), projectID)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT INTO servers (id, name, project_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?)`, agentID, freeName, nullableProjectID(projectID), now, now); err != nil {
			return err
		}
	}
	_, err := tx.Exec(`UPDATE agents SET server_id = ?, project_id = ? WHERE id = ?`, agentID, nullableProjectID(projectID), agentID)
	return err
}
