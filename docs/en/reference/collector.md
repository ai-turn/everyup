---
outline: [2, 3]
pageClass: reference-page
---

# Docker Collector Configuration

The EveryUp Docker Collector is the lightweight component that runs on a Docker
host you want to monitor. It discovers Docker containers automatically, reads
stdout/stderr logs, collects host metrics, and syncs everything to EveryUp Web.
API status codes are derived by parsing access-log lines out of the logs it
already collects — no proxy, no app changes.

Alert rules, notification channels, and dashboard behavior are configured in Web.
The Docker Collector only collects and forwards data. Its binary, environment
variables, storage paths, and compatibility API retain the internal `agent` name.

For installation, see the [Quick Start](../guide/quickstart).

## Logs and API Requests

The Docker Collector reads Docker stdout/stderr and stores those lines as logs in Web. Check
what it can see with:

```bash
docker logs <container-name> --tail 100
```

The first read of a new container uses `EVERYUP_DOCKER_LOGS_TAIL_LINES` (default
100) to bound historical logs. Once a cursor exists, every remaining line is
read from Docker without a tail limit. Each replica has its own persisted cursor.
Collection streams records in bounded batches; outbound log requests are split
below the Web request-size limit. Log bodies retain a UTF-8-safe prefix of about
8 KiB. See [local state](https://github.com/ai-turn/everyup/blob/main/agent/docs/local-state.md)
for restart and retention behavior.

API status codes are extracted from those same logs: lines that parse as access
logs (Nginx / Apache / structured JSON) are emitted as synthetic OTel SERVER
spans, which Web projects into the **API** tab. There is no latency in access
logs, so duration is unknown; an app that emits no access logs simply shows no
API rows while logs and metrics keep flowing.

For real latency without touching your apps, use the
[automatic eBPF Observer](../guide/ebpf-observer) included in the monitoring bundle.
For request/response **headers and bodies**, instrument the app with
OpenTelemetry pointed at the Docker Collector's OTLP gateway (`http://everyup-agent:4318`).
See [Header & body capture](../guide/otel-instrumentation).

If logs are written only to files inside the container, Docker cannot show them
and the Docker Collector cannot collect them in compose-only mode. Configure the application
or reverse proxy to write logs to stdout.

## Networking

The Docker Collector discovers containers through the mounted Docker socket. It can run in
the same Compose file as your application or in a separate Compose project on the
same Docker host.

When Docker discovery is enabled, the OTLP gateway accepts telemetry only from
running containers it discovers. It assigns each app payload the service name
of its source container, even if the SDK supplies a different `service.name`;
only the `everyup-ebpf` container can send eBPF-marked traces.

A profile without Docker discovery (such as metrics-only) requires a service-scoped
bearer token on every OTLP request. Generate one per application on the Docker host:

```bash
sudo docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml \
  exec -T everyup-agent everyup-agent gateway-token checkout
```

Configure that application's OTLP exporter to send
`Authorization: Bearer <generated-token>` to `http://everyup-agent:4318`.
For an OpenTelemetry SDK using OTLP/HTTP, set:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://everyup-agent:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20<generated-token>
```

The gateway assigns `service.name` from the token, regardless of the name in
the payload. Keep the token with that application's credentials; generate a
different token for each service. Rotating the Collector API key invalidates
all service tokens.

## Compose Environment Variables

Only the three variables marked **required** must be set; everything else has a working default.

### Web connection (connected mode)

- **`EVERYUP_WEB_SYNC_ENABLED`** · **required** · default `false`\
  Enables Web enrollment and sync
- **`EVERYUP_WEB_BASE_URL`** · **required**\
  EveryUp Web base URL reachable from the Docker host
- **`EVERYUP_AGENT_API_KEY`** · **required**\
  API key generated in Web from Docker -> Connect Docker (deprecated alias: `EVERYUP_WEB_ENROLLMENT_TOKEN`)
- **`EVERYUP_WEB_AGENT_ID`**\
  Web-side agent id; set automatically on enrollment
- **`EVERYUP_WEB_SYNC_INTERVAL_SECONDS`** · default `30`\
  How often services, events, and host metrics sync to Web
- **`EVERYUP_WEB_OTLP_ENDPOINT`**\
  OTLP endpoint advertised for telemetry push

### General

- **`TZ`** · default `UTC`\
  Timezone for the Collector's own log lines (e.g. `Asia/Seoul`); synced data always carries zone info regardless
- **`EVERYUP_AGENT_NAME`** · default `everyup-agent`\
  Docker environment name
- **`EVERYUP_SERVICE_NAME`** · default `local-service`\
  Default service name for the Collector's own checks
- **`EVERYUP_DATA_DIR`** · default `/data`\
  Where Collector state (`agent-state.json`, `audit.jsonl`) is stored
- **`EVERYUP_CHECK_INTERVAL_SECONDS`** · default `30`\
  Health-check interval
- **`EVERYUP_HTTP_TIMEOUT_SECONDS`** · default `5`\
  HTTP request timeout
- **`EVERYUP_ALERT_COOLDOWN_SECONDS`** · default `300`\
  Minimum seconds between repeat alerts for the same target
- **`EVERYUP_HEALTH_URL`**\
  Absolute URL to health-check (single-target mode; usually Docker discovery is used instead)

### Docker discovery and logs

- **`EVERYUP_DOCKER_DISCOVERY_ENABLED`** · default `true`\
  Discover Docker containers automatically
- **`EVERYUP_DOCKER_SOCKET_PATH`** · default `/var/run/docker.sock`\
  Docker socket path inside the container
- **`EVERYUP_DOCKER_LOGS_ENABLED`** · default `true`\
  Forward containers' stdout/stderr logs to Web
- **`EVERYUP_DOCKER_LOGS_TAIL_LINES`** · default `100`\
  Historical lines read on a container's first collection; subsequent reads drain all unread logs
- **`EVERYUP_EXCLUDE`**\
  Comma-separated container names to exclude from discovery

### Host metrics (CPU / memory / disk / network)

- **`EVERYUP_HOST_METRICS_ENABLED`** · default `true`\
  Collect host CPU/memory/disk/network from the `/hostfs` mount
- **`EVERYUP_HOST_METRICS_ROOT`** · default `/hostfs`\
  Mount point of the host filesystem (reads `/proc`, `/proc/net/dev`)
- **`EVERYUP_HOST_DISK_PATH`** · default `/hostfs`\
  Path used for disk usage stats
- **`EVERYUP_HOST_CPU_PERCENT`** · default `0`\
  Host CPU% **alert** threshold; `0` disables host-resource alerting (does not affect collection)
- **`EVERYUP_HOST_MEMORY_PERCENT`** · default `0`\
  Host memory% alert threshold; `0` disables
- **`EVERYUP_HOST_DISK_PERCENT`** · default `0`\
  Host disk% alert threshold; `0` disables

### OTel Collector and telemetry gateway

- **`EVERYUP_OTEL_CONFIG_ENABLED`** · default `false`\
  Generate an OTel Collector config on startup
- **`EVERYUP_OTEL_CONFIG_PATH`** · default `/etc/everyup/generated/otel-config.yaml`\
  Where the generated OTel config is written
- **`EVERYUP_OTEL_CONF_DIR`** · default `/etc/everyup/conf.d`\
  Directory scanned for OTel config fragments
- **`EVERYUP_OTEL_FILELOG_PATHS`**\
  Comma-separated file paths for the OTel filelog receiver
- **`EVERYUP_TELEMETRY_GATEWAY_ENABLED`** · default `true`\
  Run the Docker Collector's OTLP gateway that forwards telemetry to Web
- **`EVERYUP_TELEMETRY_GATEWAY_LISTEN_ADDR`** · default `:4318`\
  Listen address for the Docker Collector's OTLP gateway

### Heartbeat watchdog

- **`EVERYUP_HEARTBEAT_URL`**\
  External heartbeat (dead-man's switch) URL to ping
- **`EVERYUP_HEARTBEAT_TOKEN`**\
  Token sent with the heartbeat ping
- **`EVERYUP_HEARTBEAT_INTERVAL_SECONDS`** · default `60`\
  Heartbeat ping interval
