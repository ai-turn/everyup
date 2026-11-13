package database

import (
	"database/sql"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// NotificationHistoryRepository handles notification history data operations
type NotificationHistoryRepository struct{}

// NewNotificationHistoryRepository creates a new notification history repository
func NewNotificationHistoryRepository() *NotificationHistoryRepository {
	return &NotificationHistoryRepository{}
}

// Create adds a new notification history record
func (r *NotificationHistoryRepository) Create(history *models.NotificationHistory) error {
	query := `
		INSERT INTO notification_history (
			rule_id, channel_id, channel_name, channel_type,
			alert_type, severity, host_id, host_name,
			service_id, service_name, message, status,
			error_message, retry_count, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	result, err := DB.Exec(query,
		history.RuleID,
		history.ChannelID,
		history.ChannelName,
		history.ChannelType,
		history.AlertType,
		history.Severity,
		history.HostID,
		history.HostName,
		history.ServiceID,
		history.ServiceName,
		history.Message,
		history.Status,
		history.ErrorMessage,
		history.RetryCount,
		history.CreatedAt,
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	history.ID = int(id)
	return nil
}

// UpdateStatus updates the status of a notification
func (r *NotificationHistoryRepository) UpdateStatus(id int, status string, errorMessage string) error {
	var sentAt *time.Time
	if status == "sent" {
		now := time.Now()
		sentAt = &now
	}

	query := `
		UPDATE notification_history
		SET status = ?, error_message = ?, sent_at = ?
		WHERE id = ?
	`
	_, err := DB.Exec(query, status, errorMessage, sentAt, id)
	return err
}

// IncrementRetry increments the retry count
func (r *NotificationHistoryRepository) IncrementRetry(id int) error {
	query := `UPDATE notification_history SET retry_count = retry_count + 1 WHERE id = ?`
	_, err := DB.Exec(query, id)
	return err
}

// GetByID retrieves a notification history by ID
func (r *NotificationHistoryRepository) GetByID(id int) (*models.NotificationHistory, error) {
	query := `
		SELECT id, rule_id, channel_id, channel_name, channel_type,
		       alert_type, severity, host_id, host_name,
		       service_id, service_name, message, status,
		       error_message, retry_count, created_at, sent_at
		FROM notification_history
		WHERE id = ?
	`

	var history models.NotificationHistory
	var ruleID, severity, hostID, hostName, serviceID, serviceName, errorMessage sql.NullString
	var sentAt sql.NullTime

	err := DB.QueryRow(query, id).Scan(
		&history.ID,
		&ruleID,
		&history.ChannelID,
		&history.ChannelName,
		&history.ChannelType,
		&history.AlertType,
		&severity,
		&hostID,
		&hostName,
		&serviceID,
		&serviceName,
		&history.Message,
		&history.Status,
		&errorMessage,
		&history.RetryCount,
		&history.CreatedAt,
		&sentAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Convert nullable fields
	if ruleID.Valid {
		history.RuleID = &ruleID.String
	}
	if severity.Valid {
		history.Severity = severity.String
	}
	if hostID.Valid {
		history.HostID = &hostID.String
	}
	if hostName.Valid {
		history.HostName = &hostName.String
	}
	if serviceID.Valid {
		history.ServiceID = &serviceID.String
	}
	if serviceName.Valid {
		history.ServiceName = &serviceName.String
	}
	if errorMessage.Valid {
		history.ErrorMessage = &errorMessage.String
	}
	if sentAt.Valid {
		history.SentAt = &sentAt.Time
	}

	return &history, nil
}

// GetAll retrieves notification history with optional filters
func (r *NotificationHistoryRepository) GetAll(filter *models.NotificationHistoryFilter) ([]models.NotificationHistory, error) {
	query := `
		SELECT id, rule_id, channel_id, channel_name, channel_type,
		       alert_type, severity, host_id, host_name,
		       service_id, service_name, message, status,
		       error_message, retry_count, created_at, sent_at
		FROM notification_history
		WHERE 1=1
	`
	args := []interface{}{}

	// Apply filters
	if filter != nil {
		if filter.ChannelID != nil {
			query += " AND channel_id = ?"
			args = append(args, *filter.ChannelID)
		}
		if filter.AlertType != nil {
			clause, typeArgs := alertTypeClause(*filter.AlertType)
			query += clause
			args = append(args, typeArgs...)
		}
		if filter.Status != nil {
			query += " AND status = ?"
			args = append(args, *filter.Status)
		}
		if filter.Search != nil {
			query += " AND message LIKE ?"
			args = append(args, "%"+*filter.Search+"%")
		}
		if filter.FromDate != nil {
			query += " AND created_at >= ?"
			args = append(args, *filter.FromDate)
		}
		if filter.ToDate != nil {
			query += " AND created_at <= ?"
			args = append(args, *filter.ToDate)
		}
	}

	query += " ORDER BY created_at DESC"

	// Apply pagination
	if filter != nil {
		if filter.Limit > 0 {
			query += " LIMIT ?"
			args = append(args, filter.Limit)
		}
		if filter.Offset > 0 {
			query += " OFFSET ?"
			args = append(args, filter.Offset)
		}
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var histories []models.NotificationHistory
	for rows.Next() {
		var history models.NotificationHistory
		var ruleID, severity, hostID, hostName, serviceID, serviceName, errorMessage sql.NullString
		var sentAt sql.NullTime

		err := rows.Scan(
			&history.ID,
			&ruleID,
			&history.ChannelID,
			&history.ChannelName,
			&history.ChannelType,
			&history.AlertType,
			&severity,
			&hostID,
			&hostName,
			&serviceID,
			&serviceName,
			&history.Message,
			&history.Status,
			&errorMessage,
			&history.RetryCount,
			&history.CreatedAt,
			&sentAt,
		)
		if err != nil {
			return nil, err
		}

		// Convert nullable fields
		if ruleID.Valid {
			history.RuleID = &ruleID.String
		}
		if severity.Valid {
			history.Severity = severity.String
		}
		if hostID.Valid {
			history.HostID = &hostID.String
		}
		if hostName.Valid {
			history.HostName = &hostName.String
		}
		if serviceID.Valid {
			history.ServiceID = &serviceID.String
		}
		if serviceName.Valid {
			history.ServiceName = &serviceName.String
		}
		if errorMessage.Valid {
			history.ErrorMessage = &errorMessage.String
		}
		if sentAt.Valid {
			history.SentAt = &sentAt.Time
		}

		histories = append(histories, history)
	}

	return histories, nil
}

// GetCount returns total count with filters
func (r *NotificationHistoryRepository) GetCount(filter *models.NotificationHistoryFilter) (int, error) {
	query := "SELECT COUNT(*) FROM notification_history WHERE 1=1"
	args := []interface{}{}

	if filter != nil {
		if filter.ChannelID != nil {
			query += " AND channel_id = ?"
			args = append(args, *filter.ChannelID)
		}
		if filter.AlertType != nil {
			clause, typeArgs := alertTypeClause(*filter.AlertType)
			query += clause
			args = append(args, typeArgs...)
		}
		if filter.Status != nil {
			query += " AND status = ?"
			args = append(args, *filter.Status)
		}
		if filter.Search != nil {
			query += " AND message LIKE ?"
			args = append(args, "%"+*filter.Search+"%")
		}
		if filter.FromDate != nil {
			query += " AND created_at >= ?"
			args = append(args, *filter.FromDate)
		}
		if filter.ToDate != nil {
			query += " AND created_at <= ?"
			args = append(args, *filter.ToDate)
		}
	}

	var count int
	err := DB.QueryRow(query, args...).Scan(&count)
	return count, err
}

// GetStats returns aggregated statistics
func (r *NotificationHistoryRepository) GetStats(days int) (map[string]interface{}, error) {
	cutoff := time.Now().AddDate(0, 0, -days)

	// Total sent
	var totalSent int
	err := DB.QueryRow(`
		SELECT COUNT(*) FROM notification_history
		WHERE created_at >= ? AND status = 'sent'
	`, cutoff).Scan(&totalSent)
	if err != nil {
		return nil, err
	}

	// Total failed
	var totalFailed int
	err = DB.QueryRow(`
		SELECT COUNT(*) FROM notification_history
		WHERE created_at >= ? AND status = 'failed'
	`, cutoff).Scan(&totalFailed)
	if err != nil {
		return nil, err
	}

	// By channel
	byChannel := make(map[string]int)
	rows, err := DB.Query(`
		SELECT channel_name, COUNT(*) as count
		FROM notification_history
		WHERE created_at >= ?
		GROUP BY channel_name
	`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		var count int
		if err := rows.Scan(&name, &count); err != nil {
			return nil, err
		}
		byChannel[name] = count
	}

	// By alert type
	byAlertType := make(map[string]int)
	rows2, err := DB.Query(`
		SELECT alert_type, COUNT(*) as count
		FROM notification_history
		WHERE created_at >= ?
		GROUP BY alert_type
	`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	for rows2.Next() {
		var alertType string
		var count int
		if err := rows2.Scan(&alertType, &count); err != nil {
			return nil, err
		}
		byAlertType[alertType] = count
	}

	return map[string]interface{}{
		"totalSent":   totalSent,
		"totalFailed": totalFailed,
		"successRate": float64(totalSent) / float64(totalSent+totalFailed) * 100,
		"byChannel":   byChannel,
		"byAlertType": byAlertType,
	}, nil
}

// DeleteOlderThan deletes records older than the specified duration
func (r *NotificationHistoryRepository) DeleteOlderThan(days int) (int64, error) {
	cutoff := time.Now().AddDate(0, 0, -days)
	result, err := DB.Exec(`
		DELETE FROM notification_history WHERE created_at < ?
	`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// alertTypeClause matches one stored alert type or a comma list of them, so a
// UI category can span several types (헬스체크 = endpoint + healthcheck).
func alertTypeClause(value string) (string, []interface{}) {
	var args []interface{}
	for _, t := range strings.Split(value, ",") {
		if t = strings.TrimSpace(t); t != "" {
			args = append(args, t)
		}
	}
	if len(args) == 0 {
		return "", nil
	}
	return " AND alert_type IN (?" + strings.Repeat(", ?", len(args)-1) + ")", args
}
