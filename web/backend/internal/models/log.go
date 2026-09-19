package models

import (
	"encoding/json"
	"time"
)

// LogLevel represents the severity level of a log entry
type LogLevel string

const (
	LogLevelError LogLevel = "error"
	LogLevelWarn  LogLevel = "warn"
	LogLevelInfo  LogLevel = "info"
	LogLevelDebug LogLevel = "debug"
	LogLevelTrace LogLevel = "trace"
)

// LogSource represents where the log originated from.
// Only internal (server-generated) and otlp (OTLP ingest) are produced today;
// older rows may still carry "external" or "agent" until they age out.
const (
	LogSourceInternal = "internal"
	LogSourceOTLP     = "otlp"
)

// LinkedRequest is a minimal projection of an api_request that shares the
// trace_id+service_id of a Log row, attached for at-a-glance correlation in
// log tables. Populated by LogRepository.GetAll via a batched lookup.
type LinkedRequest struct {
	ID         int64  `json:"id"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	StatusCode int    `json:"statusCode"`
	IsError    bool   `json:"isError"`
}

// Log represents a log entry
type Log struct {
	ID             int64           `json:"id"`
	ServiceID      string          `json:"serviceId,omitempty"`
	AgentID        string          `json:"agentId,omitempty"`
	ServiceName    string          `json:"serviceName,omitempty"`
	Level          LogLevel        `json:"level"`
	SeverityNumber int             `json:"severityNumber,omitempty"`
	Message        string          `json:"message"`
	Metadata       json.RawMessage `json:"metadata,omitempty"`
	Resource       json.RawMessage `json:"resource,omitempty"`
	Attributes     json.RawMessage `json:"attributes,omitempty"`
	TraceID        string          `json:"traceId,omitempty"`
	SpanID         string          `json:"spanId,omitempty"`
	Source         string          `json:"source"`
	Fingerprint    string          `json:"fingerprint,omitempty"`
	ObservedAt     *time.Time      `json:"observedAt,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
	LinkedRequest  *LinkedRequest  `json:"linkedRequest,omitempty"`
}

// LogCreateRequest represents a request to create a log entry
type LogCreateRequest struct {
	ServiceID string                 `json:"serviceId,omitempty"`
	Level     LogLevel               `json:"level"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// LogIngestEntry represents a single log entry projected from OTLP.
type LogIngestEntry struct {
	Level    LogLevel               `json:"level"`
	Message  string                 `json:"message"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// LogHistogramBucket is one time bucket of per-level log counts for the
// volume histogram on the service logs tab.
type LogHistogramBucket struct {
	Time  time.Time `json:"time"`
	Error int       `json:"error"`
	Warn  int       `json:"warn"`
	Info  int       `json:"info"`
	Debug int       `json:"debug"`
	Trace int       `json:"trace"`
}

// LogFilter represents filter options for log queries
type LogFilter struct {
	ServiceID   string   `json:"serviceId,omitempty"`
	AgentID     string   `json:"agentId,omitempty"`
	ServiceName string   `json:"serviceName,omitempty"`
	Level       LogLevel `json:"level,omitempty"`
	Search      string   `json:"search,omitempty"`
	TraceID     string   `json:"traceId,omitempty"`
	// AttrKey/AttrValue match one structured attribute exactly, e.g.
	// http.route=/orders. Search stays a message substring — attributes are
	// stored as key/value so they can be filtered on rather than grepped.
	AttrKey   string    `json:"attrKey,omitempty"`
	AttrValue string    `json:"attrValue,omitempty"`
	From      time.Time `json:"from,omitempty"`
	To        time.Time `json:"to,omitempty"`
	Limit     int       `json:"limit,omitempty"`
	Offset    int       `json:"offset,omitempty"`
}
