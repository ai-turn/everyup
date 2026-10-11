# Monitoring setup

After connecting your first Docker environment with the [Quick Start](./quickstart), use these
screens to diagnose collection or widen what you collect.

## Monitoring setup guide

Open an environment from the **Docker 환경** (Docker environments) screen to find its
**모니터링 설정 가이드** (monitoring setup guide). It checks Collector connection, baseline
collection, and automatic API tracing in order. When Java or Node.js services are discovered, the
same guide leads straight into the optional header and body capture setup.

## Reading collection status

The setup guide shows two things separately: whether the Collector contacted Web within the last
two minutes, and whether the requested collection scope was actually applied.

EveryUp records the first and latest receipt for logs, traces, metrics, and infrastructure data,
and the screen refreshes them every five seconds.

| Status | Meaning |
| --- | --- |
| **수신 대기** (waiting) | Nothing has been received yet |
| **수집 지연** (delayed) | Ten minutes have passed since the latest receipt |

These states describe receipt history; they do not by themselves guarantee that the connection is
healthy right now.

::: tip Contacting Web but still waiting?
Older Collectors may stay in the waiting state even while communicating. Update them with the
latest installation command.
:::

## Adding capabilities to an existing environment

The connect buttons on the **로그** (Logs), **API 요청** (API requests), **메트릭** (Metrics), and **인프라**
(Infrastructure) pages, such as **로그 연결** (Connect logs), let you reuse a registered target or
connect a new one. Adding a capability to an existing Docker environment
preserves its ID, key, Project assignment, and collection history. EveryUp issues a new apply
command; run it on the target server to enable the capability across that Docker environment.

Each connection screen lets you pick an existing target or start a Docker installation. Choosing
a configured target shows its receipt history before opening the corresponding data page.

## Connecting OpenTelemetry directly {#direct-otel}

Apps running outside Docker send logs, API requests, and metrics directly through OpenTelemetry;
server resources go through a standard OpenTelemetry Collector. The direct setup screen adapts to
existing OTel usage and to Java, Node.js, or Go, and walks through applying the settings,
restarting, and confirming that data arrives.

Adding a capability to a service connected directly through OpenTelemetry keeps the existing ID and
API Key and adds only the required data permission. Follow the on-screen guidance to update the
application or Collector, then send a request and check that data arrives.

## Grouping targets into a Project

To view Docker environments, uptime monitors, directly connected services, and infrastructure
Collectors you run together as one unit, create a Project with **추가** (Add) on the **Projects**
screen and **배정** (Assign) targets to it. The Project screen lists its targets with problems
first. Deleting a Project leaves the assigned targets in place.

## Detailed header and body capture

Select the Java or Node.js services you want to change and choose **변경 사항 확인** (Review changes) to confirm the
restart scope. Run `everyup-otel plan` on the server to validate the actual Compose project before
applying it. Web tracks the apply, verification, and recovery result for each run. See
[Header & body capture](./otel-instrumentation) for details.
