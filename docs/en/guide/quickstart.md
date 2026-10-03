# Quick Start

This is the smallest setup: one Web and one monitoring bundle, both with Docker Compose.
On a single server you can run both side by side. Compose templates live in
[`web/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/web/docker-compose.yml) and
[`agent/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/agent/docker-compose.yml).

## 1. Start Web

On the dashboard server, create `docker-compose.yml`:

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    environment:
      EVERYUP_PUBLIC_URL: ${EVERYUP_PUBLIC_URL:-}
    ports:
      - "3001:3001"
    volumes:
      - everyup-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  everyup-data:
    driver: local
```

```bash
docker compose up -d
```

Open `http://WEB_SERVER_IP:3001` and create the first admin account. Done.

If users or monitored servers reach Web through a separate public address, set
`EVERYUP_PUBLIC_URL=https://monitor.example.com` in your shell or `.env` file.
The Compose example above and the repository templates pass this value to the
Web container. EveryUp uses the same address in Docker installation commands,
direct OTLP setup, and infrastructure Collector configuration. When omitted,
the connection screens suggest the API address used by the browser and let you
edit it. Use an absolute HTTP(S) address reachable from the target server;
`localhost` is not accepted.

## 2. Create a one-time Docker connection command

In the dashboard, open **Docker environments** and click **Connect Docker**.
Name the environment, then choose its collection scope:

- **All** configures uptime, logs, infrastructure, API tracing, and metrics.
- **Basic** collects Docker service state and logs only.
- **Custom** installs only the components and permissions required for the
  capabilities you select.

If a custom profile omits Docker uptime collection (for example, a metrics-only
profile), apps sending telemetry to the Collector's OTLP gateway (`:4318`)
need a service-scoped bearer token. Generate a token for each app and set its
`Authorization` header. See the [Collector networking notes](https://github.com/ai-turn/everyup/blob/main/agent/README.md#networking-notes)
for the command and exporter settings.

The connection flow then shows an installation command containing a join code
that expires after ten minutes and can only be used once. The long-lived API key
is not displayed in the browser; it is delivered directly to the target server
during installation.

## 3. Install the monitoring bundle on the monitored server

The installer starts only the components required by the selected collection
scope. The **All** profile, or a custom profile with API tracing, starts the
Docker Collector together with an isolated eBPF Observer (OBI). The **Basic**
profile collects Docker service state and logs without the eBPF Observer. Your
application Compose file, images, ports, and containers are left unchanged.
Docker Compose 2.23.1 or newer is required.

Run the displayed one-line command on the target Linux Docker server. The
installer checks Docker and Compose first, writes the bundle under
`/opt/everyup-agent`, backs up any previous configuration, and starts the
components required by the selected collection scope.

If the join code expires or has already been used, click **New code** in the
Docker installation screen and copy the refreshed command.

Within about 30 seconds the Docker environment shows as online in Web. When
uptime collection is enabled, the containers on that server appear
automatically. When API tracing is enabled, the eBPF Observer discovers
container processes automatically, so there is no port list to maintain. If
something goes wrong, see [Troubleshooting](./troubleshooting).

The Docker Collector reaches containers and logs through the mounted
Docker socket, so it works even from its own Compose project. The cleanest
setup is to put `everyup-agent` in the same Compose file as the app stack on
that server.

## Monitoring setup guide

The Docker environment's **Monitoring setup guide** checks Collector connection, baseline
collection, and automatic API tracing in order. When Java or Node.js services
are discovered, the same guide continues into the optional detailed
header/body instrumentation flow.

The **Connect** button on the Logs, API, Metrics, and Infrastructure pages lets
you reuse a registered target or connect a new one. Adding a capability to an
existing Docker environment preserves its ID, key, Project assignment, and
collection history. EveryUp issues a new apply command; run it on the target
server to enable the capability across that Docker environment.

For a service connected directly through OpenTelemetry, EveryUp keeps the
existing ID and API Key and adds only the required signal permission.
Follow the on-screen guidance to update the application or Collector, generate
data, and confirm receipt.

The setup guide distinguishes Collector contact within the last two minutes
from confirmation that the requested collection scope was applied. EveryUp
records the first and latest stored receipt for logs, traces, metrics, and
infrastructure data and refreshes the display every five seconds. A signal is
shown as **Delayed** after ten minutes without a receipt and **Waiting** until
the first receipt arrives. These states describe receipt history and do not by
themselves guarantee that the connection is currently healthy. Older Collectors
may remain in the waiting state even while communicating; update them with the
latest installation command. Receipt history is not backfilled for data stored
before the database migration.

Each connection screen brings existing-target selection and Docker installation
into one flow. Logs, API, and Metrics can also connect applications directly
through OpenTelemetry; Infrastructure instead offers a standard OpenTelemetry
Collector setup. Configured targets show their receipt history before opening
the corresponding data page. Direct setup adapts its guidance to existing OTel
usage and Java, Node.js, or Go, covering configuration, restart, data generation,
and receipt confirmation.

For detailed instrumentation, select the Java or Node.js services you want to
change and choose **Review changes** to confirm the restart scope. Run
`everyup-otel plan` on the server to validate the actual Compose project before
applying it. Web tracks the apply, verification, and recovery result for each
run. Configuration verification and new trace receipt are shown separately, and
a lack of traffic does not trigger rollback. See
[Headers & bodies](./otel-instrumentation) for details.
