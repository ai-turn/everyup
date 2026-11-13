package alerter

import (
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// A TCP check has no HTTP status. The default health-check rule (HTTP status
// >= 400) must follow the check result: quiet while the port answers, firing
// when the connection fails, and one recovery when it answers again.
func TestServiceRuleEvaluator_TCPUsesCheckResult(t *testing.T) {
	if err := database.Connect(":memory:"); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	serviceID := "tcp-db"
	if err := database.NewAlertRuleRepository().Create(&models.AlertRule{
		ID: "r-down", Name: "db down", Type: models.AlertRuleTypeService, ServiceID: &serviceID,
		Metric: models.AlertMetricHTTPStatus, Operator: models.AlertOperatorGTE, Threshold: 400, Duration: 1,
		Severity: models.AlertSeverityCritical, IsEnabled: true,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}); err != nil {
		t.Fatalf("rule: %v", err)
	}

	var sent []Notification
	e := NewServiceRuleEvaluator(NewManager())
	e.dispatch = func(n Notification, _ []string) { sent = append(sent, n) }

	// TCP results carry no status code; only the check outcome differs.
	e.Evaluate(serviceID, "db", 0, 12, true)
	if len(sent) != 0 {
		t.Fatalf("healthy TCP check alerted: %+v", sent)
	}
	e.Evaluate(serviceID, "db", 0, 50, false)
	if len(sent) != 1 || sent[0].Severity != "critical" {
		t.Fatalf("want one critical alert for the failed connection, got %+v", sent)
	}
	e.Evaluate(serviceID, "db", 0, 9, true)
	if len(sent) != 2 || sent[1].Severity != "info" {
		t.Fatalf("want a recovery after the port answers again, got %+v", sent)
	}
}
