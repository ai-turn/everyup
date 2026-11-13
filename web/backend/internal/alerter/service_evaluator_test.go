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

func newDownRuleEvaluator(t *testing.T, serviceID string, consecutive int) (*ServiceRuleEvaluator, *[]Notification) {
	t.Helper()
	if err := database.Connect(":memory:"); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	if err := database.NewAlertRuleRepository().Create(&models.AlertRule{
		ID: "r-" + serviceID, Name: serviceID + " down", Type: models.AlertRuleTypeService, ServiceID: &serviceID,
		Metric: models.AlertMetricHTTPStatus, Operator: models.AlertOperatorGTE, Threshold: 400, Duration: consecutive,
		Severity: models.AlertSeverityCritical, IsEnabled: true,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}); err != nil {
		t.Fatalf("rule: %v", err)
	}
	var sent []Notification
	e := NewServiceRuleEvaluator(NewManager())
	e.dispatch = func(n Notification, _ []string) { sent = append(sent, n) }
	return e, &sent
}

// A monitor that stays down must not page on every check: the rule fires once
// after the consecutive count and once more when the monitor recovers.
func TestServiceRuleEvaluator_AlertsOnStateChangeAfterConsecutiveFailures(t *testing.T) {
	e, sent := newDownRuleEvaluator(t, "web", 3)

	e.Evaluate("web", "web", 503, 40, false)
	e.Evaluate("web", "web", 503, 40, false)
	if len(*sent) != 0 {
		t.Fatalf("alerted before 3 consecutive failures: %+v", *sent)
	}
	e.Evaluate("web", "web", 503, 40, false)
	e.Evaluate("web", "web", 503, 40, false)
	e.Evaluate("web", "web", 503, 40, false)
	if len(*sent) != 1 || (*sent)[0].Severity != "critical" {
		t.Fatalf("want exactly one alert while down, got %+v", *sent)
	}
	e.Evaluate("web", "web", 200, 30, true)
	e.Evaluate("web", "web", 200, 30, true)
	if len(*sent) != 2 || (*sent)[1].Severity != "info" {
		t.Fatalf("want one recovery, got %+v", *sent)
	}

	// A single blip below the count neither alerts nor recovers.
	e.Evaluate("web", "web", 503, 40, false)
	e.Evaluate("web", "web", 200, 30, true)
	if len(*sent) != 2 {
		t.Fatalf("blip below the consecutive count sent %+v", (*sent)[2:])
	}
}

// The uptime check decides "down" (e.g. 301 when 200 is expected). The status
// rule follows that verdict instead of the raw code, so the two never disagree.
func TestServiceRuleEvaluator_FollowsCheckVerdictForUnexpectedStatus(t *testing.T) {
	e, sent := newDownRuleEvaluator(t, "api", 1)

	e.Evaluate("api", "api", 301, 20, false)
	if len(*sent) != 1 || (*sent)[0].StatusCode != 301 {
		t.Fatalf("failed check with 301 should alert and report the real code, got %+v", *sent)
	}
	e.Evaluate("api", "api", 404, 20, true) // a monitor that expects 404 is up
	if len(*sent) != 2 || (*sent)[1].Severity != "info" {
		t.Fatalf("passing check should recover even with a 4xx code, got %+v", *sent)
	}
}
