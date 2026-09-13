<p align="center">
  <img src="docs/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  Docker 서비스를 위한 셀프호스팅 모니터링 대시보드와 가벼운 Docker 수집기.
</p>

<p align="center">
  <a href="README.en.md">English</a> -
  <a href="#빠른-시작">빠른 시작</a> -
  <a href="#수집되는-데이터">수집 항목</a> -
  <a href="#문서">문서</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><b>Live Demo</b></a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <img src="https://img.shields.io/badge/Go-1.24%2F1.25-00ADD8?logo=go" alt="Go 1.24 / 1.25">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" alt="Docker ready">
</p>

<p align="center">
  <img src="docs/images/everyup-main-ko.png" alt="EveryUp 대시보드" width="100%">
</p>

## EveryUp이 뭔가요?

EveryUp은 Docker로 실행 중인 서비스를 한곳에서 모니터링하는 셀프호스팅 도구입니다.
대시보드 서버에 **Web**을 한 번 띄우고, 모니터링할 **Docker 환경**마다 가벼운
EveryUp Docker 수집기를 실행하면 끝입니다. 큰 관측 스택을 따로 세울 필요가 없습니다.

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 사용자, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **Docker 수집기** | Docker 디스커버리, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 Docker 호스트 |

## 핵심 기능

🟢 기본 제공 — 앱 코드 수정 없이 설치만으로 동작 · 🔵 선택 — 필요할 때 활성화

|  | 기능 | 설명 |
| :-: | --- | --- |
| 🟢 | 💓 헬스체크 | Docker 컨테이너 자동 발견, 실행 상태와 health |
| 🟢 | 🖥️ 인프라 | 호스트 CPU·메모리·디스크·네트워크 메트릭 |
| 🟢 | 📜 로그 | 컨테이너 stdout/stderr 수집 |
| 🟢 | 🌐 API 상태 | access log에서 읽은 요청 상태코드(method·path·status) |
| 🟢 | 🔔 알림 | Telegram·Discord·Slack 채널 |
| 🔵 | ⚡ API latency·트레이스 | 자동 eBPF 관측기 — 앱 수정 없음 |
| 🔵 | 🔍 API 헤더·바디 | OpenTelemetry 계측 — 앱 재시작 한 번 |

## 빠른 시작

Web 1개와 모니터링 번들 1개를 Docker Compose로 실행하는 가장 작은 구성입니다.
단일 서버라면 둘을 같은 서버에서 실행해도 됩니다. Compose 템플릿은
[`web/docker-compose.yml`](web/docker-compose.yml)과
[`agent/docker-compose.yml`](agent/docker-compose.yml)에 있습니다.

### 1. Web 실행

대시보드 서버에서 `docker-compose.yml`을 작성합니다.

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    ports:
      - "3001:3001"
    volumes:
      - everyup-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  everyup-data:
    driver: local
```

```bash
docker compose up -d
```

`http://WEB_SERVER_IP:3001`을 열고 첫 관리자 계정을 만들면 완료입니다.

외부 접속 주소가 따로 있다면 Web 컨테이너의 환경 변수에
`EVERYUP_PUBLIC_URL=https://monitor.example.com`을 지정하세요. 저장소의 Compose 파일은
같은 이름의 환경 변수 또는 `.env` 값을 전달합니다. Docker 설치 명령, 직접 OTLP 연결,
인프라 Collector 설정에 이 주소를 공통으로 사용합니다. 생략하면 브라우저의 API 주소를
기준으로 제안하며, 각 연결 화면에서 수정할 수 있습니다. 대상 서버에서 접근할 수 있는
절대 HTTP(S) 주소가 필요하고 `localhost`는 허용하지 않습니다.

### 2. 일회용 Docker 연결 명령 만들기

대시보드에서 **Docker**를 열고 **Docker 연결**을 누릅니다. 연결 화면에는
10분 동안 한 번만 사용할 수 있는 설치 명령이 표시됩니다. 장기 API 키는
브라우저에 표시되지 않고 설치 과정에서 대상 서버로 직접 전달됩니다.

### 3. 모니터링할 서버에 모니터링 번들 설치

