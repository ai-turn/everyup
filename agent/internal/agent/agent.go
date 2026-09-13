package agent

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/aiturn/everyup/agent/internal/capabilities"
	"github.com/aiturn/everyup/agent/internal/checks"
	"github.com/aiturn/everyup/agent/internal/config"
	"github.com/aiturn/everyup/agent/internal/discovery"
	"github.com/aiturn/everyup/agent/internal/hostmetrics"
	"github.com/aiturn/everyup/agent/internal/otelconfig"
	"github.com/aiturn/everyup/agent/internal/state"
	"github.com/aiturn/everyup/agent/internal/telemetrygateway"
	"github.com/aiturn/everyup/agent/internal/watchdog"
	"github.com/aiturn/everyup/agent/internal/webclient"
)

type Agent struct {
	cfg         config.Config
	httpCheck   *checks.HTTPChecker
	docker      *discovery.DockerClient
	store       *state.Store
	audit       *state.AuditLogger
	web         *webclient.Client
	webAgentID  string
	heartbeat   *watchdog.Heartbeat
	hostMetrics *hostmetrics.Reader
	// hostAlertReader is a separate Reader for the resource-threshold check so its
	// CPU/net delta baseline isn't shared with hostMetrics (different sample cadences).
	hostAlertReader *hostmetrics.Reader
	gateway         *telemetrygateway.Server
	ipIndex         *serviceIPIndex
	pidIndex        *servicePIDIndex
	traced          *tracedServices

	mu         sync.RWMutex
	states     map[string]*targetState
	logCursors map[string]state.LogCursor
	webEvents  []state.AuditEvent
	// runtimes maps service name -> detected language runtime ("java", "node",
	// ...), refreshed from Docker process listings each check cycle and synced
	// to Web so the UI can show runtime-specific OTel setup guidance.
	runtimes map[string]string
}

type targetState struct {
	lastAlertAt     time.Time
	lastHostAlertAt time.Time
	lastDockerLogAt time.Time
	wasHealthy      bool
	seenResult      bool
	updatedAt       time.Time
	serviceName     string
	checkType       string
	endpoint        string
	lastError       string
	lastStatus      int
	lastLatency     string
}

// serviceStatus is a point-in-time view of one monitored target, synced to
// EveryUp Web where alerting and notification dispatch happen.
type serviceStatus struct {
	Key         string
	Name        string
	CheckType   string
	Endpoint    string
	Healthy     bool
	Seen        bool
	Silenced    bool
	LastError   string
	LastStatus  int
	LastLatency string
	UpdatedAt   time.Time
}

type agentSnapshot struct {
	AgentName string
	Now       time.Time
	Services  []serviceStatus
}

func New(cfg config.Config) (*Agent, error) {
	var docker *discovery.DockerClient
	if cfg.DockerDiscoveryEnabled {
		docker = discovery.NewDockerClient(cfg.DockerSocketPath, cfg.HTTPTimeout)
	}
	var web *webclient.Client
	if cfg.WebSyncEnabled || cfg.WebBaseURL != "" {
		web = webclient.New(cfg.WebBaseURL, cfg.AgentAPIKey, cfg.HTTPTimeout, nil)
	}
	var heartbeat *watchdog.Heartbeat
	if cfg.HeartbeatURL != "" {
		heartbeat = watchdog.NewHeartbeat(cfg.HeartbeatURL, cfg.HeartbeatToken, cfg.HTTPTimeout, nil)
	}
	var hostReader, hostAlertReader *hostmetrics.Reader
	if cfg.HostMetricsEnabled {
		hostReader = hostmetrics.New(cfg.HostMetricsRoot, cfg.HostDiskPath)
		hostAlertReader = hostmetrics.New(cfg.HostMetricsRoot, cfg.HostDiskPath)
	}
	ipIndex := newServiceIPIndex()
	pidIndex := newServicePIDIndex(cfg.HostMetricsRoot)
	traced := newTracedServices(10 * time.Minute)
	var gateway *telemetrygateway.Server
	if cfg.TelemetryGatewayEnabled && web != nil && web.Enabled() {
		gateway = telemetrygateway.New(cfg.TelemetryGatewayListenAddr, web, ipIndex, pidIndex, traced)
	}

	agent := &Agent{
		cfg:             cfg,
		httpCheck:       checks.NewHTTPChecker(cfg.HTTPTimeout),
		docker:          docker,
		store:           state.NewStore(filepath.Join(cfg.DataDir, "agent-state.json")),
		audit:           state.NewAuditLogger(filepath.Join(cfg.DataDir, "audit.jsonl")),
		web:             web,
		webAgentID:      cfg.WebAgentID,
		heartbeat:       heartbeat,
		hostMetrics:     hostReader,
		hostAlertReader: hostAlertReader,
		gateway:         gateway,
		ipIndex:         ipIndex,
		pidIndex:        pidIndex,
		traced:          traced,
		states:          make(map[string]*targetState),
		logCursors:      make(map[string]state.LogCursor),
		webEvents:       make([]state.AuditEvent, 0),
		runtimes:        make(map[string]string),
	}

	return agent, nil
}

