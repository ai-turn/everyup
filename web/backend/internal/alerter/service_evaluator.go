package alerter

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// ServiceRuleEvaluator evaluates alert rules against incoming endpoint check results.
// Alerts fire on every check that meets the condition; the service check interval acts as the rate limiter.
type ServiceRuleEvaluator struct {
	manager   *Manager
	repo      *database.AlertRuleRepository
	stateRepo *database.AlertRuleStateRepository

	mu          sync.Mutex
	wasAlerting map[string]bool // ruleKey → whether currently alerting (for recovery detection)

	dispatch func(Notification, []string) // test seam; defaults to manager.DispatchToChannels
}

// NewServiceRuleEvaluator creates a new service rule evaluator.
func NewServiceRuleEvaluator(manager *Manager) *ServiceRuleEvaluator {
	evaluator := &ServiceRuleEvaluator{
		manager:     manager,
		repo:        database.NewAlertRuleRepository(),
		stateRepo:   database.NewAlertRuleStateRepository(),
		wasAlerting: make(map[string]bool),
	}
	// Sending must not hold up the checker loop on a slow channel (Telegram, Slack).
	evaluator.dispatch = func(n Notification, channelIDs []string) { go manager.DispatchToChannels(n, channelIDs) }

	evaluator.loadState()

	return evaluator
}

// Evaluate checks all enabled service rules for a service against the given check result.
// This is called by Scheduler after each service check. checkOK is the check's own
// verdict; TCP checks have no HTTP status, so the status rule follows it instead.
func (e *ServiceRuleEvaluator) Evaluate(serviceID, serviceName string, statusCode, responseTimeMs int, checkOK bool) {
	rules, err := e.repo.GetEnabledByServiceID(serviceID)
	if err != nil {
		log.Printf("[ServiceEvaluator] Failed to get rules for service %s: %v", serviceID, err)
		return
	}

	for _, rule := range rules {
		e.evaluateRule(rule, serviceID, serviceName, statusCode, responseTimeMs, checkOK)
	}
}

// evaluateRule evaluates a single rule against the service check result.
// Mirrors the RuleEvaluator pattern: mutate state under lock, release before goroutine launch.
func (e *ServiceRuleEvaluator) evaluateRule(
	rule models.AlertRule,
	serviceID, serviceName string,
	statusCode, responseTimeMs int,
	checkOK bool,
) {
	value := extractServiceMetricValue(rule.Metric, statusCode, responseTimeMs, checkOK)
	breached := compareValue(value, rule.Operator, rule.Threshold)
	ruleKey := e.ruleKey(rule.ID, serviceID)

	// ── critical section: read/write in-memory state ───────────────────────
	e.mu.Lock()

	log.Printf("[ServiceEvaluator] Rule %s: metric=%s value=%.0f %s %.0f breached=%v (service: %s)",
		rule.Name, rule.Metric, value, rule.Operator, rule.Threshold, breached, serviceName)

	var toDispatch *Notification

	if breached {
		// Alert on every check that meets the condition.
		// The service check interval is the natural rate limiter — no cooldown applied.
		e.wasAlerting[ruleKey] = true

		n := Notification{
			RuleID:      rule.ID,
			AlertType:   AlertTypeEndpoint,
			ServiceID:   serviceID,
			ServiceName: serviceName,
			Metric:      string(rule.Metric),
			Value:       value,
			Threshold:   rule.Threshold,
			Severity:    string(rule.Severity),
			StatusCode:  statusCode,
			Message:     buildEndpointAlertMessage(rule, serviceName, value),
			Time:        time.Now(),
		}
		toDispatch = &n
	} else {
		if e.wasAlerting[ruleKey] {
			e.wasAlerting[ruleKey] = false

			n := Notification{
				RuleID:      rule.ID,
				AlertType:   AlertTypeEndpoint,
				ServiceID:   serviceID,
				ServiceName: serviceName,
				Metric:      string(rule.Metric),
				Value:       value,
				Threshold:   rule.Threshold,
				Severity:    "info",
				StatusCode:  statusCode,
				Message:     buildEndpointRecoveryMessage(rule, serviceName, value),
				Time:        time.Now(),
			}
			toDispatch = &n
		}
	}

	e.mu.Unlock() // ── release before any I/O or goroutine launch ──────────

	// ── post-lock actions ──────────────────────────────────────────────────
	if toDispatch != nil {
		if toDispatch.Severity == "info" {
			log.Printf("[ServiceEvaluator] RECOVERED: %s=%.0f recovered (service: %s, rule: %s)",
				rule.Metric, value, serviceName, rule.Name)
		} else {
			log.Printf("[ServiceEvaluator] ALERT %s: %s=%.0f > %.0f (service: %s, rule: %s)",
				rule.Severity, rule.Metric, value, rule.Threshold, serviceName, rule.Name)
		}
		e.dispatch(*toDispatch, rule.ChannelIDs)
	}

	go e.saveState(rule.ID, serviceID)
}

