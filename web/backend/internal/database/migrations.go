package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/crypto"
)

// migrate runs all database migrations in order.
// Each migrateVN() is idempotent — safe to re-run on existing databases.
// v11 was removed (API metric tables deprecated; existing tables left in place).
func migrate() error {
	migrations := []string{
		// Services table (v2: flattened schema)
		`CREATE TABLE IF NOT EXISTS services (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'http',
			is_active INTEGER DEFAULT 1,
			url TEXT,
			port INTEGER,
			method TEXT DEFAULT 'GET',
			headers TEXT,
			body TEXT,
			expected_status INTEGER DEFAULT 200,
			interval INTEGER DEFAULT 60,
			timeout INTEGER DEFAULT 5000,
			tags TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Metrics table
		`CREATE TABLE IF NOT EXISTS metrics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_id TEXT NOT NULL,
			status TEXT NOT NULL,
			response_time INTEGER,
			status_code INTEGER,
			error_message TEXT,
			checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
		)`,

		// Index for metrics queries
		`CREATE INDEX IF NOT EXISTS idx_metrics_service_time ON metrics(service_id, checked_at)`,

		// Logs table
		`CREATE TABLE IF NOT EXISTS logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_id TEXT,
			level TEXT NOT NULL,
			message TEXT NOT NULL,
			metadata TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Index for logs queries
		`CREATE INDEX IF NOT EXISTS idx_logs_level_time ON logs(level, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_logs_service ON logs(service_id)`,

		// Incidents table
		`CREATE TABLE IF NOT EXISTS incidents (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_id TEXT NOT NULL,
			type TEXT NOT NULL,
			message TEXT,
			started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			resolved_at DATETIME,
			FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
		)`,

		// Index for incidents queries
		`CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(service_id)`,
		`CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents(resolved_at) WHERE resolved_at IS NULL`,

		// Notification channels table
		`CREATE TABLE IF NOT EXISTS notification_channels (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			config TEXT NOT NULL,
			is_enabled INTEGER DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Hosts table
		`CREATE TABLE IF NOT EXISTS hosts (
			id            TEXT PRIMARY KEY,
			name          TEXT NOT NULL,
			type          TEXT NOT NULL DEFAULT 'local',
			ip            TEXT NOT NULL DEFAULT '',
			port          INTEGER DEFAULT 0,
			"group"       TEXT NOT NULL DEFAULT '',
			is_active     INTEGER DEFAULT 1,
			description   TEXT DEFAULT '',
			last_error    TEXT DEFAULT '',
			created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// System metrics table (1-minute aggregates)
		`CREATE TABLE IF NOT EXISTS system_metrics (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			host_id     TEXT NOT NULL DEFAULT 'local',
			cpu_usage   REAL NOT NULL,
			mem_total   REAL NOT NULL,
			mem_used    REAL NOT NULL,
			mem_usage   REAL NOT NULL,
			disk_total  REAL NOT NULL,
			disk_used   REAL NOT NULL,
			disk_usage  REAL NOT NULL,
			disk_read   REAL DEFAULT 0,
			disk_write  REAL DEFAULT 0,
			net_in      REAL DEFAULT 0,
			net_out     REAL DEFAULT 0,
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// Index for system metrics time-series queries
		`CREATE INDEX IF NOT EXISTS idx_system_metrics_time ON system_metrics(created_at)`,
		// NOTE: idx_system_metrics_host_time is created in migrateV3() for backward compat
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w\nSQL: %s", err, migration)
		}
	}

	if err := migrateV2(); err != nil {
		return fmt.Errorf("v2 migration failed: %w", err)
	}
	if err := migrateV3(); err != nil {
		return fmt.Errorf("v3 migration failed: %w", err)
	}
	if err := migrateV4(); err != nil {
		return fmt.Errorf("v4 migration failed: %w", err)
	}
	if err := migrateV5(); err != nil {
		return fmt.Errorf("v5 migration failed: %w", err)
	}
	if err := migrateV6(); err != nil {
		return fmt.Errorf("v6 migration failed: %w", err)
	}
	if err := migrateV7(); err != nil {
		return fmt.Errorf("v7 migration failed: %w", err)
	}
	if err := migrateV8(); err != nil {
		return fmt.Errorf("v8 migration failed: %w", err)
	}
	if err := migrateV9(); err != nil {
		return fmt.Errorf("v9 migration failed: %w", err)
	}
	if err := migrateV10(); err != nil {
		return fmt.Errorf("v10 migration failed: %w", err)
	}
	// v11 removed — API metric tables deprecated
	if err := migrateV12(); err != nil {
		return fmt.Errorf("v12 migration failed: %w", err)
	}
	if err := migrateV13(); err != nil {
		return fmt.Errorf("v13 migration failed: %w", err)
	}
	if err := migrateV14(); err != nil {
		return fmt.Errorf("v14 migration failed: %w", err)
	}
	if err := migrateV15(); err != nil {
		return fmt.Errorf("v15 migration failed: %w", err)
	}
	if err := migrateV16(); err != nil {
		return fmt.Errorf("v16 migration failed: %w", err)
	}
	if err := migrateV17(); err != nil {
		return fmt.Errorf("v17 migration failed: %w", err)
	}
	if err := migrateV18(); err != nil {
		return fmt.Errorf("v18 migration failed: %w", err)
	}
	if err := migrateV19(); err != nil {
		return fmt.Errorf("v19 migration failed: %w", err)
	}
	if err := migrateV20(); err != nil {
		return fmt.Errorf("v20 migration failed: %w", err)
	}
	if err := migrateV21(); err != nil {
		return fmt.Errorf("v21 migration failed: %w", err)
	}
	if err := migrateV22(); err != nil {
		return fmt.Errorf("v22 migration failed: %w", err)
	}
	if err := migrateV23(); err != nil {
		return fmt.Errorf("v23 migration failed: %w", err)
	}
	if err := migrateV24(); err != nil {
		return fmt.Errorf("v24 migration failed: %w", err)
	}
	if err := migrateV25(); err != nil {
		return fmt.Errorf("v25 migration failed: %w", err)
	}
	if err := migrateV26(); err != nil {
		return fmt.Errorf("v26 migration failed: %w", err)
	}
	if err := migrateV27(); err != nil {
		return fmt.Errorf("v27 migration failed: %w", err)
	}
	if err := migrateV28(); err != nil {
		return fmt.Errorf("v28 migration failed: %w", err)
	}
	if err := migrateV29(); err != nil {
		return fmt.Errorf("v29 migration failed: %w", err)
	}
	if err := migrateV30(); err != nil {
		return fmt.Errorf("v30 migration failed: %w", err)
	}
	if err := migrateV31(); err != nil {
		return fmt.Errorf("v31 migration failed: %w", err)
	}
	if err := migrateV32(); err != nil {
		return fmt.Errorf("v32 migration failed: %w", err)
	}
	if err := migrateV33(); err != nil {
		return fmt.Errorf("v33 migration failed: %w", err)
	}
	if err := migrateV34(); err != nil {
		return fmt.Errorf("v34 migration failed: %w", err)
	}
	if err := migrateV35(); err != nil {
		return fmt.Errorf("v35 migration failed: %w", err)
	}
	if err := migrateV36(); err != nil {
		return fmt.Errorf("v36 migration failed: %w", err)
	}
	if err := migrateV37(); err != nil {
		return fmt.Errorf("v37 migration failed: %w", err)
	}
	if err := migrateV38(); err != nil {
		return fmt.Errorf("v38 migration failed: %w", err)
	}
	if err := migrateV39(); err != nil {
		return fmt.Errorf("v39 migration failed: %w", err)
	}
	if err := migrateV40(); err != nil {
		return fmt.Errorf("v40 migration failed: %w", err)
	}
	if err := migrateV41(); err != nil {
		return fmt.Errorf("v41 migration failed: %w", err)
	}
	if err := migrateV42(); err != nil {
		return fmt.Errorf("v42 migration failed: %w", err)
	}
	if err := migrateV43(); err != nil {
		return fmt.Errorf("v43 migration failed: %w", err)
	}
	if err := migrateV44(); err != nil {
		return fmt.Errorf("v44 migration failed: %w", err)
	}
	if err := migrateV45(); err != nil {
		return fmt.Errorf("v45 migration failed: %w", err)
	}
	if err := migrateV46(); err != nil {
		return fmt.Errorf("v46 migration failed: %w", err)
	}
	if err := migrateV47(); err != nil {
		return fmt.Errorf("v47 migration failed: %w", err)
	}
	if err := migrateV48(); err != nil {
		return fmt.Errorf("v48 migration failed: %w", err)
	}
	if err := migrateV49(); err != nil {
		return fmt.Errorf("v49 migration failed: %w", err)
	}
	if err := migrateV50(); err != nil {
		return fmt.Errorf("v50 migration failed: %w", err)
	}
	if err := migrateV51(); err != nil {
		return err
	}

	return nil
}

// migrateV2 migrates existing services table from config JSON to flattened columns.
// Added: 2024 — flattened HTTP/TCP config into individual columns.
func migrateV2() error {
	// Check if migration is needed by checking if 'config' column exists
	var hasConfigColumn bool
	rows, err := DB.Query("PRAGMA table_info(services)")
	if err != nil {
		return err
	}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			rows.Close()
			return err
		}
		if name == "config" {
			hasConfigColumn = true
			break
		}
	}
	rows.Close() // Must close before next query (SetMaxOpenConns=1)

	if !hasConfigColumn {
		return nil
	}

	// Check if is_active column already exists (partial migration)
	rows2, err := DB.Query("PRAGMA table_info(services)")
	if err != nil {
		return err
	}
	var hasIsActiveColumn bool
	for rows2.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows2.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			rows2.Close()
			return err
		}
		if name == "is_active" {
			hasIsActiveColumn = true
			break
		}
	}
	rows2.Close()

	if hasIsActiveColumn {
		return nil
	}

	alterStatements := []string{
		"ALTER TABLE services ADD COLUMN is_active INTEGER DEFAULT 1",
		"ALTER TABLE services ADD COLUMN url TEXT",
		"ALTER TABLE services ADD COLUMN port INTEGER",
		"ALTER TABLE services ADD COLUMN method TEXT DEFAULT 'GET'",
		"ALTER TABLE services ADD COLUMN headers TEXT",
		"ALTER TABLE services ADD COLUMN body TEXT",
		"ALTER TABLE services ADD COLUMN expected_status INTEGER DEFAULT 200",
		"ALTER TABLE services ADD COLUMN interval INTEGER DEFAULT 60",
		"ALTER TABLE services ADD COLUMN timeout INTEGER DEFAULT 5000",
		"ALTER TABLE services ADD COLUMN tags TEXT",
	}

	for _, stmt := range alterStatements {
		if _, err := DB.Exec(stmt); err != nil {
			if !isDuplicateColumnError(err) {
				return fmt.Errorf("migration failed: %w\nSQL: %s", err, stmt)
			}
		}
	}

	return migrateConfigData()
}

// migrateV3 adds host_id column to system_metrics for existing databases.
// Added: 2024-02 — multi-host system metrics support.
func migrateV3() error {
	rows, err := DB.Query("PRAGMA table_info(system_metrics)")
	if err != nil {
		return err
	}
	defer rows.Close()

	var hasHostID bool
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == "host_id" {
			hasHostID = true
			break
		}
	}

	if hasHostID {
		return nil
	}

	if _, err := DB.Exec(`ALTER TABLE system_metrics ADD COLUMN host_id TEXT NOT NULL DEFAULT 'local'`); err != nil {
		return fmt.Errorf("failed to add host_id column: %w", err)
	}
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_system_metrics_host_time ON system_metrics(host_id, created_at)`); err != nil {
		return fmt.Errorf("failed to create host_id index: %w", err)
	}
	return nil
}

