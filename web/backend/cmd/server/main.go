package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"github.com/aiturn/everyup/internal/alerter"
	"github.com/aiturn/everyup/internal/api"
	"github.com/aiturn/everyup/internal/api/websocket"
	"github.com/aiturn/everyup/internal/checker"
	"github.com/aiturn/everyup/internal/collector"
	"github.com/aiturn/everyup/internal/config"
	"github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

func main() {
	// Load .env file if present (silent if not found — env vars take precedence)
	_ = godotenv.Load()

	// Parse command line flags
	configPath := flag.String("config", "", "Path to config file")
	flag.Parse()

	// Initialization dependency order:
	//   config → database → crypto/JWT (need DB) → admin user (need DB)
	//   → fiber/websocket → scheduler → hosts (need DB) → collectors
	//   → alerter + evaluators → routes → start all

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Starting EveryUp API Server...")
	log.Printf("Mode: %s", cfg.Server.Mode)

	// Connect to database
	if err := database.Connect(cfg.Database.Path); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()
	log.Printf("Database connected: %s", cfg.Database.Path)

	// Initialize encryption — loads key from env var, file, or DB (in priority order)
	if err := crypto.InitFromDB(database.DB); err != nil {
		log.Fatalf("Encryption init failed: %v", err)
	}

	// Initialize JWT signing secret — auto-generates on first run, loads from DB on subsequent runs
	if err := crypto.InitJWTSecret(database.DB); err != nil {
		log.Fatalf("JWT secret init failed: %v", err)
	}
	log.Printf("JWT: signing secret loaded (HMAC-SHA256, key managed in DB)")

	// Initialize admin account from env vars (EVERYUP_ADMIN_USERNAME + EVERYUP_ADMIN_PASSWORD)
	initAdminAccount(cfg)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:               "EveryUp API",
		DisableStartupMessage: cfg.Server.Mode == "production",
		BodyLimit:             4 * 1024 * 1024, // 4 MB
		// Decode percent-encoded path params (e.g. agent service keys like
		// "env:demo-prod" arrive as "env%3Ademo-prod"). Without this the colon
		// stays encoded and service lookups by key return NOT_FOUND.
		UnescapePath: true,
	})

	// Setup WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Add WebSocket route before other routes
	app.Use("/ws", websocket.WebSocketUpgrade())
	app.Get("/ws/metrics", hub.Handler())

	// Initialize scheduler
	scheduler := checker.NewScheduler()
	scheduler.SetBroadcast(hub.GetBroadcastFunc())

	// Auto-register local host
	hostRepo := database.NewHostRepository()
	localHosts, _ := hostRepo.GetByType(models.HostTypeLocal)
	var localHostID string
	if len(localHosts) == 0 {
		hostname, _ := os.Hostname()
		if hostname == "" {
			hostname = "localhost"
		}
		now := time.Now()
		localHost := &models.Host{
			ID:        "local",
			Name:      hostname,
			Type:      models.HostTypeLocal,
			IP:        getLocalIP(),
			Group:     "Local",
			IsActive:  true,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := hostRepo.Create(localHost); err != nil {
			log.Printf("Warning: failed to register local host: %v", err)
		} else {
			log.Printf("Local host registered: %s (%s)", localHost.Name, localHost.IP)
		}
		localHostID = localHost.ID
	} else {
		localHostID = localHosts[0].ID
		// Update IP on every restart — handles dynamic (DHCP) IP changes
		currentIP := getLocalIP()
		if localHosts[0].IP != currentIP {
			localHosts[0].IP = currentIP
			localHosts[0].UpdatedAt = time.Now()
			if err := hostRepo.Update(&localHosts[0]); err != nil {
				log.Printf("Warning: failed to update local host IP: %v", err)
			} else {
				log.Printf("Local host IP updated: %s", currentIP)
			}
		}
	}

	// Initialize CollectorManager
	collectorMgr := collector.NewCollectorManager(
		cfg.System.CollectInterval,
		cfg.System.StoreInterval,
	)
	collectorMgr.SetBroadcast(hub.GetBroadcastFunc())

	// Register local collector
	localCollector := collector.NewLocalCollector(localHostID)
	collectorMgr.Register(localCollector)

	// Wire up RuleEvaluator for resource alert rules
	alertMgr := alerter.NewManager()
	evaluator := alerter.NewRuleEvaluator(alertMgr, cfg.System.CollectInterval)
	collectorMgr.SetOnMetricCollected(evaluator.Evaluate)

	// Wire up ServiceRuleEvaluator for endpoint alert rules
	serviceEvaluator := alerter.NewServiceRuleEvaluator(alertMgr)
	scheduler.SetServiceEvaluator(serviceEvaluator)

	// Windowed API request rules (error rate, p95/p99) run on their own timer
	requestEvaluator := alerter.NewRequestRuleEvaluator(alertMgr)
	evalCtx, stopEval := context.WithCancel(context.Background())
	go requestEvaluator.Run(evalCtx)

	// Send server boot notification
	go alertMgr.DispatchBootNotification()

	if cfg.System.Enabled {
		collectorMgr.Start()
		log.Println("CollectorManager enabled")
	}

	// Setup API routes with scheduler, collector manager, and alert evaluators
	api.SetupRoutes(app, scheduler, collectorMgr, evaluator, serviceEvaluator, cfg.Server.AllowOrigins, cfg.Server.Mode)

	// Start scheduler with config services
	if err := scheduler.Start(cfg.Services); err != nil {
		log.Fatalf("Failed to start scheduler: %v", err)
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("Shutting down server...")
		stopEval()
		alertMgr.Shutdown()
		scheduler.Stop()
		collectorMgr.Stop()
		app.Shutdown()
	}()

	// Start server
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	log.Printf("Server listening on http://%s", addr)

	if err := app.Listen(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// initAdminAccount creates or resets the admin account from env vars.
// Set EVERYUP_ADMIN_USERNAME + EVERYUP_ADMIN_PASSWORD to trigger this on startup.
// In production mode, weak passwords are rejected at startup.
func initAdminAccount(cfg *config.Config) {
	adminUser := os.Getenv("EVERYUP_ADMIN_USERNAME")
	adminPass := os.Getenv("EVERYUP_ADMIN_PASSWORD")
	if adminUser == "" || adminPass == "" {
		return
	}

	if cfg.Server.Mode == "production" && (adminPass == "admin" || adminPass == "password" || adminPass == "changeme" || len(adminPass) < 8) {
		log.Fatalf("[SECURITY] Default or weak admin password is not allowed in production mode. " +
			"Set EVERYUP_ADMIN_PASSWORD to a strong password (at least 8 characters).")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash admin password: %v", err)
	}

	userRepo := database.NewUserRepository()
	if _, err := userRepo.Upsert(adminUser, string(hash), "admin"); err != nil {
		log.Fatalf("Failed to initialize admin user: %v", err)
	}
	log.Printf("Admin account initialized: %s", adminUser)
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
			if ipNet.IP.To4() != nil {
				return ipNet.IP.String()
			}
		}
	}
	return "127.0.0.1"
}
