package handlers

import (
	"errors"
	"strconv"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/directtelemetry"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

// ObservedServiceHandler manages Agent-free OTLP targets and credentials.
type ObservedServiceHandler struct {
	manager    *directtelemetry.Manager
	logRepo    *database.LogRepository
	metricRepo *database.OtelMetricRepository
	reqRepo    *database.ApiRequestRepository
	spanRepo   *database.SpanRepository
}

func NewObservedServiceHandler() *ObservedServiceHandler {
	return &ObservedServiceHandler{
		manager:    directtelemetry.NewManager(),
		logRepo:    database.NewLogRepository(),
		metricRepo: database.NewOtelMetricRepository(),
		reqRepo:    database.NewApiRequestRepository(),
		spanRepo:   database.NewSpanRepository(),
	}
}

// GetServiceMetrics returns one representative recent metric per direct
// Observed Service for the Metrics capability overview.
func (h *ObservedServiceHandler) GetServiceMetrics(c *fiber.Ctx) error {
	metrics, err := h.metricRepo.LatestValuesByObservedService(time.Now().Add(-15 * time.Minute))
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	byService := make(map[string][]models.OtelServiceMetric)
	for _, metric := range metrics {
		byService[metric.ServiceID] = append(byService[metric.ServiceID], metric)
	}
	out := make([]models.OtelServiceMetric, 0, len(byService))
	for _, serviceMetrics := range byService {
		if representative, ok := pickRepresentativeMetric(serviceMetrics); ok {
			out = append(out, representative)
		}
	}
	return c.JSON(fiber.Map{"success": true, "data": out})
}

func (h *ObservedServiceHandler) GetAll(c *fiber.Ctx) error {
	services, err := h.manager.GetAll(models.TelemetrySignal(c.Query("signal")))
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": services})
}

func (h *ObservedServiceHandler) GetByID(c *fiber.Ctx) error {
	service, err := h.manager.GetByID(c.Params("id"))
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": service})
}

func (h *ObservedServiceHandler) Create(c *fiber.Ctx) error {
	var input models.ObservedServiceInput
	if err := c.BodyParser(&input); err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid request body")
	}
	setup, err := h.manager.Create(input)
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": setup})
}

func (h *ObservedServiceHandler) Update(c *fiber.Ctx) error {
	var input models.ObservedServiceInput
	if err := c.BodyParser(&input); err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid request body")
	}
	service, err := h.manager.Update(c.Params("id"), input)
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": service})
}

func (h *ObservedServiceHandler) RotateKey(c *fiber.Ctx) error {
	setup, err := h.manager.RotateKey(c.Params("id"))
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": setup})
}

func (h *ObservedServiceHandler) RevokeKey(c *fiber.Ctx) error {
	service, err := h.manager.RevokeKey(c.Params("id"))
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": service})
}

func directLogFilter(c *fiber.Ctx) models.LogFilter {
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if offset < 0 {
		offset = 0
	}
	return models.LogFilter{
		ServiceID: c.Params("id"),
		Level:     models.LogLevel(c.Query("level")),
		Search:    c.Query("search"),
		TraceID:   c.Query("traceId"),
		AttrKey:   c.Query("attrKey"),
		AttrValue: c.Query("attrValue"),
		From:      parseLogTimeQuery(c.Query("from")),
		To:        parseLogTimeQuery(c.Query("to")),
		Limit:     limit,
		Offset:    offset,
	}
}

func (h *ObservedServiceHandler) GetLogs(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalLogs); err != nil {
		return observedServiceError(c, err)
	}
	logs, total, err := h.logRepo.GetAll(directLogFilter(c))
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"data": logs, "total": total}})
}

func (h *ObservedServiceHandler) GetLogHistogram(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalLogs); err != nil {
		return observedServiceError(c, err)
	}
	bucketMins, _ := strconv.Atoi(c.Query("bucketMins", "10"))
	buckets, err := h.logRepo.Histogram(directLogFilter(c), bucketMins)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": buckets})
}

func (h *ObservedServiceHandler) GetLogFilter(c *fiber.Ctx) error {
	service, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalLogs)
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"levels": service.LogLevelFilter}})
}

func (h *ObservedServiceHandler) SetLogFilter(c *fiber.Ctx) error {
	var req struct {
		Levels []models.LogLevel `json:"levels"`
	}
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid request body")
	}
	service, err := h.manager.SetLogLevelFilter(c.Params("id"), req.Levels)
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"levels": service.LogLevelFilter}})
}

func (h *ObservedServiceHandler) GetOtelMetricNames(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalMetrics); err != nil {
		return observedServiceError(c, err)
	}
	names, err := h.metricRepo.ListNames(&models.OtelMetricFilter{ServiceID: c.Params("id")})
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if names == nil {
		names = []models.OtelMetricName{}
	}
	return c.JSON(fiber.Map{"success": true, "data": names})
}

