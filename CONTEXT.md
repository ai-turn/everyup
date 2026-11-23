# EveryUp Monitoring

EveryUp connects monitoring data to the places where users investigate availability, telemetry, and incidents. Every monitored host or system is a Server, and users configure monitoring per Server: directly (Uptime Monitors, OpenTelemetry) or through a Docker Collector installed on it (ADR 0012).

## Language

**Server**:
A named unit the user monitors, usually one host or one deployed system. It owns its targets: Uptime Monitors, apps created for a Direct Telemetry Connection, at most one directly configured Infrastructure Resource, and, when it has a Docker Collector, the Containers that Collector discovers. A Server has at most one Docker Collector and one source of host metrics. A Server may belong to a Group, and its targets inherit that Group. How a target is connected (Docker Collector, direct OpenTelemetry, OpenTelemetry Collector, Uptime Monitor) is a property of the target, shown in the connection line of its page; the Server list can be filtered by it.
_Avoid_: Docker Environment, Group, host (in product copy)

**Capability Tab**:
One of the Uptime, Infrastructure, Logs, API, and Metrics tabs in a Server. It shows and configures that Server's targets of that capability, including what its Docker Collector collects. A Server with a Docker Collector also has a Containers tab.
_Avoid_: Capability Menu, Docker Environment view

**Container**:
A workload a Docker Collector discovered on its Server's host, a target of that Server beside its apps and monitors. It has its own page under the Server (`/servers/:serverId/containers/:key`). Shown as **컨테이너**.
_Avoid_: Docker Service, Service (for Docker workloads)

**Docker Collector**:
The integrated Collector installed on one Server's Docker host. It can collect container state, container logs, host metrics, and optional API or OpenTelemetry telemetry with one or more selected capabilities. It is installed from a Server (Add Server's connection method, or an existing Server's overview: **Docker Collector 설치**), never as a separate thing. Its id (the agent id) is the compatibility identifier for collection; it does not change when its Server is merged.
_Avoid_: Agent, Monitor, Docker Environment

**Collector**:
A data-ingestion mechanism. The EveryUp Docker Collector is the integrated Docker path and can expose an authenticated OpenTelemetry gateway for its selected telemetry capabilities. A standard OpenTelemetry Collector can also send host metrics directly for an Infrastructure Resource. Product copy always names which one: **Docker Collector** or **OpenTelemetry Collector**; a bare Collector only means both at once.
_Avoid_: Group, bare Collector for one of the two

**Docker Collection Profile**:
The set of monitoring capabilities enabled for a Docker Collector. A profile changes what the Collector runs and is configured from its Server's Docker Collector setup guide.
_Avoid_: Capability-specific Agent, Independent Collector

**Host Metrics Source**:
The one Collector a Server takes host metrics (CPU, memory, disk) from: its Docker Collector or a directly connected OpenTelemetry Collector. Every path that would make both collect the same host (same-host merge, installing a Docker Collector, connecting an OpenTelemetry Collector, adding infrastructure to a Docker Collection Profile) asks the user to keep one. Keeping the Docker Collector stops the OpenTelemetry Collector resource (its history stays); keeping the OpenTelemetry Collector removes infrastructure from the profile.
_Avoid_: double collection, infrastructure switch

**Same-host Merge**:
Joining two Servers that are the same machine, typically a Docker Server and a direct Server created before ADR 0012. Names only suggest it (`같은 호스트인가요?` on the overview, ignoring a ` (2)` suffix); the user always confirms. The surviving Server keeps its id; the Docker Collector moves to it with its id unchanged, and the old Server's addresses redirect. A "not the same host" answer is stored for every user.
_Avoid_: automatic merge, link

**Uptime Monitor**:
A configured availability check, such as HTTP or TCP, with its own target and schedule. It belongs to a Server and runs without a Docker Collector.
_Avoid_: Service, Group

**Response Check**:
A check that asks a target to answer, such as an HTTP request or TCP connection. Independent Uptime Monitors and Docker Collector HTTP checks are both Response Checks. A Server's Uptime tab shows only that Server's Uptime Monitors; Docker Collector Response Checks appear in its Containers tab and Container pages.
_Avoid_: Liveness Check

**Liveness Check**:
A Docker Collector check that is healthy while the container is running, without asking the workload to answer. It appears only in its Server's Containers tab and Container pages.
_Avoid_: Uptime, Response Check

**Observed Service**:
The stored form of a workload that can be explored on its own (health, logs, API data, metrics): an app created for a Direct Telemetry Connection, shown as **앱**, or a Container a Docker Collector discovered, shown as **컨테이너**. Product copy never calls either a service.
_Avoid_: Group, Service (in product copy)

**Direct Telemetry Connection**:
An OTLP ingestion connection bound to one app. Its credential authorizes an explicit set of Logs, Metrics, and Traces signals and does not install a Docker Collector. The app it creates belongs to a Server.
_Avoid_: Docker Environment, Docker Collector, Independent Collector

**Infrastructure Resource**:
A host or other operational resource whose capacity and availability are monitored. It can be backed by a Docker Collector or by a directly configured standard OpenTelemetry Collector, and belongs to a Server: the direct one at most one per Server, the Docker-backed one to its Docker Collector's Server. Either inherits that Server's Group. A Server keeps one Host Metrics Source.
_Avoid_: Docker Environment

**Connect**:
Making data flow into EveryUp from outside: Logs, API Requests, Metrics, or Infrastructure. Shown as **연결**; the start button and the dialog title are `{target} 연결`. A Docker Collector is installed, not connected: **Docker Collector 설치** is running the first command on a host (**설치**), and applying is re-running it after the Docker Collection Profile changed (**적용**).
_Avoid_: Add, Register, Docker 연결

**Add**:
Creating something that only exists in EveryUp's own settings: a Server, an Uptime Monitor, an alert rule, a Group. Shown as **추가**.
_Avoid_: Connect

**API Requests**:
The connection unit for an app's or Container's OpenTelemetry traces. Connecting API Requests also fills the Traces tab, so Traces is only a tab name. Shown as **API 요청**.
_Avoid_: bare API, API traces

**Container Status**:
The Docker Collection Profile capability stored as `uptime`: Liveness Checks and Docker Collector Response Checks. Shown as **컨테이너 상태**, never as uptime (see Liveness Check).
_Avoid_: Uptime (for this capability)

**Group**:
An optional folder of Servers. A Server's targets, its Containers and its Docker Collector's data included, inherit the Server's Group; moving the Server moves them. Shown as **그룹** in the UI; code, API paths, and storage keep the `project` identifier.
_Avoid_: Project (in product copy), Docker Environment, Docker Project, server

**Docker Environment** (retired, ADR 0012):
The former separate unit for a Docker host. Each one is now the Server with the same id; its old addresses (`/environments`, `/agents/:id`, `/services/:agentId/:key`) redirect to the Server list, the Server, and the Container page. Not used in product copy.
_Avoid_: Docker Environment (in product copy)
