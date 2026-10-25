# EveryUp Monitoring

EveryUp connects monitoring data to the places where users investigate availability, telemetry, and incidents. Each monitoring capability is configured directly in its own Capability Menu. A Docker Environment is a separate, optional integration whose collected data stays in that Docker Environment.

## Language

**Capability Menu**:
One of Uptime, Logs, Infrastructure, API, and Metrics. It lists and configures only directly configured targets: Uptime Monitors, Observed Services created for a Direct Telemetry Connection, and Infrastructure Resources backed by a standard OpenTelemetry Collector.
_Avoid_: Docker Environment view

**Docker Environment**:
A connected Docker host monitored through an EveryUp Docker Collector. Its discovered workloads and infrastructure data share the Docker Environment's Project membership and appear only in the Docker Environment, not in Capability Menus.
_Avoid_: Agent, Project, Docker Project, server

**Docker Collector**:
The integrated Collector installed for one Docker Environment. It can collect Docker workload state, container logs, host metrics, and optional API or OpenTelemetry telemetry with one or more selected capabilities.
_Avoid_: Agent, Monitor

**Collector**:
A data-ingestion mechanism. The EveryUp Docker Collector is the integrated Docker path and can expose an authenticated OpenTelemetry gateway for its selected telemetry capabilities. A standard OpenTelemetry Collector can also send host metrics directly for an Infrastructure Resource.
_Avoid_: Project

**Docker Collection Profile**:
The set of monitoring capabilities enabled for a Docker Collector. A profile changes what the Collector runs and is configured from its Docker Environment.
_Avoid_: Capability-specific Agent, Independent Collector

**Uptime Monitor**:
A configured availability check, such as HTTP or TCP, with its own target and schedule. It may run without a Docker Environment.
_Avoid_: Service, Project

**Response Check**:
A check that asks a target to answer, such as an HTTP request or TCP connection. Independent Uptime Monitors and Docker Collector HTTP checks are both Response Checks. Uptime shows only Uptime Monitors; Docker Collector Response Checks appear in their Docker Environment.
_Avoid_: Liveness Check

**Liveness Check**:
A Docker Collector check that is healthy while the container is running, without asking the workload to answer. It appears only in its Docker Environment.
_Avoid_: Uptime, Response Check

**Observed Service**:
A workload discovered by a Collector or created for a direct telemetry connection, such as a Docker container or instrumented application. Its health, logs, API data, and metrics can be explored independently.
_Avoid_: Project

**Direct Telemetry Connection**:
An OTLP ingestion connection bound to one Observed Service. Its credential authorizes an explicit set of Logs, Metrics, and Traces signals and does not create a Docker Environment.
_Avoid_: Docker Environment, Docker Collector, Independent Collector

**Infrastructure Resource**:
A host or other operational resource whose capacity and availability are monitored. It can be backed by an EveryUp Docker Collector or by a directly configured standard OpenTelemetry Collector. A direct Infrastructure Resource may belong to a Project; a Docker-backed one inherits its Docker Environment's Project.
_Avoid_: Docker Environment, Docker Collector

**Project**:
An optional logical grouping of Docker Environments, independent Uptime Monitors, directly created Observed Services, and directly configured Infrastructure Resources. A Docker-discovered Observed Service, its logs, API data, metrics, and Infrastructure Resource inherit the Project of their Docker Environment.
_Avoid_: Docker Environment, Docker Project, server
