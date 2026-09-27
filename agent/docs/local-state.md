# Local State

The EveryUp Docker collector stores local state under `EVERYUP_DATA_DIR` so alert behavior
survives container restarts.

## Files

| File | Format | Purpose |
|---|---|---|
| `agent-state.json` | JSON | Per-target identity, health state, alert timestamps, per-container log cursors, and the Web event delivery checkpoint |
| `audit.jsonl` | JSON Lines | Startup, alert, and recovery event history used for Web delivery |

## `agent-state.json`

The state file is written through a temporary file and replace step. It is safe
to back up while the Docker collector is running, though a very recent check may not yet be
reflected in the backup.

Example:

```json
{
  "version": 2,
  "auditOffset": 189,
  "targets": {
    "env:api": {
      "serviceName": "api",
      "checkType": "http",
      "endpoint": "http://api:8080/health",
      "lastAlertAt": "2026-06-18T00:00:00Z",
      "wasHealthy": false,
      "seenResult": true,
      "updatedAt": "2026-06-18T00:00:30Z"
    }
  }
}
```

`serviceName`/`checkType`/`endpoint` are persisted so display names survive a
restart. The map key is the target's local key (`env:<EVERYUP_SERVICE_NAME>` for
the `EVERYUP_HEALTH_URL` target, or a stable key for discovered ones — service
name / compose `project:service`, not the container ID, so the entry survives
container recreation). After a successful discovery the Docker collector prunes
entries for removed targets. A failed Docker query preserves the last known state.

`logCursors` is a separate map keyed by Docker container ID. Each entry stores
`at` (the acknowledged log timestamp) and `count` (the number of acknowledged
records at that timestamp). Replicas share a service card but never share a log
cursor. Removed containers' cursors are pruned after successful discovery.

The collector saves a cursor after each successful log request. Failed requests
resume from the last acknowledged position, including after a restart. On upgrade,
the old service-level `lastDockerLogAt` provides a starting point; its timestamp
boundary is replayed because older versions did not count equal timestamps.

Delivery can produce duplicates if Web accepts a request but its response is
lost, or the collector exits before saving the acknowledgement. Docker log
rotation or container deletion can remove unread data; keep Docker retention
long enough for the outages you expect. The local state file is a checkpoint,
not a durable copy of the log contents.

## `audit.jsonl`

Each line is one event. This keeps appends simple and makes the file easy to
ship into EveryUp Web. Events are flushed to Web over the connected-mode sync
in batches of 100. `auditOffset` records the byte position after the last
acknowledged batch. Failed Web requests leave the checkpoint unchanged, so
events are retried after a restart. A lost response or a crash between Web's
acknowledgement and checkpoint write can cause duplicate events.

When upgrading a version 1 state file, the collector replays the audit file's
last 500 events because earlier Web delivery was not tracked. Some old events
may appear twice; pending ones are recovered where the audit file still has
them. Keep `audit.jsonl` and
`agent-state.json` together when restoring a backup.

Example:

```jsonl
{"time":"2026-06-18T00:00:00Z","type":"agent_started","serviceName":"api","message":"Docker collector everyup-agent is running."}
{"time":"2026-06-18T00:01:00Z","type":"alert_sent","serviceName":"api","targetKey":"env:api","message":"http://api:8080/health failed: connection refused"}
```

Mount `EVERYUP_DATA_DIR` as a persistent volume in Docker Compose.