// migrateV4 adds last_error to hosts table.
// Added: 2024-02. (SSH columns it once added were dropped in migrateV33.)
func migrateV4() error {
	alterStatements := []string{
		"ALTER TABLE hosts ADD COLUMN last_error TEXT DEFAULT ''",
	}

	for _, stmt := range alterStatements {
		if _, err := DB.Exec(stmt); err != nil {
			if err.Error() != fmt.Sprintf("duplicate column name: %s", extractColumnName(stmt)) {
				continue
			}
		}
	}
	return nil
}

// migrateV5 adds api_key to services and source/fingerprint to logs.
// Added: 2024-02 — external log ingestion via API key.
func migrateV5() error {
	alterStatements := []string{
		"ALTER TABLE services ADD COLUMN api_key TEXT DEFAULT ''",
		"ALTER TABLE logs ADD COLUMN source TEXT DEFAULT 'internal'",
		"ALTER TABLE logs ADD COLUMN fingerprint TEXT DEFAULT ''",
	}
	for _, stmt := range alterStatements {
		DB.Exec(stmt) // ignore duplicate column errors
	}
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_logs_fingerprint_time ON logs(fingerprint, created_at)")
	return nil
}

// migrateV6 creates the alert rules system tables and seeds default presets.
// Added: 2024-02 — alert rules + notification channels.
func migrateV6() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS alert_rules (
		id          TEXT PRIMARY KEY,
		name        TEXT NOT NULL,
		type        TEXT NOT NULL,
		host_id     TEXT,
		service_id  TEXT,
		metric      TEXT NOT NULL,
		operator    TEXT NOT NULL DEFAULT 'gt',
		threshold   REAL NOT NULL DEFAULT 0,
		duration    INTEGER NOT NULL DEFAULT 1,
		severity    TEXT NOT NULL DEFAULT 'warning',
		is_enabled  INTEGER DEFAULT 1,
		cooldown    INTEGER DEFAULT 300,
		created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return fmt.Errorf("failed to create alert_rules table: %w", err)
	}

	_, err = DB.Exec(`CREATE TABLE IF NOT EXISTS alert_rule_channels (
		rule_id    TEXT NOT NULL,
		channel_id TEXT NOT NULL,
		PRIMARY KEY (rule_id, channel_id),
		FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
		FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
	)`)
	if err != nil {
		return fmt.Errorf("failed to create alert_rule_channels table: %w", err)
	}

	DB.Exec("CREATE INDEX IF NOT EXISTS idx_alert_rules_host ON alert_rules(host_id, is_enabled)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_alert_rules_service ON alert_rules(service_id, is_enabled)")

	seedDefaultAlertRules()
	return nil
}

