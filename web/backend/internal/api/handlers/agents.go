package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/api/middleware"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AgentHandler struct {
	repo             *database.AgentRepository
	logRepo          *database.LogRepository
	reqRepo          *database.ApiRequestRepository
	otelMetricRepo   *database.OtelMetricRepository
	ruleEvaluator    *alerter.RuleEvaluator
	serviceEvaluator *alerter.ServiceRuleEvaluator
}

func NewAgentHandler() *AgentHandler {
	return &AgentHandler{
		repo:           database.NewAgentRepository(),
		logRepo:        database.NewLogRepository(),
		reqRepo:        database.NewApiRequestRepository(),
		otelMetricRepo: database.NewOtelMetricRepository(),
	}
}

// SetEvaluators wires alert rule evaluators so agent syncs can trigger evaluation.
func (h *AgentHandler) SetEvaluators(rule *alerter.RuleEvaluator, svc *alerter.ServiceRuleEvaluator) {
	h.ruleEvaluator = rule
	h.serviceEvaluator = svc
}

type agentEnrollRequest struct {
	AgentName string `json:"agentName"`
	Version   string `json:"version"`
}

type agentEnrollResponse struct {
	AgentID string `json:"agentId"`
}

type agentServicesRequest struct {
	ConfigHash   string                  `json:"configHash"`
	AgentID      string                  `json:"agentId"`
	AgentName    string                  `json:"agentName"`
	ObservedAt   time.Time               `json:"observedAt"`
	Services     []models.AgentService   `json:"services"`
	Capabilities models.CapabilityReport `json:"capabilities"`
}

type agentEventsRequest struct {
	AgentID string              `json:"agentId"`
	Events  []models.AgentEvent `json:"events"`
}

type agentMetricsRequest struct {
	AgentID    string    `json:"agentId"`
	CPUUsage   float64   `json:"cpuUsage"`
	MemTotal   float64   `json:"memTotal"`
	MemUsed    float64   `json:"memUsed"`
	MemUsage   float64   `json:"memUsage"`
	DiskTotal  float64   `json:"diskTotal"`
	DiskUsed   float64   `json:"diskUsed"`
	DiskUsage  float64   `json:"diskUsage"`
	NetIn      float64   `json:"netIn"`
	NetOut     float64   `json:"netOut"`
	RecordedAt time.Time `json:"recordedAt"`
}

// extractBearerToken pulls the token from "Authorization: Bearer <token>".
func extractBearerToken(c *fiber.Ctx) string {
	parts := strings.SplitN(c.Get("Authorization"), " ", 2)
	if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
		return strings.TrimSpace(parts[1])
	}
	return ""
}

// requireAgentKey authenticates a sync request by matching the Bearer token hash
// to the agent identified by :agentId in the URL path.
func (h *AgentHandler) requireAgentKey(c *fiber.Ctx) (bool, error) {
	token := extractBearerToken(c)
	if token == "" {
		return false, c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED", "message": "missing Docker collector API key"},
		})
	}
	agent, found, err := h.repo.FindAgentByKeyHash(hashAgentKey(token))
	if err != nil {
		return false, internalError(c, "DATABASE_ERROR", err)
	}
	if !found || agent.ID != c.Params("agentId") {
		return false, c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED", "message": "invalid Docker collector API key"},
		})
	}
	return true, nil
}

func (h *AgentHandler) Enroll(c *fiber.Ctx) error {
	token := extractBearerToken(c)
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED", "message": "missing Docker collector API key"},
		})
	}
	agent, found, err := h.repo.FindAgentByKeyHash(hashAgentKey(token))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if !found {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "UNAUTHORIZED", "message": "invalid Docker collector API key"},
		})
	}
	// Update version from request body if provided.
	var req agentEnrollRequest
	if err := c.BodyParser(&req); err == nil && req.Version != "" {
		_ = h.repo.UpsertAgent(models.Agent{
			ID:         agent.ID,
			Name:       agent.Name,
			Version:    req.Version,
			LastSeenAt: time.Now(),
		})
	}
	setupRepo := database.ConnectionSetupRepository{}
	if err := setupRepo.ReportEnrollment(agent.ID); err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(agentEnrollResponse{AgentID: agent.ID})
}

