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
| **기대 상태 코드** (Expected status code) | An HTTP response passes when its code matches this value. Default 200 |
| **타임아웃 (초)** (Timeout, seconds) | A check fails if there is no response in this time. Default 5 seconds |

An HTTP check passes when its response code matches the configured expected status code; a TCP check passes when the connection succeeds.

::: warning Internal addresses can't be checked
For security, `localhost`, private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and
link-local addresses (`169.254.0.0/16`, including cloud metadata) are rejected. Monitor internal
services with the [Docker Collector](./quickstart#docker) instead.
:::

## Status and management

The **업타임** (Uptime) screen shows only the uptime monitors you add there. Each target shows its
HTTP or TCP method and check address. View Docker Collector response checks and container state in
**Docker 환경** (Docker environments).

Counts for **장애** (down), **정상** (healthy), **확인 대기** (pending), and **일시정지** (paused) appear
at the top. Click a count to filter by that state. Compare monitor names, check addresses, 24-hour
uptime, and average response times in the list.

The list and detail screens refresh automatically every **30 seconds** by default. Check the last
successful refresh time, turn automatic refresh off, or click **새로고침** (Refresh) to refresh manually.
Automatic requests pause in hidden browser tabs and resume with a refresh when the tab becomes visible.
If a refresh fails, the screen keeps previously loaded data and labels it as prior information.

Both the grid and cards show **최근 체크** (Recent checks): up to 10 check results and the latest outcome.
Hover over the check strip, or focus it and use the arrow keys, to inspect an exact timestamp and
the full message. An ongoing outage shows its duration below the status; hover over or focus the
duration to inspect its start time. Click the target name for response trends and 90-day history.

Use **일시정지** (Pause) to stop checks and **재개** (Resume) to restart them. Use **수정** (Edit) or
**삭제** (Delete) on the detail screen to manage the monitor.

The detail screen's **응답 시간** (Response time) chart defaults to the last **6 hours**. Select
**1H**, **6H**, or **24H** for averages in 2-, 5-, or 20-minute buckets. Response times average
successful checks only. The summary shows the selected period's average, total checks, and failed checks.

Hover over the chart, or focus it and use the left and right arrow keys, to inspect a bucket's
average and check/failure counts. Confirmed outages have a shaded background. Missing collection
data breaks the line and the tooltip shows **수집 데이터 없음** (No collection data). Missing data
is not represented as an outage or a 0ms response.

## Getting outage alerts

An uptime monitor that goes down sends nothing unless an [alert rule](./notifications#rules)
matches it. A rule with the **헬스체크** (Health check) category and an empty **대상** (Target)
applies to every uptime monitor and Docker service.