func (a *Agent) Run(ctx context.Context) error {
	log.Printf("EveryUp Docker collector starting: name=%s service=%s", a.cfg.AgentName, a.cfg.ServiceName)
	if err := a.loadState(); err != nil {
		log.Printf("failed to load local state: %v", err)
	}
	a.writeOTelConfig()
	a.syncInstrumentationVolume()

	a.auditEvent("agent_started", a.cfg.ServiceName, "", fmt.Sprintf("Docker collector %s is running.", a.cfg.AgentName), nil)
	a.startWebSync(ctx)
	a.startTelemetryGateway(ctx)
	a.startHeartbeat(ctx)

	a.runChecks(ctx)
	ticker := time.NewTicker(a.cfg.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			a.runChecks(ctx)
		}
	}
}

func (a *Agent) startWebSync(ctx context.Context) {
	if !a.cfg.WebSyncEnabled {
		log.Printf("EveryUp Web sync disabled")
		return
	}
	if a.web == nil || !a.web.Enabled() {
		log.Printf("EveryUp Web sync is enabled but web client is not configured")
		return
	}

	go func() {
		a.enrollWeb(ctx)
		a.flushWebServices(ctx)
		a.flushWebEvents(ctx)
		ticker := time.NewTicker(a.cfg.WebSyncInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				a.enrollWeb(ctx)
				a.flushWebServices(ctx)
				a.flushWebEvents(ctx)
				a.flushWebMetrics(ctx)
			}
		}
	}()
	log.Printf("EveryUp Web sync enabled")
}

func (a *Agent) startTelemetryGateway(ctx context.Context) {
	if a.gateway == nil || !a.gateway.Enabled() {
		log.Printf("Telemetry gateway disabled")
		return
	}
	go func() {
		if err := a.gateway.Run(ctx); err != nil {
			log.Printf("telemetry gateway stopped with error: %v", err)
			a.auditEvent("telemetry_gateway_failed", "", "", err.Error(), nil)
		}
	}()
	log.Printf("Telemetry gateway enabled: listen=%s", a.cfg.TelemetryGatewayListenAddr)
}
func (a *Agent) startHeartbeat(ctx context.Context) {
	if a.heartbeat == nil || !a.heartbeat.Enabled() {
		log.Printf("Heartbeat watchdog disabled")
		return
	}

	go a.heartbeat.Run(ctx, a.cfg.HeartbeatInterval, func(err error) {
		log.Printf("heartbeat failed: %v", err)
		a.auditEvent("heartbeat_failed", "", "", err.Error(), nil)
	})
	log.Printf("Heartbeat watchdog enabled")
	a.auditEvent("heartbeat_started", "", "", "heartbeat watchdog enabled", map[string]interface{}{
		"url":      a.cfg.HeartbeatURL,
		"interval": a.cfg.HeartbeatInterval.String(),
	})
}

