# Automatic eBPF Observer: API latency and traces

The default Docker Collector reads method, path, and status from access logs. To see real
latency and traces, the bundled Compose file starts `everyup-ebpf` automatically.
It discovers processes running in Docker/OCI containers, so there is no
`BEYLA_OPEN_PORT` or application port configuration.

This does not change your app code, Dockerfile, or app containers. On a native
Linux host, eBPF observes host processes to build traces and the Docker Collector
attributes each span to the matching Docker service. Docker Desktop has the
PID-translation limitation, so use [app-side OpenTelemetry](./otel-instrumentation)
when automatic service attribution is unavailable. Requires Linux kernel 5.8+ with BTF. See
"Zero-Code Tracing" in [agent/README.md](https://github.com/ai-turn/everyup/blob/main/agent/README.md#zero-code-tracing-ebpf-automatic)
for details. The Observer needs elevated eBPF permissions; remove the `everyup-ebpf` service if
that is not acceptable. Logs, health, events, and host metrics keep working.
