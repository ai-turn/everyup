package state

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestStoreLoadMissingReturnsEmptySnapshot(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "missing.json"))

	snapshot, err := store.Load()
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if snapshot.Version != 2 {
		t.Fatalf("Version = %d, want 2", snapshot.Version)
	}
	if len(snapshot.Targets) != 0 {
		t.Fatalf("Targets length = %d, want 0", len(snapshot.Targets))
	}
}

func TestStoreSaveAndLoadRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state", "agent-state.json")
	store := NewStore(path)
	now := time.Now().UTC().Truncate(time.Second)

	err := store.Save(Snapshot{
		Targets: map[string]TargetState{
			"target-1": {
				LastAlertAt: now,
				WasHealthy:  false,
				SeenResult:  true,
				UpdatedAt:   now,
			},
		},
	})
	if err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	loaded, err := store.Load()
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	state := loaded.Targets["target-1"]
	if !state.LastAlertAt.Equal(now) {
		t.Fatalf("LastAlertAt = %s, want %s", state.LastAlertAt, now)
	}
	if state.WasHealthy {
		t.Fatal("WasHealthy = true, want false")
	}
	if !state.SeenResult {
		t.Fatal("SeenResult = false, want true")
	}
}

func TestStoreCanReplaceExistingStateFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "agent-state.json")
	store := NewStore(path)

	if err := store.Save(Snapshot{Targets: map[string]TargetState{"one": {SeenResult: true}}}); err != nil {
		t.Fatalf("first Save returned error: %v", err)
	}
	if err := store.Save(Snapshot{Targets: map[string]TargetState{"two": {SeenResult: true}}}); err != nil {
		t.Fatalf("second Save returned error: %v", err)
	}

	loaded, err := store.Load()
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if _, ok := loaded.Targets["one"]; ok {
		t.Fatal("old target should have been replaced")
	}
	if _, ok := loaded.Targets["two"]; !ok {
		t.Fatal("new target missing")
	}
}

func TestAuditLoggerAppendWritesJSONLines(t *testing.T) {
	path := filepath.Join(t.TempDir(), "audit", "audit.jsonl")
	logger := NewAuditLogger(path)

	err := logger.Append(AuditEvent{
		Time:        time.Date(2026, 6, 18, 1, 2, 3, 0, time.UTC),
		Type:        "alert_sent",
		ServiceName: "api",
		TargetKey:   "target-1",
		Message:     "sent",
	})
	if err != nil {
		t.Fatalf("Append returned error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile returned error: %v", err)
	}
	text := string(data)
	if !strings.Contains(text, `"type":"alert_sent"`) {
		t.Fatalf("audit log missing type: %s", text)
	}
	if !strings.HasSuffix(text, "\n") {
		t.Fatal("audit log should end with newline")
	}
}

func TestAuditLoggerTailOffset(t *testing.T) {
	logger := NewAuditLogger(filepath.Join(t.TempDir(), "audit.jsonl"))
	for _, message := range []string{"first", "second", "third"} {
		if err := logger.Append(AuditEvent{Type: "alert_sent", Message: message}); err != nil {
			t.Fatal(err)
		}
	}
	offset, err := logger.TailOffset(2)
	if err != nil {
		t.Fatal(err)
	}
	events, _, err := logger.ReadBatch(offset, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 2 || events[0].Message != "second" || events[1].Message != "third" {
		t.Fatalf("tail events = %+v, want second and third", events)
	}
}