func (a *Agent) enrollWeb(ctx context.Context) {
	if a.webAgentID != "" {
		return
	}
	enrolled, err := a.web.Enroll(ctx, webclient.EnrollmentRequest{
		AgentName: a.cfg.AgentName,
		Version:   "dev",
	})
	if err != nil {
		log.Printf("EveryUp Web enrollment failed: %v", err)
		a.auditEvent("web_enrollment_failed", "", "", err.Error(), nil)
		return
	}
	a.webAgentID = enrolled.AgentID
	log.Printf("EveryUp Web enrollment complete: agentID=%s", a.webAgentID)
	a.auditEvent("web_enrolled", "", "", "EveryUp Web enrollment complete", map[string]interface{}{
		"agentID": a.webAgentID,
	})
}

func (a *Agent) flushWebEvents(ctx context.Context) {
	if a.web == nil || !a.web.Enabled() || a.webAgentID == "" {
		return
	}

	a.mu.Lock()
	if len(a.webEvents) == 0 {
		a.mu.Unlock()
		return
	}
	events := append([]state.AuditEvent(nil), a.webEvents...)
	a.webEvents = a.webEvents[:0]
	a.mu.Unlock()

	if err := a.web.SendEvents(ctx, webclient.EventRequest{AgentID: a.webAgentID, Events: events}); err != nil {
		log.Printf("EveryUp Web event sync failed: %v", err)
		a.mu.Lock()
		a.webEvents = append(events, a.webEvents...)
		if len(a.webEvents) > 500 {
			a.webEvents = a.webEvents[len(a.webEvents)-500:]
		}
		a.mu.Unlock()
		return
	}
	log.Printf("synced %d events to EveryUp Web", len(events))
}

func (a *Agent) flushWebServices(ctx context.Context) {
	if a.web == nil || !a.web.Enabled() || a.webAgentID == "" {
		return
	}

	snapshot := a.snapshot(ctx)
	// Container provenance (image/restart count/uptime) for the service header;
	// best-effort, keyed by the same stable service key as the snapshot.
	var meta map[string]discovery.ContainerMeta
	dockerReachable := false
	observerState := ""
	observerFound := false
	if a.docker != nil {
		if m, err := a.docker.ContainerMetaMap(ctx); err != nil {
			log.Printf("container meta collection failed: %v", err)
		} else {
			meta = m
			dockerReachable = true
		}
		if state, found, err := a.docker.ContainerStateByName(ctx, "everyup-ebpf"); err != nil {
			log.Printf("eBPF observer state collection failed: %v", err)
		} else {
			dockerReachable = true
			observerState = state
			observerFound = found
		}
	}
	report := capabilities.Check(capabilities.Inputs{
		HostRoot:                  a.cfg.HostMetricsRoot,
		DockerEnabled:             a.cfg.DockerDiscoveryEnabled,
		DockerReachable:           dockerReachable,
		HostMetricsEnabled:        a.cfg.HostMetricsEnabled,
		ObserverFound:             observerFound,
		ObserverState:             observerState,
		ContextPropagationEnabled: a.cfg.EBPFContextPropagationEnabled,
		Now:                       snapshot.Now,
	})
	services := make([]webclient.ServiceSnapshot, 0, len(snapshot.Services))
	for _, service := range snapshot.Services {
		m := meta[service.Key]
		services = append(services, webclient.ServiceSnapshot{
			Key:          service.Key,
			Name:         service.Name,
			CheckType:    service.CheckType,
			Endpoint:     service.Endpoint,
			Runtime:      a.runtimeOf(service.Name),
			Image:        m.Image,
			RestartCount: m.RestartCount,
			StartedAt:    m.StartedAt,
			Healthy:      service.Healthy,
			Seen:         service.Seen,
			Silenced:     service.Silenced,
			LastError:    service.LastError,
			LastStatus:   service.LastStatus,
			LastLatency:  service.LastLatency,
			UpdatedAt:    service.UpdatedAt,
		})
	}

	err := a.web.SendServices(ctx, webclient.ServiceSnapshotRequest{
		ConfigHash:   a.cfg.ConfigHash,
		AgentID:      a.webAgentID,
		AgentName:    snapshot.AgentName,
		ObservedAt:   snapshot.Now,
		Services:     services,
		Capabilities: report,
	})
	if err != nil {
		log.Printf("EveryUp Web service sync failed: %v", err)
		a.auditEvent("web_services_sync_failed", "", "", err.Error(), map[string]interface{}{
			"serviceCount": len(services),
		})
		return
	}
	log.Printf("synced %d services to EveryUp Web", len(services))
}

