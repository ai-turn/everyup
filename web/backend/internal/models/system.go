package models

import "time"

// SystemInfo represents the host system information with current resource snapshot
type SystemInfo struct {
	Hostname string   `json:"hostname"`
	OS       string   `json:"os"`
	Platform string   `json:"platform"`
	Kernel   string   `json:"kernel"`
	Uptime   uint64   `json:"uptime"` // seconds
	IP       string   `json:"ip"`
	CPU      CPUInfo  `json:"cpu"`
	Memory   MemInfo  `json:"memory"`
	Disk     DiskInfo `json:"disk"`
	Network  NetInfo  `json:"network"`
}

// NetInfo represents current network throughput in MB/s.
type NetInfo struct {
	In  float64 `json:"in"`  // MB/s
	Out float64 `json:"out"` // MB/s
}

// CPUInfo represents CPU metrics
type CPUInfo struct {
	Cores int     `json:"cores"`
	Usage float64 `json:"usage"` // percentage 0-100
}

// MemInfo represents memory metrics
type MemInfo struct {
	Total float64 `json:"total"` // GB
	Used  float64 `json:"used"`  // GB
	Usage float64 `json:"usage"` // percentage 0-100
}

// DiskInfo represents disk metrics
type DiskInfo struct {
	Total      float64 `json:"total"`      // GB
	Used       float64 `json:"used"`       // GB
	Usage      float64 `json:"usage"`      // percentage 0-100
	ReadSpeed  float64 `json:"readSpeed"`  // MB/s
	WriteSpeed float64 `json:"writeSpeed"` // MB/s
}

// SystemMetric represents a stored system metric point (1-minute aggregate)
type SystemMetric struct {
	ID        int64     `json:"id"`
	HostID    string    `json:"hostId"`
	CPUUsage  float64   `json:"cpu"`
	MemTotal  float64   `json:"memTotal"`
	MemUsed   float64   `json:"memUsed"`
	MemUsage  float64   `json:"memUsage"`
	DiskTotal float64   `json:"diskTotal"`
	DiskUsed  float64   `json:"diskUsed"`
	DiskUsage float64   `json:"diskUsage"`
	DiskRead  float64   `json:"diskRead"`
	DiskWrite float64   `json:"diskWrite"`
	NetIn     float64   `json:"netIn"`
	NetOut    float64   `json:"netOut"`
	CreatedAt time.Time `json:"createdAt"`
}

// SystemMetricPoint represents a time-series point for chart rendering
type SystemMetricPoint struct {
	Timestamp string  `json:"timestamp"`
	CPU       float64 `json:"cpu"`
	MemUsage  float64 `json:"memUsage"`
	DiskUsage float64 `json:"diskUsage"`
	NetIn     float64 `json:"netIn"`
	NetOut    float64 `json:"netOut"`
}

// SystemMetricsHistory represents the history response
type SystemMetricsHistory struct {
	Range  string              `json:"range"`
	Points []SystemMetricPoint `json:"points"`
}

// ProcessInfo represents a running process
type ProcessInfo struct {
	PID         int32   `json:"pid"`
	Name        string  `json:"name"`
	CPU         float64 `json:"cpu"`
	Memory      string  `json:"memory"`
	MemoryBytes uint64  `json:"memoryBytes"`
	Status      string  `json:"status"`
}
