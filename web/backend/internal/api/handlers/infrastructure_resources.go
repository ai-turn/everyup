package handlers

import (
	"errors"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/infrastructure"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

const (
	ErrCodeInfrastructureNotFound = "INFRASTRUCTURE_RESOURCE_NOT_FOUND"
)

type InfrastructureResourceHandler struct {
	manager *infrastructure.Manager
}

func NewInfrastructureResourceHandler() *InfrastructureResourceHandler {
	return &InfrastructureResourceHandler{manager: infrastructure.NewManager()}
}

func infrastructureError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, infrastructure.ErrNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": ErrCodeInfrastructureNotFound, "message": "infrastructure resource not found"}})
	case errors.Is(err, infrastructure.ErrInvalidInput):
		return agentBadRequest(c, ErrCodeValidation, err.Error())
	case errors.Is(err, database.ErrServerMissing), errors.Is(err, database.ErrServerNameTaken),
		errors.Is(err, database.ErrServerHasInfrastructure), errors.Is(err, database.ErrInfrastructureSourceRequired):
		return serverWriteError(c, err)
	default:
		return internalError(c, ErrCodeDatabase, err)
	}
}

func (h *InfrastructureResourceHandler) GetAll(c *fiber.Ctx) error {
	resources, err := h.manager.GetAll()
	if err != nil {
		return infrastructureError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": resources})
}

func (h *InfrastructureResourceHandler) GetByID(c *fiber.Ctx) error {
	resource, err := h.manager.GetDirectByID(c.Params("id"))
	if err != nil {
		return infrastructureError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": resource})
}

func (h *InfrastructureResourceHandler) Create(c *fiber.Ctx) error {
	var input models.InfrastructureResourceInput
	if err := c.BodyParser(&input); err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid request body")
	}
	setup, err := h.manager.Create(input)
	if err != nil {
		return infrastructureError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": setup})
}

func (h *InfrastructureResourceHandler) Update(c *fiber.Ctx) error {
	var input models.InfrastructureResourceInput
	if err := c.BodyParser(&input); err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid request body")
	}
	resource, err := h.manager.Update(c.Params("id"), input)
	if err != nil {
		return infrastructureError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": resource})
}

func (h *InfrastructureResourceHandler) RotateKey(c *fiber.Ctx) error {
	setup, err := h.manager.RotateKey(c.Params("id"))
	if err != nil {
		return infrastructureError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": setup})
}

func (h *InfrastructureResourceHandler) RevokeKey(c *fiber.Ctx) error {
	resource, err := h.manager.RevokeKey(c.Params("id"))
	if err != nil {
		return infrastructureError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": resource})
}

func (h *InfrastructureResourceHandler) Delete(c *fiber.Ctx) error {
	if err := h.manager.Delete(c.Params("id")); err != nil {
		return infrastructureError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
