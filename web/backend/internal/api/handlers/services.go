package handlers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ServiceHandler handles service-related requests
type ServiceHandler struct {
	repo       *database.ServiceRepository
	metricRepo *database.MetricRepository
	scheduler  *checker.Scheduler
}

// NewServiceHandler creates a new service handler
func NewServiceHandler(scheduler *checker.Scheduler) *ServiceHandler {
	return &ServiceHandler{
		repo:       database.NewServiceRepository(),
		metricRepo: database.NewMetricRepository(),
		scheduler:  scheduler,
	}
}

// GetAll returns all services, optionally filtered by ?type=http,tcp
func (h *ServiceHandler) GetAll(c *fiber.Ctx) error {
	var typeFilter []string
	if typeParam := c.Query("type"); typeParam != "" {
		typeFilter = strings.Split(typeParam, ",")
	}

	services, err := h.repo.GetAll(typeFilter...)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	// Fetch sparkline data for all services in one batch query
	sparklines, _ := h.metricRepo.GetRecentResponseTimesBatch(24)
	includeChecks := c.Query("include") == "checks"
	var recentChecks map[string][]models.Metric
	activeIncidents := make(map[string]models.Incident)
	if includeChecks {
		recentChecks, err = h.metricRepo.GetRecentChecksBatch(10)
		if err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
		incidents, err := database.NewIncidentRepository().GetActive()
		if err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
		for _, incident := range incidents {
			if _, exists := activeIncidents[incident.ServiceID]; !exists {
				activeIncidents[incident.ServiceID] = incident
			}
		}
	}

	// Enrich services with their latest check status and uptime/latency.
	for i := range services {
		service := &services[i]
		var checks []models.Metric
		if includeChecks && (service.Type == models.ServiceTypeHTTP || service.Type == models.ServiceTypeTCP) {
			checks = recentChecks[service.ID]
			if checks == nil {
				checks = []models.Metric{}
			}
			service.RecentChecks = &checks
		}
		h.enrichService(service, sparklines[service.ID], checks)
		if service.IsActive && service.Status == models.StatusUnhealthy {
			if incident, exists := activeIncidents[service.ID]; exists {
				episode := uptimeEpisode(database.UptimeIncident{
					ServiceID: service.ID, ServiceName: service.Name,
					Message: incident.Message, StartedAt: incident.StartedAt,
				}, time.Now())
				service.ActiveIncident = &episode
			}
		}
	}

	// Clear hash from response — frontend uses apiKeyMasked instead
	for i := range services {
		services[i].ApiKey = ""
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    services,
	})
}

// GetByID returns a service by ID
func (h *ServiceHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")

	service, err := h.repo.GetByID(id)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	if service == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "SERVICE_NOT_FOUND",
				"message": "Service not found",
			},
		})
	}

	h.enrichService(service, nil, nil)

	// Clear hash from response — frontend uses apiKeyMasked instead
	service.ApiKey = ""

	return c.JSON(fiber.Map{
		"success": true,
		"data":    service,
	})
}

func (h *ServiceHandler) enrichService(service *models.Service, history []int, metrics []models.Metric) {
	service.Status = models.StatusUnknown
	if !service.IsActive || service.Type == models.ServiceTypeLog {
		return
	}
	service.LatencyHistory = history
	if metrics == nil {
		metrics, _ = h.metricRepo.GetByServiceID(service.ID, 1)
	}
	if len(metrics) > 0 {
		service.LastCheckAt = &metrics[0].CheckedAt
		if metrics[0].Status == models.CheckStatusSuccess {
			service.Status = models.StatusHealthy
		} else {
			service.Status = models.StatusUnhealthy
		}
	}
	summary, _ := h.metricRepo.GetSummary(service.ID, 24*time.Hour)
	if summary != nil && summary.TotalChecks > 0 {
		service.Uptime = &summary.Uptime
	}
	if summary != nil && summary.SuccessfulChecks > 0 {
		avg := int(summary.AvgResponseTime)
		service.ResponseTime = &avg
	}
}

