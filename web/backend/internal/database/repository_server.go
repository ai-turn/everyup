package database

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

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
			// Target project_id has no foreign key, so it may point at a deleted group.
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
				serverID, err := resolveServerTx(tx, strings.TrimSpace(target[1]), target[2], kind.forInfra, now)
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
// otel-collector host ineligible, so a suffixed server is created instead.
func resolveServerTx(tx *sql.Tx, name, projectID string, forInfra bool, now time.Time) (string, error) {
	var id string
	err := tx.QueryRow(`SELECT id FROM servers
		WHERE lower(trim(name)) = lower(trim(?)) AND COALESCE(project_id, '') = ?`, name, projectID).Scan(&id)
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
