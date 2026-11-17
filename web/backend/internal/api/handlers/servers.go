package handlers

import (
	"database/sql"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/database"
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

func (h *ServerHandler) GetAll(c *fiber.Ctx) error {
	servers, err := h.repo.GetAll()
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
		return projectNotFound(c)
	}
	return c.JSON(fiber.Map{"success": true, "data": server})
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
	case errors.Is(err, database.ErrServerNameTaken):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"success": false, "error": fiber.Map{
			"code": "SERVER_NAME_TAKEN", "message": err.Error(),
		}})
	}
	return internalError(c, "DATABASE_ERROR", err)
}
