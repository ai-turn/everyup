package models

import "time"

// AlertRuleType discriminates resource vs service rules
type AlertRuleType string

const (
	AlertRuleTypeResource AlertRuleType = "resource"
	AlertRuleTypeService  AlertRuleType = "service"
	AlertRuleTypeLog      AlertRuleType = "log"
	AlertRuleTypeSystem   AlertRuleType = "system"
	// AlertRuleTypeRequest rules judge a window of API requests (error rate,
	// latency percentiles) on a timer, not one event at a time.
	AlertRuleTypeRequest AlertRuleType = "request"
)

// AlertMetric is the metric being evaluated
type AlertMetric string

const (
	AlertMetricCPU          AlertMetric = "cpu"
	AlertMetricMemory       AlertMetric = "memory"
	AlertMetricDisk         AlertMetric = "disk"
	AlertMetricStatusChange AlertMetric = "status_change"
	AlertMetricHTTPStatus   AlertMetric = "http_status"   // HTTP status code comparison
	AlertMetricResponseTime AlertMetric = "response_time" // Response time in ms
	AlertMetricLogLevel     AlertMetric = "log_level"
	AlertMetricApiStatus    AlertMetric = "api_status_code" // captured API request status code
	AlertMetricOtelMetric   AlertMetric = "otel_metric"     // OTLP metric value; pairs with MetricName
	AlertMetricErrorRate    AlertMetric = "error_rate"      // % of API requests failing over the last Duration minutes
	AlertMetricLatencyP95   AlertMetric = "latency_p95"     // API request p95 in ms over the last Duration minutes
	AlertMetricLatencyP99   AlertMetric = "latency_p99"     // API request p99 in ms over the last Duration minutes
)

// AlertOperator defines comparison operators
type AlertOperator string

const (
	AlertOperatorGT  AlertOperator = "gt"
	AlertOperatorLT  AlertOperator = "lt"
	AlertOperatorGTE AlertOperator = "gte"
	AlertOperatorLTE AlertOperator = "lte"
	AlertOperatorEQ  AlertOperator = "eq"
)

// AlertSeverity defines alert severity levels
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityInfo     AlertSeverity = "info"
)

// AlertRule represents a threshold-based alerting rule
type AlertRule struct {
	ID         string        `json:"id"`
	Name       string        `json:"name"`
	Type       AlertRuleType `json:"type"`
	AgentID    *string       `json:"agentId"`
	ServiceKey *string       `json:"serviceKey"`
	ServiceID  *string       `json:"serviceId"`
	Metric     AlertMetric   `json:"metric"`
	MetricName string        `json:"metricName,omitempty"` // OTLP metric name when Metric == otel_metric
	Operator   AlertOperator `json:"operator"`
	Threshold  float64       `json:"threshold"`
	Duration   int           `json:"duration"` // minutes of consecutive breach
	Severity   AlertSeverity `json:"severity"`
	IsEnabled  bool          `json:"isEnabled"`
	IsSystem   bool          `json:"isSystem"` // system rules cannot be deleted
	Cooldown   int           `json:"cooldown"` // seconds between re-alerts
	Message    string        `json:"message"`  // optional custom alert message
	CreatedAt  time.Time     `json:"createdAt"`
	UpdatedAt  time.Time     `json:"updatedAt"`

	// Populated by JOIN queries, not stored in alert_rules table
	ChannelIDs      []string   `json:"channelIds,omitempty"`
	LastTriggeredAt *time.Time `json:"lastTriggeredAt,omitempty"`
}

// AlertRuleCreateRequest is the API request to create a rule
type AlertRuleCreateRequest struct {
	Name       string        `json:"name"`
	Type       AlertRuleType `json:"type"`
	AgentID    *string       `json:"agentId"`
	ServiceKey *string       `json:"serviceKey"`
	ServiceID  *string       `json:"serviceId"`
	Metric     AlertMetric   `json:"metric"`
	MetricName string        `json:"metricName"`
	Operator   AlertOperator `json:"operator"`
	Threshold  float64       `json:"threshold"`
	Duration   int           `json:"duration"`
	Severity   AlertSeverity `json:"severity"`
	IsEnabled  *bool         `json:"isEnabled"`
	Cooldown   int           `json:"cooldown"`
	Message    string        `json:"message"`
	ChannelIDs []string      `json:"channelIds"`
}

// ToAlertRule converts request into model with defaults applied
func (r *AlertRuleCreateRequest) ToAlertRule(id string) *AlertRule {
	isEnabled := true
	if r.IsEnabled != nil {
		isEnabled = *r.IsEnabled
	}
	if r.Operator == "" {
		r.Operator = AlertOperatorGT
	}
	if r.Duration <= 0 {
		r.Duration = 1
	}
	if r.Severity == "" {
		r.Severity = AlertSeverityWarning
	}
	if r.Cooldown <= 0 {
		r.Cooldown = 300
	}
	now := time.Now()
	return &AlertRule{
		ID:         id,
		Name:       r.Name,
		Type:       r.Type,
		AgentID:    r.AgentID,
		ServiceKey: r.ServiceKey,
		ServiceID:  r.ServiceID,
		Metric:     r.Metric,
		MetricName: r.MetricName,
		Operator:   r.Operator,
		Threshold:  r.Threshold,
		Duration:   r.Duration,
		Severity:   r.Severity,
		IsEnabled:  isEnabled,
		Cooldown:   r.Cooldown,
		Message:    r.Message,
		ChannelIDs: r.ChannelIDs,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

// AlertRuleUpdateRequest is the API request to update a rule (partial)
type AlertRuleUpdateRequest struct {
	Name       *string        `json:"name"`
	AgentID    *string        `json:"agentId"`
	ServiceKey *string        `json:"serviceKey"`
	ServiceID  *string        `json:"serviceId"`
	Metric     *AlertMetric   `json:"metric"`
	MetricName *string        `json:"metricName"`
	Operator   *AlertOperator `json:"operator"`
	Threshold  *float64       `json:"threshold"`
	Duration   *int           `json:"duration"`
	Severity   *AlertSeverity `json:"severity"`
	IsEnabled  *bool          `json:"isEnabled"`
	Cooldown   *int           `json:"cooldown"`
	Message    *string        `json:"message"`
	ChannelIDs *[]string      `json:"channelIds"`
}
