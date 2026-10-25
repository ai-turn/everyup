# Agent is a Collector, not a Project

Status: partially superseded by ADR 0007. Capability menus no longer show data collected by a Docker Collector.

EveryUp keeps its one-installation Agent flow as the integrated monitoring option: one Agent can collect workload health, logs, infrastructure data, and optional API and OpenTelemetry telemetry. Product navigation is organised by those capabilities, while Project is introduced as an optional logical grouping rather than being represented by an Agent or host. This avoids making Docker installation the prerequisite for every monitor while preserving the zero-configuration integrated path.

## Consequences

Feature menus are read views over shared collected data, not separate collectors. Agent capability profiles must change the actual runtime configuration and privileges, not merely hide menu items. New Project relationships are deferred until the feature-level paths are established.
