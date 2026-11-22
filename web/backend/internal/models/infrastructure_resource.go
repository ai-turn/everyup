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
	// Infrastructure "otel" removes host metrics from the server's Docker Collector so that this
	// resource is the server's one source (ADR 0012). Required when that Docker Collector collects them.
	Infrastructure string `json:"infrastructure,omitempty"`
}

type InfrastructureResourceSetup struct {
	InfrastructureResource
	ApiKey string `json:"apiKey"`
}
