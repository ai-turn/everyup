package handlers

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

const auditActionViewCapturedBody = "trace.body.view"

var capturedBodyEventNames = models.CapturedBodyEventNames

// TracesHandler exposes trace correlation reads.
type TracesHandler struct {
	spanRepo  *database.SpanRepository
	logRepo   *database.LogRepository
	reqRepo   *database.ApiRequestRepository
	auditRepo *database.AuditRepository
}

// NewTracesHandler creates a TracesHandler.
func NewTracesHandler() *TracesHandler {
	return &TracesHandler{
		spanRepo:  database.NewSpanRepository(),
		logRepo:   database.NewLogRepository(),
		reqRepo:   database.NewApiRequestRepository(),
		auditRepo: database.NewAuditRepository(),
	}
}

// GetByTraceID handles GET /api/v1/traces/:traceId. Returns the spans, logs,
// and api_requests projections that share the trace ID. Empty arrays, not 404,
// let clients distinguish "no data yet" from "trace gone" by inspecting lengths.
func (h *TracesHandler) GetByTraceID(c *fiber.Ctx) error {
	traceID := c.Params("traceId")
	if traceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    ErrCodeInvalidRequest,
				"message": "traceId path parameter is required",
			},
		})
	}

	spans, err := h.spanRepo.GetByTraceID(traceID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}

	claims, _ := c.Locals("claims").(*crypto.UserClaims)
	bodyCount := countCapturedBodyEvents(spans)
	if bodyCount > 0 {
		if canViewCapturedBodies(claims) {
			h.auditCapturedBodyView(claims, traceID, bodyCount)
		} else {
			spans = redactCapturedBodyEvents(spans)
		}
	}

	logs, err := h.logRepo.GetByTraceID(traceID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}
	apiReqs, err := h.reqRepo.GetByTraceID(traceID)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"traceId":     traceID,
			"spans":       defaultEmptySlice(spans),
			"logs":        defaultEmptySlice(logs),
			"apiRequests": defaultEmptySlice(apiReqs),
		},
	})
}

func canViewCapturedBodies(claims *crypto.UserClaims) bool {
	return claims != nil && claims.Role == "admin"
}

func countCapturedBodyEvents(spans []models.Span) int {
	count := 0
	for _, span := range spans {
		events := decodeSpanEvents(span.Events)
		for _, event := range events {
			if capturedBodyEventNames[eventName(event)] && eventBody(event) != "" {
				count++
			}
		}
	}
	return count
}

func redactCapturedBodyEvents(spans []models.Span) []models.Span {
	redacted := make([]models.Span, len(spans))
	copy(redacted, spans)
	for i := range redacted {
		events := decodeSpanEvents(redacted[i].Events)
		if len(events) == 0 {
			continue
		}
		changed := false
		for _, event := range events {
			if !capturedBodyEventNames[eventName(event)] {
				continue
			}
			attrs, ok := event["attributes"].(map[string]interface{})
			if !ok {
				continue
			}
			if _, ok := attrs["body"]; ok {
				delete(attrs, "body")
				attrs["body_redacted"] = true
				changed = true
			}
		}
		if changed {
			if payload, err := json.Marshal(events); err == nil {
				redacted[i].Events = payload
			}
		}
	}
	return redacted
}

func (h *TracesHandler) auditCapturedBodyView(claims *crypto.UserClaims, traceID string, bodyCount int) {
	if h.auditRepo == nil || claims == nil {
		return
	}
	metadata, _ := json.Marshal(map[string]interface{}{
		"capturedBodyEvents": bodyCount,
	})
	_ = h.auditRepo.Create(&models.AuditEvent{
		UserID:    claims.UserID,
		Username:  claims.Username,
		Action:    auditActionViewCapturedBody,
		TraceID:   traceID,
		Metadata:  string(metadata),
		CreatedAt: time.Now(),
	})
}

func decodeSpanEvents(raw json.RawMessage) []map[string]interface{} {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var events []map[string]interface{}
	if err := json.Unmarshal(raw, &events); err != nil {
		return nil
	}
	return events
}

func eventName(event map[string]interface{}) string {
	name, _ := event["name"].(string)
	return name
}

func eventBody(event map[string]interface{}) string {
	attrs, ok := event["attributes"].(map[string]interface{})
	if !ok {
		return ""
	}
	body, _ := attrs["body"].(string)
	return body
}

// defaultEmptySlice substitutes a non-nil empty slice for nil so the JSON
// response always serializes [] instead of null.
func defaultEmptySlice[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
