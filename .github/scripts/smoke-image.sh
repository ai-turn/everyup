#!/usr/bin/env bash
set -euo pipefail

kind=${1:?image kind is required}
image=${2:?image reference is required}
name="everyup-smoke-${kind}-${RANDOM}"
cleanup() {
  docker logs "$name" 2>&1 || true
  docker rm -fv "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

case "$kind" in
  web)
    docker run -d --name "$name" -p 127.0.0.1::3001 "$image"
    port=$(docker port "$name" 3001/tcp | head -1 | cut -d: -f2)
    curl -fsS --retry 30 --retry-all-errors --retry-delay 1 --retry-max-time 60 --max-time 2 "http://127.0.0.1:$port/api/v1/health"
    curl -fsS "http://127.0.0.1:$port/" | grep -q '<div id="root">'
    ;;
  agent)
    docker run -d --name "$name" -p 127.0.0.1::4318 \
      -e EVERYUP_DOCKER_DISCOVERY_ENABLED=false -e EVERYUP_DOCKER_LOGS_ENABLED=false \
      -e EVERYUP_HOST_METRICS_ENABLED=false \
      -e EVERYUP_WEB_BASE_URL=http://127.0.0.1:9 -e EVERYUP_AGENT_API_KEY=smoke "$image"
    port=$(docker port "$name" 4318/tcp | head -1 | cut -d: -f2)
    curl -fsS --retry 30 --retry-all-errors --retry-delay 1 --retry-max-time 60 --max-time 2 "http://127.0.0.1:$port/health"
    docker exec "$name" sh -c 'test -s /opt/everyup/instrumentation/java/opentelemetry-javaagent.jar && test -s /opt/everyup/instrumentation/node/register.js && test -d /opt/everyup/instrumentation/node/node_modules'
    ;;
  *) echo "Unknown image kind: $kind" >&2; exit 1 ;;
esac
