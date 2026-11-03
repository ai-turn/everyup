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
| Server resources | **인프라** (Infrastructure) → **인프라 연결** (Connect infrastructure) |

Adding a service shows its export address and API Key. If you are new to OpenTelemetry, follow the
Java, Node.js, or Go guidance to connect the SDK and exporters. Environment variables alone do not
send data. Direct OTLP logs also need the logging library's OTel bridge or appender.

If you already use OpenTelemetry and want to keep the existing destination, add an EveryUp exporter
to your Collector. Changing the app's shared OTLP address can replace the existing destination.

Adding a capability to a service connected directly through OpenTelemetry keeps the existing ID and
API Key and adds only the required data permission. Configure export for that signal in the app
or Collector, then restart or redeploy. Generate requests or logs, or wait for the metric collection
interval, and check **데이터 수신 확인** for receipt.

## Explore metrics

Open a service in **메트릭** (Metrics) to view metrics alphabetically, 12 panels at a time. Click
**메트릭 12개 더 보기** (Show 12 more metrics) for more. Metrics collected by a Docker Collector
stay in the service details of that **Docker environment**.

Click a metric title to open its individual view and adjust these controls:

- **Attribute 필터** (Attribute filters): enter a key, value and value type, then click **필터 적용** (Apply filter). All conditions must match, with up to eight conditions. String `"1"` and number `1` are distinct.
- **시리즈 선택** (Series selection): search attribute combinations and select up to six series. The list shows the first 200 matches; narrow the attribute filters to find others. **기본 선택** (Default selection) selects the first six series matching the current filters.
- **초당 증가량** (Increase per second): available in the individual view of a sum. Only monotonic sums are calculated. Delta values are divided by their collection interval in seconds; cumulative values use the difference between consecutive points of the same stream divided by elapsed seconds.

The period, metric search, individual view, filters, series selection and value mode are stored in the URL.
Periods are relative to the time the page opens. A histogram's **선택한 시리즈의 기간 분포**
(Selected series distribution over the period) uses the same filters, series and time window as the chart.
The line shows each received point's mean; distribution p50, p95 and p99 come from stored buckets.
Chart summary averages are averages of the displayed points.

Rate calculation requires the SDK's aggregation temporality, monotonic flag and start timestamp.
Instances must identify distinct resources, for example with `service.instance.id`. These fields are saved
for newly received data after the metadata preservation feature is applied. Use raw values for older sums.
Points with missing starts, detected resets or overlaps have no rate. Alert thresholds remain based on raw values.
See the [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/) for the underlying semantics.

Charts show the latest 5,000 points of the selected series. Narrow the period or attribute filters when
this limit is exceeded. Distributions cover the selected series over the full query period, but show a
limit message instead of statistics when more than 50,000 points match.

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
