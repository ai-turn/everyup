package models

import "time"

const (
	AgentProfileAllInOne = "all-in-one"
	AgentProfileBasic    = "basic"
	AgentProfileCustom   = "custom"

	AgentCapabilityUptime         = "uptime"
	AgentCapabilityLogs           = "logs"
	AgentCapabilityInfrastructure = "infrastructure"
	AgentCapabilityAPI            = "api"
	AgentCapabilityMetrics        = "metrics"
)

// AgentProfile controls the collection privileges in the generated
// installation bundle. Capabilities is the effective set used on re-install.
type AgentProfile struct {
	Kind         string   `json:"kind"`
	Capabilities []string `json:"capabilities"`
}

func DefaultAgentProfile() AgentProfile {
	return AgentProfile{
		Kind: AgentProfileAllInOne,
		Capabilities: []string{
			AgentCapabilityUptime,
			AgentCapabilityLogs,
			AgentCapabilityInfrastructure,
			AgentCapabilityAPI,
			AgentCapabilityMetrics,
		},
	}
}

func (p AgentProfile) Has(capability string) bool {
	for _, enabled := range p.Capabilities {
		if enabled == capability {
			return true
		}
	}
	return false
}

// AgentServiceFlat joins AgentService with the parent Agent name for list views.
type AgentServiceFlat struct {
	AgentService
	AgentName string `json:"agentName"`
}

// ServiceHistoryPoint is one time-bucketed data point for response-time charts.
type ServiceHistoryPoint struct {
	Time      string  `json:"time"`
	LatencyMs float64 `json:"latencyMs"`
	UptimePct float64 `json:"uptimePct"`
	Total     int     `json:"total"`
}

// ServiceUptimeDay holds daily uptime stats for the 90-day calendar view.
type ServiceUptimeDay struct {
	Date          string  `json:"date"`
	UptimePct     float64 `json:"uptimePct"`
	HealthyChecks int     `json:"healthyChecks"`
	TotalChecks   int     `json:"totalChecks"`
}

// AgentIncident is one unhealthy episode of an agent service, derived from
// consecutive healthy=0 runs in agent_service_history.
type AgentIncident struct {
	// AgentID is set on every episode so a cross-agent timeline can link back to
	// the right service; the per-agent endpoint already knows it from the URL.
	AgentID     string     `json:"agentId,omitempty"`
	Key         string     `json:"key"`
	ServiceName string     `json:"serviceName"`
	StartedAt   time.Time  `json:"startedAt"`
	EndedAt     *time.Time `json:"endedAt,omitempty"` // nil while still unhealthy
	DurationSec int64      `json:"durationSec"`
	Active      bool       `json:"active"`
}

// AgentOverview is the per-project KPI rollup for the home project cards —
// one row per agent so the list renders without N+1 fetches.
type AgentOverview struct {
	AgentID         string   `json:"agentId"`
	UptimePct       *float64 `json:"uptimePct"` // 30d weighted, nil when no checks yet
	ActiveIncidents int      `json:"activeIncidents"`
	Requests24h     int      `json:"requests24h"`
	P95Ms           *int     `json:"p95Ms"` // latest timed bucket, nil when no latency data
}

type Agent struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	ProjectID    string            `json:"projectId,omitempty"`
	Version      string            `json:"version,omitempty"`
	Status       string            `json:"status"`
	LastSeenAt   time.Time         `json:"lastSeenAt"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
	Profile      AgentProfile      `json:"profile"`
	Capabilities *CapabilityReport `json:"capabilities,omitempty"`
}

type CapabilityStatus struct {
	State  string `json:"state"`
	Reason string `json:"reason,omitempty"`
	Detail string `json:"detail,omitempty"`
}

type HostCompatibility struct {
	OS            string `json:"os,omitempty"`
	Arch          string `json:"arch,omitempty"`
	KernelVersion string `json:"kernelVersion,omitempty"`
	BTF           bool   `json:"btf"`
	Lockdown      string `json:"lockdown,omitempty"`
}

type CapabilityReport struct {
	CheckedAt           time.Time         `json:"checkedAt"`
	Host                HostCompatibility `json:"host"`
	ContainerMonitoring CapabilityStatus  `json:"containerMonitoring"`
	HostMetrics         CapabilityStatus  `json:"hostMetrics"`
	AutomaticTracing    CapabilityStatus  `json:"automaticTracing"`
	ContextPropagation  CapabilityStatus  `json:"contextPropagation"`
}

type AgentService struct {
	AgentID      string    `json:"agentId"`
	Key          string    `json:"key"`
	Name         string    `json:"name"`
	CheckType    string    `json:"checkType"`
	Endpoint     string    `json:"endpoint"`
	Runtime      string    `json:"runtime,omitempty"`      // agent-detected language runtime ("java", "node", ...)
	Image        string    `json:"image,omitempty"`        // container image ref incl tag
	RestartCount int       `json:"restartCount,omitempty"` // docker container restart count
	StartedAt    time.Time `json:"startedAt,omitempty"`    // container start time; UI derives uptime
	Healthy      bool      `json:"healthy"`
	Seen         bool      `json:"seen"`
	Silenced     bool      `json:"silenced"`
	LastError    string    `json:"lastError,omitempty"`
	LastStatus   int       `json:"lastStatus,omitempty"`
	LastLatency  string    `json:"lastLatency,omitempty"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
	ObservedAt   time.Time `json:"observedAt"`
}

type AgentEvent struct {
	ID          int64                  `json:"id"`
	AgentID     string                 `json:"agentId"`
	Time        time.Time              `json:"time"`
	Type        string                 `json:"type"`
	ServiceName string                 `json:"serviceName,omitempty"`
	TargetKey   string                 `json:"targetKey,omitempty"`
	Message     string                 `json:"message,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"createdAt"`
}
