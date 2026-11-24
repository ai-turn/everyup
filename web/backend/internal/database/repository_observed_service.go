package database

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// ObservedServiceRepository persists directly created Observed Services and
// their one-to-one telemetry connections.
type ObservedServiceRepository struct{}

func NewObservedServiceRepository() *ObservedServiceRepository {
	return &ObservedServiceRepository{}
}

type observedServiceScanner interface {
	Scan(dest ...interface{}) error
}

const observedServiceSelect = `
	o.id, o.name, COALESCE(o.server_id, ''), c.signals, c.log_level_filter, c.api_exclude_paths, c.is_active,
	c.api_key_masked, c.last_seen_at, o.created_at, o.updated_at`

func scanObservedService(scanner observedServiceScanner) (*models.ObservedService, error) {
	var service models.ObservedService
	var signalsJSON string
	var logLevelFilter sql.NullString
	var apiExcludePaths sql.NullString
	var isActive int
	var lastSeen sql.NullTime
	if err := scanner.Scan(
		&service.ID, &service.Name, &service.ServerID, &signalsJSON, &logLevelFilter, &apiExcludePaths, &isActive,
		&service.ApiKeyMasked, &lastSeen, &service.CreatedAt, &service.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(signalsJSON), &service.Signals); err != nil {
		return nil, err
	}
	service.LogLevelFilter = unmarshalLogLevelFilter(logLevelFilter)
	service.ApiExcludePaths = unmarshalStringList(apiExcludePaths)
	service.IsActive = isActive == 1
	if lastSeen.Valid {
		service.LastSeenAt = &lastSeen.Time
	}
	return &service, nil
}

