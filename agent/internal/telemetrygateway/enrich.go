package telemetrygateway

import (
	"log"
	"strconv"
	"strings"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

// ebpfSourceMarker is the resource attribute the bundled eBPF sidecar sets via
// OTEL_RESOURCE_ATTRIBUTES (see the everyup-ebpf compose block). It scopes the
// aggressive attribution rules below — per-resource rename and drop — to
// payloads we generated ourselves; app SDK payloads are bound to their
// Docker-verified source container.
const ebpfSourceMarker = "ebpf"

// injectServiceName sets service.name on every resource in an OTLP logs payload
// using the Docker-verified connection identity. Returns the re-encoded
// payload and whether it changed; on any decode/encode error the original bytes
// are forwarded as-is. Traces go through enrichTraces instead.
func injectServiceName(signal string, body []byte, name string) ([]byte, bool) {
	if signal != "logs" {
		return body, false
	}
	var req collectorlogspb.ExportLogsServiceRequest
	if err := proto.Unmarshal(body, &req); err != nil {
		return body, false
	}
	changed := false
	for _, rl := range req.GetResourceLogs() {
		if rl.Resource == nil {
			rl.Resource = &resourcepb.Resource{}
		}
		if forceServiceName(rl.Resource, name) {
			changed = true
		}
	}
	return remarshal(&req, body, changed)
}

func remarshal(msg proto.Message, orig []byte, changed bool) ([]byte, bool) {
	if !changed {
		return orig, false
	}
	out, err := proto.Marshal(msg)
	if err != nil {
		return orig, false
	}
	return out, true
}

func stringAttr(s string) *commonpb.AnyValue {
	return &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: s}}
}

func hasEBPFSource(body []byte) bool {
	var req collectortracepb.ExportTraceServiceRequest
	if err := proto.Unmarshal(body, &req); err != nil {
		return false
	}
	for _, rs := range req.GetResourceSpans() {
		if resourceAttr(rs.GetResource(), "everyup.source") == ebpfSourceMarker {
			return true
		}
	}
	return false
}

// enrichTraces applies service attribution to a trace payload:
//
//   - Resources marked everyup.source=ebpf (the bundled eBPF sidecar) are
//     attributed per resource: the instrumented process's host PID (from
//     service.instance.id "host:pid") is resolved against Docker, falling back
//     to server.address when it is an IP. The resolved name overrides the
//     sidecar's executable-based service.name. Unresolvable eBPF resources are
//     dropped — host noise (docker-proxy, the sidecar itself) must not surface
//     as phantom services.
//   - Other resources use the Docker-verified connection's service name.
//
// Returns the (possibly re-encoded) payload, the attributed service names, and
// whether anything is left to forward.
func enrichTraces(body []byte, connName string, connOK bool, pids PIDResolver, ips ServiceResolver) ([]byte, []string, bool) {
	var req collectortracepb.ExportTraceServiceRequest
	if err := proto.Unmarshal(body, &req); err != nil {
		return body, nil, true
	}

	changed := false
	services := make(map[string]bool)
	kept := req.ResourceSpans[:0]
	for _, rs := range req.GetResourceSpans() {
		if rs.Resource == nil {
			rs.Resource = &resourcepb.Resource{}
		}
		if resourceAttr(rs.Resource, "everyup.source") == ebpfSourceMarker {
			name, ok := resolveEBPFService(rs, pids, ips)
			if !ok {
				// One line per dropped resource: this is the first place to look
				// when a service's eBPF spans don't show up (PID index stale,
				// non-container process, sidecar misconfig).
				log.Printf("telemetry gateway: dropped ebpf resource service=%q instance=%q (no matching container)",
					resourceAttr(rs.Resource, "service.name"), resourceAttr(rs.Resource, "service.instance.id"))
				changed = true
				continue
			}
			if forceServiceName(rs.Resource, name) {
				changed = true
			}
			services[name] = true
			kept = append(kept, rs)
			continue
		}
		if connOK {
			if forceServiceName(rs.Resource, connName) {
				changed = true
			}
			services[connName] = true
		}
		kept = append(kept, rs)
	}
	req.ResourceSpans = kept

	names := make([]string, 0, len(services))
	for name := range services {
		names = append(names, name)
	}
	if len(kept) == 0 {
		return nil, names, false
	}
	out, _ := remarshal(&req, body, changed)
	return out, names, true
}

