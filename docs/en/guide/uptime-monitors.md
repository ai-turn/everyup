# Uptime monitors

Use uptime monitors to check responses from public URLs and TCP ports on a schedule. Web performs
the checks, so the target does not need a Collector. Docker service response checks come from the
[Docker Collector](./quickstart#docker) and appear in that **Docker 환경** (Docker environment); you do not need
to add them again as uptime monitors.

## Add a monitor

On the **업타임** (Uptime) screen, click **추가** (Add), fill in the fields below, and click **추가** (Add).

| Field | Description |
| --- | --- |
| **이름** (Name) | Shown on screen and in alerts |
| **체크 방식** (Check type) | **HTTP** or **TCP**. It cannot be changed later |
| **URL** | For HTTP, the full address to check (e.g. `https://api.example.com/health`) |
| **호스트** (Host), **포트** (Port) | For TCP, the host and port to connect to (default 443) |
| **주기 (초)** (Interval, seconds) | How often to check. Default 30, minimum 5 |
| **타임아웃 (ms)** (Timeout, ms) | A check fails if there is no response in this time. Default 5000 |

An HTTP check passes on a 2xx response; a TCP check passes when the connection succeeds.

::: warning Internal addresses can't be checked
For security, `localhost`, private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and
link-local addresses (`169.254.0.0/16`, including cloud metadata) are rejected. Monitor internal
services with the [Docker Collector](./quickstart#docker) instead.
:::

## Status and management

The **업타임** (Uptime) screen shows only the uptime monitors you add there. Each target shows its
HTTP or TCP method and check address. View Docker Collector response checks and container state in
**Docker 환경** (Docker environments).

Counts for **정상** (healthy), **장애** (down), and **정지·대기** (paused or pending) appear at the top.
Use **일시정지** (Pause) to stop checks and **재개** (Resume) to restart them. Open a target to inspect
its check history (result, time, response time, message), and use **수정** (Edit) or **삭제** (Delete)
on its detail screen.

## Getting outage alerts

An uptime monitor that goes down sends nothing unless an [alert rule](./notifications#rules)
matches it. A rule with the **헬스체크** (Health check) category and an empty **대상** (Target)
applies to every uptime monitor and Docker service.
