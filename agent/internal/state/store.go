package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type TargetState struct {
	ServiceName     string    `json:"serviceName,omitempty"`
	CheckType       string    `json:"checkType,omitempty"`
	Endpoint        string    `json:"endpoint,omitempty"`
	LastAlertAt     time.Time `json:"lastAlertAt,omitempty"`
	LastHostAlertAt time.Time `json:"lastHostAlertAt,omitempty"`
	LastDockerLogAt time.Time `json:"lastDockerLogAt,omitempty"`
	WasHealthy      bool      `json:"wasHealthy"`
	SeenResult      bool      `json:"seenResult"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type Snapshot struct {
	Version    int                    `json:"version"`
	Targets    map[string]TargetState `json:"targets"`
	LogCursors map[string]LogCursor   `json:"logCursors,omitempty"`
}

// Count distinguishes separate records sharing the cursor's timestamp.
// Container IDs, not service identities, key these cursors.
type LogCursor struct {
	At    time.Time `json:"at"`
	Count int       `json:"count"`
}

type Store struct {
	path string
	mu   sync.Mutex
}

func NewStore(path string) *Store {
	return &Store{path: path}
}

func (s *Store) Load() (Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.path == "" {
		return emptySnapshot(), nil
	}

	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return emptySnapshot(), nil
	}
	if err != nil {
		return Snapshot{}, fmt.Errorf("read state file: %w", err)
	}
	if len(data) == 0 {
		return emptySnapshot(), nil
	}

	var snapshot Snapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return Snapshot{}, fmt.Errorf("decode state file: %w", err)
	}
	if snapshot.Targets == nil {
		snapshot.Targets = make(map[string]TargetState)
	}
	if snapshot.Version == 0 {
		snapshot.Version = 1
	}
	return snapshot, nil
}

func (s *Store) Save(snapshot Snapshot) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.path == "" {
		return nil
	}

	if snapshot.Version == 0 {
		snapshot.Version = 1
	}
	if snapshot.Targets == nil {
		snapshot.Targets = make(map[string]TargetState)
	}

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return fmt.Errorf("create state directory: %w", err)
	}

	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return fmt.Errorf("encode state file: %w", err)
	}

	tmp, err := os.CreateTemp(filepath.Dir(s.path), filepath.Base(s.path)+".*.tmp")
	if err != nil {
		return fmt.Errorf("create temp state file: %w", err)
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write temp state file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temp state file: %w", err)
	}
	if err := os.Rename(tmpName, s.path); err != nil {
		if removeErr := os.Remove(s.path); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			return fmt.Errorf("replace state file: %w", err)
		}
		if retryErr := os.Rename(tmpName, s.path); retryErr != nil {
			return fmt.Errorf("replace state file: %w", retryErr)
		}
	}
	return nil
}

func emptySnapshot() Snapshot {
	return Snapshot{
		Version: 1,
		Targets: make(map[string]TargetState),
	}
}
