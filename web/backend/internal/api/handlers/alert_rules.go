package handlers

import (
	"errors"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/directtelemetry"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// AlertRuleHandler handles alert rule CRUD operations
type AlertRuleHandler struct {
	repo          *database.AlertRuleRepository
	directManager *directtelemetry.Manager
}

// NewAlertRuleHandler creates a new alert rule handler
func NewAlertRuleHandler() *AlertRuleHandler {
	return &AlertRuleHandler{
		repo:          database.NewAlertRuleRepository(),
		directManager: directtelemetry.NewManager(),
	}
}

func alertMetricSignal(metric models.AlertMetric) models.TelemetrySignal {
	switch metric {
	case models.AlertMetricLogLevel:
		return models.TelemetrySignalLogs
	case models.AlertMetricApiStatus, models.AlertMetricErrorRate, models.AlertMetricLatencyP95, models.AlertMetricLatencyP99:
		return models.TelemetrySignalTraces
	case models.AlertMetricOtelMetric:
		return models.TelemetrySignalMetrics
	default:
		return ""
	}
}

func (h *AlertRuleHandler) validateDirectTarget(serviceID *string, metric models.AlertMetric) error {
	if serviceID == nil || *serviceID == "" {
		return nil
	}
	signal := alertMetricSignal(metric)
	if signal == "" {
		return directtelemetry.ErrSignalDenied
	}
	_, err := h.directManager.RequireSignal(*serviceID, signal)
	return err
}

// validateRequestRule keeps windowed request metrics and the request rule type
// together, and scoped: a window over every service's requests at once would
// let one noisy service hide another.
func validateRequestRule(ruleType models.AlertRuleType, metric models.AlertMetric, serviceID, agentID *string) string {
	windowed := metric == models.AlertMetricErrorRate || metric == models.AlertMetricLatencyP95 || metric == models.AlertMetricLatencyP99
	if windowed != (ruleType == models.AlertRuleTypeRequest) {
		return "error_rate and latency metrics require the request rule type"
	}
	if windowed && !hasAlertTarget(serviceID) && !hasAlertTarget(agentID) {
		return "request rules need a target service or Docker environment"
	}
	return ""
}

func hasAlertTarget(value *string) bool {
	return value != nil && *value != ""
}

func directAlertTargetError(c *fiber.Ctx, err error) error {
	if errors.Is(err, directtelemetry.ErrNotFound) {
		return agentBadRequest(c, ErrCodeObservedServiceNotFound, "observed service not found")
	}
	if errors.Is(err, directtelemetry.ErrSignalDenied) {
		return agentBadRequest(c, ErrCodeValidation, "alert metric is not enabled for this observed service")
	}
	return internalError(c, ErrCodeDatabase, err)
}

// GetAll returns all alert rules
func (h *AlertRuleHandler) GetAll(c *fiber.Ctx) error {
	rules, err := h.repo.GetAll()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rules",
			},
		})
	}
	if rules == nil {
		rules = []models.AlertRule{}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    rules,
	})
}

// GetByID returns a single alert rule
func (h *AlertRuleHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")

	rule, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rule",
			},
		})
	}
	if rule == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Alert rule not found",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    rule,
	})
}

// Create creates a new alert rule
func (h *AlertRuleHandler) Create(c *fiber.Ctx) error {
	var req models.AlertRuleCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}

	// Validate field lengths
	if len(req.Name) > 200 || len(req.Message) > 1000 {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "name (max 200) or message (max 1000) exceeds maximum length",
			},
		})
	}

	// Validate required fields
	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "name is required",
			},
		})
	}
	if req.Type == "" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "type is required",
			},
		})
	}
	if req.Metric == "" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "metric is required",
			},
		})
	}
	if req.Metric == models.AlertMetricOtelMetric && req.MetricName == "" {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": "metricName is required for otel_metric rules",
			},
		})
	}
	if hasAlertTarget(req.ServiceID) && (hasAlertTarget(req.AgentID) || hasAlertTarget(req.ServiceKey)) {
		return agentBadRequest(c, ErrCodeValidation, "select either a direct service or a Docker environment target")
	}
	if err := validateRequestRule(req.Type, req.Metric, req.ServiceID, req.AgentID); err != "" {
		return agentBadRequest(c, ErrCodeValidation, err)
	}
	if err := h.validateDirectTarget(req.ServiceID, req.Metric); err != nil {
		return directAlertTargetError(c, err)
	}

	rule := req.ToAlertRule(uuid.New().String())

	if err := h.repo.Create(rule); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "CREATE_ERROR",
				"message": "Failed to create alert rule",
			},
		})
	}

	// Re-fetch to include channel IDs
	created, _ := h.repo.GetByID(rule.ID)
	if created == nil {
		created = rule
	}

	return c.Status(201).JSON(fiber.Map{
		"success": true,
		"data":    created,
	})
}

// Update updates an existing alert rule
func (h *AlertRuleHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")

	existing, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rule",
			},
		})
	}
	if existing == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Alert rule not found",
			},
		})
	}

	var req models.AlertRuleUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}
	if hasAlertTarget(req.ServiceID) && (hasAlertTarget(req.AgentID) || hasAlertTarget(req.ServiceKey)) {
		return agentBadRequest(c, ErrCodeValidation, "select either a direct service or a Docker environment target")
	}
	metric := existing.Metric
	if req.Metric != nil {
		metric = *req.Metric
	}
	serviceID, agentID := existing.ServiceID, existing.AgentID
	if req.ServiceID != nil {
		serviceID = req.ServiceID
	}
	if req.AgentID != nil {
		agentID = req.AgentID
	}
	if err := validateRequestRule(existing.Type, metric, serviceID, agentID); err != "" {
		return agentBadRequest(c, ErrCodeValidation, err)
	}
	if err := h.validateDirectTarget(req.ServiceID, metric); err != nil {
		return directAlertTargetError(c, err)
	}

	if err := h.repo.Update(id, &req); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UPDATE_ERROR",
				"message": "Failed to update alert rule",
			},
		})
	}

	updated, _ := h.repo.GetByID(id)
	return c.JSON(fiber.Map{
		"success": true,
		"data":    updated,
	})
}

// Delete deletes an alert rule
func (h *AlertRuleHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	existing, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rule",
			},
		})
	}
	if existing == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Alert rule not found",
			},
		})
	}

	if existing.IsSystem {
		return c.Status(403).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FORBIDDEN",
				"message": "System rules cannot be deleted",
			},
		})
	}

	if err := h.repo.Delete(id); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "DELETE_ERROR",
				"message": "Failed to delete alert rule",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    nil,
	})
}

// Toggle toggles the is_enabled flag for an alert rule
func (h *AlertRuleHandler) Toggle(c *fiber.Ctx) error {
	id := c.Params("id")

	existing, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch alert rule",
			},
		})
	}
	if existing == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Alert rule not found",
			},
		})
	}

	newEnabled := !existing.IsEnabled
	if err := h.repo.SetEnabled(id, newEnabled); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UPDATE_ERROR",
				"message": "Failed to toggle alert rule",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":        id,
			"isEnabled": newEnabled,
		},
	})
}