// migrateV7 adds notification_history and alert_rule_state tables.
// Added: 2024-02 — notification delivery tracking and alert state persistence.
func migrateV7() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS notification_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		rule_id TEXT,
		channel_id TEXT NOT NULL,
		channel_name TEXT NOT NULL,
		channel_type TEXT NOT NULL,
		alert_type TEXT NOT NULL,
		severity TEXT,
		host_id TEXT,
		host_name TEXT,
		service_id TEXT,
		service_name TEXT,
		message TEXT NOT NULL,
		status TEXT DEFAULT 'pending',
		error_message TEXT,
		retry_count INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		sent_at DATETIME,
		FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL,
		FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
	)`)
	if err != nil {
		return fmt.Errorf("failed to create notification_history table: %w", err)
	}

	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON notification_history(channel_id, created_at)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(alert_type, created_at)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_notification_history_created ON notification_history(created_at)")

	_, err = DB.Exec(`CREATE TABLE IF NOT EXISTS alert_rule_state (
		rule_id TEXT NOT NULL,
		host_id TEXT NOT NULL,
		breach_count INTEGER DEFAULT 0,
		last_alerted_at DATETIME,
		is_alerting INTEGER DEFAULT 0,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (rule_id, host_id),
		FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
	)`)
	if err != nil {
		return fmt.Errorf("failed to create alert_rule_state table: %w", err)
	}

	DB.Exec("CREATE INDEX IF NOT EXISTS idx_alert_rule_state_rule ON alert_rule_state(rule_id)")
	DB.Exec("CREATE INDEX IF NOT EXISTS idx_alert_rule_state_host ON alert_rule_state(host_id)")
	return nil
}

// migrateV8 adds schedule_type and cron_expression columns to services.
// Added: 2024-02 — cron-based scheduled health checks.
func migrateV8() error {
	var hasScheduleType bool
	rows, err := DB.Query("PRAGMA table_info(services)")
	if err != nil {
		return err
	}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			rows.Close()
			return err
		}
		if name == "schedule_type" {
			hasScheduleType = true
			break
		}
	}
	rows.Close()

	if !hasScheduleType {
		if _, err := DB.Exec(`ALTER TABLE services ADD COLUMN schedule_type TEXT DEFAULT 'interval'`); err != nil {
			return fmt.Errorf("failed to add schedule_type column: %w", err)
		}
	}

	var hasCronExpression bool
	rows2, err := DB.Query("PRAGMA table_info(services)")
	if err != nil {
		return err
	}
	for rows2.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltValue sql.NullString
		if err := rows2.Scan(&cid, &name, &ctype, &notnull, &dfltValue, &pk); err != nil {
			rows2.Close()
			return err
		}
		if name == "cron_expression" {
			hasCronExpression = true
			break
		}
	}
	rows2.Close()

	if !hasCronExpression {
		if _, err := DB.Exec(`ALTER TABLE services ADD COLUMN cron_expression TEXT`); err != nil {
			return fmt.Errorf("failed to add cron_expression column: %w", err)
		}
	}
	return nil
}

// migrateV9 removes deprecated warning-level preset rules.
// Added: 2024-02 — simplified preset set (critical only).
func migrateV9() error {
	DB.Exec(`DELETE FROM alert_rules WHERE id IN ('preset-cpu-warning', 'preset-mem-warning')`)
	return nil
}

// migrateV10 adds resource_category column to hosts table.
// Added: 2024-02 — infrastructure categorization (server/network/etc).
func migrateV10() error {
	rows, err := DB.Query("PRAGMA table_info(hosts)")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, colType string
		var notNull int
		var dfltValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == "resource_category" {
			return nil // already migrated
		}
	}

	_, err = DB.Exec(`ALTER TABLE hosts ADD COLUMN resource_category TEXT NOT NULL DEFAULT 'server'`)
	return err
}

// migrateV11 removed — API metric tables (api_endpoints, api_endpoint_stats, api_errors) deprecated.
// Existing tables are left in place for backward compatibility but no longer created for new DBs.

// migrateV12 adds custom message column to alert_rules.
// Added: 2024-02 — per-rule notification message override.
func migrateV12() error {
	DB.Exec("ALTER TABLE alert_rules ADD COLUMN message TEXT DEFAULT ''")
	return nil
}

// migrateV13 hashes any legacy plaintext API keys in the services table.
// Older keys generated by GenerateApiKey() started with "mt_". All such keys
// are replaced with their SHA-256 hex digest so the DB never stores raw keys.
// Added: 2024-02 — security hardening, hashed API key storage.
func migrateV13() error {
	rows, err := DB.Query(`SELECT id, api_key FROM services WHERE api_key != ''`)
	if err != nil {
		return err
	}

	type pair struct{ id, key string }
	var pairs []pair
	for rows.Next() {
		var p pair
		if err := rows.Scan(&p.id, &p.key); err != nil {
			rows.Close()
			return err
		}
		pairs = append(pairs, p)
	}
	rows.Close()

	hashed := 0
	for _, p := range pairs {
		if strings.HasPrefix(p.key, "mt_") {
			if _, err := DB.Exec(`UPDATE services SET api_key = ? WHERE id = ?`,
				crypto.HashApiKey(p.key), p.id); err != nil {
				return err
			}
			hashed++
		}
	}
	if hashed > 0 {
		log.Printf("[migrateV13] Hashed %d plaintext API key(s) in services table", hashed)
	}
	return nil
}

// migrateV14 adds is_system column to alert_rules and seeds the system boot notification rule.
// Added: 2024-02 — system-managed rules that users cannot delete.
func migrateV14() error {
	DB.Exec("ALTER TABLE alert_rules ADD COLUMN is_system INTEGER DEFAULT 0")

	var exists int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM alert_rules WHERE id = 'system-boot'`).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		now := time.Now()
		_, err := DB.Exec(`
			INSERT INTO alert_rules (id, name, type, metric, operator, threshold, duration,
			                         severity, is_enabled, cooldown, message, is_system, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, "system-boot", "Server Boot Notification", "system", "status_change", "gt", 0, 0,
			"info", 1, 0, "Server has been started", 1, now, now)
		if err != nil {
			return fmt.Errorf("failed to seed system boot rule: %w", err)
		}
		log.Printf("[migrateV14] Created system boot notification rule")
	}
	return nil
}

// migrateV15 adds api_key_masked column to services.
// Added: 2024-02 — display masked key in UI without exposing the hash.
func migrateV15() error {
	DB.Exec("ALTER TABLE services ADD COLUMN api_key_masked TEXT DEFAULT ''")
	return nil
}

// migrateV16 creates the app_settings table for internal key-value settings.
// Added: 2024-03 — auto-managed AES encryption key storage.
func migrateV16() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS app_settings (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	return err
}

// migrateV17 documents that jwt_secret is stored in app_settings under key "jwt_secret".
// No schema change required — app_settings table exists since migrateV16.
// The key is auto-inserted by crypto.InitJWTSecret() on first run.
// Added: 2024-03 — JWT secret persistence across restarts.
func migrateV17() error {
	return nil
}

// migrateV18 creates the users table for local password-based authentication.
// Added: 2024-03 — replaced GitHub OAuth with local auth.
func migrateV18() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS users (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		username      TEXT    NOT NULL UNIQUE,
		password_hash TEXT    NOT NULL,
		role          TEXT    NOT NULL DEFAULT 'admin',
		created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`)
	return err
}

