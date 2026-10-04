---
outline: [2, 3]
pageClass: reference-page
---

# Web Configuration

EveryUp Web is the dashboard and API server. It stores monitoring history,
manages users, receives Docker Collector and OTLP data, and sends notifications
based on the alert rules you configure.

## Install

Run the dashboard without cloning the repository:

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

Open `http://localhost:3001` and create the first admin account. This Compose
file runs Web only; install the Docker Collector on each Docker host you want to
monitor as described in the [Quick Start](../guide/quickstart).

## Environment Variables

Web runs with working defaults and needs no env vars for a basic setup. The ones
below matter for production, networking, and automation. Precedence is env var >
`config.json` > default.

### Server

- **`EVERYUP_PUBLIC_URL`**\
  External address users and monitored servers use to reach Web. Used in Docker installation commands, direct OTLP setup, and infrastructure Collector configuration. Must be an absolute http(s) URL without credentials, query, or fragment
- **`EVERYUP_SERVER_HOST`** · default `0.0.0.0`\
  Bind address
- **`EVERYUP_SERVER_PORT`** · default `3001`\
  Dashboard/API port
- **`EVERYUP_SERVER_MODE`** · default `production`\
  `development` enables verbose errors and stack traces
- **`EVERYUP_SERVER_ALLOWORIGINS`**\
  CORS allowed origins; set when the frontend is served from another domain (e.g. `https://app.example.com`)
- **`EVERYUP_DATABASE_PATH`** · default `./data/monitoring.db`\
  SQLite file path (the Docker image persists `/app/data`)

### Security and accounts

- **`EVERYUP_ENCRYPTION_KEY`** · default auto-generated\
  64-char hex (32 bytes) AES key for secrets (Docker Collector API keys, notification channels). **Set this in production**; otherwise a key is generated into the data directory and a database restore alone cannot decrypt secrets ([Backup and restore](../guide/backup-restore))
- **`EVERYUP_ADMIN_USERNAME`**\
  Create the first admin on startup without the setup UI (headless provisioning)
- **`EVERYUP_ADMIN_PASSWORD`**\
  Required with `EVERYUP_ADMIN_USERNAME`; minimum 8 characters

### Retention

- **`EVERYUP_RETENTION_METRICS`** · default `7d`\
  Health-check metrics
- **`EVERYUP_RETENTION_LOGS`** · default `3d`\
  Logs
- **`EVERYUP_RETENTION_SYSTEMMETRICS`** · default `7d`\
  Host metrics
- **`EVERYUP_RETENTION_APIREQUESTSDAYS`** · default `14`\
  API requests (days)
- **`EVERYUP_RETENTION_SPANSDAYS`** · default `7`\
  Traces (days)
- **`EVERYUP_RETENTION_BODYCAPTUREDAYS`** · default `7`\
  Captured request/response bodies and body-view audit records (days). Expiry strips the bodies and keeps the traces
- **`EVERYUP_RETENTION_OTELMETRICSDAYS`** · default `7`\
  OTLP metrics (days)

### Alerts

- **`EVERYUP_ALERTS_CONSECUTIVEFAILURES`** · default `3`\
  Consecutive failures before a service is marked down
- **`EVERYUP_ALERTS_LOGALERTCOOLDOWN`** · default `5`\
  Minimum minutes before the same log alert is sent again

### Web host metrics

These settings cover the host Web itself runs on. Metrics from other servers
come from the Docker Collector.

- **`EVERYUP_SYSTEM_ENABLED`** · default `true`\
  Collect host metrics
- **`EVERYUP_SYSTEM_COLLECTINTERVAL`** · default `5`\
  Collection interval (seconds); also editable on the settings page
- **`EVERYUP_SYSTEM_STOREINTERVAL`** · default `60`\
  Storage interval (seconds)

## API Overview

Default prefix: `/api/v1`.

| Area | Examples |
| --- | --- |
| Health and auth | `GET /health`, `POST /auth/login`, `GET /auth/me` |
| Monitoring | `GET /services`, `GET /hosts`, `GET /dashboard/summary` |
| Logs and traces | `GET /logs`, `POST /otlp/v1/logs`, `POST /otlp/v1/traces` |
| Alerting | `GET /notifications/channels`, `GET /alert-rules` |
| Docker Collector sync (`/agents` compatibility API) | `POST /agents/enroll`, `POST /agents/:agentId/services`, `POST /agents/:agentId/events`, `POST /agents/:agentId/metrics` |
| Docker service detail | `GET /agents/services/all`, `GET /agents/:agentId/services/:key/history`, `GET /agents/:agentId/services/:key/uptime`, `GET /agents/:agentId/services/:key/logs`, `GET /agents/:agentId/services/:key/requests` |

Docker Collector sync and OTLP ingest use the per-environment API key generated
from **Docker -> Connect Docker** in Web. The Collector owns that key; monitored
applications do not need it.
