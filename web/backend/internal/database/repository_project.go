package database

import (
	"database/sql"
	"errors"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

type ProjectRepository struct{}

func NewProjectRepository() *ProjectRepository { return &ProjectRepository{} }

func (r *ProjectRepository) GetAll() ([]models.Project, error) {
	rows, err := DB.Query(`
		SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
			(SELECT COUNT(*) FROM agents a WHERE a.project_id = p.id AND COALESCE(a.status, 'active') = 'active'),
			(SELECT COUNT(*) FROM servers sv WHERE sv.project_id = p.id),
			(SELECT COUNT(*) FROM services s JOIN servers sv ON sv.id = s.server_id WHERE sv.project_id = p.id AND s.type IN ('http', 'tcp')),
			(SELECT COUNT(*) FROM observed_services os JOIN servers sv ON sv.id = os.server_id WHERE sv.project_id = p.id),
			(SELECT COUNT(*) FROM hosts h JOIN servers sv ON sv.id = h.server_id WHERE sv.project_id = p.id AND h.collector_type = 'otel-collector')
		FROM projects p ORDER BY p.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projects := make([]models.Project, 0)
	for rows.Next() {
		var project models.Project
		if err := rows.Scan(&project.ID, &project.Name, &project.Description, &project.CreatedAt, &project.UpdatedAt, &project.AgentCount, &project.ServerCount, &project.MonitorCount, &project.ObservedServiceCount, &project.InfrastructureResourceCount); err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

func (r *ProjectRepository) Create(project *models.Project) error {
	now := time.Now()
	project.CreatedAt, project.UpdatedAt = now, now
	_, err := DB.Exec(`INSERT INTO projects(id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, project.ID, project.Name, project.Description, now, now)
	return err
}

func (r *ProjectRepository) Exists(id string) (bool, error) {
	var found int
	err := DB.QueryRow(`SELECT 1 FROM projects WHERE id = ?`, id).Scan(&found)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func (r *ProjectRepository) Update(project *models.Project) error {
	project.UpdatedAt = time.Now()
	result, err := DB.Exec(`UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?`, project.Name, project.Description, project.UpdatedAt, project.ID)
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

func (r *ProjectRepository) Delete(id string) error {
	return Transaction(func(tx *sql.Tx) error {
		type groupServer struct{ id, name string }
		rows, err := tx.Query(`SELECT id, name FROM servers WHERE project_id = ?`, id)
		if err != nil {
			return err
		}
		var servers []groupServer
		for rows.Next() {
			var server groupServer
			if err := rows.Scan(&server.id, &server.name); err != nil {
				rows.Close()
				return err
			}
			servers = append(servers, server)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}

		// One server at a time, so each rename sees the names freed up before it.
		now := time.Now()
		for _, server := range servers {
			name, err := nextFreeServerNameTx(tx, server.name, "")
			if err != nil {
				return err
			}
			if _, err := tx.Exec(`UPDATE servers SET name = ?, project_id = NULL, updated_at = ? WHERE id = ?`, name, now, server.id); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(`UPDATE agents SET project_id = NULL WHERE project_id = ?`, id); err != nil {
			return err
		}
		result, err := tx.Exec(`DELETE FROM projects WHERE id = ?`, id)
		if err != nil {
			return err
		}
		affected, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if affected == 0 {
			return sql.ErrNoRows
		}
		return nil
	})
}

// AssignAgent moves a Docker environment and its server into projectID. A same-name server
// there is never merged with it: the server takes a suffixed name instead.
func (r *ProjectRepository) AssignAgent(projectID, agentID string) error {
	return Transaction(func(tx *sql.Tx) error {
		now := time.Now()
		result, err := tx.Exec(`UPDATE agents SET project_id = ?, updated_at = ? WHERE id = ? AND COALESCE(status, 'active') = 'active'`, nullableProjectID(projectID), now, agentID)
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
		var serverID, name, current string
		err = tx.QueryRow(`SELECT s.id, s.name, COALESCE(s.project_id, '') FROM agents a JOIN servers s ON s.id = a.server_id WHERE a.id = ?`, agentID).Scan(&serverID, &name, &current)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && current == projectID) {
			return nil
		}
		if err != nil {
			return err
		}
		if name, err = nextFreeServerNameTx(tx, name, projectID); err != nil {
			return err
		}
		_, err = tx.Exec(`UPDATE servers SET name = ?, project_id = ?, updated_at = ? WHERE id = ?`, name, nullableProjectID(projectID), now, serverID)
		return err
	})
}

// AssignMonitor moves the monitor's server, and so every target on it, into projectID.
func (r *ProjectRepository) AssignMonitor(projectID, monitorID string) error {
	return NewServerRepository().SetProjectForTarget(ServerTargetMonitor, monitorID, projectID)
}

func nullableProjectID(projectID string) interface{} {
	if projectID == "" {
		return nil
	}
	return projectID
}
