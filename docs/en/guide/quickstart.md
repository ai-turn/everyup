# Quick Start

Start Web on a dashboard server, add one uptime monitor, and see its first check result. The basic
setup is done when the monitor shows **정상** (Healthy) in step 2. After that you can connect the
capabilities you need directly and, on a Linux Docker host, install the Docker Collector. Both are
optional.

## Before you start

- **Dashboard server**: Docker and Docker Compose
- **Network**: the dashboard server must reach the URL or TCP port you want to check.

## 1. Start Web (dashboard server)

**On the dashboard server**, download the Compose file:

```bash
mkdir everyup && cd everyup
curl -O \
https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
```

### Set the public address (optional) {#public-url}

If users or monitored servers reach Web through another address (for example
`https://monitor.example.com`), set it in `.env` in the same directory **before starting**:

```bash
echo 'EVERYUP_PUBLIC_URL=https://monitor.example.com' > .env
```

EveryUp puts this address into Docker installation commands, direct OTLP setup, and
infrastructure Collector configuration, so it must be an absolute HTTP(S) address reachable from
the monitored server. **`localhost` is not accepted.** When omitted, the connection screens
suggest the address the browser used and let you edit it.

### Start

```bash
docker compose up -d
```

::: details What the downloaded Compose file contains
[`web/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/web/docker-compose.yml):

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
:::

Open `http://<dashboard server IP>:3001` in a browser and create the first admin account.
If it does not open, see [The dashboard does not open](./troubleshooting#web-not-reachable).

## 2. Add an uptime monitor (browser)

On the **서버** (Servers) screen, click **추가** (Add) to create a server; a name is all it needs. When
the server opens, click **업타임 모니터 추가** (Add uptime monitor). Leave **체크 방식** (Check type) at
**HTTP**, enter a **이름** (Name) and the public **URL** to check (for example
`https://api.example.com/health`), and click **추가** (Add). The other fields can keep their defaults.

Web runs the check, so nothing is installed on the target. The first check runs as soon as you add
the monitor and repeats every 30 seconds. On a 2xx response the monitor shows **정상** (Healthy).

Internal addresses such as `localhost` and private networks can't be checked. See
[Uptime monitors](./uptime-monitors) for every field and TCP checks.

## 3. Connect capabilities directly (optional)

Apps send logs, API requests, and metrics to Web directly through OpenTelemetry, and server resources
come from a standard OpenTelemetry Collector. No Docker is required, and you connect only the
capabilities you need.

| Data | Dashboard path |
| --- | --- |
| Logs | **서버** (Servers) → a server → **로그** (Logs) tab → **로그 연결** (Connect logs) |
| API requests and traces | **서버** (Servers) → a server → **API 요청** (API requests) tab → **API 요청 연결** (Connect API requests) |
| App metrics | **서버** (Servers) → a server → **메트릭** (Metrics) tab → **메트릭 연결** (Connect metrics) |
| Server resources | **서버** (Servers) → a server → **인프라** (Infrastructure) tab → **인프라 연결** (Connect infrastructure) |

The same buttons on the server's **개요** (Overview) tab open the same dialog in that tab. The dialog's
first line, **적용 범위** (Scope), says what the connection applies to and what the app or server has to
do. Connecting shows the export address and API Key to apply in your app or OpenTelemetry Collector. See
[Connecting OpenTelemetry directly](./monitoring-setup#direct-otel) for language-specific setup and
how to confirm receipt.

## 4. Install the Docker Collector (optional) {#docker}

Installing the monitoring bundle (the Docker Collector plus the components it needs) on a Linux
Docker host collects container state, logs, host resources, and API requests in one install,
without changing your apps. The Docker Collector is installed on a server, one per server. Its data
appears in that server's **컨테이너** (Containers) tab and in its Infrastructure, Logs, and API requests
tabs. With a single server you can install it next to Web.

The monitored server needs:

- Linux, Docker Engine, Docker Compose 2.23.1 or newer, `curl`, and `sudo`.
  Check the Compose version with `docker compose version`.
- Network access to port `3001` on the dashboard server (or the address set in
  [`EVERYUP_PUBLIC_URL`](#public-url))

### Create the installation command (browser)

**In the browser**, open the installation dialog:

- **New server**: on the **서버** (Servers) screen, click **추가** (Add), enter a name, pick
  **Docker Collector 설치** (Install Docker Collector) as the **연결 방식** (Connection method), and click
  **서버 추가** (Add server). Once the server is created, its page opens the installation dialog.
- **Existing server**: on the server's **개요** (Overview) tab, click **Docker Collector 설치**.

Then choose the collection scope:

| Scope | Collection and reception | Installs |
|---|---|---|
| **전체** (All) | Container state, logs, infrastructure, API tracing, and OTLP metric reception | Docker Collector, eBPF Observer |
| **기본** (Basic) | Container state, logs | Docker Collector |
| **사용자 지정** (Custom) | Only what you select (and only the permissions it needs) | Docker Collector, plus the eBPF Observer if you select API tracing |

To see app metrics, enable reception and configure the app or an OpenTelemetry Collector to export
them. Selecting logs or API tracing also enables the container state capability required for Docker discovery.

If the server already sends infrastructure through an OpenTelemetry Collector, the dialog asks you to
pick a **호스트 지표 출처** (Host metrics source) so the same host's CPU, memory, and disk are not
collected twice. See [Host metrics source](./monitoring-setup#host-metrics-source).

The [eBPF Observer](./ebpf-observer) records API latency and traces without changing your
application. It runs with permissions separate from the Docker Collector and discovers container
processes automatically, so there is no port list to maintain.

::: details Custom profiles without container state
If a custom profile omits container state collection (for example, a metrics-only profile), apps
sending telemetry to the Docker Collector's OTLP gateway (`:4318`) need a service-scoped bearer token.
Generate a token for each app and set its `Authorization` header. See the
[Collector networking notes](../reference/collector#networking) for the command and exporter settings.
:::

The connection flow then shows an installation command shaped like this:

```bash
curl -fsSL 'https://<Web address>/api/v1/agents/install.sh' |
  sudo sh -s -- 'https://<Web address>' '<join code>'
```

::: warning The join code works once, for ten minutes
If it expires or has already been used, click **새 코드** (New code) in the installation screen
and copy the refreshed command. The long-lived API key is never displayed in the browser; it is
delivered directly to the target server during installation.
:::

### Install the monitoring bundle (monitored server)

Copy the displayed command and run it **on the monitored Linux Docker server**.

The installer checks Docker and Compose, writes the bundle under `/opt/everyup-agent`, backs up
any previous configuration as `compose.yaml.bak.<timestamp>`, and starts only the components
required by the selected scope. Your application Compose file, images, ports, and containers are
left unchanged. The `everyup-agent` in the path and container name is the Docker Collector's
internal name.

When it finishes, the last lines read:

```text
EveryUp Docker collector installation complete.
Configuration: /opt/everyup-agent/compose.yaml
Check status: docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml ps
```

If it stops earlier, look up the last error line in [Troubleshooting](./troubleshooting).

To set it up by hand instead, see
[`agent/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/agent/docker-compose.yml)
and the [Docker Collector configuration](../reference/collector).

### Check the connection (browser)

After installation, open **서버** (Servers) in the browser. Set the connection filter to
**Docker Collector** to list only servers with a Docker Collector. Within about 30 seconds, the server
leaves **대기** (Waiting, shown as Docker Collector 설치 대기, awaiting install) and a container count
appears under its name. When container state collection is enabled, the containers appear in the
server's **컨테이너** (Containers) tab.

![The server list filtered to Docker Collector. prod-server is failing, worker-cluster needs attention, edge-node is healthy, and staging-api shows 대기 (Waiting) because its Docker Collector has not connected yet.](/images/quickstart-docker-servers-light.webp){.only-light width=776 height=361}
![The server list filtered to Docker Collector. prod-server is failing, worker-cluster needs attention, edge-node is healthy, and staging-api shows 대기 (Waiting) because its Docker Collector has not connected yet.](/images/quickstart-docker-servers-dark.webp){.only-dark width=776 height=361}

<p class="screenshot-caption">A container count means connected; <strong>대기</strong> (Waiting) means the Docker Collector has not connected yet. The dashboard UI is Korean only.</p>

If the server stays at **설치 대기**, see [Troubleshooting](./troubleshooting#not-collecting).

Connected means the Docker Collector is reporting. Open **Docker Collector 설정 가이드** (Docker Collector
setup guide) on the server's **개요** (Overview) tab and check configuration application and
**데이터 수신 확인** (data receipt) too. Generate app
requests to produce logs and traces. For app metrics, apply export settings and wait for a collection
interval before checking receipt.

## Next steps

Once your monitoring targets are connected, set up [Notifications](./notifications). Connect a Telegram, Discord,
or Slack channel and enable alert rules to receive notifications when their conditions are met.

Other guides:

- [Uptime monitors](./uptime-monitors): check URLs and TCP ports, pause monitors, read check history
- [Monitoring setup](./monitoring-setup): connect OpenTelemetry directly, diagnose collection, add capabilities to a Docker Collector
- [Header & body capture](./otel-instrumentation): see why a request failed
- [Automatic eBPF Observer](./ebpf-observer): API latency and traces on a Docker host
- [Upgrade and uninstall](./upgrade-uninstall): apply new versions, undo an installation
