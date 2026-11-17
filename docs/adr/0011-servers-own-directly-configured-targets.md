# Servers own directly configured targets

Status: accepted

Date: 2026-11-17

Supersedes: ADR 0007. Amends: ADR 0003, ADR 0004.

## Context

ADR 0007 split directly configured targets into five capability menus:
Uptime, Logs, Infrastructure, API, and Metrics. Each menu kept its own list and
details. Users think about monitoring by server, not by capability, so one host
or deployed system was spread across five places.

Three ways to bring a server's capabilities together were considered:

- A. Promote Group to a server and add capability tabs to its details. No
  schema change, but a Group also holds Docker Environments, which conflicts
  with a separate Server and Docker Environment entry, and the folder-like use
  of ADR 0008 is lost.
- B. Add a Server entity that owns the directly configured targets. It mirrors
  the Docker Environment and keeps Group a folder, at the cost of changes across
  the backend and frontend.
- C. Attach Uptime Monitors and Infrastructure Resources to an Observed
  Service. This reuses the Observed Service details, but the owner of the
  Infrastructure Resource is unclear when one host runs several applications.

B was chosen. Its inheritance rule is the same one ADR 0003 applies to Docker
Environments, so it adds no new kind of membership.

## Decision

A Server is a named unit the user monitors, usually one host or one deployed
system. It owns three kinds of directly configured targets:

- Uptime Monitors.
- Observed Services created for a Direct Telemetry Connection.
- At most one Infrastructure Resource with the standard OpenTelemetry Collector
  adapter.

Every directly configured target belongs to exactly one Server. A target
created without a Server is attached to the Server with the same name and
Group, which is created when none exists. An Infrastructure Resource gets a
new Server with a suffixed name when that Server already has one.

Group membership belongs to the Server, and its targets inherit it. This
extends ADR 0003 from Docker Environments to directly configured targets. The
direct Group membership that ADR 0003 gave Uptime Monitors, ADR 0004 gave
directly created Observed Services, and directly configured Infrastructure
Resources later gained, moves to the Server.

Uptime Monitor and Infrastructure Resource remain separate modules, as in ADR
0004, but each belongs to a Server.

Navigation is to become Overview / Servers, Docker Environments, Groups /
Alerts, Settings. The capability menus are removed; a Server shows Uptime,
Infrastructure, Logs, API, and Metrics as tabs over its own targets.

Data collected by a Docker Collector still appears only in its Docker
Environment. This part of ADR 0007 is kept: Server views never show Docker
rows.

Views across Servers are Overview, Groups, Alerts, and an all-logs view outside
the sidebar for log summaries and patterns when the failing Server is not yet
known.

## Consequences

- Existing directly configured targets with the same name and Group migrate
  into one Server. Every other target gets its own Server. The API can move
  targets and merge Servers afterwards; screens for both are to come with the
  navigation change.
- Server names are unique within a Group, ignoring case and surrounding
  whitespace.
- Deleting a Group leaves its Servers without a Group. When a name then
  collides with a Server already without a Group, a suffix such as ` (2)` is
  added.
- Until the new screens ship, the existing screens still assign a Group to a
  single target, and that assignment applies to the whole Server the target
  belongs to. When the destination Group already has a Server with the same
  name, the two Servers are merged. When both own an Infrastructure Resource,
  they are not merged; the moving Server gets a suffix such as ` (2)` instead.
- Bulk Uptime actions across several Servers go away. They are to work only
  inside one Server's Uptime tab.
- The `project_id` columns of the target tables stay in storage but are no
  longer read or written. A target's Group comes from its Server.
- Deleting a Server deletes its targets and their data.
- Alert rules still point at individual targets. Collection, ingest, storage,
  and retention do not change.