// enrichMetrics applies service attribution to a metrics payload: resources
// marked everyup.source=ebpf are dropped outright — the sidecar is configured
// traces-only and its RED metrics would only duplicate span-derived stats —
// and the rest get the Docker-verified source-IP rule, like logs. Returns the
// payload and whether anything is left to forward.
func enrichMetrics(body []byte, connName string, connOK bool) ([]byte, bool) {
	var req collectormetricspb.ExportMetricsServiceRequest
	if err := proto.Unmarshal(body, &req); err != nil {
		return body, true
	}
	changed := false
	kept := req.ResourceMetrics[:0]
	for _, rm := range req.GetResourceMetrics() {
		if rm.Resource == nil {
			rm.Resource = &resourcepb.Resource{}
		}
		if resourceAttr(rm.Resource, "everyup.source") == ebpfSourceMarker {
			changed = true
			continue
		}
		if connOK && forceServiceName(rm.Resource, connName) {
			changed = true
		}
		kept = append(kept, rm)
	}
	req.ResourceMetrics = kept
	if len(kept) == 0 {
		return nil, false
	}
	out, _ := remarshal(&req, body, changed)
	return out, true
}

// resolveEBPFService maps one eBPF-sourced ResourceSpans to a service name:
// host PID from service.instance.id ("host:pid") first, then the spans'
// server.address against the network-identity index (it holds container IPs,
// container names, and compose service aliases — the sidecar's rDNS usually
// hands us the alias, e.g. "whoami"). The PID path alone is not enough: for Go
// targets the sidecar stamps the first-seen serving thread's TID, which the
// runtime may have already reaped. A resource groups spans of exactly one
// process, so one lookup attributes the whole batch.
func resolveEBPFService(rs *tracepb.ResourceSpans, pids PIDResolver, ips ServiceResolver) (string, bool) {
	if pids != nil {
		if pid := instancePID(resourceAttr(rs.GetResource(), "service.instance.id")); pid > 0 {
			if name, ok := pids.ServiceNameByPID(pid); ok {
				return name, true
			}
		}
	}
	if ips != nil {
		for _, ss := range rs.GetScopeSpans() {
			for _, span := range ss.GetSpans() {
				for _, attr := range span.GetAttributes() {
					if attr.GetKey() != "server.address" {
						continue
					}
					if name, ok := ips.ServiceNameByIP(attr.GetValue().GetStringValue()); ok {
						return name, true
					}
				}
			}
		}
	}
	return "", false
}

// instancePID parses the PID from an OTel instance id of the form "host:pid".
func instancePID(instanceID string) int {
	idx := strings.LastIndexByte(instanceID, ':')
	if idx < 0 || idx == len(instanceID)-1 {
		return 0
	}
	pid, err := strconv.Atoi(instanceID[idx+1:])
	if err != nil {
		return 0
	}
	return pid
}

func resourceAttr(res *resourcepb.Resource, key string) string {
	for _, attr := range res.GetAttributes() {
		if attr.GetKey() == key {
			return attr.GetValue().GetStringValue()
		}
	}
	return ""
}

// forceServiceName binds a resource to the service verified from Docker. It
// also replaces the eBPF sidecar's executable-derived names ("node", "java").
func forceServiceName(res *resourcepb.Resource, name string) bool {
	found := false
	changed := false
	for _, attr := range res.GetAttributes() {
		if attr.GetKey() != "service.name" {
			continue
		}
		found = true
		if attr.GetValue().GetStringValue() != name {
			attr.Value = stringAttr(name)
			changed = true
		}
	}
	if found {
		return changed
	}
	res.Attributes = append(res.Attributes, &commonpb.KeyValue{
		Key:   "service.name",
		Value: stringAttr(name),
	})
	return true
}
