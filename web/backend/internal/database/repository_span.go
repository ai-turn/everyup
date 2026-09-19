package database

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// migrateV53 indexes spans the way the trace list reads them. Without it every
// trace listing scans the whole table, which is the one query that walks spans
// without already knowing a trace ID.
// Added: 2026-09-18
func migrateV53() error {
	for _, stmt := range []string{
		`CREATE INDEX IF NOT EXISTS idx_spans_agent_service_created ON spans(agent_id, service_name, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_spans_service_created ON spans(service_id, created_at DESC)`,
	} {
		if _, err := DB.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

// SpanRepository handles OpenTelemetry span persistence.
type SpanRepository struct{}

// NewSpanRepository creates a new span repository.
func NewSpanRepository() *SpanRepository {
	return &SpanRepository{}
}

// CreateBatch inserts spans and ignores duplicate trace_id/span_id pairs.
func (r *SpanRepository) CreateBatch(spans []models.Span) (int, error) {
	if len(spans) == 0 {
		return 0, nil
	}

	count := 0
	err := Transaction(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`
			INSERT OR IGNORE INTO spans (
				service_id, agent_id, service_name, trace_id, span_id, parent_span_id,
				name, kind, start_unix_nano, end_unix_nano, duration_ms,
				status_code, status_message, attributes, events, links, resource, created_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, span := range spans {
			result, err := stmt.Exec(
				span.ServiceID, span.AgentID, span.ServiceName, span.TraceID, span.SpanID, span.ParentSpanID,
				span.Name, span.Kind, span.StartUnixNano, span.EndUnixNano, span.DurationMs,
				span.StatusCode, span.StatusMessage, span.Attributes, span.Events, span.Links, span.Resource, span.CreatedAt,
			)
			if err != nil {
				return err
			}
			if affected, _ := result.RowsAffected(); affected > 0 {
				count++
			}
		}
		return nil
	})
	return count, err
}

// GetByTraceID returns spans that share the given trace ID, ordered by start
// time. Returns nil when none match.
func (r *SpanRepository) GetByTraceID(traceID string) ([]models.Span, error) {
	if traceID == "" {
		return nil, nil
	}
	rows, err := DB.Query(`
		SELECT id, service_id, agent_id, service_name, trace_id, span_id, parent_span_id,
			name, kind, start_unix_nano, end_unix_nano, duration_ms,
			status_code, status_message, attributes, events, links, resource, created_at
		FROM spans WHERE trace_id = ?
		ORDER BY start_unix_nano ASC
	`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var spans []models.Span
	for rows.Next() {
		var s models.Span
		var attributes, events, links, resource sql.NullString
		if err := rows.Scan(
			&s.ID, &s.ServiceID, &s.AgentID, &s.ServiceName, &s.TraceID, &s.SpanID, &s.ParentSpanID,
			&s.Name, &s.Kind, &s.StartUnixNano, &s.EndUnixNano, &s.DurationMs,
			&s.StatusCode, &s.StatusMessage, &attributes, &events, &links, &resource, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		if attributes.Valid {
			s.Attributes = []byte(attributes.String)
		}
		if events.Valid {
			s.Events = []byte(events.String)
		}
		if links.Valid {
			s.Links = []byte(links.String)
		}
		if resource.Valid {
			s.Resource = []byte(resource.String)
		}
		spans = append(spans, s)
	}
	return spans, nil
}

// DeleteOlderThan removes spans older than the cutoff. Captured request and
// response body events live on spans, so this is the body-capture retention path.
func (r *SpanRepository) DeleteOlderThan(cutoff time.Time) (int64, error) {
	result, err := DB.Exec(`DELETE FROM spans WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// ListTraces collapses stored spans into one row per trace so traces can be
// found without already knowing an ID. This is the only discovery path for a
// trace the api_requests projection drops — that projection keeps HTTP SERVER
// spans carrying a method and status, so gRPC, message consumers and batch
// jobs are reachable here and nowhere else.
func (r *SpanRepository) ListTraces(f *models.TraceFilter) ([]models.TraceSummary, error) {
	where := "service_id = ?"
	args := []interface{}{f.ServiceID}
	if f.AgentID != "" {
		where = "agent_id = ? AND service_name = ?"
		args = []interface{}{f.AgentID, f.ServiceName}
	}
	if !f.From.IsZero() {
		where += " AND created_at >= ?"
		args = append(args, f.From)
	}
	if !f.To.IsZero() {
		where += " AND created_at <= ?"
		args = append(args, f.To)
	}

	// Aggregates, so these narrow groups rather than rows.
	having := ""
	if f.ErrorsOnly {
		having = " HAVING SUM(CASE WHEN status_code = 'ERROR' THEN 1 ELSE 0 END) > 0"
	}
	if f.MinDurationMs > 0 {
		clause := " (MAX(end_unix_nano) - MIN(start_unix_nano)) / 1000000 >= ?"
		if having == "" {
			having = " HAVING" + clause
		} else {
			having += " AND" + clause
		}
		args = append(args, f.MinDurationMs)
	}

	order := " ORDER BY MIN(start_unix_nano) DESC"
	if f.SortBySlowest {
		order = " ORDER BY (MAX(end_unix_nano) - MIN(start_unix_nano)) DESC"
	}

	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	args = append(args, limit)

	// The bare name/kind/service_name columns pair with MIN(start_unix_nano),
	// so they describe the trace's earliest span (SQLite min/max bare columns).
	rows, err := DB.Query(`
		SELECT trace_id,
			name,
			kind,
			COALESCE(service_name, ''),
			MIN(start_unix_nano) AS start_nano,
			MAX(end_unix_nano) AS end_nano,
			COUNT(*),
			SUM(CASE WHEN status_code = 'ERROR' THEN 1 ELSE 0 END)
		FROM spans
		WHERE `+where+`
		GROUP BY trace_id`+having+order+`
		LIMIT ?
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var traces []models.TraceSummary
	for rows.Next() {
		var t models.TraceSummary
		var startNano, endNano uint64
		if err := rows.Scan(&t.TraceID, &t.Name, &t.Kind, &t.ServiceName,
			&startNano, &endNano, &t.SpanCount, &t.ErrorCount); err != nil {
			return nil, err
		}
		t.StartTime = time.Unix(0, int64(startNano)).UTC()
		// An in-flight span stores end 0, which would read as a negative span.
		if endNano > startNano {
			t.DurationMs = int((endNano - startNano) / uint64(time.Millisecond))
		}
		traces = append(traces, t)
	}
	return traces, rows.Err()
}

// StripBodyCaptures removes captured request/response body events from spans
// older than the cutoff, leaving the spans themselves in place. Body payloads
// are the expensive, sensitive part of a span; the trace structure is not, so
// the two age out on separate windows.
func (r *SpanRepository) StripBodyCaptures(cutoff time.Time) (int64, error) {
	// Read fully before writing: this DB runs a single connection, so a write
	// issued while rows are open deadlocks.
	// events is written from json.RawMessage, so SQLite stores it as a BLOB and
	// a bare LIKE never matches; the CAST is what makes the prefilter work.
	rows, err := DB.Query(
		`SELECT id, events FROM spans
		 WHERE created_at < ? AND CAST(events AS TEXT) LIKE '%body_masked%'`, cutoff)
	if err != nil {
		return 0, err
	}
	type pending struct {
		id     int64
		events []byte
	}
	var updates []pending
	for rows.Next() {
		var id int64
		var raw sql.NullString
		if err := rows.Scan(&id, &raw); err != nil {
			rows.Close()
			return 0, err
		}
		if !raw.Valid {
			continue
		}
		var events []map[string]interface{}
		if json.Unmarshal([]byte(raw.String), &events) != nil {
			continue
		}
		kept := make([]map[string]interface{}, 0, len(events))
		for _, event := range events {
			name, _ := event["name"].(string)
			if models.CapturedBodyEventNames[name] {
				continue
			}
			kept = append(kept, event)
		}
		if len(kept) == len(events) {
			continue
		}
		encoded, err := json.Marshal(kept)
		if err != nil {
			continue
		}
		updates = append(updates, pending{id: id, events: encoded})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return 0, err
	}
	rows.Close()

	if len(updates) == 0 {
		return 0, nil
	}
	var stripped int64
	err = Transaction(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`UPDATE spans SET events = ? WHERE id = ?`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, update := range updates {
			if _, err := stmt.Exec(string(update.events), update.id); err != nil {
				return err
			}
			stripped++
		}
		return nil
	})
	return stripped, err
}
