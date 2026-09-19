package handlers

import (
	"os/exec"
	"strings"
	"testing"
)

func TestOTelCLIPlanSelectionAndRollback(t *testing.T) {
	harness := `set -eu
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin" "$work/app"
export CALLS="$work/calls"
export PATH="$work/bin:$PATH"
cat > "$work/helper" <<'EVERYUP_CLI'
` + agentOTelCLIScript + `
EVERYUP_CLI
cat > "$work/bin/id" <<'ID'
#!/bin/sh
echo 0
ID
cat > "$work/bin/docker" <<'DOCKER'
#!/bin/sh
printf '%s\n' "$*" >> "$CALLS"
for last do :; done
case "$*" in
 *'config --services'*) printf 'app\nother\n' ;;
 *'ps -q'*) echo "$last" ;;
 *'State.Running'*) echo true ;;
 *'State.Health'*) echo none ;;
 *'Config.Labels'*) echo demo ;;
 *'Config.Env'*)
   echo EVERYUP_WEB_BASE_URL=https://monitor.example.com
   echo EVERYUP_AGENT_API_KEY=test-local-only
   echo "OTEL_SERVICE_NAME=$last"
   echo OTEL_EXPORTER_OTLP_ENDPOINT=http://everyup-agent:4318
   echo OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
   echo EVERYUP_CAPTURE_BODIES=false
   if [ "${FAIL_VERIFY:-}" != true ]; then echo 'NODE_OPTIONS=--require /everyup/node/register.js'; fi ;;
 *'.Mounts'*) echo /everyup ;;
 *'NetworkSettings.Networks'*) echo everyup-monitoring ;;
 *'up -d'*) if [ "${FAIL_UP:-}" = true ]; then exit 1; fi ;;
esac
DOCKER
cat > "$work/bin/curl" <<'CURL'
#!/bin/sh
printf 'report %s\n' "$*" >> "$CALLS"
CURL
chmod +x "$work/bin/"*
printf 'services:\n  app:\n    image: test\n' > "$work/app/compose.yml"
sh "$work/helper" plan "$work/app/compose.yml" --project=demo app=node > "$work/plan"
grep -F 'Restart: app=node' "$work/plan"
test ! -e "$work/app/docker-compose.everyup.yml"
test ! -e "$work/app/.everyup"
if grep -E 'up -d|network create|volume create|^run ' "$CALLS"; then exit 1; fi

sh "$work/helper" apply "$work/app/compose.yml" --project=demo other=node
: > "$CALLS"
sh "$work/helper" apply "$work/app/compose.yml" --project=demo --report=agent_test/run app=node
grep -F "  'other':" "$work/app/docker-compose.everyup.yml"
grep -F "  'app':" "$work/app/docker-compose.everyup.yml"
grep 'up -d.* app$' "$CALLS"
if grep 'up -d.* other' "$CALLS"; then exit 1; fi
grep -F '"status":"verified"' "$CALLS"
test ! -d "$work/app/.everyup-otel.lock"

sh "$work/helper" rollback "$work/app/compose.yml"
grep -F '"status":"rolled_back"' "$CALLS"
if grep -F "  'app':" "$work/app/docker-compose.everyup.yml"; then exit 1; fi
grep -F "  'other':" "$work/app/docker-compose.everyup.yml"

: > "$CALLS"
if FAIL_VERIFY=true sh "$work/helper" apply "$work/app/compose.yml" --project=demo --report=agent_test/run2 app=node; then exit 1; fi
grep -F '"status":"rolled_back","reason":"verification_failed"' "$CALLS"
if grep -F '"status":"verified"' "$CALLS"; then exit 1; fi
test ! -d "$work/app/.everyup-otel.lock"

: > "$CALLS"
if FAIL_UP=true sh "$work/helper" apply "$work/app/compose.yml" --project=demo --report=agent_test/run3 app=node; then exit 1; fi
grep -F '"status":"rollback_failed","reason":"restart_failed"' "$CALLS"
`
	var shell []string
	if sh, err := exec.LookPath("sh"); err == nil {
		shell = []string{sh}
	} else if wsl, err := exec.LookPath("wsl.exe"); err == nil {
		shell = []string{wsl, "sh"}
	} else {
		t.Skip("POSIX shell unavailable")
	}

	// The installer under test refuses to run anywhere but Linux. A Git Bash or
	// MSYS shell reaches that guard and dies there, which reports a failure
	// about the host rather than about anything this test asserts.
	probe := exec.Command(shell[0], append(append([]string{}, shell[1:]...), "-c", "uname -s")...)
	kernel, err := probe.Output()
	if err != nil || strings.TrimSpace(string(kernel)) != "Linux" {
		t.Skipf("Linux shell required; this one reports %q", strings.TrimSpace(string(kernel)))
	}

	cmd := exec.Command(shell[0], append(append([]string{}, shell[1:]...), "-s")...)
	cmd.Stdin = strings.NewReader(harness)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("CLI execution: %v\n%s", err, out)
	}
}
