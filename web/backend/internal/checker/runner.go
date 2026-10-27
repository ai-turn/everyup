package checker

import (
	"log"

	"github.com/aiturn/everyup/internal/models"
)

// checkService performs a health check for a service and orchestrates the result:
// saves the metric, evaluates alert rules, updates incident state, and broadcasts.
func (s *Scheduler) checkService(svc *models.Service) {
	// Re-fetch from DB to ensure we have latest IsActive status
	service, err := s.serviceRepo.GetByID(svc.ID)
	if err != nil {
		log.Printf("Failed to get service %s: %v", svc.ID, err)
		return
	}
	if service == nil || !service.IsActive {
		return
	}

	var result *CheckResult

	switch service.Type {
	case models.ServiceTypeHTTP:
		result = s.httpChecker.Check(service.GetHTTPConfig())
	case models.ServiceTypeTCP:
		result = s.tcpChecker.Check(service.GetTCPConfig())
	case models.ServiceTypeLog:
		// Log services receive data via ingest API — no polling needed
		return
	default:
		log.Printf("Unknown service type: %s", service.Type)
		return
	}

	// Save metric
	metric := result.ToMetric(service.ID)
	if err := s.metricRepo.Create(metric); err != nil {
		log.Printf("Failed to save metric for %s: %v", service.ID, err)
	}

	// The service was just re-read from the DB, so this writes only on change.
	if result.CertExpiresAt != nil && (service.CertExpiresAt == nil || !service.CertExpiresAt.Equal(*result.CertExpiresAt)) {
		if err := s.serviceRepo.SetCertExpiry(service.ID, *result.CertExpiresAt); err != nil {
			log.Printf("Failed to save certificate expiry for %s: %v", service.ID, err)
		}
	}

	// Evaluate endpoint alert rules
	if s.serviceEvaluator != nil {
		s.serviceEvaluator.Evaluate(service.ID, service.Name, result.StatusCode, result.ResponseTime)
	}

	// Determine status for incident handling and broadcast
	var status models.ServiceStatus
	if result.Status == models.CheckStatusSuccess {
		status = models.StatusHealthy
		s.handleRecovery(service.ID)
	} else {
		status = models.StatusUnhealthy
		s.handleFailure(service.ID, result.ErrorMessage)
	}

	// Broadcast update
	if s.broadcast != nil {
		s.broadcast(map[string]interface{}{
			"type": "metric",
			"data": map[string]interface{}{
				"serviceId":    service.ID,
				"status":       string(status),
				"responseTime": result.ResponseTime,
				"checkedAt":    result.CheckedAt,
			},
		})
	}
}

