package infrastructure

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
	ErrNotFound       = errors.New("infrastructure resource not found")
	ErrInvalidInput   = errors.New("invalid infrastructure resource input")
	ErrProjectMissing = errors.New("project not found")
	ErrInactive       = errors.New("infrastructure collector connection is inactive")
	ErrSignalDenied   = errors.New("collector credential only accepts metrics")
)

type Manager struct {
	repo        *database.InfrastructureResourceRepository
	agentRepo   *database.AgentRepository
	metricRepo  *database.SystemMetricRepository
	projectRepo *database.ProjectRepository
}

func NewManager() *Manager {
	return &Manager{
		repo:        database.NewInfrastructureResourceRepository(),
		agentRepo:   database.NewAgentRepository(),
		metricRepo:  database.NewSystemMetricRepository(),
		projectRepo: database.NewProjectRepository(),
	}
}

func (m *Manager) validateInput(input models.InfrastructureResourceInput) (models.InfrastructureResourceInput, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.ProjectID = strings.TrimSpace(input.ProjectID)
	if input.Name == "" {
		return input, fmt.Errorf("%w: name is required", ErrInvalidInput)
	}
	if len(input.Name) > 200 {
		return input, fmt.Errorf("%w: name must be 200 characters or fewer", ErrInvalidInput)
	}
	if input.ProjectID != "" {
		exists, err := m.projectRepo.Exists(input.ProjectID)
		if err != nil {
			return input, err
		}
		if !exists {
			return input, ErrProjectMissing
		}
	}
	return input, nil
}

func (m *Manager) Create(input models.InfrastructureResourceInput) (*models.InfrastructureResourceSetup, error) {
	input, err := m.validateInput(input)
	if err != nil {
		return nil, err
	}
	plainKey := crypto.GenerateApiKey()
	now := time.Now()
	resource := models.InfrastructureResource{
		ID:           uuid.NewString(),
		Name:         input.Name,
		ProjectID:    input.ProjectID,
		Adapter:      models.InfrastructureAdapterOTelCollector,
		IsActive:     true,
		ApiKeyMasked: crypto.MaskApiKey(plainKey),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := m.repo.Create(&resource, crypto.HashApiKey(plainKey)); err != nil {
		return nil, err
	}
	return &models.InfrastructureResourceSetup{InfrastructureResource: resource, ApiKey: plainKey}, nil
}

func (m *Manager) GetAll() ([]models.InfrastructureResource, error) {
	direct, err := m.repo.GetAllDirect()
	if err != nil {
		return nil, err
	}
	agents, err := m.agentRepo.GetAllAgents()
	if err != nil {
		return nil, err
	}
	resources := make([]models.InfrastructureResource, 0, len(direct)+len(agents))
	resources = append(resources, direct...)
	for _, agent := range agents {
		if !agent.Profile.Has(models.AgentCapabilityInfrastructure) {
			continue
		}
		seen := agent.LastSeenAt
		resources = append(resources, models.InfrastructureResource{
			ID:         agent.ID,
			Name:       agent.Name,
			ProjectID:  agent.ProjectID,
			Adapter:    models.InfrastructureAdapterAgent,
			IsActive:   agent.Status == "active",
			LastSeenAt: &seen,
			CreatedAt:  agent.CreatedAt,
			UpdatedAt:  agent.UpdatedAt,
		})
	}
	ids := make([]string, 0, len(resources))
	for i := range resources {
		ids = append(ids, resources[i].ID)
	}
	latest, err := m.metricRepo.GetLatestByHosts(ids)
	if err != nil {
		return nil, err
	}
	for i := range resources {
		metric, ok := latest[resources[i].ID]
		if !ok {
			continue
		}
		applyLatestUsage(&resources[i], metric)
		if resources[i].Adapter == models.InfrastructureAdapterOTelCollector {
			seen := metric.CreatedAt
			resources[i].LastSeenAt = &seen
		}
	}
	return resources, nil
}

func (m *Manager) GetDirectByID(id string) (*models.InfrastructureResource, error) {
	resource, err := m.repo.GetDirectByID(id)
	if err != nil {
		return nil, err
	}
	if resource == nil {
		return nil, ErrNotFound
	}
	metric, err := m.metricRepo.GetLatestByHost(id)
	if err != nil {
		return nil, err
	}
	if metric != nil {
		applyLatestUsage(resource, *metric)
		seen := metric.CreatedAt
		resource.LastSeenAt = &seen
	}
	return resource, nil
}

// A zero size and a zero percent mean the Collector never sent that scraper, so the
// list shows "-" instead of 0%. CPU has no size to tell the two apart.
func applyLatestUsage(resource *models.InfrastructureResource, metric models.SystemMetric) {
	cpu := metric.CPUUsage
	resource.CPUUsage = &cpu
	if metric.MemTotal > 0 || metric.MemUsage > 0 {
		memory := metric.MemUsage
		resource.MemoryUsage = &memory
	}
	if metric.DiskTotal > 0 || metric.DiskUsage > 0 {
		disk := metric.DiskUsage
		resource.DiskUsage = &disk
	}
}

func (m *Manager) Update(id string, input models.InfrastructureResourceInput) (*models.InfrastructureResource, error) {
	input, err := m.validateInput(input)
	if err != nil {
		return nil, err
	}
	resource, err := m.GetDirectByID(id)
	if err != nil {
		return nil, err
	}
	resource.Name = input.Name
	resource.ProjectID = input.ProjectID
	if err := m.repo.Update(resource); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return m.GetDirectByID(id)
}

func (m *Manager) RotateKey(id string) (*models.InfrastructureResourceSetup, error) {
	if _, err := m.GetDirectByID(id); err != nil {
		return nil, err
	}
	plainKey := crypto.GenerateApiKey()
	if err := m.repo.RotateKey(id, crypto.HashApiKey(plainKey), crypto.MaskApiKey(plainKey)); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	resource, err := m.GetDirectByID(id)
	if err != nil {
		return nil, err
	}
	return &models.InfrastructureResourceSetup{InfrastructureResource: *resource, ApiKey: plainKey}, nil
}

func (m *Manager) RevokeKey(id string) (*models.InfrastructureResource, error) {
	if err := m.repo.RevokeKey(id); err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return m.GetDirectByID(id)
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

// AuthorizeHash resolves the standard Collector credential. A nil resource
// means another compatibility adapter may own the key.
func (m *Manager) AuthorizeHash(apiKeyHash string, signal models.TelemetrySignal) (*models.InfrastructureResource, error) {
	resource, err := m.repo.FindByApiKeyHash(apiKeyHash)
	if err != nil || resource == nil {
		return resource, err
	}
	if !resource.IsActive {
		return nil, ErrInactive
	}
	if signal != models.TelemetrySignalMetrics {
		return nil, ErrSignalDenied
	}
	if err := m.repo.MarkSeen(resource.ID, time.Now()); err != nil {
		return nil, err
	}
	return resource, nil
}
