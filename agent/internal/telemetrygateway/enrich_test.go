package telemetrygateway

import (
	"testing"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

type fakePIDResolver map[int]string

func (f fakePIDResolver) ServiceNameByPID(pid int) (string, bool) {
	name, ok := f[pid]
	return name, ok
}

type fakeIPResolver map[string]string

func (f fakeIPResolver) ServiceNameByIP(ip string) (string, bool) {
	name, ok := f[ip]
	return name, ok
}

func (f fakeIPResolver) IsObserverIP(ip string) bool {
	return f[ip] == "everyup-ebpf"
}

func kv(key, value string) *commonpb.KeyValue {
	return &commonpb.KeyValue{Key: key, Value: stringAttr(value)}
}

// ebpfResource builds a ResourceSpans the way the Beyla sidecar emits them:
// exe-derived service.name, "host:pid" instance id, the everyup.source marker,
// and a SERVER span carrying server.address.
func ebpfResource(serviceName, instanceID, serverAddress string) *tracepb.ResourceSpans {
	return &tracepb.ResourceSpans{
		Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
			kv("service.name", serviceName),
			kv("service.instance.id", instanceID),
			kv("everyup.source", "ebpf"),
		}},
		ScopeSpans: []*tracepb.ScopeSpans{{Spans: []*tracepb.Span{{
			Name:       "GET /",
			Attributes: []*commonpb.KeyValue{kv("server.address", serverAddress)},
		}}}},
	}
}

func appResource(serviceName string) *tracepb.ResourceSpans {
	rs := &tracepb.ResourceSpans{Resource: &resourcepb.Resource{}}
	if serviceName != "" {
		rs.Resource.Attributes = []*commonpb.KeyValue{kv("service.name", serviceName)}
	}
	return rs
}

func marshalTraces(t *testing.T, rs ...*tracepb.ResourceSpans) []byte {
	t.Helper()
	body, err := proto.Marshal(&collectortracepb.ExportTraceServiceRequest{ResourceSpans: rs})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return body
}

func unmarshalTraces(t *testing.T, body []byte) *collectortracepb.ExportTraceServiceRequest {
	t.Helper()
	var req collectortracepb.ExportTraceServiceRequest
	if err := proto.Unmarshal(body, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return &req
}

func serviceNameOf(rs *tracepb.ResourceSpans) string {
	return resourceAttr(rs.GetResource(), "service.name")
}

func TestEnrichTracesConnectionAttribution(t *testing.T) {
	cases := []struct {
		name     string
		existing string
		want     string
	}{
		{"absent -> injected", "", "my-api"},
		{"unknown_service default -> overridden", "unknown_service:node", "my-api"},
		{"explicit -> bound to container", "billing", "my-api"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := marshalTraces(t, appResource(tc.existing))
			out, services, forward := enrichTraces(body, "my-api", true, nil, nil)
			if !forward {
				t.Fatal("payload should be forwarded")
			}
			req := unmarshalTraces(t, out)
			if got := serviceNameOf(req.GetResourceSpans()[0]); got != tc.want {
				t.Fatalf("service.name = %q, want %q", got, tc.want)
			}
			// The resolved connection service is marked traced.
			if len(services) != 1 || services[0] != "my-api" {
				t.Fatalf("services = %v, want [my-api]", services)
			}
		})
	}
}

func TestEnrichTracesGarbagePassesThrough(t *testing.T) {
	body := []byte{1, 2, 3}
	out, services, forward := enrichTraces(body, "my-api", true, nil, nil)
	if !forward || string(out) != string(body) || len(services) != 0 {
		t.Fatalf("garbage payload should pass through untouched")
	}
}

func TestEnrichTracesEBPFAttribution(t *testing.T) {
	pids := fakePIDResolver{2264: "checkout-api"}
	// The network-identity index holds IPs AND rDNS names (container name /
	// compose alias) — the sidecar's server.address is usually the alias.
	ips := fakeIPResolver{"172.19.0.3": "cart-api", "whoami": "whoami-svc"}

	body := marshalTraces(t,
		ebpfResource("whoami", "4c3d0f1ceb39:2264", "whoami"),     // resolves by PID
		ebpfResource("node", "4c3d0f1ceb39:9999", "172.19.0.3"),   // PID unknown -> server.address IP fallback
		ebpfResource("whoami", "4c3d0f1ceb39:3731", "whoami"),     // dead-TID PID -> server.address alias fallback
		ebpfResource("docker-proxy", "4c3d0f1ceb39:1", "gateway"), // unresolvable -> dropped
		appResource("billing"),                                    // app resource untouched, no connection match
	)

	out, services, forward := enrichTraces(body, "", false, pids, ips)
	if !forward {
		t.Fatal("payload should be forwarded")
	}
	req := unmarshalTraces(t, out)
	kept := req.GetResourceSpans()
	if len(kept) != 4 {
		t.Fatalf("kept %d resources, want 4 (unresolvable eBPF resource dropped)", len(kept))
	}
	if got := serviceNameOf(kept[0]); got != "checkout-api" {
		t.Fatalf("PID-resolved service.name = %q, want checkout-api", got)
	}
	if got := serviceNameOf(kept[1]); got != "cart-api" {
		t.Fatalf("IP-fallback service.name = %q, want cart-api", got)
	}
	if got := serviceNameOf(kept[2]); got != "whoami-svc" {
		t.Fatalf("alias-fallback service.name = %q, want whoami-svc", got)
	}
	if got := serviceNameOf(kept[3]); got != "billing" {
		t.Fatalf("app service.name = %q, want billing", got)
	}
	wantTraced := map[string]bool{"checkout-api": true, "cart-api": true, "whoami-svc": true}
	if len(services) != len(wantTraced) {
		t.Fatalf("services = %v, want checkout-api and cart-api", services)
	}
	for _, service := range services {
		if !wantTraced[service] {
			t.Fatalf("unexpected traced service %q", service)
		}
	}
}

