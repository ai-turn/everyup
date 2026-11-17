# EveryUp Monitoring

EveryUp connects monitoring data to the places where users investigate availability, telemetry, and incidents. Users configure monitoring capabilities per Server. A Docker Environment is a separate, optional integration whose collected data appears only in that Docker Environment.

## Language

**Server**:
A named unit the user monitors, usually one host or one deployed system. It owns directly configured targets: Uptime Monitors, Observed Services created for a Direct Telemetry Connection, and at most one directly configured Infrastructure Resource. A Server may belong to a Group, and its targets inherit that Group.
_Avoid_: Docker Environment, Group, host (in product copy)

**Capability Tab**:
One of the Uptime, Infrastructure, Logs, API, and Metrics tabs in a Server. It shows and configures only that Server's directly configured targets.
_Avoid_: Capability Menu, Docker Environment view

**Docker Environment**:
A connected Docker host monitored through an EveryUp Docker Collector. Its discovered workloads and infrastructure data share the Docker Environment's Group membership and appear only in the Docker Environment, not in Servers.
_Avoid_: Agent, Group, Docker Project, server

**Docker Collector**:
The integrated Collector installed for one Docker Environment. It can collect Docker workload state, container logs, host metrics, and optional API or OpenTelemetry telemetry with one or more selected capabilities.
_Avoid_: Agent, Monitor

**Collector**:
A data-ingestion mechanism. The EveryUp Docker Collector is the integrated Docker path and can expose an authenticated OpenTelemetry gateway for its selected telemetry capabilities. A standard OpenTelemetry Collector can also send host metrics directly for an Infrastructure Resource.
_Avoid_: Group

**Docker Collection Profile**:
The set of monitoring capabilities enabled for a Docker Collector. A profile changes what the Collector runs and is configured from its Docker Environment.
_Avoid_: Capability-specific Agent, Independent Collector

**Uptime Monitor**:
A configured availability check, such as HTTP or TCP, with its own target and schedule. It belongs to a Server and runs without a Docker Environment.
_Avoid_: Service, Group

**Response Check**:
A check that asks a target to answer, such as an HTTP request or TCP connection. Independent Uptime Monitors and Docker Collector HTTP checks are both Response Checks. A Server's Uptime tab shows only that Server's Uptime Monitors; Docker Collector Response Checks appear in their Docker Environment.
_Avoid_: Liveness Check

**Liveness Check**:
A Docker Collector check that is healthy while the container is running, without asking the workload to answer. It appears only in its Docker Environment.
_Avoid_: Uptime, Response Check

**Observed Service**:
A workload discovered by a Collector or created for a direct telemetry connection, such as a Docker container or instrumented application. Its health, logs, API data, and metrics can be explored independently.
_Avoid_: Group

**Direct Telemetry Connection**:
An OTLP ingestion connection bound to one Observed Service. Its credential authorizes an explicit set of Logs, Metrics, and Traces signals and does not create a Docker Environment. The Observed Service it creates belongs to a Server.
_Avoid_: Docker Environment, Docker Collector, Independent Collector

**Infrastructure Resource**:
A host or other operational resource whose capacity and availability are monitored. It can be backed by an EveryUp Docker Collector or by a directly configured standard OpenTelemetry Collector. A direct Infrastructure Resource belongs to a Server, at most one per Server, and inherits that Server's Group; a Docker-backed one inherits its Docker Environment's Group.
_Avoid_: Docker Environment, Docker Collector

**Group**:
An optional folder that directly collects Docker Environments and Servers. A Server's targets inherit the Server's Group. A Docker-discovered Observed Service, its logs, API data, metrics, and Infrastructure Resource inherit the Group of their Docker Environment. Shown as **그룹** in the UI; code, API paths, and storage keep the `project` identifier.
_Avoid_: Project (in product copy), Docker Environment, Docker Project, server
