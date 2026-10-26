package handlers

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/checker"
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

	// Enrich services with their latest check status and uptime/latency.
	for i := range services {
		h.enrichService(&services[i], sparklines[services[i].ID])
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

	h.enrichService(service, nil)

	// Clear hash from response — frontend uses apiKeyMasked instead
	service.ApiKey = ""

	return c.JSON(fiber.Map{
		"success": true,
		"data":    service,
	})
}

func (h *ServiceHandler) enrichService(service *models.Service, history []int) {
	service.Status = models.StatusUnknown
	if !service.IsActive || service.Type == models.ServiceTypeLog {
		return
	}
	service.LatencyHistory = history
	metrics, _ := h.metricRepo.GetByServiceID(service.ID, 1)
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
	if err := h.repo.Create(service); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if h.scheduler != nil {
		h.scheduler.AddService(service)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": service})
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
