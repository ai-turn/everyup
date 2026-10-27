package database

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/models"
)

// ServiceRepository handles service data operations
type ServiceRepository struct{}

// NewServiceRepository creates a new service repository
func NewServiceRepository() *ServiceRepository {
	return &ServiceRepository{}
}

// unmarshalLogLevelFilter parses a nullable JSON string into []models.LogLevel.
// Returns nil if the column is NULL or empty (= accept all levels).
func unmarshalLogLevelFilter(col sql.NullString) []models.LogLevel {
	if !col.Valid || col.String == "" || col.String == "[]" || col.String == "null" {
		return nil
	}
	var levels []models.LogLevel
	json.Unmarshal([]byte(col.String), &levels)
	return levels
}

// marshalLogLevelFilter serialises []models.LogLevel to a JSON string for storage.
// nil / empty slice → NULL (accept all).
func marshalLogLevelFilter(filter []models.LogLevel) interface{} {
	if len(filter) == 0 {
		return nil
	}
	b, _ := json.Marshal(filter)
	return string(b)
}

// unmarshalStringList parses a nullable JSON array column into []string.
// Returns nil for NULL / empty / "[]" — caller can treat nil as empty list.
func unmarshalStringList(col sql.NullString) []string {
	if !col.Valid || col.String == "" || col.String == "[]" || col.String == "null" {
		return nil
	}
	var out []string
	json.Unmarshal([]byte(col.String), &out)
	return out
}

// marshalStringList serialises []string to a JSON string for storage.
// nil → "[]" so the column has a stable shape (preserves default).
func marshalStringList(list []string) string {
	if len(list) == 0 {
		return "[]"
	}
	b, _ := json.Marshal(list)
	return string(b)
}

// GetAll returns all services, optionally filtered by type.
// Example: GetAll("http", "tcp") returns only http and tcp services.
// Call with no arguments to return all services.
func (r *ServiceRepository) GetAll(typeFilter ...string) ([]models.Service, error) {
	query := `SELECT id, name, COALESCE(project_id, ''), type, is_active, url, port, method, headers, body,
		       expected_status, interval, timeout, tags, schedule_type, cron_expression,
		       api_key_masked, log_level_filter, api_exclude_paths, created_at, updated_at
		FROM services`

	var args []interface{}
	if len(typeFilter) > 0 {
		placeholders := make([]string, len(typeFilter))
		for i, t := range typeFilter {
			placeholders[i] = "?"
			args = append(args, t)
		}
		query += " WHERE type IN (" + strings.Join(placeholders, ",") + ")"
	}
	query += " ORDER BY name"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var s models.Service
		var isActive int
		var url, method, headers, body, tags, scheduleType, cronExpression sql.NullString
		var port, expectedStatus, interval, timeout sql.NullInt64
		var apiKeyMasked, logLevelFilter, apiExcludePaths sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &s.ProjectID, &s.Type, &isActive, &url, &port, &method, &headers, &body,
			&expectedStatus, &interval, &timeout, &tags, &scheduleType, &cronExpression,
			&apiKeyMasked, &logLevelFilter, &apiExcludePaths, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		s.IsActive = isActive == 1
		if url.Valid {
			s.URL = url.String
		}
		if port.Valid {
			s.Port = int(port.Int64)
		}
		if method.Valid {
			s.Method = method.String
		}
		if headers.Valid && headers.String != "" {
			json.Unmarshal([]byte(headers.String), &s.Headers)
		}
		if body.Valid {
			s.Body = body.String
		}
		if expectedStatus.Valid {
			s.ExpectedStatus = int(expectedStatus.Int64)
		}
		if interval.Valid {
			s.Interval = int(interval.Int64)
		}
		if timeout.Valid {
			s.Timeout = int(timeout.Int64)
		}
		if tags.Valid && tags.String != "" {
			json.Unmarshal([]byte(tags.String), &s.Tags)
		}
		if scheduleType.Valid {
			s.ScheduleType = models.ScheduleType(scheduleType.String)
		} else {
			s.ScheduleType = models.ScheduleTypeInterval
		}
		if cronExpression.Valid {
			s.CronExpression = cronExpression.String
		}
		if apiKeyMasked.Valid {
			s.ApiKeyMasked = apiKeyMasked.String
		}
		s.LogLevelFilter = unmarshalLogLevelFilter(logLevelFilter)
		s.ApiExcludePaths = unmarshalStringList(apiExcludePaths)
		s.Status = models.StatusUnknown
		services = append(services, s)
	}
	return services, nil
}

