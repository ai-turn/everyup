# EveryUp monitoring target fixture

This is a deliberately small application for testing EveryUp end to end. It
runs unchanged on Docker Desktop (`amd64`) and ARM64 Linux servers and has no
application framework dependencies.

| Service | Runtime | Host URL | Purpose |
| --- | --- | --- | --- |
| `node-api` | Node.js 24 | `http://127.0.0.1:18080` | Traces, headers, opt-in masked bodies and truncation |
| `java-api` | Java 21 | `http://127.0.0.1:18081` | Java agent injection and traces |
| `rollback-probe` | Node.js 24 | internal only | Deliberate startup failure after injection |

The services expose `/health`, `/ok`, `/slow?ms=350`, `/error`, `/echo`,
`/large`, and `/env`. Both services start with an existing runtime option; the
verification checks that EveryUp appends its agent without overwriting it.

## Prerequisites

- A Linux host, or Docker Desktop with the WSL2 backend
- Docker Engine and Docker Compose v2
- A running EveryUp Docker collector installed through the onboarding command
- `curl` in the Linux/WSL environment

The complete instrumentation workflow must run in Linux or WSL because the
The EveryUp Docker collector and `everyup-otel` helper target Linux containers. Traffic alone
can also be generated from Windows PowerShell.

`obi-config.yaml` mirrors the zero-code eBPF discovery configuration installed
with the Docker collector and can be mounted when diagnosing the observer independently.

## Quick end-to-end test

Run this from the fixture directory in Linux/WSL:

```bash
sh scripts/run-e2e.sh
```

To additionally prove that a failed instrumented restart restores the previous
working configuration:

```bash
sh scripts/run-e2e.sh --with-auto-rollback
```

The script performs these steps:

1. Builds and starts the Node and Java services.
2. Confirms their original `NODE_OPTIONS` and `JAVA_TOOL_OPTIONS` work.
3. Applies the EveryUp Node bootstrap and Java agent, then verifies mounts,
   network attachment, health, and preservation of existing options.
4. Generates normal, slow, 503, sensitive-body, and oversized-body requests.
5. Rolls back to the original Compose configuration and verifies it again.

After step 3, inspect the EveryUp UI for the service keys
`everyup-e2e:node-api` and `everyup-e2e:java-api`. Expected evidence includes:

- successful requests and intentional HTTP 503 requests;
- approximately 350 ms slow requests;
- Node and Java server spans delivered over OTLP;
- Node request/response body events whose `password`, `token`, and `apiKey`
  values are masked;
- a truncated Node `/large` response body event;
- eBPF service and network observations when the host supports eBPF.

Java body capture is intentionally not asserted: the upstream Java agent does
not capture bodies by itself. Java tracing and header capture are still tested.

## Manual workflow

Start only the target applications:

```bash
docker compose up -d --build --wait node-api java-api
sh scripts/verify-baseline.sh
```

Apply instrumentation with the same command produced by the onboarding UI:

```bash
sudo everyup-otel apply ./compose.yaml --capture-bodies node-api=node java-api=java
sudo everyup-otel verify ./compose.yaml
sh scripts/verify-instrumentation.sh
```

Generate traffic from Linux/WSL:

```bash
sh scripts/generate-traffic.sh 10
```

Or from Windows PowerShell:

```powershell
.\scripts\generate-traffic.ps1 -Iterations 10
```

Restore the uninstrumented configuration before stopping the fixture:

```bash
sudo everyup-otel rollback ./compose.yaml
sh scripts/verify-baseline.sh
docker compose down
```

This cleanup only removes fixture containers and its default network. It does
not remove the shared `everyup-monitoring` network, the Docker collector, or its telemetry
bundle volume.

## ARM64 cloud server

Clone the repository on the ARM server and run the same quick test over SSH.
The fixture ports bind to `127.0.0.1` by default, so they are not exposed to the
internet. If you want to call them from your PC, prefer an SSH tunnel:

```bash
ssh -L 18080:127.0.0.1:18080 -L 18081:127.0.0.1:18081 user@your-server
```

The images used here publish Docker multi-platform variants for both `amd64`
and `arm64`. You can confirm what actually ran with:

```bash
docker compose exec node-api uname -m
docker compose exec java-api uname -m
```

## Useful diagnostics

```bash
docker compose ps
docker compose logs --tail=100 node-api java-api
sudo everyup-otel status ./compose.yaml
sudo everyup-otel verify ./compose.yaml
docker inspect everyup-agent --format '{{json .State.Health}}'
```

If the services work but no telemetry appears, first check that the Docker collector is on
the `everyup-monitoring` network and that its OTLP gateway is listening. If
eBPF is unavailable on the host, the capability status should explain the
reason while Node/Java OpenTelemetry continues to provide application traces.