func (h *AgentHandler) SyncServices(c *fiber.Ctx) error {
	if authorized, err := h.requireAgentKey(c); !authorized || err != nil {
		return err
	}
	agentID := c.Params("agentId")
	var req agentServicesRequest
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", err.Error())
	}
	if req.AgentID != "" && req.AgentID != agentID {
		return agentBadRequest(c, "INVALID_REQUEST", "agentId mismatch")
	}
	// Older Agents do not send capabilities; keep the last known report rather
	// than replacing it with a zero-value document during a rolling upgrade.
	if !req.Capabilities.CheckedAt.IsZero() {
		if err := h.repo.UpdateCapabilityReport(agentID, req.Capabilities); err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
	}
	if err := h.repo.UpsertServices(agentID, req.ObservedAt, req.Services); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	setupRepo := database.ConnectionSetupRepository{}
	if err := setupRepo.ReportCollector(agentID, req.ConfigHash); err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	for _, service := range req.Services {
		if service.Seen {
			_ = setupRepo.Record("agent", agentID, service.Name, "uptime")
		}
	}
	if h.serviceEvaluator != nil {
		for _, svc := range req.Services {
			go h.serviceEvaluator.EvaluateAgent(agentID, svc.Key, svc.Name, svc.LastStatus, 0)
		}
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AgentHandler) SyncEvents(c *fiber.Ctx) error {
	if authorized, err := h.requireAgentKey(c); !authorized || err != nil {
		return err
	}
	agentID := c.Params("agentId")
	var req agentEventsRequest
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", err.Error())
	}
	if req.AgentID != "" && req.AgentID != agentID {
		return agentBadRequest(c, "INVALID_REQUEST", "agentId mismatch")
	}
	if err := h.repo.InsertEvents(agentID, req.Events); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AgentHandler) SyncMetrics(c *fiber.Ctx) error {
	if authorized, err := h.requireAgentKey(c); !authorized || err != nil {
		return err
	}
	agentID := c.Params("agentId")
	var req agentMetricsRequest
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", err.Error())
	}
	if req.AgentID != "" && req.AgentID != agentID {
		return agentBadRequest(c, "INVALID_REQUEST", "agentId mismatch")
	}
	if req.RecordedAt.IsZero() {
		req.RecordedAt = time.Now()
	}
	systemMetricRepo := database.NewSystemMetricRepository()
	metric := &models.SystemMetric{
		HostID:    agentID,
		CPUUsage:  req.CPUUsage,
		MemTotal:  req.MemTotal,
		MemUsed:   req.MemUsed,
		MemUsage:  req.MemUsage,
		DiskTotal: req.DiskTotal,
		DiskUsed:  req.DiskUsed,
		DiskUsage: req.DiskUsage,
		NetIn:     req.NetIn,
		NetOut:    req.NetOut,
		CreatedAt: req.RecordedAt,
	}
	if err := systemMetricRepo.Create(metric); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	recordReceipt(&middleware.IngestPrincipal{AgentID: agentID}, "host", "infrastructure")
	if h.ruleEvaluator != nil {
		go h.ruleEvaluator.EvaluateAgent(agentID, req.AgentID, metric)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// generateAgentKey creates a random key with prefix "evup_svc_" and returns (plaintext, sha256hex).
func generateAgentKey() (string, string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("rand: %w", err)
	}
	plain := "evup_svc_" + hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(plain))
	return plain, hex.EncodeToString(sum[:]), nil
}

