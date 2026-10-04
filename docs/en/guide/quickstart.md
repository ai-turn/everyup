# Quick Start

This is the smallest setup: Web on a dashboard server and the monitoring bundle on each server you
monitor. With a single server you can run both side by side. You are done when the Docker
environment turns **수집 중** (collecting) in step 4.

## 1. Start Web

On the dashboard server, download the Compose file and start it:

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
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

::: warning If Web has a separate public address
If users or monitored servers reach Web through another address (for example
`https://monitor.example.com`), set `EVERYUP_PUBLIC_URL` in your shell or `.env` before
`docker compose up -d`. EveryUp puts this address into Docker installation commands, direct OTLP
setup, and infrastructure Collector configuration, so it must be an absolute HTTP(S) address
reachable from the target server. **`localhost` is not accepted.**
When omitted, the connection screens suggest the address the browser used and let you edit it.
:::

## 2. Create a Docker connection command

In the dashboard, open **Docker 환경** (Docker environments) and click **Docker 연결** (Connect
Docker) at the top right. Name the environment, then choose its collection scope:

- **All** configures uptime, logs, infrastructure, API tracing, and metrics.
- **Basic** collects Docker service state and logs only.
- **Custom** installs only the components and permissions required for the capabilities you select.

::: details Custom profiles without uptime collection
If a custom profile omits Docker uptime collection (for example, a metrics-only profile), apps
sending telemetry to the Collector's OTLP gateway (`:4318`) need a service-scoped bearer token.
Generate a token for each app and set its `Authorization` header. See the
[Collector networking notes](../reference/collector#networking) for the command and exporter settings.
:::

The connection flow then shows an installation command shaped like this:

```bash
curl -fsSL 'https://<Web address>/api/v1/agents/install.sh' | sudo sh -s -- 'https://<Web address>' '<join code>'
```

::: warning The join code works once, for ten minutes
If it expires or has already been used, click **새 코드** (New code) in the installation screen
and copy the refreshed command. The long-lived API key is never displayed in the browser; it is
delivered directly to the target server during installation.
:::

## 3. Install the monitoring bundle

Copy the displayed command and run it on the target Linux Docker server.

::: warning Docker Compose 2.23.1 or newer is required
Check with `docker compose version`.
:::

The installer checks Docker and Compose, writes the bundle under `/opt/everyup-agent`, backs up
any previous configuration, and starts only the components required by the selected scope. Your
application Compose file, images, ports, and containers are left unchanged.

- The **All** profile, or a custom profile with API tracing, starts the Docker Collector together
  with an isolated [eBPF Observer](./ebpf-observer) (OBI), which records API latency and traces
  without changing your application.
- The **Basic** profile collects Docker service state and logs without the eBPF Observer.

To set it up by hand instead, see
[`agent/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/agent/docker-compose.yml)
and the [Docker Collector configuration](../reference/collector).

## 4. Check the connection

Within about 30 seconds, the environment on the **Docker 환경** screen changes from **설치 대기**
(awaiting install) to **수집 중** (collecting). When uptime collection is enabled, the containers
on that server also appear as services.

![The Docker environments screen. The prod-server card shows 수집 중 (collecting), the staging-api card shows 설치 대기 (awaiting install), and the Docker 연결 button sits at the top right.](/images/quickstart-docker-env-ko.png)

<p class="screenshot-caption"><strong>수집 중</strong> means connected; <strong>설치 대기</strong> means the Collector has not connected yet. The dashboard UI is Korean only.</p>

When API tracing is enabled, the eBPF Observer discovers container processes automatically, so
there is no port list to maintain. If the environment stays at **설치 대기**, see
[Troubleshooting](./troubleshooting#not-collecting).

## Next steps

- [Monitoring setup](./monitoring-setup): diagnose collection, add capabilities, connect OpenTelemetry directly
- [Automatic eBPF Observer](./ebpf-observer): API latency and traces
- [Header & body capture](./otel-instrumentation): see why a request failed
- [Notification channels](./notifications): get alerts in Telegram, Discord, or Slack