func (h *ObservedServiceHandler) GetOtelMetricPoints(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalMetrics); err != nil {
		return observedServiceError(c, err)
	}
	name := c.Query("name")
	if name == "" {
		return agentBadRequest(c, ErrCodeValidation, "name query parameter is required")
	}
	filter := &models.OtelMetricFilter{ServiceID: c.Params("id"), MetricName: name}
	if from := c.Query("from"); from != "" {
		if parsed, err := time.Parse(time.RFC3339, from); err == nil {
			filter.From = parsed
		}
	}
	if to := c.Query("to"); to != "" {
		if parsed, err := time.Parse(time.RFC3339, to); err == nil {
			filter.To = parsed
		}
	}
	if limit, _ := strconv.Atoi(c.Query("limit", "0")); limit > 0 {
		filter.Limit = limit
	}
	points, err := h.metricRepo.ListPoints(filter)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if points == nil {
		points = []models.OtelMetric{}
	}
	return c.JSON(fiber.Map{"success": true, "data": points})
}

// GetTraces lists the direct service's traces, newest or slowest first.
func (h *ObservedServiceHandler) GetTraces(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalTraces); err != nil {
		return observedServiceError(c, err)
	}
	filter := &models.TraceFilter{ServiceID: c.Params("id")}
	applyTraceQuery(c, filter)
	traces, err := h.spanRepo.ListTraces(filter)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if traces == nil {
		traces = []models.TraceSummary{}
	}
	return c.JSON(fiber.Map{"success": true, "data": traces})
}

// GetOtelMetricQuantiles returns p50/p95/p99 recovered from an explicit
// histogram's stored buckets, or null data when the metric is not a histogram.
func (h *ObservedServiceHandler) GetOtelMetricQuantiles(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalMetrics); err != nil {
		return observedServiceError(c, err)
	}
	name := c.Query("name")
	if name == "" {
		return agentBadRequest(c, ErrCodeValidation, "name query parameter is required")
	}
	filter := &models.OtelMetricFilter{ServiceID: c.Params("id"), MetricName: name}
	applyMetricWindow(c, filter)
	quantiles, err := h.metricRepo.HistogramQuantiles(filter)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": quantiles})
}

func directApiRequestFilter(c *fiber.Ctx) *models.ApiRequestFilter {
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	if limit <= 0 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if offset < 0 {
		offset = 0
	}
	filter := &models.ApiRequestFilter{
		ServiceID:  c.Params("id"),
		Search:     c.Query("search"),
		ErrorsOnly: c.Query("errorsOnly") == "true",
		Limit:      limit,
		Offset:     offset,
	}
	filter.MinStatus, _ = strconv.Atoi(c.Query("minStatus", "0"))
	filter.MaxStatus, _ = strconv.Atoi(c.Query("maxStatus", "0"))
	if from := c.Query("from"); from != "" {
		if parsed, err := time.Parse(time.RFC3339, from); err == nil {
			filter.From = parsed
		}
	}
	if to := c.Query("to"); to != "" {
		if parsed, err := time.Parse(time.RFC3339, to); err == nil {
			filter.To = parsed
		}
	}
	return filter
}

func (h *ObservedServiceHandler) GetRequests(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalTraces); err != nil {
		return observedServiceError(c, err)
	}
	requests, total, err := h.reqRepo.List(directApiRequestFilter(c))
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if requests == nil {
		requests = []models.ApiRequest{}
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"data": requests, "total": total}})
}

func (h *ObservedServiceHandler) GetRequestStats(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalTraces); err != nil {
		return observedServiceError(c, err)
	}
	bucketMins, _ := strconv.Atoi(c.Query("bucketMins", "5"))
	stats, err := h.reqRepo.RequestStats(directApiRequestFilter(c), bucketMins)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if stats == nil {
		stats = []models.ApiRequestStatBucket{}
	}
	return c.JSON(fiber.Map{"success": true, "data": stats})
}

func (h *ObservedServiceHandler) GetRequestStatusSummary(c *fiber.Ctx) error {
	if _, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalTraces); err != nil {
		return observedServiceError(c, err)
	}
	summary, err := h.reqRepo.StatusSummary(directApiRequestFilter(c))
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": summary})
}

func (h *ObservedServiceHandler) GetApiExclusions(c *fiber.Ctx) error {
	service, err := h.manager.RequireSignal(c.Params("id"), models.TelemetrySignalTraces)
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"paths": service.ApiExcludePaths}})
}

func (h *ObservedServiceHandler) SetApiExclusions(c *fiber.Ctx) error {
	var req struct {
		Paths []string `json:"paths"`
	}
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid request body")
	}
	service, err := h.manager.SetApiExcludePaths(c.Params("id"), req.Paths)
	if err != nil {
		return observedServiceError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"paths": service.ApiExcludePaths}})
}

func (h *ObservedServiceHandler) Delete(c *fiber.Ctx) error {
	if err := h.manager.Delete(c.Params("id")); err != nil {
		return observedServiceError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func observedServiceError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, directtelemetry.ErrInvalidInput):
		return agentBadRequest(c, ErrCodeValidation, err.Error())
	case errors.Is(err, directtelemetry.ErrProjectMissing):
		return agentBadRequest(c, ErrCodeProjectNotFound, "project not found")
	case errors.Is(err, directtelemetry.ErrNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": ErrCodeObservedServiceNotFound},
		})
	case errors.Is(err, directtelemetry.ErrSignalDenied):
		return agentBadRequest(c, ErrCodeValidation, "capability is not enabled for this observed service")
	default:
		return internalError(c, ErrCodeDatabase, err)
	}
}
