package database

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// MetricRepository handles metric data operations
type MetricRepository struct{}

// NewMetricRepository creates a new metric repository
func NewMetricRepository() *MetricRepository {
	return &MetricRepository{}
}

// Create creates a new metric
func (r *MetricRepository) Create(m *models.Metric) error {
	result, err := DB.Exec(`
		INSERT INTO metrics (service_id, status, response_time, status_code, error_message, checked_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, m.ServiceID, m.Status, m.ResponseTime, m.StatusCode, m.ErrorMessage, m.CheckedAt)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	m.ID = id
	return nil
}

// GetByServiceID returns metrics for a service
func (r *MetricRepository) GetByServiceID(serviceID string, limit int) ([]models.Metric, error) {
	if limit <= 0 {
		limit = 100
	}

	rows, err := DB.Query(`
		SELECT id, service_id, status, response_time, status_code, error_message, checked_at
		FROM metrics
		WHERE service_id = ?
		ORDER BY checked_at DESC
		LIMIT ?
	`, serviceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var metrics []models.Metric
	for rows.Next() {
		var m models.Metric
		var statusCode, responseTime sql.NullInt64
		var errorMsg sql.NullString
		if err := rows.Scan(&m.ID, &m.ServiceID, &m.Status, &responseTime, &statusCode, &errorMsg, &m.CheckedAt); err != nil {
			return nil, err
		}
		if statusCode.Valid {
			m.StatusCode = int(statusCode.Int64)
		}
		if responseTime.Valid {
			m.ResponseTime = int(responseTime.Int64)
		}
		if errorMsg.Valid {
			m.ErrorMessage = errorMsg.String
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}

// GetSummary returns metric summary for a service
func (r *MetricRepository) GetSummary(serviceID string, duration time.Duration) (*models.MetricSummary, error) {
	since := time.Now().Add(-duration)

	var summary models.MetricSummary
	summary.ServiceID = serviceID

	err := DB.QueryRow(`
		SELECT
			COUNT(*) as total,
			COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) as success,
			-- A failed check's response_time is its timeout, not a response.
			COALESCE(AVG(CASE WHEN status = 'success' AND response_time > 0 THEN response_time END), 0) as avg_rt,
			COALESCE(MIN(CASE WHEN status = 'success' AND response_time > 0 THEN response_time END), 0) as min_rt,
			COALESCE(MAX(CASE WHEN status = 'success' THEN response_time END), 0) as max_rt
		FROM metrics
		WHERE service_id = ? AND checked_at >= ?
	`, serviceID, since).Scan(
		&summary.TotalChecks,
		&summary.SuccessfulChecks,
		&summary.AvgResponseTime,
		&summary.MinResponseTime,
		&summary.MaxResponseTime,
	)
	if err != nil {
		return nil, err
	}

	summary.FailedChecks = summary.TotalChecks - summary.SuccessfulChecks
	if summary.TotalChecks > 0 {
		summary.Uptime = float64(summary.SuccessfulChecks) / float64(summary.TotalChecks) * 100
	}

	return &summary, nil
}

// GetUptimeData returns daily uptime data for calendar view
func (r *MetricRepository) GetUptimeData(serviceID string, days int) ([]models.UptimeData, error) {
	rows, err := DB.Query(`
		SELECT
			COALESCE(DATE(checked_at), '') as date,
			COUNT(*) as total,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
		FROM metrics
		WHERE service_id = ? AND checked_at >= DATE('now', ?)
		GROUP BY DATE(checked_at)
		HAVING date != ''
		ORDER BY date DESC
	`, serviceID, fmt.Sprintf("-%d days", days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var data []models.UptimeData
	for rows.Next() {
		var d models.UptimeData
		var date sql.NullString
		if err := rows.Scan(&date, &d.Checks, &d.Success); err != nil {
			return nil, err
		}
		if date.Valid {
			d.Date = date.String
		}
		d.Failure = d.Checks - d.Success
		if d.Checks > 0 {
			d.Uptime = float64(d.Success) / float64(d.Checks) * 100
		}
		data = append(data, d)
	}
	return data, nil
}

// GetRecentChecks returns recent check results (success + failure) across all non-log services
func (r *MetricRepository) GetRecentChecks(limit int) ([]models.CheckEntry, error) {
	if limit <= 0 {
		limit = 100
	}

	rows, err := DB.Query(`
		SELECT m.id, m.service_id, COALESCE(s.name, m.service_id),
		       COALESCE(s.type, 'http'), m.status,
		       m.response_time, m.status_code, m.error_message, m.checked_at
		FROM metrics m
		LEFT JOIN services s ON s.id = m.service_id
		WHERE (s.type IS NULL OR s.type != 'log')
		ORDER BY m.checked_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.CheckEntry
	for rows.Next() {
		var e models.CheckEntry
		var statusCode, responseTime sql.NullInt64
		var errorMsg sql.NullString
		if err := rows.Scan(&e.ID, &e.ServiceID, &e.ServiceName, &e.ServiceType, &e.Status,
			&responseTime, &statusCode, &errorMsg, &e.CheckedAt); err != nil {
			return nil, err
		}
		if statusCode.Valid {
			e.StatusCode = int(statusCode.Int64)
		}
		if responseTime.Valid {
			e.ResponseTime = int(responseTime.Int64)
		}
		if errorMsg.Valid {
			e.ErrorMessage = errorMsg.String
		}
		results = append(results, e)
	}
	return results, nil
}