번들 Compose 파일은 Docker 수집기와 권한이 분리된 OBI eBPF 관측기를 함께
실행합니다. 앱의 Compose 파일, 이미지, 포트, 컨테이너는 바꿀 필요가 없습니다.
Docker Compose 2.23.1 이상이 필요합니다.

표시된 명령 한 줄을 대상 Linux Docker 서버에서 실행합니다. 설치기는 Docker와
Compose 버전을 먼저 확인한 후 `/opt/everyup-agent`에 설정을 만들고 Docker 수집기와
eBPF 관측기를 시작합니다. 기존 설정이 있으면 덮어쓰기 전에 백업합니다.

연결 코드가 만료되거나 이미 사용됐다면 프로젝트 설치 화면에서 **새 코드**를
눌러 다시 발급할 수 있습니다.

약 30초 안에 Web에서 Docker 환경이 online으로 표시되고, 그 서버의 컨테이너들이
자동으로 나타납니다. eBPF 관측기도 컨테이너 프로세스를 자동으로 찾으므로
포트 목록을 관리할 필요가 없습니다. 문제가 생기면
[트러블슈팅](#트러블슈팅)을 참고하세요.

Docker 환경 화면의 **모니터링 설정 가이드**가 수집기 연결, 기본 수집, 자동 API 추적을
순서대로 진단합니다. Java·Node.js 서비스가 발견되면 같은 가이드에서 선택 기능인
헤더·바디 상세 계측까지 바로 이어서 설정할 수 있습니다.

로그·API·메트릭·인프라 메뉴의 **연결** 버튼에서는 기존 서비스나 Docker 환경을 선택해
기능을 추가할 수 있습니다. 같은 ID·키·프로젝트·이력을 유지하며, 발급된 명령을
해당 서버에서 실행해야 적용됩니다. 기능 추가 범위는 그 Docker 환경 전체입니다.

설정 가이드는 최근 2분 내 수집기 통신과 요청한 수집 범위의 적용 확인을 구분합니다.
로그·트레이스·메트릭·인프라는 실제 저장된 데이터의 최초·마지막 수신 시각을 기록하고
5초마다 화면에서 확인합니다. 수신 기록은 현재 정상 동작을 보장하는 상태 표시가 아닙니다.
구버전 수집기는 통신하더라도 설정 적용 확인이 대기 상태일 수 있으므로 최신 설치 명령으로
업데이트하세요. DB 마이그레이션 이전 데이터의 수신 기록은 소급 생성하지 않습니다.

각 메뉴의 연결 화면은 기존 대상 선택, Docker 설치, 직접 OpenTelemetry 연결을
한곳에서 안내합니다. 이미 설정된 대상은 수신 기록을 확인한 뒤 해당 데이터 화면으로
이동할 수 있습니다. 직접 연결은 기존 OTel 사용 여부와 Java·Node.js·Go 환경에 맞춰
설정 적용·재시작·데이터 발생·수신 확인 순서를 안내합니다.

상세 계측은 적용할 Java·Node.js 서비스를 직접 선택한 뒤 **변경 사항 확인**으로
재시작 범위를 확인합니다. 서버의 `everyup-otel plan`으로 실제 Compose를 검증하고
적용 명령을 실행하면 실행별 적용·검증·복구 결과가 웹에 표시됩니다.
설정 검증과 새 트레이스 수신은 별도로 표시하며, 트래픽이 없다는 이유로 복구하지 않습니다.

## 선택 기능

### 자동 eBPF 관측기: API latency와 trace

기본 Docker 수집기는 access log에서 method, path, status를 읽습니다. 실제 latency와
trace까지 볼 수 있도록 번들 Compose가 `everyup-ebpf`를 자동으로 실행합니다.
Docker/OCI 컨테이너에서 실행 중인 프로세스를 자동 발견하므로
`BEYLA_OPEN_PORT`나 앱 포트 설정이 필요하지 않습니다.

앱 코드, Dockerfile, 앱 컨테이너를 바꾸지 않습니다. 실제 Linux 호스트에서는
eBPF가 호스트 프로세스를 관찰해 trace를 만들고, Docker 수집기가 각 span을 해당 Docker
서비스에 연결합니다. Docker Desktop에서는 PID 변환 제약으로 서비스 자동 연결이
되지 않을 수 있으므로, 이 경우 앱 측 OpenTelemetry 계측을 사용하세요.
Linux kernel 5.8+ 및 BTF가 필요합니다. 자세한 내용은
[agent/README.md](agent/README.md)의 "Zero-Code Tracing"을 참고하세요. eBPF
관측기는 높은 권한이 필요하므로 허용할 수 없는 환경에서는 `everyup-ebpf`
서비스를 제거할 수 있습니다. 이 경우에도 로그, 상태, 이벤트, 호스트 메트릭은
  계속 동작합니다.

### OpenTelemetry 계측: 요청/응답 헤더·바디

요청이 실패한 이유까지 진단하려면 앱 측 OpenTelemetry 계측을 사용합니다. 앱을
한 번 재시작해야 하지만, Java와 Node.js는 코드나 Dockerfile을 고치지 않고
Compose override로 붙일 수 있습니다.

웹 UI에서 프로젝트를 열고 **상세 API 모니터링**을 실행한 뒤 표시된 명령 한 줄을
애플리케이션 서버에서 실행합니다. `everyup-otel` CLI가 감지된 Java/Node.js 런타임에
맞춘 `docker-compose.everyup.yml`을 만들고 선택한 서비스만 다시 띄웁니다. 적용 후
주입 옵션, 공유 볼륨, 수집기 네트워크와 컨테이너 상태를 검증하며 실패하면 직전 설정으로
자동 복구합니다.

요청/응답 바디 자동 캡처는 현재 Node.js에서 지원됩니다. 바디는 앱 안에서
export 전에 마스킹되며, Web에서는 관리자만 볼 수 있고 열람 기록이 남습니다.
Java, Python, 수동 SDK는 마스킹된 body span event를 직접 추가할 수 있습니다.
전체 설정은 [OTel API 계측 가이드](docs/OTEL_API_INSTRUMENTATION.ko.md)를
참고하세요.

## 수집되는 데이터

### 기본 Docker 수집기

앱 수정 없이 수집됩니다. Docker 수집기는 Docker 소켓과 `/hostfs`를 읽기 전용으로
마운트합니다.

| 데이터 | 소스 |
| --- | --- |
| 컨테이너 up/down, 이름, 이미지, 상태, 이벤트 | Docker 소켓 |
| stdout/stderr 로그 | `docker logs` |
| API 요청 method, path, status (latency 없음) | access log 파싱 |
| 호스트 CPU, 메모리, 디스크, 네트워크 | `/hostfs` 마운트 |

API 상태코드는 앱이나 프록시가 access log를 stdout/stderr로 남길 때 표시됩니다.
access log가 없어도 컨테이너 상태, 일반 로그, 호스트 메트릭은 계속 수집됩니다.

### 모니터링 번들의 자동 eBPF 관측기

| 데이터 | 소스 |
| --- | --- |
| 실제 latency가 포함된 API trace | `everyup-ebpf` 관측기(OBI/eBPF) |
| method, path, status, duration | 호스트 프로세스 관찰 |
| Go를 포함한 여러 언어와 HTTPS 서비스 | OpenTelemetry eBPF Instrumentation |

### 선택: 앱 측 OpenTelemetry 계측

| 데이터 | 소스 |
| --- | --- |
| 요청/응답 헤더 | `http.*.header.*` 스팬 속성 |
| 요청/응답 바디 | `*_body_masked` 스팬 이벤트 |
| 앱 메트릭(JVM 메모리, GC, 커스텀 카운터 등) | 앱 OTel -> Docker 수집기 `:4318` |

## 트러블슈팅

**Docker 환경이 online으로 뜨지 않습니다.**
`EVERYUP_WEB_BASE_URL`은 Docker 수집기 컨테이너 안에서 접근 가능한 Web 주소여야 합니다.
같은 서버라도 컨테이너 안의 `localhost`는 Web이 아니라 수집기 자신을 가리킬 수
있습니다. Compose 서비스명이나 호스트에서 접근 가능한 IP를 사용하세요.

**Docker 수집기가 Docker 소켓을 읽지 못합니다.**
권한 문제입니다. 한 줄 설치기는 Docker 소켓의 group ID를 감지해
`EVERYUP_DOCKER_GID`를 자동으로 기록합니다. 수동 배포라면 이 값을
`stat -c '%g' /var/run/docker.sock` 결과로 설정하고 `group_add`에 추가하세요.
`user: "0:0"`은 짧은 진단 용도로만 사용하세요. 운영 환경에서 소켓 접근 권한을 좁히려면
[Docker socket proxy 가이드](agent/docs/docker-socket-proxy.md)를 사용하세요.

**로그가 보이지 않습니다.**
컨테이너 안의 파일에만 쓰는 로그는 Docker 로그로 보이지 않으므로 Docker 수집기도 수집할
수 없습니다. 앱이나 프록시 로그를 stdout/stderr로 출력하세요.

**운영 배포 시 백업.**
`/app/data`를 백업하세요. `EVERYUP_ENCRYPTION_KEY`를 설정했다면 같은 64자 hex
키를 배포 secret과 함께 보관해야 합니다. 키 없이 데이터베이스 백업만으로는
암호화된 Docker 수집기 키나 알림 secret을 복원할 수 없습니다.
자세한 내용은 [백업·복원 가이드](docs/BACKUP_RESTORE.ko.md)를 참고하세요.

## 문서

| 문서 | 내용 |
| --- | --- |
| [web/README.md](web/README.md) | Web 설정, 환경변수, API 영역, 로컬 개발 |
| [agent/README.md](agent/README.md) | Docker 수집기 설정, 전체 환경변수 레퍼런스, Compose 설정 |
| [agent/docs/docker-socket-proxy.md](agent/docs/docker-socket-proxy.md) | 운영 환경의 더 엄격한 Docker socket 접근 구성 |
| [agent/docs/web-connected-mode.md](agent/docs/web-connected-mode.md) | Docker 수집기 등록과 Web 동기화 동작 방식 |
| [agent/docs/host-metrics.md](agent/docs/host-metrics.md) | 호스트 CPU, 메모리, 디스크, 네트워크 수집 세부사항 |
| [agent/docs/otel-collector.md](agent/docs/otel-collector.md) | Docker 수집기가 생성하는 선택적 OTel collector 설정 |
| [docs/NOTIFICATION_SETUP.ko.md](docs/NOTIFICATION_SETUP.ko.md) | Telegram / Discord / Slack 채널 자격증명·설정 |
| [docs/BACKUP_RESTORE.ko.md](docs/BACKUP_RESTORE.ko.md) | `/app/data` 디렉토리 백업·복원 |
| [docs/OTEL_API_INSTRUMENTATION.ko.md](docs/OTEL_API_INSTRUMENTATION.ko.md) | OpenTelemetry 계측으로 요청/응답 헤더·바디 수집(언어별) |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 기능·리팩토링·버그픽스의 과거 이력 |

## 레퍼런스

**네트워킹.** Docker 수집기는 마운트된 Docker 소켓으로 컨테이너·로그에 접근하므로 자체
Compose 프로젝트에서도 동작합니다. 가장 깔끔한 구성은 `everyup-agent`를 그
서버의 앱 스택과 같은 Compose 파일에 두는 것입니다.

**저장소 구조**

```text
web/
  backend/                 # Go 1.24 API 서버, SQLite migration, OTLP ingest
  frontend/                # React 19 / Vite 대시보드
  docker-compose.yml       # Web 전용 Compose 템플릿
agent/
  cmd/                     # Docker 수집기 entrypoint
  docs/                    # Docker 수집기 배포/운영 문서
  instrumentation/         # 앱 측 OTel helper 번들
  docker-compose.yml       # Docker 수집기 Compose 템플릿
docs/                      # 사용자 문서, 백업/복원, 알림, OTel 가이드
docker-compose.yml         # 루트 편의용 Compose 파일 (Web 전용)
```

**개발**

소스 개발 사전 요구사항: Docker, pnpm, Web용 Go 1.24, Docker 수집기용 Go 1.25.

```bash
cd web/backend && go test ./...     # 백엔드 테스트
cd web/frontend && pnpm build       # 프론트엔드 빌드
cd agent && go test ./...           # Docker 수집기 테스트
```

계측 적용, 트래픽, 검증, 롤백 흐름을 시험할 수 있는 일회용 Node.js/Java 앱은
[모니터링 대상 E2E fixture](e2e/monitoring-target/README.ko.md)를 참고하세요.
