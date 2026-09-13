package models

import "time"

type InstrumentationTarget struct {
	Key     string `json:"key"`
	Name    string `json:"name"`
	Runtime string `json:"runtime"`
}

type InstrumentationRun struct {
	ID            string                  `json:"id"`
	AgentID       string                  `json:"agentId"`
	Project       string                  `json:"project"`
	Targets       []InstrumentationTarget `json:"targets"`
	CaptureBodies bool                    `json:"captureBodies"`
	Status        string                  `json:"status"`
	Reason        string                  `json:"reason"`
	CreatedAt     time.Time               `json:"createdAt"`
	UpdatedAt     time.Time               `json:"updatedAt"`
	StartedAt     *time.Time              `json:"startedAt,omitempty"`
	Signals       []SignalReceipt         `json:"signals"`
}
