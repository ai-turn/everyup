package models

import "time"

// TelemetrySignal is one OTLP signal a direct connection may ingest.
type TelemetrySignal string

const (
	TelemetrySignalLogs    TelemetrySignal = "logs"
	TelemetrySignalMetrics TelemetrySignal = "metrics"
	TelemetrySignalTraces  TelemetrySignal = "traces"
)

// ObservedService is an application or workload that can receive telemetry
// without an Agent. Agent-discovered services continue to use AgentService
// until their identity migration is completed.
type ObservedService struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	ProjectID       string            `json:"projectId,omitempty"`
	ServerID        string            `json:"serverId,omitempty"`
	Signals         []TelemetrySignal `json:"signals"`
	LogLevelFilter  []LogLevel        `json:"logLevelFilter,omitempty"`
	ApiExcludePaths []string          `json:"apiExcludePaths,omitempty"`
	IsActive        bool              `json:"isActive"`
	ApiKeyMasked    string            `json:"apiKeyMasked,omitempty"`
	LastSeenAt      *time.Time        `json:"lastSeenAt,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
}

// ObservedServiceInput is the management input for a direct Observed Service.
type ObservedServiceInput struct {
	Name      string            `json:"name"`
	ProjectID string            `json:"projectId,omitempty"`
	ServerID  string            `json:"serverId,omitempty"`
	Signals   []TelemetrySignal `json:"signals"`
}

// ObservedServiceSetup includes the one-time plaintext credential returned by
// create and rotate operations.
type ObservedServiceSetup struct {
	ObservedService
	ApiKey string `json:"apiKey"`
}