// hashAgentKey returns the SHA-256 hex digest of a plaintext key.
func hashAgentKey(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

// Create pre-registers a new service (agent) and returns a short-lived join
// code. The long-lived API key stays server-side until the installer exchanges
// that code, so it is not exposed in the initial browser flow.
func (h *AgentHandler) Create(c *fiber.Ctx) error {
	var req struct {
		Name    string              `json:"name"`
		Profile models.AgentProfile `json:"profile"`
	}
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", "invalid request body")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return agentBadRequest(c, "VALIDATION_ERROR", "name is required")
	}
	profile, err := normalizeAgentProfile(req.Profile)
	if err != nil {
		return agentBadRequest(c, "VALIDATION_ERROR", err.Error())
	}

	plain, hash, err := generateAgentKey()
	if err != nil {
		return internalError(c, "KEY_GENERATION_ERROR", err)
	}
	keyEnc, err := crypto.Encrypt(plain)
	if err != nil {
		return internalError(c, ErrCodeSecret, err)
	}

	agent := models.Agent{
		ID:      "agent_" + uuid.NewString(),
		Name:    req.Name,
		Profile: profile,
	}
	joinCode, joinHash, expiresAt, err := newAgentJoinCode(time.Now())
	if err != nil {
		return internalError(c, "KEY_GENERATION_ERROR", err)
	}
	if err := h.repo.CreateAgentWithJoinCode(agent, hash, keyEnc, joinHash, expiresAt); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":        agent.ID,
			"name":      agent.Name,
			"profile":   agent.Profile,
			"joinCode":  joinCode,
			"expiresAt": expiresAt,
		},
	})
}

func normalizeAgentProfile(profile models.AgentProfile) (models.AgentProfile, error) {
	switch profile.Kind {
	case "", models.AgentProfileAllInOne:
		return models.DefaultAgentProfile(), nil
	case models.AgentProfileBasic:
		return models.AgentProfile{
			Kind:         models.AgentProfileBasic,
			Capabilities: []string{models.AgentCapabilityUptime, models.AgentCapabilityLogs},
		}, nil
	case models.AgentProfileCustom:
		requested := make(map[string]bool, len(profile.Capabilities))
		for _, capability := range profile.Capabilities {
			capability = strings.TrimSpace(capability)
			switch capability {
			case models.AgentCapabilityUptime, models.AgentCapabilityLogs, models.AgentCapabilityInfrastructure, models.AgentCapabilityAPI, models.AgentCapabilityMetrics:
				requested[capability] = true
			default:
				return models.AgentProfile{}, fmt.Errorf("unsupported capability: %s", capability)
			}
		}
		if len(requested) == 0 {
			return models.AgentProfile{}, fmt.Errorf("select at least one capability")
		}
		// Docker target discovery is the shared identity source for logs and
		// eBPF trace attribution, so it is an effective prerequisite.
		if requested[models.AgentCapabilityLogs] || requested[models.AgentCapabilityAPI] {
			requested[models.AgentCapabilityUptime] = true
		}
		effective := make([]string, 0, len(requested))
		for _, capability := range []string{
			models.AgentCapabilityUptime,
			models.AgentCapabilityLogs,
			models.AgentCapabilityInfrastructure,
			models.AgentCapabilityAPI,
			models.AgentCapabilityMetrics,
		} {
			if requested[capability] {
				effective = append(effective, capability)
			}
		}
		return models.AgentProfile{Kind: models.AgentProfileCustom, Capabilities: effective}, nil
	default:
		return models.AgentProfile{}, fmt.Errorf("unsupported profile: %s", profile.Kind)
	}
}

// Delete deactivates an agent (service), revoking its API key without deleting data.
func (h *AgentHandler) Delete(c *fiber.Ctx) error {
	if err := h.repo.DeactivateAgent(c.Params("agentId")); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"error":   fiber.Map{"code": "NOT_FOUND", "message": "Docker environment not found"},
			})
		}
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AgentHandler) GetAll(c *fiber.Ctx) error {
	agents, err := h.repo.GetAllAgents()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": agents})
}

