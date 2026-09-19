package checker

import (
	"fmt"
	"log"
	"time"

	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// handleFailure increments the failure counter and creates an incident + log entry
// once the consecutive-failure threshold is reached.
func (s *Scheduler) handleFailure(serviceID, errorMessage string) {
	s.mu.Lock()
	s.failureCounts[serviceID]++
	count := s.failureCounts[serviceID]
	s.mu.Unlock()

	cfg := config.Get()
	threshold := 3
	if cfg != nil && cfg.Alerts.ConsecutiveFailures > 0 {
		threshold = cfg.Alerts.ConsecutiveFailures
	}

	// Create incident after consecutive failures
	if count == threshold {
		incident := &models.Incident{
			ServiceID: serviceID,
			Type:      models.IncidentTypeDown,
			Message:   errorMessage,
			StartedAt: time.Now(),
		}
		if err := s.incidentRepo.Create(incident); err != nil {
			log.Printf("Failed to create incident for %s: %v", serviceID, err)
		}

		// Log error
		logEntry := &models.Log{
			ServiceID: serviceID,
			Level:     models.LogLevelError,
			Message:   fmt.Sprintf("Service down: %s", errorMessage),
			CreatedAt: time.Now(),
		}
		s.logRepo.Create(logEntry)

		// Broadcast incident
		if s.broadcast != nil {
			s.broadcast(map[string]interface{}{
				"type": "incident",
				"data": incident,
			})
		}

		log.Printf("Incident created for service %s: %s", serviceID, errorMessage)
	}
}

// handleRecovery resets the failure counter and resolves any open incident.
func (s *Scheduler) handleRecovery(serviceID string) {
	s.mu.Lock()
	previousCount := s.failureCounts[serviceID]
	s.failureCounts[serviceID] = 0
	s.mu.Unlock()

	cfg := config.Get()
	threshold := 3
	if cfg != nil && cfg.Alerts.ConsecutiveFailures > 0 {
		threshold = cfg.Alerts.ConsecutiveFailures
	}

	// Resolve incident if there was one
	if previousCount >= threshold {
		if err := s.incidentRepo.Resolve(serviceID); err != nil {
			log.Printf("Failed to resolve incident for %s: %v", serviceID, err)
		}

		// Log recovery
		logEntry := &models.Log{
			ServiceID: serviceID,
			Level:     models.LogLevelInfo,
			Message:   "Service recovered",
			CreatedAt: time.Now(),
		}
		s.logRepo.Create(logEntry)

		log.Printf("Service %s recovered", serviceID)
	}
}

// cleanup removes old metrics, logs, system metrics, and api_requests based on retention settings.
// Runs daily at midnight via the cron scheduler.
func (s *Scheduler) cleanup() {
	cfg := config.Get()
	if cfg == nil {
		return
	}

	// Delete old metrics
	metricRetention := config.GetRetentionDuration(cfg.Retention.Metrics)
	if deleted, err := s.metricRepo.DeleteOld(metricRetention); err == nil {
		log.Printf("Cleaned up %d old metrics", deleted)
	}

	// Delete old logs
	logRetention := config.GetRetentionDuration(cfg.Retention.Logs)
	if deleted, err := s.logRepo.DeleteOld(logRetention); err == nil {
		log.Printf("Cleaned up %d old logs", deleted)
	}

	// Delete old system metrics
	if cfg.Retention.SystemMetrics != "" {
		sysRetention := config.GetRetentionDuration(cfg.Retention.SystemMetrics)
		sysRepo := database.NewSystemMetricRepository()
		if deleted, err := sysRepo.DeleteOld(sysRetention); err == nil {
			log.Printf("Cleaned up %d old system metrics", deleted)
		}
	}

	// Delete old api_requests (default: 14 days)
	days := cfg.Retention.ApiRequestsDays
	if days <= 0 {
		days = 14
	}
	cutoff := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
	apiRepo := database.NewApiRequestRepository()
	if deleted, err := apiRepo.DeleteOlderThan(cutoff); err == nil {
		log.Printf("Cleaned up %d old api_requests (cutoff: %d days)", deleted, days)
	} else {
		log.Printf("Failed to clean up api_requests: %v", err)
	}

	// Spans and the bodies captured inside them age out separately: a short
	// body window should not cost trace history (default: 7 days each).
	spanRepo := database.NewSpanRepository()
	spanDays := cfg.Retention.SpansDays
	if spanDays <= 0 {
		spanDays = 7
	}
	spanCutoff := time.Now().Add(-time.Duration(spanDays) * 24 * time.Hour)
	if deleted, err := spanRepo.DeleteOlderThan(spanCutoff); err == nil {
		log.Printf("Cleaned up %d old spans (cutoff: %d days)", deleted, spanDays)
	} else {
		log.Printf("Failed to clean up spans: %v", err)
	}

	bodyDays := cfg.Retention.BodyCaptureDays
	if bodyDays <= 0 {
		bodyDays = 7
	}
	bodyCutoff := time.Now().Add(-time.Duration(bodyDays) * 24 * time.Hour)
	if stripped, err := spanRepo.StripBodyCaptures(bodyCutoff); err == nil {
		log.Printf("Stripped captured bodies from %d spans (cutoff: %d days)", stripped, bodyDays)
	} else {
		log.Printf("Failed to strip captured bodies: %v", err)
	}

	// Delete old audit events (shares the body-capture retention window).
	auditRepo := database.NewAuditRepository()
	if deleted, err := auditRepo.DeleteOlderThan(bodyCutoff); err == nil {
		log.Printf("Cleaned up %d old audit events (cutoff: %d days)", deleted, bodyDays)
	} else {
		log.Printf("Failed to clean up audit events: %v", err)
	}

	// Delete old OTLP metric points (default: 7 days — raw points, high volume).
	otelMetricDays := cfg.Retention.OtelMetricsDays
	if otelMetricDays <= 0 {
		otelMetricDays = 7
	}
	otelMetricCutoff := time.Now().Add(-time.Duration(otelMetricDays) * 24 * time.Hour)
	otelMetricRepo := database.NewOtelMetricRepository()
	if deleted, err := otelMetricRepo.DeleteOlderThan(otelMetricCutoff); err == nil {
		log.Printf("Cleaned up %d old otel metrics (cutoff: %d days)", deleted, otelMetricDays)
	} else {
		log.Printf("Failed to clean up otel metrics: %v", err)
	}
}
