package database_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// Structured attributes are stored key by key, so they should be filterable
// rather than only reachable through a message substring search.
func TestLogRepo_AttributeFilter(t *testing.T) {
	openTestDB(t)
	repo := database.NewLogRepository()
	now := time.Now()

	create := func(message, attributes string) {
		t.Helper()
		entry := &models.Log{
			AgentID: "agent-x", ServiceName: "api", Level: models.LogLevelInfo,
			Message: message, CreatedAt: now,
		}
		if attributes != "" {
			entry.Attributes = json.RawMessage(attributes)
		}
		if err := repo.Create(entry); err != nil {
			t.Fatalf("Create(%s): %v", message, err)
		}
	}

	create("orders handled", `{"http.route":"/orders","http.status_code":200}`)
	create("orders failed", `{"http.route":"/orders","http.status_code":500}`)
	create("users handled", `{"http.route":"/users","http.status_code":200}`)
	create("no attributes at all", "")

	base := models.LogFilter{AgentID: "agent-x", ServiceName: "api", Limit: 50}

	cases := []struct {
		name     string
		key      string
		value    string
		want     int
		wantMsgs []string
	}{
		// A dotted key must not be read as a nested JSON path.
		{name: "dotted key", key: "http.route", value: "/orders", want: 2},
		// json_extract returns an integer here; the caller sends text.
		{name: "numeric value", key: "http.status_code", value: "500", want: 1, wantMsgs: []string{"orders failed"}},
		{name: "no match", key: "http.route", value: "/missing", want: 0},
		{name: "unknown key", key: "nope.nope", value: "x", want: 0},
		// An empty key is not a filter — it must not silently drop rows.
		{name: "empty key ignored", key: "", value: "", want: 4},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			filter := base
			filter.AttrKey = tc.key
			filter.AttrValue = tc.value
			logs, total, err := repo.GetAll(filter)
			if err != nil {
				t.Fatalf("GetAll: %v", err)
			}
			if len(logs) != tc.want || total != tc.want {
				t.Fatalf("got %d rows (total %d), want %d", len(logs), total, tc.want)
			}
			for i, msg := range tc.wantMsgs {
				if logs[i].Message != msg {
					t.Errorf("row %d = %q, want %q", i, logs[i].Message, msg)
				}
			}
		})
	}

	t.Run("combines with level and search", func(t *testing.T) {
		filter := base
		filter.AttrKey = "http.route"
		filter.AttrValue = "/orders"
		filter.Search = "failed"
		logs, total, err := repo.GetAll(filter)
		if err != nil {
			t.Fatalf("GetAll: %v", err)
		}
		if total != 1 || len(logs) != 1 || logs[0].Message != "orders failed" {
			t.Fatalf("got %d rows %+v, want just the failed one", total, logs)
		}
	})

	t.Run("histogram follows the same filter", func(t *testing.T) {
		filter := base
		filter.AttrKey = "http.route"
		filter.AttrValue = "/orders"
		buckets, err := repo.Histogram(filter, 60)
		if err != nil {
			t.Fatalf("Histogram: %v", err)
		}
		counted := 0
		for _, bucket := range buckets {
			counted += bucket.Info
		}
		if counted != 2 {
			t.Fatalf("histogram counted %d info logs, want 2", counted)
		}
	})
}
