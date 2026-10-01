package alerter

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// minWindowRequests keeps a rule quiet until the window holds enough requests
// to judge: 1 failure out of 2 is 50% but tells nothing.
// ponytail: fixed floor; make it a rule field if low-traffic services need it.
const minWindowRequests = 20

// RequestRuleEvaluator judges windowed API request rules — error rate and
// latency percentiles over the last rule.Duration minutes — once a minute.
// These are symptoms users feel, unlike per-request or resource rules.
type RequestRuleEvaluator struct {
	rules    *database.AlertRuleRepository
	requests *database.ApiRequestRepository
	agents   *database.AgentRepository
	dispatch func(Notification, []string)

	mu sync.Mutex
	// ruleID → last alert time while breached.
	// ponytail: in memory — a restart mid-incident re-alerts once and never sends
	// the recovery; persist in alert_rule_states if that matters.
	alerting map[string]time.Time
}

// NewRequestRuleEvaluator creates an evaluator that sends through manager.
func NewRequestRuleEvaluator(manager *Manager) *RequestRuleEvaluator {
	return &RequestRuleEvaluator{
		rules:    database.NewAlertRuleRepository(),
		requests: database.NewApiRequestRepository(),
		agents:   database.NewAgentRepository(),
		dispatch: manager.DispatchToChannels,
		alerting: make(map[string]time.Time),
	}
}

// Run evaluates every minute until ctx is cancelled.
func (e *RequestRuleEvaluator) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			e.EvaluateAll(now)
		}
	}
}

// EvaluateAll checks every enabled request rule against the window ending at now.
func (e *RequestRuleEvaluator) EvaluateAll(now time.Time) {
	rules, err := e.rules.GetEnabledRequestRules()
	if err != nil {
		log.Printf("[RequestEvaluator] Failed to load rules: %v", err)
		return
	}
	for _, rule := range rules {
		if err := e.evaluate(rule, now); err != nil {
			log.Printf("[RequestEvaluator] Rule %s: %v", rule.Name, err)
		}
	}
}

func (e *RequestRuleEvaluator) evaluate(rule models.AlertRule, now time.Time) error {
	filter, target, err := e.scope(rule)
	if err != nil || filter == nil {
		return err
	}
	window := time.Duration(max(rule.Duration, 1)) * time.Minute
	// UTC: OTLP rows are stored in UTC and SQLite compares times as text.
	filter.From = now.Add(-window).UTC()
	stats, err := e.requests.WindowStats(filter)
	if err != nil {
		return err
	}
	value, ok := requestRuleValue(rule.Metric, stats)
	if !ok {
		return nil // too few requests to judge — keep the current state
	}
	breached := compareValue(value, rule.Operator, rule.Threshold)

	e.mu.Lock()
	last, wasAlerting := e.alerting[rule.ID]
	var n *Notification
	switch {
	case breached && (!wasAlerting || now.Sub(last) >= time.Duration(rule.Cooldown)*time.Second):
		e.alerting[rule.ID] = now
		n = &Notification{
			Severity: string(rule.Severity),
			Message:  requestRuleMessage(rule, target, value, window),
		}
	case !breached && wasAlerting:
		delete(e.alerting, rule.ID)
		n = &Notification{
			Severity: "info",
			Message:  fmt.Sprintf("%s: %s recovered to %s", target, requestMetricLabel(rule.Metric), formatRequestValue(rule.Metric, value)),
		}
	}
	e.mu.Unlock()

	if n != nil {
		n.RuleID = rule.ID
		n.AlertType = AlertTypeApiRequest
		n.ServiceID = filter.ServiceID
		n.ServiceName = target
		n.Metric = string(rule.Metric)
		n.Value = value
		n.Threshold = rule.Threshold
		n.Time = now
		e.dispatch(*n, rule.ChannelIDs)
	}
	return nil
}

// scope turns a rule's target into a request filter and a display name.
// A nil filter means the rule has no resolvable target (e.g. deleted service).
func (e *RequestRuleEvaluator) scope(rule models.AlertRule) (*models.ApiRequestFilter, string, error) {
	switch {
	case rule.ServiceID != nil && *rule.ServiceID != "":
		return &models.ApiRequestFilter{ServiceID: *rule.ServiceID}, rule.Name, nil
	case rule.AgentID != nil && *rule.AgentID != "" && rule.ServiceKey != nil && *rule.ServiceKey != "":
		svc, err := e.agents.GetServiceByKey(*rule.AgentID, *rule.ServiceKey)
		if err != nil || svc == nil {
			return nil, "", err
		}
		return &models.ApiRequestFilter{AgentID: *rule.AgentID, ServiceName: svc.Name}, svc.Name, nil
	case rule.AgentID != nil && *rule.AgentID != "":
		return &models.ApiRequestFilter{AgentID: *rule.AgentID}, rule.Name, nil
	}
	return nil, "", nil // unscoped — rejected at create time
}

// requestRuleValue reads the rule's measure from a window; ok is false when
// the window is too thin to judge.
func requestRuleValue(metric models.AlertMetric, s models.ApiRequestStatBucket) (float64, bool) {
	switch metric {
	case models.AlertMetricErrorRate:
		if s.Count < minWindowRequests {
			return 0, false
		}
		return float64(s.ErrorCount) * 100 / float64(s.Count), true
	case models.AlertMetricLatencyP95:
		return float64(s.P95), s.Timed >= minWindowRequests
	case models.AlertMetricLatencyP99:
		return float64(s.P99), s.Timed >= minWindowRequests
	}
	return 0, false
}

func requestRuleMessage(rule models.AlertRule, target string, value float64, window time.Duration) string {
	if rule.Message != "" {
		return strings.NewReplacer(
			"{service_name}", target,
			"{value}", formatRequestValue(rule.Metric, value),
			"{threshold}", formatRequestValue(rule.Metric, rule.Threshold),
			"{duration}", fmt.Sprintf("%d", rule.Duration),
		).Replace(rule.Message)
	}
	return fmt.Sprintf("%s: %s %s over the last %s (threshold %s %s)", target, requestMetricLabel(rule.Metric),
		formatRequestValue(rule.Metric, value), window, operatorLabel(rule.Operator), formatRequestValue(rule.Metric, rule.Threshold))
}

func requestMetricLabel(metric models.AlertMetric) string {
	switch metric {
	case models.AlertMetricErrorRate:
		return "error rate"
	case models.AlertMetricLatencyP95:
		return "p95 latency"
	default:
		return "p99 latency"
	}
}

func formatRequestValue(metric models.AlertMetric, v float64) string {
	if metric == models.AlertMetricErrorRate {
		return fmt.Sprintf("%.1f%%", v)
	}
	return fmt.Sprintf("%.0fms", v)
}