func (a *Agent) flushWebMetrics(ctx context.Context) {
	if a.web == nil || !a.web.Enabled() || a.webAgentID == "" || a.hostMetrics == nil {
		return
	}
	snapshot, err := a.hostMetrics.Snapshot(ctx)
	if err != nil {
		log.Printf("EveryUp Web metrics snapshot failed: %v", err)
		return
	}
	if err := a.web.SendMetrics(ctx, webclient.MetricsRequest{
		AgentID:    a.webAgentID,
		CPUUsage:   snapshot.CPUPercent,
		MemTotal:   snapshot.MemTotalGB,
		MemUsed:    snapshot.MemUsedGB,
		MemUsage:   snapshot.MemoryPercent,
		DiskTotal:  snapshot.DiskTotalGB,
		DiskUsed:   snapshot.DiskUsedGB,
		DiskUsage:  snapshot.DiskPercent,
		NetIn:      snapshot.NetInMBps,
		NetOut:     snapshot.NetOutMBps,
		RecordedAt: time.Now(),
	}); err != nil {
		log.Printf("EveryUp Web metrics sync failed: %v", err)
	}
}

func (a *Agent) writeOTelConfig() {
	if !a.cfg.OTelConfigEnabled {
		log.Printf("OTel config generation disabled")
		return
	}

	err := otelconfig.WriteFile(otelconfig.Options{
		ServiceName:     a.cfg.ServiceName,
		OutputPath:      a.cfg.OTelConfigPath,
		ConfDir:         a.cfg.OTelConfDir,
		FileLogInclude:  a.cfg.OTelFileLogPaths,
		WebOTLPEndpoint: a.cfg.WebOTLPEndpoint,
		// One project key: the same evup_svc_ key used for web sync also
		// authenticates the generated collector's OTLP push.
		WebAPIKey: a.cfg.AgentAPIKey,
	})
	if err != nil {
		log.Printf("failed to generate OTel collector config: %v", err)
		a.auditEvent("otel_config_failed", a.cfg.ServiceName, "", err.Error(), map[string]interface{}{
			"path": a.cfg.OTelConfigPath,
		})
		return
	}

	log.Printf("generated OTel collector config at %s", a.cfg.OTelConfigPath)
	a.auditEvent("otel_config_generated", a.cfg.ServiceName, "", "generated OTel collector config", map[string]interface{}{
		"path": a.cfg.OTelConfigPath,
	})
}

func (a *Agent) runChecks(ctx context.Context) {
	targets := a.targets(ctx)
	if targets == nil {
		a.runHostResourceCheck(ctx)
		return
	}
	a.refreshServiceIPIndex(ctx)
	a.pruneStaleStates(targets)
	if len(targets) == 0 {
		log.Printf("no Docker containers found; check the Docker socket mount or EVERYUP_HEALTH_URL")
		a.runHostResourceCheck(ctx)
		return
	}

	for _, target := range healthCheckTargets(targets) {
		a.runCheck(ctx, target)
	}
	a.forwardDockerLogs(ctx, targets)
	a.runHostResourceCheck(ctx)
}

// Keep stable service health while collecting every replica's logs. Any stopped
// replica makes the group unhealthy, independent of Docker's listing order.
func healthCheckTargets(targets []discovery.Target) []discovery.Target {
	checks := make([]discovery.Target, 0, len(targets))
	indexes := make(map[string]int)
	for _, target := range targets {
		key := targetKey(target)
		if index, exists := indexes[key]; exists {
			if target.HealthType == "docker" && target.State != "running" {
				checks[index] = target
			}
			continue
		}
		indexes[key] = len(checks)
		checks = append(checks, target)
	}
	return checks
}