// EvaluateAgent checks enabled service rules for an agent service after a sync.
// Uses GetEnabledByAgentService which matches on agent_id + service_key.
func (e *ServiceRuleEvaluator) EvaluateAgent(agentID, serviceKey, serviceName string, statusCode, responseTimeMs int) {
	rules, err := e.repo.GetEnabledByAgentService(agentID, serviceKey)
	if err != nil {
		log.Printf("[ServiceEvaluator] Failed to get rules for agent service %s/%s: %v", agentID, serviceKey, err)
		return
	}
	for _, rule := range rules {
		// Agent syncs report only an HTTP status; 0 keeps meaning "no response".
		e.evaluateRule(rule, agentID+"/"+serviceKey, serviceName, statusCode, responseTimeMs, false)
	}
}

// loadState is a no-op for service rules.
// Service checks run frequently enough that breach counters reset safely on restart.
func (e *ServiceRuleEvaluator) loadState() {
	// In-memory only — no cross-restart persistence for service rule states
}

// saveState persists current alerting state to database.
// ServiceID is stored in the HostID field for reuse of existing schema.
func (e *ServiceRuleEvaluator) saveState(ruleID, serviceID string) {
	key := e.ruleKey(ruleID, serviceID)

	e.mu.Lock()
	state := &models.AlertRuleState{
		RuleID:     ruleID,
		HostID:     serviceID, // serviceID stored in host_id column
		IsAlerting: e.wasAlerting[key],
	}
	e.mu.Unlock()

	if err := e.stateRepo.SaveState(state); err != nil {
		log.Printf("[ServiceEvaluator] Failed to save state for %s: %v", key, err)
	}
}

// ruleKey generates a composite key.
func (e *ServiceRuleEvaluator) ruleKey(ruleID, serviceID string) string {
	return ruleID + ":" + serviceID
}

// extractServiceMetricValue extracts the relevant metric value from check result fields.
// statusCode=0 means there was no HTTP response. A failed check maps to 999 so that any
// status-code threshold rule (>= 400, >= 500, etc.) triggers; a successful one (a TCP
// port that answered) maps to 200, so the same rule stays quiet while the port is up.
func extractServiceMetricValue(metric models.AlertMetric, statusCode, responseTimeMs int, checkOK bool) float64 {
	switch metric {
	case models.AlertMetricHTTPStatus:
		if statusCode == 0 {
			if checkOK {
				return 200
			}
			return 999
		}
		return float64(statusCode)
	case models.AlertMetricResponseTime:
		return float64(responseTimeMs)
	default:
		return 0
	}
}

// buildEndpointAlertMessage creates a human-readable alert message.
// If rule.Message is set, it is used as a template with variable substitution.
// Supported variables: {service_name}, {value}, {threshold}, {metric}
func buildEndpointAlertMessage(rule models.AlertRule, serviceName string, value float64) string {
	if rule.Message != "" {
		return strings.NewReplacer(
			"{service_name}", serviceName,
			"{value}", fmt.Sprintf("%.0f", value),
			"{threshold}", fmt.Sprintf("%.0f", rule.Threshold),
			"{metric}", string(rule.Metric),
		).Replace(rule.Message)
	}
	switch rule.Metric {
	case models.AlertMetricHTTPStatus:
		return fmt.Sprintf("HTTP %d response on %s (threshold: %s %.0f)",
			int(value), serviceName, operatorLabel(rule.Operator), rule.Threshold)
	case models.AlertMetricResponseTime:
		return fmt.Sprintf("Response time %.0fms on %s exceeds threshold %s %.0fms",
			value, serviceName, operatorLabel(rule.Operator), rule.Threshold)
	default:
		return fmt.Sprintf("Endpoint alert on %s: %.0f %s %.0f",
			serviceName, value, operatorLabel(rule.Operator), rule.Threshold)
	}
}

// buildEndpointRecoveryMessage creates a human-readable recovery message.
func buildEndpointRecoveryMessage(rule models.AlertRule, serviceName string, value float64) string {
	switch rule.Metric {
	case models.AlertMetricHTTPStatus:
		return fmt.Sprintf("HTTP response recovered to %d on %s", int(value), serviceName)
	case models.AlertMetricResponseTime:
		return fmt.Sprintf("Response time recovered to %.0fms on %s", value, serviceName)
	default:
		return fmt.Sprintf("Endpoint metric recovered on %s: %.0f", serviceName, value)
	}
}

// operatorLabel returns a human-readable operator string.
func operatorLabel(op models.AlertOperator) string {
	switch op {
	case models.AlertOperatorGT:
		return ">"
	case models.AlertOperatorGTE:
		return ">="
	case models.AlertOperatorLT:
		return "<"
	case models.AlertOperatorLTE:
		return "<="
	case models.AlertOperatorEQ:
		return "="
	default:
		return ">"
	}
}
