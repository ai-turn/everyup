package models

import "time"

// IncidentType represents the type of incident
type IncidentType string

const (
	IncidentTypeDown      IncidentType = "down"
	IncidentTypeDegraded  IncidentType = "degraded"
	IncidentTypeRecovered IncidentType = "recovered"
)

// IncidentSource says which subsystem produced a timeline episode. The two
// carry different guarantees: uptime episodes are recorded by the checker with
// an explicit start/end, Docker episodes are derived from health samples, so
// their edges are only as precise as the sampling interval.
type IncidentSource string

const (
	IncidentSourceUptime IncidentSource = "uptime"
	IncidentSourceDocker IncidentSource = "docker"
)

// TimelineIncident is one outage episode in the cross-target timeline.
//
// Direct-connection services are absent by construction: they keep only a
// `last_seen_at` column and no history table, so there is nothing to derive an
// episode from. Callers must label the timeline's scope rather than implying it
// covers every monitored target.
type TimelineIncident struct {
	Source      IncidentSource `json:"source"`
	TargetName  string         `json:"targetName"`
	// TargetPath is the frontend route for the target, so the client does not
	// have to branch on Source to build a link.
	TargetPath  string     `json:"targetPath"`
	StartedAt   time.Time  `json:"startedAt"`
	EndedAt     *time.Time `json:"endedAt,omitempty"` // nil while still down
	DurationSec int64      `json:"durationSec"`
	Active      bool       `json:"active"`
	Message     string     `json:"message,omitempty"` // uptime episodes only
}

// Incident represents a service incident
type Incident struct {
	ID         int64        `json:"id"`
	ServiceID  string       `json:"serviceId"`
	Type       IncidentType `json:"type"`
	Message    string       `json:"message,omitempty"`
	StartedAt  time.Time    `json:"startedAt"`
	ResolvedAt *time.Time   `json:"resolvedAt,omitempty"`
}

// TimelineEvent represents an event in the incident timeline
type TimelineEvent struct {
	ID        int64     `json:"id"`
	Time      time.Time `json:"time"`
	Type      string    `json:"type"` // "error", "warning", "info", "success"
	Service   string    `json:"service"`
	Message   string    `json:"message"`
	ServiceID string    `json:"serviceId,omitempty"`
}
