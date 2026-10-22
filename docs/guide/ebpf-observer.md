# 자동 eBPF Observer

Docker Collector의 access log 파서는 method, path, status만 읽고 응답 시간은 추출하지 않습니다.
API 수집을 선택하면 번들 Compose가 `everyup-ebpf`를 실행해 실제 응답 시간과 트레이스를 수집합니다.
Docker/OCI 컨테이너에서 실행 중인 프로세스를 자동 발견하므로
`BEYLA_OPEN_PORT`나 앱 포트 설정이 필요하지 않습니다.

앱 코드, Dockerfile, 앱 컨테이너를 바꾸지 않습니다. 실제 Linux 호스트에서는
eBPF가 호스트 프로세스를 관찰해 트레이스를 만들고, Docker Collector가 각 span을 해당 Docker
서비스에 연결합니다. Docker Desktop에서는 PID 변환 제약으로 서비스 자동 연결이
되지 않을 수 있으므로, 이 경우 [앱 측 OpenTelemetry 연동](./otel-instrumentation)을 사용하세요.
필요한 kernel과 권한은 [참고](#notes)에 있습니다.

## 동작 방식

번들 Compose는 [OpenTelemetry eBPF Instrumentation(OBI)](https://opentelemetry.io/docs/zero-code/obi/)을
쓰는 `everyup-ebpf` 서비스를 시작합니다. Go와 HTTPS를 포함한 지원 런타임에서 실제 SERVER
span(method, path, status, **응답 시간**)을 수집합니다. span은 요청 처리 과정의 한 작업을 기록한 데이터입니다.

OBI는 `everyup.source=ebpf` 태그를 붙여 span을 Docker Collector의 OTLP 게이트웨이로 보냅니다.
Collector는 계측된 프로세스의 PID를 Docker로 확인해 span을 서비스에 연결하고 이름을 바꿉니다.
호스트 프로세스, Observer 자신, 오래된 PID처럼 매칭되지 않는 span은 버려서, 존재하지 않는 서비스가
목록에 생기지 않게 합니다. 실제 span이 들어오는 서비스는 access log로 만든 합성 span을 더 이상
받지 않으므로 중복 집계되지 않습니다.

## 서비스 간 트레이스 연결

API 요청의 span을 수집하는 것과 여러 서비스의 호출을 하나의 분산 트레이스로 연결하는 것은 별개입니다.
설치기가 만드는 번들은 고급 서비스 간 연결 옵션을 기본으로 끕니다.
**Docker 환경 → 해당 환경 → 모니터링 설정 가이드**에서 **API 요청 자동 수집**과 서비스 간
트레이스 연결 상태를 따로 확인하세요.

수집기의 연결 가능 진단은 옵션 활성화 여부, Linux 5.17 이상, 커널 Lockdown 상태 등을 추가로
확인합니다. 이 진단 조건을 만족한다는 사실만으로 모든 런타임의 호출이 연결된다고 보장하지는 않습니다.

## 참고 {#notes}

- 수집기의 호스트 진단은 amd64·arm64, Linux kernel 5.8 이상과 BTF(`/sys/kernel/btf/vmlinux`)를
  확인합니다. RHEL 계열은 4.18 이상 backport도 진단 대상으로 포함합니다.
  Docker Desktop VM에서 커널 조건을 만족해도 앞서 설명한 PID 연결 제약이 있습니다.
- 현재 eBPF 배포 방식은 `privileged`와 `pid: host` 권한이 필요합니다. 높은 권한의 Observer는
  일반 Docker Collector와 분리되어 있습니다. 호스트에서 허용할 수 없다면 제거하세요. 나머지
  기능은 그대로 동작합니다.
- 기본 OBI 정책은 헤더와 바디를 캡처하지 않습니다. 헤더와 바디가 필요하면
  [앱 측 OpenTelemetry](./otel-instrumentation)를 사용하세요.
- 새로 시작하거나 재시작한 서비스는 Collector가 PID 정보를 갱신할 때까지(check 주기 1회)
  처음 몇 초의 span이 빠질 수 있습니다.
- OBI는 Compose 파일에 검증된 릴리스로 고정되어 있습니다. 대상 kernel과 PID 연결 동작을
  검증한 뒤에만 올리세요.
