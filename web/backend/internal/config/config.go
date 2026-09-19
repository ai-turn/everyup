package config

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration for the application
type Config struct {
	Server    ServerConfig    `json:"server"`
	Database  DatabaseConfig  `json:"database"`
	Services  []ServiceConfig `json:"services"`
	System    SystemConfig    `json:"system"`
	Alerts    AlertsConfig    `json:"alerts"`
	Retention RetentionConfig `json:"retention"`
}

// SystemConfig holds system resource monitoring configuration
type SystemConfig struct {
	Enabled         bool          `json:"enabled"`
	CollectInterval int           `json:"collectInterval"` // seconds
	StoreInterval   int           `json:"storeInterval"`   // seconds
	Logging         LoggingConfig `json:"logging"`
}

// LoggingConfig holds log ingestion configuration
type LoggingConfig struct {
	AllowedLevels []string `json:"allowedLevels"` // e.g. ["error", "warn"]
}

// ServerConfig holds server configuration
type ServerConfig struct {
	PublicURL    string `json:"publicUrl"`
	Host         string `json:"host"`
	Port         int    `json:"port"`
	Mode         string `json:"mode"`
	AllowOrigins string `json:"allowOrigins"` // env: EVERYUP_SERVER_ALLOWORIGINS
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Path string `json:"path"`
}

// ServiceConfig holds service monitoring configuration
type ServiceConfig struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Type           string            `json:"type"` // "http" or "tcp"
	URL            string            `json:"url"`
	Method         string            `json:"method"`
	Host           string            `json:"host"`
	Port           int               `json:"port"`
	Interval       int               `json:"interval"` // seconds
	Timeout        int               `json:"timeout"`  // milliseconds
	ExpectedStatus int               `json:"expectedStatus"`
	Headers        map[string]string `json:"headers"`
	Tags           []string          `json:"tags"`
}

// AlertsConfig holds alerting configuration
type AlertsConfig struct {
	ConsecutiveFailures int `json:"consecutiveFailures"`
	LogAlertCooldown    int `json:"logAlertCooldown"` // minutes, dedup cooldown for log alerts
}

// RetentionConfig holds data retention configuration
type RetentionConfig struct {
	Metrics         string `json:"metrics"`
	Logs            string `json:"logs"`
	SystemMetrics   string `json:"systemMetrics"`
	ApiRequestsDays int    `json:"apiRequestsDays"`
	// SpansDays governs stored traces. BodyCaptureDays only strips captured
	// request/response bodies, so shortening it no longer deletes traces.
	SpansDays       int `json:"spansDays"`
	BodyCaptureDays int `json:"bodyCaptureDays"`
	OtelMetricsDays int `json:"otelMetricsDays"`
}

// Global config instance
var cfg *Config

// configFilePath is the file Load resolved; UpdateSettings persists back to it.
var configFilePath string

