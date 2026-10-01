package database

import (
	"database/sql"
	"sort"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// ApiRequestRepository handles captured HTTP request metadata operations.
type ApiRequestRepository struct{}

// NewApiRequestRepository creates a new ApiRequestRepository.
func NewApiRequestRepository() *ApiRequestRepository {
	return &ApiRequestRepository{}
}

func scanApiRequest(
	id *int64,
	serviceID, agentID, requestID, method, path, pathTemplate *string,
	statusCode, durationMs *int,
	serviceName, traceID, spanID, route, clientIP, errStr *sql.NullString,
	isError *int,
	createdAt *time.Time,
) models.ApiRequest {
	req := models.ApiRequest{
		ID:           *id,
		ServiceID:    *serviceID,
		AgentID:      *agentID,
		RequestID:    *requestID,
		Method:       *method,
		Path:         *path,
		PathTemplate: *pathTemplate,
		StatusCode:   *statusCode,
		DurationMs:   *durationMs,
		IsError:      *isError == 1,
		CreatedAt:    *createdAt,
	}
	if serviceName.Valid {
		req.ServiceName = serviceName.String
	}
	if traceID.Valid {
		req.TraceID = traceID.String
	}
	if spanID.Valid {
		req.SpanID = spanID.String
	}
	if route.Valid {
		req.Route = route.String
	}
	if clientIP.Valid {
		req.ClientIP = clientIP.String
	}
	if errStr.Valid {
		req.Error = errStr.String
	}
	return req
}

// Create inserts a new ApiRequest and sets req.ID from the auto-incremented row ID.
func (r *ApiRequestRepository) Create(req *models.ApiRequest) error {
	result, err := DB.Exec(`
		INSERT INTO api_requests
			(service_id, agent_id, request_id, method, path, path_template,
			 status_code, duration_ms, client_ip,
			 error, is_error, created_at, trace_id, span_id, route, service_name)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		req.ServiceID, req.AgentID, req.RequestID, req.Method, req.Path, req.PathTemplate,
		req.StatusCode, req.DurationMs, req.ClientIP,
		req.Error, boolToInt(req.IsError), req.CreatedAt,
		req.TraceID, req.SpanID, req.Route, req.ServiceName,
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	req.ID = id
	return nil
}

// CreateBatch inserts multiple ApiRequests in a single transaction.
// Returns the count of inserted rows.
func (r *ApiRequestRepository) CreateBatch(reqs []models.ApiRequest) (int, error) {
	if len(reqs) == 0 {
		return 0, nil
	}

	count := 0
	err := Transaction(func(tx *sql.Tx) error {
		stmt, err := tx.Prepare(`
			INSERT INTO api_requests
				(service_id, agent_id, request_id, method, path, path_template,
				 status_code, duration_ms, client_ip,
				 error, is_error, created_at, trace_id, span_id, route, service_name)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, req := range reqs {
			_, err := stmt.Exec(
				req.ServiceID, req.AgentID, req.RequestID, req.Method, req.Path, req.PathTemplate,
				req.StatusCode, req.DurationMs, req.ClientIP,
				req.Error, boolToInt(req.IsError), req.CreatedAt,
				req.TraceID, req.SpanID, req.Route, req.ServiceName,
			)
			if err != nil {
				return err
			}
			count++
		}
		return nil
	})
	return count, err
}

