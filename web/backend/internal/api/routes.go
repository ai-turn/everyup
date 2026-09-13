package api

import (
	"net/http"

	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/api/handlers"
	"github.com/aiturn/everyup/internal/api/middleware"
	apiroutes "github.com/aiturn/everyup/internal/api/routes"
	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/collector"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
)

// SetupRoutes configures all API routes
func SetupRoutes(app *fiber.App, scheduler *checker.Scheduler, collectorMgr *collector.CollectorManager, ruleEvaluator *alerter.RuleEvaluator, serviceEvaluator *alerter.ServiceRuleEvaluator, allowOrigins string, serverMode string) {
	// Apply global middleware
	app.Use(middleware.Recovery())
	app.Use(middleware.Logger())
	app.Use(middleware.CORS(allowOrigins, serverMode))
	app.Use(middleware.SecurityHeaders(serverMode))

	// API routes
	api := app.Group("/api/v1")

	// Health endpoints — open to all
	healthHandler := handlers.NewHealthHandler()
	api.Get("/health", healthHandler.Health)
	api.Get("/version", healthHandler.Version)

	// Auth endpoints — public (no token required, rate-limited)
	authHandler := handlers.NewAuthHandler()
	authLimiter := middleware.AuthRateLimiter()
	api.Get("/auth/setup/status", authHandler.SetupStatus)
	api.Post("/auth/setup", authLimiter, authHandler.Setup)
	api.Post("/auth/login", authLimiter, authHandler.Login)
	api.Post("/auth/logout", authHandler.Logout)

	// Ingest routes are registered before the JWT group and isolated by prefix.
	apiroutes.RegisterIngestRoutes(api, ruleEvaluator)

	// Agent connected-mode sync routes use their own bearer token and stay
	// outside the JWT browser session group.
	agentHandler := handlers.NewAgentHandler()
	agentHandler.SetEvaluators(ruleEvaluator, serviceEvaluator)
	api.Get("/agents/install.sh", agentHandler.InstallScript)
	api.Get("/agents/otel.sh", agentHandler.OTelScript)
	api.Post("/agents/join", middleware.AgentJoinRateLimiter(), agentHandler.Join)
	api.Post("/agents/enroll", agentHandler.Enroll)
	api.Post("/agents/:agentId/services", agentHandler.SyncServices)
	api.Post("/agents/:agentId/events", agentHandler.SyncEvents)
	api.Post("/agents/:agentId/metrics", agentHandler.SyncMetrics)
	api.Post("/agents/:agentId/instrumentation-runs/:runId/report", agentHandler.ReportInstrumentationRun)

	// JWT-protected management routes
	local := api.Group("", middleware.JWTAuth())
	local.Post("/agents/:agentId/instrumentation-runs", agentHandler.CreateInstrumentationRun)
	local.Get("/agents/:agentId/instrumentation-runs/:runId", agentHandler.GetInstrumentationRun)

	// Auth endpoints — protected
	local.Get("/auth/verify", authHandler.Verify)
	local.Get("/auth/me", authHandler.Me)
	local.Post("/auth/reset", authHandler.Reset)

	// Independent HTTP/TCP uptime monitors are managed locally; Agent-synced
	// services remain on their separate Agent routes.
	serviceHandler := handlers.NewServiceHandler(scheduler)
	local.Get("/services", serviceHandler.GetAll)
	local.Post("/services", serviceHandler.Create)
	local.Get("/services/:id", serviceHandler.GetByID)
	local.Put("/services/:id", serviceHandler.Update)
	local.Delete("/services/:id", serviceHandler.Delete)
	projectHandler := handlers.NewProjectHandler()
	local.Get("/projects", projectHandler.GetAll)
	local.Post("/projects", projectHandler.Create)
	local.Put("/projects/:projectId", projectHandler.Update)
	local.Delete("/projects/:projectId", projectHandler.Delete)
	local.Put("/projects/:projectId/agents/:agentId", projectHandler.AssignAgent)
	local.Delete("/projects/:projectId/agents/:agentId", projectHandler.UnassignAgent)
	local.Put("/projects/:projectId/monitors/:monitorId", projectHandler.AssignMonitor)
	local.Delete("/projects/:projectId/monitors/:monitorId", projectHandler.UnassignMonitor)
	observedServiceHandler := handlers.NewObservedServiceHandler()
	local.Get("/observed-services", observedServiceHandler.GetAll)
	local.Post("/observed-services", observedServiceHandler.Create)
	local.Get("/observed-services/service-metrics", observedServiceHandler.GetServiceMetrics)
	local.Get("/observed-services/:id", observedServiceHandler.GetByID)
	local.Get("/observed-services/:id/setup-status", observedServiceHandler.SetupStatus)
	local.Put("/observed-services/:id", observedServiceHandler.Update)
	local.Delete("/observed-services/:id", observedServiceHandler.Delete)
	local.Post("/observed-services/:id/rotate-key", observedServiceHandler.RotateKey)
	local.Post("/observed-services/:id/revoke-key", observedServiceHandler.RevokeKey)
	local.Get("/observed-services/:id/logs", observedServiceHandler.GetLogs)
	local.Get("/observed-services/:id/log-histogram", observedServiceHandler.GetLogHistogram)
	local.Get("/observed-services/:id/log-filter", observedServiceHandler.GetLogFilter)
	local.Put("/observed-services/:id/log-filter", observedServiceHandler.SetLogFilter)
	local.Get("/observed-services/:id/otel-metrics", observedServiceHandler.GetOtelMetricNames)
	local.Get("/observed-services/:id/otel-metrics/points", observedServiceHandler.GetOtelMetricPoints)
	local.Get("/observed-services/:id/requests", observedServiceHandler.GetRequests)
	local.Get("/observed-services/:id/request-stats", observedServiceHandler.GetRequestStats)
	local.Get("/observed-services/:id/request-status-summary", observedServiceHandler.GetRequestStatusSummary)
	local.Get("/observed-services/:id/api-exclusions", observedServiceHandler.GetApiExclusions)
	local.Put("/observed-services/:id/api-exclusions", observedServiceHandler.SetApiExclusions)
	apiRequestsHandler := handlers.NewApiRequestsHandler()
	local.Get("/services/:id/api-requests", apiRequestsHandler.List)
	local.Get("/services/:id/api-requests/:reqId", apiRequestsHandler.GetByID)

	// Metric endpoints
	metricHandler := handlers.NewMetricHandler()
	local.Get("/services/:id/metrics", metricHandler.GetByServiceID)
	local.Get("/services/:id/metrics/summary", metricHandler.GetSummary)
	local.Get("/services/:id/uptime", metricHandler.GetUptime)
	local.Get("/metrics/recent", metricHandler.GetRecentChecks)
	local.Get("/metrics/failures", metricHandler.GetAllFailures)
	local.Get("/metrics/uptime-summary", metricHandler.GetUptimeSummaryAll)
	local.Get("/metrics/kpi", metricHandler.GetKpiSummary)

	// Log endpoints
	logHandler := handlers.NewLogHandler()
	local.Get("/logs", logHandler.GetAll)
	local.Get("/services/:id/logs", logHandler.GetByServiceID)

	// Trace correlation
	tracesHandler := handlers.NewTracesHandler()
	local.Get("/traces/:traceId", tracesHandler.GetByTraceID)

	// Audit trail (admin-only — captured-body access log)
	auditHandler := handlers.NewAuditHandler()
	local.Get("/audit", auditHandler.GetAll)

	// Dashboard endpoints
	dashboardHandler := handlers.NewDashboardHandler()
	local.Get("/dashboard/timeline", dashboardHandler.GetTimeline)

	// Incidents
	incidentHandler := handlers.NewIncidentHandler()
	local.Get("/incidents", incidentHandler.GetAll)

	// Host endpoints (read-only — write paths removed in agent-only architecture)
	hostHandler := handlers.NewHostHandler()
	local.Get("/hosts/summary", hostHandler.GetSummary)
	local.Get("/hosts", hostHandler.GetAll)
	local.Get("/hosts/:hostId", hostHandler.GetByID)

	// Host-scoped system resource monitoring
	systemHandler := handlers.NewSystemHandler(collectorMgr)
	local.Get("/hosts/:hostId/system/info", systemHandler.GetInfo)
	local.Get("/hosts/:hostId/system/metrics", systemHandler.GetMetricsHistory)
	local.Get("/hosts/:hostId/system/processes", systemHandler.GetProcesses)

	// Agent and standard OpenTelemetry Collector infrastructure resources.
	infrastructureHandler := handlers.NewInfrastructureResourceHandler()
	local.Get("/infrastructure-resources", infrastructureHandler.GetAll)
	local.Post("/infrastructure-resources", infrastructureHandler.Create)
	local.Get("/infrastructure-resources/:id", infrastructureHandler.GetByID)
	local.Get("/infrastructure-resources/:id/setup-status", infrastructureHandler.SetupStatus)
	local.Put("/infrastructure-resources/:id", infrastructureHandler.Update)
	local.Post("/infrastructure-resources/:id/rotate-key", infrastructureHandler.RotateKey)
	local.Post("/infrastructure-resources/:id/revoke-key", infrastructureHandler.RevokeKey)
	local.Delete("/infrastructure-resources/:id", infrastructureHandler.Delete)

	// Notifications
	notificationHandler := handlers.NewNotificationHandler()
	local.Get("/notifications", notificationHandler.GetAll)
	local.Get("/notifications/health", notificationHandler.GetHealth)
	local.Post("/notifications", notificationHandler.Create)
	local.Post("/notifications/test", notificationHandler.TestConfig)
	local.Put("/notifications/:id", notificationHandler.Update)
	local.Post("/notifications/:id/test", notificationHandler.Test)
	local.Post("/notifications/:id/toggle", notificationHandler.Toggle)
	local.Delete("/notifications/:id", notificationHandler.Delete)

	// Alert Rules
	alertRuleHandler := handlers.NewAlertRuleHandler()
	local.Get("/alert-rules", alertRuleHandler.GetAll)
	local.Get("/alert-rules/:id", alertRuleHandler.GetByID)
	local.Post("/alert-rules", alertRuleHandler.Create)
	local.Put("/alert-rules/:id", alertRuleHandler.Update)
	local.Delete("/alert-rules/:id", alertRuleHandler.Delete)
	local.Post("/alert-rules/:id/toggle", alertRuleHandler.Toggle)

	// Settings
	settingsHandler := handlers.NewSettingsHandler()
	local.Get("/settings", settingsHandler.Get)
	local.Get("/settings/connection", settingsHandler.Connection)
	local.Put("/settings", settingsHandler.Update)

	// Agent connected-mode read + management APIs (JWT-protected)
	local.Post("/agents", agentHandler.Create)
	local.Delete("/agents/:agentId", agentHandler.Delete)
	local.Get("/agents", agentHandler.GetAll)
	// /agents/services/all and /agents/overview must be registered before /:agentId routes to avoid param shadowing
	local.Get("/agents/services/all", agentHandler.GetAllServicesFlat)
	local.Get("/agents/overview", agentHandler.GetOverview)
	local.Get("/agents/:agentId/key", agentHandler.GetKey)
	local.Post("/agents/:agentId/rotate-key", agentHandler.RotateKey)
	local.Post("/agents/:agentId/join-code", agentHandler.IssueJoinCode)
	local.Get("/agents/:agentId/services", agentHandler.GetServices)
	local.Get("/agents/:agentId/setup-status", agentHandler.SetupStatus)
	local.Put("/agents/:agentId/profile", agentHandler.UpdateProfile)
	local.Delete("/agents/:agentId/services/:key", agentHandler.DeleteService)
	local.Get("/agents/:agentId/events", agentHandler.GetEvents)
	local.Get("/agents/:agentId/request-stats", agentHandler.GetAgentRequestStats)
	local.Get("/agents/:agentId/request-status-summary", agentHandler.GetAgentRequestStatusSummary)
	local.Get("/agents/:agentId/uptime", agentHandler.GetAgentUptime)
	local.Get("/agents/:agentId/incidents", agentHandler.GetAgentIncidents)
	local.Get("/agents/:agentId/service-metrics", agentHandler.GetAgentServiceMetrics)
	local.Get("/agents/:agentId/services/:key/history", agentHandler.GetServiceHistory)
	local.Get("/agents/:agentId/services/:key/uptime", agentHandler.GetServiceUptime)
	local.Get("/agents/:agentId/services/:key/events", agentHandler.GetServiceKeyEvents)
	local.Get("/agents/:agentId/services/:key/logs", agentHandler.GetServiceLogs)
	local.Get("/agents/:agentId/services/:key/log-histogram", agentHandler.GetServiceLogHistogram)
	local.Get("/agents/:agentId/services/:key/log-filter", agentHandler.GetServiceLogFilter)
	local.Put("/agents/:agentId/services/:key/log-filter", agentHandler.SetServiceLogFilter)
	local.Get("/agents/:agentId/services/:key/requests", agentHandler.GetServiceRequests)
	local.Get("/agents/:agentId/services/:key/request-stats", agentHandler.GetServiceRequestStats)
	local.Get("/agents/:agentId/services/:key/request-status-summary", agentHandler.GetServiceRequestStatusSummary)
	local.Get("/agents/:agentId/services/:key/otel-metrics", agentHandler.GetServiceOtelMetricNames)
	local.Get("/agents/:agentId/services/:key/otel-metrics/points", agentHandler.GetServiceOtelMetricPoints)

	// Notification History
	notificationHistoryHandler := handlers.NewNotificationHistoryHandler()
	local.Get("/notification-history", notificationHistoryHandler.GetAll)
	local.Get("/notification-history/stats", notificationHistoryHandler.GetStats)
	local.Get("/notification-history/:id", notificationHistoryHandler.GetByID)
	local.Delete("/notification-history/cleanup", notificationHistoryHandler.Cleanup)

	// Serve static files for frontend (SPA fallback)
	app.Use("/", filesystem.New(filesystem.Config{
		Root:         http.Dir("./web"),
		Browse:       false,
		Index:        "index.html",
		NotFoundFile: "index.html",
	}))
}
