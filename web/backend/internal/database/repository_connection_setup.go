package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

func migrateV50() error {
	_, err := DB.Exec(`
 CREATE TABLE IF NOT EXISTS collector_setup (
 agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
 applied_hash TEXT NOT NULL DEFAULT '', last_contact_ms INTEGER NOT NULL, enrolled_ms INTEGER NOT NULL DEFAULT 0
 );
 CREATE TABLE IF NOT EXISTS signal_receipts (
 owner_kind TEXT NOT NULL, owner_id TEXT NOT NULL, service_name TEXT NOT NULL,
 signal TEXT NOT NULL, first_received_ms INTEGER NOT NULL, last_received_ms INTEGER NOT NULL,
 PRIMARY KEY(owner_kind, owner_id, service_name, signal)
 );`)
	return err
}

type ConnectionSetupRepository struct{}

func (r *ConnectionSetupRepository) ReportEnrollment(id string) error {
	now := time.Now().UnixMilli()
	_, err := DB.Exec(`INSERT INTO collector_setup(agent_id,last_contact_ms,enrolled_ms) VALUES(?,0,?) ON CONFLICT(agent_id) DO UPDATE SET enrolled_ms=excluded.enrolled_ms`, id, now)
	return err
}

func (r *ConnectionSetupRepository) AgentProfile(id string) (models.AgentProfile, error) {
	var kind, capabilities string
	err := DB.QueryRow(`SELECT COALESCE(profile_kind,'all-in-one'), COALESCE(profile_capabilities,'[]') FROM agents WHERE id=? AND COALESCE(status,'active')='active'`, id).Scan(&kind, &capabilities)
	if err != nil {
		return models.AgentProfile{}, err
	}
	return decodeAgentProfile(kind, capabilities)
}

// Existing identity, project membership, credentials and history remain intact.
func (r *ConnectionSetupRepository) UpdateProfile(id string, profile models.AgentProfile) error {
	encoded, err := encodeAgentProfile(profile)
	if err != nil {
		return err
	}
	return Transaction(func(tx *sql.Tx) error {
		result, err := tx.Exec(`UPDATE agents SET profile_kind=?,profile_capabilities=?,updated_at=? WHERE id=? AND COALESCE(status,'active')='active'`, encoded.Kind, encoded.Capabilities, time.Now(), id)
		if err != nil {
			return err
		}
		count, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if count == 0 {
			return sql.ErrNoRows
		}
		_, err = tx.Exec(`DELETE FROM agent_join_codes WHERE agent_id=? AND used_at IS NULL`, id)
		return err
	})
}

func (r *ConnectionSetupRepository) ReportCollector(id, hash string) error {
	_, err := DB.Exec(`INSERT INTO collector_setup(agent_id,applied_hash,last_contact_ms) VALUES(?,?,?) ON CONFLICT(agent_id) DO UPDATE SET applied_hash=excluded.applied_hash,last_contact_ms=excluded.last_contact_ms`, id, hash, time.Now().UnixMilli())
	return err
}

func (r *ConnectionSetupRepository) Status(id string) (models.CollectorSetupStatus, error) {
	profile, err := r.AgentProfile(id)
	if err != nil {
		return models.CollectorSetupStatus{}, err
	}
	status := models.CollectorSetupStatus{Profile: profile, DesiredHash: profile.ConfigHash()}
	var last, enrolled int64
	err = DB.QueryRow(`SELECT applied_hash,last_contact_ms,enrolled_ms FROM collector_setup WHERE agent_id=?`, id).Scan(&status.AppliedHash, &last, &enrolled)
	if err != nil && err != sql.ErrNoRows {
		return status, err
	}
	if err == nil {
		if enrolled > 0 {
			at := time.UnixMilli(enrolled)
			status.LastEnrolledAt = &at
		}
		if last > 0 {
			at := time.UnixMilli(last)
			status.LastContactAt = &at
			status.Connected = time.Since(at) < 2*time.Minute
		}
	}
	status.ConfigApplied = status.Connected && status.AppliedHash == status.DesiredHash
	status.Signals, err = r.Receipts("agent", id)
	return status, err
}

// Server receipt time deliberately ignores sender clocks and historical payload times.
func (r *ConnectionSetupRepository) Record(kind, id, name, signal string) error {
	now := time.Now().UnixMilli()
	_, err := DB.Exec(`INSERT INTO signal_receipts(owner_kind,owner_id,service_name,signal,first_received_ms,last_received_ms) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_kind,owner_id,service_name,signal) DO UPDATE SET last_received_ms=excluded.last_received_ms`, kind, id, name, signal, now, now)
	return err
}

func (r *ConnectionSetupRepository) Receipts(kind, id string) ([]models.SignalReceipt, error) {
	rows, err := DB.Query(`SELECT service_name,signal,first_received_ms,last_received_ms FROM signal_receipts WHERE owner_kind=? AND owner_id=? ORDER BY service_name,signal`, kind, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]models.SignalReceipt, 0)
	for rows.Next() {
		var item models.SignalReceipt
		var first, last int64
		if err := rows.Scan(&item.ServiceName, &item.Signal, &first, &last); err != nil {
			return nil, err
		}
		item.FirstReceivedAt = time.UnixMilli(first)
		item.LastReceivedAt = time.UnixMilli(last)
		result = append(result, item)
	}
	return result, rows.Err()
}
