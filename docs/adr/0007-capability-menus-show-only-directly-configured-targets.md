# Capability menus show only directly configured targets

Status: accepted

Date: 2026-10-25

Supersedes: ADR 0006. Partially supersedes ADR 0001 (its menu consequence).

## Context

ADR 0001 kept the one-installation Docker Collector as the integrated path and
made each capability menu a read view over data the Collector shares. ADR 0006
followed from it: Uptime merged Docker Collector response checks with
independent Uptime Monitors, and splitting Uptime by where a check was
configured was rejected because a Docker-only user would see an empty page.

In practice, connecting a Docker Collector to a real environment proved harder
than expected and ran into a variety of problems. The product direction is the
individual monitoring capabilities, not Docker collection. ADR 0004 already
gives every capability a path without a Docker Environment: Uptime Monitors,
Direct Telemetry Connections for Logs, Metrics, and API, and directly
configured Infrastructure Resources backed by a standard OpenTelemetry
Collector.

Mixing Docker-collected rows into those menus keeps Docker as the first option
in every list, empty state, and Add flow, and couples each menu to the Docker
Environment model.

## Decision

Uptime, Logs, Infrastructure, API, and Metrics list, count, search, and
configure only directly configured targets:

- Uptime: independent Uptime Monitors.
- Logs, Metrics, API: Observed Services created for a Direct Telemetry
  Connection.
- Infrastructure: Infrastructure Resources with the standard OpenTelemetry
  Collector adapter.

Data collected by a Docker Collector appears only in its Docker Environment and
the Observed Service details under it. This includes Docker Collector response
checks, container liveness checks, container logs, host metrics, and
Collector-forwarded API and OpenTelemetry telemetry.

A capability menu's Add flow sets up a direct target only. It does not select a
Docker Environment or change a Docker Collection Profile; profiles are changed
from the Docker Environment.

Views that answer "what is failing" or "what belongs together" keep combining
both sources: Overview, Projects, Alerts, the navigation failure badge, and the
command palette.

In navigation, Docker Environment follows the capability menus.

Collection, storage, ingest, and the HTTP API do not change. Capability read
views select direct targets from the existing endpoints.

## Consequences

- A user with only a Docker Environment sees empty capability menus. Empty
  states lead with direct setup and, when a Docker Environment exists, say that
  its data is in Docker Environment.
- Uptime loses its source filter and Docker rows. The response check and
  liveness check distinction from ADR 0006 now applies only inside a Docker
  Environment.
- Uptime counts differ from Overview failure counts by design: Overview still
  includes Docker Environment failures.
- The Docker Environment must be self-contained for every capability its
  Collector collects. Gaps that the capability menus used to cover, such as
  cross-service log summaries, must be closed there before Docker rows leave the
  menus.
- Existing Docker Environment data, deep links, Alerts, and Project membership
  are kept. ADR 0003 and ADR 0005 still hold.
- The `uptime` Collector capability keeps its name for compatibility.
