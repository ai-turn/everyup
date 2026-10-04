# 자동 eBPF Observer: API latency와 트레이스

기본 Docker Collector는 access log에서 method, path, status를 읽습니다. 실제 latency와
트레이스까지 볼 수 있도록 번들 Compose가 `everyup-ebpf`를 자동으로 실행합니다.
Docker/OCI 컨테이너에서 실행 중인 프로세스를 자동 발견하므로
`BEYLA_OPEN_PORT`나 앱 포트 설정이 필요하지 않습니다.

앱 코드, Dockerfile, 앱 컨테이너를 바꾸지 않습니다. 실제 Linux 호스트에서는
eBPF가 호스트 프로세스를 관찰해 트레이스를 만들고, Docker Collector가 각 span을 해당 Docker
서비스에 연결합니다. Docker Desktop에서는 PID 변환 제약으로 서비스 자동 연결이
되지 않을 수 있으므로, 이 경우 [앱 측 OpenTelemetry 연동](./otel-instrumentation)을 사용하세요.
Linux kernel 5.8+ 및 BTF가 필요합니다. eBPF Observer는 높은 권한이 필요하므로 허용할 수 없는
환경에서는 `everyup-ebpf` 서비스를 제거할 수 있습니다. 이 경우에도 로그, 상태, 이벤트,
호스트 메트릭은 계속 동작합니다.

## 동작 방식

번들 Compose는 [OpenTelemetry eBPF Instrumentation(OBI)](https://opentelemetry.io/docs/zero-code/obi/)을
쓰는 `everyup-ebpf` 서비스를 시작합니다. Docker/OCI 컨테이너 안의 프로세스를 자동으로 고르므로
앱 포트 설정, 앱 수정, 서비스 재시작이 필요 없습니다. Go와 HTTPS 트래픽을 포함해 지원하는
런타임 전반에서 실제 SERVER span(method, path, status, **latency**)을 수집합니다.

OBI는 `everyup.source=ebpf` 태그를 붙여 span을 Docker Collector의 OTLP 게이트웨이로 보냅니다.
Collector는 계측된 프로세스의 PID를 Docker로 확인해 span을 서비스에 연결하고 이름을 바꿉니다.
호스트 프로세스, Observer 자신, 오래된 PID처럼 매칭되지 않는 span은 버려서, 존재하지 않는 서비스가
목록에 생기지 않게 합니다. 실제 span이 들어오는 서비스는 access log로 만든 합성 span을 더 이상
받지 않으므로 중복 집계되지 않습니다.

## 참고

- `/sys/kernel/btf/vmlinux`가 있는 Linux kernel 5.8+가 필요합니다. Docker Desktop VM도
  조건을 만족합니다.
- 현재 eBPF 배포 방식은 `privileged`와 `pid: host` 권한이 필요합니다. 높은 권한의 Observer는
  일반 Docker Collector와 분리되어 있습니다. 호스트에서 허용할 수 없다면 제거하세요. 나머지
  기능은 그대로 동작합니다.
- 기본 OBI 정책은 헤더와 바디를 캡처하지 않습니다. 헤더와 바디가 필요하면
  [앱 측 OpenTelemetry](./otel-instrumentation)를 사용하세요.
- 새로 시작하거나 재시작한 서비스는 Collector가 PID 정보를 갱신할 때까지(check 주기 1회)
  처음 몇 초의 span이 빠질 수 있습니다.
- OBI는 Compose 파일에 검증된 릴리스로 고정되어 있습니다. 대상 kernel과 PID 연결 동작을
  검증한 뒤에만 올리세요.
