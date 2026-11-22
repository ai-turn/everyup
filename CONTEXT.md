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
A connected Docker host monitored through an EveryUp Docker Collector. Its discovered workloads and infrastructure data share the Docker Environment's Group membership. Being retired by ADR 0012: every Docker Environment is stored as a Server with the same id (`agents.server_id`) and shown in the Server list; the Docker Environment menu and screens are gone (old `/environments` and `/agents/:id` addresses redirect to the Server list and Server). Each discovered workload has a container page under its Server (`/servers/:serverId/containers/:key`); the old `/services/:agentId/:key` address redirects there. Its Group is its Server's Group: a Group counts and lists it once, as a Server, and moving the Server moves the Docker Collector. A Server has at most one Docker Collector. The same host connected twice (a Docker Server and a direct Server with the same name) is joined by the same-host merge, which the user confirms: the Docker Collector keeps its id and moves to the surviving Server, and when both a Docker Collector and an OpenTelemetry Collector would collect that host's metrics the user keeps one. The same one-source rule holds when installing a Docker Collector on a Server, connecting an OpenTelemetry Collector, or adding infrastructure to a Docker Collector's profile. A Docker Collector is installed from a Server (Add Server's connection method, or an existing Server's overview), never as a separate thing. The term leaves product copy in the terminology stage.
_Avoid_: Agent, Group, Docker Project

**Docker Collector**:
The integrated Collector installed for one Docker Environment. It can collect Docker workload state, container logs, host metrics, and optional API or OpenTelemetry telemetry with one or more selected capabilities.
_Avoid_: Agent, Monitor

**Collector**:
A data-ingestion mechanism. The EveryUp Docker Collector is the integrated Docker path and can expose an authenticated OpenTelemetry gateway for its selected telemetry capabilities. A standard OpenTelemetry Collector can also send host metrics directly for an Infrastructure Resource. Product copy always names which one: **Docker Collector** or **OpenTelemetry Collector**; a bare Collector only means both at once.
_Avoid_: Group, bare Collector for one of the two

**Docker Collection Profile**:
The set of monitoring capabilities enabled for a Docker Collector. A profile changes what the Collector runs and is configured from its Docker Environment.
_Avoid_: Capability-specific Agent, Independent Collector

**Uptime Monitor**:
A configured availability check, such as HTTP or TCP, with its own target and schedule. It belongs to a Server and runs without a Docker Environment.
_Avoid_: Service, Group

**Response Check**:
A check that asks a target to answer, such as an HTTP request or TCP connection. Independent Uptime Monitors and Docker Collector HTTP checks are both Response Checks. A Server's Uptime tab shows only that Server's Uptime Monitors; Docker Collector Response Checks appear in the containers tab of the Server their Docker Collector belongs to.
_Avoid_: Liveness Check

**Liveness Check**:
A Docker Collector check that is healthy while the container is running, without asking the workload to answer. It appears only in the containers tab of its Docker Collector's Server.
_Avoid_: Uptime, Response Check

**Observed Service**:
A workload discovered by a Collector or created for a direct telemetry connection, such as a Docker container or instrumented application. Its health, logs, API data, and metrics can be explored independently. Shown as **앱** when created for a Direct Telemetry Connection and as **서비스** when a Docker Collector discovered it.
_Avoid_: Group

**Direct Telemetry Connection**:
An OTLP ingestion connection bound to one Observed Service. Its credential authorizes an explicit set of Logs, Metrics, and Traces signals and does not create a Docker Environment. The Observed Service it creates belongs to a Server.
_Avoid_: Docker Environment, Docker Collector, Independent Collector

**Infrastructure Resource**:
A host or other operational resource whose capacity and availability are monitored. It can be backed by an EveryUp Docker Collector or by a directly configured standard OpenTelemetry Collector. A direct Infrastructure Resource belongs to a Server, at most one per Server, and inherits that Server's Group; a Docker-backed one belongs to its Docker Collector's Server (ADR 0012) and inherits that Server's Group.
_Avoid_: Docker Environment, Docker Collector

**Connect**:
Making data flow into EveryUp from outside: Logs, API Requests, Metrics, Infrastructure, or a Docker Environment. Shown as **연결**; the start button and the dialog title are `{target} 연결`. Installing is running the first command on a host (**설치**), applying is re-running it after the Docker Collection Profile changed (**적용**).
_Avoid_: Add, Register, Install (as the start verb)

**Add**:
Creating something that only exists in EveryUp's own settings: a Server, an Uptime Monitor, an alert rule, a Group. Shown as **추가**.
_Avoid_: Connect

**API Requests**:
The connection unit for an Observed Service's OpenTelemetry traces. Connecting API Requests also fills the Traces tab, so Traces is only a tab name. Shown as **API 요청**.
_Avoid_: bare API, API traces

**Container Status**:
The Docker Collection Profile capability stored as `uptime`: Liveness Checks and Docker Collector Response Checks. Shown as **컨테이너 상태**, never as uptime (see Liveness Check).
_Avoid_: Uptime (for this capability)

**Group**:
An optional folder that directly collects Docker Environments and Servers. A Server's targets inherit the Server's Group. A Docker-discovered Observed Service, its logs, API data, metrics, and Infrastructure Resource inherit the Group of their Docker Environment. Shown as **그룹** in the UI; code, API paths, and storage keep the `project` identifier.
_Avoid_: Project (in product copy), Docker Environment, Docker Project, server
