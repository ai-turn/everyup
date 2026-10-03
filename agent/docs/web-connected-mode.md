# Web Connected Mode

Web connected mode lets the Docker collector sync discovered containers, Docker
logs, events, and host metrics to EveryUp Web. API status codes are derived from
access-log lines in the collected logs; request/response bodies are an optional
Tier 2 feature delivered by app-side OpenTelemetry instrumentation.

## Compose Setup

Set the Web connection values directly on the `everyup-agent` service in
`docker-compose.yml`:

```yaml
services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
    user: "0:0"
    environment:
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: "http://your-everyup-web:3001"
      EVERYUP_AGENT_API_KEY: "evup_svc_replace_me"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/hostfs:ro
      - everyup-agent-data:/data
    restart: unless-stopped

volumes:
  everyup-agent-data:
```

Create the key in Web from **Docker -> Connect Docker**, replace
`EVERYUP_AGENT_API_KEY`, then restart the Docker collector. It enrolls
automatically and appears online within about 30 seconds.

## Required Values

| Variable | Default | Description |
| --- | --- | --- |
| `EVERYUP_WEB_SYNC_ENABLED` | `false` | Enable Web enrollment and sync |
| `EVERYUP_WEB_BASE_URL` | | EveryUp Web base URL reachable from the Docker host |
| `EVERYUP_AGENT_API_KEY` | | API key generated in Web from Docker -> Connect Docker |
| `EVERYUP_WEB_SYNC_INTERVAL_SECONDS` | `30` | Service/event/metric sync interval |

`EVERYUP_WEB_ENROLLMENT_TOKEN` is the deprecated name for
`EVERYUP_AGENT_API_KEY` and is still accepted as a fallback.

## Logs And API Requests

Docker stdout/stderr logs are forwarded automatically for containers on the same
Docker host. Lines that parse as access logs (Nginx / Apache / structured JSON)
are emitted as synthetic OTel SERVER spans, which Web projects into the API tab
(status code, method, path; no latency). For headers/bodies, instrument the app
with OpenTelemetry — see [OpenTelemetry instrumentation guide](https://ai-turn.github.io/everyup/en/guide/otel-instrumentation).

## API Contract

The Docker collector syncs to these Web endpoints. The `/agents` paths and
`agentId` parameters are compatibility API names and remain unchanged.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/agents/enroll` | Register or refresh a Docker environment |
| `POST /api/v1/agents/:agentId/services` | Upsert discovered container state |
| `POST /api/v1/agents/:agentId/events` | Flush local Docker collector events |
| `POST /api/v1/agents/:agentId/metrics` | Send host metrics |
| `POST /api/v1/otlp/v1/logs` | Forward Docker logs encoded by the Docker collector |
| `POST /api/v1/otlp/v1/traces` | Forward trace spans (access-log synthesis, eBPF sidecar, or app OTel) |

Authentication uses `Authorization: Bearer <EVERYUP_AGENT_API_KEY>`.

## Identity

Docker-discovered services use a stable identity based on Docker Compose metadata
when available, then container name, then container ID. Recreating a Compose
service keeps the same service card when the Compose project and service names
stay the same.
