package handlers

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// NotificationHandler handles notification channel operations
type NotificationHandler struct {
	repo    *database.NotificationRepository
	manager *alerter.Manager
}

// NewNotificationHandler creates a new notification handler
func NewNotificationHandler() *NotificationHandler {
	return &NotificationHandler{
		repo:    database.NewNotificationRepository(),
		manager: alerter.NewManager(),
	}
}

func testNotificationPayload() alerter.Notification {
	return alerter.Notification{
		ServiceID:   "test",
		ServiceName: "Notification Test",
		Status:      models.StatusHealthy,
		Message:     "This is a test notification. Your EVERYUP notification channel is connected correctly.",
		Time:        time.Now(),
	}
}

func validateNotificationChannelRequest(req models.NotificationChannelCreateRequest) error {
	if req.Name == "" {
		return fmt.Errorf("channel name is required")
	}
	if req.Type != "telegram" && req.Type != "discord" && req.Type != "slack" {
		return fmt.Errorf("type must be 'telegram', 'discord', or 'slack'")
	}

	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return fmt.Errorf("invalid configuration")
	}

	switch req.Type {
	case "telegram":
		var cfg models.TelegramConfig
		if err := json.Unmarshal(configJSON, &cfg); err != nil {
			return fmt.Errorf("invalid Telegram configuration")
		}
		if cfg.BotToken == "" {
			return fmt.Errorf("Telegram bot token is required")
		}
		if cfg.ChatID == "" {
			return fmt.Errorf("Telegram chat ID is required")
		}
	case "discord":
		var cfg models.DiscordConfig
		if err := json.Unmarshal(configJSON, &cfg); err != nil {
			return fmt.Errorf("invalid Discord configuration")
		}
		if cfg.WebhookURL == "" {
			return fmt.Errorf("Discord webhook URL is required")
		}
	case "slack":
		var cfg models.SlackConfig
		if err := json.Unmarshal(configJSON, &cfg); err != nil {
			return fmt.Errorf("invalid Slack configuration")
		}
		if cfg.WebhookURL == "" {
			return fmt.Errorf("Slack webhook URL is required")
		}
	}

	return validateChannelWebhookURL(req.Type, configJSON)
}

func providerFromChannel(channelType string, configJSON []byte) (alerter.AlertProvider, error) {
	switch channelType {
	case "discord":
		var config models.DiscordConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			return nil, fmt.Errorf("invalid Discord configuration")
		}
		return alerter.NewDiscordProvider(config.WebhookURL), nil

	case "telegram":
		var config models.TelegramConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			return nil, fmt.Errorf("invalid Telegram configuration")
		}
		return alerter.NewTelegramProvider(config.BotToken, config.ChatID), nil

	case "slack":
		var config models.SlackConfig
		if err := json.Unmarshal(configJSON, &config); err != nil {
			return nil, fmt.Errorf("invalid Slack configuration")
		}
		return alerter.NewSlackProvider(config.WebhookURL), nil
	}

	return nil, fmt.Errorf("unsupported channel type: %s", channelType)
}

func sendTestNotification(c *fiber.Ctx, provider alerter.AlertProvider) error {
	if err := provider.Send(testNotificationPayload()); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "SEND_ERROR",
				"message": err.Error(),
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"message": "Test notification sent successfully",
		},
	})
}

// GetHealth returns per-channel usage/health stats over the last `days` (default 7).
// GET /notification-channels/health?days=7
func (h *NotificationHandler) GetHealth(c *fiber.Ctx) error {
	days := 7
	if d := c.Query("days"); d != "" {
		if v, err := strconv.Atoi(d); err == nil && v > 0 && v <= 90 {
			days = v
		}
	}

	stats, err := h.repo.GetHealth(days)
	if err != nil {
		return internalError(c, ErrCodeFetch, err)
	}

	out := make([]*models.NotificationChannelHealth, 0, len(stats))
	for _, v := range stats {
		out = append(out, v)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    out,
	})
}

// GetAll returns all notification channels
func (h *NotificationHandler) GetAll(c *fiber.Ctx) error {
	channels, err := h.repo.GetAll()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch notification channels",
			},
		})
	}

	masked := make([]models.NotificationChannel, len(channels))
	for i := range channels {
		masked[i] = channels[i].MaskConfig()
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    masked,
	})
}

