package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/url"
	"strconv"
	"strings"
	"time"

	appcrypto "github.com/aiturn/everyup/internal/crypto"
	"github.com/aiturn/everyup/internal/models"
	"github.com/gofiber/fiber/v2"
)

const agentJoinCodeTTL = 10 * time.Minute

func newAgentJoinCode(now time.Time) (plain, hash string, expiresAt time.Time, err error) {
	b := make([]byte, 16)
	if _, err = rand.Read(b); err != nil {
		return "", "", time.Time{}, err
	}
	plain = "evup_join_" + hex.EncodeToString(b)
	hash = hashAgentKey(plain)
	expiresAt = now.Add(agentJoinCodeTTL)
	return plain, hash, expiresAt, nil
}

// IssueJoinCode replaces any unused installer code for an existing project.
func (h *AgentHandler) IssueJoinCode(c *fiber.Ctx) error {
	plain, hash, expiresAt, err := newAgentJoinCode(time.Now())
	if err != nil {
		return internalError(c, "KEY_GENERATION_ERROR", err)
	}
	if err := h.repo.IssueJoinCode(c.Params("agentId"), hash, expiresAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"success": false,
				"error":   fiber.Map{"code": ErrCodeNotFound, "message": "Docker environment not found"},
			})
		}
		return internalError(c, ErrCodeDatabase, err)
	}
	return c.JSON(fiber.Map{"success": true, "data": fiber.Map{
		"joinCode":  plain,
		"expiresAt": expiresAt,
	}})
}

// InstallScript serves the secret-free bootstrapper. The one-time code is
// supplied as an argument and exchanged only after local prerequisites pass.
func (h *AgentHandler) InstallScript(c *fiber.Ctx) error {
	c.Set(fiber.HeaderContentType, "text/x-shellscript; charset=utf-8")
	c.Set(fiber.HeaderCacheControl, "public, max-age=300")
	return c.SendString(agentInstallerScript)
}

// Join exchanges a valid one-time code for a generated Compose bundle. The
// response is deliberately not JSON so the installer can save it without jq.
func (h *AgentHandler) Join(c *fiber.Ctx) error {
	baseURL, err := normalizeAgentBaseURL(c.FormValue("baseUrl"))
	if err != nil {
		return agentBadRequest(c, "INVALID_BASE_URL", err.Error())
	}
	joinCode := extractBearerToken(c)
	if !strings.HasPrefix(joinCode, "evup_join_") || len(joinCode) != len("evup_join_")+32 {
		return invalidJoinCode(c)
	}

	credential, err := h.repo.ConsumeJoinCode(hashAgentKey(joinCode), time.Now())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return invalidJoinCode(c)
		}
		return internalError(c, ErrCodeDatabase, err)
	}
	if credential.KeyEnc == "" {
		return internalError(c, ErrCodeSecret, errors.New("Docker collector API key is unavailable"))
	}
	apiKey, err := appcrypto.Decrypt(credential.KeyEnc)
	if err != nil {
		return internalError(c, ErrCodeSecret, err)
	}

	c.Set(fiber.HeaderContentType, "application/yaml; charset=utf-8")
	c.Set(fiber.HeaderCacheControl, "no-store")
	return c.SendString(buildAgentCompose(baseURL, credential.AgentName, apiKey, credential.Profile))
}

func invalidJoinCode(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"success": false,
		"error": fiber.Map{
			"code":    "INVALID_JOIN_CODE",
			"message": "join code is invalid, expired, or already used",
		},
	})
}

func normalizeAgentBaseURL(value string) (string, error) {
	value = strings.TrimRight(strings.TrimSpace(value), "/")
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("baseUrl must be an absolute http or https URL")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("baseUrl must not include credentials, a query, or a fragment")
	}
	return value, nil
}

