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

Open `http://localhost:5174` and create the first admin account. The dev server proxies `/api`
to the backend at `http://localhost:3001`; point `VITE_API_TARGET` elsewhere if the backend runs on
another address.

To work on the UI without a backend, run it with the demo's mock data:

```bash
cd web/frontend
pnpm exec vite --mode demo --base /
```

## Checks

Backend:

```bash
cd web/backend
go test ./...
```

Frontend, in the same order as CI:

```bash
cd web/frontend
pnpm lint
pnpm typecheck   # `pnpm build` does not type-check
pnpm build
```

If you changed the UI, also run `pnpm test:e2e` before merging. The demo e2e runs in PR CI, before
Docker image publication, and in the Pages deploy. If screens look different, regenerate the
docs and README screenshots with
`pnpm screenshot`.

## Main Views

The sidebar, mobile navigation, command palette, and breadcrumbs all read their sections from
`frontend/src/components/layout/navSections.ts`; add or rename a section there.

| Route | Section | Purpose |
| --- | --- | --- |
| `/` | 개요 (Overview) | What needs attention now, monitoring scope, recent incidents |
| `/projects` | 그룹 (Groups) | Separately registered targets collected into groups |
| `/environments` | Docker 환경 (Docker environments) | Connected environments; `/agents/:id` is an environment, `/services/:agentId/:key` a service |
| `/uptime` | 업타임 (Uptime) | Docker services and HTTP/TCP uptime monitors |
| `/logs` | 로그 (Logs) | Error and warning counts per service, frequent errors |
| `/infrastructure` | 인프라 (Infrastructure) | Host CPU, memory, disk, and network |
| `/api` | API 요청 (API requests) | Request count, error rate, and latency per service |
| `/metrics` | 메트릭 (Metrics) | OpenTelemetry metrics apps send |
| `/alerts` | 알림 (Alerts) | Notification channels, alert rules, and delivery history |
| `/settings` | 환경 설정 (Settings) | Retention, failure threshold, collection interval, theme |

## Notes

Local runtime files such as backend data, frontend dependencies, and build output
are ignored by Git.
