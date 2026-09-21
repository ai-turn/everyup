package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// IncidentRepository handles incident data operations
type IncidentRepository struct{}

// NewIncidentRepository creates a new incident repository
func NewIncidentRepository() *IncidentRepository {
	return &IncidentRepository{}
}

// UptimeIncident is one episode from the `incidents` table joined to the uptime
// monitor that produced it. Unlike Docker episodes these are stored explicitly
// by the checker, so start/end and message are recorded rather than derived.
type UptimeIncident struct {
	ServiceID   string
	ServiceName string
	Message     string
	StartedAt   time.Time
	ResolvedAt  *time.Time
}

// GetRecentUptimeIncidents returns uptime-monitor episodes started within the
// window, newest first. Episodes that began before the window but are still
// open are included — an outage running for a week is exactly what a timeline
// must not hide.
func (r *IncidentRepository) GetRecentUptimeIncidents(days, limit int) ([]UptimeIncident, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	since := time.Now().AddDate(0, 0, -days)
	rows, err := DB.Query(`
SELECT i.service_id, COALESCE(s.name, i.service_id), COALESCE(i.message, ''), i.started_at, i.resolved_at
FROM incidents i
LEFT JOIN services s ON s.id = i.service_id
WHERE i.started_at >= ? OR i.resolved_at IS NULL
ORDER BY i.started_at DESC
LIMIT ?`, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]UptimeIncident, 0)
	for rows.Next() {
		var in UptimeIncident
		var resolved sql.NullTime
		if err := rows.Scan(&in.ServiceID, &in.ServiceName, &in.Message, &in.StartedAt, &resolved); err != nil {
			return nil, err
		}
		if resolved.Valid {
			in.ResolvedAt = &resolved.Time
		}
		out = append(out, in)
	}
	return out, rows.Err()
}

// Create creates a new incident
func (r *IncidentRepository) Create(i *models.Incident) error {
	result, err := DB.Exec(`
		INSERT INTO incidents (service_id, type, message, started_at)
		VALUES (?, ?, ?, ?)
	`, i.ServiceID, i.Type, i.Message, i.StartedAt)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	i.ID = id
	return nil
}

// GetActive returns all active (unresolved) incidents
func (r *IncidentRepository) GetActive() ([]models.Incident, error) {
	rows, err := DB.Query(`
		SELECT id, service_id, type, message, started_at, resolved_at
		FROM incidents
		WHERE resolved_at IS NULL
		ORDER BY started_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var incidents []models.Incident
	for rows.Next() {
		var i models.Incident
		var resolvedAt sql.NullTime
		var message sql.NullString
		if err := rows.Scan(&i.ID, &i.ServiceID, &i.Type, &message, &i.StartedAt, &resolvedAt); err != nil {
			return nil, err
		}
		if message.Valid {
			i.Message = message.String
		}
		if resolvedAt.Valid {
			i.ResolvedAt = &resolvedAt.Time
		}
		incidents = append(incidents, i)
	}
	return incidents, nil
}

// Resolve resolves an incident
func (r *IncidentRepository) Resolve(serviceID string) error {
	_, err := DB.Exec(`
		UPDATE incidents SET resolved_at = ?
		WHERE service_id = ? AND resolved_at IS NULL
	`, time.Now(), serviceID)
	return err
}

// GetTimeline returns recent events as a timeline
func (r *IncidentRepository) GetTimeline(limit int) ([]models.TimelineEvent, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := DB.Query(`
		SELECT i.id, i.started_at, i.type, s.name, i.message, i.service_id
		FROM incidents i
		JOIN services s ON i.service_id = s.id
		ORDER BY i.started_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.TimelineEvent
	for rows.Next() {
		var e models.TimelineEvent
		var message sql.NullString
		if err := rows.Scan(&e.ID, &e.Time, &e.Type, &e.Service, &message, &e.ServiceID); err != nil {
			return nil, err
		}
		if message.Valid {
			e.Message = message.String
		}
		events = append(events, e)
	}
	return events, nil
}
