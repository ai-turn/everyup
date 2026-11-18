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
| `server_mock_edge_host_01` | edge-host-01 | Production | infra `infra_mock_edge_01`; monitors `uptime_mock_store`, `uptime_mock_checkout`; apps `observed_mock_checkout` (logs), `observed_mock_orders` (logs, traces, metrics) | 장애 (Checkout API 응답 없음) | 확인 필요 (메모리 72.8%) |
| `server_mock_db_primary_01` | db-primary-01 | Production | infra `infra_mock_db_01`; app `observed_mock_catalog` (metrics) | 확인 필요 (메모리 84.6%) | 확인 필요 |
| `server_mock_payments_api` | payments-api | Production | monitor `uptime_mock_payments`; app `observed_mock_payments` (traces, logs) | 정상 | 정상 |
| `server_mock_inventory_api` | inventory-api | Production | app `observed_mock_inventory` (logs, traces, metrics) | 정상 | 정상 |
| `server_mock_public_status` | Public status | Production | monitor `uptime_mock_status` | 정상 | 정상 |
| `server_mock_batch_host_01` | batch-host-01 | Backoffice | infra `infra_mock_worker_01`; monitor `uptime_mock_database`; apps `observed_mock_notifications` (logs, metrics), `observed_mock_billing` (logs, metrics) | 확인 필요 (CPU 76.1%) | 확인 필요 |
| `server_mock_mail_relay` | Mail relay | Backoffice | monitor `uptime_mock_smtp` | 정상 | 정상 |
| `server_mock_staging_host_01` | staging-host-01 | Staging | infra `infra_mock_staging_01`; monitors `uptime_mock_docs`, `uptime_mock_redis` (paused); app `observed_mock_search` (logs, traces) | 정상 (the paused Redis TCP does not outweigh healthy targets) | 정상 |
| `server_mock_staging_empty` | staging-empty | none | none | 대기 (연결한 대상 없음) | 대기 |

In `attention` and `partial-failure`, `uptime_mock_checkout` is down with an outage that started six minutes ago; its timeline entry links to `/servers/server_mock_edge_host_01/uptime/uptime_mock_checkout`. In `partial-failure` the app list fails, so the apps drop out of the server rows.

Scenarios return copied read data where they need a variation. The base fixtures remain mutable for normal demo create, update, and delete flows. Legacy `mockScenario` URL links still work, but the selector is the intended UX.
