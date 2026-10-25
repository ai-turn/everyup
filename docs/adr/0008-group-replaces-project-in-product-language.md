# Group replaces Project in product language

Status: accepted

Date: 2026-10-25

EveryUp presents an optional grouping of independently registered targets as a **Group** (그룹 in the UI) instead of a **Project**, and shows it with Docker Environments in a separate **모아 보기** (collected views) section of the navigation, after the capability menus. Both entries look at several capabilities as one unit: a Docker Environment shows everything one Docker Collector collects, and a Group shows the targets a user put together like a folder. "Project" suggested a development project or a unit that owns its own collection, which neither the capability-first direction of ADR 0007 nor the folder-like use supports. As with ADR 0005, the `/projects` routes, `project` API paths, `projectId` fields, and storage keep their names so upgrades need no migration; earlier ADRs keep their original Project wording as historical records.
