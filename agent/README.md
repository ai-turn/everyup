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

## Quick Start

Download the monitoring bundle on the Docker server you want to monitor. It
contains the regular Docker Collector and an isolated eBPF Observer (OBI). You do not need
to add EveryUp settings to each application service. Docker Compose 2.23.1 or
newer is required because the OBI configuration is embedded in the Compose file.

In EveryUp Web, open **Docker -> Connect Docker**, name the Docker environment, and run the one-line
installation command shown there on the target server. The command contains a
join code that expires after ten minutes and works once; the long-lived Collector API
Key is exchanged directly between the target server and EveryUp Web.

The installer validates Linux, Docker Engine, and Docker Compose before using
the code. It stores the generated bundle in `/opt/everyup-agent/compose.yaml`,
backs up an existing configuration, and starts both services automatically.
If the code expires, issue a new one from the installation screen.

The Docker environment should appear online in Web within about 30 seconds. The Observer
automatically discovers application processes running in Docker/OCI containers;
there is no application port list to configure.

Web keeps the remaining setup visible as one guided flow: Collector connection,
baseline collection, automatic API tracing, then optional Java/Node detailed
instrumentation. Compatibility failures are shown on the relevant step without
hiding the features that still work.

## What Works Without App Changes

With only the Docker Collector service running, EveryUp can collect:

- Container running/stopped state
- Docker events
- Docker stdout/stderr logs
- API status codes (method, path, status) parsed from access logs
- Host CPU, memory, disk, and network metrics

The default monitoring bundle additionally collects HTTP/S and gRPC traces with
real latency through the eBPF Observer. If eBPF cannot run on the host, the Docker Collector
features above continue working independently.

Your application containers do not need the EveryUp Web URL or Docker Collector API Key.

## Logs And API Requests

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
8 KiB. See [local state](docs/local-state.md) for restart and retention behavior.

API status codes are extracted from those same logs: lines that parse as access
logs (Nginx / Apache / structured JSON) are emitted as synthetic OTel SERVER
spans, which Web projects into the **API** tab. There is no latency in access
logs, so duration is unknown; an app that emits no access logs simply shows no
API rows while logs and metrics keep flowing.

For real latency without touching your apps, use the automatic eBPF Observer
included in the monitoring bundle (below).
For request/response **headers and bodies**, instrument the app with
OpenTelemetry pointed at the Docker Collector's OTLP gateway (`http://everyup-agent:4318`).
See [docs/OTEL_API_INSTRUMENTATION.md](../docs/OTEL_API_INSTRUMENTATION.md).

If logs are written only to files inside the container, Docker cannot show them
and the Docker Collector cannot collect them in compose-only mode. Configure the application
or reverse proxy to write logs to stdout.

## Zero-Code Tracing (eBPF, Automatic)

