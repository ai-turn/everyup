# Uptime monitors

An uptime monitor has Web itself check, on a schedule, that a URL or TCP port responds. Use it for
targets where you can't or don't need to install a Collector, such as public websites and APIs.
Docker containers are discovered by the [Docker Collector](./quickstart), so you don't add them here.

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
services with the [Docker Collector](./quickstart) instead.
:::

## Status and management

The **업타임** (Uptime) screen lists Docker services and uptime monitors together, with counts for
**정상** (healthy), **장애** (down), and **일시정지·대기** (paused or pending) at the top. Use
**일시정지** (Pause) on a monitor card to stop checking and **재개** (Resume) to start again. Click a
card to open its detail screen, where you can see the check history (result, time, response time,
message) and **수정** (Edit) or **삭제** (Delete) the monitor.

## Getting outage alerts

An uptime monitor that goes down sends nothing unless an [alert rule](./notifications#rules)
matches it. A rule with the **헬스체크** (Health check) category and an empty **대상** (Target)
applies to every uptime monitor and Docker service.