// GetOverview returns per-agent KPI rollups (30d uptime, active incidents,
// 24h requests, latest p95) in one call for the home project cards.
// ponytail: sequential per-agent aggregation — fine for self-hosted agent
// counts; switch to grouped SQL if a deployment ever has dozens of agents.
func (h *AgentHandler) GetOverview(c *fiber.Ctx) error {
	agents, err := h.repo.GetAllAgents()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	out := make([]models.AgentOverview, 0, len(agents))
	for _, a := range agents {
		ov := models.AgentOverview{AgentID: a.ID}

		days, err := h.repo.GetAgentUptimeByDay(a.ID, 30)
		if err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
		healthy, total := 0, 0
		for _, d := range days {
			healthy += d.HealthyChecks
			total += d.TotalChecks
		}
		if total > 0 {
			pct := float64(healthy) * 100.0 / float64(total)
			ov.UptimePct = &pct
		}

		incidents, err := h.repo.GetAgentIncidents(a.ID, 30, 100)
		if err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
		for _, in := range incidents {
			if in.Active {
				ov.ActiveIncidents++
			}
		}

		buckets, err := h.reqRepo.RequestStats(&models.ApiRequestFilter{
			AgentID: a.ID,
			From:    time.Now().Add(-24 * time.Hour),
		}, 60)
		if err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
		for _, b := range buckets {
			ov.Requests24h += b.Count
		}
		for i := len(buckets) - 1; i >= 0; i-- {
			if buckets[i].Timed > 0 {
				p95 := buckets[i].P95
				ov.P95Ms = &p95
				break
			}
		}

		out = append(out, ov)
	}
	return c.JSON(fiber.Map{"success": true, "data": out})
}

// GetKey returns the agent's full API key (decrypted) for display in the UI.
// available is false for agents created before key storage existed — those have
// only the hash and must be rotated to obtain a viewable key.
func (h *AgentHandler) GetKey(c *fiber.Ctx) error {
	enc, found, err := h.repo.GetAgentKeyEnc(c.Params("agentId"))
	if err != nil {
		return internalError(c, ErrCodeDatabase, err)
	}
	if !found {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": ErrCodeNotFound, "message": "Docker environment not found"},
		})
	}
	if enc == "" {
		return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"apiKey": "", "available": false}})
	}
	plain, err := crypto.Decrypt(enc)
	if err != nil {
		return internalError(c, ErrCodeSecret, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"apiKey": plain, "available": true}})
}

// RotateKey issues a new API key for an agent, invalidating the previous one.
func (h *AgentHandler) RotateKey(c *fiber.Ctx) error {
	plain, hash, err := generateAgentKey()
	if err != nil {
		return internalError(c, "KEY_GENERATION_ERROR", err)
	}
	keyEnc, err := crypto.Encrypt(plain)
	if err != nil {
		return internalError(c, ErrCodeSecret, err)
	}
	if err := h.repo.UpdateAgentKey(c.Params("agentId"), hash, keyEnc); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"error":   fiber.Map{"code": ErrCodeNotFound, "message": "Docker environment not found"},
			})
		}
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"apiKey": plain}})
}

func (h *AgentHandler) GetServices(c *fiber.Ctx) error {
	services, err := h.repo.GetServices(c.Params("agentId"))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": services})
}

func (h *AgentHandler) DeleteService(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")
	if err := h.repo.DeleteService(agentID, key); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AgentHandler) GetEvents(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	events, err := h.repo.GetEvents(c.Params("agentId"), limit)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": events})
}

// GetAllServicesFlat returns all agent services across all agents with agent name included.
func (h *AgentHandler) GetAllServicesFlat(c *fiber.Ctx) error {
	services, err := h.repo.GetAllServicesFlat()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": services})
}

// GetServiceHistory returns time-bucketed response-time history for one agent service.
func (h *AgentHandler) GetServiceHistory(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	var since time.Time
	var bucketMins int
	switch c.Query("range", "24h") {
	case "1h":
		since = time.Now().Add(-1 * time.Hour)
		bucketMins = 2
	case "12h":
		since = time.Now().Add(-12 * time.Hour)
		bucketMins = 10
	case "6h":
		since = time.Now().Add(-6 * time.Hour)
		bucketMins = 5
	default: // 24h
		since = time.Now().Add(-24 * time.Hour)
		bucketMins = 20
	}

	points, err := h.repo.GetServiceHistoryBuckets(agentID, key, since, bucketMins)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": points})
}