// Create adds an independently configured HTTP or TCP uptime monitor and
// immediately registers it with the live checker scheduler.
func (h *ServiceHandler) Create(c *fiber.Ctx) error {
	service, err := h.parseUptimeService(c, "")
	if err != nil {
		return agentBadRequest(c, "VALIDATION_ERROR", err.Error())
	}
	var opts struct {
		AlertOnDown bool `json:"alertOnDown"`
	}
	_ = c.BodyParser(&opts) // the body already parsed above; this only reads the extra flag
	if err := h.repo.Create(service); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if opts.AlertOnDown {
		if err := createMonitorDownRule(service); err != nil {
			_ = h.repo.Delete(service.ID) // keep add-with-alert all or nothing
			return internalError(c, "DATABASE_ERROR", err)
		}
	}
	if h.scheduler != nil {
		h.scheduler.AddService(service)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": service})
}

// createMonitorDownRule adds the health-check rule behind the add dialog's
// "다운되면 알림" box: any failed check (HTTP status >= 400, or a TCP port that
// does not answer) alerts every enabled channel. The consecutive count starts at
// the incident threshold so the rule and the incident agree on "down".
func createMonitorDownRule(service *models.Service) error {
	consecutive := 3
	if cfg := config.Get(); cfg != nil && cfg.Alerts.ConsecutiveFailures > 0 {
		consecutive = cfg.Alerts.ConsecutiveFailures
	}
	now := time.Now()
	serviceID := service.ID
	return database.NewAlertRuleRepository().Create(&models.AlertRule{
		ID:        uuid.NewString(),
		Name:      service.Name + " 다운",
		Type:      models.AlertRuleTypeService,
		ServiceID: &serviceID,
		Metric:    models.AlertMetricHTTPStatus,
		Operator:  models.AlertOperatorGTE,
		Threshold: 400,
		Duration:  consecutive,
		Severity:  models.AlertSeverityCritical,
		IsEnabled: true,
		CreatedAt: now,
		UpdatedAt: now,
	})
}

// Update replaces an independently configured HTTP or TCP uptime monitor and
// refreshes its in-memory schedule.
func (h *ServiceHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	if existing, err := h.repo.GetByID(id); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	} else if existing == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVICE_NOT_FOUND"}})
	}
	service, err := h.parseUptimeService(c, id)
	if err != nil {
		return agentBadRequest(c, "VALIDATION_ERROR", err.Error())
	}
	if err := h.repo.Update(service); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if h.scheduler != nil {
		h.scheduler.AddService(service)
	}
	return c.JSON(fiber.Map{"success": true, "data": service})
}

// Delete removes an independent monitor and cancels its scheduled checks.
func (h *ServiceHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.repo.Delete(id); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "SERVICE_NOT_FOUND"}})
		}
		return internalError(c, "DATABASE_ERROR", err)
	}
	if h.scheduler != nil {
		h.scheduler.RemoveService(id)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ServiceHandler) parseUptimeService(c *fiber.Ctx, id string) (*models.Service, error) {
	var req models.ServiceCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return nil, fmt.Errorf("invalid request body")
	}
	req.ID = id
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if req.Type != models.ServiceTypeHTTP && req.Type != models.ServiceTypeTCP {
		return nil, fmt.Errorf("type must be http or tcp")
	}
	service := req.ToService()
	if service.ID == "" {
		service.ID = uuid.NewString()
	}
	if service.Interval < 5 {
		return nil, fmt.Errorf("interval must be at least 5 seconds")
	}
	if service.Type == models.ServiceTypeHTTP {
		if err := checker.ValidateURLForSSRF(service.URL); err != nil {
			return nil, err
		}
	} else {
		if service.Port < 1 || service.Port > 65535 {
			return nil, fmt.Errorf("port must be between 1 and 65535")
		}
		if err := checker.ValidateHostForSSRF(service.URL); err != nil {
			return nil, err
		}
	}
	return service, nil
}
