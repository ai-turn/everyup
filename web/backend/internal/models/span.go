package models

import (
	"encoding/json"
	"time"
)

// Span stores an OpenTelemetry span as the source-of-truth trace signal.
// Derived views such as api_requests should be populated from filtered spans,
// not used as the primary span store.
type Span struct {
	ID            int64           `json:"id"`
	ServiceID     string          `json:"serviceId,omitempty"`
	AgentID       string          `json:"agentId,omitempty"`
	ServiceName   string          `json:"serviceName,omitempty"`
	TraceID       string          `json:"traceId"`
	SpanID        string          `json:"spanId"`
	ParentSpanID  string          `json:"parentSpanId,omitempty"`
	Name          string          `json:"name"`
	Kind          string          `json:"kind"`
	StartUnixNano uint64          `json:"startUnixNano"`
	EndUnixNano   uint64          `json:"endUnixNano"`
	DurationMs    int             `json:"durationMs"`
	StatusCode    string          `json:"statusCode,omitempty"`
	StatusMessage string          `json:"statusMessage,omitempty"`
	Attributes    json.RawMessage `json:"attributes,omitempty"`
	Events        json.RawMessage `json:"events,omitempty"`
	Links         json.RawMessage `json:"links,omitempty"`
	Resource      json.RawMessage `json:"resource,omitempty"`
	CreatedAt     time.Time       `json:"createdAt"`
}

// CapturedBodyEventNames are the span events that carry request/response
// bodies. They age out on their own retention window while the span itself
// stays, so a short body window no longer discards trace history.
var CapturedBodyEventNames = map[string]bool{
	"request_body_masked":  true,
	"response_body_masked": true,
}

// TraceSummary is one trace collapsed to a single row for the trace list. The
// representative name/kind/service come from the earliest span, because the
// true root span may belong to an upstream service this deployment does not
// collect — grouping on the earliest span keeps such traces reachable.
type TraceSummary struct {
	TraceID     string    `json:"traceId"`
	Name        string    `json:"name"`
	Kind        string    `json:"kind"`
	ServiceName string    `json:"serviceName,omitempty"`
	StartTime   time.Time `json:"startTime"`
	DurationMs  int       `json:"durationMs"`
	SpanCount   int       `json:"spanCount"`
	ErrorCount  int       `json:"errorCount"`
}

// TraceFilter scopes the trace list. AgentID+ServiceName is the connected-agent
// path; ServiceID is the direct path, mirroring the other telemetry filters.
type TraceFilter struct {
	ServiceID     string
	AgentID       string
	ServiceName   string
	From          time.Time
	To            time.Time
	MinDurationMs int
	ErrorsOnly    bool
	SortBySlowest bool
	Limit         int
}
