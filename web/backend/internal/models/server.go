package models

import "time"

// Server owns the directly configured targets: uptime monitors, apps and at
// most one infrastructure resource. Its project is the only source of their group.
type Server struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	ProjectID   string    `json:"projectId,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