func buildAgentCompose(baseURL, agentName, apiKey string, profile models.AgentProfile) string {
	if profile.Kind == "" {
		profile = models.DefaultAgentProfile()
	}
	quote := strconv.Quote
	docker := profile.Has(models.AgentCapabilityUptime)
	hostfs := profile.Has(models.AgentCapabilityInfrastructure) || profile.Has(models.AgentCapabilityAPI)
	gateway := profile.Has(models.AgentCapabilityAPI) || profile.Has(models.AgentCapabilityMetrics)
	automaticTracing := profile.Has(models.AgentCapabilityAPI)

	var compose strings.Builder
	compose.WriteString(`services:
  everyup-agent:
    image: aiturn/everyup-agent:latest
    container_name: everyup-agent
`)
	if docker {
		compose.WriteString(`    group_add:
      - "${EVERYUP_DOCKER_GID:-0}"
`)
	}
	compose.WriteString(`
    networks:
      everyup-monitoring: {}
    environment:
      EVERYUP_AGENT_NAME: ` + quote(agentName) + `
      EVERYUP_WEB_SYNC_ENABLED: "true"
      EVERYUP_WEB_BASE_URL: ` + quote(baseURL) + `
      EVERYUP_AGENT_API_KEY: ` + quote(apiKey) + `
      EVERYUP_CONFIG_HASH: ` + quote(profile.ConfigHash()) + `
      EVERYUP_EXCLUDE: "everyup-ebpf"
      EVERYUP_DOCKER_DISCOVERY_ENABLED: "` + strconv.FormatBool(docker) + `"
      EVERYUP_DOCKER_LOGS_ENABLED: "` + strconv.FormatBool(profile.Has(models.AgentCapabilityLogs)) + `"
      EVERYUP_HOST_METRICS_ENABLED: "` + strconv.FormatBool(profile.Has(models.AgentCapabilityInfrastructure)) + `"
      EVERYUP_TELEMETRY_GATEWAY_ENABLED: "` + strconv.FormatBool(gateway) + `"
      EVERYUP_EBPF_CONTEXT_PROPAGATION_ENABLED: "false"
    volumes:
`)
	if docker {
		compose.WriteString(`      - /var/run/docker.sock:/var/run/docker.sock:ro
`)
	}
	if hostfs {
		compose.WriteString(`      - /:/hostfs:ro
`)
	}
	compose.WriteString(`      - everyup-agent-data:/data
    restart: unless-stopped
`)

	if automaticTracing {
		compose.WriteString(`
  everyup-ebpf:
    image: otel/ebpf-instrument:v0.7.1
    container_name: everyup-ebpf
    restart: "on-failure:5"
    privileged: true
    pid: "host"
    networks:
      everyup-monitoring: {}
    depends_on:
      everyup-agent:
        condition: service_started
    configs:
      - source: everyup-obi-config
        target: /etc/obi/config.yml
        mode: 0444
    environment:
      OTEL_EBPF_CONFIG_PATH: "/etc/obi/config.yml"
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://everyup-agent:4318/v1/traces"
      OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "http/protobuf"
      OTEL_RESOURCE_ATTRIBUTES: "everyup.source=ebpf"

`)
	}

	compose.WriteString(`volumes:
  everyup-agent-data:
    driver: local

networks:
  everyup-monitoring:
    name: everyup-monitoring
`)
	if automaticTracing {
		compose.WriteString(`
configs:
  everyup-obi-config:
    content: |
      discovery:
        instrument:
          - exe_path: "*"
            containers_only: true
        exclude_instrument:
          - exe_path: "*everyup-agent*"
        exclude_otel_instrumented_services: true
`)
	}
	return compose.String()
}

