package handlers

import (
	"encoding/json"
	"time"

	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// Exact scalar attribute filters and exact series IDs are bounded separately
// from the result cap. Never interpolate a user-supplied attribute into SQL.
func applyMetricSelection(c *fiber.Ctx, f *models.OtelMetricFilter) error {
	f.MetricType = c.Query("type")
	f.Unit = c.Query("unit")
	if f.MetricType != "" && f.MetricType != "gauge" && f.MetricType != "sum" && f.MetricType != "histogram" {
		return fiber.NewError(400, "invalid metric type")
	}
	if raw := c.Query("attributes"); raw != "" {
		if len(raw) > 4096 || json.Unmarshal([]byte(raw), &f.Attributes) != nil || f.Attributes == nil || len(f.Attributes) > 8 {
			return fiber.NewError(400, "invalid attributes")
		}
		for key, value := range f.Attributes {
			if key == "" {
				return fiber.NewError(400, "empty attribute key")
			}
			switch value.(type) {
			case string, float64, bool, nil:
			default:
				return fiber.NewError(400, "attribute must be scalar")
			}
		}
	}
	if raw := c.Query("series"); raw != "" {
		if len(raw) > 16384 || json.Unmarshal([]byte(raw), &f.Series) != nil || f.Series == nil || len(f.Series) > 6 {
			return fiber.NewError(400, "invalid series")
		}
		for _, id := range f.Series {
			var attributes map[string]interface{}
			if json.Unmarshal([]byte(id), &attributes) != nil || attributes == nil {
				return fiber.NewError(400, "invalid series ID")
			}
		}
	}
	return nil
}

func applyMetricExplorerQuery(c *fiber.Ctx, f *models.OtelMetricFilter) error {
	if err := applyMetricSelection(c, f); err != nil {
		return err
	}
	f.To = time.Now().UTC()
	if raw := c.Query("to"); raw != "" {
		parsed, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return err
		}
		f.To = parsed
	}
	f.From = f.To.Add(-6 * time.Hour)
	if raw := c.Query("from"); raw != "" {
		parsed, err := time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return err
		}
		f.From = parsed
	}
	if !f.From.Before(f.To) || f.To.Sub(f.From) > 24*time.Hour {
		return fiber.NewError(400, "window must be within 24 hours")
	}
	return nil
}

func (h *ObservedServiceHandler) QueryOtelMetric(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalMetrics); err != nil {
		return observedServiceError(c, err)
	}
	f := &models.OtelMetricFilter{ServiceID: c.Params("id"), MetricName: c.Query("name")}
	if f.MetricName == "" {
		return agentBadRequest(c, ErrCodeValidation, "name is required")
	}
	if err := applyMetricExplorerQuery(c, f); err != nil {
		return agentBadRequest(c, ErrCodeValidation, err.Error())
	}
	result, err := h.metricRepo.Query(f)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": result})
}

func (h *AgentHandler) QueryServiceOtelMetric(c *fiber.Ctx) error {
	service, err := h.repo.GetServiceByKey(c.Params("agentId"), c.Params("key"))
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if service == nil {
		return c.Status(404).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": ErrCodeNotFound}})
	}
	f := &models.OtelMetricFilter{AgentID: c.Params("agentId"), ServiceName: service.Name, MetricName: c.Query("name")}
	if f.MetricName == "" {
		return agentBadRequest(c, ErrCodeValidation, "name is required")
	}
	if err := applyMetricExplorerQuery(c, f); err != nil {
		return agentBadRequest(c, ErrCodeValidation, err.Error())
	}
	result, err := h.otelMetricRepo.Query(f)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": result})
}
