package directtelemetry

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("observed service not found")
	ErrInvalidInput = errors.New("invalid observed service input")
	ErrInactive     = errors.New("direct telemetry connection is inactive")
	ErrSignalDenied = errors.New("telemetry signal is not allowed")
)

var defaultLogLevelFilter = []models.LogLevel{
	models.LogLevelError,
	models.LogLevelWarn,
	models.LogLevelInfo,
}

// Manager is the interface used by management handlers and OTLP auth. It hides
// target creation, credential lifecycle, signal normalization, and persistence.
type Manager struct {
	repo    *database.ObservedServiceRepository
	servers *database.ServerRepository
}

func NewManager() *Manager {
	return &Manager{
		repo:    database.NewObservedServiceRepository(),
		servers: database.NewServerRepository(),
	}
}

func NormalizeSignals(signals []models.TelemetrySignal) ([]models.TelemetrySignal, error) {
	selected := make(map[models.TelemetrySignal]bool, len(signals))
	for _, signal := range signals {
		switch signal {
		case models.TelemetrySignalLogs, models.TelemetrySignalMetrics, models.TelemetrySignalTraces:
			selected[signal] = true
		default:
			return nil, fmt.Errorf("%w: unsupported signal %q", ErrInvalidInput, signal)
		}
	}
	if len(selected) == 0 {
		return nil, fmt.Errorf("%w: select at least one signal", ErrInvalidInput)
	}
	ordered := make([]models.TelemetrySignal, 0, len(selected))
	for _, signal := range []models.TelemetrySignal{
		models.TelemetrySignalLogs,
		models.TelemetrySignalMetrics,
		models.TelemetrySignalTraces,
	} {
		if selected[signal] {
			ordered = append(ordered, signal)
		}
	}
	return ordered, nil
}

func NormalizeLogLevels(levels []models.LogLevel) ([]models.LogLevel, error) {
	selected := make(map[models.LogLevel]bool, len(levels))
	for _, level := range levels {
		switch level {
		case models.LogLevelError, models.LogLevelWarn, models.LogLevelInfo, models.LogLevelDebug, models.LogLevelTrace:
			selected[level] = true
		default:
			return nil, fmt.Errorf("%w: unsupported log level %q", ErrInvalidInput, level)
		}
	}
	ordered := make([]models.LogLevel, 0, len(selected))
	for _, level := range []models.LogLevel{
		models.LogLevelError,
		models.LogLevelWarn,
		models.LogLevelInfo,
		models.LogLevelDebug,
		models.LogLevelTrace,
	} {
		if selected[level] {
			ordered = append(ordered, level)
		}
	}
	return ordered, nil
}

func NormalizeApiExcludePaths(paths []string) ([]string, error) {
	if len(paths) > 100 {
		return nil, fmt.Errorf("%w: at most 100 API exclusion paths are allowed", ErrInvalidInput)
	}
	seen := make(map[string]bool, len(paths))
	clean := make([]string, 0, len(paths))
	for _, path := range paths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		if len(path) > 500 || !strings.HasPrefix(path, "/") {
			return nil, fmt.Errorf("%w: API exclusion paths must start with / and be 500 characters or fewer", ErrInvalidInput)
		}
		if wildcard := strings.Index(path, "*"); wildcard >= 0 && wildcard != len(path)-1 {
			return nil, fmt.Errorf("%w: API exclusion wildcard is only allowed at the end", ErrInvalidInput)
		}
		if !seen[path] {
			seen[path] = true
			clean = append(clean, path)
		}
	}
	return clean, nil
}

func (m *Manager) validateInput(input models.ObservedServiceInput) (models.ObservedServiceInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.ServerID = strings.TrimSpace(input.ServerID)
	if input.Name == "" {
		return input, fmt.Errorf("%w: name is required", ErrInvalidInput)
	}
	if len(input.Name) > 200 {
		return input, fmt.Errorf("%w: name must be 200 characters or fewer", ErrInvalidInput)
	}
	signals, err := NormalizeSignals(input.Signals)
	if err != nil {
		return input, err
	}
	input.Signals = signals
	return input, nil
}