const agentInstallerScript = `#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: install.sh <everyup-base-url> <join-code>" >&2
  exit 2
fi

base_url=${1%/}
join_code=$2
install_dir=/opt/everyup-agent
compose_file=$install_dir/compose.yaml
env_file=$install_dir/.env
otel_tmp=

if [ "$(uname -s)" != "Linux" ]; then
  echo "EveryUp Docker collector installation currently requires Linux." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine first." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker Engine is not reachable." >&2
  exit 1
fi
if ! compose_version=$(docker compose version --short 2>/dev/null); then
  echo "Docker Compose v2.23.1 or newer is required." >&2
  exit 1
fi

compose_version=${compose_version#v}
major=$(printf '%s' "$compose_version" | cut -d. -f1)
minor=$(printf '%s' "$compose_version" | cut -d. -f2)
patch=$(printf '%s' "$compose_version" | cut -d. -f3 | cut -d- -f1)
case "$major" in ''|*[!0-9]*) echo "Could not parse Docker Compose version: $compose_version" >&2; exit 1 ;; esac
case "$minor" in ''|*[!0-9]*) echo "Could not parse Docker Compose version: $compose_version" >&2; exit 1 ;; esac
case "$patch" in ''|*[!0-9]*) echo "Could not parse Docker Compose version: $compose_version" >&2; exit 1 ;; esac
if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 23 ]; } || { [ "$major" -eq 2 ] && [ "$minor" -eq 23 ] && [ "$patch" -lt 1 ]; }; then
  echo "Docker Compose v2.23.1 or newer is required (found $compose_version)." >&2
  exit 1
fi
if [ ! -r /var/run/docker.sock ]; then
  echo "/var/run/docker.sock is not readable." >&2
  exit 1
fi

docker_gid=$(stat -c '%g' /var/run/docker.sock)
mkdir -p "$install_dir"
umask 077
tmp_file=$(mktemp "${TMPDIR:-/tmp}/everyup-compose.XXXXXX")
cleanup() {
  if [ -n "${tmp_file:-}" ]; then rm -f "$tmp_file"; fi
  if [ -n "${otel_tmp:-}" ]; then rm -f "$otel_tmp"; fi
}
trap cleanup EXIT INT TERM

echo "Exchanging the one-time EveryUp join code..."
curl -fsS --retry 2 \
  -X POST \
  -H "Authorization: Bearer $join_code" \
  --data-urlencode "baseUrl=$base_url" \
  "$base_url/api/v1/agents/join" \
  -o "$tmp_file"

EVERYUP_DOCKER_GID="$docker_gid" docker compose -f "$tmp_file" config --quiet
if [ -f "$compose_file" ]; then
  backup_file="$compose_file.bak.$(date +%Y%m%d%H%M%S)"
  cp -p "$compose_file" "$backup_file"
  echo "Previous configuration backed up to $backup_file"
fi
mv "$tmp_file" "$compose_file"
tmp_file=
chmod 600 "$compose_file"
printf 'EVERYUP_DOCKER_GID=%s\n' "$docker_gid" > "$env_file"
chmod 600 "$env_file"

if ! docker compose --env-file "$env_file" -f "$compose_file" pull; then
  echo "Image pull did not fully complete; cached images will be tried." >&2
fi
if ! docker compose --env-file "$env_file" -f "$compose_file" up -d; then
  echo "Configuration was saved. Retry with:" >&2
  echo "  docker compose --env-file $env_file -f $compose_file up -d" >&2
  exit 1
fi

otel_tmp=$(mktemp "${TMPDIR:-/tmp}/everyup-otel.XXXXXX")
if curl -fsS "$base_url/api/v1/agents/otel.sh" -o "$otel_tmp" && install -m 0755 "$otel_tmp" /usr/local/bin/everyup-otel; then
  echo "Installed advanced instrumentation CLI: /usr/local/bin/everyup-otel"
else
  echo "Could not install the optional everyup-otel CLI; it can be downloaded later from Web." >&2
fi
rm -f "$otel_tmp"
otel_tmp=

echo "EveryUp Docker collector installation complete."
echo "Configuration: $compose_file"
echo "Check status: docker compose --env-file $env_file -f $compose_file ps"
`
