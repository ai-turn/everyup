package database

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// LogRepository handles log data operations
type LogRepository struct{}

// NewLogRepository creates a new log repository
func NewLogRepository() *LogRepository {
	return &LogRepository{}
}

// Create creates a new log entry
func (r *LogRepository) Create(l *models.Log) error {
	if l.Source == "" {
		l.Source = models.LogSourceInternal
	}

	result, err := DB.Exec(`
		INSERT INTO logs (
			service_id, agent_id, service_name, level, message, metadata, source, fingerprint, created_at,
			trace_id, span_id, severity_number, observed_at, resource, attributes
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, l.ServiceID, l.AgentID, l.ServiceName, l.Level, l.Message, l.Metadata, l.Source, l.Fingerprint, l.CreatedAt,
		l.TraceID, l.SpanID, l.SeverityNumber, l.ObservedAt, l.Resource, l.Attributes)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	l.ID = id
	return nil
}

// GetAll returns logs with optional filters
func (r *LogRepository) GetAll(filter models.LogFilter) ([]models.Log, int, error) {
	// Build query — JOIN services to include the legacy service name. Agent-ingested
	// logs carry their own service_name column; legacy ones resolve it via the join.
	baseWhere := " FROM logs l LEFT JOIN services s ON s.id = l.service_id WHERE 1=1"
	query := `SELECT l.id, l.service_id, l.agent_id, COALESCE(NULLIF(l.service_name, ''), s.name, l.service_id, ''), l.level,
		l.message, l.metadata, l.source, l.fingerprint, l.trace_id, l.span_id,
		l.severity_number, l.observed_at, l.resource, l.attributes, l.created_at` + baseWhere
	countQuery := "SELECT COUNT(*)" + baseWhere
	args := []interface{}{}

	if filter.ServiceID != "" {
		query += " AND l.service_id = ?"
		countQuery += " AND l.service_id = ?"
		args = append(args, filter.ServiceID)
	}
	if filter.AgentID != "" {
		query += " AND l.agent_id = ?"
		countQuery += " AND l.agent_id = ?"
		args = append(args, filter.AgentID)
	}
	if filter.ServiceName != "" {
		query += " AND COALESCE(NULLIF(l.service_name, ''), s.name) = ?"
		countQuery += " AND COALESCE(NULLIF(l.service_name, ''), s.name) = ?"
		args = append(args, filter.ServiceName)
	}
	if filter.Level != "" {
		query += " AND l.level = ?"
		countQuery += " AND l.level = ?"
		args = append(args, filter.Level)
	}
	if filter.Search != "" {
		query += " AND l.message LIKE ?"
		countQuery += " AND l.message LIKE ?"
		args = append(args, "%"+filter.Search+"%")
	}
	if path, ok := attributePath(filter.AttrKey); ok {
		query += attributeClause
		countQuery += attributeClause
		args = append(args, path, filter.AttrValue)
	}
	if filter.TraceID != "" {
		query += " AND l.trace_id = ?"
		countQuery += " AND l.trace_id = ?"
		args = append(args, filter.TraceID)
	}
	if !filter.From.IsZero() {
		query += " AND l.created_at >= ?"
		countQuery += " AND l.created_at >= ?"
		args = append(args, filter.From)
	}
	if !filter.To.IsZero() {
		query += " AND l.created_at <= ?"
		countQuery += " AND l.created_at <= ?"
		args = append(args, filter.To)
	}

	// Get total count
	var total int
	if err := DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Add pagination
	query += " ORDER BY l.created_at DESC"
	if filter.Limit > 0 {
		query += " LIMIT ?"
		args = append(args, filter.Limit)
	}
	if filter.Offset > 0 {
		query += " OFFSET ?"
		args = append(args, filter.Offset)
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []models.Log
	for rows.Next() {
		var l models.Log
		var serviceID, agentID, serviceName, metadata, source, fingerprint, traceID, spanID, resource, attributes sql.NullString
		var observedAt sql.NullTime
		if err := rows.Scan(
			&l.ID, &serviceID, &agentID, &serviceName, &l.Level, &l.Message, &metadata,
			&source, &fingerprint, &traceID, &spanID, &l.SeverityNumber,
			&observedAt, &resource, &attributes, &l.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		if serviceID.Valid {
			l.ServiceID = serviceID.String
		}
		if agentID.Valid {
			l.AgentID = agentID.String
		}
		if serviceName.Valid {
			l.ServiceName = serviceName.String
		}
		if metadata.Valid {
			l.Metadata = json.RawMessage(metadata.String)
		}
		if source.Valid {
			l.Source = source.String
		}
		if fingerprint.Valid {
			l.Fingerprint = fingerprint.String
		}
		if traceID.Valid {
			l.TraceID = traceID.String
		}
		if spanID.Valid {
			l.SpanID = spanID.String
		}
		if observedAt.Valid {
			l.ObservedAt = &observedAt.Time
		}
		if resource.Valid {
			l.Resource = json.RawMessage(resource.String)
		}
		if attributes.Valid {
			l.Attributes = json.RawMessage(attributes.String)
		}
		logs = append(logs, l)
	}
	if err := attachLinkedRequests(logs); err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

// Histogram buckets per-level log counts over the filter window for the volume
// chart. Rows are bucketed in Go (same pattern as ApiRequestRepository.RequestStats)
// to stay independent of the driver's datetime storage format.
func (r *LogRepository) Histogram(filter models.LogFilter, bucketMins int) ([]models.LogHistogramBucket, error) {
	if bucketMins <= 0 {
		bucketMins = 10
	}
	query := "SELECT l.level, l.created_at FROM logs l LEFT JOIN services s ON s.id = l.service_id WHERE 1=1"
	args := []interface{}{}
	if filter.ServiceID != "" {
		query += " AND l.service_id = ?"
		args = append(args, filter.ServiceID)
	}
	if filter.AgentID != "" {
		query += " AND l.agent_id = ?"
		args = append(args, filter.AgentID)
	}
	if filter.ServiceName != "" {
		query += " AND COALESCE(NULLIF(l.service_name, ''), s.name) = ?"
		args = append(args, filter.ServiceName)
	}
	if filter.Level != "" {
		query += " AND l.level = ?"
		args = append(args, filter.Level)
	}
	if filter.Search != "" {
		query += " AND l.message LIKE ?"
		args = append(args, "%"+filter.Search+"%")
	}
	if path, ok := attributePath(filter.AttrKey); ok {
		query += attributeClause
		args = append(args, path, filter.AttrValue)
	}
	if !filter.From.IsZero() {
		query += " AND l.created_at >= ?"
		args = append(args, filter.From)
	}
	if !filter.To.IsZero() {
		query += " AND l.created_at <= ?"
		args = append(args, filter.To)
	}
	const maxRows = 100000
	args = append(args, maxRows)
	rows, err := DB.Query(query+" ORDER BY l.created_at LIMIT ?", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bucketDur := time.Duration(bucketMins) * time.Minute
	ordered := make([]time.Time, 0)
	buckets := make(map[time.Time]*models.LogHistogramBucket)
	for rows.Next() {
		var level string
		var createdAt time.Time
		if err := rows.Scan(&level, &createdAt); err != nil {
			return nil, err
		}
		t := createdAt.Truncate(bucketDur)
		b := buckets[t]
		if b == nil {
			b = &models.LogHistogramBucket{Time: t}
			buckets[t] = b
			ordered = append(ordered, t)
		}
		switch level {
		case "error":
			b.Error++
		case "warn":
			b.Warn++
		case "debug":
			b.Debug++
		case "trace":
			b.Trace++
		default: // info + unknown levels
			b.Info++
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]models.LogHistogramBucket, 0, len(ordered))
	for _, t := range ordered {
		out = append(out, *buckets[t])
	}
	return out, nil
}

// attachLinkedRequests decorates logs with the earliest api_request matching
// (service_id, trace_id). Runs as a separate query AFTER rows are closed so
// it can't deadlock the single SQLite connection. Logs without trace_id are
// skipped.
func attachLinkedRequests(logs []models.Log) error {
	if len(logs) == 0 {
		return nil
	}

	// Collect distinct (scope, trace_id) pairs from logs that have a trace. The
	// scope is the legacy service_id, or the agent_id for agent-ingested logs.
	type key struct{ scope, trace string }
	logScope := func(l models.Log) string {
		if l.ServiceID != "" {
			return l.ServiceID
		}
		return l.AgentID
	}
	keys := map[key]struct{}{}
	traceIDs := map[string]struct{}{}
	for _, l := range logs {
		scope := logScope(l)
		if l.TraceID == "" || scope == "" {
			continue
		}
		keys[key{scope, l.TraceID}] = struct{}{}
		traceIDs[l.TraceID] = struct{}{}
	}
	if len(traceIDs) == 0 {
		return nil
	}

	placeholders := make([]string, 0, len(traceIDs))
	args := make([]interface{}, 0, len(traceIDs))
	for id := range traceIDs {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	// Earliest row per (scope, trace_id), where scope = service_id or agent_id.
	// SQLite's "MIN aggregate companion" trick returns the row matching
	// MIN(created_at) in the same GROUP BY.
	q := `
		SELECT service_id, agent_id, trace_id, id, method, path, status_code, is_error
		FROM (
			SELECT service_id, agent_id, trace_id, id, method, path, status_code, is_error,
			       created_at,
			       MIN(created_at) OVER (PARTITION BY service_id, agent_id, trace_id) AS first_at
			FROM api_requests
			WHERE trace_id IN (` + strings.Join(placeholders, ",") + `)
		)
		WHERE created_at = first_at
	`
	rows, err := DB.Query(q, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	type row struct {
		method, path string
		id           int64
		status       int
		isError      bool
	}
	byKey := map[key]row{}
	for rows.Next() {
		var (
			service, agent, trace, method, path string
			id                                  int64
			status, isErr                       int
		)
		if err := rows.Scan(&service, &agent, &trace, &id, &method, &path, &status, &isErr); err != nil {
			return err
		}
		scope := service
		if scope == "" {
			scope = agent
		}
		k := key{scope, trace}
		if _, ok := keys[k]; !ok {
			continue
		}
		if _, dup := byKey[k]; dup {
			continue
		}
		byKey[k] = row{method: method, path: path, id: id, status: status, isError: isErr == 1}
	}

	for i := range logs {
		k := key{logScope(logs[i]), logs[i].TraceID}
		if r, ok := byKey[k]; ok {
			logs[i].LinkedRequest = &models.LinkedRequest{
				ID:         r.id,
				Method:     r.method,
				Path:       r.path,
				StatusCode: r.status,
				IsError:    r.isError,
			}
		}
	}
	return nil
}

// attributeClause matches one stored attribute. The value is compared as text
// so a numeric attribute (http.status_code=500) matches the string the caller
// sends; a row with no attributes yields NULL and drops out, as it should.
const attributeClause = ` AND CAST(json_extract(l.attributes, ?) AS TEXT) = ?`

// attributePath builds the JSON path for one attribute key. Keys are dotted
// (http.route), so the segment must be quoted or SQLite reads it as a nested
// path. A key carrying a double quote cannot be expressed and is refused.
func attributePath(key string) (string, bool) {
	if key == "" || strings.Contains(key, `"`) {
		return "", false
	}
	return `$."` + key + `"`, true
}

