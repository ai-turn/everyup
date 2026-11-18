package handlers

import (
	"database/sql"
	"strings"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ProjectHandler struct{ repo *database.ProjectRepository }

func NewProjectHandler() *ProjectHandler {
	return &ProjectHandler{repo: database.NewProjectRepository()}
}

func (h *ProjectHandler) GetAll(c *fiber.Ctx) error {
	projects, err := h.repo.GetAll()
	if err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": projects})
}

func (h *ProjectHandler) Create(c *fiber.Ctx) error {
	project, err := projectFromRequest(c, "")
	if err != nil {
		return agentBadRequest(c, "VALIDATION_ERROR", err.Error())
	}
	project.ID = uuid.NewString()
	if err := h.repo.Create(project); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": project})
}

func (h *ProjectHandler) Update(c *fiber.Ctx) error {
	project, err := projectFromRequest(c, c.Params("projectId"))
	if err != nil {
		return agentBadRequest(c, "VALIDATION_ERROR", err.Error())
	}
	if err := h.repo.Update(project); err != nil {
		if err == sql.ErrNoRows {
			return projectNotFound(c)
		}
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": project})
}

func (h *ProjectHandler) Delete(c *fiber.Ctx) error {
	if err := h.repo.Delete(c.Params("projectId")); err != nil {
		if err == sql.ErrNoRows {
			return projectNotFound(c)
		}
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ProjectHandler) AssignAgent(c *fiber.Ctx) error {
	if ok, err := h.repo.Exists(c.Params("projectId")); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	} else if !ok {
		return projectNotFound(c)
	}
	if err := h.repo.AssignAgent(c.Params("projectId"), c.Params("agentId")); err != nil {
		if err == sql.ErrNoRows {
			return agentBadRequest(c, "NOT_FOUND", "Docker environment not found")
		}
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"projectId": c.Params("projectId")}})
}

func (h *ProjectHandler) UnassignAgent(c *fiber.Ctx) error {
	if ok, err := h.repo.Exists(c.Params("projectId")); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	} else if !ok {
		return projectNotFound(c)
	}
	if err := h.repo.AssignAgent("", c.Params("agentId")); err != nil {
		if err == sql.ErrNoRows {
			return agentBadRequest(c, "NOT_FOUND", "Docker environment not found")
		}
		return internalError(c, "DATABASE_ERROR", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ProjectHandler) AssignMonitor(c *fiber.Ctx) error {
	if ok, err := h.repo.Exists(c.Params("projectId")); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	} else if !ok {
		return projectNotFound(c)
	}
	if err := h.repo.AssignMonitor(c.Params("projectId"), c.Params("monitorId")); err != nil {
		if err == sql.ErrNoRows {
			return agentBadRequest(c, "NOT_FOUND", "uptime monitor not found")
		}
		return serverWriteError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"projectId": c.Params("projectId")}})
}

func (h *ProjectHandler) UnassignMonitor(c *fiber.Ctx) error {
	if ok, err := h.repo.Exists(c.Params("projectId")); err != nil {
		return internalError(c, "DATABASE_ERROR", err)
	} else if !ok {
		return projectNotFound(c)
	}
	if err := h.repo.AssignMonitor("", c.Params("monitorId")); err != nil {
		if err == sql.ErrNoRows {
			return agentBadRequest(c, "NOT_FOUND", "uptime monitor not found")
		}
		return serverWriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func projectFromRequest(c *fiber.Ctx, id string) (*models.Project, error) {
	var request struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&request); err != nil {
		return nil, err
	}
	request.Name = strings.TrimSpace(request.Name)
	if request.Name == "" {
		return nil, fiber.NewError(fiber.StatusBadRequest, "name is required")
	}
	return &models.Project{ID: id, Name: request.Name, Description: strings.TrimSpace(request.Description)}, nil
}

func projectNotFound(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": "NOT_FOUND"}})
}
