# Servers include Docker hosts

Status: accepted

Date: 2026-11-22

Supersedes: ADR 0011. Retires what was left of ADR 0007. Keeps ADR 0003 and ADR 0005. Amended by: ADR 0013 (no Groups; server names are unique overall).

## Context

ADR 0011 made a Server the owner of directly configured targets and kept the
Docker Environment beside it. Data collected by a Docker Collector appeared
only in its Docker Environment, and Server views never showed Docker rows.

A Docker Collector reads one local Docker socket and the host file system
mounted at `/hostfs`. It does not manage a Swarm or a remote engine, so a Docker
Environment is one Docker engine on one host. A Server is usually one host too.
When one host was connected both ways, the same machine appeared twice: in the
Server list and in the Docker Environment list, twice in its Group, and with no
link between the two. Linking the two (a `docker_environment_id` on the Server)
was considered and set aside. It keeps two names for one thing, and a link only
points from one screen to the other.

## Decision

Every monitored host or system is a Server. A Server can have at most one
Docker Collector. How a target is connected (Docker Collector, direct
OpenTelemetry, a standard OpenTelemetry Collector for infrastructure, or an
Uptime Monitor) is a property of the Server and its targets, shown in the
connection line of target pages. Workloads a Docker Collector discovers are
Containers, targets of the Server, beside its apps and monitors.

- Storage: `agents.server_id` records which Server a Docker Collector belongs
  to. Each Docker Environment becomes a Server with the agent's id, name, and
  Group. Collection keys do not change: ingest, enrollment, and stored data stay
  keyed by agent id, the compatibility identifier of ADR 0005.
- Group membership belongs to the Server. A Docker Collector's data inherits it,
  as ADR 0003 has it.
- Names: the migration never merges Servers. A Docker Environment whose name is
  taken in its Group gets a suffix such as ` (2)`, and the screens suggest the
  same-host merge, which the user confirms. When both Servers collect
  infrastructure, the user picks one source.
- One source of host metrics per Server. Every path that would make a Docker
  Collector and an OpenTelemetry Collector collect the same host asks the user
  to keep one: the same-host merge, installing a Docker Collector on a Server,
  connecting an OpenTelemetry Collector, and adding infrastructure to a Docker
  Collection Profile. The API refuses the ambiguous request (409
  `INFRASTRUCTURE_SOURCE_REQUIRED`); there is no switch between two sources.
- A Docker Collector is installed from a Server: Add Server asks for the
  connection method, and an existing Server offers the install. There is no
  separate "connect Docker" entry.
- Server views show Docker data. Docker Environment screens become Server tabs
  and Container pages, and their addresses redirect.

## Rollout

Done in nine pull requests (#166 to #174).

1. Model (#166, #167): Servers for Docker Environments (migrateV59), hidden
   from the default Server list (`GET /servers?include=docker` shows them).
   Same-name lookups never attach direct targets to them.
2. Screens (#168 to #170): one Server menu and list (with a connection
   filter), a Containers tab, Container pages, redirects from
   `/environments`, `/agents/:id` and `/services/:agentId/:key`, and Groups,
   the overview, the command palette and alert rules counting and naming
   Docker hosts as Servers.
3. Same-host merge and install (#171, #172): merging Docker Servers, the
   one-source rule, the same-host suggestion (answers stored in
   `same_host_dismissals`, migrateV60), and the install from a Server.
4. Vocabulary and documentation (#173, #174): Containers and Docker Collector
   in product copy; Docker Environment is retired.

## Consequences

- One machine is one Server. The same-host case is solved by construction.
- A Server may be a host or a logical unit (for example only Uptime Monitors
  for an external site), as before.
- Two Docker engines on one host are two Servers, as they were two Docker
  Environments.
- A cluster (Swarm, Kubernetes) is not one Server. Supporting one needs its own
  unit.
