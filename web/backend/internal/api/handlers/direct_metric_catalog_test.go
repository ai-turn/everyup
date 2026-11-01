package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func TestDirectMetricCatalogIncludesRetainedNamesAndLatestReceipt(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)
	const endpoint = "/api/v1/observed-services/metric-catalog"
	if response, _ := ts.doRequest(t, "GET", endpoint, nil); response.StatusCode != 401 {
		t.Fatalf("unauthenticated catalog status=%d, want 401", response.StatusCode)
	}
	_, empty := ts.doRequest(t, "GET", endpoint, nil, auth...)
	if !empty.Success || string(empty.Data) != "[]" {
		t.Fatalf("empty catalog=%s error=%+v, want []", empty.Data, empty.Error)
	}
	create := func(name string) string {
		t.Helper()
		_, result := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
			"name": name, "signals": []string{"metrics"},
		}, auth...)
		var service models.ObservedService
		if !result.Success {
			t.Fatalf("create %s: %+v", name, result.Error)
		}
		if err := json.Unmarshal(result.Data, &service); err != nil {
			t.Fatal(err)
		}
		return service.ID
	}
	first, second := create("billing-api"), create("worker")
	now := time.Now().UTC().Truncate(time.Second)
	old := now.Add(-48 * time.Hour)
	points := []models.OtelMetric{
		{ServiceID: first, MetricName: "jvm.memory.used", MetricType: "gauge", Unit: "By", Value: 1, Attributes: json.RawMessage(`{"pool":"old"}`), CreatedAt: old},
		{ServiceID: first, MetricName: "jvm.memory.used", MetricType: "gauge", Unit: "By", Value: 0, Attributes: json.RawMessage(`{"pool":"new"}`), CreatedAt: now},
		{ServiceID: first, MetricName: "http.server.request.duration", MetricType: "histogram", Unit: "s", Value: 0.2, CreatedAt: now},
		{ServiceID: first, MetricName: "old.custom.metric", MetricType: "gauge", CreatedAt: old},
		{ServiceID: second, MetricName: "jvm.memory.used", MetricType: "gauge", Unit: "By", CreatedAt: old},
		{AgentID: "docker-host", ServiceName: "docker-api", MetricName: "docker.only", MetricType: "gauge", CreatedAt: now},
		{ServiceID: "legacy-service", MetricName: "legacy.only", MetricType: "gauge", CreatedAt: now},
	}
	if _, err := database.NewOtelMetricRepository().CreateBatch(points); err != nil {
		t.Fatal(err)
	}
	_, result := ts.doRequest(t, "GET", endpoint, nil, auth...)
	if !result.Success {
		t.Fatalf("catalog failed: %+v", result.Error)
	}
	var names []models.ObservedServiceMetricName
	if err := json.Unmarshal(result.Data, &names); err != nil {
		t.Fatal(err)
	}
	if len(names) != 4 {
		t.Fatalf("catalog=%+v, want 4 definitions across two direct services", names)
	}
	seen := map[string]models.ObservedServiceMetricName{}
	for _, name := range names {
		seen[name.ServiceID+":"+name.MetricName] = name
	}
	if got := seen[first+":jvm.memory.used"]; !got.LastAt.Equal(now) || got.Unit != "By" || got.MetricType != "gauge" {
		t.Fatalf("latest metadata=%+v, want gauge/By at %s", got, now)
	}
	if got := seen[first+":old.custom.metric"]; !got.LastAt.Equal(old) {
		t.Fatalf("old metric missing or receipt changed: %+v", got)
	}
	if got := seen[second+":jvm.memory.used"]; !got.LastAt.Equal(old) {
		t.Fatalf("same name in second service lost scope: %+v", got)
	}
	var payload []map[string]json.RawMessage
	if err := json.Unmarshal(result.Data, &payload); err != nil {
		t.Fatal(err)
	}
	for _, row := range payload {
		if _, ok := row["value"]; ok {
			t.Fatal("catalog must not expose a representative value as metric metadata")
		}
	}
}