// refreshServiceIPIndex rebuilds the IP->service and PID->service maps the
// telemetry gateway uses to attribute inbound OTLP (source IP for app SDKs,
// host PID for the eBPF sidecar). Skipped when the gateway is disabled.
// ponytail: separate /containers/json call from targets(); one extra socket GET
// per check cycle is negligible. Fold into targets() if discovery ever gets hot.
func (a *Agent) refreshServiceIPIndex(ctx context.Context) {
	if a.gateway == nil || a.docker == nil || a.ipIndex == nil {
		return
	}
	m, err := a.docker.ServiceIPMap(ctx)
	if err != nil {
		log.Printf("service IP index refresh failed: %v", err)
		return
	}
	a.ipIndex.replace(m)

	if a.pidIndex == nil {
		return
	}
	pids, runtimes, err := a.docker.ServiceProcessMaps(ctx)
	if err != nil {
		log.Printf("service PID index refresh failed: %v", err)
		return
	}
	a.pidIndex.replace(pids)
	a.mu.Lock()
	a.runtimes = runtimes
	a.mu.Unlock()
}

// runtimeOf returns the detected language runtime for a service ("" = unknown).
func (a *Agent) runtimeOf(serviceName string) string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.runtimes[serviceName]
}

func (a *Agent) targets(ctx context.Context) []discovery.Target {
	targets := make([]discovery.Target, 0)
	if a.cfg.HealthURL != "" {
		targets = append(targets, discovery.Target{
			ID:          "env:" + a.cfg.ServiceName,
			ServiceName: a.cfg.ServiceName,
			HealthType:  "http",
			HealthURL:   a.cfg.HealthURL,
		})
	}

	if a.docker == nil {
		return targets
	}

	discovered, err := a.docker.ListTargets(ctx)
	if err != nil {
		log.Printf("docker discovery failed: %v", err)
		return nil
	}

	seen := make(map[string]bool, len(targets)+len(discovered))
	for _, target := range targets {
		seen[target.ID] = true
	}
	selfHost, _ := os.Hostname()
	for _, target := range discovered {
		key := target.ID
		if seen[key] {
			continue
		}
		if excludedTarget(target, a.cfg.ExcludeNames, selfHost) {
			continue
		}
		seen[key] = true
		targets = append(targets, target)
	}
	return targets
}

// excludedTarget reports whether a discovered container should be skipped:
// the agent's own container (in Docker, the hostname defaults to the short
// container ID, so it prefixes the full ID) or any container whose service
// name contains an EVERYUP_EXCLUDE pattern (case-insensitive).
func excludedTarget(target discovery.Target, patterns []string, selfHost string) bool {
	if len(selfHost) >= 12 && strings.HasPrefix(target.ID, selfHost) {
		return true
	}
	name := strings.ToLower(target.ServiceName)
	for _, p := range patterns {
		if p = strings.ToLower(strings.TrimSpace(p)); p != "" && strings.Contains(name, p) {
			return true
		}
	}
	return false
}

