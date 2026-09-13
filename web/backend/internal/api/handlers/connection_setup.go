package handlers

import (
	"database/sql"
	"errors"
	"log"

	"github.com/aiturn/everyup/internal/api/middleware"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

func (h *SettingsHandler) Connection(c *fiber.Ctx) error {
	publicURL := ""
	if cfg := config.Get(); cfg != nil {
		publicURL = cfg.Server.PublicURL
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{"publicUrl": publicURL}})
}

func setupError(c *fiber.Ctx, err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return c.Status(404).JSON(fiber.Map{"success": false, "error": fiber.Map{"code": ErrCodeNotFound}})
	}
	return internalError(c, ErrCodeDatabase, err)
}

func (h *AgentHandler) UpdateProfile(c *fiber.Ctx) error {
	var requested models.AgentProfile
	if err := c.BodyParser(&requested); err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, "invalid profile")
	}
	profile, err := normalizeAgentProfile(requested)
	if err != nil {
		return agentBadRequest(c, ErrCodeInvalidRequest, err.Error())
	}
	repo := database.ConnectionSetupRepository{}
	if err := repo.UpdateProfile(c.Params("agentId"), profile); err != nil {
		return setupError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": profile})
}

func (h *AgentHandler) SetupStatus(c *fiber.Ctx) error {
	repo := database.ConnectionSetupRepository{}
	status, err := repo.Status(c.Params("agentId"))
	if err != nil {
		return setupError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": status})
}

func (h *ObservedServiceHandler) SetupStatus(c *fiber.Ctx) error {
	if _, err := h.manager.GetByID(c.Params("id")); err != nil {
		return observedServiceError(c, err)
	}
	repo := database.ConnectionSetupRepository{}
	signals, err := repo.Receipts("direct", c.Params("id"))
	if err != nil {
		return setupError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": signals})
}

func (h *InfrastructureResourceHandler) SetupStatus(c *fiber.Ctx) error {
	if _, err := h.manager.GetDirectByID(c.Params("id")); err != nil {
		return infrastructureError(c, err)
	}
	repo := database.ConnectionSetupRepository{}
	signals, err := repo.Receipts("infrastructure", c.Params("id"))
	if err != nil {
		return setupError(c, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": signals})
}

func recordReceipt(principal *middleware.IngestPrincipal, name, signal string) {
	kind, id := "direct", principal.ServiceID
	if principal.AgentID != "" {
		kind, id = "agent", principal.AgentID
	}
	if principal.InfrastructureResourceID != "" {
		kind, id = "infrastructure", principal.InfrastructureResourceID
	}
	if id == "" {
		return
	}
	repo := database.ConnectionSetupRepository{}
	if err := repo.Record(kind, id, name, signal); err != nil {
		log.Printf("record telemetry receipt: %v", err)
	}
}
