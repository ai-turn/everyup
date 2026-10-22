# EveryUp 소개

EveryUp은 서비스 상태, 로그, API 요청, 서버 자원을 한곳에서 확인하는 셀프호스팅 모니터링 도구입니다.
장애가 난 대상과 수집이 지연된 대상을 먼저 확인하고, 반복 오류와 요청 추이를 따라 문제를 조사할 수 있습니다.

대시보드 서버에서 **Web**을 실행하고, 모니터링할 **Docker 환경**마다 Docker Collector를 설치하세요.
공개 URL·TCP 포트는 [업타임 모니터](./uptime-monitors)로 응답을 확인합니다.
Docker 밖의 앱과 서버는 [OpenTelemetry로 직접 연결](./monitoring-setup#direct-otel)할 수 있습니다.

<Topology />

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 사용자, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **Docker Collector** | Docker 컨테이너 자동 발견, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 Docker 호스트 |

![EveryUp 개요 화면. 확인이 필요한 서비스로 장애가 난 payment-worker, Docker 환경 2개·업타임 모니터 2개·직접 연결 서비스 3개·인프라 리소스 2개의 모니터링 범위, 최근 장애 이력 3건.](/images/home/slide-overview-light.webp){.only-light width=1440 height=900}
![EveryUp 개요 화면. 확인이 필요한 서비스로 장애가 난 payment-worker, Docker 환경 2개·업타임 모니터 2개·직접 연결 서비스 3개·인프라 리소스 2개의 모니터링 범위, 최근 장애 이력 3건.](/images/home/slide-overview-dark.webp){.only-dark width=1440 height=900}

## 핵심 기능

Docker Collector는 선택한 수집 범위에 따라 동작합니다. **기본** 프로필은 컨테이너 상태와 로그를
수집하고, **전체** 프로필은 호스트 자원·API 요청 수집과 OTLP 메트릭 수신도 켭니다.
업타임 모니터와 알림은 대시보드에서 별도로 설정하세요.

| 기능 | 확인할 내용 | 필요한 설정 |
| --- | --- | --- |
| 개요 | 장애·수집 지연, 모니터링 범위, 최근 장애 이력 | 모니터링 대상 연결 |
| 컨테이너 상태 | 자동 발견한 컨테이너의 실행 상태와 검사 결과 | Docker Collector의 업타임 수집 선택 |
| 업타임 | 독립 모니터와 Docker Collector의 HTTP·TCP 응답 검사 | [모니터 추가](./uptime-monitors) 또는 Docker 응답 검사 설정 |
| 인프라 | 호스트 CPU·메모리·디스크·네트워크 추이 | 인프라 수집 선택 또는 [표준 Collector 연결](./monitoring-setup#direct-otel) |
| 로그 | 오류·경고 추이, 반복 메시지 묶기, 검색 | stdout/stderr 수집 또는 직접 OTLP 로그 전송 |
| API 상태 | access log에서 추출한 요청 메서드·경로·상태 코드 | 앱이나 프록시의 access log 출력 |
| API 응답 시간·트레이스 | 요청 수·에러율·응답 시간 추이와 span | [eBPF Observer](./ebpf-observer) 또는 앱의 OpenTelemetry 연동 |
| 앱 메트릭 | 앱이 보낸 메트릭별 수치와 추이 | 앱·Collector의 OTLP 메트릭 전송 설정 |
| 헤더·바디 상세 수집 | 요청 진단 정보와 캡처된 바디 | [언어별 계측](./otel-instrumentation). 바디 자동 수집은 Node.js에서 선택적으로 활성화 |
| 알림 | 규칙·채널·발송 결과 | [알림 채널과 활성 규칙 설정](./notifications) |

업타임 화면은 서비스가 요청에 응답하는지를 보여줍니다. 컨테이너 실행 여부만 확인하는 검사 결과는
Docker 환경에서 확인하세요.

API 요청 추이는 과거 데이터가 있으면 지난주와 비교할 수 있습니다. Docker 환경에서는 배포·재시작
이벤트도 함께 표시합니다. **지연 시간 p95**는 측정한 요청의 95%가 이 시간 안에 끝났다는 뜻입니다.
트레이스의 **span**은 요청 처리 과정의 한 작업을 기록한 데이터입니다.

## 수집되는 데이터

### Docker Collector

아래는 전체 프로필 기준으로 앱 수정 없이 수집되는 데이터입니다. 설치기는 선택한 수집
범위에 필요한 경우에만 Docker 소켓과 `/hostfs`를 읽기 전용으로 마운트합니다.

| 데이터 | 소스 |
| --- | --- |
| 컨테이너 up/down, 이름, 이미지, 상태 | Docker 소켓 |
| 상태 변화·Collector 이벤트 | Collector가 생성한 audit 기록 |
| stdout/stderr 로그 | `docker logs` |
| API 요청 method, path, status (응답 시간은 추출하지 않음) | access log 파싱 |
| 호스트 CPU, 메모리, 디스크, 네트워크 | `/hostfs` 마운트 |

API 상태 코드는 앱이나 프록시가 access log를 stdout/stderr로 남길 때 표시됩니다.
access log가 없어도 컨테이너 상태, 일반 로그, 호스트 메트릭은 계속 수집됩니다.

### 모니터링 번들의 자동 eBPF Observer

| 데이터 | 소스 |
| --- | --- |
| 실제 응답 시간이 포함된 API 트레이스 | `everyup-ebpf` eBPF Observer(OBI) |
| method, path, status, duration | 호스트 프로세스 관찰 |
| Go를 포함한 여러 언어와 HTTPS 서비스 | OpenTelemetry eBPF Instrumentation |

지원하는 호스트·런타임과 서비스 간 트레이스 연결 조건은 [eBPF 가이드](./ebpf-observer)를 확인하세요.

### 선택: 앱 측 OpenTelemetry 연동

| 데이터 | 소스 |
| --- | --- |
| 요청/응답 헤더 | `http.*.header.*` span attribute |
| 요청/응답 바디 | `*_body_masked` span event |
| 앱 메트릭(JVM 메모리, GC, 커스텀 카운터 등) | 앱 OTel -> Docker Collector `:4318` |

OpenTelemetry(OTel)는 앱의 로그·트레이스·메트릭을 수집하고 전송하는 도구입니다.
이 데이터는 OTLP 프로토콜로 보냅니다. 메트릭 수신을 켜는 것만으로 앱 메트릭이 생성되지는 않습니다.
Java·Node.js의 헤더 수집은 번들로 설정할 수 있고, 바디 자동 수집은 Node.js에서 별도로 켭니다.
Java 바디 수집에는 코드 추가가 필요합니다.

## 다음 단계

[Quick Start](./quickstart)에서 Web과 Docker Collector를 설치하세요.
