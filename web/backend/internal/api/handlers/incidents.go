package handlers

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// IncidentHandler handles incident-related requests
type IncidentHandler struct {
	repo      *database.IncidentRepository
	agentRepo *database.AgentRepository
}

// NewIncidentHandler creates a new incident handler
func NewIncidentHandler() *IncidentHandler {
	return &IncidentHandler{
		repo:      database.NewIncidentRepository(),
		agentRepo: database.NewAgentRepository(),
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
		end := now
		if in.ResolvedAt != nil {
			end = *in.ResolvedAt
		}
		out = append(out, models.TimelineIncident{
			Source:      models.IncidentSourceUptime,
			TargetName:  in.ServiceName,
			TargetPath:  "/uptime/" + in.ServiceID,
			StartedAt:   in.StartedAt,
			EndedAt:     in.ResolvedAt,
			DurationSec: int64(end.Sub(in.StartedAt).Seconds()),
			Active:      in.ResolvedAt == nil,
			Message:     in.Message,
		})
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
