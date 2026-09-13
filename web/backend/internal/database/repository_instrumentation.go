package database

import (
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

var ErrInstrumentationTransition = errors.New("invalid instrumentation transition")

func migrateV51() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS instrumentation_runs (
 id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
 project TEXT NOT NULL, targets TEXT NOT NULL, capture_bodies INTEGER NOT NULL,
 status TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_ms INTEGER NOT NULL,
 updated_ms INTEGER NOT NULL, started_ms INTEGER NOT NULL DEFAULT 0
 ); CREATE INDEX IF NOT EXISTS idx_instrumentation_agent ON instrumentation_runs(agent_id,created_ms);`)
	return err
}

type InstrumentationRepository struct{}

func (r *InstrumentationRepository) Create(run models.InstrumentationRun) error {
	targets, err := json.Marshal(run.Targets)
	if err != nil {
		return err
	}
	_, err = DB.Exec(`INSERT INTO instrumentation_runs(id,agent_id,project,targets,capture_bodies,status,created_ms,updated_ms) VALUES(?,?,?,?,?,'planned',?,?)`, run.ID, run.AgentID, run.Project, string(targets), run.CaptureBodies, run.CreatedAt.UnixMilli(), run.CreatedAt.UnixMilli())
	return err
}

func (r *InstrumentationRepository) Get(agentID, id string) (models.InstrumentationRun, error) {
	if id == "latest" {
		if err := DB.QueryRow(`SELECT id FROM instrumentation_runs WHERE agent_id=? ORDER BY created_ms DESC LIMIT 1`, agentID).Scan(&id); err != nil {
			return models.InstrumentationRun{}, err
		}
	}
	var run models.InstrumentationRun
	var targets string
	var created, updated, started int64
	err := DB.QueryRow(`SELECT id,agent_id,project,targets,capture_bodies,status,reason,created_ms,updated_ms,started_ms FROM instrumentation_runs WHERE agent_id=? AND id=?`, agentID, id).Scan(&run.ID, &run.AgentID, &run.Project, &targets, &run.CaptureBodies, &run.Status, &run.Reason, &created, &updated, &started)
	if err != nil {
		return run, err
	}
	if err = json.Unmarshal([]byte(targets), &run.Targets); err != nil {
		return run, err
	}
	run.CreatedAt, run.UpdatedAt = time.UnixMilli(created), time.UnixMilli(updated)
	run.Signals = []models.SignalReceipt{}
	if started > 0 {
		at := time.UnixMilli(started)
		run.StartedAt = &at
		receipts, err := (&ConnectionSetupRepository{}).Receipts("agent", agentID)
		if err != nil {
			return run, err
		}
		for _, receipt := range receipts {
			if receipt.Signal != "traces" || receipt.LastReceivedAt.Before(at) {
				continue
			}
			for _, target := range run.Targets {
				if receipt.ServiceName == target.Name {
					run.Signals = append(run.Signals, receipt)
					break
				}
			}
		}
	}
	return run, nil
}

func (r *InstrumentationRepository) Report(agentID, id, status, reason string) error {
	return Transaction(func(tx *sql.Tx) error {
		var previous string
		var created int64
		if err := tx.QueryRow(`SELECT status,created_ms FROM instrumentation_runs WHERE id=? AND agent_id=?`, id, agentID).Scan(&previous, &created); err != nil {
			return err
		}
		allowed := previous == "planned" && status == "applying" && time.Since(time.UnixMilli(created)) < time.Hour || previous == "applying" && (status == "verified" || status == "failed" || status == "rolled_back" || status == "rollback_failed") || (previous == "verified" || previous == "rollback_failed") && (status == "rolled_back" || status == "rollback_failed")
		if !allowed {
			return ErrInstrumentationTransition
		}
		now := time.Now().UnixMilli()
		_, err := tx.Exec(`UPDATE instrumentation_runs SET status=?,reason=?,updated_ms=?,started_ms=CASE WHEN ?='applying' THEN ? ELSE started_ms END WHERE id=? AND agent_id=?`, status, reason, now, status, now, id, agentID)
		return err
	})
}
