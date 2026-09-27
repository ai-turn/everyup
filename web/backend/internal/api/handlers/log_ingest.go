package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// errLogFiltered is returned by processEntry when the log level is filtered out by the service config.
var errLogFiltered = errors.New("log level filtered")

const maxMessageBytes = 10 * 1024  // 10 KB
const maxMetadataBytes = 50 * 1024 // 50 KB

// LogIngestHandler processes log entries that arrive through OTLP and
// exposes processEntry/triggerAlertIfNeeded helpers to the OTLP handler.
type LogIngestHandler struct {
	logRepo      *database.LogRepository
	ruleRepo     *database.AlertRuleRepository
	alertManager *alerter.Manager
}

// NewLogIngestHandler creates a new log ingest handler
func NewLogIngestHandler() *LogIngestHandler {
	return &LogIngestHandler{
		logRepo:      database.NewLogRepository(),
		ruleRepo:     database.NewAlertRuleRepository(),
		alertManager: alerter.NewManager(),
	}
}

// processEntry validates a log entry and applies the ingest-time level filter.
// Identity (service/agent/name) is assigned by the caller after this returns.
// fingerprintSeed scopes alert dedup to the sending service (legacy service id,
// or agentID:serviceName for connected agents). Empty filter = accept all levels.
func (h *LogIngestHandler) processEntry(entry *models.LogIngestEntry, filter []models.LogLevel, fingerprintSeed, source string) (*models.Log, error) {
	if entry.Message == "" {
		return nil, fmt.Errorf("message is required")
	}

	if len(entry.Message) > maxMessageBytes {
		return nil, fmt.Errorf("message exceeds maximum size of 10 KB")
	}

	// Default to info when no level is specified. Unknown/plain text logs should
	// not become alerts unless the sender explicitly marks them as warn/error.
	if entry.Level == "" {
		entry.Level = models.LogLevelInfo
	}

	if len(filter) > 0 {
		allowed := make(map[models.LogLevel]bool, len(filter))
		for _, l := range filter {
			allowed[l] = true
		}
		if !allowed[entry.Level] {
			return nil, errLogFiltered
		}
	}

	// Generate fingerprint
	fingerprint := database.LogFingerprint(fingerprintSeed, string(entry.Level), entry.Message)

	// Marshal metadata
	var metadataJSON json.RawMessage
	if entry.Metadata != nil {
		data, err := json.Marshal(entry.Metadata)
		if err != nil {
			return nil, fmt.Errorf("invalid metadata format")
		}
		if len(data) > maxMetadataBytes {
			return nil, fmt.Errorf("metadata exceeds maximum size of 50 KB")
		}
		metadataJSON = data
	}

	return &models.Log{
		Level:       entry.Level,
		Message:     entry.Message,
		Metadata:    metadataJSON,
		Source:      source,
		Fingerprint: fingerprint,
		CreatedAt:   time.Now(),
	}, nil
}

// triggerAlertIfNeeded dispatches alert for error/warn level logs. Direct and
// legacy services scope by serviceID; Agent services scope by agentID plus the
// discovered service name.
func (h *LogIngestHandler) triggerAlertIfNeeded(serviceID, agentID, serviceName string, logEntry *models.Log, metadata map[string]interface{}) {
	if logEntry.Level != models.LogLevelError && logEntry.Level != models.LogLevelWarn {
		return
	}

	alertServiceID := serviceID
	if agentID != "" {
		alertServiceID = agentID + ":" + serviceName
	}
	rules, err := h.ruleRepo.GetEnabledLogRules(serviceID, agentID, serviceName)
	if err != nil {
		log.Printf("Failed to get log alert rules for %s: %v", serviceName, err)
		return
	}

	if len(rules) == 0 {
		go h.alertManager.DispatchLogAlert(
			alertServiceID,
			serviceName,
			string(logEntry.Level),
			logEntry.Message,
			metadata,
		)
		return
	}

	for _, rule := range rules {
		if logRuleMatches(rule, logEntry.Level) {
			go h.alertManager.DispatchLogAlertForRule(
				rule,
				alertServiceID,
				serviceName,
				string(logEntry.Level),
				logEntry.Message,
				metadata,
			)
		}
	}
}

func logRuleMatches(rule models.AlertRule, level models.LogLevel) bool {
	value := logLevelValue(level)
	threshold := rule.Threshold
	if threshold <= 0 {
		threshold = logLevelValue(models.LogLevelWarn)
	}
	return compareAlertValue(value, rule.Operator, threshold)
}

func logLevelValue(level models.LogLevel) float64 {
	switch level {
	case models.LogLevelError:
		return 4
	case models.LogLevelWarn:
		return 3
	case models.LogLevelInfo:
		return 2
	case models.LogLevelDebug:
		return 1
	case models.LogLevelTrace:
		return 0
	default:
		return 0
	}
}

func compareAlertValue(value float64, operator models.AlertOperator, threshold float64) bool {
	switch operator {
	case models.AlertOperatorGT:
		return value > threshold
	case models.AlertOperatorGTE:
		return value >= threshold
	case models.AlertOperatorLT:
		return value < threshold
	case models.AlertOperatorLTE:
		return value <= threshold
	case models.AlertOperatorEQ:
		return value == threshold
	default:
		return value >= threshold
	}
}