func marshalTelemetrySignals(signals []models.TelemetrySignal) (string, error) {
	data, err := json.Marshal(signals)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (r *ObservedServiceRepository) Create(service *models.ObservedService, apiKeyHash string) error {
	signalsJSON, err := marshalTelemetrySignals(service.Signals)
	if err != nil {
		return err
	}
	isActive := 0
	if service.IsActive {
		isActive = 1
	}
	return Transaction(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`
			INSERT INTO observed_services(id, name, server_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?)`,
			service.ID, service.Name, service.ServerID, service.CreatedAt, service.UpdatedAt,
		); err != nil {
			return err
		}
		_, err := tx.Exec(`
			INSERT INTO direct_telemetry_connections(
				observed_service_id, api_key_hash, api_key_masked, signals, log_level_filter, api_exclude_paths,
				is_active, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			service.ID, apiKeyHash, service.ApiKeyMasked, signalsJSON, marshalLogLevelFilter(service.LogLevelFilter),
			marshalStringList(service.ApiExcludePaths), isActive, service.CreatedAt, service.UpdatedAt,
		)
		return err
	})
}

func (r *ObservedServiceRepository) GetAll() ([]models.ObservedService, error) {
	rows, err := DB.Query(`SELECT ` + observedServiceSelect + `
		FROM observed_services o
		JOIN direct_telemetry_connections c ON c.observed_service_id = o.id
		ORDER BY o.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	services := make([]models.ObservedService, 0)
	for rows.Next() {
		service, err := scanObservedService(rows)
		if err != nil {
			return nil, err
		}
		services = append(services, *service)
	}
	return services, rows.Err()
}

func (r *ObservedServiceRepository) GetByID(id string) (*models.ObservedService, error) {
	service, err := scanObservedService(DB.QueryRow(`SELECT `+observedServiceSelect+`
		FROM observed_services o
		JOIN direct_telemetry_connections c ON c.observed_service_id = o.id
		WHERE o.id = ?`, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return service, err
}

func (r *ObservedServiceRepository) FindByApiKeyHash(apiKeyHash string) (*models.ObservedService, error) {
	if apiKeyHash == "" {
		return nil, nil
	}
	service, err := scanObservedService(DB.QueryRow(`SELECT `+observedServiceSelect+`
		FROM observed_services o
		JOIN direct_telemetry_connections c ON c.observed_service_id = o.id
		WHERE c.api_key_hash = ?`, apiKeyHash))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return service, err
}

func (r *ObservedServiceRepository) Update(service *models.ObservedService) error {
	signalsJSON, err := marshalTelemetrySignals(service.Signals)
	if err != nil {
		return err
	}
	service.UpdatedAt = time.Now()
	return Transaction(func(tx *sql.Tx) error {
		result, err := tx.Exec(`UPDATE observed_services
			SET name = ?, updated_at = ? WHERE id = ?`,
			service.Name, service.UpdatedAt, service.ID)
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
		_, err = tx.Exec(`UPDATE direct_telemetry_connections
			SET signals = ?, log_level_filter = ?, updated_at = ? WHERE observed_service_id = ?`,
			signalsJSON, marshalLogLevelFilter(service.LogLevelFilter), service.UpdatedAt, service.ID)
		return err
	})
}

func (r *ObservedServiceRepository) SetLogLevelFilter(id string, levels []models.LogLevel) error {
	now := time.Now()
	return Transaction(func(tx *sql.Tx) error {
		result, err := tx.Exec(`UPDATE direct_telemetry_connections
			SET log_level_filter = ?, updated_at = ? WHERE observed_service_id = ?`,
			marshalLogLevelFilter(levels), now, id)
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
		_, err = tx.Exec(`UPDATE observed_services SET updated_at = ? WHERE id = ?`, now, id)
		return err
	})
}

func (r *ObservedServiceRepository) SetApiExcludePaths(id string, paths []string) error {
	now := time.Now()
	return Transaction(func(tx *sql.Tx) error {
		result, err := tx.Exec(`UPDATE direct_telemetry_connections
			SET api_exclude_paths = ?, updated_at = ? WHERE observed_service_id = ?`,
			marshalStringList(paths), now, id)
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
		_, err = tx.Exec(`UPDATE observed_services SET updated_at = ? WHERE id = ?`, now, id)
		return err
	})
}

func (r *ObservedServiceRepository) RotateKey(id, apiKeyHash, apiKeyMasked string) error {
	now := time.Now()
	return Transaction(func(tx *sql.Tx) error {
		result, err := tx.Exec(`UPDATE direct_telemetry_connections
			SET api_key_hash = ?, api_key_masked = ?, is_active = 1, updated_at = ?
			WHERE observed_service_id = ?`, apiKeyHash, apiKeyMasked, now, id)
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
		_, err = tx.Exec(`UPDATE observed_services SET updated_at = ? WHERE id = ?`, now, id)
		return err
	})
}

func (r *ObservedServiceRepository) RevokeKey(id string) error {
	now := time.Now()
	result, err := DB.Exec(`UPDATE direct_telemetry_connections
		SET is_active = 0, updated_at = ? WHERE observed_service_id = ?`, now, id)
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

func (r *ObservedServiceRepository) MarkSeen(id string, seenAt time.Time) error {
	_, err := DB.Exec(`UPDATE direct_telemetry_connections
		SET last_seen_at = ? WHERE observed_service_id = ?`, seenAt, id)
	return err
}

func (r *ObservedServiceRepository) Delete(id string) error {
	return Transaction(func(tx *sql.Tx) error {
		var exists int
		if err := tx.QueryRow(`SELECT 1 FROM observed_services WHERE id = ?`, id).Scan(&exists); err != nil {
			return err
		}
		if _, err := tx.Exec(`DELETE FROM alert_rule_channels
			WHERE rule_id IN (SELECT id FROM alert_rules WHERE service_id = ?)`, id); err != nil {
			return err
		}
		for _, statement := range []string{
			`DELETE FROM alert_rules WHERE service_id = ?`,
			`DELETE FROM logs WHERE service_id = ?`,
			`DELETE FROM api_requests WHERE service_id = ?`,
			`DELETE FROM spans WHERE service_id = ?`,
			`DELETE FROM otel_metrics WHERE service_id = ?`,
			`DELETE FROM direct_telemetry_connections WHERE observed_service_id = ?`,
			`DELETE FROM observed_services WHERE id = ?`,
		} {
			if _, err := tx.Exec(statement, id); err != nil {
				return err
			}
		}
		return nil
	})
}
