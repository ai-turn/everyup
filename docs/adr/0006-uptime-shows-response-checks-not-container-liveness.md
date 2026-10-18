# Uptime shows response checks, not container liveness

Status: accepted

Date: 2026-10-18

## Context

The Uptime page merges independent Uptime Monitors and Docker-discovered
Observed Services into one list and one healthy/failing count. A Docker
Collector reports two different kinds of check for an Observed Service:

- `checkType: "http"`: the Collector calls the workload's health URL, which is
  a response check of the same kind as an HTTP Uptime Monitor.
- `checkType: "docker"`: the Collector reports healthy while the container
  state is `running`, which is a liveness check.

A running container can still fail to answer its users. Counting both kinds as
the same "healthy" hides that difference, and a source badge alone does not
explain it.

Separating the page by where a check was configured (independent vs Docker
Environment) was considered and rejected. Docker Collector response checks
would disappear from Uptime, so a user on the one-installation path of ADR 0001
would open an empty Uptime page while the Collector is checking their
endpoints.

## Decision

Uptime contains response checks, whichever path created them: independent
Uptime Monitors and Docker Collector checks other than `checkType: "docker"`.
Container liveness checks appear only in their Docker Environment.

Each Uptime row names its check method and where it runs, such as
`HTTP · EveryUp` or `HTTP · <Docker Environment name>`. Uptime offers an
All / Independent / Docker Environment filter.

Uptime keeps each check managed in one place. Independent Uptime Monitors are
edited, paused, and deleted on Uptime. Docker Collector checks have no such
actions on Uptime and link to their Observed Service in the Docker Environment.

## Consequences

- ADR 0001 still holds: data collected by a Docker Collector appears under the
  Uptime capability when it is a response check.
- The `uptime` Collector capability keeps its name; its response checks remain
  visible on Uptime.
- Uptime counts and Overview failure counts can differ by design. Overview
  answers "what is failing" and still includes container liveness failures.
- Nothing changes in collection, storage, or the API; the filter is applied on
  `checkType` in the Uptime read view.