// GetServiceUptime returns per-day uptime percentages for one agent service.
func (h *AgentHandler) GetServiceUptime(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")
	days, _ := strconv.Atoi(c.Query("days", "90"))
	if days <= 0 || days > 365 {
		days = 90
	}

	data, err := h.repo.GetServiceUptimeByDay(agentID, key, days)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": data})
}

// GetAgentUptime returns per-day uptime rolled up across all services of one agent.
func (h *AgentHandler) GetAgentUptime(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "90"))
	if days <= 0 || days > 365 {
		days = 90
	}
	data, err := h.repo.GetAgentUptimeByDay(c.Params("agentId"), days)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": data})
}

// GetAgentIncidents returns unhealthy episodes derived from service history.
func (h *AgentHandler) GetAgentIncidents(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "30"))
	if days <= 0 || days > 365 {
		days = 30
	}
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	data, err := h.repo.GetAgentIncidents(c.Params("agentId"), days, limit)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": data})
}

// GetServiceKeyEvents returns agent_events filtered to a specific service key.
func (h *AgentHandler) GetServiceKeyEvents(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")
	limit, _ := strconv.Atoi(c.Query("limit", "50"))

	events, err := h.repo.GetServiceKeyEvents(agentID, key, limit)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": events})
}

// GetServiceLogs returns logs for a service identified by agentId+key using service_name as the filter.
func (h *AgentHandler) GetServiceLogs(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	filter := models.LogFilter{
		AgentID:     agentID,
		ServiceName: service.Name,
		Level:       models.LogLevel(c.Query("level")),
		Search:      c.Query("search"),
		Limit:       limit,
		Offset:      offset,
	}
	if from := c.Query("from"); from != "" {
		if t, err2 := time.Parse(time.RFC3339, from); err2 == nil {
			filter.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err2 := time.Parse(time.RFC3339, to); err2 == nil {
			filter.To = t
		}
	}
	logs, total, err := h.logRepo.GetAll(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	// Nest under data so the frontend's request() unwrap (returns json.data) yields
	// { data, total } — total is otherwise dropped as an envelope sibling.
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"data": logs, "total": total}})
}

// GetServiceLogHistogram returns per-level log counts bucketed over time for
// the volume chart. GET /agents/:agentId/services/:key/log-histogram
func (h *AgentHandler) GetServiceLogHistogram(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	service, err := h.repo.GetServiceByKey(agentID, c.Params("key"))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	filter := models.LogFilter{
		AgentID:     agentID,
		ServiceName: service.Name,
		Level:       models.LogLevel(c.Query("level")),
		Search:      c.Query("search"),
	}
	if from := c.Query("from"); from != "" {
		if t, err2 := time.Parse(time.RFC3339, from); err2 == nil {
			filter.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err2 := time.Parse(time.RFC3339, to); err2 == nil {
			filter.To = t
		}
	}
	bucketMins, _ := strconv.Atoi(c.Query("bucketMins", "10"))

	buckets, err := h.logRepo.Histogram(filter, bucketMins)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": buckets})
}

// GetServiceRequests returns API requests for a service identified by agentId+key using service_name as the filter.
func (h *AgentHandler) GetServiceRequests(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	minStatus, _ := strconv.Atoi(c.Query("minStatus", "0"))
	maxStatus, _ := strconv.Atoi(c.Query("maxStatus", "0"))
	filter := &models.ApiRequestFilter{
		AgentID:     agentID,
		ServiceName: service.Name,
		Search:      c.Query("search"),
		ErrorsOnly:  c.Query("errorsOnly") == "true",
		MinStatus:   minStatus,
		MaxStatus:   maxStatus,
		Limit:       limit,
		Offset:      offset,
	}
	if from := c.Query("from"); from != "" {
		if t, err2 := time.Parse(time.RFC3339, from); err2 == nil {
			filter.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err2 := time.Parse(time.RFC3339, to); err2 == nil {
			filter.To = t
		}
	}
	requests, total, err := h.reqRepo.List(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	// Nest under data so the frontend's request() unwrap (returns json.data) yields
	// { data, total } — total is otherwise dropped as an envelope sibling.
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"data": requests, "total": total}})
}

