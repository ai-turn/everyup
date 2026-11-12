package handlers_test

import (
	"encoding/json"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// The endpoint table, its row filter and the list summary answer "which API is
// failing or slow" without the frontend re-reading every request.
func TestDirectRequestEndpointsSummaryAndEndpointFilter(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	_, created := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
		"name": "endpoint-api", "signals": []string{"traces"},
	}, auth...)
	var service models.ObservedService
	if err := json.Unmarshal(created.Data, &service); err != nil || service.ID == "" {
		t.Fatalf("create service: %s, %v", created.Data, err)
	}
	at := time.Now().UTC().Add(-time.Minute)
	rows := []models.ApiRequest{
		{Method: "GET", Path: "/orders/1", PathTemplate: "/orders/:id", StatusCode: 200, DurationMs: 10},
		{Method: "GET", Path: "/orders/2", PathTemplate: "/orders/:id", StatusCode: 200, DurationMs: 20},
		{Method: "GET", Path: "/orders/3", PathTemplate: "/orders/:id", StatusCode: 500, DurationMs: 300, IsError: true},
		{Method: "POST", Path: "/orders", PathTemplate: "/orders", StatusCode: 201, DurationMs: 50},
		{Method: "POST", Path: "/orders", PathTemplate: "/orders", StatusCode: 201, DurationMs: 60},
		{Method: "GET", Path: "/orders/3/cancel", PathTemplate: "/orders/:id/cancel", StatusCode: 200, DurationMs: 5},
		{Method: "GET", Path: "/health", StatusCode: 200}, // no template, no duration
	}
	for i := range rows {
		rows[i].ServiceID, rows[i].RequestID, rows[i].CreatedAt = service.ID, strconv.Itoa(i), at
	}
	if _, err := database.NewApiRequestRepository().CreateBatch(rows); err != nil {
		t.Fatal(err)
	}
	base := "/api/v1/observed-services/" + service.ID

	_, response := ts.doRequest(t, "GET", base+"/request-endpoints", nil, auth...)
	var endpoints models.ApiEndpointStats
	if err := json.Unmarshal(response.Data, &endpoints); err != nil {
		t.Fatal(err)
	}
	got := make([]string, 0, len(endpoints.Endpoints))
	for _, row := range endpoints.Endpoints {
		got = append(got, row.Method+" "+row.Path)
	}
	want := []string{"GET /orders/:id", "POST /orders", "GET /orders/:id/cancel", "GET /health"}
	if endpoints.Truncated || len(got) != len(want) {
		t.Fatalf("endpoints = %v (truncated %v), want %v", got, endpoints.Truncated, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("problem-first order = %v, want %v", got, want)
		}
	}
	first := endpoints.Endpoints[0]
	if first.Count != 3 || first.ErrorCount != 1 || first.P95 != 300 || first.Timed != 3 || first.LastErrorAt == nil {
		t.Fatalf("GET /orders/:id stats = %+v", first)
	}
	if health := endpoints.Endpoints[3]; health.Timed != 0 || health.P95 != 0 {
		t.Fatalf("untimed endpoint must have no latency: %+v", health)
	}

	total := func(query url.Values) int {
		t.Helper()
		_, response := ts.doRequest(t, "GET", base+"/requests?"+query.Encode(), nil, auth...)
		var result struct {
			Total int `json:"total"`
		}
		if err := json.Unmarshal(response.Data, &result); err != nil {
			t.Fatal(err)
		}
		return result.Total
	}
	cases := []struct {
		query url.Values
		want  int
	}{
		{url.Values{"pathTemplate": {"/orders/:id"}}, 3}, // exact: /orders/:id/cancel stays out
		{url.Values{"pathTemplate": {"/orders"}, "method": {"POST"}}, 2},
		{url.Values{"pathTemplate": {"/orders"}, "method": {"GET"}}, 0},
		{url.Values{"pathTemplate": {"/health"}}, 1}, // raw path when there is no template
		{url.Values{"minStatus": {"500"}, "maxStatus": {"599"}}, 1},
	}
	for _, tc := range cases {
		if n := total(tc.query); n != tc.want {
			t.Fatalf("requests?%s total = %d, want %d", tc.query.Encode(), n, tc.want)
		}
	}

	_, response = ts.doRequest(t, "GET", base+"/request-status-summary", nil, auth...)
	var summary models.ApiRequestStatusSummary
	if err := json.Unmarshal(response.Data, &summary); err != nil {
		t.Fatal(err)
	}
	if summary.ErrorCount != 1 || summary.P95 != 300 || summary.Timed != 6 || summary.Count5xx != 1 {
		t.Fatalf("summary = %+v", summary)
	}
}
