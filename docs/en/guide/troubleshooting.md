# Troubleshooting

## The Docker environment does not show as online

`EVERYUP_WEB_BASE_URL` must be a Web address reachable from inside the Docker
Collector container. Even on the same server, `localhost` inside the container
may point to the Collector itself, not Web. Use a Compose service name or a
host-reachable IP.

## The Docker Collector cannot read the Docker socket

This is a permission issue. The one-line installer detects the Docker socket
group ID and writes `EVERYUP_DOCKER_GID` automatically. For a manual deployment,
set that value to `stat -c '%g' /var/run/docker.sock` and add it through
`group_add`; use `user: "0:0"` only as a short-lived diagnostic fallback. To
narrow socket access in production, use the
[Docker socket proxy guide](https://github.com/ai-turn/everyup/blob/main/agent/docs/docker-socket-proxy.md).

## Logs are not showing up

Logs written only to a file inside the container are not visible to Docker, so
the Docker Collector cannot collect them. Write app or proxy logs to stdout/stderr.

## Backups for production deployments

Back up `/app/data`. If you set `EVERYUP_ENCRYPTION_KEY`, keep that same
64-char hex key with your deployment secrets. A database backup alone cannot
restore encrypted Docker Collector API Keys or notification secrets without the key.
See the [backup and restore guide](./backup-restore) for details.
