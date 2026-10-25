# Monitoring setup

Check collection status or expand collection in a Docker environment.
Apps and servers outside Docker can [connect directly through OpenTelemetry](#direct-otel)
without a Docker Collector. For your first Docker connection, follow the [Quick Start](./quickstart#docker).

## Monitoring setup guide

Open an environment from the **Docker 환경** (Docker environments) screen to find its
**모니터링 설정 가이드** (monitoring setup guide). It checks Collector connection, baseline
collection, and automatic API tracing in order. When Java or Node.js services are discovered, the
same guide leads straight into the optional header and body capture setup.

## Reading collection status

The setup guide checks Collector contact and collection scope separately. A connection is current
when the Collector contacted Web within the last two minutes. Configuration is applied when the
Collector reports settings that match the requested collection scope.

EveryUp records the first and latest receipt for logs, traces, metrics, and infrastructure data,
and the screen refreshes them every five seconds.
Registering a target or adding a permission does not count as receiving data. Apply the export
settings in the app or Collector, then check **데이터 수신 확인** (data receipt).

| Status | Meaning |
| --- | --- |
| **수신 대기** (waiting) | Nothing has been received yet |
| **수집 지연** (delayed) | More than ten minutes have passed since the latest receipt |

These states describe receipt history; they do not by themselves guarantee that the connection is
healthy right now.

::: tip Contacting Web but still waiting?
Older Collectors may stay in the waiting state even while communicating. Update them with the
latest installation command.
:::

## Adding capabilities to an existing environment

Open the environment on the **Docker 환경** (Docker environments) screen and use the buttons in its
monitoring setup guide, such as **로그 추가** (Add logs) or **메트릭 추가** (Add metrics), to add a capability
that is not selected yet. The environment keeps its ID, key, group assignment, and collection history.
EveryUp issues a new apply command; run it on the target server to enable the capability across that
Docker environment.

The connect buttons on the **로그** (Logs), **API 요청** (API requests), **메트릭** (Metrics), and **인프라**
(Infrastructure) pages, such as **로그 연결** (Connect logs), handle direct connections only. Reuse a
registered direct target or connect a new one. Choosing a configured target shows its receipt history
before opening the corresponding data page.

## Connecting OpenTelemetry directly {#direct-otel}

Apps outside Docker send logs, traces, and metrics directly through OpenTelemetry. Send server
resources through a standard OpenTelemetry Collector. Choose a connection path for the data you need:

| Data | Dashboard path |
| --- | --- |
| Logs | **로그** (Logs) → **로그 연결** (Connect logs) → **OpenTelemetry로 직접 연결** (Connect directly through OpenTelemetry) |
| API requests and traces | **API 요청** (API requests) → **API 연결** (Connect API) → **OpenTelemetry로 직접 연결** |
| App metrics | **메트릭** (Metrics) → **메트릭 연결** (Connect metrics) → **OpenTelemetry로 직접 연결** |
| Server resources | **인프라** (Infrastructure) → **인프라 연결** (Connect infrastructure) → **표준 Collector 연결** (Connect standard Collector) |

Adding a service shows its export address and API Key. If you are new to OpenTelemetry, follow the
Java, Node.js, or Go guidance to connect the SDK and exporters. Environment variables alone do not
send data. Direct OTLP logs also need the logging library's OTel bridge or appender.

If you already use OpenTelemetry and want to keep the existing destination, add an EveryUp exporter
to your Collector. Changing the app's shared OTLP address can replace the existing destination.

Adding a capability to a service connected directly through OpenTelemetry keeps the existing ID and
API Key and adds only the required data permission. Configure export for that signal in the app
or Collector, then restart or redeploy. Generate requests or logs, or wait for the metric collection
interval, and check **데이터 수신 확인** for receipt.

## Grouping targets

To view separately registered targets together, open **그룹** (Groups) under **모아 보기** (Collected
views) in the sidebar and click **추가** (Add) to create a group. Select Docker environments, uptime
monitors, directly connected services, and infrastructure Collectors, then click **배정** (Assign).
Services and data discovered within a Docker environment inherit its group assignment. The group
screen lists failing targets first. Deleting a group does not delete its assigned targets.

## Detailed header and body capture

Select the Java or Node.js services you want to change and choose **변경 사항 확인** (Review changes) to confirm the
restart scope. Run `everyup-otel plan` on the server to validate the actual Compose project before
applying it. Web tracks the apply, verification, and recovery result for each run. See
[Header & body capture](./otel-instrumentation) for details.