func TestEnrichTracesAllDropped(t *testing.T) {
	body := marshalTraces(t, ebpfResource("docker-proxy", "host:1", "gateway"))
	_, services, forward := enrichTraces(body, "", false, fakePIDResolver{}, fakeIPResolver{})
	if forward {
		t.Fatal("fully-dropped payload must not be forwarded")
	}
	if len(services) != 0 {
		t.Fatalf("services = %v, want none", services)
	}
}

func TestInstancePID(t *testing.T) {
	cases := map[string]int{
		"4c3d0f1ceb39:2264": 2264,
		"host:1":            1,
		"no-pid":            0,
		"trailing:":         0,
		"":                  0,
		"host:abc":          0,
	}
	for in, want := range cases {
		if got := instancePID(in); got != want {
			t.Fatalf("instancePID(%q) = %d, want %d", in, got, want)
		}
	}
}

func TestEnrichMetrics(t *testing.T) {
	appRM := &metricspb.ResourceMetrics{Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{kv("service.name", "billing")}}}
	ebpfRM := &metricspb.ResourceMetrics{Resource: &resourcepb.Resource{Attributes: []*commonpb.KeyValue{
		kv("service.name", "whoami"),
		kv("everyup.source", "ebpf"),
	}}}
	body, err := proto.Marshal(&collectormetricspb.ExportMetricsServiceRequest{
		ResourceMetrics: []*metricspb.ResourceMetrics{appRM, ebpfRM},
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	out, forward := enrichMetrics(body, "my-api", true)
	if !forward {
		t.Fatal("payload with an app resource should be forwarded")
	}
	var req collectormetricspb.ExportMetricsServiceRequest
	if err := proto.Unmarshal(out, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	kept := req.GetResourceMetrics()
	if len(kept) != 1 {
		t.Fatalf("kept %d resources, want 1 (ebpf metrics dropped)", len(kept))
	}
	if got := resourceAttr(kept[0].GetResource(), "service.name"); got != "my-api" {
		t.Fatalf("service.name = %q, want my-api", got)
	}

	// All-ebpf payload: nothing to forward.
	onlyEBPF, err := proto.Marshal(&collectormetricspb.ExportMetricsServiceRequest{
		ResourceMetrics: []*metricspb.ResourceMetrics{ebpfRM},
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if _, forward := enrichMetrics(onlyEBPF, "", false); forward {
		t.Fatal("all-ebpf metrics payload must not be forwarded")
	}
}

func logsBody(t *testing.T, serviceName string) []byte {
	t.Helper()
	rl := &logspb.ResourceLogs{Resource: &resourcepb.Resource{}}
	if serviceName != "" {
		rl.Resource.Attributes = []*commonpb.KeyValue{kv("service.name", serviceName)}
	}
	body, err := proto.Marshal(&collectorlogspb.ExportLogsServiceRequest{ResourceLogs: []*logspb.ResourceLogs{rl}})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return body
}

func TestInjectServiceNameLogs(t *testing.T) {
	cases := []struct {
		name       string
		existing   string
		want       string
		wantChange bool
	}{
		{"absent -> injected", "", "my-api", true},
		{"unknown_service default -> overridden", "unknown_service:node", "my-api", true},
		{"explicit -> bound to container", "billing", "my-api", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, changed := injectServiceName("logs", logsBody(t, tc.existing), "my-api")
			if changed != tc.wantChange {
				t.Fatalf("changed = %v, want %v", changed, tc.wantChange)
			}
			var req collectorlogspb.ExportLogsServiceRequest
			if err := proto.Unmarshal(out, &req); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			got := ""
			for _, attr := range req.GetResourceLogs()[0].GetResource().GetAttributes() {
				if attr.GetKey() == "service.name" {
					got = attr.GetValue().GetStringValue()
				}
			}
			if got != tc.want {
				t.Fatalf("service.name = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestInjectServiceNameIgnoresGarbage(t *testing.T) {
	body := []byte{1, 2, 3}
	out, changed := injectServiceName("logs", body, "my-api")
	if changed || string(out) != string(body) {
		t.Fatalf("garbage payload should pass through untouched")
	}
}
