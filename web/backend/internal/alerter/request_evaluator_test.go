package alerter

import (
	"strconv"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// A windowed error-rate rule fires once when the window crosses the threshold,
// stays quiet inside its cooldown, ignores windows too thin to judge, and sends
// one recovery when the rate falls back.
func TestRequestRuleEvaluator_ErrorRate(t *testing.T) {
	if err := database.Connect(":memory:"); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	if err := database.NewServiceRepository().Create(&models.Service{
		ID: "svc-x", Name: "x", Type: models.ServiceTypeHTTP, IsActive: true, Interval: 60, Timeout: 30,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}); err != nil {
		t.Fatalf("service: %v", err)
	}
	agents := database.NewAgentRepository()
	if err := agents.UpsertAgent(models.Agent{ID: "agent-x", Name: "prod", LastSeenAt: time.Now()}); err != nil {
		t.Fatalf("agent: %v", err)
	}
	if err := agents.UpsertServices("agent-x", time.Now(), []models.AgentService{{AgentID: "agent-x", Key: "k-api", Name: "api", Seen: true}}); err != nil {
		t.Fatalf("agent service: %v", err)
	}
	agentID, key := "agent-x", "k-api"
	rule := &models.AlertRule{
		ID: "r-err", Name: "api errors", Type: models.AlertRuleTypeRequest, AgentID: &agentID, ServiceKey: &key,
		Metric: models.AlertMetricErrorRate, Operator: models.AlertOperatorGT, Threshold: 5, Duration: 5,
		Severity: models.AlertSeverityCritical, IsEnabled: true, Cooldown: 600,
	}
	if err := database.NewAlertRuleRepository().Create(rule); err != nil {
		t.Fatalf("rule: %v", err)
	}

	requests := database.NewApiRequestRepository()
	seq := 0
	add := func(at time.Time, total, errors int) {
		t.Helper()
		var rows []models.ApiRequest
		for i := 0; i < total; i++ {
			seq++
			status := 200
			if i < errors {
				status = 500
			}
			rows = append(rows, models.ApiRequest{
				ServiceID: "svc-x", AgentID: "agent-x", ServiceName: "api", RequestID: strconv.Itoa(seq),
				Method: "GET", Path: "/", PathTemplate: "/", StatusCode: status, DurationMs: 10,
				IsError: status >= 500, CreatedAt: at.UTC(),
			})
		}
		if _, err := requests.CreateBatch(rows); err != nil {
			t.Fatalf("requests: %v", err)
		}
	}

	var sent []Notification
	e := NewRequestRuleEvaluator(NewManager())
	e.dispatch = func(n Notification, _ []string) { sent = append(sent, n) }

	now := time.Now()
	add(now.Add(-time.Minute), 10, 5) // 50% but only 10 requests — too thin
	e.EvaluateAll(now)
	if len(sent) != 0 {
		t.Fatalf("thin window alerted: %+v", sent)
	}

	add(now.Add(-time.Minute), 20, 0) // 5/30 = 16.7%
	e.EvaluateAll(now)
	if len(sent) != 1 || sent[0].Severity != "critical" || sent[0].ServiceName != "api" {
		t.Fatalf("want one critical alert for api, got %+v", sent)
	}

	e.EvaluateAll(now.Add(time.Minute)) // still breached, inside cooldown
	if len(sent) != 1 {
		t.Fatalf("re-alerted inside cooldown: %d", len(sent))
	}

	later := now.Add(10 * time.Minute) // old requests left the 5-minute window
	add(later.Add(-time.Minute), 40, 1)
	e.EvaluateAll(later)
	if len(sent) != 2 || sent[1].Severity != "info" {
		t.Fatalf("want a recovery, got %+v", sent)
	}
}