// GetByID returns a service by ID
func (r *ServiceRepository) GetByID(id string) (*models.Service, error) {
	var s models.Service
	var isActive int
	var url, method, headers, body, tags, scheduleType, cronExpression sql.NullString
	var port, expectedStatus, interval, timeout sql.NullInt64
	var apiKeyHash, apiKeyMasked, logLevelFilter, apiExcludePaths sql.NullString
	var certExpiresAt sql.NullTime

	err := DB.QueryRow(`
		SELECT id, name, COALESCE(project_id, ''), type, is_active, url, port, method, headers, body,
		       expected_status, interval, timeout, tags, schedule_type, cron_expression,
		       api_key, api_key_masked, log_level_filter, api_exclude_paths, cert_expires_at, created_at, updated_at
		FROM services WHERE id = ?
	`, id).Scan(&s.ID, &s.Name, &s.ProjectID, &s.Type, &isActive, &url, &port, &method, &headers, &body,
		&expectedStatus, &interval, &timeout, &tags, &scheduleType, &cronExpression,
		&apiKeyHash, &apiKeyMasked, &logLevelFilter, &apiExcludePaths, &certExpiresAt, &s.CreatedAt, &s.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	s.IsActive = isActive == 1
	if url.Valid {
		s.URL = url.String
	}
	if port.Valid {
		s.Port = int(port.Int64)
	}
	if method.Valid {
		s.Method = method.String
	}
	if headers.Valid && headers.String != "" {
		json.Unmarshal([]byte(headers.String), &s.Headers)
	}
	if body.Valid {
		s.Body = body.String
	}
	if expectedStatus.Valid {
		s.ExpectedStatus = int(expectedStatus.Int64)
	}
	if interval.Valid {
		s.Interval = int(interval.Int64)
	}
	if timeout.Valid {
		s.Timeout = int(timeout.Int64)
	}
	if tags.Valid && tags.String != "" {
		json.Unmarshal([]byte(tags.String), &s.Tags)
	}
	if scheduleType.Valid {
		s.ScheduleType = models.ScheduleType(scheduleType.String)
	} else {
		s.ScheduleType = models.ScheduleTypeInterval
	}
	if cronExpression.Valid {
		s.CronExpression = cronExpression.String
	}
	if apiKeyHash.Valid {
		s.ApiKey = apiKeyHash.String // hash — used internally for cache invalidation
	}
	if apiKeyMasked.Valid {
		s.ApiKeyMasked = apiKeyMasked.String
	}
	s.LogLevelFilter = unmarshalLogLevelFilter(logLevelFilter)
	s.ApiExcludePaths = unmarshalStringList(apiExcludePaths)
	if certExpiresAt.Valid {
		s.CertExpiresAt = &certExpiresAt.Time
	}
	s.Status = models.StatusUnknown

	return &s, nil
}

// SetCertExpiry records the TLS certificate expiry the checker saw.
func (r *ServiceRepository) SetCertExpiry(id string, expiresAt time.Time) error {
	_, err := DB.Exec(`UPDATE services SET cert_expires_at = ? WHERE id = ?`, expiresAt.UTC(), id)
	return err
}

// migrateV55 adds the TLS certificate expiry an HTTPS uptime check observed.
func migrateV55() error {
	if _, err := DB.Exec(`ALTER TABLE services ADD COLUMN cert_expires_at DATETIME`); err != nil && !isDuplicateColumnError(err) {
		return err
	}
	return nil
}

// Create creates a new service
func (r *ServiceRepository) Create(s *models.Service) error {
	var headersJSON, tagsJSON []byte
	var err error

	if s.Headers != nil {
		headersJSON, err = json.Marshal(s.Headers)
		if err != nil {
			return err
		}
	}
	if s.Tags != nil {
		tagsJSON, err = json.Marshal(s.Tags)
		if err != nil {
			return err
		}
	}

	isActive := 0
	if s.IsActive {
		isActive = 1
	}

	// Default to "interval" if not set
	scheduleType := string(s.ScheduleType)
	if scheduleType == "" {
		scheduleType = string(models.ScheduleTypeInterval)
	}

	_, err = DB.Exec(`
		INSERT INTO services (id, name, type, is_active, url, port, method, headers, body,
		                      expected_status, interval, timeout, tags, schedule_type, cron_expression,
		                      api_key, api_key_masked, log_level_filter, api_exclude_paths, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, s.ID, s.Name, s.Type, isActive, s.URL, s.Port, s.Method, string(headersJSON), s.Body,
		s.ExpectedStatus, s.Interval, s.Timeout, string(tagsJSON), scheduleType, s.CronExpression,
		crypto.HashApiKey(s.ApiKey), s.ApiKeyMasked, marshalLogLevelFilter(s.LogLevelFilter),
		marshalStringList(s.ApiExcludePaths), s.CreatedAt, s.UpdatedAt)
	return err
}

// Update updates a service
func (r *ServiceRepository) Update(s *models.Service) error {
	var headersJSON, tagsJSON []byte
	var err error

	if s.Headers != nil {
		headersJSON, err = json.Marshal(s.Headers)
		if err != nil {
			return err
		}
	}
	if s.Tags != nil {
		tagsJSON, err = json.Marshal(s.Tags)
		if err != nil {
			return err
		}
	}

	isActive := 0
	if s.IsActive {
		isActive = 1
	}

	// Default to "interval" if not set
	scheduleType := string(s.ScheduleType)
	if scheduleType == "" {
		scheduleType = string(models.ScheduleTypeInterval)
	}

	s.UpdatedAt = time.Now()
	_, err = DB.Exec(`
		UPDATE services SET name = ?, type = ?, is_active = ?, url = ?, port = ?, method = ?,
		                    headers = ?, body = ?, expected_status = ?, interval = ?, timeout = ?,
		                    tags = ?, schedule_type = ?, cron_expression = ?,
		                    log_level_filter = ?, api_exclude_paths = ?, updated_at = ?,
		                    -- RHS sees the old url: a certificate seen at another address no longer applies.
		                    cert_expires_at = CASE WHEN url = ? THEN cert_expires_at ELSE NULL END
		WHERE id = ?
	`, s.Name, s.Type, isActive, s.URL, s.Port, s.Method, string(headersJSON), s.Body,
		s.ExpectedStatus, s.Interval, s.Timeout, string(tagsJSON), scheduleType, s.CronExpression,
		marshalLogLevelFilter(s.LogLevelFilter), marshalStringList(s.ApiExcludePaths), s.UpdatedAt, s.URL, s.ID)
	return err
}

// Delete removes a configured monitor and its persisted check history through
// the services foreign-key relationship.
func (r *ServiceRepository) Delete(id string) error {
	result, err := DB.Exec(`DELETE FROM services WHERE id = ?`, id)
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

// GetActive returns all active services (is_active = 1)
func (r *ServiceRepository) GetActive() ([]models.Service, error) {
	rows, err := DB.Query(`
		SELECT id, name, type, is_active, url, port, method, headers, body,
		       expected_status, interval, timeout, tags, schedule_type, cron_expression,
		       created_at, updated_at
		FROM services
		WHERE is_active = 1
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []models.Service
	for rows.Next() {
		var s models.Service
		var isActive int
		var url, method, headers, body, tags, scheduleType, cronExpression sql.NullString
		var port, expectedStatus, interval, timeout sql.NullInt64
		if err := rows.Scan(&s.ID, &s.Name, &s.Type, &isActive, &url, &port, &method, &headers, &body,
			&expectedStatus, &interval, &timeout, &tags, &scheduleType, &cronExpression,
			&s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		s.IsActive = isActive == 1
		if url.Valid {
			s.URL = url.String
		}
		if port.Valid {
			s.Port = int(port.Int64)
		}
		if method.Valid {
			s.Method = method.String
		}
		if headers.Valid && headers.String != "" {
			json.Unmarshal([]byte(headers.String), &s.Headers)
		}
		if body.Valid {
			s.Body = body.String
		}
		if expectedStatus.Valid {
			s.ExpectedStatus = int(expectedStatus.Int64)
		}
		if interval.Valid {
			s.Interval = int(interval.Int64)
		}
		if timeout.Valid {
			s.Timeout = int(timeout.Int64)
		}
		if tags.Valid && tags.String != "" {
			json.Unmarshal([]byte(tags.String), &s.Tags)
		}
		if scheduleType.Valid {
			s.ScheduleType = models.ScheduleType(scheduleType.String)
		} else {
			s.ScheduleType = models.ScheduleTypeInterval
		}
		if cronExpression.Valid {
			s.CronExpression = cronExpression.String
		}
		s.Status = models.StatusUnknown
		services = append(services, s)
	}
	return services, nil
}

// GetByApiKeyHash returns a service by its pre-hashed API key.
// Includes log_level_filter so the ingest handler can apply per-service filtering.
func (r *ServiceRepository) GetByApiKeyHash(apiKeyHash string) (*models.Service, error) {
	if apiKeyHash == "" {
		return nil, nil
	}
	var s models.Service
	var isActive int
	var url, method, body sql.NullString
	var port, expectedStatus, interval, timeout sql.NullInt64
	var headersJSON, tagsJSON, logLevelFilter, apiExcludePaths sql.NullString

	err := DB.QueryRow(`
		SELECT id, name, type, is_active, url, port, method, headers, body,
		       expected_status, interval, timeout, tags, log_level_filter, api_exclude_paths, created_at, updated_at
		FROM services WHERE api_key = ?
	`, apiKeyHash).Scan(&s.ID, &s.Name, &s.Type, &isActive, &url, &port, &method,
		&headersJSON, &body, &expectedStatus, &interval, &timeout,
		&tagsJSON, &logLevelFilter, &apiExcludePaths, &s.CreatedAt, &s.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	s.IsActive = isActive == 1
	if url.Valid {
		s.URL = url.String
	}
	if port.Valid {
		s.Port = int(port.Int64)
	}
	if method.Valid {
		s.Method = method.String
	}
	if body.Valid {
		s.Body = body.String
	}
	if expectedStatus.Valid {
		s.ExpectedStatus = int(expectedStatus.Int64)
	}
	if interval.Valid {
		s.Interval = int(interval.Int64)
	}
	if timeout.Valid {
		s.Timeout = int(timeout.Int64)
	}
	if headersJSON.Valid && headersJSON.String != "" {
		json.Unmarshal([]byte(headersJSON.String), &s.Headers)
	}
	if tagsJSON.Valid && tagsJSON.String != "" {
		json.Unmarshal([]byte(tagsJSON.String), &s.Tags)
	}
	s.LogLevelFilter = unmarshalLogLevelFilter(logLevelFilter)
	s.ApiExcludePaths = unmarshalStringList(apiExcludePaths)

	return &s, nil
}
