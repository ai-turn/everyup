package handlers

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// MetricHandler handles metric-related requests
type MetricHandler struct {
	repo        *database.MetricRepository
	serviceRepo *database.ServiceRepository
}

// NewMetricHandler creates a new metric handler
func NewMetricHandler() *MetricHandler {
	return &MetricHandler{
		repo:        database.NewMetricRepository(),
		serviceRepo: database.NewServiceRepository(),
	}
}

// GetByServiceID returns metrics for a specific service
func (h *MetricHandler) GetByServiceID(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	// Check if service exists
	service, err := h.serviceRepo.GetByID(serviceID)
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

	// Get limit from query params
	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	metrics, err := h.repo.GetByServiceID(serviceID, limit)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    metrics,
	})
}

// GetSummary returns metric summary for a service
func (h *MetricHandler) GetSummary(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	// Get duration from query params (default 24h)
	duration := 24 * time.Hour
	if d := c.Query("duration"); d != "" {
		switch d {
		case "1h":
			duration = time.Hour
		case "6h":
			duration = 6 * time.Hour
		case "24h":
			duration = 24 * time.Hour
		case "7d":
			duration = 7 * 24 * time.Hour
		case "30d":
			duration = 30 * 24 * time.Hour
		}
	}

	summary, err := h.repo.GetSummary(serviceID, duration)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    summary,
	})
}

// GetHistory returns an uptime monitor's checks bucketed for the response-time
// chart, with the same ranges and bucket sizes as Docker service history.
func (h *MetricHandler) GetHistory(c *fiber.Ctx) error {
	var since time.Duration
	var bucketMins int
	switch c.Query("range", "24h") {
	case "1h":
		since, bucketMins = time.Hour, 2
	case "6h":
		since, bucketMins = 6*time.Hour, 5
	default: // 24h
		since, bucketMins = 24*time.Hour, 20
	}
	points, err := h.repo.GetHistoryBuckets(c.Params("id"), time.Now().Add(-since), bucketMins)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": points})
}

// GetRecentChecks returns recent check results (success + failure) across all non-log services
func (h *MetricHandler) GetRecentChecks(c *fiber.Ctx) error {
	limit := 200
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	entries, err := h.repo.GetRecentChecks(limit)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if entries == nil {
		entries = []models.CheckEntry{}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    entries,
	})
}

// GetAllFailures returns recent failures across all services
func (h *MetricHandler) GetAllFailures(c *fiber.Ctx) error {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	failures, err := h.repo.GetAllFailures(limit)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if failures == nil {
		failures = []models.FailureWithService{}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    failures,
	})
}

// GetKpiSummary returns aggregate KPI for the healthcheck list page hero
func (h *MetricHandler) GetKpiSummary(c *fiber.Ctx) error {
	kpi, err := h.repo.GetKpiSummary()
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": kpi})
}

// GetUptimeSummaryAll returns per-service uptime percentages
func (h *MetricHandler) GetUptimeSummaryAll(c *fiber.Ctx) error {
	days := 90
	if d := c.Query("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 {
			days = parsed
		}
	}

	summaries, err := h.repo.GetUptimeSummaryAll(days)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if summaries == nil {
		summaries = []models.ServiceUptimeSummary{}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    summaries,
	})
}

// GetUptime returns uptime data for calendar view
func (h *MetricHandler) GetUptime(c *fiber.Ctx) error {
	serviceID := c.Params("id")

	// Get days from query params (default 30)
	days := 30
	if d := c.Query("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil && parsed > 0 {
			days = parsed
		}
	}

	data, err := h.repo.GetUptimeData(serviceID, days)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	// Transform to frontend expected format
	var totalUptime float64
	uptimeDays := make([]fiber.Map, 0, len(data))

	for _, d := range data {
		totalUptime += d.Uptime

		// Determine status based on uptime percentage
		status := "up"
		if d.Uptime < 50 {
			status = "down"
		} else if d.Uptime < 100 {
			status = "partial"
		}

		uptimeDays = append(uptimeDays, fiber.Map{
			"date":   d.Date,
			"status": status,
			"uptime": d.Uptime,
		})
	}

	// Calculate overall percentage
	percentage := 100.0
	if len(data) > 0 {
		percentage = totalUptime / float64(len(data))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"percentage": percentage,
			"days":       uptimeDays,
		},
	})
}