// migrateV19 adds log_level_filter column to services table.
// NULL means accept all levels (default). Non-null is a JSON array like ["error","warn"].
// Added: 2024-03 — per-service log level filtering.
func migrateV19() error {
	_, err := DB.Exec(`ALTER TABLE services ADD COLUMN log_level_filter TEXT DEFAULT NULL`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		return err
	}
	return nil
}

// migrateV20 creates the api_requests table for per-service HTTP traffic capture
// and adds five capture-config columns to the services table.
// Added: 2026-04-17
func migrateV20() error {
	return Transaction(func(tx *sql.Tx) error {
		stmts := []string{
			`CREATE TABLE IF NOT EXISTS api_requests (
				id             INTEGER PRIMARY KEY AUTOINCREMENT,
				service_id     TEXT    NOT NULL,
				request_id     TEXT    NOT NULL,
				method         TEXT    NOT NULL,
				path           TEXT    NOT NULL,
				path_template  TEXT    NOT NULL,
				status_code    INTEGER NOT NULL,
				duration_ms    INTEGER NOT NULL,
				client_ip      TEXT,
				req_headers    TEXT,
				req_body       TEXT,
				req_body_size  INTEGER NOT NULL DEFAULT 0,
				res_headers    TEXT,
				res_body       TEXT,
				res_body_size  INTEGER NOT NULL DEFAULT 0,
				error          TEXT,
				is_error       INTEGER NOT NULL DEFAULT 0,
				created_at     DATETIME NOT NULL,
				FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_service_time   ON api_requests(service_id, created_at DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_service_status ON api_requests(service_id, status_code)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_service_error  ON api_requests(service_id, is_error, created_at DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_request_id     ON api_requests(request_id)`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil {
				return err
			}
		}

		alterCols := []string{
			`ALTER TABLE services ADD COLUMN api_capture_mode       TEXT`,
			`ALTER TABLE services ADD COLUMN api_sample_rate        INTEGER`,
			`ALTER TABLE services ADD COLUMN api_body_max_bytes     INTEGER`,
			`ALTER TABLE services ADD COLUMN api_masked_headers     TEXT`,
			`ALTER TABLE services ADD COLUMN api_masked_body_fields TEXT`,
		}
		for _, s := range alterCols {
			if _, err := tx.Exec(s); err != nil && !strings.Contains(err.Error(), "duplicate column") {
				return err
			}
		}
		return nil
	})
}

// migrateV21 backfills the services.log_level_filter column for existing log
// services that left it NULL (= "accept all"). After DEBUG/TRACE were promoted
// to first-class levels, "accept all" would suddenly include those, so we pin
// pre-existing log services to the previous behavior: error/warn/info only.
// New services pick up the same default in models.ServiceCreateRequest.ToService.
// Added: 2026-04-29
func migrateV21() error {
	return Transaction(func(tx *sql.Tx) error {
		_, err := tx.Exec(`
			UPDATE services
			SET log_level_filter = '["error","warn","info"]'
			WHERE type = 'log'
			  AND (log_level_filter IS NULL OR log_level_filter = '' OR log_level_filter = 'null')
		`)
		return err
	})
}

// migrateV22 drops body/header columns from api_requests and removes the
// body capture config columns from services. API monitoring now stores
// metadata only (method, path, status, duration) — bodies stay in service logs.
// Added: 2026-05-07
func migrateV22() error {
	return Transaction(func(tx *sql.Tx) error {
		stmts := []string{
			`ALTER TABLE api_requests DROP COLUMN req_headers`,
			`ALTER TABLE api_requests DROP COLUMN req_body`,
			`ALTER TABLE api_requests DROP COLUMN req_body_size`,
			`ALTER TABLE api_requests DROP COLUMN res_headers`,
			`ALTER TABLE api_requests DROP COLUMN res_body`,
			`ALTER TABLE api_requests DROP COLUMN res_body_size`,
			`ALTER TABLE services DROP COLUMN api_body_max_bytes`,
			`ALTER TABLE services DROP COLUMN api_masked_headers`,
			`ALTER TABLE services DROP COLUMN api_masked_body_fields`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil && !isNoSuchColumnError(err) {
				return err
			}
		}
		return nil
	})
}

// migrateV23 adds OpenTelemetry correlation and attribute columns to logs.
// Added: 2026-05-08
func migrateV23() error {
	return Transaction(func(tx *sql.Tx) error {
		alterStatements := []string{
			`ALTER TABLE logs ADD COLUMN trace_id TEXT DEFAULT ''`,
			`ALTER TABLE logs ADD COLUMN span_id TEXT DEFAULT ''`,
			`ALTER TABLE logs ADD COLUMN severity_number INTEGER DEFAULT 0`,
			`ALTER TABLE logs ADD COLUMN observed_at DATETIME`,
			`ALTER TABLE logs ADD COLUMN resource TEXT`,
			`ALTER TABLE logs ADD COLUMN attributes TEXT`,
		}
		for _, stmt := range alterStatements {
			if _, err := tx.Exec(stmt); err != nil && !strings.Contains(err.Error(), "duplicate column") {
				return err
			}
		}

		indexes := []string{
			`CREATE INDEX IF NOT EXISTS idx_logs_trace ON logs(trace_id, created_at DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_logs_span ON logs(span_id, created_at DESC)`,
		}
		for _, stmt := range indexes {
			if _, err := tx.Exec(stmt); err != nil {
				return err
			}
		}
		return nil
	})
}

