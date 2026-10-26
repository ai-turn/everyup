package models

import (
	"strings"
	"time"
)

// ServiceType represents the type of service check
type ServiceType string

const (
	ServiceTypeHTTP ServiceType = "http"
	ServiceTypeTCP  ServiceType = "tcp"
	ServiceTypeICMP ServiceType = "icmp"
	ServiceTypeLog  ServiceType = "log"
)

// ServiceStatus represents the current status of a service
type ServiceStatus string

const (
	StatusHealthy   ServiceStatus = "healthy"
	StatusUnhealthy ServiceStatus = "unhealthy"
	StatusDegraded  ServiceStatus = "degraded"
	StatusUnknown   ServiceStatus = "unknown"
)

// ScheduleType represents the type of schedule
type ScheduleType string

const (
	ScheduleTypeInterval ScheduleType = "interval"
	ScheduleTypeCron     ScheduleType = "cron"
)

// Service represents a monitored service
type Service struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	ProjectID      string            `json:"projectId,omitempty"`
	Type           ServiceType       `json:"type"`
	IsActive       bool              `json:"isActive"`
	URL            string            `json:"url,omitempty"`
	Port           int               `json:"port,omitempty"`
	Method         string            `json:"method,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	Body           string            `json:"body,omitempty"`
	ExpectedStatus int               `json:"expectedStatus,omitempty"`
	Interval       int               `json:"interval"`
	Timeout        int               `json:"timeout"`
	Tags           []string          `json:"tags,omitempty"`
	CreatedAt      time.Time         `json:"createdAt"`
	UpdatedAt      time.Time         `json:"updatedAt"`

	// Schedule configuration
	ScheduleType   ScheduleType `json:"scheduleType"`             // "interval" or "cron"
	CronExpression string       `json:"cronExpression,omitempty"` // For cron type

	// API Key for log ingestion
	ApiKey       string `json:"apiKey,omitempty"`       // hash stored in DB; plaintext only in create/regenerate response
	ApiKeyMasked string `json:"apiKeyMasked,omitempty"` // masked version stored in DB for display

	// Log level filter (log-type services only). nil/empty = accept all levels.
	LogLevelFilter []LogLevel `json:"logLevelFilter,omitempty"`

	// API request path exclusions. Spans whose path matches any entry are
	// dropped at OTLP ingest time. Supports exact (/health) and prefix
	// wildcard (/actuator/*) matching.
	ApiExcludePaths []string `json:"apiExcludePaths,omitempty"`

	// Computed fields (not stored in DB, populated from metrics)
	Status         ServiceStatus `json:"status,omitempty"`
	LastCheckAt    *time.Time    `json:"lastCheckAt,omitempty"`
	Uptime         *float64      `json:"uptime,omitempty"`         // nil = no check in the window; 0 = every check failed
	ResponseTime   *int          `json:"responseTime,omitempty"`   // nil = no successful check in the window
	LatencyHistory []int         `json:"latencyHistory,omitempty"` // recent response times oldest→newest
}

// HTTPConfig holds HTTP check configuration
type HTTPConfig struct {
	URL            string            `json:"url"`
	Method         string            `json:"method"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExpectedStatus int               `json:"expectedStatus"`
	Timeout        int               `json:"timeout"`
	Interval       int               `json:"interval"`
}

// TCPConfig holds TCP check configuration
type TCPConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Timeout  int    `json:"timeout"`
	Interval int    `json:"interval"`
}

// ServiceCreateRequest represents a request to create a service
type ServiceCreateRequest struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Type           ServiceType       `json:"type"`
	IsActive       *bool             `json:"isActive,omitempty"`
	URL            string            `json:"url,omitempty"`
	Method         string            `json:"method,omitempty"`
	Host           string            `json:"host,omitempty"`
	Port           int               `json:"port,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	Body           string            `json:"body,omitempty"`
	ExpectedStatus int               `json:"expectedStatus,omitempty"`
	Timeout        int               `json:"timeout,omitempty"`
	Interval       int               `json:"interval,omitempty"`
	Tags           []string          `json:"tags,omitempty"`
	ScheduleType   string            `json:"scheduleType,omitempty"`
	CronExpression string            `json:"cronExpression,omitempty"`
	// Log level filter (log-type services only). nil = don't update; []string{} = accept all; ["error"] = only error.
	LogLevelFilter []string `json:"logLevelFilter,omitempty"`
	// API request path exclusions. nil = don't update; []string{} = clear list.
	ApiExcludePaths []string `json:"apiExcludePaths,omitempty"`
}

// ToService converts request to Service model
func (r *ServiceCreateRequest) ToService() *Service {
	// Set defaults
	isActive := true
	if r.IsActive != nil {
		isActive = *r.IsActive
	}

	method := r.Method
	if method == "" {
		method = "GET"
	}

	expectedStatus := r.ExpectedStatus
	if expectedStatus == 0 {
		expectedStatus = 200
	}

	timeout := r.Timeout
	if timeout == 0 {
		if r.Type == ServiceTypeTCP {
			timeout = 3000
		} else {
			timeout = 5000
		}
	}

	interval := r.Interval
	if interval == 0 {
		if r.Type == ServiceTypeTCP {
			interval = 60
		} else {
			interval = 30
		}
	}

	// Schedule type defaults to "interval"
	scheduleType := ScheduleType(r.ScheduleType)
	if scheduleType == "" {
		scheduleType = ScheduleTypeInterval
	}

	// For TCP, use Host as URL if URL is not provided
	url := r.URL
	if r.Type == ServiceTypeTCP && url == "" && r.Host != "" {
		url = r.Host
	}

	// Convert string log level filter to LogLevel slice.
	// For new log-type services, default to [error, warn, info] when caller did
	// not specify a filter — keeps DEBUG/TRACE opt-in so existing log volume
	// patterns don't suddenly flood after the level expansion.
	var logLevelFilter []LogLevel
	if len(r.LogLevelFilter) > 0 {
		for _, l := range r.LogLevelFilter {
			logLevelFilter = append(logLevelFilter, LogLevel(strings.ToLower(l)))
		}
	} else if r.Type == ServiceTypeLog {
		logLevelFilter = []LogLevel{LogLevelError, LogLevelWarn, LogLevelInfo}
	}

	now := time.Now()
	return &Service{
		ID:              r.ID,
		Name:            r.Name,
		Type:            r.Type,
		IsActive:        isActive,
		URL:             url,
		Port:            r.Port,
		Method:          method,
		Headers:         r.Headers,
		Body:            r.Body,
		ExpectedStatus:  expectedStatus,
		Timeout:         timeout,
		Interval:        interval,
		Tags:            r.Tags,
		ScheduleType:    scheduleType,
		CronExpression:  r.CronExpression,
		LogLevelFilter:  logLevelFilter,
		ApiExcludePaths: r.ApiExcludePaths,
		CreatedAt:       now,
		UpdatedAt:       now,
		Status:          StatusUnknown,
	}
}

// GetHTTPConfig returns HTTP configuration from Service fields
func (s *Service) GetHTTPConfig() *HTTPConfig {
	return &HTTPConfig{
		URL:            s.URL,
		Method:         s.Method,
		Headers:        s.Headers,
		ExpectedStatus: s.ExpectedStatus,
		Timeout:        s.Timeout,
		Interval:       s.Interval,
	}
}

// GetTCPConfig returns TCP configuration from Service fields
func (s *Service) GetTCPConfig() *TCPConfig {
	return &TCPConfig{
		Host:     s.URL,
		Port:     s.Port,
		Timeout:  s.Timeout,
		Interval: s.Interval,
	}
}
