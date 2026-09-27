package agent

import "sync"

// serviceIPIndex is a concurrency-safe IP -> service-name lookup, refreshed from
// Docker discovery each check cycle. The telemetry gateway reads it to attribute
// an inbound OTLP connection to a service without the app setting
// OTEL_SERVICE_NAME. It implements telemetrygateway.ServiceResolver.
type serviceIPIndex struct {
	mu          sync.RWMutex
	m           map[string]string
	observerIPs map[string]bool
}

func newServiceIPIndex() *serviceIPIndex {
	return &serviceIPIndex{m: map[string]string{}, observerIPs: map[string]bool{}}
}

func (x *serviceIPIndex) replace(m map[string]string, observerIPs map[string]bool) {
	x.mu.Lock()
	x.m = m
	x.observerIPs = observerIPs
	x.mu.Unlock()
}

func (x *serviceIPIndex) ServiceNameByIP(ip string) (string, bool) {
	if ip == "" {
		return "", false
	}
	x.mu.RLock()
	defer x.mu.RUnlock()
	name, ok := x.m[ip]
	return name, ok
}

func (x *serviceIPIndex) IsObserverIP(ip string) bool {
	x.mu.RLock()
	defer x.mu.RUnlock()
	return x.observerIPs[ip]
}
