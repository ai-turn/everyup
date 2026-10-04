# Automatic eBPF Observer: API latency and traces

The default Docker Collector reads method, path, and status from access logs. To see real
latency and traces, the bundled Compose file starts `everyup-ebpf` automatically.
It discovers processes running in Docker/OCI containers, so there is no
`BEYLA_OPEN_PORT` or application port configuration.

This does not change your app code, Dockerfile, or app containers. On a native
Linux host, eBPF observes host processes to build traces and the Docker Collector
attributes each span to the matching Docker service. Docker Desktop has the
PID-translation limitation, so use [app-side OpenTelemetry](./otel-instrumentation)
when automatic service attribution is unavailable. Requires Linux kernel 5.8+ with BTF. The Observer needs elevated eBPF permissions; remove the `everyup-ebpf` service if
that is not acceptable. Logs, health, events, and host metrics keep working.

## How it works

The Compose bundle starts an `everyup-ebpf` service using
[OpenTelemetry eBPF Instrumentation (OBI)](https://opentelemetry.io/docs/zero-code/obi/).
It selects processes inside Docker/OCI containers automatically, with no app
port configuration, app changes, or service restarts. It captures real SERVER
spans (method, path, status, **latency**) across supported runtimes, including
Go and HTTPS traffic.

OBI sends spans to the Docker Collector's OTLP gateway, tagged
`everyup.source=ebpf`. The Collector maps each span to a service by the
instrumented process's PID (via Docker) and renames it accordingly; spans it
cannot match — host processes, the Observer itself, or stale PIDs — are dropped
so they never appear as phantom services. Services covered by real spans stop
receiving synthetic access-log spans automatically (no double counting).

## Notes

- Requires a Linux kernel 5.8+ with BTF (`/sys/kernel/btf/vmlinux` exists).
  Docker Desktop's VM qualifies.
- `privileged` + `pid: host` are required by this simple eBPF deployment. The
  elevated Observer is kept separate from the regular Docker Collector. Remove it if that
  is not acceptable for your host; everything else keeps working.
- The default OBI policy does not capture headers or bodies. Use
  [app-side OpenTelemetry](./otel-instrumentation) for the current EveryUp deep-inspection flow.
- A service freshly (re)started may drop its first seconds of spans until the
  Collector's next PID refresh (one check interval).
- OBI is pinned to a tested release in the Compose file. Upgrade it only after
  validating the target kernel and the PID attribution contract.