func (m *Manager) Create(input models.ObservedServiceInput) (*models.ObservedServiceSetup, error) {
	input, err := m.validateInput(input)
	if err != nil {
		return nil, err
	}
	serverID, err := m.servers.ResolveForTarget(database.ServerTargetApp, input.ServerID, input.Name)
	if err != nil {
		return nil, err
	}
	server, err := m.servers.GetByID(serverID)
	if err != nil {
		return nil, err
	}
	if server == nil {
		return nil, database.ErrServerMissing
	}
	plainKey := crypto.GenerateApiKey()
	now := time.Now()
	service := models.ObservedService{
		ID:             uuid.NewString(),
		Name:           input.Name,
		ServerID:       serverID,
		Signals:        input.Signals,
		LogLevelFilter: append([]models.LogLevel(nil), defaultLogLevelFilter...),
		IsActive:       true,
		ApiKeyMasked:   crypto.MaskApiKey(plainKey),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := m.repo.Create(&service, crypto.HashApiKey(plainKey)); err != nil {
		return nil, err
	}
	return &models.ObservedServiceSetup{ObservedService: service, ApiKey: plainKey}, nil
}

// RequireSignal resolves a management target and confirms that the requested
// capability is attached to it. Capability handlers use this instead of
// duplicating target/signal validation.
func (m *Manager) RequireSignal(id string, signal models.TelemetrySignal) (*models.ObservedService, error) {
	service, err := m.GetByID(id)
	if err != nil {
		return nil, err
	}
	if !hasSignal(service.Signals, signal) {
		return nil, ErrSignalDenied
	}
	return service, nil
}

func (m *Manager) SetLogLevelFilter(id string, levels []models.LogLevel) (*models.ObservedService, error) {
	if _, err := m.RequireSignal(id, models.TelemetrySignalLogs); err != nil {
		return nil, err
	}
	clean, err := NormalizeLogLevels(levels)
	if err != nil {
		return nil, err
	}
	if err := m.repo.SetLogLevelFilter(id, clean); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return m.GetByID(id)
}

func (m *Manager) SetApiExcludePaths(id string, paths []string) (*models.ObservedService, error) {
	if _, err := m.RequireSignal(id, models.TelemetrySignalTraces); err != nil {
		return nil, err
	}
	clean, err := NormalizeApiExcludePaths(paths)
	if err != nil {
		return nil, err
	}
	if err := m.repo.SetApiExcludePaths(id, clean); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return m.GetByID(id)
}

func (m *Manager) GetAll(signal models.TelemetrySignal) ([]models.ObservedService, error) {
	services, err := m.repo.GetAll()
	if err != nil || signal == "" {
		return services, err
	}
	if _, err := NormalizeSignals([]models.TelemetrySignal{signal}); err != nil {
		return nil, err
	}
	filtered := make([]models.ObservedService, 0, len(services))
	for _, service := range services {
		if hasSignal(service.Signals, signal) {
			filtered = append(filtered, service)
		}
	}
	return filtered, nil
}

func (m *Manager) GetByID(id string) (*models.ObservedService, error) {
	service, err := m.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if service == nil {
		return nil, ErrNotFound
	}
	return service, nil
}

func (m *Manager) Update(id string, input models.ObservedServiceInput) (*models.ObservedService, error) {
	input, err := m.validateInput(input)
	if err != nil {
		return nil, err
	}
	service, err := m.GetByID(id)
	if err != nil {
		return nil, err
	}
	// Without serverId the target stays on its server.
	if input.ServerID != "" {
		err = m.servers.MoveTarget(database.ServerTargetApp, id, input.ServerID)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	service.Name = input.Name
	service.Signals = input.Signals
	if err := m.repo.Update(service); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return m.GetByID(id)
}

func (m *Manager) RotateKey(id string) (*models.ObservedServiceSetup, error) {
	if _, err := m.GetByID(id); err != nil {
		return nil, err
	}
	plainKey := crypto.GenerateApiKey()
	if err := m.repo.RotateKey(id, crypto.HashApiKey(plainKey), crypto.MaskApiKey(plainKey)); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	service, err := m.GetByID(id)
	if err != nil {
		return nil, err
	}
	return &models.ObservedServiceSetup{ObservedService: *service, ApiKey: plainKey}, nil
}

func (m *Manager) RevokeKey(id string) (*models.ObservedService, error) {
	if err := m.repo.RevokeKey(id); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return m.GetByID(id)
}

func (m *Manager) Delete(id string) error {
	if err := m.repo.Delete(id); err != nil {
		if err == sql.ErrNoRows {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// AuthorizeHash resolves a direct credential and enforces one OTLP signal.
// A nil service with nil error means the hash is not a direct credential and
// lets the caller try its compatibility adapters.
func (m *Manager) AuthorizeHash(apiKeyHash string, signal models.TelemetrySignal) (*models.ObservedService, error) {
	service, err := m.repo.FindByApiKeyHash(apiKeyHash)
	if err != nil || service == nil {
		return service, err
	}
	if !service.IsActive {
		return nil, ErrInactive
	}
	if !hasSignal(service.Signals, signal) {
		return nil, ErrSignalDenied
	}
	if err := m.repo.MarkSeen(service.ID, time.Now()); err != nil {
		return nil, err
	}
	return service, nil
}

func hasSignal(signals []models.TelemetrySignal, wanted models.TelemetrySignal) bool {
	for _, signal := range signals {
		if signal == wanted {
			return true
		}
	}
	return false
}
