package handlers

import (
	"strconv"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// LogHandler handles log-related requests
type LogHandler struct {
	repo *database.LogRepository
}

// NewLogHandler creates a new log handler
func NewLogHandler() *LogHandler {
	return &LogHandler{
		repo: database.NewLogRepository(),
	}
}

func parseLogTimeQuery(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}
	}
	return parsed
}

// GetAll returns logs with filters and pagination
func (h *LogHandler) GetAll(c *fiber.Ctx) error {
	filter := models.LogFilter{
		ServiceID:   c.Query("serviceId"),
		ServiceName: c.Query("serviceName"),
		Level:       models.LogLevel(c.Query("level")),
		Search:      c.Query("search"),
		TraceID:     c.Query("traceId"),
		AttrKey:     c.Query("attrKey"),
		AttrValue:   c.Query("attrValue"),
		From:        parseLogTimeQuery(c.Query("from")),
		To:          parseLogTimeQuery(c.Query("to")),
	}

	// Parse pagination
	if limit := c.Query("limit"); limit != "" {
		if parsed, err := strconv.Atoi(limit); err == nil {
			filter.Limit = parsed
		}
	}
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if filter.Limit > 1000 {
		filter.Limit = 1000
	}

	if offset := c.Query("offset"); offset != "" {
		if parsed, err := strconv.Atoi(offset); err == nil {
			filter.Offset = parsed
		}
	}

	// Parse page number (alternative to offset)
	if page := c.Query("page"); page != "" {
		if parsed, err := strconv.Atoi(page); err == nil && parsed > 0 {
			filter.Offset = (parsed - 1) * filter.Limit
		}
	}

	logs, total, err := h.repo.GetAll(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"data": logs, "total": total}})
}

// GetByServiceID returns logs for a specific service
func (h *LogHandler) GetByServiceID(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	filter := models.LogFilter{
		ServiceID: serviceID,
		Level:     models.LogLevel(c.Query("level")),
		Search:    c.Query("search"),
		TraceID:   c.Query("traceId"),
		AttrKey:   c.Query("attrKey"),
		AttrValue: c.Query("attrValue"),
		From:      parseLogTimeQuery(c.Query("from")),
		To:        parseLogTimeQuery(c.Query("to")),
		Limit:     50,
	}

	if limit := c.Query("limit"); limit != "" {
		if parsed, err := strconv.Atoi(limit); err == nil {
			filter.Limit = parsed
		}
	}

	logs, total, err := h.repo.GetAll(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
		"total":   total,
	})
}
