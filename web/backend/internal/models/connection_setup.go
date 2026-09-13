package models

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
	"time"
)

func (p AgentProfile) ConfigHash() string {
	capabilities := append([]string(nil), p.Capabilities...)
	sort.Strings(capabilities)
	hash := sha256.Sum256([]byte(strings.Join(capabilities, ",")))
	return hex.EncodeToString(hash[:])
}

type SignalReceipt struct {
	ServiceName     string    `json:"serviceName"`
	Signal          string    `json:"signal"`
	FirstReceivedAt time.Time `json:"firstReceivedAt"`
	LastReceivedAt  time.Time `json:"lastReceivedAt"`
}

type CollectorSetupStatus struct {
	Connected      bool            `json:"connected"`
	LastContactAt  *time.Time      `json:"lastContactAt,omitempty"`
	LastEnrolledAt *time.Time      `json:"lastEnrolledAt,omitempty"`
	DesiredHash    string          `json:"desiredHash"`
	AppliedHash    string          `json:"appliedHash"`
	ConfigApplied  bool            `json:"configApplied"`
	Profile        AgentProfile    `json:"profile"`
	Signals        []SignalReceipt `json:"signals"`
}
