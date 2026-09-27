package database

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// variablePart matches what changes between occurrences of the same error:
// UUIDs, 0x-hex, words of hex letters and digits (hashes, ids, IP octets) and
// any remaining run of digits ("5000ms" keeps its unit).
var variablePart = regexp.MustCompile(`(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b0x[0-9a-f]+\b|\b[0-9a-f]*[0-9][0-9a-f]*\b|[0-9]+`)

// LogFingerprint keys a log by its sending service, level and message with the
// variable parts masked, so "user 123 not found" and "user 456 not found" land
// in one LogPattern. Alert dedup keeps hashing the message verbatim
// (alerter.GenerateFingerprint).
// ponytail: regex masking, not clustering — quoted names or words still split a pattern; Drain-style clustering if that shows up.
func LogFingerprint(seed, level, message string) string {
	sum := sha256.Sum256([]byte(seed + ":" + level + ":" + variablePart.ReplaceAllString(message, "<*>")))
	return hex.EncodeToString(sum[:8])
}

// logFingerprintSeed is the service part of LogFingerprint as OTLP ingest
// passes it: the agent and service name for Docker services, else the service id.
func logFingerprintSeed(serviceID, agentID, serviceName string) string {
	if agentID != "" {
		return agentID + ":" + serviceName
	}
	return serviceID
}

