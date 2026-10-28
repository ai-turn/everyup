package handlers

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// IncidentHandler handles incident-related requests
type IncidentHandler struct {
	repo        *database.IncidentRepository
	agentRepo   *database.AgentRepository
	metricRepo  *database.MetricRepository
	serviceRepo *database.ServiceRepository
}

// NewIncidentHandler creates a new incident handler
func NewIncidentHandler() *IncidentHandler {
	return &IncidentHandler{
		repo:        database.NewIncidentRepository(),
		agentRepo:   database.NewAgentRepository(),
		metricRepo:  database.NewMetricRepository(),
		serviceRepo: database.NewServiceRepository(),
	}
}

// GetAll returns all incidents
func (h *IncidentHandler) GetAll(c *fiber.Ctx) error {
	incidents, err := h.repo.GetActive()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    incidents,
	})
}

// GetTimeline merges outage episodes from the two subsystems that keep history
// — uptime monitors (`incidents`) and Docker services (`agent_service_history`)
// — into one newest-first list.
//
// Direct-connection services are not represented: they store only a last-seen
// timestamp, so no episode can be derived. See models.TimelineIncident.
func (h *IncidentHandler) GetTimeline(c *fiber.Ctx) error {
	days := queryInt(c, "days", 7, 1, 90)
	limit := queryInt(c, "limit", 20, 1, 100)

	// Each source is asked for the full limit; the merge below decides which
	// ones survive. Asking each for limit/2 would drop real episodes whenever
	// one subsystem is quiet.
	uptime, err := h.repo.GetRecentUptimeIncidents(days, limit)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	docker, err := h.agentRepo.GetAllAgentIncidents(days, limit)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}

	now := time.Now()
	out := make([]models.TimelineIncident, 0, len(uptime)+len(docker))
	for _, in := range uptime {
		out = append(out, uptimeEpisode(in, now))
	}
	for _, in := range docker {
		out = append(out, models.TimelineIncident{
			Source:     models.IncidentSourceDocker,
			TargetName: in.ServiceName,
			// The key travels in a path segment and may contain ':' or '/'.
			TargetPath:  "/services/" + in.AgentID + "/" + encodeURIPathSegment(in.Key),
			StartedAt:   in.StartedAt,
			EndedAt:     in.EndedAt,
			DurationSec: in.DurationSec,
			Active:      in.Active,
		})
	}

	sort.SliceStable(out, func(i, j int) bool { return out[i].StartedAt.After(out[j].StartedAt) })
	if len(out) > limit {
		out = out[:limit]
	}

	return c.JSON(fiber.Map{"success": true, "data": out})
}

// encodeURIPathSegment escapes a service key for a URL path segment the same
// way the frontend's encodeURIComponent does.
//
// url.PathEscape is not equivalent: it leaves ':' (and '@', '&', '=', …)
// unescaped because they are legal inside a path segment. Service keys look
// like "shop:payment-worker", and every link in the app is built with
// encodeURIComponent while the server decodes with Fiber's UnescapePath — so a
// raw ':' here would be the one link that does not match the others.
func encodeURIPathSegment(s string) string {
	const unreserved = "-_.!~*'()"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		ch := s[i]
		switch {
		case ch >= 'A' && ch <= 'Z', ch >= 'a' && ch <= 'z', ch >= '0' && ch <= '9',
			strings.IndexByte(unreserved, ch) >= 0:
			b.WriteByte(ch)
		default:
			b.WriteString(fmt.Sprintf("%%%02X", ch))
		}
	}
	return b.String()
}

// queryInt reads a bounded integer query param, falling back to def when the
// value is absent or outside [min, max].
func queryInt(c *fiber.Ctx, name string, def, min, max int) int {
	raw := c.Query(name)
	if raw == "" {
		return def
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < min || parsed > max {
		return def
	}
	return parsed
}

// GetByService returns one uptime monitor's outage episodes, newest first.
func (h *IncidentHandler) GetByService(c *fiber.Ctx) error {
	days := queryInt(c, "days", 90, 1, 365)
	limit := queryInt(c, "limit", 20, 1, 100)
	uptime, err := h.repo.GetUptimeIncidentsForService(c.Params("id"), days, limit)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	now := time.Now()
	out := make([]models.TimelineIncident, 0, len(uptime))
	for _, in := range uptime {
		out = append(out, uptimeEpisode(in, now))
	}
	return c.JSON(fiber.Map{"success": true, "data": out})
}

// GetIsolatedFailures returns one monitor's failed checks that did not become an
// outage, newest first. A check belongs to an outage when it falls inside it or
// among the consecutive failures that opened it — the incident starts only at
// the threshold-th failure, so its window reaches back threshold-1 intervals.
func (h *IncidentHandler) GetIsolatedFailures(c *fiber.Ctx) error {
	id := c.Params("id")
	days := queryInt(c, "days", 90, 1, 365)
	limit := queryInt(c, "limit", 50, 1, 200)
	service, err := h.serviceRepo.GetByID(id)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if service == nil {
		return c.JSON(fiber.Map{"success": true, "data": []models.Metric{}})
	}
	incidents, err := h.repo.GetUptimeIncidentsForService(id, days, 100)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	// ponytail: fetch extra and filter in Go — fine while outages are a handful per window.
	failures, err := h.metricRepo.GetFailuresSince(id, time.Now().AddDate(0, 0, -days), limit+200)
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}

	threshold := 3
	if cfg := config.Get(); cfg != nil && cfg.Alerts.ConsecutiveFailures > 0 {
		threshold = cfg.Alerts.ConsecutiveFailures
	}
	// Half an interval of slack: checks drift a little from their schedule.
	lookback := time.Duration(threshold-1)*time.Duration(service.Interval)*time.Second + time.Duration(service.Interval)*time.Second/2
	now := time.Now()
	out := make([]models.Metric, 0, limit)
	for _, f := range failures {
		inOutage := false
		for _, in := range incidents {
			end := now
			if in.ResolvedAt != nil {
				end = *in.ResolvedAt
			}
			if !f.CheckedAt.Before(in.StartedAt.Add(-lookback)) && !f.CheckedAt.After(end) {
				inOutage = true
				break
			}
		}
		if !inOutage {
			out = append(out, f)
			if len(out) == limit {
				break
			}
		}
	}
	return c.JSON(fiber.Map{"success": true, "data": out})
}

// uptimeEpisode converts a stored uptime incident; an open one lasts until now.
func uptimeEpisode(in database.UptimeIncident, now time.Time) models.TimelineIncident {
	end := now
	if in.ResolvedAt != nil {
		end = *in.ResolvedAt
	}
	return models.TimelineIncident{
		Source:      models.IncidentSourceUptime,
		TargetName:  in.ServiceName,
		TargetPath:  "/uptime/" + in.ServiceID,
		StartedAt:   in.StartedAt,
		EndedAt:     in.ResolvedAt,
		DurationSec: int64(end.Sub(in.StartedAt).Seconds()),
		Active:      in.ResolvedAt == nil,
		Message:     in.Message,
	}
}