// GetServiceRequestStats returns time-bucketed request aggregates (volume,
// errors, p50, p95) for a service's trends chart.
// GET /agents/:agentId/services/:key/request-stats?from=&to=&bucketMins=
func (h *AgentHandler) GetServiceRequestStats(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	filter := &models.ApiRequestFilter{AgentID: agentID, ServiceName: service.Name}
	if from := c.Query("from"); from != "" {
		if t, err2 := time.Parse(time.RFC3339, from); err2 == nil {
			filter.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err2 := time.Parse(time.RFC3339, to); err2 == nil {
			filter.To = t
		}
	}
	bucketMins, _ := strconv.Atoi(c.Query("bucketMins", "5"))

	stats, err := h.reqRepo.RequestStats(filter, bucketMins)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if stats == nil {
		stats = []models.ApiRequestStatBucket{}
	}
	return c.JSON(fiber.Map{"success": true, "data": stats})
}

// GetAgentRequestStats returns time-bucketed request aggregates rolled up across
// ALL of a project's (agent's) services — the project-level Requests trend.
// GET /agents/:agentId/request-stats?from=&to=&bucketMins=
func (h *AgentHandler) GetAgentRequestStats(c *fiber.Ctx) error {
	agentID := c.Params("agentId")

	filter := &models.ApiRequestFilter{AgentID: agentID}
	if from := c.Query("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			filter.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			filter.To = t
		}
	}
	bucketMins, _ := strconv.Atoi(c.Query("bucketMins", "5"))

	stats, err := h.reqRepo.RequestStats(filter, bucketMins)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if stats == nil {
		stats = []models.ApiRequestStatBucket{}
	}
	return c.JSON(fiber.Map{"success": true, "data": stats})
}

// requestWindowFilter builds an ApiRequestFilter from optional from/to query params.
func requestWindowFilter(c *fiber.Ctx, base models.ApiRequestFilter) *models.ApiRequestFilter {
	if from := c.Query("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			base.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			base.To = t
		}
	}
	return &base
}

// GetAgentRequestStatusSummary returns the status-class distribution + top 5xx
// endpoint across all of an agent's services. GET /agents/:agentId/request-status-summary
func (h *AgentHandler) GetAgentRequestStatusSummary(c *fiber.Ctx) error {
	filter := requestWindowFilter(c, models.ApiRequestFilter{AgentID: c.Params("agentId")})
	summary, err := h.reqRepo.StatusSummary(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": summary})
}

// GetServiceRequestStatusSummary is the per-service variant.
// GET /agents/:agentId/services/:key/request-status-summary
func (h *AgentHandler) GetServiceRequestStatusSummary(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	service, err := h.repo.GetServiceByKey(agentID, c.Params("key"))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}
	filter := requestWindowFilter(c, models.ApiRequestFilter{AgentID: agentID, ServiceName: service.Name})
	summary, err := h.reqRepo.StatusSummary(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": summary})
}

// GetServiceOtelMetricNames returns the distinct OTLP metrics a service has
// exported, for the metric picker. GET /agents/:agentId/services/:key/otel-metrics
func (h *AgentHandler) GetServiceOtelMetricNames(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	names, err := h.otelMetricRepo.ListNames(&models.OtelMetricFilter{
		AgentID:     agentID,
		ServiceName: service.Name,
	})
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if names == nil {
		names = []models.OtelMetricName{}
	}
	return c.JSON(fiber.Map{"success": true, "data": names})
}

// GetServiceOtelMetricPoints returns data points for one metric.
// GET /agents/:agentId/services/:key/otel-metrics/points?name=...&from=&to=&limit=
func (h *AgentHandler) GetServiceOtelMetricPoints(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")
	name := c.Query("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "VALIDATION_ERROR", "message": "name query parameter is required"},
		})
	}

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	filter := &models.OtelMetricFilter{
		AgentID:     agentID,
		ServiceName: service.Name,
		MetricName:  name,
	}
	if from := c.Query("from"); from != "" {
		if t, err2 := time.Parse(time.RFC3339, from); err2 == nil {
			filter.From = t
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err2 := time.Parse(time.RFC3339, to); err2 == nil {
			filter.To = t
		}
	}
	if limit, _ := strconv.Atoi(c.Query("limit", "0")); limit > 0 {
		filter.Limit = limit
	}

	points, err := h.otelMetricRepo.ListPoints(filter)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if points == nil {
		points = []models.OtelMetric{}
	}
	return c.JSON(fiber.Map{"success": true, "data": points})
}

