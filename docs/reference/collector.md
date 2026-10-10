---
outline: [2, 3]
pageClass: reference-page
---

# Docker Collector 설정

EveryUp Docker Collector는 모니터링할 Docker 호스트에서 실행되는 가벼운 구성 요소입니다.
Docker 컨테이너를 자동으로 발견하고, stdout/stderr 로그를 읽고, 호스트 메트릭을 수집해
EveryUp Web으로 동기화합니다. API 상태코드는 이미 수집한 로그에서 access log 줄을 파싱해
만들기 때문에 프록시나 앱 수정이 필요 없습니다.

알림 규칙, 알림 채널, 대시보드 동작은 Web에서 설정합니다. Docker Collector는 데이터를
수집하고 전달하기만 합니다. 바이너리, 환경변수, 저장 경로, 호환 API에는 내부 이름인
`agent`가 그대로 남아 있습니다.

설치 방법은 [Quick Start](../guide/quickstart)를 참고하세요.

## 로그와 API 요청

Docker Collector는 Docker stdout/stderr를 읽어 Web에 로그로 저장합니다. Collector가 볼 수
있는 로그는 다음 명령으로 확인할 수 있습니다.

```bash
docker logs <container-name> --tail 100
```

새 컨테이너를 처음 읽을 때는 `EVERYUP_DOCKER_LOGS_TAIL_LINES`(기본 100)만큼만 과거 로그를
가져옵니다. 커서가 생긴 뒤에는 남은 줄을 제한 없이 모두 읽습니다. 커서는 replica마다 따로
저장됩니다. 수집한 로그는 크기가 제한된 배치 단위로 전송하고, Web으로 보내는 로그 요청은 Web의 요청
크기 제한보다 작게 나눕니다. 로그 본문은 UTF-8이 깨지지 않는 선에서 앞쪽 약 8 KiB만
보관합니다. 재시작과 보존 동작은
[local state](https://github.com/ai-turn/everyup/blob/main/agent/docs/local-state.md)를
참고하세요.

API 상태코드는 같은 로그에서 추출합니다. access log(Nginx / Apache / 구조화 JSON)로 파싱되는
줄은 합성 OTel SERVER span이 되고, Web이 이를 **API 요청** 탭에 표시합니다. access log에는
latency가 없으므로 duration은 알 수 없습니다. access log를 남기지 않는 앱은 API 요청 탭에 요청이
표시되지 않을 뿐, 로그와 메트릭은 계속 수집됩니다.

앱을 건드리지 않고 실제 latency를 보려면 모니터링 번들에 포함된
[자동 eBPF Observer](../guide/ebpf-observer)를 사용하세요. 요청/응답 **헤더·바디**가
필요하면 앱을 OpenTelemetry로 계측해 Docker Collector의 OTLP 게이트웨이
(`http://everyup-agent:4318`)로 보내세요. 자세한 내용은
[헤더·바디 상세 수집](../guide/otel-instrumentation)에 있습니다.

로그를 컨테이너 안의 파일에만 쓰면 Docker가 보여줄 수 없으므로 Compose 전용 모드의 Docker
Collector도 수집할 수 없습니다. 앱이나 리버스 프록시가 로그를 stdout으로 쓰도록 설정하세요.

## 네트워킹 {#networking}

Docker Collector는 마운트된 Docker 소켓으로 컨테이너를 발견합니다. 앱과 같은 Compose
파일에서 실행해도 되고, 같은 Docker 호스트의 별도 Compose 프로젝트에서 실행해도 됩니다.
권장하는 구성은 `everyup-agent`를 그 서버의 앱 스택과 같은 Compose 파일에 두는 것입니다.

Docker 탐지가 켜져 있으면 OTLP 게이트웨이는 자신이 발견한 실행 중인 컨테이너의 데이터만
받습니다. SDK가 다른 `service.name`을 보내더라도 각 앱 데이터에는 출발 컨테이너의 서비스
이름을 붙입니다. eBPF 표시가 붙은 트레이스는 `everyup-ebpf` 컨테이너만 보낼 수 있습니다.

Docker 탐지가 없는 프로필(예: 메트릭 전용)에서는 모든 OTLP 요청에 서비스별 bearer 토큰이
필요합니다. Docker 호스트에서 앱마다 토큰을 발급하세요. 마지막 인자에는 그 앱의 서비스 이름(예:
`checkout`)을 넣습니다.

```bash
sudo docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml \
  exec -T everyup-agent everyup-agent gateway-token <서비스 이름>
```

해당 앱의 OTLP exporter가 `http://everyup-agent:4318`로
`Authorization: Bearer <발급한 토큰>`을 보내도록 설정합니다. OTLP/HTTP를 쓰는
OpenTelemetry SDK라면 다음과 같이 지정합니다.

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://everyup-agent:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20<generated-token>
```

게이트웨이는 데이터에 담긴 이름과 상관없이 토큰에서 `service.name`을 정합니다. 토큰은 해당
앱의 자격증명과 함께 보관하고, 서비스마다 다른 토큰을 발급하세요. Collector API Key를
교체하면 모든 서비스 토큰이 무효가 됩니다.

## Compose 환경변수

**필수**로 표시한 세 개만 지정하면 되고, 나머지는 기본값으로 동작합니다.

### Web 연결 (connected mode)

- **`EVERYUP_WEB_SYNC_ENABLED`** · **필수** · 기본값 `false`\
  Web 등록과 동기화를 켭니다
- **`EVERYUP_WEB_BASE_URL`** · **필수**\
  Docker 호스트에서 접근 가능한 EveryUp Web 주소
- **`EVERYUP_AGENT_API_KEY`** · **필수**\
  Docker 환경의 API Key. Web에서 해당 Docker 환경을 열고 **API Key**를 누르면 확인하거나 재발급할 수 있습니다 (이전 이름: `EVERYUP_WEB_ENROLLMENT_TOKEN`)
- **`EVERYUP_WEB_AGENT_ID`**\
  Web 쪽 agent id. 등록할 때 자동으로 설정됩니다
- **`EVERYUP_WEB_SYNC_INTERVAL_SECONDS`** · 기본값 `30`\
  서비스·이벤트·호스트 메트릭을 Web에 동기화하는 주기(초)
- **`EVERYUP_WEB_OTLP_ENDPOINT`**\
  텔레메트리 전송에 안내할 OTLP endpoint

### 일반

- **`TZ`** · 기본값 `UTC`\
  Collector 자체 로그의 시간대(예: `Asia/Seoul`). 동기화되는 데이터에는 항상 시간대 정보가 포함됩니다
- **`EVERYUP_AGENT_NAME`** · 기본값 `everyup-agent`\
  Docker 환경 이름
- **`EVERYUP_SERVICE_NAME`** · 기본값 `local-service`\
  Collector 자체 점검에 쓰는 기본 서비스 이름
- **`EVERYUP_DATA_DIR`** · 기본값 `/data`\
  Collector 상태(`agent-state.json`, `audit.jsonl`) 저장 위치
- **`EVERYUP_CHECK_INTERVAL_SECONDS`** · 기본값 `30`\
  health check 주기(초)
- **`EVERYUP_HTTP_TIMEOUT_SECONDS`** · 기본값 `5`\
  HTTP 요청 timeout(초)
- **`EVERYUP_ALERT_COOLDOWN_SECONDS`** · 기본값 `300`\
  같은 대상에 대한 반복 알림 사이의 최소 간격(초)
- **`EVERYUP_HEALTH_URL`**\
  health check할 절대 URL(단일 대상 모드. 보통은 Docker 탐지를 사용합니다)

### Docker 탐지와 로그

- **`EVERYUP_DOCKER_DISCOVERY_ENABLED`** · 기본값 `true`\
  Docker 컨테이너 자동 발견
- **`EVERYUP_DOCKER_SOCKET_PATH`** · 기본값 `/var/run/docker.sock`\
  컨테이너 안의 Docker 소켓 경로
- **`EVERYUP_DOCKER_LOGS_ENABLED`** · 기본값 `true`\
  컨테이너 stdout/stderr 로그를 Web으로 전달
- **`EVERYUP_DOCKER_LOGS_TAIL_LINES`** · 기본값 `100`\
  컨테이너를 처음 수집할 때 읽는 과거 로그 줄 수. 이후에는 읽지 않은 로그를 모두 읽습니다
- **`EVERYUP_EXCLUDE`**\
  탐지에서 제외할 컨테이너 이름(쉼표로 구분)

### 호스트 메트릭 (CPU / 메모리 / 디스크 / 네트워크)

- **`EVERYUP_HOST_METRICS_ENABLED`** · 기본값 `true`\
  `/hostfs` 마운트에서 호스트 CPU·메모리·디스크·네트워크 수집
- **`EVERYUP_HOST_METRICS_ROOT`** · 기본값 `/hostfs`\
  호스트 파일시스템 마운트 위치(`/proc`, `/proc/net/dev`를 읽음)
- **`EVERYUP_HOST_DISK_PATH`** · 기본값 `/hostfs`\
  디스크 사용량을 계산할 경로
- **`EVERYUP_HOST_CPU_PERCENT`** · 기본값 `0`\
  호스트 CPU% **알림** 임계값. `0`이면 호스트 자원 알림을 끕니다(수집에는 영향 없음)
- **`EVERYUP_HOST_MEMORY_PERCENT`** · 기본값 `0`\
  호스트 메모리% 알림 임계값. `0`이면 끕니다
- **`EVERYUP_HOST_DISK_PERCENT`** · 기본값 `0`\
  호스트 디스크% 알림 임계값. `0`이면 끕니다

### OTel Collector와 텔레메트리 게이트웨이

- **`EVERYUP_OTEL_CONFIG_ENABLED`** · 기본값 `false`\
  시작할 때 OTel Collector 설정 생성
- **`EVERYUP_OTEL_CONFIG_PATH`** · 기본값 `/etc/everyup/generated/otel-config.yaml`\
  생성한 OTel 설정 파일 위치
- **`EVERYUP_OTEL_CONF_DIR`** · 기본값 `/etc/everyup/conf.d`\
  OTel 설정 조각을 읽을 디렉터리
- **`EVERYUP_OTEL_FILELOG_PATHS`**\
  OTel filelog receiver가 읽을 파일 경로(쉼표로 구분)
- **`EVERYUP_TELEMETRY_GATEWAY_ENABLED`** · 기본값 `true`\
  텔레메트리를 Web으로 전달하는 OTLP 게이트웨이 실행
- **`EVERYUP_TELEMETRY_GATEWAY_LISTEN_ADDR`** · 기본값 `:4318`\
  OTLP 게이트웨이 listen 주소

### Heartbeat watchdog

- **`EVERYUP_HEARTBEAT_URL`**\
  주기적으로 ping할 외부 heartbeat(dead-man's switch) URL
- **`EVERYUP_HEARTBEAT_TOKEN`**\
  heartbeat ping에 함께 보내는 토큰
- **`EVERYUP_HEARTBEAT_INTERVAL_SECONDS`** · 기본값 `60`\
  heartbeat ping 주기(초)
