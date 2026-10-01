package database

import (
	"database/sql"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// AlertRuleRepository handles alert rule data operations
type AlertRuleRepository struct{}

// NewAlertRuleRepository creates a new alert rule repository
func NewAlertRuleRepository() *AlertRuleRepository {
	return &AlertRuleRepository{}
}

// alertRuleSelectColumns is the column list for alert rule queries.
const alertRuleSelectColumns = `id, name, type, agent_id, service_key, service_id, metric,
	COALESCE(metric_name, '') as metric_name, operator,
	threshold, duration, severity, is_enabled, cooldown, COALESCE(message, '') as message,
	COALESCE(is_system, 0) as is_system, created_at, updated_at`

// scanAlertRuleFields scans alert rule columns into an AlertRule struct from a generic scanner.
func scanAlertRuleFields(scan func(dest ...interface{}) error) (models.AlertRule, error) {
	var r models.AlertRule
	var isEnabled, isSystem int
	var agentID, serviceKey, serviceID sql.NullString

	err := scan(
		&r.ID, &r.Name, &r.Type, &agentID, &serviceKey, &serviceID, &r.Metric, &r.MetricName, &r.Operator,
		&r.Threshold, &r.Duration, &r.Severity, &isEnabled, &r.Cooldown, &r.Message,
		&isSystem, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return r, err
	}

	r.IsEnabled = isEnabled == 1
	r.IsSystem = isSystem == 1
	if agentID.Valid && agentID.String != "" {
		s := agentID.String
		r.AgentID = &s
	}
	if serviceKey.Valid && serviceKey.String != "" {
		s := serviceKey.String
		r.ServiceKey = &s
	}
	if serviceID.Valid && serviceID.String != "" {
		s := serviceID.String
		r.ServiceID = &s
	}
	return r, nil
}

// loadChannelIDs loads channel IDs for a given rule.
func loadChannelIDs(ruleID string) ([]string, error) {
	rows, err := DB.Query(`SELECT channel_id FROM alert_rule_channels WHERE rule_id = ?`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// loadChannelIDsAll loads channel IDs for a slice of rules (close-then-load pattern to avoid SQLite deadlock).
func loadChannelIDsAll(rules []models.AlertRule) []models.AlertRule {
	for i := range rules {
		chIDs, _ := loadChannelIDs(rules[i].ID)
		rules[i].ChannelIDs = chIDs
	}
	return rules
}

// GetAll returns all alert rules with their channel IDs
func (r *AlertRuleRepository) GetAll() ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT ` + alertRuleSelectColumns + `
		FROM alert_rules
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	rules = loadChannelIDsAll(rules)
	loadLastTriggeredAll(rules)
	return rules, nil
}

// loadLastTriggeredAll fills LastTriggeredAt from notification_history
// (separate query after the rules rows are closed — single-connection SQLite).
func loadLastTriggeredAll(rules []models.AlertRule) {
	rows, err := DB.Query(`
		SELECT rule_id, MAX(created_at)
		FROM notification_history
		WHERE rule_id IS NOT NULL AND rule_id != ''
		GROUP BY rule_id
	`)
	if err != nil {
		return // last-triggered is display-only; rules list still works without it
	}
	defer rows.Close()

	lastByRule := make(map[string]time.Time)
	for rows.Next() {
		var ruleID string
		var last time.Time
		if err := rows.Scan(&ruleID, &last); err != nil {
			return
		}
		lastByRule[ruleID] = last
	}
	for i := range rules {
		if last, ok := lastByRule[rules[i].ID]; ok {
			t := last
			rules[i].LastTriggeredAt = &t
		}
	}
}

// GetByID returns an alert rule by ID with channel IDs
func (r *AlertRuleRepository) GetByID(id string) (*models.AlertRule, error) {
	row := DB.QueryRow(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules WHERE id = ?
	`, id)

	rule, err := scanAlertRuleFields(row.Scan)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	chIDs, _ := loadChannelIDs(rule.ID)
	rule.ChannelIDs = chIDs
	return &rule, nil
}

// GetEnabledByAgentID returns enabled resource rules for a given agent (or global rules).
// Called by RuleEvaluator after each agent metric sync.
func (r *AlertRuleRepository) GetEnabledByAgentID(agentID string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'resource'
		  AND (agent_id = ? OR agent_id IS NULL OR agent_id = '')
		ORDER BY severity DESC
	`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return loadChannelIDsAll(rules), nil
}

// GetEnabledByAgentService returns enabled service rules for a given agent service (or global rules).
// Called by ServiceRuleEvaluator after each agent service sync.
func (r *AlertRuleRepository) GetEnabledByAgentService(agentID, serviceKey string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'service'
		  AND (
		    (agent_id = ? AND service_key = ?)
		    OR (agent_id IS NULL OR agent_id = '')
		  )
		ORDER BY severity DESC
	`, agentID, serviceKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return loadChannelIDsAll(rules), nil
}

// GetEnabledByHostID is kept for the legacy CollectorManager path (SSH/local hosts).
func (r *AlertRuleRepository) GetEnabledByHostID(hostID string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'resource'
		  AND (agent_id = ? OR agent_id IS NULL OR agent_id = '')
		ORDER BY severity DESC
	`, hostID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return loadChannelIDsAll(rules), nil
}

// GetEnabledByServiceID is kept for the legacy Scheduler path (manual service checks).
func (r *AlertRuleRepository) GetEnabledByServiceID(serviceID string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'service'
		  AND (service_id = ? OR service_id IS NULL OR service_id = '')
		  AND (agent_id IS NULL OR agent_id = '')
		ORDER BY severity DESC
	`, serviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return loadChannelIDsAll(rules), nil
}

// GetEnabledApiRequestRules returns global rules plus rules scoped to one
// direct Observed Service or one Agent-discovered service.
func (r *AlertRuleRepository) GetEnabledApiRequestRules(serviceID, agentID, serviceName string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'log' AND metric = 'api_status_code'
		  AND (
		    (? != '' AND service_id = ?)
		    OR (
		      ? != '' AND agent_id = ?
		      AND (
		        service_key IS NULL OR service_key = ''
		        OR service_key IN (
		          SELECT key FROM agent_services WHERE agent_id = ? AND name = ?
		        )
		      )
		    )
		    OR (
		      (service_id IS NULL OR service_id = '')
		      AND (agent_id IS NULL OR agent_id = '')
		    )
		  )
		ORDER BY severity DESC
	`, serviceID, serviceID, agentID, agentID, agentID, serviceName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return loadChannelIDsAll(rules), nil
}

func (r *AlertRuleRepository) GetEnabledApiRequestRulesByServiceID(serviceID string) ([]models.AlertRule, error) {
	return r.GetEnabledApiRequestRules(serviceID, "", "")
}

// GetEnabledRequestRules returns every enabled windowed API request rule
// (error rate, latency percentiles) for the periodic RequestRuleEvaluator.
func (r *AlertRuleRepository) GetEnabledRequestRules() ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'request'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return loadChannelIDsAll(rules), nil
}

// GetEnabledOtelMetricRules returns global rules plus rules scoped to one
// direct Observed Service or one Agent-discovered service. Metric name and
// attribute-series matching remains at the ingest call site.
func (r *AlertRuleRepository) GetEnabledOtelMetricRules(serviceID, agentID, serviceName string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND metric = 'otel_metric'
		  AND (
		    (? != '' AND service_id = ?)
		    OR (
		      ? != '' AND agent_id = ?
		      AND (
		        service_key IS NULL OR service_key = ''
		        OR service_key IN (
		          SELECT key FROM agent_services WHERE agent_id = ? AND name = ?
		        )
		      )
		    )
		    OR (
		      (service_id IS NULL OR service_id = '')
		      AND (agent_id IS NULL OR agent_id = '')
		    )
		  )
		ORDER BY severity DESC
	`, serviceID, serviceID, agentID, agentID, agentID, serviceName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return loadChannelIDsAll(rules), nil
}

// GetEnabledLogRules returns global rules plus rules scoped to one direct or
// legacy service, or one Agent-discovered service. The Agent service key is
// resolved from its stable agent_id + observed service name.
func (r *AlertRuleRepository) GetEnabledLogRules(serviceID, agentID, serviceName string) ([]models.AlertRule, error) {
	rows, err := DB.Query(`
		SELECT `+alertRuleSelectColumns+`
		FROM alert_rules
		WHERE is_enabled = 1 AND type = 'log' AND metric != 'api_status_code'
		  AND (
		    (? != '' AND service_id = ?)
		    OR (
		      ? != '' AND agent_id = ?
		      AND (
		        service_key IS NULL OR service_key = ''
		        OR service_key IN (
		          SELECT key FROM agent_services WHERE agent_id = ? AND name = ?
		        )
		      )
		    )
		    OR (
		      (service_id IS NULL OR service_id = '')
		      AND (agent_id IS NULL OR agent_id = '')
		    )
		  )
		ORDER BY severity DESC
	`, serviceID, serviceID, agentID, agentID, agentID, serviceName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AlertRule
	for rows.Next() {
		rule, err := scanAlertRuleFields(rows.Scan)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	return loadChannelIDsAll(rules), nil
}

// GetEnabledLogRulesByServiceID preserves the legacy scheduler interface.
func (r *AlertRuleRepository) GetEnabledLogRulesByServiceID(serviceID string) ([]models.AlertRule, error) {
	return r.GetEnabledLogRules(serviceID, "", "")
}

// Create creates a new alert rule with channel mappings in a transaction.
func (r *AlertRuleRepository) Create(rule *models.AlertRule) error {
	return Transaction(func(tx *sql.Tx) error {
		isEnabled := 0
		if rule.IsEnabled {
			isEnabled = 1
		}
		isSystem := 0
		if rule.IsSystem {
			isSystem = 1
		}

		_, err := tx.Exec(`
			INSERT INTO alert_rules (id, name, type, agent_id, service_key, service_id, metric, metric_name, operator,
			                         threshold, duration, severity, is_enabled, cooldown,
			                         message, is_system, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, rule.ID, rule.Name, rule.Type, rule.AgentID, rule.ServiceKey, rule.ServiceID,
			rule.Metric, rule.MetricName, rule.Operator, rule.Threshold, rule.Duration,
			rule.Severity, isEnabled, rule.Cooldown, rule.Message, isSystem, rule.CreatedAt, rule.UpdatedAt)
		if err != nil {
			return err
		}

		for _, chID := range rule.ChannelIDs {
			if _, err := tx.Exec(`INSERT INTO alert_rule_channels (rule_id, channel_id) VALUES (?, ?)`,
				rule.ID, chID); err != nil {
				return err
			}
		}
		return nil
	})
}

