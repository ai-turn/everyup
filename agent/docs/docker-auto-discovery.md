# Docker Auto Discovery

The EveryUp Docker collector discovers Docker containers automatically through
the mounted Docker socket. Application services do not need EveryUp-specific
Compose blocks.

```yaml
services:
  app:
    image: my-app:latest

  everyup-agent:
    image: aiturn/everyup-agent:latest
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

The Docker collector groups service cards by Compose project/service metadata
when available, otherwise by container name. It collects logs from every
container in a group using independent cursors. A group is unhealthy if any of
its discovered replicas is not running.

## What Is Collected

- Container running/stopped state
- Docker events
- stdout/stderr logs
- Host CPU, memory, and disk metrics

## API Request Capture

Access-log lines in the collected stdout/stderr (Nginx / Apache / structured
JSON) are parsed into API status-code records automatically (method, path,
status; no latency). For request/response bodies, instrument the app with
OpenTelemetry — see [OTEL_API_INSTRUMENTATION.md](../../docs/OTEL_API_INSTRUMENTATION.md).
