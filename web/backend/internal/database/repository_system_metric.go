package database

import (
	"database/sql"
	"math"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// SystemMetricRepository handles system metric data operations
type SystemMetricRepository struct{}

// NewSystemMetricRepository creates a new system metric repository
func NewSystemMetricRepository() *SystemMetricRepository {
	return &SystemMetricRepository{}
}

// Create stores a 1-minute aggregate system metric
func (r *SystemMetricRepository) Create(m *models.SystemMetric) error {
	result, err := DB.Exec(`
		INSERT INTO system_metrics (host_id, cpu_usage, mem_total, mem_used, mem_usage,
		                            disk_total, disk_used, disk_usage,
		                            disk_read, disk_write, net_in, net_out, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, m.HostID, m.CPUUsage, m.MemTotal, m.MemUsed, m.MemUsage,
		m.DiskTotal, m.DiskUsed, m.DiskUsage,
		m.DiskRead, m.DiskWrite, m.NetIn, m.NetOut, m.CreatedAt)
	if err != nil {
		return err
	}

	id, _ := result.LastInsertId()
	m.ID = id
	return nil
}

// GetHistory returns system metrics for a given host and time range, downsampled into
// bucketMinutes-wide AVG buckets so the chart always receives a clean, bounded set of
// data points regardless of how many 1-minute rows are stored.
//
// Bucketing is done in Go, not SQL: the modernc.org/sqlite driver stores time.Time
// via Go's time.Time.String() (e.g. "2026-05-18 22:56:18.1 +0900 KST m=+12.3"),
// which SQLite's strftime() cannot parse — it returns NULL and the scan fails.
// Scanning created_at back into a time.Time works, so we aggregate here instead.
func (r *SystemMetricRepository) GetHistory(hostID string, since time.Time, bucketMinutes int) ([]models.SystemMetricPoint, error) {
	if bucketMinutes <= 0 {
		bucketMinutes = 1
	}

	rows, err := DB.Query(`
		SELECT created_at, cpu_usage, mem_usage, disk_usage, net_in, net_out
		FROM system_metrics
		WHERE host_id = ? AND created_at >= ?
		ORDER BY created_at ASC
	`, hostID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type acc struct {
		cpu, memUsage, diskUsage, netIn, netOut float64
		n                                       int
	}
	bucketDur := time.Duration(bucketMinutes) * time.Minute
	order := make([]time.Time, 0)
	groups := make(map[time.Time]*acc)

	for rows.Next() {
		var (
			createdAt                               time.Time
			cpu, memUsage, diskUsage, netIn, netOut float64
		)
		if err := rows.Scan(&createdAt, &cpu, &memUsage, &diskUsage, &netIn, &netOut); err != nil {
			return nil, err
		}
		key := createdAt.UTC().Truncate(bucketDur)
		a := groups[key]
		if a == nil {
			a = &acc{}
			groups[key] = a
			order = append(order, key)
		}
		a.cpu += cpu
		a.memUsage += memUsage
		a.diskUsage += diskUsage
		a.netIn += netIn
		a.netOut += netOut
		a.n++
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	points := make([]models.SystemMetricPoint, 0, len(order))
	for _, key := range order {
		a := groups[key]
		n := float64(a.n)
		points = append(points, models.SystemMetricPoint{
			Timestamp: key.Format("2006-01-02T15:04:05Z"),
			CPU:       roundTo(a.cpu/n, 1),
			MemUsage:  roundTo(a.memUsage/n, 1),
			DiskUsage: roundTo(a.diskUsage/n, 1),
			NetIn:     roundTo(a.netIn/n, 3),
			NetOut:    roundTo(a.netOut/n, 3),
		})
	}
	return points, nil
}

// roundTo rounds v to the given number of decimal places.
func roundTo(v float64, decimals int) float64 {
	p := math.Pow(10, float64(decimals))
	return math.Round(v*p) / p
}

// GetLatestByHosts returns the most recent metric for each host ID.
func (r *SystemMetricRepository) GetLatestByHosts(hostIDs []string) (map[string]models.SystemMetric, error) {
	latest := make(map[string]models.SystemMetric, len(hostIDs))
	if len(hostIDs) == 0 {
		return latest, nil
	}

	placeholders := strings.TrimRight(strings.Repeat("?,", len(hostIDs)), ",")
	args := make([]interface{}, len(hostIDs))
	for i, id := range hostIDs {
		args[i] = id
	}

	rows, err := DB.Query(`
		SELECT sm.id, sm.host_id, sm.cpu_usage, sm.mem_total, sm.mem_used, sm.mem_usage,
		       sm.disk_total, sm.disk_used, sm.disk_usage, sm.disk_read, sm.disk_write,
		       sm.net_in, sm.net_out, sm.created_at
		FROM system_metrics sm
		INNER JOIN (
			SELECT host_id, MAX(created_at) AS created_at
			FROM system_metrics
			WHERE host_id IN (`+placeholders+`)
			GROUP BY host_id
		) latest
			ON latest.host_id = sm.host_id AND latest.created_at = sm.created_at
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var m models.SystemMetric
		var ts time.Time
		if err := rows.Scan(&m.ID, &m.HostID, &m.CPUUsage, &m.MemTotal, &m.MemUsed, &m.MemUsage,
			&m.DiskTotal, &m.DiskUsed, &m.DiskUsage, &m.DiskRead, &m.DiskWrite,
			&m.NetIn, &m.NetOut, &ts); err != nil {
			return nil, err
		}
		m.CreatedAt = ts
		latest[m.HostID] = m
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return latest, nil
}

// GetNetTrendByHosts returns recent total network throughput (net_in + net_out,
// MB/s) per host since the given cutoff, ordered oldest-first. Used for the
// compact network sparkline on infra cards.
func (r *SystemMetricRepository) GetNetTrendByHosts(hostIDs []string, since time.Time) (map[string][]float64, error) {
	trends := make(map[string][]float64, len(hostIDs))
	if len(hostIDs) == 0 {
		return trends, nil
	}

	placeholders := strings.TrimRight(strings.Repeat("?,", len(hostIDs)), ",")
	args := make([]interface{}, 0, len(hostIDs)+1)
	for _, id := range hostIDs {
		args = append(args, id)
	}
	args = append(args, since)

	rows, err := DB.Query(`
		SELECT host_id, net_in, net_out
		FROM system_metrics
		WHERE host_id IN (`+placeholders+`) AND created_at >= ?
		ORDER BY created_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var hostID string
		var netIn, netOut float64
		if err := rows.Scan(&hostID, &netIn, &netOut); err != nil {
			return nil, err
		}
		trends[hostID] = append(trends[hostID], roundTo(netIn+netOut, 3))
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return trends, nil
}

// GetLatestByHost returns the most recent metric for a host
func (r *SystemMetricRepository) GetLatestByHost(hostID string) (*models.SystemMetric, error) {
	var m models.SystemMetric
	var ts time.Time
	err := DB.QueryRow(`
		SELECT id, host_id, cpu_usage, mem_total, mem_used, mem_usage,
		       disk_total, disk_used, disk_usage, disk_read, disk_write,
		       net_in, net_out, created_at
		FROM system_metrics
		WHERE host_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`, hostID).Scan(&m.ID, &m.HostID, &m.CPUUsage, &m.MemTotal, &m.MemUsed, &m.MemUsage,
		&m.DiskTotal, &m.DiskUsed, &m.DiskUsage, &m.DiskRead, &m.DiskWrite,
		&m.NetIn, &m.NetOut, &ts)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	m.CreatedAt = ts
	return &m, nil
}

// DeleteOld deletes system metrics older than the specified duration
func (r *SystemMetricRepository) DeleteOld(retention time.Duration) (int64, error) {
	result, err := DB.Exec(`
		DELETE FROM system_metrics WHERE created_at < ?
	`, time.Now().Add(-retention))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
