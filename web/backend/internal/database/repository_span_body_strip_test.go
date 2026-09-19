package database_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// Captured bodies age out on their own window; the span that carried them
// stays, so shortening the body window no longer costs trace history.
func TestSpanRepo_StripBodyCaptures(t *testing.T) {
	openTestDB(t)
	repo := database.NewSpanRepository()
	now := time.Now()
	old := now.Add(-10 * 24 * time.Hour)

	events := func(names ...string) json.RawMessage {
		list := make([]map[string]interface{}, 0, len(names))
		for _, name := range names {
			list = append(list, map[string]interface{}{"name": name, "timeUnixNano": 1, "attributes": map[string]interface{}{"body": "secret"}})
		}
		raw, err := json.Marshal(list)
		if err != nil {
			t.Fatalf("marshal events: %v", err)
		}
		return raw
	}

	if _, err := repo.CreateBatch([]models.Span{
		{TraceID: "t-old", SpanID: "s1", Name: "old with bodies", Kind: "SERVER", CreatedAt: old,
			Events: events("request_body_masked", "exception", "response_body_masked")},
		{TraceID: "t-old2", SpanID: "s2", Name: "old without bodies", Kind: "SERVER", CreatedAt: old,
			Events: events("exception")},
		{TraceID: "t-recent", SpanID: "s3", Name: "recent with bodies", Kind: "SERVER", CreatedAt: now.Add(-time.Hour),
			Events: events("request_body_masked", "response_body_masked")},
	}); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	stripped, err := repo.StripBodyCaptures(now.Add(-7 * 24 * time.Hour))
	if err != nil {
		t.Fatalf("StripBodyCaptures: %v", err)
	}
	// Only the old span that actually carried bodies is rewritten.
	if stripped != 1 {
		t.Fatalf("stripped = %d, want 1", stripped)
	}

	eventNames := func(traceID string) []string {
		t.Helper()
		spans, err := repo.GetByTraceID(traceID)
		if err != nil {
			t.Fatalf("GetByTraceID(%s): %v", traceID, err)
		}
		if len(spans) != 1 {
			t.Fatalf("%s: got %d spans, want 1 — the span itself must survive", traceID, len(spans))
		}
		var parsed []map[string]interface{}
		if err := json.Unmarshal(spans[0].Events, &parsed); err != nil {
			t.Fatalf("%s: decode events: %v", traceID, err)
		}
		names := make([]string, 0, len(parsed))
		for _, event := range parsed {
			name, _ := event["name"].(string)
			names = append(names, name)
		}
		return names
	}

	if got := eventNames("t-old"); len(got) != 1 || got[0] != "exception" {
		t.Errorf("old span events = %v, want just [exception]", got)
	}
	// Untouched: no bodies to remove.
	if got := eventNames("t-old2"); len(got) != 1 || got[0] != "exception" {
		t.Errorf("body-free old span events = %v, want [exception]", got)
	}
	// Inside the body window, so the bodies stay.
	if got := eventNames("t-recent"); len(got) != 2 {
		t.Errorf("recent span events = %v, want both bodies kept", got)
	}

	// Idempotent: a second sweep finds nothing left to strip.
	again, err := repo.StripBodyCaptures(now.Add(-7 * 24 * time.Hour))
	if err != nil {
		t.Fatalf("second StripBodyCaptures: %v", err)
	}
	if again != 0 {
		t.Fatalf("second sweep stripped %d, want 0", again)
	}
}
