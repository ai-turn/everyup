package telemetrygateway

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

// Forwarder sends raw OTLP/HTTP protobuf payloads to the upstream EveryUp Web.
type Forwarder interface {
	ForwardOTLPProtobuf(ctx context.Context, signal string, data []byte) ([]byte, error)
}

// ServiceResolver maps a container network identity — source IP of an inbound
// OTLP connection, or a server.address from an eBPF span (IP, container name,
// or compose service alias) — to the service name it belongs to, so telemetry
// can be attributed without the app setting OTEL_SERVICE_NAME. With a resolver,
// unknown senders are rejected and service.name is bound to the source. A nil
// resolver is used by profiles without Docker discovery; those profiles use
// a service token to authenticate and name the sender.
type ServiceResolver interface {
	ServiceNameByIP(ip string) (string, bool)
	IsObserverIP(ip string) bool
}

// PIDResolver maps a host-namespace PID to a service name. The bundled eBPF
// sidecar tags every resource with the instrumented process's PID
// (service.instance.id "host:pid"); Docker discovery knows which container —
// and therefore which service — that PID belongs to. Nil disables eBPF
// attribution (marked resources are then dropped as unresolvable).
type PIDResolver interface {
	ServiceNameByPID(pid int) (string, bool)
}

// TraceObserver is notified of the service names real spans were attributed to
// after a successful forward, so the access-log path can stop emitting
// synthetic spans for them (double-count guard). Nil disables notifications.
type TraceObserver interface {
	MarkTraced(service string)
}

type Server struct {
	addr        string
	forwarder   Forwarder
	resolver    ServiceResolver
	pids        PIDResolver
	observer    TraceObserver
	tokenSecret string
	server      *http.Server
}

func New(addr string, forwarder Forwarder, resolver ServiceResolver, pids PIDResolver, observer TraceObserver) *Server {
	if strings.TrimSpace(addr) == "" {
		addr = ":4318"
	}
	return &Server{addr: addr, forwarder: forwarder, resolver: resolver, pids: pids, observer: observer}
}

// RequireServiceTokens protects gateways that cannot use Docker source identity.
func (s *Server) RequireServiceTokens(secret string) {
	s.tokenSecret = secret
}

func (s *Server) Enabled() bool {
	return s != nil && s.forwarder != nil && strings.TrimSpace(s.addr) != ""
}

func (s *Server) Run(ctx context.Context) error {
	if !s.Enabled() {
		return nil
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/logs", s.handleOTLP("logs"))
	mux.HandleFunc("/v1/traces", s.handleOTLP("traces"))
	mux.HandleFunc("/v1/metrics", s.handleOTLP("metrics"))
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	s.server = &http.Server{
		Addr:              s.addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	listener, err := net.Listen("tcp", s.addr)
	if err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.server.Shutdown(shutdownCtx)
	}()

	log.Printf("EveryUp telemetry gateway listening on %s", s.addr)
	err = s.server.Serve(listener)
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) handleOTLP(signal string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", http.MethodPost)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !isProtobuf(r.Header.Get("Content-Type")) {
			http.Error(w, "expected application/x-protobuf", http.StatusUnsupportedMediaType)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, 4<<20+1))
		if err != nil {
			http.Error(w, fmt.Sprintf("read OTLP body: %v", err), http.StatusBadRequest)
			return
		}
		if len(body) > 4<<20 {
			http.Error(w, "OTLP request body exceeds 4 MiB limit", http.StatusRequestEntityTooLarge)
			return
		}
		if len(body) == 0 {
			http.Error(w, "empty OTLP body", http.StatusBadRequest)
			return
		}

		// Attribute the payload to a service. Traces get per-resource handling
		// (the eBPF sidecar batches many services into one request); logs keep
		// the connection-source-IP rule.
		payload := body
		var tracedServices []string
		connName, connOK := "", false
		if s.resolver != nil {
			sourceIP := clientIP(r.RemoteAddr)
			connName, connOK = s.resolver.ServiceNameByIP(sourceIP)
			if !connOK {
				http.Error(w, "telemetry source is not a discovered container", http.StatusForbidden)
				return
			}
			if signal == "traces" && hasEBPFSource(body) && !s.resolver.IsObserverIP(sourceIP) {
				http.Error(w, "eBPF telemetry source is not the observer", http.StatusForbidden)
				return
			}
		} else if s.tokenSecret != "" {
			parts := strings.Fields(r.Header.Get("Authorization"))
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				http.Error(w, "service token required", http.StatusUnauthorized)
				return
			}
			connName, connOK = serviceFromToken(s.tokenSecret, parts[1])
			if !connOK || signal == "traces" && hasEBPFSource(body) {
				http.Error(w, "invalid service token or telemetry source", http.StatusForbidden)
				return
			}
		}
		if signal == "traces" {
			enriched, services, forward := enrichTraces(body, connName, connOK, s.pids, s.resolver)
			if !forward {
				// Everything was dropped (unattributable eBPF noise): ack with
				// an empty success response so the sender doesn't retry.
				w.Header().Set("Content-Type", "application/x-protobuf")
				w.WriteHeader(http.StatusOK)
				return
			}
			payload = enriched
			tracedServices = services
		} else if signal == "metrics" {
			enriched, forward := enrichMetrics(body, connName, connOK)
			if !forward {
				w.Header().Set("Content-Type", "application/x-protobuf")
				w.WriteHeader(http.StatusOK)
				return
			}
			payload = enriched
		} else if connOK {
			if enriched, changed := injectServiceName(signal, body, connName); changed {
				payload = enriched
			}
		}

		upstreamBody, err := s.forwarder.ForwardOTLPProtobuf(r.Context(), signal, payload)
		if err != nil {
			log.Printf("telemetry gateway forward failed: signal=%s err=%v", signal, err)
			http.Error(w, "failed to forward OTLP payload", http.StatusBadGateway)
			return
		}
		if s.observer != nil {
			for _, service := range tracedServices {
				s.observer.MarkTraced(service)
			}
		}
		w.Header().Set("Content-Type", "application/x-protobuf")
		if len(upstreamBody) > 0 {
			_, _ = w.Write(upstreamBody)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func clientIP(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return strings.TrimSpace(remoteAddr)
	}
	return host
}

func isProtobuf(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	return contentType == "application/x-protobuf" || contentType == "application/protobuf"
}
