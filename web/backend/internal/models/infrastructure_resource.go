package models

import "time"

const (
	InfrastructureAdapterAgent         = "everyup-agent"
	InfrastructureAdapterOTelCollector = "otel-collector"
)

// InfrastructureResource is the shared read model for Agent host metrics and
// standard OpenTelemetry Collector hostmetrics targets.
type InfrastructureResource struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	ProjectID    string     `json:"projectId,omitempty"`
	ServerID     string     `json:"serverId,omitempty"`
	Adapter      string     `json:"adapter"`
	IsActive     bool       `json:"isActive"`
	ApiKeyMasked string     `json:"apiKeyMasked,omitempty"`
	LastSeenAt   *time.Time `json:"lastSeenAt,omitempty"`
	CPUUsage     *float64   `json:"cpuUsage,omitempty"`
	MemoryUsage  *float64   `json:"memoryUsage,omitempty"`
	DiskUsage    *float64   `json:"diskUsage,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type InfrastructureResourceInput struct {
	Name      string `json:"name"`
	ProjectID string `json:"projectId,omitempty"`
	ServerID  string `json:"serverId,omitempty"`
}

type InfrastructureResourceSetup struct {
	InfrastructureResource
	ApiKey string `json:"apiKey"`
}
