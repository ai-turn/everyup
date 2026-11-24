package models

import "time"

// Server owns the directly configured targets: uptime monitors, apps and at
// most one infrastructure resource. Its name is unique overall (case-insensitive, trimmed).
type Server struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
