<p align="center">
  <img src="docs/public/images/logo.webp" alt="EveryUp" width="88">
</p>

<h1 align="center">EveryUp</h1>

<p align="center">
  업타임·로그·API 응답 속도·서버 리소스를 한 화면에서 보고, 이상이 생기면 바로 알림을 받는 셀프호스팅 모니터링.
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><b>문서</b></a> -
  <a href="https://ai-turn.github.io/everyup/demo/"><b>Live Demo</b></a> -
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://ai-turn.github.io/everyup/"><img src="https://img.shields.io/badge/docs-ai--turn.github.io-blue" alt="Docs"></a>
  <a href="https://ai-turn.github.io/everyup/demo/"><img src="https://img.shields.io/badge/Demo-live-brightgreen" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
  <img src="https://img.shields.io/badge/Go-1.24%2F1.25-00ADD8?logo=go" alt="Go 1.24 / 1.25">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" alt="Docker ready">
</p>

<p align="center">
  <img src="docs/public/images/everyup-main-ko.png" alt="EveryUp 대시보드" width="100%">
</p>

EveryUp은 서비스 상태와 로그, API 응답, 서버 자원을 한곳에서 모니터링하는 셀프호스팅 도구입니다.
대시보드 서버에 **Web**을 한 번 띄우고, 모니터링할 **Docker 환경**마다 가벼운
EveryUp Docker Collector를 실행하면 됩니다. Docker 밖의 대상은
[업타임 모니터](https://ai-turn.github.io/everyup/guide/uptime-monitors)로 HTTP·TCP 응답을 확인하거나
[OpenTelemetry로 직접 연결](https://ai-turn.github.io/everyup/guide/monitoring-setup#direct-otel)합니다.

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 사용자, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **Docker Collector** | Docker 컨테이너 자동 발견, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 Docker 호스트 |

## 빠른 시작

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

`http://<대시보드 서버 IP>:3001`에서 첫 관리자 계정을 만든 뒤, **Docker 환경** 화면의
**Docker 연결**로 Collector를 설치합니다. 외부 접속 주소 지정과 Collector 설치는
[Quick Start 문서](https://ai-turn.github.io/everyup/guide/quickstart)를 참고하세요.

## 문서

| 문서 | 내용 |
| --- | --- |
| [소개](https://ai-turn.github.io/everyup/guide/introduction) | 핵심 기능과 수집되는 데이터 |
| [Quick Start](https://ai-turn.github.io/everyup/guide/quickstart) | Web 실행, Docker 연결, 모니터링 번들 설치 |
| [모니터링 설정](https://ai-turn.github.io/everyup/guide/monitoring-setup) | 수집 상태 진단, 기능 추가, OpenTelemetry 직접 연결, Project |
| [업타임 모니터](https://ai-turn.github.io/everyup/guide/uptime-monitors) | Docker 밖의 URL·TCP 포트 확인 |
| [자동 eBPF Observer](https://ai-turn.github.io/everyup/guide/ebpf-observer) | 앱 수정 없이 API latency·트레이스 수집 |
| [헤더·바디 상세 수집](https://ai-turn.github.io/everyup/guide/otel-instrumentation) | OpenTelemetry로 요청/응답 헤더·바디 수집 |
| [알림](https://ai-turn.github.io/everyup/guide/notifications) | Telegram / Discord / Slack 채널과 알림 규칙 |
| [업그레이드·제거](https://ai-turn.github.io/everyup/guide/upgrade-uninstall) · [백업·복원](https://ai-turn.github.io/everyup/guide/backup-restore) · [트러블슈팅](https://ai-turn.github.io/everyup/guide/troubleshooting) | 운영 |
| [Web 설정](https://ai-turn.github.io/everyup/reference/web) · [Docker Collector 설정](https://ai-turn.github.io/everyup/reference/collector) | 환경변수·네트워킹 레퍼런스 |

## 개발

```text
web/
  backend/                 # Go 1.24 API 서버, SQLite migration, OTLP ingest
  frontend/                # React 19 / Vite 대시보드
agent/                     # Docker Collector (Go 1.25)
docs/                      # 문서 사이트 (VitePress) — ai-turn.github.io/everyup
```

소스 개발 사전 요구사항: Docker, pnpm, Web용 Go 1.24, Docker Collector용 Go 1.25.

```bash
cd web/backend && go test ./...                               # 백엔드 테스트
cd web/frontend && pnpm lint && pnpm typecheck && pnpm build  # 프론트엔드 (CI와 같은 순서)
cd agent && go test ./...                                     # Docker Collector 테스트
pnpm docs:dev                                                 # 문서 사이트 로컬 실행
```

`pnpm build`는 타입을 검사하지 않으므로 `typecheck`를 따로 돌립니다. UI를 바꿨다면 머지 전에
`web/frontend`에서 `pnpm test:e2e`를 실행하세요. 데모 e2e는 PR CI와 Docker 이미지 발행 전 검증,
Pages 배포에서 실행합니다. Docker 이미지는 같은 커밋의 모든 검증이 통과해야 발행됩니다.
화면 모습이 바뀌었다면 `pnpm screenshot`으로 문서와 README의 스크린샷을 다시 만듭니다.

로컬 실행 방법은 [web/README.md](web/README.md)와 [agent/README.md](agent/README.md),
상세 수집 E2E fixture는 [e2e/monitoring-target](e2e/monitoring-target/README.ko.md)에 있습니다.
