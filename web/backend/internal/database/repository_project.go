package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

type ProjectRepository struct{}

func NewProjectRepository() *ProjectRepository { return &ProjectRepository{} }

func (r *ProjectRepository) GetAll() ([]models.Project, error) {
	rows, err := DB.Query(`
		SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
			(SELECT COUNT(*) FROM agents a WHERE a.project_id = p.id AND COALESCE(a.status, 'active') = 'active'),
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
		if err := rows.Scan(&project.ID, &project.Name, &project.Description, &project.CreatedAt, &project.UpdatedAt, &project.AgentCount, &project.MonitorCount, &project.ObservedServiceCount, &project.InfrastructureResourceCount); err != nil {
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
		result, err := tx.Exec(`DELETE FROM projects WHERE id = ?`, id)
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
		if _, err := tx.Exec(`UPDATE agents SET project_id = NULL WHERE project_id = ?`, id); err != nil {
			return err
		}
		if _, err = tx.Exec(`UPDATE services SET project_id = NULL WHERE project_id = ?`, id); err != nil {
			return err
		}
		if _, err = tx.Exec(`UPDATE observed_services SET project_id = NULL WHERE project_id = ?`, id); err != nil {
			return err
		}
		_, err = tx.Exec(`UPDATE hosts SET project_id = NULL WHERE project_id = ?`, id)
		return err
	})
}

func (r *ProjectRepository) AssignAgent(projectID, agentID string) error {
	result, err := DB.Exec(`UPDATE agents SET project_id = ?, updated_at = ? WHERE id = ? AND COALESCE(status, 'active') = 'active'`, nullableProjectID(projectID), time.Now(), agentID)
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
