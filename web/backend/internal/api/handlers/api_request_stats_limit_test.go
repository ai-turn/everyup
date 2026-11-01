package handlers_test

import (
	"encoding/json"
	"strconv"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestDirectRequestStatsReportsLimitWithoutPartialSeries(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	_, created := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
		"name": "busy-api", "signals": []string{"traces"},
	}, auth...)
	var service models.ObservedService
	if err := json.Unmarshal(created.Data, &service); err != nil || service.ID == "" {
		t.Fatalf("create service: %s, %v", created.Data, err)
	}
	rows := make([]models.ApiRequest, 100000)
	at := time.Now().Truncate(time.Hour)
	for i := range rows {
		rows[i] = models.ApiRequest{ServiceID: service.ID, RequestID: strconv.Itoa(i), Method: "GET", Path: "/orders", StatusCode: 200, DurationMs: 10, CreatedAt: at}
	}
	repo := database.NewApiRequestRepository()
	if _, err := repo.CreateBatch(rows); err != nil {
		t.Fatal(err)
	}
	read := func() struct {
		Buckets   []models.ApiRequestStatBucket `json:"buckets"`
		Truncated bool                          `json:"truncated"`
	} {
		t.Helper()
		_, response := ts.doRequest(t, "GET", "/api/v1/observed-services/"+service.ID+"/request-stats", nil, auth...)
		var result struct {
			Buckets   []models.ApiRequestStatBucket `json:"buckets"`
			Truncated bool                          `json:"truncated"`
		}
		if err := json.Unmarshal(response.Data, &result); err != nil {
			t.Fatalf("request stats must include buckets and completeness: %v", err)
		}
		return result
	}
	complete := read()
	if complete.Truncated || len(complete.Buckets) != 1 || complete.Buckets[0].Count != 100000 {
		t.Fatalf("exact limit must remain complete: %+v", complete)
	}
	if err := repo.Create(&models.ApiRequest{ServiceID: service.ID, RequestID: "over-limit", Method: "GET", Path: "/orders", StatusCode: 500, IsError: true, CreatedAt: at.Add(time.Minute)}); err != nil {
		t.Fatal(err)
	}
	limited := read()
	if !limited.Truncated || len(limited.Buckets) != 0 {
		t.Fatalf("over-limit stats must not expose a misleading partial series: %+v", limited)
	}
}