The Compose bundle starts an `everyup-ebpf` service using
[OpenTelemetry eBPF Instrumentation (OBI)](https://opentelemetry.io/docs/zero-code/obi/).
It selects processes inside Docker/OCI containers automatically, with no app
port configuration, app changes, or service restarts. It captures real SERVER
spans (method, path, status, **latency**) across supported runtimes, including
Go and HTTPS traffic.

How it fits together: OBI sends spans to the Docker Collector's OTLP gateway, tagged
`everyup.source=ebpf`. The Collector maps each span to a service by the
instrumented process's PID (via Docker) and renames it accordingly; spans it
cannot match — host processes, the Observer itself, or stale PIDs — are dropped
so they never appear as phantom services. Services covered by real spans stop
receiving synthetic access-log spans automatically (no double counting).

Notes:

- Requires a Linux kernel 5.8+ with BTF (`/sys/kernel/btf/vmlinux` exists).
  Docker Desktop's VM qualifies.
- `privileged` + `pid: host` are required by this simple eBPF deployment. The
  elevated Observer is kept separate from the regular Docker Collector. Remove it if that
  is not acceptable for your host; everything else keeps working.
- The default OBI policy does not capture headers or bodies. Use app-side
  OpenTelemetry for the current EveryUp deep-inspection flow (see above).
- A service freshly (re)started may drop its first seconds of spans until the
  Collector's next PID refresh (one check interval).
- OBI is pinned to a tested release in the Compose file. Upgrade it only after
  validating the target kernel and the PID attribution contract.

## App Instrumentation (Headers/Bodies, One Restart)

The default eBPF policy above needs zero changes and captures
method/path/status/latency. For
**headers and bodies** the app itself must be instrumented. Java and Node.js
still require no code or Dockerfile changes: the one-time Docker Collector installer also
installs `/usr/local/bin/everyup-otel`.

Open the project in Web, choose **Detailed API monitoring**, enter the path to
the application's Compose file, and run the generated one-line command on that
server. The helper:

- validates Linux, Docker, the base Compose file, target runtimes, and the
  currently running containers before changing anything;
- creates a shared `everyup-monitoring` network and populates the
  `everyup-instrumentation` volume from the Docker Collector image;
- preserves existing `JAVA_TOOL_OPTIONS` or `NODE_OPTIONS` and writes a managed
  `docker-compose.everyup.yml` next to the original Compose file;
- recreates only the selected services, then checks health, injection options,
  the read-only `/everyup` mount, and Collector network connectivity;
- automatically restores and recreates the previous configuration if restart
  or verification fails.

The helper keeps rollback metadata in the app Compose directory's `.everyup`
folder. You can inspect or revert the change later:

```bash
sudo everyup-otel status ./compose.yml
sudo everyup-otel verify ./compose.yml
sudo everyup-otel rollback ./compose.yml
```

Notes:

- The Docker Collector's telemetry gateway attributes spans to the right service
  automatically; sensitive headers (authorization, cookie, ...) are masked at
  ingest regardless of what you list.
- Body capture (`EVERYUP_CAPTURE_BODIES`) is Node-only today and masks the
  fields in `EVERYUP_MASKED_BODY_FIELDS` (password, token, ... by default)
  before anything leaves the app. Viewing bodies in the web UI is admin-only
  and audited.
- The helper attaches the app and Docker Collector to the shared `everyup-monitoring`
  network so `everyup-agent:4318` resolves without publishing an OTLP port.
- Existing `JAVA_TOOL_OPTIONS` / `NODE_OPTIONS` values are retained and the
  EveryUp option is appended once.
- Java/Node versions: JVM 8+, Node 18+.

## Networking Notes

The Docker Collector discovers containers through the mounted Docker socket. It can run in
the same Compose file as your application or in a separate Compose project on the
same Docker host.

## Compose Settings

Only the three `yes` rows are required; everything else has a working default.

**Web connection (connected mode)**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_WEB_SYNC_ENABLED` | yes | `false` | Enables Web enrollment and sync |
| `EVERYUP_WEB_BASE_URL` | yes | | EveryUp Web base URL reachable from the Docker host |
| `EVERYUP_AGENT_API_KEY` | yes | | API key generated in Web from Docker -> Connect Docker (deprecated alias: `EVERYUP_WEB_ENROLLMENT_TOKEN`) |
| `EVERYUP_WEB_AGENT_ID` | no | | Web-side agent id; set automatically on enrollment |
| `EVERYUP_WEB_SYNC_INTERVAL_SECONDS` | no | `30` | How often services, events, and host metrics sync to Web |
| `EVERYUP_WEB_OTLP_ENDPOINT` | no | | OTLP endpoint advertised for telemetry push |

**General**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `TZ` | no | `UTC` | Timezone for the Collector's own log lines (e.g. `Asia/Seoul`); synced data always carries zone info regardless |
| `EVERYUP_AGENT_NAME` | no | `everyup-agent` | Docker environment name |
| `EVERYUP_SERVICE_NAME` | no | `local-service` | Default service name for the Collector's own checks |
| `EVERYUP_DATA_DIR` | no | `/data` | Where Collector state (`agent-state.json`, `audit.jsonl`) is stored |
| `EVERYUP_CHECK_INTERVAL_SECONDS` | no | `30` | Health-check interval |
| `EVERYUP_HTTP_TIMEOUT_SECONDS` | no | `5` | HTTP request timeout |
| `EVERYUP_ALERT_COOLDOWN_SECONDS` | no | `300` | Minimum seconds between repeat alerts for the same target |
| `EVERYUP_HEALTH_URL` | no | | Absolute URL to health-check (single-target mode; usually Docker discovery is used instead) |

Captured body events (delivered by app-side OpenTelemetry) are stored as span
events. The Web backend hides those bodies from non-admin users, audits admin
views, and removes body-bearing spans after `EVERYUP_RETENTION_BODYCAPTUREDAYS`
days (default 7).

**Docker discovery & logs**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_DOCKER_DISCOVERY_ENABLED` | no | `true` | Discover Docker containers automatically |
| `EVERYUP_DOCKER_SOCKET_PATH` | no | `/var/run/docker.sock` | Docker socket path inside the container |
| `EVERYUP_DOCKER_LOGS_ENABLED` | no | `true` | Forward containers' stdout/stderr logs to Web |
| `EVERYUP_DOCKER_LOGS_TAIL_LINES` | no | `100` | Historical lines read on a container's first collection; subsequent reads drain all unread logs |
| `EVERYUP_EXCLUDE` | no | | Comma-separated container names to exclude from discovery |

**Host metrics (CPU / memory / disk / network)**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_HOST_METRICS_ENABLED` | no | `true` | Collect host CPU/memory/disk/network from the `/hostfs` mount |
| `EVERYUP_HOST_METRICS_ROOT` | no | `/hostfs` | Mount point of the host filesystem (reads `/proc`, `/proc/net/dev`) |
| `EVERYUP_HOST_DISK_PATH` | no | `/hostfs` | Path used for disk usage stats |
| `EVERYUP_HOST_CPU_PERCENT` | no | `0` | Host CPU% **alert** threshold; `0` disables host-resource alerting (does not affect collection) |
| `EVERYUP_HOST_MEMORY_PERCENT` | no | `0` | Host memory% alert threshold; `0` disables |
| `EVERYUP_HOST_DISK_PERCENT` | no | `0` | Host disk% alert threshold; `0` disables |

**OTel Collector & telemetry gateway**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_OTEL_CONFIG_ENABLED` | no | `false` | Generate an OTel Collector config on startup |
| `EVERYUP_OTEL_CONFIG_PATH` | no | `/etc/everyup/generated/otel-config.yaml` | Where the generated OTel config is written |
| `EVERYUP_OTEL_CONF_DIR` | no | `/etc/everyup/conf.d` | Directory scanned for OTel config fragments |
| `EVERYUP_OTEL_FILELOG_PATHS` | no | | Comma-separated file paths for the OTel filelog receiver |
| `EVERYUP_TELEMETRY_GATEWAY_ENABLED` | no | `true` | Run the Docker Collector's OTLP gateway that forwards telemetry to Web |
| `EVERYUP_TELEMETRY_GATEWAY_LISTEN_ADDR` | no | `:4318` | Listen address for the Docker Collector's OTLP gateway |

**Heartbeat watchdog**

| Variable | Required | Default | Description |
| --- | ---: | --- | --- |
| `EVERYUP_HEARTBEAT_URL` | no | | External heartbeat (dead-man's switch) URL to ping |
| `EVERYUP_HEARTBEAT_TOKEN` | no | | Token sent with the heartbeat ping |
| `EVERYUP_HEARTBEAT_INTERVAL_SECONDS` | no | `60` | Heartbeat ping interval |

## Local Development

```bash
cd agent
go run ./cmd/everyup-agent
```

For local development, pass the same values shown above through your shell or IDE
run configuration.

## Related Docs

- [Docker Socket Proxy](docs/docker-socket-proxy.md)
- [Web Connected Mode](docs/web-connected-mode.md)
- [Heartbeat Watchdog](docs/heartbeat-watchdog.md)
- [Local State](docs/local-state.md)
