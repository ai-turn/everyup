# No groups

Status: accepted

Date: 2026-11-24

Supersedes: ADR 0008, ADR 0003. Amends: ADR 0011, ADR 0012.

## Context

ADR 0008 named the optional folder of targets a Group, and ADR 0011 and
ADR 0012 moved Group membership onto the Server: a Server's targets and its
Docker Collector's data inherited the Server's Group. Once every host was a
Server (ADR 0012), the product was organized per Server, and the Group screens
mostly repeated the server list with a filter. Group membership also made
server names unique only within a Group, so two Servers could share a name and
every name lookup, merge, and rename had to carry the Group along.

Keeping Group as a plain Server attribute (a field, a filter, counts per Group
in the filter) was considered first and set aside by the owner: it keeps the
data model, the name rule, and the copy for a feature nobody needs once the
screens are per Server.

## Decision

EveryUp has no Groups. There is no Group menu, screen, field, filter, API, or
membership. A Server is the only unit a user organizes targets into.

- Server names are unique across all Servers, ignoring case and surrounding
  spaces. Find-or-create by name and the ` (2)` suffix apply across all
  Servers.
- Old Group URLs (`/projects`, `/projects/:id` and below) open the server list,
  keeping the query and hash. The older `/projects/:agentId` (a Docker
  Environment) still opens its Server.
- The `/projects` API is removed, and `projectId` is no longer accepted or
  returned. Updating a target without `serverId` leaves it on its Server.

## Consequences

- Upgrading renames Servers whose names collided across Groups instead of
  merging them: the oldest keeps its name, the others get their old Group's
  name appended (`api (Staging)`), then ` (2)` if that is taken too.
- The `projects` table and the `project_id` columns stay in storage, unread
  and empty of membership, so an older binary still starts after a rollback.
  Dropping them needs a table rebuild because of their foreign keys.
- Collection keys, ingest, and enrollment do not change.
- ADR 0003 (membership inherited from Agents) and ADR 0008 (the Group name)
  no longer apply. ADR 0011 and ADR 0012 still decide what a Server owns;
  their Group membership rules do not.