// pruneStaleStates drops in-memory state for targets no longer discovered, so
// the agent stops reporting (and Web stops showing) genuinely removed services.
// Keys are stable (see discovery.stableServiceKey), so a container recreated by
// `docker compose up` keeps the same key and is NOT pruned; only a removed or
// relabeled service drops out. host:metrics is internal host state, not a
// discovery target, so it is always retained.
// Call only after successful discovery; a failed query does not prove removal.
func (a *Agent) pruneStaleStates(targets []discovery.Target) {
	live := map[string]bool{"host:metrics": true}
	liveContainers := make(map[string]bool, len(targets))
	for _, target := range targets {
		live[targetKey(target)] = true
		liveContainers[target.ID] = true
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	for id := range a.logCursors {
		if !liveContainers[id] {
			delete(a.logCursors, id)
		}
	}
	for key := range a.states {
		if !live[key] {
			delete(a.states, key)
		}
	}
}

func (a *Agent) runCheck(ctx context.Context, target discovery.Target) {
	if target.HealthType == "docker" {
		a.runDockerLivenessCheck(target)
		return
	}
	result := a.httpCheck.Check(ctx, target.HealthURL)
	log.Printf("health check: service=%s url=%s healthy=%t status=%d latency=%s error=%s",
		target.ServiceName, result.URL, result.Healthy, result.StatusCode, result.Latency, result.Error)

	now := time.Now()
	state := a.observeTarget(target, result.Healthy, result.StatusCode, result.Latency, result.Error)
	if result.Healthy {
		if state.seenResult && !state.wasHealthy {
			a.auditEvent("recovery_sent", target.ServiceName, targetKey(target), "service recovered", map[string]interface{}{
				"url":     target.HealthURL,
				"latency": result.Latency.String(),
			})
		}
		a.setTargetResult(target, state.lastAlertAt, true, true, now)
		a.saveState()
		return
	}

	shouldAlert := !state.seenResult || state.wasHealthy || now.Sub(state.lastAlertAt) >= a.cfg.AlertCooldown
	lastAlertAt := state.lastAlertAt
	if shouldAlert {
		body := failureBody(result)
		a.auditEvent("alert_sent", target.ServiceName, targetKey(target), body, map[string]interface{}{
			"url":        target.HealthURL,
			"statusCode": result.StatusCode,
			"latency":    result.Latency.String(),
		})
		lastAlertAt = now
	}
	a.setTargetResult(target, lastAlertAt, false, true, now)
	a.saveState()
}

// runDockerLivenessCheck reports up/down straight from the container state
// captured during discovery; no health endpoint required. running = alive;
// anything else (exited, dead, created, etc.) = down, with the Docker status line
// as the reason.
func (a *Agent) runDockerLivenessCheck(target discovery.Target) {
	healthy := target.State == "running"
	log.Printf("docker liveness: service=%s state=%s healthy=%t", target.ServiceName, target.State, healthy)

	now := time.Now()
	errText := ""
	if !healthy {
		errText = strings.TrimSpace(target.StatusText)
		if errText == "" {
			errText = "container state: " + target.State
		}
	}
	state := a.observeTarget(target, healthy, 0, 0, errText)
	if healthy {
		if state.seenResult && !state.wasHealthy {
			a.auditEvent("recovery_sent", target.ServiceName, targetKey(target), "service recovered", map[string]interface{}{
				"state": target.State,
			})
		}
		a.setTargetResult(target, state.lastAlertAt, true, true, now)
		a.saveState()
		return
	}

	shouldAlert := !state.seenResult || state.wasHealthy || now.Sub(state.lastAlertAt) >= a.cfg.AlertCooldown
	lastAlertAt := state.lastAlertAt
	if shouldAlert {
		body := fmt.Sprintf("%s is not running (%s)", target.ServiceName, errText)
		a.auditEvent("alert_sent", target.ServiceName, targetKey(target), body, map[string]interface{}{
			"state":  target.State,
			"status": target.StatusText,
		})
		lastAlertAt = now
	}
	a.setTargetResult(target, lastAlertAt, false, true, now)
	a.saveState()
}

func (a *Agent) observeTarget(target discovery.Target, healthy bool, statusCode int, latency time.Duration, errText string) targetState {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := targetKey(target)
	state, ok := a.states[key]
	if !ok {
		state = &targetState{wasHealthy: true}
		a.states[key] = state
	}
	state.serviceName = target.ServiceName
	state.checkType = target.HealthType
	state.endpoint = target.HealthURL
	state.lastStatus = statusCode
	state.lastLatency = latency.Round(time.Microsecond).String()
	state.lastError = errText
	if healthy {
		state.lastError = ""
	}
	return *state
}

func (a *Agent) setTargetResult(target discovery.Target, lastAlertAt time.Time, wasHealthy bool, seenResult bool, updatedAt time.Time) {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := targetKey(target)
	state, ok := a.states[key]
	if !ok {
		state = &targetState{}
		a.states[key] = state
	}
	state.lastAlertAt = lastAlertAt
	state.wasHealthy = wasHealthy
	state.seenResult = seenResult
	state.updatedAt = updatedAt
}

func (a *Agent) loadState() error {
	snapshot, err := a.store.Load()
	if err != nil {
		return err
	}
	a.logCursors = snapshot.LogCursors
	if a.logCursors == nil {
		a.logCursors = make(map[string]state.LogCursor)
	}
	for key, persisted := range snapshot.Targets {
		a.states[key] = &targetState{
			serviceName:     persisted.ServiceName,
			checkType:       persisted.CheckType,
			endpoint:        persisted.Endpoint,
			lastAlertAt:     persisted.LastAlertAt,
			lastHostAlertAt: persisted.LastHostAlertAt,
			lastDockerLogAt: persisted.LastDockerLogAt,
			wasHealthy:      persisted.WasHealthy,
			seenResult:      persisted.SeenResult,
			updatedAt:       persisted.UpdatedAt,
		}
	}
	log.Printf("loaded %d persisted target states", len(a.states))
	return nil
}

func (a *Agent) saveState() error {
	a.mu.RLock()
	defer a.mu.RUnlock()
	snapshot := state.Snapshot{
		Version:    1,
		Targets:    make(map[string]state.TargetState, len(a.states)),
		LogCursors: a.logCursors,
	}
	for key, current := range a.states {
		snapshot.Targets[key] = state.TargetState{
			ServiceName:     current.serviceName,
			CheckType:       current.checkType,
			Endpoint:        current.endpoint,
			LastAlertAt:     current.lastAlertAt,
			LastHostAlertAt: current.lastHostAlertAt,
			LastDockerLogAt: current.lastDockerLogAt,
			WasHealthy:      current.wasHealthy,
			SeenResult:      current.seenResult,
			UpdatedAt:       current.updatedAt,
		}
	}
	if err := a.store.Save(snapshot); err != nil {
		log.Printf("failed to save local state: %v", err)
		return err
	}
	return nil
}

func (a *Agent) runHostResourceCheck(ctx context.Context) {
	if a.hostAlertReader == nil {
		return
	}
	cpuThreshold := a.cfg.HostCPUPercent
	memoryThreshold := a.cfg.HostMemoryPercent
	diskThreshold := a.cfg.HostDiskPercent
	if cpuThreshold == 0 && memoryThreshold == 0 && diskThreshold == 0 {
		return
	}
	snapshot, err := a.hostAlertReader.Snapshot(ctx)
	if err != nil {
		a.auditEvent("host_resource_scan_failed", a.cfg.ServiceName, "host:metrics", err.Error(), nil)
		return
	}
	violations := hostResourceViolations(snapshot, cpuThreshold, memoryThreshold, diskThreshold)
	if len(violations) == 0 {
		return
	}

	now := time.Now()
	if !a.hostAlertDue(now) {
		return
	}
	body := fmt.Sprintf("Host resource threshold exceeded:\n%s", strings.Join(violations, "\n"))
	a.auditEvent("alert_sent", "host", "host:metrics", body, map[string]interface{}{
		"source":        "host_resource_threshold",
		"violations":    violations,
		"cpuPercent":    snapshot.CPUPercent,
		"memoryPercent": snapshot.MemoryPercent,
		"diskPercent":   snapshot.DiskPercent,
	})
	a.setHostAlertAt(now)
	a.saveState()
}

func hostResourceViolations(snapshot hostmetrics.Snapshot, cpuThreshold, memoryThreshold, diskThreshold float64) []string {
	violations := make([]string, 0, 3)
	if cpuThreshold > 0 && snapshot.CPUPercent >= cpuThreshold {
		violations = append(violations, fmt.Sprintf("host cpu %.1f%% >= %.1f%%", snapshot.CPUPercent, cpuThreshold))
	}
	if memoryThreshold > 0 && snapshot.MemoryPercent >= memoryThreshold {
		violations = append(violations, fmt.Sprintf("host memory %.1f%% >= %.1f%%", snapshot.MemoryPercent, memoryThreshold))
	}
	if diskThreshold > 0 && snapshot.DiskPercent >= diskThreshold {
		violations = append(violations, fmt.Sprintf("host disk %.1f%% >= %.1f%%", snapshot.DiskPercent, diskThreshold))
	}
	return violations
}

func (a *Agent) targetState(target discovery.Target) targetState {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if state, ok := a.states[targetKey(target)]; ok {
		return *state
	}
	return targetState{}
}

func (a *Agent) hostAlertDue(now time.Time) bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	state, ok := a.states["host:metrics"]
	if !ok || state.lastHostAlertAt.IsZero() {
		return true
	}
	return now.Sub(state.lastHostAlertAt) >= a.cfg.AlertCooldown
}