// migrateV24 creates the spans table for OpenTelemetry trace data.
// Added: 2026-05-08
func migrateV24() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS spans (
		id               INTEGER PRIMARY KEY AUTOINCREMENT,
		service_id       TEXT,
		service_name     TEXT,
		trace_id         TEXT NOT NULL,
		span_id          TEXT NOT NULL,
		parent_span_id   TEXT DEFAULT '',
		name             TEXT NOT NULL,
		kind             TEXT NOT NULL,
		start_unix_nano  INTEGER NOT NULL,
		end_unix_nano    INTEGER NOT NULL,
		duration_ms      INTEGER NOT NULL DEFAULT 0,
		status_code      TEXT DEFAULT '',
		status_message   TEXT DEFAULT '',
		attributes       TEXT,
		events           TEXT,
		links            TEXT,
		resource         TEXT,
		created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return err
	}

	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id, start_unix_nano)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_spans_unique_span ON spans(trace_id, span_id)`,
		`CREATE INDEX IF NOT EXISTS idx_spans_service_time ON spans(service_id, start_unix_nano DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_spans_kind_time ON spans(kind, start_unix_nano DESC)`,
	}
	for _, stmt := range indexes {
		if _, err := DB.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// migrateV25 links HTTP request projections back to their source spans.
// Added: 2026-05-08
func migrateV25() error {
	return Transaction(func(tx *sql.Tx) error {
		alterStatements := []string{
			`ALTER TABLE api_requests ADD COLUMN trace_id TEXT DEFAULT ''`,
			`ALTER TABLE api_requests ADD COLUMN span_id TEXT DEFAULT ''`,
			`ALTER TABLE api_requests ADD COLUMN route TEXT DEFAULT ''`,
			`ALTER TABLE api_requests ADD COLUMN service_name TEXT DEFAULT ''`,
		}
		for _, stmt := range alterStatements {
			if _, err := tx.Exec(stmt); err != nil && !strings.Contains(err.Error(), "duplicate column") {
				return err
			}
		}

		indexes := []string{
			`CREATE INDEX IF NOT EXISTS idx_api_requests_trace ON api_requests(trace_id, created_at DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_span ON api_requests(span_id)`,
		}
		for _, stmt := range indexes {
			if _, err := tx.Exec(stmt); err != nil {
				return err
			}
		}
		return nil
	})
}

// migrateV26 drops the now-unused API capture columns from services. The
// surrounding code paths (capture_decision, ApiCaptureSettings, OTLP capture
// gating) were removed in the OTel-only migration. Columns are dropped
// idempotently — if they have already been removed, the statement is a no-op.
// Added: 2026-05-09
func migrateV26() error {
	return Transaction(func(tx *sql.Tx) error {
		stmts := []string{
			`ALTER TABLE services DROP COLUMN api_capture_mode`,
			`ALTER TABLE services DROP COLUMN api_sample_rate`,
		}
		for _, s := range stmts {
			if _, err := tx.Exec(s); err != nil && !isNoSuchColumnError(err) {
				return err
			}
		}
		return nil
	})
}

// migrateV27 adds api_exclude_paths column to services for filtering out
// noisy paths (health probes, root scanners) at OTLP ingest time.
// Stored as a JSON array of strings; supports exact (/health) and prefix
// wildcard (/actuator/*) matching, applied in spanToAPIRequest.
func migrateV27() error {
	_, err := DB.Exec(`ALTER TABLE services ADD COLUMN api_exclude_paths TEXT DEFAULT '[]'`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		return err
	}
	return nil
}

// migrateV28 creates EveryUp Agent connected-mode tables.
// Added: 2026-06-19
func migrateV28() error {
	return Transaction(func(tx *sql.Tx) error {
		stmts := []string{
			`CREATE TABLE IF NOT EXISTS agents (
				id           TEXT PRIMARY KEY,
				name         TEXT NOT NULL,
				version      TEXT NOT NULL DEFAULT '',
				last_seen_at DATETIME NOT NULL,
				created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS idx_agents_last_seen ON agents(last_seen_at DESC)`,
			`CREATE TABLE IF NOT EXISTS agent_services (
				agent_id     TEXT NOT NULL,
				key          TEXT NOT NULL,
				name         TEXT NOT NULL,
				check_type   TEXT NOT NULL,
				endpoint     TEXT NOT NULL,
				healthy      INTEGER NOT NULL DEFAULT 0,
				seen         INTEGER NOT NULL DEFAULT 0,
				silenced     INTEGER NOT NULL DEFAULT 0,
				last_error   TEXT NOT NULL DEFAULT '',
				last_status  INTEGER NOT NULL DEFAULT 0,
				last_latency TEXT NOT NULL DEFAULT '',
				updated_at   DATETIME,
				observed_at  DATETIME NOT NULL,
				PRIMARY KEY(agent_id, key),
				FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_agent_services_agent ON agent_services(agent_id, observed_at DESC)`,
			`CREATE TABLE IF NOT EXISTS agent_events (
				id            INTEGER PRIMARY KEY AUTOINCREMENT,
				agent_id      TEXT NOT NULL,
				time          DATETIME NOT NULL,
				type          TEXT NOT NULL,
				service_name  TEXT NOT NULL DEFAULT '',
				target_key    TEXT NOT NULL DEFAULT '',
				message       TEXT NOT NULL DEFAULT '',
				metadata_json TEXT NOT NULL DEFAULT '{}',
				created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_agent_events_agent_time ON agent_events(agent_id, time DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_agent_events_type_time ON agent_events(type, time DESC)`,
		}
		for _, stmt := range stmts {
			if _, err := tx.Exec(stmt); err != nil {
				return err
			}
		}
		return nil
	})
}

// --- helpers ---

// isNoSuchColumnError checks if the error is a "no such column" error (DROP COLUMN on already-absent column)
func isNoSuchColumnError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "no such column")
}

// migrateV29 adds agent_service_history for time-series health check data from Agent.
// Added: 2026-06-21
func migrateV29() error {
	return Transaction(func(tx *sql.Tx) error {
		stmts := []string{
			`CREATE TABLE IF NOT EXISTS agent_service_history (
				id          INTEGER PRIMARY KEY AUTOINCREMENT,
				agent_id    TEXT    NOT NULL,
				key         TEXT    NOT NULL,
				healthy     INTEGER NOT NULL DEFAULT 0,
				latency_ms  INTEGER NOT NULL DEFAULT 0,
				recorded_at DATETIME NOT NULL,
				FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_ash_agent_key_time ON agent_service_history(agent_id, key, recorded_at DESC)`,
		}
		for _, stmt := range stmts {
			if _, err := tx.Exec(stmt); err != nil {
				return err
			}
		}
		return nil
	})
}

// migrateV30 adds agent_id and service_key columns to alert_rules for agent-only architecture.
func migrateV30() error {
	stmts := []string{
		`ALTER TABLE alert_rules ADD COLUMN agent_id TEXT`,
		`ALTER TABLE alert_rules ADD COLUMN service_key TEXT`,
	}
	for _, stmt := range stmts {
		if _, err := DB.Exec(stmt); err != nil {
			col := extractColumnName(stmt)
			if col != "" && strings.Contains(err.Error(), "duplicate column name: "+col) {
				continue
			}
			return err
		}
	}
	return nil
}

// migrateV31 adds api_key_hash and status columns to agents for per-service key-based auth.
// Added: 2026-06-21
func migrateV31() error {
	stmts := []string{
		`ALTER TABLE agents ADD COLUMN api_key_hash TEXT`,
		`ALTER TABLE agents ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`,
	}
	for _, stmt := range stmts {
		if _, err := DB.Exec(stmt); err != nil {
			col := extractColumnName(stmt)
			if col != "" && strings.Contains(err.Error(), "duplicate column name: "+col) {
				continue
			}
			return err
		}
	}
	_, err := DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_api_key_hash ON agents(api_key_hash) WHERE api_key_hash IS NOT NULL`)
	return err
}

// migrateV32 adds api_key_enc to agents so the full API key can be revealed later.
// The key is stored AES-256-GCM encrypted at rest; api_key_hash stays for auth.
// Added: 2026-06-22
func migrateV32() error {
	_, err := DB.Exec(`ALTER TABLE agents ADD COLUMN api_key_enc TEXT`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name: api_key_enc") {
		return err
	}
	return nil
}

// migrateV33 drops the legacy SSH credential columns from the hosts table.
// SSH-based remote collection was replaced by OpenTelemetry push ingestion, so
// these columns are no longer read or written. Idempotent — only drops columns
// that still exist on the table.
// Added: 2026-06-25
func migrateV33() error {
	rows, err := DB.Query("PRAGMA table_info(hosts)")
	if err != nil {
		return err
	}
	existing := map[string]bool{}
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		existing[name] = true
	}
	rows.Close()

	for _, col := range []string{"ssh_user", "ssh_port", "ssh_auth_type", "ssh_key_path", "ssh_key", "ssh_password"} {
		if existing[col] {
			if _, err := DB.Exec(`ALTER TABLE hosts DROP COLUMN ` + col); err != nil {
				return fmt.Errorf("drop column %s: %w", col, err)
			}
		}
	}
	return nil
}

// migrateV34 unifies OTLP telemetry onto the connected-agent (project) key.
// Logs/spans/api_requests gain agent_id + service_name so they can be tied to an
// agent service by (agent_id, service_name) instead of routing through the legacy
// services table. agent_services gains an optional per-service log_level_filter
// (CSV; empty = accept all) that survives sync because UpsertServices never writes it.
// Added: 2026-06-25
func migrateV34() error {
	return Transaction(func(tx *sql.Tx) error {
		alters := []string{
			`ALTER TABLE logs ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''`,
			`ALTER TABLE logs ADD COLUMN service_name TEXT NOT NULL DEFAULT ''`,
			`ALTER TABLE api_requests ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''`,
			`ALTER TABLE spans ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''`,
			`ALTER TABLE agent_services ADD COLUMN log_level_filter TEXT NOT NULL DEFAULT ''`,
		}
		for _, stmt := range alters {
			if _, err := tx.Exec(stmt); err != nil && !strings.Contains(err.Error(), "duplicate column") {
				return err
			}
		}
		indexes := []string{
			`CREATE INDEX IF NOT EXISTS idx_logs_agent_service ON logs(agent_id, service_name, created_at DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_api_requests_agent_service ON api_requests(agent_id, service_name, created_at DESC)`,
		}
		for _, stmt := range indexes {
			if _, err := tx.Exec(stmt); err != nil {
				return err
			}
		}
		return nil
	})
}

// migrateV35 removes the legacy api_requests -> services foreign key.
// Agent-ingested API requests are owned by (agent_id, service_name), so
// service_id may be empty when the request did not come from a legacy service.
// Added: 2026-06-26
func migrateV35() error {
	rows, err := DB.Query(`PRAGMA foreign_key_list(api_requests)`)
	if err != nil {
		return err
	}
	hasServiceFK := false
	for rows.Next() {
		var id, seq int
		var table, from, to, onUpdate, onDelete, match string
		if err := rows.Scan(&id, &seq, &table, &from, &to, &onUpdate, &onDelete, &match); err != nil {
			rows.Close()
			return err
		}
		if table == "services" && from == "service_id" {
			hasServiceFK = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if !hasServiceFK {
		return ensureAPIRequestIndexes()
	}

	if _, err := DB.Exec(`PRAGMA foreign_keys = OFF`); err != nil {
		return err
	}
	defer DB.Exec(`PRAGMA foreign_keys = ON`)

	return Transaction(func(tx *sql.Tx) error {
		stmts := []string{
			`DROP TABLE IF EXISTS api_requests_new`,
			`CREATE TABLE api_requests_new (
				id             INTEGER PRIMARY KEY AUTOINCREMENT,
				service_id     TEXT NOT NULL DEFAULT '',
				agent_id       TEXT NOT NULL DEFAULT '',
				request_id     TEXT NOT NULL,
				method         TEXT NOT NULL,
				path           TEXT NOT NULL,
				path_template  TEXT NOT NULL,
				status_code    INTEGER NOT NULL,
				duration_ms    INTEGER NOT NULL,
				client_ip      TEXT,
				error          TEXT,
				is_error       INTEGER NOT NULL DEFAULT 0,
				created_at     DATETIME NOT NULL,
				trace_id       TEXT DEFAULT '',
				span_id        TEXT DEFAULT '',
				route          TEXT DEFAULT '',
				service_name   TEXT DEFAULT ''
			)`,
			`INSERT INTO api_requests_new
				(id, service_id, agent_id, request_id, method, path, path_template,
				 status_code, duration_ms, client_ip, error, is_error, created_at,
				 trace_id, span_id, route, service_name)
			 SELECT id, service_id, agent_id, request_id, method, path, path_template,
				 status_code, duration_ms, client_ip, error, is_error, created_at,
				 trace_id, span_id, route, service_name
			   FROM api_requests`,
			`DROP TABLE api_requests`,
			`ALTER TABLE api_requests_new RENAME TO api_requests`,
		}
		for _, stmt := range stmts {
			if _, err := tx.Exec(stmt); err != nil {
				return err
			}
		}
		return ensureAPIRequestIndexesTx(tx)
	})
}

// migrateV36 creates a small audit trail for sensitive trace body access.
// Added: 2026-06-29
func migrateV36() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS audit_events (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id    INTEGER NOT NULL DEFAULT 0,
			username   TEXT NOT NULL DEFAULT '',
			action     TEXT NOT NULL,
			trace_id   TEXT NOT NULL DEFAULT '',
			metadata   TEXT NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_events_action_time ON audit_events(action, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_events_trace_time ON audit_events(trace_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_events_user_time ON audit_events(user_id, created_at DESC)`,
	}
	for _, stmt := range stmts {
		if _, err := DB.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// migrateV37 creates otel_metrics: OTLP metric data points flattened one row
// per point (gauge/sum store the value; histogram-family stores count, total,
// and value=avg). Kept raw with a short retention — charts read it directly.
// Added: 2026-07-02
func migrateV37() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS otel_metrics (
			id             INTEGER PRIMARY KEY AUTOINCREMENT,
			service_id     TEXT NOT NULL DEFAULT '',
			agent_id       TEXT NOT NULL DEFAULT '',
			service_name   TEXT NOT NULL DEFAULT '',
			metric_name    TEXT NOT NULL,
			metric_type    TEXT NOT NULL,
			unit           TEXT NOT NULL DEFAULT '',
			attributes     TEXT,
			value          REAL NOT NULL DEFAULT 0,
			count          INTEGER NOT NULL DEFAULT 0,
			total          REAL NOT NULL DEFAULT 0,
			time_unix_nano INTEGER NOT NULL DEFAULT 0,
			created_at     DATETIME NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_otel_metrics_agent_service ON otel_metrics(agent_id, service_name, metric_name, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_otel_metrics_service       ON otel_metrics(service_id, metric_name, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_otel_metrics_created       ON otel_metrics(created_at)`,
	}
	for _, stmt := range stmts {
		if _, err := DB.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// migrateV38 adds the agent-detected language runtime to agent_services, so
// the UI can show runtime-specific OTel setup guidance.
// Added: 2026-07-03
func migrateV38() error {
	_, err := DB.Exec(`ALTER TABLE agent_services ADD COLUMN runtime TEXT NOT NULL DEFAULT ''`)
	if err != nil && strings.Contains(err.Error(), "duplicate column name") {
		return nil
	}
	return err
}

// migrateV39 adds metric_name to alert_rules, so a rule can target a specific
// OTLP metric series (e.g. "jvm.memory.used"). Empty for all other rule types.
// Added: 2026-07-05
func migrateV39() error {
	_, err := DB.Exec(`ALTER TABLE alert_rules ADD COLUMN metric_name TEXT NOT NULL DEFAULT ''`)
	if err != nil && strings.Contains(err.Error(), "duplicate column name") {
		return nil
	}
	return err
}

// migrateV40 adds docker container provenance to agent_services (image ref,
// restart count, start time) so the service header can show container meta and
// surface restart loops.
// Added: 2026-07-08
func migrateV40() error {
	for _, stmt := range []string{
		`ALTER TABLE agent_services ADD COLUMN image TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE agent_services ADD COLUMN restart_count INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE agent_services ADD COLUMN started_at DATETIME`,
	} {
		if _, err := DB.Exec(stmt); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}
	return nil
}

// migrateV41 drops agents.mode — the standalone/proxy distinction died with
// proxy mode (2026-06-30); every agent is the same passive collector.
// Added: 2026-07-16
func migrateV41() error {
	if _, err := DB.Exec(`ALTER TABLE agents DROP COLUMN mode`); err != nil && !isNoSuchColumnError(err) {
		return err
	}
	return nil
}

// migrateV42 stores the Agent's extensible per-feature compatibility report.
// Added: 2026-07-17
func migrateV42() error {
	if _, err := DB.Exec(`ALTER TABLE agents ADD COLUMN capability_report TEXT NOT NULL DEFAULT '{}'`); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		return err
	}
	return nil
}

// migrateV43 adds short-lived, single-use Agent installer credentials. Only a
// SHA-256 hash is stored; the plaintext join code is returned to the browser.
// Added: 2026-07-17
func migrateV43() error {
	return Transaction(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`CREATE TABLE IF NOT EXISTS agent_join_codes (
			code_hash  TEXT PRIMARY KEY,
			agent_id   TEXT NOT NULL,
			expires_at DATETIME NOT NULL,
			used_at    DATETIME,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
		)`); err != nil {
			return err
		}
		_, err := tx.Exec(`CREATE INDEX IF NOT EXISTS idx_agent_join_codes_agent ON agent_join_codes(agent_id, expires_at DESC)`)
		return err
	})
}

// migrateV44 stores the intended Agent collection scope separately from its
// observed capability report. Existing rows remain all-in-one by default.
// Added: 2026-08-08
func migrateV44() error {
	for _, statement := range []string{
		`ALTER TABLE agents ADD COLUMN profile_kind TEXT NOT NULL DEFAULT 'all-in-one'`,
		`ALTER TABLE agents ADD COLUMN profile_capabilities TEXT NOT NULL DEFAULT '[]'`,
	} {
		if _, err := DB.Exec(statement); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}
	return nil
}

// migrateV45 adds optional Project grouping. Existing Agents and configured
// monitors remain unassigned so the migration does not silently redefine the
// user's current topology.
// Added: 2026-08-08
func migrateV45() error {
	return Transaction(func(tx *sql.Tx) error {
		if _, err := tx.Exec(`CREATE TABLE IF NOT EXISTS projects (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT NOT NULL DEFAULT '',
				created_at DATETIME NOT NULL,
				updated_at DATETIME NOT NULL
			)`); err != nil {
			return err
		}
		for _, statement := range []string{
			`ALTER TABLE agents ADD COLUMN project_id TEXT`,
			`ALTER TABLE services ADD COLUMN project_id TEXT`,
		} {
			if _, err := tx.Exec(statement); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
				return err
			}
		}
		for _, statement := range []string{
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects(name)`,
			`CREATE INDEX IF NOT EXISTS idx_agents_project_id ON agents(project_id)`,
			`CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id)`,
		} {
			if _, err := tx.Exec(statement); err != nil {
				return err
			}
		}
		return nil
	})
}

// migrateV46 adds directly created Observed Services and their one-to-one,
// signal-scoped OTLP connections. Existing Agent and legacy service identities
// remain untouched and continue through compatibility adapters.
// Added: 2026-08-11
func migrateV46() error {
	return Transaction(func(tx *sql.Tx) error {
		statements := []string{
			`CREATE TABLE IF NOT EXISTS observed_services (
				id         TEXT PRIMARY KEY,
				name       TEXT NOT NULL,
				project_id TEXT,
				created_at DATETIME NOT NULL,
				updated_at DATETIME NOT NULL,
				FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
			)`,
			`CREATE TABLE IF NOT EXISTS direct_telemetry_connections (
				observed_service_id TEXT PRIMARY KEY,
				api_key_hash        TEXT NOT NULL UNIQUE,
				api_key_masked      TEXT NOT NULL,
				signals             TEXT NOT NULL,
				is_active           INTEGER NOT NULL DEFAULT 1,
				last_seen_at        DATETIME,
				created_at          DATETIME NOT NULL,
				updated_at          DATETIME NOT NULL,
				FOREIGN KEY(observed_service_id) REFERENCES observed_services(id) ON DELETE CASCADE
			)`,
			`CREATE INDEX IF NOT EXISTS idx_observed_services_project ON observed_services(project_id)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_direct_telemetry_key_hash ON direct_telemetry_connections(api_key_hash)`,
		}
		for _, statement := range statements {
			if _, err := tx.Exec(statement); err != nil {
				return err
			}
		}
		return nil
	})
}

// migrateV47 adds ingest-time log filtering to direct telemetry connections.
// An empty JSON array means accept every level, matching the Agent service
// filter contract. New direct targets receive the product default in Manager.
// Added: 2026-08-11
func migrateV47() error {
	_, err := DB.Exec(`ALTER TABLE direct_telemetry_connections
		ADD COLUMN log_level_filter TEXT NOT NULL DEFAULT '[]'`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name: log_level_filter") {
		return err
	}
	return nil
}

// migrateV48 adds request-projection exclusions to direct trace connections.
// Values use the same exact-or-trailing-* prefix contract as legacy services.
// Added: 2026-08-11
func migrateV48() error {
	_, err := DB.Exec(`ALTER TABLE direct_telemetry_connections
		ADD COLUMN api_exclude_paths TEXT NOT NULL DEFAULT '[]'`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name: api_exclude_paths") {
		return err
	}
	return nil
}

// migrateV49 turns the existing host identity into a credentialed standard
// OpenTelemetry Collector target. Agent-backed infrastructure remains in the
// agents table and both adapters continue writing the shared system_metrics
// history keyed by their resource ID.
// Added: 2026-08-11
func migrateV49() error {
	columns := []string{
		`ALTER TABLE hosts ADD COLUMN project_id TEXT`,
		`ALTER TABLE hosts ADD COLUMN collector_type TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE hosts ADD COLUMN api_key_hash TEXT`,
		`ALTER TABLE hosts ADD COLUMN api_key_masked TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE hosts ADD COLUMN last_seen_at DATETIME`,
	}
	for _, statement := range columns {
		if _, err := DB.Exec(statement); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return err
		}
	}
	for _, statement := range []string{
		`CREATE INDEX IF NOT EXISTS idx_hosts_project ON hosts(project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_hosts_collector_type ON hosts(collector_type)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_hosts_api_key_hash ON hosts(api_key_hash) WHERE api_key_hash IS NOT NULL`,
	} {
		if _, err := DB.Exec(statement); err != nil {
			return err
		}
	}
	return nil
}

func ensureAPIRequestIndexes() error {
	return Transaction(func(tx *sql.Tx) error {
		return ensureAPIRequestIndexesTx(tx)
	})
}

func ensureAPIRequestIndexesTx(tx *sql.Tx) error {
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_api_requests_service_time   ON api_requests(service_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_api_requests_service_status ON api_requests(service_id, status_code)`,
		`CREATE INDEX IF NOT EXISTS idx_api_requests_service_error  ON api_requests(service_id, is_error, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_api_requests_request_id     ON api_requests(request_id)`,
		`CREATE INDEX IF NOT EXISTS idx_api_requests_trace          ON api_requests(trace_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_api_requests_span           ON api_requests(span_id)`,
		`CREATE INDEX IF NOT EXISTS idx_api_requests_agent_service  ON api_requests(agent_id, service_name, created_at DESC)`,
	}
	for _, stmt := range indexes {
		if _, err := tx.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// isDuplicateColumnError checks if the error is a duplicate column error (migrateV2)
func isDuplicateColumnError(err error) bool {
	return err != nil && (err.Error() == "duplicate column name: is_active" ||
		err.Error() == "duplicate column name: url" ||
		err.Error() == "duplicate column name: port" ||
		err.Error() == "duplicate column name: method" ||
		err.Error() == "duplicate column name: headers" ||
		err.Error() == "duplicate column name: body" ||
		err.Error() == "duplicate column name: expected_status" ||
		err.Error() == "duplicate column name: interval" ||
		err.Error() == "duplicate column name: timeout" ||
		err.Error() == "duplicate column name: tags")
}

// extractColumnName extracts the column name from an ALTER TABLE ADD COLUMN statement
func extractColumnName(stmt string) string {
	const prefix = "COLUMN "
	idx := len(prefix)
	start := 0
	for i := 0; i < len(stmt)-idx; i++ {
		if stmt[i:i+idx] == prefix {
			start = i + idx
			break
		}
	}
	if start == 0 {
		return ""
	}
	end := start
	for end < len(stmt) && stmt[end] != ' ' {
		end++
	}
	return stmt[start:end]
}

// migrateConfigData migrates existing config JSON data to flattened columns (migrateV2)
func migrateConfigData() error {
	rows, err := DB.Query("SELECT id, type, config FROM services WHERE config IS NOT NULL AND config != ''")
	if err != nil {
		return err
	}
	defer rows.Close()

	type httpConfig struct {
		URL            string            `json:"url"`
		Method         string            `json:"method"`
		Headers        map[string]string `json:"headers"`
		ExpectedStatus int               `json:"expectedStatus"`
		Timeout        int               `json:"timeout"`
		Interval       int               `json:"interval"`
	}

	type tcpConfig struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		Timeout  int    `json:"timeout"`
		Interval int    `json:"interval"`
	}

	for rows.Next() {
		var id, svcType, configJSON string
		if err := rows.Scan(&id, &svcType, &configJSON); err != nil {
			continue
		}

		var url, method, headers string
		var port, expectedStatus, interval, timeout int

		if svcType == "http" {
			var cfg httpConfig
			if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
				continue
			}
			url = cfg.URL
			method = cfg.Method
			if method == "" {
				method = "GET"
			}
			expectedStatus = cfg.ExpectedStatus
			if expectedStatus == 0 {
				expectedStatus = 200
			}
			timeout = cfg.Timeout
			if timeout == 0 {
				timeout = 5000
			}
			interval = cfg.Interval
			if interval == 0 {
				interval = 60
			}
			if cfg.Headers != nil {
				headersBytes, _ := json.Marshal(cfg.Headers)
				headers = string(headersBytes)
			}
		} else if svcType == "tcp" {
			var cfg tcpConfig
			if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
				continue
			}
			url = cfg.Host
			port = cfg.Port
			timeout = cfg.Timeout
			if timeout == 0 {
				timeout = 3000
			}
			interval = cfg.Interval
			if interval == 0 {
				interval = 60
			}
		}

		_, err := DB.Exec(`
			UPDATE services
			SET url = ?, port = ?, method = ?, headers = ?, expected_status = ?, interval = ?, timeout = ?
			WHERE id = ?
		`, url, port, method, headers, expectedStatus, interval, timeout, id)
		if err != nil {
			return err
		}
	}

	return nil
}

// seedDefaultAlertRules seeds the default preset alert rules (disabled by default).
// Idempotent — skips if any preset rules already exist.
func seedDefaultAlertRules() {
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM alert_rules WHERE id LIKE 'preset-%'").Scan(&count)
	if count > 0 {
		return
	}

	presets := []struct {
		id, name, metric, severity string
		threshold                  float64
		duration                   int
	}{
		{"preset-cpu-critical", "High CPU Usage", "cpu", "critical", 90, 3},
		{"preset-mem-critical", "High Memory Usage", "memory", "critical", 85, 3},
		{"preset-disk-critical", "Disk Almost Full", "disk", "critical", 90, 1},
	}

	now := time.Now()
	for _, p := range presets {
		DB.Exec(`INSERT OR IGNORE INTO alert_rules
			(id, name, type, metric, operator, threshold, duration, severity, is_enabled, cooldown, created_at, updated_at)
			VALUES (?, ?, 'resource', ?, 'gt', ?, ?, ?, 0, 300, ?, ?)`,
			p.id, p.name, p.metric, p.threshold, p.duration, p.severity, now, now)
	}
}