// GetByID returns the ApiRequest with the given ID.
// Returns nil, nil if not found.
func (r *ApiRequestRepository) GetByID(id int64) (*models.ApiRequest, error) {
	var (
		statusCode, durationMs                                    int
		isError                                                   int
		rid64                                                     int64
		serviceID, agentID, requestID, method, path, pathTemplate string
		serviceName, traceID, spanID, route, clientIP, errStr     sql.NullString
		createdAt                                                 time.Time
	)

	err := DB.QueryRow(`
		SELECT id, service_id, agent_id, request_id, method, path, path_template,
		       status_code, duration_ms, client_ip,
		       error, is_error, created_at, trace_id, span_id, route, service_name
		FROM api_requests WHERE id = ?
	`, id).Scan(
		&rid64, &serviceID, &agentID, &requestID, &method, &path, &pathTemplate,
		&statusCode, &durationMs, &clientIP,
		&errStr, &isError, &createdAt, &traceID, &spanID, &route, &serviceName,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	req := scanApiRequest(
		&rid64, &serviceID, &agentID, &requestID, &method, &path, &pathTemplate,
		&statusCode, &durationMs, &serviceName, &traceID, &spanID, &route, &clientIP, &errStr, &isError, &createdAt,
	)
	return &req, nil
}

// GetByTraceID returns ApiRequest projections that share the given trace ID,
// ordered by creation time. Returns nil when none match.
func (r *ApiRequestRepository) GetByTraceID(traceID string) ([]models.ApiRequest, error) {
	if traceID == "" {
		return nil, nil
	}
	rows, err := DB.Query(`
		SELECT id, service_id, agent_id, request_id, method, path, path_template,
		       status_code, duration_ms, client_ip,
		       error, is_error, created_at, trace_id, span_id, route, service_name
		FROM api_requests WHERE trace_id = ?
		ORDER BY created_at ASC
	`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.ApiRequest
	for rows.Next() {
		var (
			statusCode, durationMs                                    int
			isError                                                   int
			rid64                                                     int64
			serviceID, agentID, requestID, method, path, pathTemplate string
			serviceName, traceCol, spanID, route, clientIP, errStr    sql.NullString
			createdAt                                                 time.Time
		)
		if err := rows.Scan(
			&rid64, &serviceID, &agentID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &clientIP,
			&errStr, &isError, &createdAt, &traceCol, &spanID, &route, &serviceName,
		); err != nil {
			return nil, err
		}
		out = append(out, scanApiRequest(
			&rid64, &serviceID, &agentID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &serviceName, &traceCol, &spanID, &route, &clientIP, &errStr, &isError, &createdAt,
		))
	}
	return out, nil
}

// List returns a paginated, filtered list of ApiRequests and the total count.
// f.ServiceID is always applied. Other filters are optional (zero-value = skip).
func (r *ApiRequestRepository) List(f *models.ApiRequestFilter) ([]models.ApiRequest, int, error) {
	if f == nil {
		f = &models.ApiRequestFilter{}
	}

	where := "1=1"
	args := []interface{}{}

	if f.ServiceID != "" {
		where += " AND service_id = ?"
		args = append(args, f.ServiceID)
	}
	if f.AgentID != "" {
		where += " AND agent_id = ?"
		args = append(args, f.AgentID)
	}
	if f.ServiceName != "" {
		where += " AND service_name = ?"
		args = append(args, f.ServiceName)
	}

	if f.TraceID != "" {
		where += " AND trace_id = ?"
		args = append(args, f.TraceID)
	}
	if f.ErrorsOnly {
		where += " AND is_error = 1"
	}
	if f.MinStatus > 0 && f.MaxStatus > 0 {
		where += " AND status_code BETWEEN ? AND ?"
		args = append(args, f.MinStatus, f.MaxStatus)
	} else if f.MinStatus > 0 {
		where += " AND status_code >= ?"
		args = append(args, f.MinStatus)
	} else if f.MaxStatus > 0 {
		where += " AND status_code <= ?"
		args = append(args, f.MaxStatus)
	}
	if f.PathPrefix != "" {
		where += " AND path LIKE ?"
		args = append(args, f.PathPrefix+"%")
	}
	if f.Search != "" {
		where += " AND path LIKE ?"
		args = append(args, "%"+f.Search+"%")
	}
	if !f.From.IsZero() {
		where += " AND created_at >= ?"
		args = append(args, f.From)
	}
	if !f.To.IsZero() {
		where += " AND created_at <= ?"
		args = append(args, f.To)
	}
	if len(f.Methods) > 0 {
		placeholders := make([]string, len(f.Methods))
		for i, m := range f.Methods {
			placeholders[i] = "?"
			args = append(args, m)
		}
		where += " AND method IN (" + strings.Join(placeholders, ",") + ")"
	}

	var total int
	if err := DB.QueryRow("SELECT COUNT(*) FROM api_requests WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := f.Limit
	if limit <= 0 {
		limit = 200
	}
	dataQuery := "SELECT id, service_id, agent_id, request_id, method, path, path_template," +
		" status_code, duration_ms, client_ip," +
		" error, is_error, created_at, trace_id, span_id, route, service_name" +
		" FROM api_requests WHERE " + where +
		" ORDER BY created_at DESC LIMIT ?"
	dataArgs := append(args, limit)
	if f.Offset > 0 {
		dataQuery += " OFFSET ?"
		dataArgs = append(dataArgs, f.Offset)
	}

	rows, err := DB.Query(dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []models.ApiRequest
	for rows.Next() {
		var (
			statusCode, durationMs                                    int
			id64                                                      int64
			isError                                                   int
			serviceID, agentID, requestID, method, path, pathTemplate string
			serviceName, traceID, spanID, route, clientIP, errStr     sql.NullString
			createdAt                                                 time.Time
		)
		if err := rows.Scan(
			&id64, &serviceID, &agentID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &clientIP,
			&errStr, &isError, &createdAt, &traceID, &spanID, &route, &serviceName,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, scanApiRequest(
			&id64, &serviceID, &agentID, &requestID, &method, &path, &pathTemplate,
			&statusCode, &durationMs, &serviceName, &traceID, &spanID, &route, &clientIP, &errStr, &isError, &createdAt,
		))
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

// RequestStats returns time-bucketed request aggregates (volume, errors, p50,
// p95, p99) for the trends chart. Scoped by the same agent/service/time filter as
// List; rows are fetched raw and bucketed in Go (SQLite has no percentile
// function — same approach as GetServiceHistoryBuckets). maxRows caps the scan.
func (r *ApiRequestRepository) RequestStats(f *models.ApiRequestFilter, bucketMins int) ([]models.ApiRequestStatBucket, error) {
	if f == nil {
		f = &models.ApiRequestFilter{}
	}
	if bucketMins <= 0 {
		bucketMins = 5
	}

	where, args := requestScopeWhere(f)
	const maxRows = 100000
	args = append(args, maxRows)
	rows, err := DB.Query(
		"SELECT created_at, duration_ms, is_error FROM api_requests WHERE "+where+
			" ORDER BY created_at LIMIT ?", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type raw struct {
		at       time.Time
		duration int
		isError  bool
	}
	var records []raw
	for rows.Next() {
		var rec raw
		if err := rows.Scan(&rec.at, &rec.duration, &rec.isError); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return []models.ApiRequestStatBucket{}, nil
	}

	bucketDur := time.Duration(bucketMins) * time.Minute
	type bucket struct {
		count      int
		errorCount int
		durations  []int // only durationMs > 0
	}
	ordered := make([]time.Time, 0)
	buckets := make(map[time.Time]*bucket)
	for _, rec := range records {
		t := rec.at.Truncate(bucketDur)
		b := buckets[t]
		if b == nil {
			b = &bucket{}
			buckets[t] = b
			ordered = append(ordered, t)
		}
		b.count++
		if rec.isError {
			b.errorCount++
		}
		if rec.duration > 0 {
			b.durations = append(b.durations, rec.duration)
		}
	}

	out := make([]models.ApiRequestStatBucket, 0, len(ordered))
	for _, t := range ordered {
		b := buckets[t]
		out = append(out, models.ApiRequestStatBucket{
			Time:       t,
			Count:      b.count,
			ErrorCount: b.errorCount,
			P50:        percentile(b.durations, 50),
			P95:        percentile(b.durations, 95),
			P99:        percentile(b.durations, 99),
			Timed:      len(b.durations),
		})
	}
	return out, nil
}

// StatusSummary aggregates status-code classes over the filter window plus the
// most frequent 5xx endpoint, for the "상태코드 분포" strip on the trends card.
func (r *ApiRequestRepository) StatusSummary(f *models.ApiRequestFilter) (*models.ApiRequestStatusSummary, error) {
	if f == nil {
		f = &models.ApiRequestFilter{}
	}
	where, args := requestScopeWhere(f)

	out := &models.ApiRequestStatusSummary{}
	rows, err := DB.Query("SELECT status_code/100, COUNT(*) FROM api_requests WHERE "+where+" GROUP BY status_code/100", args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var cls, n int
		if err := rows.Scan(&cls, &n); err != nil {
			rows.Close()
			return nil, err
		}
		switch cls {
		case 2:
			out.Count2xx = n
		case 3:
			out.Count3xx = n
		case 4:
			out.Count4xx = n
		case 5:
			out.Count5xx = n
		default:
			out.CountOther += n
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close() // single connection — close before the next query

	if out.Count5xx > 0 {
		err := DB.QueryRow(
			"SELECT method, COALESCE(NULLIF(path_template,''), path), COUNT(*) AS c FROM api_requests WHERE "+where+
				" AND status_code >= 500 GROUP BY 1, 2 ORDER BY c DESC LIMIT 1", args...,
		).Scan(&out.Top5xxMethod, &out.Top5xxPath, &out.Top5xxCount)
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

// WindowStats aggregates the whole filter window into one bucket (volume,
// errors, p95, p99) for request alert rules.
func (r *ApiRequestRepository) WindowStats(f *models.ApiRequestFilter) (models.ApiRequestStatBucket, error) {
	where, args := requestScopeWhere(f)
	rows, err := DB.Query("SELECT duration_ms, is_error FROM api_requests WHERE "+where, args...)
	if err != nil {
		return models.ApiRequestStatBucket{}, err
	}
	defer rows.Close()

	out := models.ApiRequestStatBucket{Time: f.From}
	var durations []int
	for rows.Next() {
		var duration int
		var isError bool
		if err := rows.Scan(&duration, &isError); err != nil {
			return models.ApiRequestStatBucket{}, err
		}
		out.Count++
		if isError {
			out.ErrorCount++
		}
		if duration > 0 {
			durations = append(durations, duration)
		}
	}
	out.Timed = len(durations)
	out.P50 = percentile(durations, 50)
	out.P95 = percentile(durations, 95)
	out.P99 = percentile(durations, 99)
	return out, rows.Err()
}

// requestScopeWhere is the agent/service/time scope shared by the aggregate queries.
func requestScopeWhere(f *models.ApiRequestFilter) (string, []interface{}) {
	where := "1=1"
	args := []interface{}{}
	if f.ServiceID != "" {
		where += " AND service_id = ?"
		args = append(args, f.ServiceID)
	}
	if f.AgentID != "" {
		where += " AND agent_id = ?"
		args = append(args, f.AgentID)
	}
	if f.ServiceName != "" {
		where += " AND service_name = ?"
		args = append(args, f.ServiceName)
	}
	if !f.From.IsZero() {
		where += " AND created_at >= ?"
		args = append(args, f.From)
	}
	if !f.To.IsZero() {
		where += " AND created_at <= ?"
		args = append(args, f.To)
	}
	return where, args
}

// percentile returns the p-th percentile (nearest-rank) of vals, or 0 when
// empty. Sorts a copy; caller's slice is untouched.
func percentile(vals []int, p int) int {
	if len(vals) == 0 {
		return 0
	}
	sorted := append([]int(nil), vals...)
	sort.Ints(sorted)
	rank := (p*len(sorted) + 99) / 100 // ceil(p/100 * n)
	if rank < 1 {
		rank = 1
	}
	if rank > len(sorted) {
		rank = len(sorted)
	}
	return sorted[rank-1]
}

// DeleteOlderThan deletes all api_requests created before cutoff.
// Returns the number of rows deleted.
func (r *ApiRequestRepository) DeleteOlderThan(cutoff time.Time) (int64, error) {
	result, err := DB.Exec(`DELETE FROM api_requests WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// boolToInt converts a bool to 0/1 for SQLite storage.
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
