package models

import (
	"encoding/json"
	"time"
)

// NotificationChannel represents a configured alert channel
type NotificationChannel struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`   // "telegram" | "discord" | "slack"
	Config    string    `json:"config"` // JSON string
	IsEnabled bool      `json:"isEnabled"`
	CreatedAt time.Time `json:"createdAt"`
}

// NotificationChannelHealth holds aggregated health/usage stats for a channel
type NotificationChannelHealth struct {
	ChannelID    string     `json:"channelId"`
	LastSentAt   *time.Time `json:"lastSentAt,omitempty"`
	SuccessCount int        `json:"successCount"`
	FailedCount  int        `json:"failedCount"`
	RuleCount    int        `json:"ruleCount"`
}

// TelegramConfig holds Telegram bot configuration
type TelegramConfig struct {
	BotToken string `json:"botToken"`
	ChatID   string `json:"chatId"`
}

// DiscordConfig holds Discord webhook configuration
type DiscordConfig struct {
	WebhookURL string `json:"webhookUrl"`
}

// SlackConfig holds Slack incoming webhook configuration
type SlackConfig struct {
	WebhookURL string `json:"webhookUrl"`
}

// NotificationChannelCreateRequest represents the request to create a channel
type NotificationChannelCreateRequest struct {
	Name   string                 `json:"name"`
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

// secretConfigKey is the config field that holds each channel type's secret.
// MaskConfig redacts it and KeepStoredSecret restores it, so they share one list.
var secretConfigKey = map[string]string{
	"telegram": "botToken",
	"discord":  "webhookUrl",
	"slack":    "webhookUrl",
}

const maskedSecret = "***"

// MaskConfig returns a copy of the channel with sensitive config fields redacted.
// Use this before returning channels in API responses.
func (ch *NotificationChannel) MaskConfig() NotificationChannel {
	masked := *ch
	key := secretConfigKey[ch.Type]
	var cfg map[string]interface{}
	if key == "" || json.Unmarshal([]byte(ch.Config), &cfg) != nil {
		return masked
	}
	if v, _ := cfg[key].(string); v != "" {
		cfg[key] = maskedSecret
	}
	if b, err := json.Marshal(cfg); err == nil {
		masked.Config = string(b)
	}
	return masked
}

// KeepStoredSecret fills the request's secret from the stored channel when the
// client sent it back empty or masked. The edit form never sees the real secret,
// so saving without retyping it must not overwrite it. A type change has nothing
// to fall back on and is left for validation to reject.
func (ch *NotificationChannel) KeepStoredSecret(req *NotificationChannelCreateRequest) {
	key := secretConfigKey[req.Type]
	if key == "" || req.Type != ch.Type {
		return
	}
	if v, _ := req.Config[key].(string); v != "" && v != maskedSecret {
		return
	}
	var stored map[string]interface{}
	if json.Unmarshal([]byte(ch.Config), &stored) != nil {
		return
	}
	if req.Config == nil {
		req.Config = map[string]interface{}{}
	}
	req.Config[key] = stored[key]
}
