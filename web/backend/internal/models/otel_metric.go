package models

import (
	"encoding/json"
	"time"
)

// MetricExemplar is a single measurement a data point kept a trace ID for.
// Exemplars are the standard bridge from an aggregate back to one request:
// without them a p95 names a number but no way to see what was slow.
type MetricExemplar struct {
	TraceID string    `json:"traceId"`
	SpanID  string    `json:"spanId,omitempty"`
	Value   float64   `json:"value"`
	Time    time.Time `json:"time"`
}

// OtelMetric is one OTLP metric data point flattened into a row. Gauges and
// sums carry Value; the histogram family (histogram, exponential histogram,
// summary) carries Count and Total with Value set to the average. Explicit
// bucket histograms additionally keep BucketBounds/BucketCounts so quantiles
// stay recoverable — the average alone hides tail latency.
type OtelMetric struct {
	ID           int64           `json:"id"`
	ServiceID    string          `json:"serviceId,omitempty"`
	AgentID      string          `json:"agentId,omitempty"`
	ServiceName  string          `json:"serviceName,omitempty"`
	MetricName   string          `json:"metricName"`
	MetricType   string          `json:"metricType"`
	Unit         string          `json:"unit,omitempty"`
	Attributes   json.RawMessage `json:"attributes,omitempty"`
	Value        float64         `json:"value"`
	Count        uint64          `json:"count,omitempty"`
	Total        float64         `json:"total,omitempty"`
	TimeUnixNano uint64          `json:"timeUnixNano"`
	CreatedAt    time.Time       `json:"createdAt"`

	// BucketBounds holds the N upper bounds of an explicit histogram and
	// BucketCounts the N+1 per-bucket observation counts (the extra slot is the
	// +Inf overflow). Temporality mirrors OTLP: 1 = delta, 2 = cumulative.
	BucketBounds json.RawMessage `json:"bucketBounds,omitempty"`
	BucketCounts json.RawMessage `json:"bucketCounts,omitempty"`
	Temporality  int             `json:"temporality,omitempty"`
	// Exemplars is a JSON array of MetricExemplar, kept only for points whose
	// exemplars carry a trace ID.
	Exemplars json.RawMessage `json:"exemplars,omitempty"`
}

// OtelHistogramQuantiles is the latency distribution recovered from stored
// explicit histogram buckets over a time window. Count is the number of
// observations the quantiles were computed from.
type OtelHistogramQuantiles struct {
	MetricName string  `json:"metricName"`
	Unit       string  `json:"unit,omitempty"`
	Count      uint64  `json:"count"`
	P50        float64 `json:"p50"`
	P95        float64 `json:"p95"`
	P99        float64 `json:"p99"`
	// Exemplars are tail measurements (at or above p95) that carry a trace ID,
	// slowest first — the jump from "p95 is 350ms" to the request that was.
	Exemplars []MetricExemplar `json:"exemplars,omitempty"`
}

// OtelMetricName describes one metric a service exports, for the picker UI.
type OtelMetricName struct {
	MetricName string    `json:"metricName"`
	MetricType string    `json:"metricType"`
	Unit       string    `json:"unit,omitempty"`
	LastAt     time.Time `json:"lastAt"`
}

// OtelServiceMetric is the latest value of one metric a service exports, used
// to derive each service's representative metric for the project overview cards.
type OtelServiceMetric struct {
	ServiceID   string  `json:"serviceId,omitempty"`
	ServiceName string  `json:"serviceName"`
	MetricName  string  `json:"metricName"`
	MetricType  string  `json:"metricType"`
	Unit        string  `json:"unit,omitempty"`
	Value       float64 `json:"value"`
}

// OtelMetricFilter scopes data point reads. AgentID+ServiceName is the
// connected-agent path; ServiceID is the direct or legacy service path.
type OtelMetricFilter struct {
	ServiceID   string
	AgentID     string
	ServiceName string
	MetricName  string
	From        time.Time
	To          time.Time
	Limit       int
}