// Load loads configuration from file and environment variables.
// Precedence: env (EVERYUP_ prefix) > config file > defaults.
func Load(configPath string) (*Config, error) {
	c := &Config{
		Server: ServerConfig{
			Host: "0.0.0.0",
			Port: 3001,
			Mode: "production",
		},
		Database: DatabaseConfig{
			Path: "./data/monitoring.db",
		},
		Alerts: AlertsConfig{
			ConsecutiveFailures: 3,
			LogAlertCooldown:    5,
		},
		System: SystemConfig{
			Enabled:         true,
			CollectInterval: 5,
			StoreInterval:   60,
			Logging:         LoggingConfig{AllowedLevels: []string{"error", "warn"}},
		},
		Retention: RetentionConfig{
			Metrics:         "7d",
			Logs:            "3d",
			SystemMetrics:   "7d",
			ApiRequestsDays: 14,
			SpansDays:       7,
			BodyCaptureDays: 7,
		},
	}

	// Resolve config file: explicit path must exist; otherwise probe the same
	// locations viper searched ("config.json" in "." and "./config").
	configFilePath = ""
	if configPath != "" {
		configFilePath = configPath
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
		if err := json.Unmarshal(data, c); err != nil {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	} else {
		for _, p := range []string{"config.json", "config/config.json"} {
			data, err := os.ReadFile(p)
			if err != nil {
				continue // not found — keep probing, fall back to defaults
			}
			if err := json.Unmarshal(data, c); err != nil {
				return nil, fmt.Errorf("error reading config file: %w", err)
			}
			configFilePath = p
			break
		}
	}

	// Environment variable overrides (EVERYUP_ prefix, "." → "_")
	envStr("EVERYUP_SERVER_HOST", &c.Server.Host)
	envInt("EVERYUP_SERVER_PORT", &c.Server.Port)
	envStr("EVERYUP_SERVER_MODE", &c.Server.Mode)
	envStr("EVERYUP_SERVER_ALLOWORIGINS", &c.Server.AllowOrigins)
	envStr("EVERYUP_PUBLIC_URL", &c.Server.PublicURL)
	c.Server.PublicURL = strings.TrimRight(strings.TrimSpace(c.Server.PublicURL), "/")
	if c.Server.PublicURL != "" {
		u, err := url.Parse(c.Server.PublicURL)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return nil, fmt.Errorf("EVERYUP_PUBLIC_URL must be an absolute http(s) URL without credentials, query or fragment")
		}
	}
	envStr("EVERYUP_DATABASE_PATH", &c.Database.Path)
	envInt("EVERYUP_ALERTS_CONSECUTIVEFAILURES", &c.Alerts.ConsecutiveFailures)
	envInt("EVERYUP_ALERTS_LOGALERTCOOLDOWN", &c.Alerts.LogAlertCooldown)
	envBool("EVERYUP_SYSTEM_ENABLED", &c.System.Enabled)
	envInt("EVERYUP_SYSTEM_COLLECTINTERVAL", &c.System.CollectInterval)
	envInt("EVERYUP_SYSTEM_STOREINTERVAL", &c.System.StoreInterval)
	if v := os.Getenv("EVERYUP_SYSTEM_LOGGING_ALLOWEDLEVELS"); v != "" {
		c.System.Logging.AllowedLevels = strings.Split(v, ",")
	}
	envStr("EVERYUP_RETENTION_METRICS", &c.Retention.Metrics)
	envStr("EVERYUP_RETENTION_LOGS", &c.Retention.Logs)
	envStr("EVERYUP_RETENTION_SYSTEMMETRICS", &c.Retention.SystemMetrics)
	envInt("EVERYUP_RETENTION_APIREQUESTSDAYS", &c.Retention.ApiRequestsDays)
	envInt("EVERYUP_RETENTION_SPANSDAYS", &c.Retention.SpansDays)
	envInt("EVERYUP_RETENTION_BODYCAPTUREDAYS", &c.Retention.BodyCaptureDays)
	envInt("EVERYUP_RETENTION_OTELMETRICSDAYS", &c.Retention.OtelMetricsDays)

	// Set default values for services
	for i := range c.Services {
		if c.Services[i].Method == "" {
			c.Services[i].Method = "GET"
		}
		if c.Services[i].Interval == 0 {
			c.Services[i].Interval = 30
		}
		if c.Services[i].Timeout == 0 {
			c.Services[i].Timeout = 5000
		}
		if c.Services[i].ExpectedStatus == 0 {
			c.Services[i].ExpectedStatus = 200
		}
	}

	cfg = c
	return cfg, nil
}

func envStr(key string, dst *string) {
	if v := os.Getenv(key); v != "" {
		*dst = v
	}
}

func envInt(key string, dst *int) {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			*dst = n
		}
	}
}

func envBool(key string, dst *bool) {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			*dst = b
		}
	}
}

// Get returns the global config instance
func Get() *Config {
	return cfg
}

// UpdateSettings updates mutable config fields in memory and persists to config.json.
// collectInterval is applied on next process start (collector/evaluator read it once).
func UpdateSettings(consecutiveFailures int, metricsRetention, logsRetention string, collectInterval int) error {
	if cfg == nil {
		return fmt.Errorf("config not initialized")
	}
	cfg.Alerts.ConsecutiveFailures = consecutiveFailures
	cfg.Retention.Metrics = metricsRetention
	cfg.Retention.Logs = logsRetention
	cfg.System.CollectInterval = collectInterval

	if configFilePath == "" {
		return fmt.Errorf("no config file loaded; settings applied in memory only")
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configFilePath, append(data, '\n'), 0644)
}

// GetRetentionDuration parses retention string to duration
func GetRetentionDuration(retention string) time.Duration {
	retention = strings.TrimSpace(strings.ToLower(retention))

	var multiplier time.Duration
	var value int

	if strings.HasSuffix(retention, "d") {
		multiplier = 24 * time.Hour
		fmt.Sscanf(retention, "%dd", &value)
	} else if strings.HasSuffix(retention, "h") {
		multiplier = time.Hour
		fmt.Sscanf(retention, "%dh", &value)
	} else if strings.HasSuffix(retention, "m") {
		multiplier = time.Minute
		fmt.Sscanf(retention, "%dm", &value)
	} else {
		// Default to days
		fmt.Sscanf(retention, "%d", &value)
		multiplier = 24 * time.Hour
	}

	if value <= 0 {
		value = 7 // Default 7 days
	}

	return time.Duration(value) * multiplier
}
