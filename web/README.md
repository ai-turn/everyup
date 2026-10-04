# EveryUp Web

EveryUp Web is the dashboard and API server for EveryUp. It stores monitoring
history, manages users, receives Docker collector data, handles OTLP ingest, and sends
notifications based on the alert rules you configure.

```text
web/
  backend/    # Go API server, SQLite migrations, OTLP ingestion, alerting
  frontend/   # React/Vite dashboard
  Dockerfile  # Full-stack Web image, built from the repository root
```

Installation, environment variables, and the API overview live in the docs:
[Web configuration](https://ai-turn.github.io/everyup/en/reference/web) ([한국어](https://ai-turn.github.io/everyup/reference/web)).

## Run Locally

Start the backend:

```bash
cd web/backend
go run ./cmd/server
```

Start the frontend in another terminal:

```bash
cd web/frontend
pnpm install
pnpm dev
```

The frontend expects the backend at `http://localhost:3001` and proxies
`/api/v1` during development.

## Checks

Backend:

```bash
cd web/backend
go test ./...
```

Frontend:

```bash
cd web/frontend
pnpm build
```

## Main Views

| Route | Purpose |
| --- | --- |
| `/` | Connected Docker environments and their services |
| `/services` | Docker services with health checks, logs, API requests, and infrastructure |
| `/infra` | Infrastructure resources |
| `/logs` | Logs and service log setup |
| `/alerts` | Notification channels and alert rules |
| `/settings` | System settings |

## Notes

Local runtime files such as backend data, frontend dependencies, and build output
are ignored by Git.
