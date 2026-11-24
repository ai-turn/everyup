package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

type InfrastructureResourceRepository struct{}

func NewInfrastructureResourceRepository() *InfrastructureResourceRepository {
	return &InfrastructureResourceRepository{}
}

const infrastructureResourceSelect = `id, name,
	COALESCE(server_id, ''), collector_type,
	is_active, COALESCE(api_key_masked, ''), last_seen_at, created_at, updated_at`

type infrastructureResourceScanner interface {
	Scan(dest ...interface{}) error
}

func scanInfrastructureResource(scanner infrastructureResourceScanner) (*models.InfrastructureResource, error) {
	var resource models.InfrastructureResource
	var isActive int
	var lastSeen sql.NullTime
	if err := scanner.Scan(
		&resource.ID, &resource.Name, &resource.ServerID, &resource.Adapter,
		&isActive, &resource.ApiKeyMasked, &lastSeen, &resource.CreatedAt, &resource.UpdatedAt,
	); err != nil {
		return nil, err
	}
	resource.IsActive = isActive == 1
	if lastSeen.Valid {
		resource.LastSeenAt = &lastSeen.Time
	}
	return &resource, nil
}

func (r *InfrastructureResourceRepository) Create(resource *models.InfrastructureResource, apiKeyHash string) error {
	isActive := 0
	if resource.IsActive {
		isActive = 1
	}
	_, err := DB.Exec(`INSERT INTO hosts(
		id, name, type, resource_category, ip, port, "group", is_active, description,
		last_error, server_id, collector_type, api_key_hash, api_key_masked,
		created_at, updated_at
	) VALUES (?, ?, 'remote', 'server', '', 0, '', ?, 'OpenTelemetry hostmetrics', '', ?, ?, ?, ?, ?, ?)`,
		resource.ID, resource.Name, isActive, resource.ServerID, resource.Adapter,
		apiKeyHash, resource.ApiKeyMasked, resource.CreatedAt, resource.UpdatedAt)
	return err
}

func (r *InfrastructureResourceRepository) GetAllDirect() ([]models.InfrastructureResource, error) {
	rows, err := DB.Query(`SELECT `+infrastructureResourceSelect+` FROM hosts
		WHERE collector_type = ? ORDER BY name`, models.InfrastructureAdapterOTelCollector)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	resources := make([]models.InfrastructureResource, 0)
	for rows.Next() {
		resource, err := scanInfrastructureResource(rows)
		if err != nil {
			return nil, err
		}
		resources = append(resources, *resource)
	}
	return resources, rows.Err()
}

func (r *InfrastructureResourceRepository) GetDirectByID(id string) (*models.InfrastructureResource, error) {
	resource, err := scanInfrastructureResource(DB.QueryRow(`SELECT `+infrastructureResourceSelect+`
		FROM hosts WHERE id = ? AND collector_type = ?`, id, models.InfrastructureAdapterOTelCollector))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return resource, err
}

func (r *InfrastructureResourceRepository) FindByApiKeyHash(apiKeyHash string) (*models.InfrastructureResource, error) {
	if apiKeyHash == "" {
		return nil, nil
	}
	resource, err := scanInfrastructureResource(DB.QueryRow(`SELECT `+infrastructureResourceSelect+`
		FROM hosts WHERE api_key_hash = ? AND collector_type = ?`, apiKeyHash, models.InfrastructureAdapterOTelCollector))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return resource, err
}

func (r *InfrastructureResourceRepository) Update(resource *models.InfrastructureResource) error {
	resource.UpdatedAt = time.Now()
	result, err := DB.Exec(`UPDATE hosts SET name = ?, updated_at = ?
		WHERE id = ? AND collector_type = ?`, resource.Name, resource.UpdatedAt,
		resource.ID, models.InfrastructureAdapterOTelCollector)
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

func (r *InfrastructureResourceRepository) RotateKey(id, apiKeyHash, apiKeyMasked string) error {
	result, err := DB.Exec(`UPDATE hosts SET api_key_hash = ?, api_key_masked = ?, is_active = 1, updated_at = ?
		WHERE id = ? AND collector_type = ?`, apiKeyHash, apiKeyMasked, time.Now(), id, models.InfrastructureAdapterOTelCollector)
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

func (r *InfrastructureResourceRepository) RevokeKey(id string) error {
	result, err := DB.Exec(`UPDATE hosts SET is_active = 0, updated_at = ?
		WHERE id = ? AND collector_type = ?`, time.Now(), id, models.InfrastructureAdapterOTelCollector)
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

func (r *InfrastructureResourceRepository) MarkSeen(id string, seenAt time.Time) error {
	_, err := DB.Exec(`UPDATE hosts SET last_seen_at = ? WHERE id = ? AND collector_type = ?`,
		seenAt, id, models.InfrastructureAdapterOTelCollector)
	return err
}

func (r *InfrastructureResourceRepository) Delete(id string) error {
	return Transaction(func(tx *sql.Tx) error {
		var exists int
		if err := tx.QueryRow(`SELECT 1 FROM hosts WHERE id = ? AND collector_type = ?`, id, models.InfrastructureAdapterOTelCollector).Scan(&exists); err != nil {
			return err
		}
		if _, err := tx.Exec(`DELETE FROM alert_rule_channels
			WHERE rule_id IN (SELECT id FROM alert_rules WHERE type = 'resource' AND agent_id = ?)`, id); err != nil {
			return err
		}
		for _, statement := range []string{
			`DELETE FROM alert_rules WHERE type = 'resource' AND agent_id = ?`,
			`DELETE FROM system_metrics WHERE host_id = ?`,
			`DELETE FROM hosts WHERE id = ?`,
		} {
			if _, err := tx.Exec(statement, id); err != nil {
				return err
			}
		}
		return nil
	})
}