// GetAllFailures returns recent failures across all services, joined with service name
func (r *MetricRepository) GetAllFailures(limit int) ([]models.FailureWithService, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := DB.Query(`
		SELECT m.id, m.service_id, COALESCE(s.name, m.service_id), m.status,
		       m.response_time, m.status_code, m.error_message, m.checked_at
		FROM metrics m
		LEFT JOIN services s ON s.id = m.service_id
		WHERE m.status = 'failure'
		ORDER BY m.checked_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.FailureWithService
	for rows.Next() {
		var f models.FailureWithService
		var statusCode, responseTime sql.NullInt64
		var errorMsg sql.NullString
		if err := rows.Scan(&f.ID, &f.ServiceID, &f.ServiceName, &f.Status,
			&responseTime, &statusCode, &errorMsg, &f.CheckedAt); err != nil {
			return nil, err
		}
		if statusCode.Valid {
			f.StatusCode = int(statusCode.Int64)
		}
		if responseTime.Valid {
			f.ResponseTime = int(responseTime.Int64)
		}
		if errorMsg.Valid {
			f.ErrorMessage = errorMsg.String
		}
		results = append(results, f)
	}
	return results, nil
}

// GetUptimeSummaryAll returns per-service uptime percentages over the last N days
func (r *MetricRepository) GetUptimeSummaryAll(days int) ([]models.ServiceUptimeSummary, error) {
	if days <= 0 {
		days = 90
	}

	rows, err := DB.Query(`
		SELECT m.service_id, COALESCE(s.name, m.service_id),
		       COUNT(*) as total,
		       SUM(CASE WHEN m.status = 'success' THEN 1 ELSE 0 END) as success
		FROM metrics m
		LEFT JOIN services s ON s.id = m.service_id
		WHERE m.checked_at >= DATE('now', ?)
		  AND s.type != 'log'
		GROUP BY m.service_id
		ORDER BY COALESCE(s.name, m.service_id) ASC
	`, fmt.Sprintf("-%d days", days))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.ServiceUptimeSummary
	for rows.Next() {
		var sum models.ServiceUptimeSummary
		var total, success int
		if err := rows.Scan(&sum.ServiceID, &sum.ServiceName, &total, &success); err != nil {
			return nil, err
		}
		sum.TotalChecks = total
		sum.Failures = total - success
		if total > 0 {
			sum.Uptime = float64(success) / float64(total) * 100
		}
		results = append(results, sum)
	}
	return results, nil
}

// GetRecentResponseTimesBatch returns the last `limit` response times per service,
// ordered oldest→newest, for all services with data in the last 7 days.
func (r *MetricRepository) GetRecentResponseTimesBatch(limit int) (map[string][]int, error) {
	if limit <= 0 {
		limit = 24
	}
	rows, err := DB.Query(`
		SELECT service_id, response_time
		FROM metrics
		WHERE checked_at >= datetime('now', '-7 days') AND status = 'success' AND response_time > 0
		ORDER BY service_id, checked_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := map[string]int{}
	result := map[string][]int{}
	for rows.Next() {
		var sid string
		var rt int
		if err := rows.Scan(&sid, &rt); err != nil {
			return nil, err
		}
		if counts[sid] < limit {
			result[sid] = append(result[sid], rt)
			counts[sid]++
		}
	}

	// Reverse each slice so it goes oldest→newest for sparkline rendering
	for sid, v := range result {
		for i, j := 0, len(v)-1; i < j; i, j = i+1, j-1 {
			v[i], v[j] = v[j], v[i]
		}
		result[sid] = v
	}
	return result, nil
}

// GetKpiSummary returns aggregate KPI statistics for healthcheck services (non-log type).
func (r *MetricRepository) GetKpiSummary() (*models.HealthCheckKpiSummary, error) {
	var kpi models.HealthCheckKpiSummary

	// 1. Count services by latest metric status
	row := DB.QueryRow(`
		SELECT
			COUNT(*) AS total,
			SUM(CASE WHEN is_active = 1 AND last_status = 'success' THEN 1 ELSE 0 END) AS healthy,
			SUM(CASE WHEN is_active = 1 AND last_status = 'failure' THEN 1 ELSE 0 END) AS unhealthy,
			SUM(CASE WHEN is_active = 0 OR last_status IS NULL THEN 1 ELSE 0 END) AS unknown_cnt
		FROM (
			SELECT s.id, s.is_active,
				(SELECT m.status FROM metrics m WHERE m.service_id = s.id ORDER BY m.checked_at DESC LIMIT 1) AS last_status
			FROM services s
			WHERE s.type != 'log'
		)
	`)
	if err := row.Scan(&kpi.Total, &kpi.Healthy, &kpi.Unhealthy, &kpi.Unknown); err != nil {
		return nil, err
	}

	// 2. Avg uptime and avg latency over last 24h across all healthcheck services
	row2 := DB.QueryRow(`
		SELECT
			COALESCE(AVG(CAST(succ AS REAL) / NULLIF(cnt, 0) * 100), 100.0) AS avg_uptime,
			COALESCE(AVG(avg_rt), 0.0) AS avg_latency
		FROM (
			SELECT service_id,
				COUNT(*) AS cnt,
				SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS succ,
				AVG(CASE WHEN response_time > 0 THEN response_time END) AS avg_rt
			FROM metrics
			WHERE checked_at >= datetime('now', '-24 hours')
			GROUP BY service_id
		) t
		JOIN services s ON s.id = t.service_id
		WHERE s.type != 'log'
	`)
	if err := row2.Scan(&kpi.AvgUptime, &kpi.AvgLatency); err != nil {
		kpi.AvgUptime = 100.0
	}

	// 3. Active incidents count
	DB.QueryRow(`SELECT COUNT(*) FROM incidents WHERE resolved_at IS NULL OR resolved_at = ''`).Scan(&kpi.ActiveIncidents)

	// 4. 24-point hourly sparkline (avg response time per hour, last 24h)
	sparkRows, err := DB.Query(`
		SELECT
			CAST((julianday('now') - julianday(m.checked_at)) * 24 AS INTEGER) AS hours_ago,
			AVG(m.response_time) AS avg_rt
		FROM metrics m
		JOIN services s ON s.id = m.service_id
		WHERE m.checked_at >= datetime('now', '-24 hours')
			AND s.type != 'log'
			AND m.response_time > 0
		GROUP BY hours_ago
		ORDER BY hours_ago DESC
	`)
	if err == nil {
		defer sparkRows.Close()
		buckets := make(map[int]float64)
		for sparkRows.Next() {
			var hoursAgo int
			var avgRt float64
			if sparkRows.Scan(&hoursAgo, &avgRt) == nil && hoursAgo >= 0 && hoursAgo < 24 {
				buckets[hoursAgo] = avgRt
			}
		}
		// Build 24-slot array oldest→newest (index 0 = 23h ago, index 23 = current hour)
		history := make([]float64, 24)
		for i := 0; i < 24; i++ {
			hoursAgo := 23 - i
			if v, ok := buckets[hoursAgo]; ok {
				history[i] = v
			}
		}
		kpi.LatencyHistory = history
	}

	return &kpi, nil
}

// DeleteOld deletes metrics older than the specified duration
func (r *MetricRepository) DeleteOld(retention time.Duration) (int64, error) {
	result, err := DB.Exec(`
		DELETE FROM metrics WHERE checked_at < ?
	`, time.Now().Add(-retention))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// GetHistoryBuckets groups a monitor's checks since `since` into bucketMins-minute
// buckets, oldest first. The latency average covers successful checks only — a
// failed check's time is its timeout.
func (r *MetricRepository) GetHistoryBuckets(serviceID string, since time.Time, bucketMins int) ([]models.ServiceHistoryPoint, error) {
	rows, err := DB.Query(`
		SELECT status, response_time, checked_at
		FROM metrics
		WHERE service_id = ? AND checked_at >= ?
		ORDER BY checked_at`, serviceID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type bucket struct {
		t                     time.Time
		total, success, sumMs int
	}
	var buckets []*bucket
	for rows.Next() {
		var status string
		var ms int
		var at time.Time
		if err := rows.Scan(&status, &ms, &at); err != nil {
			return nil, err
		}
		t := at.Truncate(time.Duration(bucketMins) * time.Minute)
		// Rows arrive in time order, so a bucket only ever extends the last one.
		if len(buckets) == 0 || !buckets[len(buckets)-1].t.Equal(t) {
			buckets = append(buckets, &bucket{t: t})
		}
		b := buckets[len(buckets)-1]
		b.total++
		if status == string(models.CheckStatusSuccess) {
			b.success++
			b.sumMs += ms
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	points := make([]models.ServiceHistoryPoint, 0, len(buckets))
	for _, b := range buckets {
		p := models.ServiceHistoryPoint{
			Time:      b.t.UTC().Format(time.RFC3339),
			UptimePct: float64(b.success) * 100 / float64(b.total),
			Total:     b.total,
		}
		if b.success > 0 {
			p.LatencyMs = float64(b.sumMs) / float64(b.success)
		}
		points = append(points, p)
	}
	return points, nil
}
