# Demo mock scenarios

Use the **데모 상태** selector in the Live Demo banner (mobile/tablet) or
sidebar (desktop) while `VITE_USE_MOCK=true`. The selected state persists for
the current browser session as you navigate.

| Scenario | URL | Purpose |
|---|---|---|
| `attention` (default) | 확인 필요 | Healthy and unhealthy services together, so the operator's next action is visible. |
| `normal` | 정상 운영 | Fresh collection and healthy service data; verifies the calm, no-action-needed state. |
| `empty` | 첫 시작 | A first-run workspace with no monitoring targets. |
| `partial-failure` | 부분 수집 실패 | Services and direct telemetry fail independently while the other overview regions remain visible and retryable. |

## Demo servers

Every direct target (uptime monitor, app, `otel-collector` infrastructure resource) belongs to one server, and its `projectId` is the server's group. `empty` hides all of these servers. Status follows the server list rules (worst target: 장애 > 확인 필요 > 정상 > 대기, so 대기 only when every target is idle or there are none; a paused monitor is idle; infrastructure at 70% or more is 확인 필요).

| ID | Name | Group | Targets | attention, partial-failure | normal |
|---|---|---|---|---|---|
| `server_mock_edge_host_01` | edge-host-01 | Production | infra `infra_mock_edge_01`; monitors `uptime_mock_store`, `uptime_mock_checkout`; apps `observed_mock_checkout` (logs), `observed_mock_orders` (logs, traces, metrics) | 장애 (Checkout API 응답 없음) | 정상 (CPU 47.6%, 메모리 58.4%) |
| `server_mock_db_primary_01` | db-primary-01 | Production | infra `infra_mock_db_01`; app `observed_mock_catalog` (metrics) | 확인 필요 (메모리 84.6%) | 정상 (메모리 61.2%) |
| `server_mock_payments_api` | payments-api | Production | monitor `uptime_mock_payments`; app `observed_mock_payments` (traces, logs) | 정상 | 정상 |
| `server_mock_inventory_api` | inventory-api | Production | app `observed_mock_inventory` (logs, traces, metrics) | 정상 | 정상 |
| `server_mock_public_status` | Public status | Production | monitor `uptime_mock_status` | 정상 | 정상 |
| `server_mock_batch_host_01` | batch-host-01 | Backoffice | infra `infra_mock_worker_01`; monitor `uptime_mock_database`; apps `observed_mock_notifications` (logs, metrics), `observed_mock_billing` (logs, metrics) | 확인 필요 (CPU 76.1%) | 정상 (CPU 46.3%) |
| `server_mock_mail_relay` | Mail relay | Backoffice | monitor `uptime_mock_smtp` | 정상 | 정상 |
| `server_mock_staging_host_01` | staging-host-01 | Staging | infra `infra_mock_staging_01`; monitors `uptime_mock_docs`, `uptime_mock_redis` (paused); app `observed_mock_search` (logs, traces) | 정상 (the paused Redis TCP does not outweigh healthy targets) | 정상 |
| `server_mock_staging_empty` | staging-empty | none | none | 대기 (연결한 대상 없음) | 대기 |

In `normal`, no server is 장애 or 확인 필요 on the server list or the overview: the three hosts above the 70% usage warning get the lower values in the normal column (`NORMAL_USAGE` in `mockRouter.ts`), and the host charts follow them (the chart's swing, CPU ±12 and memory ±4 around the current value, stays below 70%). The other scenarios keep the high values.

In `attention` and `partial-failure`, `uptime_mock_checkout` is down with an outage that started six minutes ago; its timeline entry links to `/servers/server_mock_edge_host_01/uptime/uptime_mock_checkout`. In `partial-failure` the app list fails, so the apps drop out of the server rows. The outage turns the checks after its start into failures, and every uptime figure of the monitor (list and 24h KPI, today's bar, 30-day and 90-day uptime) is computed from those checks, so they agree with `체크 N회 중 실패 N회`.

Uptime figures are never fixed values: 24h comes from the day's checks, the 90-day figure is the mean of the daily bars, and the 30-day figure is today's checks plus the previous 29 bars at the same check count. Docker service response history uses the API's buckets (2, 5 and 20 minutes for 1h, 6h and 24h). `demo-servers.spec.ts` checks both.

In `attention`, the first metric of `observed_mock_catalog` (the first app with metrics) is over its threshold (`breached` in `/observed-services/metric-catalog`). The metrics capability of `db-primary-01` is 확인 필요 with the reason 임계값 초과 (metrics tab dot, overview row, app selector). The server stays 확인 필요 and its cause stays `메모리 84.6%`, because infrastructure comes before apps among causes of the same state. `normal` has no breached metric.

Scenarios return copied read data where they need a variation. The base fixtures remain mutable for normal demo create, update, and delete flows. Legacy `mockScenario` URL links still work, but the selector is the intended UX.
