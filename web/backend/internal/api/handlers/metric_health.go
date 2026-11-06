package handlers

import (
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

func metricHealthResponse(c *fiber.Ctx, repo *database.OtelMetricRepository, filter *models.OtelMetricFilter) error {
	rules, err := database.NewAlertRuleRepository().GetEnabledOtelMetricRules(filter.ServiceID, filter.AgentID, filter.ServiceName)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	result, err := repo.MetricHealth(filter, rules, time.Now().UTC())
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": result})
}

func (h *ObservedServiceHandler) GetMetricHealth(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalMetrics); err != nil {
		return observedServiceError(c, err)
	}
	return metricHealthResponse(c, h.metricRepo, &models.OtelMetricFilter{ServiceID: c.Params("id")})
}

func (h *AgentHandler) GetServiceMetricHealth(c *fiber.Ctx) error {
	service, err := h.repo.GetServiceByKey(c.Params("agentId"), c.Params("key"))
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if service == nil {
		return c.Status(404).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": ErrCodeNotFound}})
	}
	return metricHealthResponse(c, h.otelMetricRepo, &models.OtelMetricFilter{AgentID: c.Params("agentId"), ServiceName: service.Name})
}
