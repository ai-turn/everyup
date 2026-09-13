package handlers

import (
	"database/sql"
	"errors"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

var composeIdentifier = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

func (h *AgentHandler) CreateInstrumentationRun(c *fiber.Ctx) error {
	var input struct {
		Project       string   `json:"project"`
		Keys          []string `json:"keys"`
		CaptureBodies bool     `json:"captureBodies"`
	}
	if err := c.BodyParser(&input); err != nil || !composeIdentifier.MatchString(input.Project) || len(input.Keys) == 0 || len(input.Keys) > 100 {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid selection")
	}
	services, err := h.repo.GetServices(c.Params("agentId"))
	if err != nil {
		return setupError(c, err)
	}
	run := models.InstrumentationRun{ID: uuid.NewString(), AgentID: c.Params("agentId"), Project: input.Project, CaptureBodies: input.CaptureBodies, CreatedAt: time.Now()}
	seen := map[string]bool{}
	for _, key := range input.Keys {
		parts := strings.SplitN(key, ":", 2)
		if seen[key] || len(parts) != 2 || parts[0] != input.Project || !composeIdentifier.MatchString(parts[1]) {
			return agentBadRequest(c, ErrCodeInvalidRequest, "invalid target")
		}
		seen[key] = true
		found := false
		for _, service := range services {
			if service.Key == key && (service.Runtime == "java" || service.Runtime == "node") {
				run.Targets = append(run.Targets, models.InstrumentationTarget{Key: key, Name: service.Name, Runtime: service.Runtime})
				found = true
				break
			}
		}
		if !found {
			return agentBadRequest(c, ErrCodeInvalidRequest, "target not discovered or unsupported")
		}
	}
	repo := database.InstrumentationRepository{}
	if err := repo.Create(run); err != nil {
		return setupError(c, err)
	}
	result, err := repo.Get(run.AgentID, run.ID)
	if err != nil {
		return setupError(c, err)
	}
	return c.Status(201).JSON(fiber.Map{"success": true, "data": result})
}

func (h *AgentHandler) GetInstrumentationRun(c *fiber.Ctx) error {
	run, err := (&database.InstrumentationRepository{}).Get(c.Params("agentId"), c.Params("runId"))
	if err != nil {
		if c.Params("runId") == "latest" && errors.Is(err, sql.ErrNoRows) {
			return c.JSON(fiber.Map{"success": true, "data": nil})
		}
		return setupError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": run})
}

func (h *AgentHandler) ReportInstrumentationRun(c *fiber.Ctx) error {
	if authorized, err := h.requireAgentKey(c); !authorized || err != nil {
		return err
	}
	var input struct {
		Status        string `json:"status"`
		Reason        string `json:"reason"`
		Project       string `json:"project"`
		Targets       string `json:"targets"`
		CaptureBodies bool   `json:"captureBodies"`
	}
	if err := c.BodyParser(&input); err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid report")
	}
	repo := database.InstrumentationRepository{}
	run, err := repo.Get(c.Params("agentId"), c.Params("runId"))
	if err != nil {
		return setupError(c, err)
	}
	expected := []string{}
	for _, target := range run.Targets {
		expected = append(expected, strings.SplitN(target.Key, ":", 2)[1]+"="+target.Runtime)
	}
	actual := strings.Split(input.Targets, ",")
	sort.Strings(expected)
	sort.Strings(actual)
	if input.Project != run.Project || input.CaptureBodies != run.CaptureBodies || strings.Join(actual, ",") != strings.Join(expected, ",") {
		return agentBadRequest(c, ErrCodeInvalidRequest, "report selection mismatch")
	}
	switch input.Reason {
	case "", "preflight_failed", "restart_failed", "verification_failed", "manual_rollback":
	default:
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid reason")
	}
	if err := repo.Report(run.AgentID, run.ID, input.Status, input.Reason); err != nil {
		if errors.Is(err, database.ErrInstrumentationTransition) {
			return agentBadRequest(c, ErrCodeInvalidRequest, "expired or invalid transition")
		}
		return setupError(c, err)
	}
	return c.JSON(fiber.Map{"success": true})
}
