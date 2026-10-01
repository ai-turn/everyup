package models

import (
	"time"
)

// ApiRequest represents an HTTP request projected from an OTel SERVER span.
// Direct ingest paths were removed; do not write to this table outside the
// OTLP traces handler.
type ApiRequest struct {
	ID           int64     `json:"id"`
	ServiceID    string    `json:"serviceId"`
	AgentID      string    `json:"agentId,omitempty"`
	ServiceName  string    `json:"serviceName,omitempty"`
	RequestID    string    `json:"requestId"`
	TraceID      string    `json:"traceId,omitempty"`
	SpanID       string    `json:"spanId,omitempty"`
	Method       string    `json:"method"`
	Path         string    `json:"path"`
	PathTemplate string    `json:"pathTemplate"`
	Route        string    `json:"route,omitempty"`
	StatusCode   int       `json:"statusCode"`
	DurationMs   int       `json:"durationMs"`
	ClientIP     string    `json:"clientIp,omitempty"`
	Error        string    `json:"error,omitempty"`
	IsError      bool      `json:"isError"`
	CreatedAt    time.Time `json:"createdAt"`
}

// ApiRequestStatBucket is one time bucket of request aggregates for the trends
// chart. Percentiles are computed only over requests with a known duration
// (durationMs > 0); access-log synthetic rows have no duration and are counted
// for volume/errors but excluded from latency.
type ApiRequestStatBucket struct {
	Time       time.Time `json:"time"`
	Count      int       `json:"count"`
	ErrorCount int       `json:"errorCount"`
	P50        int       `json:"p50"`
	P95        int       `json:"p95"`
	P99        int       `json:"p99"`
	Timed     int       `json:"timed"` // requests contributing to percentiles
}

// ApiRequestStatusSummary aggregates status-code classes over a window plus
// the most frequent 5xx endpoint (empty fields when the window has no 5xx).
type ApiRequestStatusSummary struct {
	Count2xx     int    `json:"count2xx"`
	Count3xx     int    `json:"count3xx"`
	Count4xx     int    `json:"count4xx"`
	Count5xx     int    `json:"count5xx"`
	CountOther   int    `json:"countOther"` // 1xx / unknown status
	Top5xxMethod string `json:"top5xxMethod,omitempty"`
	Top5xxPath   string `json:"top5xxPath,omitempty"`
	Top5xxCount  int    `json:"top5xxCount,omitempty"`
}

// ApiRequestFilter holds query parameters for listing captured requests.
type ApiRequestFilter struct {
	ServiceID   string
	AgentID     string
	ServiceName string
	TraceID     string
	MinStatus  int
	MaxStatus  int
	Methods    []string
	PathPrefix string
	Search     string
	ErrorsOnly bool
	From       time.Time
	To         time.Time
	Limit      int
	Offset     int
}
