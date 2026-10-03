# 자동 eBPF Observer: API latency와 trace

기본 Docker Collector는 access log에서 method, path, status를 읽습니다. 실제 latency와
trace까지 볼 수 있도록 번들 Compose가 `everyup-ebpf`를 자동으로 실행합니다.
Docker/OCI 컨테이너에서 실행 중인 프로세스를 자동 발견하므로
`BEYLA_OPEN_PORT`나 앱 포트 설정이 필요하지 않습니다.

앱 코드, Dockerfile, 앱 컨테이너를 바꾸지 않습니다. 실제 Linux 호스트에서는
eBPF가 호스트 프로세스를 관찰해 trace를 만들고, Docker Collector가 각 span을 해당 Docker
서비스에 연결합니다. Docker Desktop에서는 PID 변환 제약으로 서비스 자동 연결이
되지 않을 수 있으므로, 이 경우 [앱 측 OpenTelemetry 연동](./otel-instrumentation)을 사용하세요.
Linux kernel 5.8+ 및 BTF가 필요합니다. 자세한 내용은
[agent/README.md](https://github.com/ai-turn/everyup/blob/main/agent/README.md#zero-code-tracing-ebpf-automatic)의
"Zero-Code Tracing"을 참고하세요. eBPF Observer는 높은 권한이 필요하므로 허용할 수 없는
환경에서는 `everyup-ebpf` 서비스를 제거할 수 있습니다. 이 경우에도 로그, 상태, 이벤트,
호스트 메트릭은 계속 동작합니다.

