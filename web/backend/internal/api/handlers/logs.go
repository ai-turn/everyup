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

// logsPageWindowStart is where the logs page's window begins: far enough back
// to catch last night, recent enough that a finished incident stops counting.
// UTC because OTLP stores UTC timestamps and the driver compares times as text.
func logsPageWindowStart() time.Time {
	return time.Now().UTC().Add(-24 * time.Hour)
}

// GetSummary returns each log service's error/warn activity over the logs page
// window, bucketed hourly. GET /logs/summary
func (h *LogHandler) GetSummary(c *fiber.Ctx) error {
	summaries, err := h.repo.Summary(logsPageWindowStart(), 60)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": summaries})
}

// GetPatterns returns the most frequent error/warn log patterns over the logs
// page window. GET /logs/patterns?limit= (default 10)
func (h *LogHandler) GetPatterns(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	patterns, err := h.repo.Patterns(logsPageWindowStart(), limit)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": patterns})
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
