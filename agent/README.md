# EveryUp Docker Collector

The EveryUp Docker Collector is the lightweight component that runs on a Docker host you want to
monitor. It discovers Docker containers automatically, reads stdout/stderr logs,
collects host metrics, and syncs everything to EveryUp Web. API status codes are
derived by parsing access-log lines out of the logs it already collects — no
proxy, no app changes. Request/response headers and bodies are an optional Tier 2
feature delivered by app-side OpenTelemetry instrumentation.

Alert rules, notification channels, and dashboard behavior are configured in Web.
The Docker Collector only collects and forwards data. Its binary, environment
variables, storage paths, and compatibility API retain the internal `agent` name.

Installation, configuration, and environment variables live in the docs
([한국어](https://ai-turn.github.io/everyup/reference/collector)):

- [Quick Start](https://ai-turn.github.io/everyup/en/guide/quickstart): install the monitoring bundle
- [Docker Collector configuration](https://ai-turn.github.io/everyup/en/reference/collector): logs and API
  requests, networking and OTLP gateway tokens, Compose environment variables
- [Automatic eBPF Observer](https://ai-turn.github.io/everyup/en/guide/ebpf-observer): zero-code latency and traces
- [Headers & bodies](https://ai-turn.github.io/everyup/en/guide/otel-instrumentation): app-side OpenTelemetry and
  the `everyup-otel` helper

## Local Development

```bash
cd agent
go run ./cmd/everyup-agent
```

For local development, pass the
[Compose environment variables](https://ai-turn.github.io/everyup/en/reference/collector#compose-environment-variables)
through your shell or IDE run configuration.

## Related Docs

- [Docker Socket Proxy](docs/docker-socket-proxy.md)
- [Web Connected Mode](docs/web-connected-mode.md)
- [Heartbeat Watchdog](docs/heartbeat-watchdog.md)
- [Local State](docs/local-state.md)