// representativeMetricPatterns orders metric-name substrings from most
// service-specific to most generic; the first exported metric matching the
// earliest pattern becomes a service's representative "at a glance" metric
// (worker→queue, db→connections, redis/postgres→memory, else cpu).
var representativeMetricPatterns = []string{"queue", "connection", "memory", "cpu"}

func pickRepresentativeMetric(metrics []models.OtelServiceMetric) (models.OtelServiceMetric, bool) {
	for _, pat := range representativeMetricPatterns {
		for _, m := range metrics {
			if strings.Contains(strings.ToLower(m.MetricName), pat) {
				return m, true
			}
		}
	}
	return models.OtelServiceMetric{}, false
}

// GetAgentServiceMetrics returns each service's representative metric (latest
// value) for the project overview cards, keyed by service name.
// GET /agents/:agentId/service-metrics
func (h *AgentHandler) GetAgentServiceMetrics(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	metrics, err := h.otelMetricRepo.LatestValuesByService(agentID, time.Now().Add(-15*time.Minute))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	byService := make(map[string][]models.OtelServiceMetric)
	for _, m := range metrics {
		byService[m.ServiceName] = append(byService[m.ServiceName], m)
	}
	out := make([]models.OtelServiceMetric, 0, len(byService))
	for _, list := range byService {
		if repr, ok := pickRepresentativeMetric(list); ok {
			out = append(out, repr)
		}
	}
	return c.JSON(fiber.Map{"success": true, "data": out})
}

// GetServiceLogFilter returns the per-service ingest log-level filter (empty = accept all).
func (h *AgentHandler) GetServiceLogFilter(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	levels, err := h.repo.GetLogLevelFilterByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"levels": levels}})
}

// SetServiceLogFilter sets which log levels are stored at OTLP ingest for a service.
// An empty list means accept all levels. The filter survives agent re-syncs.
func (h *AgentHandler) SetServiceLogFilter(c *fiber.Ctx) error {
	agentID := c.Params("agentId")
	key := c.Params("key")

	var req struct {
		Levels []string `json:"levels"`
	}
	if err := c.BodyParser(&req); err != nil {
		return agentBadRequest(c, "INVALID_REQUEST", "invalid request body")
	}
	clean := make([]string, 0, len(req.Levels))
	for _, l := range req.Levels {
		if !validLogLevel(l) {
			return agentBadRequest(c, "VALIDATION_ERROR", "invalid log level: "+l)
		}
		clean = append(clean, l)
	}

	service, err := h.repo.GetServiceByKey(agentID, key)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if service == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"error":   fiber.Map{"code": "NOT_FOUND", "message": "service not found"},
		})
	}

	if err := h.repo.SetLogLevelFilter(agentID, key, strings.Join(clean, ",")); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"levels": clean}})
}

func validLogLevel(l string) bool {
	switch models.LogLevel(l) {
	case models.LogLevelError, models.LogLevelWarn, models.LogLevelInfo, models.LogLevelDebug, models.LogLevelTrace:
		return true
	}
	return false
}

func agentBadRequest(c *fiber.Ctx, code, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
		"success": false,
		"error": fiber.Map{
			"code":    code,
			"message": message,
		},
	})
}
