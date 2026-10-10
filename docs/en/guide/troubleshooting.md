# Troubleshooting

Each entry follows **symptom → check → fix**, and every command says which server it runs on.
To start the installation over from scratch, see [Upgrade and uninstall](./upgrade-uninstall#reinstall).

## The dashboard does not open {#web-not-reachable}

**Symptom**: `http://<dashboard server IP>:3001` does not load in the browser, or shows an error.

**Check** (on the dashboard server, in the `everyup` directory):

```bash
docker compose ps                # STATUS should be healthy
docker logs everyup --tail 100   # look for startup errors
curl -fsS http://localhost:3001/api/v1/health
```

**Fix**:

- If `curl` succeeds but the browser does not, open port `3001` in the firewall or security group.
- If the container keeps restarting, read the first error in the logs. A wrong environment
  variable value is the usual cause; see [Web configuration](../reference/web).

## The installer stops on the Compose version {#compose-version}

**Symptom**: the install command ends with `Docker Compose v2.23.1 or newer is required`.

**Check** (on the monitored server):

```bash
docker compose version
```

**Fix**: update the Docker Compose plugin to 2.23.1 or newer. If Docker came from your package
manager, updating the `docker-compose-plugin` package usually does it. The standalone
`docker-compose` (v1) is not supported.

## The installer cannot reach Docker {#docker-access}

**Symptom**: the install command ends with `Docker Engine is not reachable.` or
`/var/run/docker.sock is not readable.`

**Check** (on the monitored server):

```bash
sudo docker info --format '{{.ServerVersion}}'
ls -l /var/run/docker.sock
```

**Fix**:

- Run the install command with `sudo sh`. Make sure you copied the command exactly as Web showed it.
- If `docker info` fails, the Docker daemon is not running. Start it with `sudo systemctl start docker`.

## Installation fails with a connection code error {#join-code}

**Symptom**: `Exchanging the one-time EveryUp join code...` is followed by
`curl: (22) The requested URL returned error: 401`.

**Fix**: a connection code works once, within 10 minutes of being issued. Click **새 코드** (new
code) on the install screen to generate a new command and run it. Re-running the old command
gives the same error.

## The monitored server cannot reach Web {#web-unreachable-from-target}

**Symptom**: the install command ends with `curl: (7) Failed to connect` or `curl: (28) … timed out`.

**Check** (on the monitored server, with the Web address from the install command):

```bash
curl -fsS https://<Web address>/api/v1/health
```

**Fix**:

- If it cannot connect, open port `3001` (or your reverse proxy port) in the dashboard server's
  firewall or security group.
- If the address in the command is `localhost` or internal-only, restart Web with
  [`EVERYUP_PUBLIC_URL`](./quickstart#public-url) and generate a new install command.

## The Docker environment never reaches 수집 중 (collecting) {#not-collecting}

**Symptom**: installation finished, but the environment stays at **설치 대기** (waiting for
install) on the **Docker 환경** screen.

**Check** (on the monitored server):

```bash
sudo docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml ps
sudo docker logs everyup-agent --tail 50
sudo grep EVERYUP_WEB_BASE_URL /opt/everyup-agent/compose.yaml
```

**Fix**: the Collector connects to Web through `EVERYUP_WEB_BASE_URL`, so the address must be
reachable from inside the Collector container. Even on the same server, `localhost` inside the
container points to the Collector itself, not Web. Change it to a Compose service name or a
host-reachable IP, then restart:

```bash
sudo docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml up -d
```

## The Docker Collector cannot read the Docker socket {#docker-socket}

**Symptom**: the `everyup-agent` logs show `query docker socket … permission denied` and no
services appear.

**Fix**: the one-line installer detects the Docker socket group ID and writes
`EVERYUP_DOCKER_GID` automatically. For a manual deployment, set that value to
`stat -c '%g' /var/run/docker.sock` and add it through `group_add`. Use `user: "0:0"` only as a
short-lived diagnostic fallback. To narrow socket access in production, use the
[Docker socket proxy guide](https://github.com/ai-turn/everyup/blob/main/agent/docs/docker-socket-proxy.md).

## Logs are not showing up {#no-logs}

**Symptom**: the service appears, but its **로그** (Logs) tab is empty.

**Check** (on the monitored server):

```bash
docker logs <app container> --tail 20
```

**Fix**: if this prints nothing either, the app writes logs only to a file inside the container.
Logs Docker cannot see are invisible to the Docker Collector too. Write app or proxy logs to
stdout/stderr.