func (a *Agent) setHostAlertAt(at time.Time) {
	a.mu.Lock()
	defer a.mu.Unlock()
	state, ok := a.states["host:metrics"]
	if !ok {
		state = &targetState{serviceName: "host", checkType: "hostmetrics", endpoint: a.cfg.HostMetricsRoot}
		a.states["host:metrics"] = state
	}
	state.lastHostAlertAt = at
	state.updatedAt = at
}

// snapshot returns the current per-target status list for syncing to EveryUp Web.
func (a *Agent) snapshot(ctx context.Context) agentSnapshot {
	a.mu.RLock()
	defer a.mu.RUnlock()

	services := make([]serviceStatus, 0, len(a.states))
	now := time.Now()
	for key, current := range a.states {
		services = append(services, serviceStatus{
			Key:         key,
			Name:        valueOrDefault(current.serviceName, key),
			CheckType:   current.checkType,
			Endpoint:    current.endpoint,
			Healthy:     current.wasHealthy,
			Seen:        current.seenResult,
			Silenced:    false,
			LastError:   current.lastError,
			LastStatus:  current.lastStatus,
			LastLatency: current.lastLatency,
			UpdatedAt:   current.updatedAt,
		})
	}

	return agentSnapshot{
		AgentName: a.cfg.AgentName,
		Now:       now,
		Services:  services,
	}
}