// Update applies partial updates to an alert rule and replaces channel mappings.
func (r *AlertRuleRepository) Update(id string, req *models.AlertRuleUpdateRequest) error {
	return Transaction(func(tx *sql.Tx) error {
		setClauses := []string{}
		args := []interface{}{}

		if req.Name != nil {
			setClauses = append(setClauses, "name = ?")
			args = append(args, *req.Name)
		}
		// Always update agent_id and service_key (nil *string → SQL NULL, allows clearing)
		setClauses = append(setClauses, "agent_id = ?")
		args = append(args, req.AgentID)
		setClauses = append(setClauses, "service_key = ?")
		args = append(args, req.ServiceKey)
		setClauses = append(setClauses, "service_id = ?")
		args = append(args, req.ServiceID)
		if req.Metric != nil {
			setClauses = append(setClauses, "metric = ?")
			args = append(args, string(*req.Metric))
		}
		if req.MetricName != nil {
			setClauses = append(setClauses, "metric_name = ?")
			args = append(args, *req.MetricName)
		}
		if req.Operator != nil {
			setClauses = append(setClauses, "operator = ?")
			args = append(args, string(*req.Operator))
		}
		if req.Threshold != nil {
			setClauses = append(setClauses, "threshold = ?")
			args = append(args, *req.Threshold)
		}
		if req.Duration != nil {
			setClauses = append(setClauses, "duration = ?")
			args = append(args, *req.Duration)
		}
		if req.Severity != nil {
			setClauses = append(setClauses, "severity = ?")
			args = append(args, string(*req.Severity))
		}
		if req.IsEnabled != nil {
			enabled := 0
			if *req.IsEnabled {
				enabled = 1
			}
			setClauses = append(setClauses, "is_enabled = ?")
			args = append(args, enabled)
		}
		if req.Cooldown != nil {
			setClauses = append(setClauses, "cooldown = ?")
			args = append(args, *req.Cooldown)
		}
		if req.Message != nil {
			setClauses = append(setClauses, "message = ?")
			args = append(args, *req.Message)
		}

		setClauses = append(setClauses, "updated_at = ?")
		args = append(args, time.Now())
		args = append(args, id)

		if len(setClauses) > 1 {
			query := "UPDATE alert_rules SET " + joinStrings(setClauses, ", ") + " WHERE id = ?"
			if _, err := tx.Exec(query, args...); err != nil {
				return err
			}
		}

		if req.ChannelIDs != nil {
			if _, err := tx.Exec(`DELETE FROM alert_rule_channels WHERE rule_id = ?`, id); err != nil {
				return err
			}
			for _, chID := range *req.ChannelIDs {
				if _, err := tx.Exec(`INSERT INTO alert_rule_channels (rule_id, channel_id) VALUES (?, ?)`,
					id, chID); err != nil {
					return err
				}
			}
		}

		return nil
	})
}

// Delete deletes an alert rule (CASCADE removes channel mappings).
func (r *AlertRuleRepository) Delete(id string) error {
	_, err := DB.Exec("DELETE FROM alert_rules WHERE id = ?", id)
	return err
}

// SetEnabled updates the is_enabled flag for an alert rule.
func (r *AlertRuleRepository) SetEnabled(id string, isEnabled bool) error {
	enabled := 0
	if isEnabled {
		enabled = 1
	}
	_, err := DB.Exec(`UPDATE alert_rules SET is_enabled = ?, updated_at = ? WHERE id = ?`,
		enabled, time.Now(), id)
	return err
}

// joinStrings joins a string slice with a separator.
func joinStrings(elems []string, sep string) string {
	result := ""
	for i, e := range elems {
		if i > 0 {
			result += sep
		}
		result += e
	}
	return result
}