// GetByTraceID returns logs that share the given OTel trace ID, ordered by
// creation time. Returns nil with no error when none match.
func (r *LogRepository) GetByTraceID(traceID string) ([]models.Log, error) {
	if traceID == "" {
		return nil, nil
	}
	rows, err := DB.Query(`
		SELECT l.id, l.service_id, COALESCE(NULLIF(l.service_name, ''), s.name, l.service_id, ''), l.level,
			l.message, l.metadata, l.source, l.fingerprint, l.trace_id, l.span_id,
			l.severity_number, l.observed_at, l.resource, l.attributes, l.created_at
		FROM logs l LEFT JOIN services s ON s.id = l.service_id
		WHERE l.trace_id = ?
		ORDER BY l.created_at ASC
	`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.Log
	for rows.Next() {
		var l models.Log
		var serviceID, serviceName, metadata, source, fingerprint, traceCol, spanID, resource, attributes sql.NullString
		var observedAt sql.NullTime
		if err := rows.Scan(
			&l.ID, &serviceID, &serviceName, &l.Level, &l.Message, &metadata,
			&source, &fingerprint, &traceCol, &spanID, &l.SeverityNumber,
			&observedAt, &resource, &attributes, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		l.ServiceID = serviceID.String
		l.ServiceName = serviceName.String
		if metadata.Valid {
			l.Metadata = json.RawMessage(metadata.String)
		}
		l.Source = source.String
		l.Fingerprint = fingerprint.String
		l.TraceID = traceCol.String
		l.SpanID = spanID.String
		if observedAt.Valid {
			l.ObservedAt = &observedAt.Time
		}
		if resource.Valid {
			l.Resource = json.RawMessage(resource.String)
		}
		if attributes.Valid {
			l.Attributes = json.RawMessage(attributes.String)
		}
		logs = append(logs, l)
	}
	return logs, nil
}

// DeleteOld deletes logs older than the specified duration
func (r *LogRepository) DeleteOld(retention time.Duration) (int64, error) {
	result, err := DB.Exec(`
		DELETE FROM logs WHERE created_at < ?
	`, time.Now().Add(-retention))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