func (a *Agent) auditEvent(eventType, serviceName, key, message string, metadata map[string]interface{}) {
	event := state.AuditEvent{
		Time:        time.Now(),
		Type:        eventType,
		ServiceName: serviceName,
		TargetKey:   key,
		Message:     message,
		Metadata:    metadata,
	}
	if err := a.audit.Append(event); err != nil {
		log.Printf("failed to append audit event: %v", err)
	}
	a.enqueueWebEvent(event)
}

func (a *Agent) enqueueWebEvent(event state.AuditEvent) {
	if !a.cfg.WebSyncEnabled {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	a.webEvents = append(a.webEvents, event)
	if len(a.webEvents) > 500 {
		a.webEvents = a.webEvents[len(a.webEvents)-500:]
	}
}

func targetKey(target discovery.Target) string {
	if target.Key != "" {
		return target.Key
	}
	if target.ID != "" {
		return target.ID
	}
	return target.ServiceName + "|" + target.HealthURL
}

func failureBody(result checks.HTTPResult) string {
	if result.Error != "" {
		return fmt.Sprintf("%s failed: %s", result.URL, result.Error)
	}
	return fmt.Sprintf("%s returned status %d in %s", result.URL, result.StatusCode, result.Latency.Round(time.Millisecond))
}

// levelTokenRe matches a standalone log-level word. Word boundaries keep
// substrings like "ERROR_MESSAGE" inside a SQL statement from being mistaken
// for a real level (\bERROR\b does not match within ERROR_MESSAGE).
var levelTokenRe = regexp.MustCompile(`(?i)\b(panic|fatal|exception|error|warning|warn|debug|trace|info)\b`)

func inferLogSeverity(message string) (string, int) {
	// The level lives in the log prefix, not buried in the payload. Scan only
	// the head so an "error" mentioned in a message body or a column name like
	// ERROR_MESSAGE is ignored, and the actual leading level token wins.
	head := message
	if len(head) > 80 {
		head = head[:80]
	}
	switch strings.ToLower(levelTokenRe.FindString(head)) {
	case "panic", "fatal", "exception", "error":
		return "ERROR", 17
	case "warning", "warn":
		return "WARN", 13
	case "debug":
		return "DEBUG", 5
	case "trace":
		return "TRACE", 1
	default:
		return "INFO", 9
	}
}
func trimText(value string, limit int) string {
	value = strings.ToValidUTF8(strings.TrimSpace(value), "�")
	if limit <= 0 || len(value) <= limit {
		return value
	}
	for !utf8.RuneStart(value[limit]) {
		limit--
	}
	return value[:limit] + "..."
}

func valueOrDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
