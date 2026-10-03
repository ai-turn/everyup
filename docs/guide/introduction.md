# EveryUp 소개

EveryUp은 Docker로 실행 중인 서비스를 한곳에서 모니터링하는 셀프호스팅 도구입니다.
대시보드 서버에 **Web**을 한 번 띄우고, 모니터링할 **Docker 환경**마다 가벼운
EveryUp Docker Collector를 실행하면 끝입니다. 큰 관측 스택을 따로 세울 필요가 없습니다.

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 사용자, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **Docker Collector** | Docker 디스커버리, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 Docker 호스트 |

![EveryUp 대시보드](/images/everyup-main-ko.png)

## 핵심 기능

🟢 기본 제공 — 앱 코드 수정 없이 설치만으로 동작 · 🔵 선택 — 필요할 때 활성화

|  | 기능 | 설명 |
| :-: | --- | --- |
| 🟢 | 💓 업타임 | Docker 컨테이너 자동 발견, 실행 상태와 health |
| 🟢 | 🖥️ 인프라 | 호스트 CPU·메모리·디스크·네트워크 메트릭 |
| 🟢 | 📜 로그 | 컨테이너 stdout/stderr 수집 |
| 🟢 | 🌐 API 상태 | access log에서 읽은 요청 상태코드(method·path·status) |
| 🟢 | 🔔 알림 | Telegram·Discord·Slack 채널 ([설정 가이드](./notifications)) |
| 🔵 | ⚡ API latency·트레이스 | [자동 eBPF Observer](./ebpf-observer) — 앱 수정 없음 |
| 🔵 | 🔍 API 헤더·바디 | [OpenTelemetry 연동](./otel-instrumentation) — 앱 재시작 한 번 |

## 수집되는 데이터

### Docker Collector

아래는 전체 프로필 기준으로 앱 수정 없이 수집되는 데이터입니다. 설치기는 선택한 수집
범위에 필요한 경우에만 Docker 소켓과 `/hostfs`를 읽기 전용으로 마운트합니다.

| 데이터 | 소스 |
| --- | --- |
| 컨테이너 up/down, 이름, 이미지, 상태 | Docker 소켓 |
| 상태 변화·Collector 이벤트 | Collector가 생성한 audit 기록 |
| stdout/stderr 로그 | `docker logs` |
| API 요청 method, path, status (latency 없음) | access log 파싱 |
| 호스트 CPU, 메모리, 디스크, 네트워크 | `/hostfs` 마운트 |

API 상태코드는 앱이나 프록시가 access log를 stdout/stderr로 남길 때 표시됩니다.
access log가 없어도 컨테이너 상태, 일반 로그, 호스트 메트릭은 계속 수집됩니다.

### 모니터링 번들의 자동 eBPF Observer

| 데이터 | 소스 |
| --- | --- |
| 실제 latency가 포함된 API trace | `everyup-ebpf` eBPF Observer(OBI) |
| method, path, status, duration | 호스트 프로세스 관찰 |
| Go를 포함한 여러 언어와 HTTPS 서비스 | OpenTelemetry eBPF Instrumentation |

### 선택: 앱 측 OpenTelemetry 연동

| 데이터 | 소스 |
| --- | --- |
| 요청/응답 헤더 | `http.*.header.*` span attribute |
| 요청/응답 바디 | `*_body_masked` span event |
| 앱 메트릭(JVM 메모리, GC, 커스텀 카운터 등) | 앱 OTel -> Docker Collector `:4318` |

## 다음 단계

[빠른 시작](./quickstart)에서 Web과 Docker Collector를 설치하세요.
