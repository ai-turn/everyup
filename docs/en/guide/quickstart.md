# Quick Start

This is the minimal setup: Web on a dashboard server and the monitoring bundle (the Docker
Collector plus the components it needs) on each server you monitor. With a single server you can
run both side by side. You are done when the Docker environment turns **수집 중** (collecting) in
step 4 and you confirm receipt of the selected data.

## Before you start

- **Dashboard server**: Docker and Docker Compose
- **Monitored server**: Linux, Docker Engine, Docker Compose 2.23.1 or newer, `curl`, and `sudo`.
  Check the Compose version with `docker compose version`.
- **Network**: the monitored server must reach port `3001` on the dashboard server (or the address
  set in `EVERYUP_PUBLIC_URL`).

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

## 2. Create a Docker connection command (browser)

**In the browser**, open **Docker 환경** (Docker environments) in the dashboard. Click **Docker 연결**
(Connect Docker) at the top right, then name the environment and choose its collection scope:

| Scope | Collection and reception | Installs |
|---|---|---|
| **전체** (All) | Container state, logs, infrastructure, API tracing, and OTLP metric reception | Docker Collector, eBPF Observer |
| **기본** (Basic) | Docker service state, logs | Docker Collector |
| **사용자 지정** (Custom) | Only what you select (and only the permissions it needs) | Docker Collector, plus the eBPF Observer if you select API tracing |

To see app metrics, enable reception and configure the app or an OpenTelemetry Collector to export
them. Selecting logs or API tracing also enables the uptime capability required for Docker discovery.

The [eBPF Observer](./ebpf-observer) records API latency and traces without changing your
application. It runs with permissions separate from the Docker Collector and discovers container
processes automatically, so there is no port list to maintain.

::: details Custom profiles without uptime collection
If a custom profile omits Docker uptime collection (for example, a metrics-only profile), apps
sending telemetry to the Collector's OTLP gateway (`:4318`) need a service-scoped bearer token.
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

## 3. Install the monitoring bundle (monitored server)

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

## 4. Check the connection (browser)

After installation, open **Docker 환경** in the browser. Within about 30 seconds, the environment
changes from **설치 대기** (awaiting install) to **수집 중** (collecting). When uptime collection is enabled, the containers
on that server also appear as services.

![The Docker environments list. prod-server shows 수집 중 (collecting) and staging-api shows 설치 대기 (awaiting install).](/images/quickstart-docker-env-light.webp){.only-light width=751 height=202}
![The Docker environments list. prod-server shows 수집 중 (collecting) and staging-api shows 설치 대기 (awaiting install).](/images/quickstart-docker-env-dark.webp){.only-dark width=751 height=202}

<p class="screenshot-caption"><strong>수집 중</strong> means connected; <strong>설치 대기</strong> means the Collector has not connected yet. The dashboard UI is Korean only.</p>

If the environment stays at **설치 대기**, see [Troubleshooting](./troubleshooting#not-collecting).

**수집 중** describes Collector contact. Open the environment's **모니터링 설정 가이드** (monitoring setup
guide) and check configuration application and **데이터 수신 확인** (data receipt) too. Generate app
requests to produce logs and traces. For app metrics, apply export settings and wait for a collection
interval before checking receipt.

## Next steps

Once collection has started, set up [Notifications](./notifications). Connect a Telegram, Discord,
or Slack channel and enable alert rules to receive notifications when their conditions are met.

Other guides:

- [Monitoring setup](./monitoring-setup): diagnose collection, add capabilities, connect OpenTelemetry directly
- [Automatic eBPF Observer](./ebpf-observer): API latency and traces
- [Header & body capture](./otel-instrumentation): see why a request failed
- [Uptime monitors](./uptime-monitors): check URLs and TCP ports outside Docker
- [Upgrade and uninstall](./upgrade-uninstall): apply new versions, undo an installation
