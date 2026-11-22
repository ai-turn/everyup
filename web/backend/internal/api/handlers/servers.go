package handlers

import (
	"database/sql"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/directtelemetry"
	"github.com/aiturn/everyup/internal/infrastructure"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ServerHandler struct {
	repo      *database.ServerRepository
	projects  *database.ProjectRepository
	scheduler *checker.Scheduler
}

func NewServerHandler(scheduler *checker.Scheduler) *ServerHandler {
	return &ServerHandler{
		repo:      database.NewServerRepository(),
		projects:  database.NewProjectRepository(),
		scheduler: scheduler,
	}
}

// GetAll lists the servers. ?include=docker adds the servers that are Docker environments
// (ADR 0012); the screens join their Docker Collector from GET /agents by serverId.
func (h *ServerHandler) GetAll(c *fiber.Ctx) error {
	servers, err := h.repo.GetAll(c.Query("include") == "docker")
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": servers})
}

func (h *ServerHandler) GetByID(c *fiber.Ctx) error {
	server, err := h.repo.GetByID(c.Params("id"))
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if server == nil {
		return serverNotFound(c)
	}
	return c.JSON(fiber.Map{"success": true, "data": server})
}

func serverNotFound(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{
		"code": "NOT_FOUND", "message": "server not found",
	}})
}

func (h *ServerHandler) Create(c *fiber.Ctx) error {
	server, invalid, err := h.serverFromRequest(c, uuid.NewString())
	if invalid != "" {
		return agentBadRequest(c, "VALIDATION_ERROR", invalid)
	}
	if err == nil {
		err = h.repo.Create(server)
	}
	if err != nil {
		return serverWriteError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": server})
}

// Update replaces the whole server: an omitted projectId clears the group.
func (h *ServerHandler) Update(c *fiber.Ctx) error {
	server, invalid, err := h.serverFromRequest(c, c.Params("id"))
	if invalid != "" {
		return agentBadRequest(c, "VALIDATION_ERROR", invalid)
	}
	if err == nil {
		err = h.repo.Update(server)
	}
	if err != nil {
		return serverWriteError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": server})
}

// Delete removes the server together with its targets and their data.
// Each target delete path runs its own transaction, so a failure part-way
// leaves the targets already deleted gone.
func (h *ServerHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	// A Docker environment's server goes away when its Docker Collector is deactivated
	// (DELETE /agents/:id); deleting it here would orphan the Docker Collector.
	if hasDocker, err := h.repo.HasDocker(id); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	} else if hasDocker {
		return serverWriteError(c, database.ErrServerHasDocker)
	}
	targets, err := h.repo.Targets(id)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	monitors := database.NewServiceRepository()
	for _, monitorID := range targets.MonitorIDs {
		if err := deleteMonitor(monitors, h.scheduler, monitorID); err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
	}
	apps := directtelemetry.NewManager()
	for _, appID := range targets.ObservedServiceIDs {
		if err := apps.Delete(appID); err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
	}
	if targets.InfrastructureID != "" {
		if err := infrastructure.NewManager().Delete(targets.InfrastructureID); err != nil {
			return internalError(c, "DATABASE_ERROR", err)
		}
	}
	if err := h.repo.DeleteEmpty(id); err != nil {
		return serverWriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Merge moves every target of the server, its Docker Collector included, into targetServerId and
// deletes it. infrastructure ("docker" or "otel") chooses the host metrics source when both would remain.
func (h *ServerHandler) Merge(c *fiber.Ctx) error {
	var request struct {
		TargetServerID string `json:"targetServerId"`
		Infrastructure string `json:"infrastructure"`
	}
	if err := c.BodyParser(&request); err != nil {
		return agentBadRequest(c, "VALIDATION_ERROR", err.Error())
	}
	sourceID := c.Params("id")
	if request.TargetServerID == "" || request.TargetServerID == sourceID {
		return agentBadRequest(c, "VALIDATION_ERROR", "targetServerId is required and must differ from the server")
	}
	if request.Infrastructure != "" && request.Infrastructure != database.MergeInfrastructureDocker && request.Infrastructure != database.MergeInfrastructureOTel {
		return agentBadRequest(c, "VALIDATION_ERROR", "infrastructure must be docker or otel")
	}
	if err := h.repo.Merge(sourceID, request.TargetServerID, request.Infrastructure); err != nil {
		if errors.Is(err, database.ErrServerMissing) {
			return serverNotFound(c)
		}
		return serverWriteError(c, err)
	}
	server, err := h.repo.GetByID(request.TargetServerID)
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	if server == nil {
		return serverNotFound(c)
	}
	return c.JSON(fiber.Map{"success": true, "data": server})
}

// serverFromRequest returns a validation message when the body is invalid.
func (h *ServerHandler) serverFromRequest(c *fiber.Ctx, id string) (*models.Server, string, error) {
	var request struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ProjectID   string `json:"projectId"`
	}
	if err := c.BodyParser(&request); err != nil {
		return nil, err.Error(), nil
	}
	name := strings.TrimSpace(request.Name)
	if name == "" || utf8.RuneCountInString(name) > 200 {
		return nil, "name is required and must be at most 200 characters", nil
	}
	if request.ProjectID != "" {
		ok, err := h.projects.Exists(request.ProjectID)
		if err != nil {
			return nil, "", err
		}
		if !ok {
			return nil, "group not found", nil
		}
	}
	return &models.Server{ID: id, Name: name, Description: strings.TrimSpace(request.Description), ProjectID: request.ProjectID}, "", nil
}

func serverWriteError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return projectNotFound(c)
	case errors.Is(err, database.ErrServerMissing):
		return agentBadRequest(c, "VALIDATION_ERROR", "server not found")
	case errors.Is(err, database.ErrServerNameTaken):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "error": fiber.Map{
			"code": "SERVER_NAME_TAKEN", "message": err.Error(),
		}})
	case errors.Is(err, database.ErrServerHasInfrastructure):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "error": fiber.Map{
			"code": "SERVER_HAS_INFRASTRUCTURE", "message": err.Error(),
		}})
	case errors.Is(err, database.ErrServerHasTwoDocker):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "error": fiber.Map{
			"code": "SERVER_HAS_TWO_DOCKER", "message": err.Error(),
		}})
	case errors.Is(err, database.ErrInfrastructureSourceRequired):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "error": fiber.Map{
			"code": "INFRASTRUCTURE_SOURCE_REQUIRED", "message": err.Error(),
		}})
	case errors.Is(err, database.ErrServerHasDocker):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "error": fiber.Map{
			"code": "SERVER_HAS_DOCKER", "message": err.Error(),
		}})
	}
	return internalError(c, "DATABASE_ERROR", err)
}

// SameHostDismissals lists the server pairs a user said are not the same host (ADR 0012).
func (h *ServerHandler) SameHostDismissals(c *fiber.Ctx) error {
	pairs, err := h.repo.SameHostDismissals()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": pairs})
}

// DismissSameHost records that a Docker server and a server are not the same host.
func (h *ServerHandler) DismissSameHost(c *fiber.Ctx) error {
	var pair database.SameHostDismissal
	if err := c.BodyParser(&pair); err != nil || pair.DockerServerID == "" || pair.ServerID == "" || pair.DockerServerID == pair.ServerID {
		return agentBadRequest(c, "VALIDATION_ERROR", "dockerServerId and serverId are required and must differ")
	}
	if err := h.repo.DismissSameHost(pair); err != nil {
		return serverWriteError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": pair})
}

