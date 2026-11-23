# EveryUp 소개

EveryUp은 서비스 상태, 로그, API 요청, 서버 자원을 한곳에서 확인하는 셀프호스팅 모니터링 도구입니다.
장애가 난 대상과 수집이 지연된 대상을 먼저 확인하고, 반복 오류와 요청 추이를 따라 문제를 조사할 수 있습니다.

대시보드 서버에서 **Web**을 실행한 뒤, 필요한 기능마다 모니터링 대상을 직접 연결하세요.
공개 URL·TCP 포트는 [업타임 모니터](./uptime-monitors)로 확인하고, 앱의 로그·API 요청·메트릭은
[OpenTelemetry로 직접 연결](./monitoring-setup#direct-otel)합니다. 서버 자원은 표준 OpenTelemetry
Collector로 보냅니다. Linux Docker 호스트라면 그 서버에 선택 통합인 **Docker Collector**를 설치해, 앱을 고치지 않고
컨테이너 상태·로그·호스트 자원을 한 번에 수집할 수도 있습니다.

| 구성 | 역할 | 실행 위치 |
| --- | --- | --- |
| **Web** | 대시보드, 업타임 검사, OTLP 수신, 알림 규칙·채널, 히스토리 | 대시보드 서버 |
| **OpenTelemetry SDK** | 앱의 로그·트레이스·메트릭을 Web으로 직접 전송 | 각 앱 |
| **표준 OpenTelemetry Collector** | 서버 CPU·메모리·디스크·네트워크를 Web으로 전송 | 모니터링할 각 서버 |
| **Docker Collector** (선택) | Docker 컨테이너 자동 발견, 컨테이너 상태, 로그, 호스트 메트릭 | 모니터링할 각 Docker 호스트 |

![EveryUp 개요 화면. 서버 13개, 현재 확인 필요 목록(edge-host-01의 Checkout API와 prod-server의 payment-worker 장애 2건, 확인 필요 6건), 최근 장애 이력 7건.](/images/home/slide-overview-light.webp){.only-light width=1440 height=900}
![EveryUp 개요 화면. 서버 13개, 현재 확인 필요 목록(edge-host-01의 Checkout API와 prod-server의 payment-worker 장애 2건, 확인 필요 6건), 최근 장애 이력 7건.](/images/home/slide-overview-dark.webp){.only-dark width=1440 height=900}

## 핵심 기능

모니터링하는 호스트는 모두 **서버**입니다. 서버의 인프라·로그·API 요청 탭은 그 서버에 직접 설정한 대상과
Docker Collector가 수집한 데이터를 함께 보여줍니다. 업타임 탭은 직접 추가한 업타임 모니터만 보여주고, Docker Collector가 있는
서버에는 **컨테이너** 탭이 더 있습니다. 컨테이너의 응답 검사와 메트릭은 컨테이너 탭과 컨테이너마다 있는 페이지에서 확인하세요.
개요·그룹·알림도 두 경로의 대상을 서버 단위로 함께 다룹니다.

| 기능 | 확인할 내용 | 필요한 설정 |
| --- | --- | --- |
| 개요 | 장애·수집 지연, 모니터링 범위, 최근 장애 이력 | 모니터링 대상 연결 |
| 업타임 | 직접 등록한 업타임 모니터의 HTTP·TCP 응답 검사 | [업타임 모니터 추가](./uptime-monitors) |
| 인프라 | 호스트 CPU·메모리·디스크·네트워크 추이 | [OpenTelemetry Collector로 인프라 연결](./monitoring-setup#direct-otel) 또는 Docker Collector의 인프라 수집 |
| 로그 | 오류·경고 추이, 반복 메시지 묶기, 검색 | 직접 OTLP 로그 전송 또는 Docker Collector의 stdout/stderr 수집 |
| API 응답 시간·트레이스 | 요청 수·에러율·응답 시간 추이와 span | 앱의 [OpenTelemetry 직접 연결](./monitoring-setup#direct-otel) 또는 Docker Collector와 함께 설치되는 [eBPF Observer](./ebpf-observer) |
| 앱 메트릭 | 앱이 보낸 메트릭별 수치와 추이 | 앱이나 OpenTelemetry Collector의 OTLP 메트릭 전송 설정 |
| 컨테이너 상태 | 자동 발견한 컨테이너의 실행 상태와 검사 결과 | Docker Collector의 컨테이너 상태 수집 선택 |
| API 상태 | access log에서 추출한 요청 메서드·경로·상태 코드 | Docker Collector가 있는 서버에서 앱이나 프록시의 access log 출력 |
| 헤더·바디 상세 수집 | 요청 진단 정보와 캡처된 바디 | [언어별 계측](./otel-instrumentation). 바디 자동 수집은 Node.js에서 선택적으로 활성화 |
| 알림 | 규칙·채널·발송 결과 | [알림 채널과 활성 규칙 설정](./notifications) |

API 요청 추이는 과거 데이터가 있으면 지난주와 비교할 수 있습니다. 컨테이너는 배포·재시작
이벤트도 함께 표시합니다. **지연 시간 p95**는 측정한 요청의 95%가 이 시간 안에 끝났다는 뜻입니다.
트레이스의 **span**은 요청 처리 과정의 한 작업을 기록한 데이터입니다.

## 수집되는 데이터

### 직접 연결

| 데이터 | 소스 |
| --- | --- |
| HTTP·TCP 응답 결과와 응답 시간 | Web이 수행하는 업타임 모니터 검사 |
| 앱 로그·트레이스·메트릭 | 앱의 OpenTelemetry SDK → Web OTLP 엔드포인트 |
| 호스트 CPU, 메모리, 디스크, 네트워크 | 표준 OpenTelemetry Collector |

직접 연결은 대상 서버에 EveryUp 구성 요소를 설치하지 않습니다. 업타임 모니터는 Web이 대상에 접속해
확인하므로, 대시보드 서버에서 대상 주소에 접속할 수 있어야 합니다.

### 선택: Docker Collector

Docker Collector는 서버의 Linux Docker 호스트에 모니터링 번들을 설치해, 앱을 고치지 않고 컨테이너 단위로 수집하는
선택 통합입니다. 서버 하나에 하나만 설치할 수 있고, 같은 호스트의 지표는 Docker Collector와 OpenTelemetry Collector 중
한 곳에서만 수집합니다([호스트 지표 출처](./monitoring-setup#host-metrics-source)). Docker Collector는 선택한 수집 범위에 따라 동작합니다. **기본** 프로필은 컨테이너
상태와 로그를 수집하고, **전체** 프로필은 호스트 자원·API 요청 수집과 OTLP 메트릭 수신도 켭니다.

<Topology />

#### Docker Collector

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

#### 모니터링 번들의 자동 eBPF Observer

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
| 앱 메트릭(JVM 메모리, GC, 커스텀 카운터 등) | 앱 OTel -> Web OTLP 엔드포인트 또는 Docker Collector `:4318` |

OpenTelemetry(OTel)는 앱의 로그·트레이스·메트릭을 수집하고 전송하는 도구입니다.
이 데이터는 OTLP 프로토콜로 보냅니다. 메트릭 수신을 켜는 것만으로 앱 메트릭이 생성되지는 않습니다.
Java·Node.js의 헤더 수집은 번들로 설정할 수 있고, 바디 자동 수집은 Node.js에서 별도로 켭니다.
Java 바디 수집에는 코드 추가가 필요합니다.

## 다음 단계

[Quick Start](./quickstart)에서 Web을 실행하고 첫 업타임 모니터를 추가하세요. Docker Collector 설치도 같은
문서에서 이어서 안내합니다.