// Create creates a new notification channel
func (h *NotificationHandler) Create(c *fiber.Ctx) error {
	var req models.NotificationChannelCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}

	if err := validateNotificationChannelRequest(req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
	}

	// Marshal config to JSON
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_CONFIG",
				"message": "Invalid configuration",
			},
		})
	}

	channel := &models.NotificationChannel{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Type:      req.Type,
		Config:    string(configJSON),
		IsEnabled: true,
		CreatedAt: time.Now(),
	}

	if err := h.repo.Create(channel); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "CREATE_ERROR",
				"message": "Failed to create notification channel",
			},
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"success": true,
		"data":    channel.MaskConfig(),
	})
}

// Test sends a test notification
func (h *NotificationHandler) Test(c *fiber.Ctx) error {
	id := c.Params("id")

	channel, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch channel",
			},
		})
	}

	if channel == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Channel not found",
			},
		})
	}

	provider, err := providerFromChannel(channel.Type, []byte(channel.Config))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_CONFIG",
				"message": err.Error(),
			},
		})
	}

	return sendTestNotification(c, provider)
}

// TestConfig sends a test notification using the submitted configuration without saving it.
func (h *NotificationHandler) TestConfig(c *fiber.Ctx) error {
	var req models.NotificationChannelCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}

	// Testing an edit before saving: the form leaves the secret empty, so fill it
	// from the stored channel the same way Update does.
	if id := c.Query("channelId"); id != "" {
		if stored, err := h.repo.GetByID(id); err == nil && stored != nil {
			stored.KeepStoredSecret(&req)
		}
	}

	if err := validateNotificationChannelRequest(req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
	}

	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_CONFIG",
				"message": "Invalid configuration",
			},
		})
	}

	provider, err := providerFromChannel(req.Type, configJSON)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_CONFIG",
				"message": err.Error(),
			},
		})
	}

	return sendTestNotification(c, provider)
}

// Update updates a notification channel
func (h *NotificationHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")

	channel, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch channel",
			},
		})
	}

	if channel == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Channel not found",
			},
		})
	}

	var req models.NotificationChannelCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request body",
			},
		})
	}

	channel.KeepStoredSecret(&req)

	if err := validateNotificationChannelRequest(req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
	}

	// Marshal config to JSON
	configJSON, err := json.Marshal(req.Config)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "INVALID_CONFIG",
				"message": "Invalid configuration",
			},
		})
	}

	channel.Name = req.Name
	channel.Type = req.Type
	channel.Config = string(configJSON)

	if err := h.repo.Update(channel); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "UPDATE_ERROR",
				"message": "Failed to update notification channel",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    channel.MaskConfig(),
	})
}

// Toggle toggles the enabled state of a notification channel
func (h *NotificationHandler) Toggle(c *fiber.Ctx) error {
	id := c.Params("id")

	channel, err := h.repo.GetByID(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "FETCH_ERROR",
				"message": "Failed to fetch channel",
			},
		})
	}

	if channel == nil {
		return c.Status(404).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "NOT_FOUND",
				"message": "Channel not found",
			},
		})
	}

	newState := !channel.IsEnabled
	if err := h.repo.SetEnabled(id, newState); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "TOGGLE_ERROR",
				"message": "Failed to toggle notification channel",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"id":        id,
			"isEnabled": newState,
		},
	})
}

// Delete deletes a notification channel
func (h *NotificationHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	if err := h.repo.Delete(id); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error": fiber.Map{
				"code":    "DELETE_ERROR",
				"message": "Failed to delete notification channel",
			},
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Notification channel deleted successfully",
	})
}

// validateChannelWebhookURL extracts and validates webhook URLs from channel config JSON.
func validateChannelWebhookURL(channelType string, configJSON []byte) error {
	switch channelType {
	case "discord":
		var cfg models.DiscordConfig
		if err := json.Unmarshal(configJSON, &cfg); err != nil {
			return nil // config parse errors are handled elsewhere
		}
		return alerter.ValidateWebhookURL("discord", cfg.WebhookURL)
	case "slack":
		var cfg models.SlackConfig
		if err := json.Unmarshal(configJSON, &cfg); err != nil {
			return nil
		}
		if cfg.WebhookURL != "" {
			return alerter.ValidateWebhookURL("slack", cfg.WebhookURL)
		}
	}
	return nil
}