// migrateV54 re-keys the stored fingerprints of error/warn logs with
// LogFingerprint, so rows from before the masking group with new ones on the
// logs page. Other levels are never grouped and age out as they are. Every
// migration re-runs at startup, so an app_settings marker keeps this to once.
// Added: 2026-09-27
func migrateV54() error {
	const marker = "log_fingerprint_masked"
	var done int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM app_settings WHERE key = ?`, marker).Scan(&done); err != nil {
		return err
	}
	if done > 0 {
		return nil
	}

	type row struct {
		id                   int64
		seed, level, message string
	}
	for lastID := int64(0); ; {
		// Batches are read, closed, then written — no query may run inside rows.Next().
		rows, err := DB.Query(`
			SELECT id, COALESCE(service_id, ''), COALESCE(agent_id, ''), COALESCE(service_name, ''), level, message
			FROM logs
			WHERE id > ? AND level IN ('error', 'warn') AND fingerprint != ''
			ORDER BY id LIMIT 1000`, lastID)
		if err != nil {
			return err
		}
		var batch []row
		for rows.Next() {
			var r row
			var serviceID, agentID, serviceName string
			if err := rows.Scan(&r.id, &serviceID, &agentID, &serviceName, &r.level, &r.message); err != nil {
				rows.Close()
				return err
			}
			r.seed = logFingerprintSeed(serviceID, agentID, serviceName)
			batch = append(batch, r)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		if len(batch) == 0 {
			break
		}
		if err := Transaction(func(tx *sql.Tx) error {
			for _, r := range batch {
				if _, err := tx.Exec(`UPDATE logs SET fingerprint = ? WHERE id = ?`, LogFingerprint(r.seed, r.level, r.message), r.id); err != nil {
					return err
				}
			}
			return nil
		}); err != nil {
			return err
		}
		lastID = batch[len(batch)-1].id
	}
	_, err := DB.Exec(`INSERT INTO app_settings (key, value) VALUES (?, '1')`, marker)
	return err
}

// logServiceKey identifies a log service the way ingest scopes it: a Docker
// service by agent + name, anything else (direct connections) by service id.
type logServiceKey struct{ serviceID, agentID, serviceName string }

func newLogServiceKey(serviceID, agentID, serviceName string) logServiceKey {
	if agentID != "" {
		return logServiceKey{agentID: agentID, serviceName: serviceName}
	}
	return logServiceKey{serviceID: serviceID}
}

// Summary rolls up each log service's error/warn activity since `from` for the
// logs page cards: exact counts, per-bucket counts for the sparkline, the
// newest error (else warn), and when logs of any level last arrived.
// ponytail: one pass over the window's error/warn rows per call; pre-aggregate at ingest if error volume makes it slow.
func (r *LogRepository) Summary(from time.Time, bucketMins int) ([]models.LogServiceSummary, error) {
	bucketDur := time.Duration(bucketMins) * time.Minute

	type newest struct {
		id int64
		at time.Time
	}
	type service struct {
		summary models.LogServiceSummary
		buckets map[time.Time]*models.LogHistogramBucket
		newest  map[models.LogLevel]newest
	}
	services := map[logServiceKey]*service{}
	get := func(key logServiceKey, serviceName string) *service {
		s := services[key]
		if s == nil {
			s = &service{
				summary: models.LogServiceSummary{ServiceID: key.serviceID, AgentID: key.agentID, ServiceName: serviceName},
				buckets: map[time.Time]*models.LogHistogramBucket{},
				newest:  map[models.LogLevel]newest{},
			}
			services[key] = s
		}
		return s
	}

	rows, err := DB.Query(`
		SELECT id, COALESCE(service_id, ''), COALESCE(agent_id, ''), COALESCE(service_name, ''), level, created_at
		FROM logs
		WHERE level IN ('error', 'warn') AND created_at >= ?`, from)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		var serviceID, agentID, serviceName string
		var level models.LogLevel
		var createdAt time.Time
		if err := rows.Scan(&id, &serviceID, &agentID, &serviceName, &level, &createdAt); err != nil {
			rows.Close()
			return nil, err
		}
		s := get(newLogServiceKey(serviceID, agentID, serviceName), serviceName)
		t := createdAt.Truncate(bucketDur)
		b := s.buckets[t]
		if b == nil {
			b = &models.LogHistogramBucket{Time: t}
			s.buckets[t] = b
		}
		if level == models.LogLevelError {
			s.summary.Error++
			b.Error++
		} else {
			s.summary.Warn++
			b.Warn++
		}
		if createdAt.After(s.newest[level].at) {
			s.newest[level] = newest{id: id, at: createdAt}
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}

	// Receipts are server receive times per service, kept past log retention, so
	// a service that went quiet still reports when it last sent anything.
	rows, err = DB.Query(`
		SELECT owner_kind, owner_id, service_name, last_received_ms
		FROM signal_receipts
		WHERE signal = 'logs' AND owner_kind IN ('agent', 'direct')`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var kind, ownerID, serviceName string
		var lastMs int64
		if err := rows.Scan(&kind, &ownerID, &serviceName, &lastMs); err != nil {
			rows.Close()
			return nil, err
		}
		key := logServiceKey{serviceID: ownerID}
		if kind == "agent" {
			key = logServiceKey{agentID: ownerID, serviceName: serviceName}
		}
		s := get(key, serviceName)
		// A renamed direct connection has one receipt per name; the newest wins.
		if at := time.UnixMilli(lastMs); s.summary.LastReceivedAt == nil || at.After(*s.summary.LastReceivedAt) {
			s.summary.LastReceivedAt = &at
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}

	// Messages are fetched only for the quoted rows — the scan above skips them
	// because a message can run to 10 KB.
	latestID := map[int64]*service{}
	for _, s := range services {
		pick, ok := s.newest[models.LogLevelError]
		if !ok {
			pick, ok = s.newest[models.LogLevelWarn]
		}
		if ok {
			latestID[pick.id] = s
		}
	}
	if len(latestID) > 0 {
		placeholders := make([]string, 0, len(latestID))
		args := make([]interface{}, 0, len(latestID))
		for id := range latestID {
			placeholders = append(placeholders, "?")
			args = append(args, id)
		}
		rows, err = DB.Query(`SELECT id, level, message, created_at FROM logs WHERE id IN (`+strings.Join(placeholders, ",")+`)`, args...)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var id int64
			var sample models.LogSample
			if err := rows.Scan(&id, &sample.Level, &sample.Message, &sample.CreatedAt); err != nil {
				rows.Close()
				return nil, err
			}
			latestID[id].summary.Latest = &sample
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
	}

	out := make([]models.LogServiceSummary, 0, len(services))
	for _, s := range services {
		s.summary.Buckets = make([]models.LogHistogramBucket, 0, len(s.buckets))
		for _, b := range s.buckets {
			s.summary.Buckets = append(s.summary.Buckets, *b)
		}
		sort.Slice(s.summary.Buckets, func(i, j int) bool { return s.summary.Buckets[i].Time.Before(s.summary.Buckets[j].Time) })
		out = append(out, s.summary)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Error != out[j].Error {
			return out[i].Error > out[j].Error
		}
		if out[i].Warn != out[j].Warn {
			return out[i].Warn > out[j].Warn
		}
		return out[i].ServiceName < out[j].ServiceName
	})
	return out, nil
}

// Patterns returns the most frequent error/warn groups since `from`, errors
// before warnings. Stored fingerprints already mask the variable parts.
func (r *LogRepository) Patterns(from time.Time, limit int) ([]models.LogPattern, error) {
	// With a single MAX() aggregate SQLite takes the bare columns from that row,
	// so created_at and message are the newest occurrence's. The bare created_at
	// also keeps its DATETIME type — the driver returns MAX(created_at) as text.
	rows, err := DB.Query(`
		SELECT fingerprint, level, COALESCE(service_id, ''), COALESCE(agent_id, ''), COALESCE(service_name, ''),
			COUNT(*) AS n, MAX(created_at), created_at, message
		FROM logs
		WHERE level IN ('error', 'warn') AND created_at >= ? AND fingerprint != ''
		GROUP BY fingerprint
		ORDER BY level = 'error' DESC, n DESC
		LIMIT ?`, from, limit)
	if err != nil {
		return nil, err
	}
	patterns := []models.LogPattern{}
	for rows.Next() {
		var p models.LogPattern
		var newest interface{}
		if err := rows.Scan(&p.Fingerprint, &p.Level, &p.ServiceID, &p.AgentID, &p.ServiceName,
			&p.Count, &newest, &p.LastSeen, &p.Message); err != nil {
			rows.Close()
			return nil, err
		}
		patterns = append(patterns, p)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}

	// First seen looks past the window, so a pattern that started inside it is
	// new. idx_logs_fingerprint_time makes each lookup a single index probe.
	for i := range patterns {
		if err := DB.QueryRow(`SELECT created_at FROM logs WHERE fingerprint = ? ORDER BY created_at LIMIT 1`,
			patterns[i].Fingerprint).Scan(&patterns[i].FirstSeen); err != nil {
			return nil, err
		}
	}
	return patterns, nil
}
