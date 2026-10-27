# EveryUp 모니터링 대상 테스트 앱

EveryUp의 발견, eBPF, OpenTelemetry 계측, 민감정보 마스킹, 롤백을 실제로 확인하기
위한 작은 Node.js 24 + Java 21 앱입니다. Docker Desktop의 `amd64`와 ARM64 Linux
서버에서 같은 구성으로 실행됩니다.

| 서비스 | 주소 | 주요 검증 |
| --- | --- | --- |
| `node-api` | `http://127.0.0.1:18080` | trace, header, body 마스킹·잘림 |
| `java-api` | `http://127.0.0.1:18081` | Java agent 주입과 trace |
| `rollback-probe` | 외부 포트 없음 | 계측 실패 시 자동 복구 |

## 준비 사항

- Linux 서버 또는 WSL2 기반 Docker Desktop
- Docker Engine과 Docker Compose v2
- 온보딩 명령으로 설치해 실행 중인 EveryUp Docker 수집기
- Linux/WSL 환경의 `curl`

Docker 수집기와 `everyup-otel`은 Linux 컨테이너를 대상으로 하므로 전체 E2E 테스트는 Linux
또는 WSL에서 실행합니다. Windows PowerShell에서는 트래픽 생성만 별도로 실행할 수도
있습니다.

`obi-config.yaml`은 Docker 수집기 설치 시 사용하는 zero-code eBPF 발견 설정과 동일하며,
observer를 별도로 진단할 때 마운트해서 사용할 수 있습니다.

## 한 번에 테스트

이 디렉터리에서 다음을 실행합니다.

```bash
sh scripts/run-e2e.sh
```

계측된 프로세스가 시작에 실패할 때 직전 설정으로 자동 복구되는 것까지 확인하려면:

```bash
sh scripts/run-e2e.sh --with-auto-rollback
```

스크립트는 기준 앱 기동 → Node/Java 계측 → 상태·마운트·네트워크 검증 → 테스트
트래픽 생성 → 수동 롤백 검증 순서로 진행합니다. 테스트 중 EveryUp UI에서
`everyup-e2e:node-api`, `everyup-e2e:java-api` 서비스를 확인하세요.

다음 결과가 보여야 합니다.

- 정상 요청, 의도적인 HTTP 503, 약 350ms 지연 요청
- Node와 Java의 서버 span
- Node body 이벤트에서 `password`, `token`, `apiKey` 값 마스킹
- Node `/large` 응답 body 잘림 표시
- 호스트가 eBPF를 지원할 경우 eBPF 서비스·네트워크 관측

Java agent 자체는 body를 자동 수집하지 않으므로 Java body는 검증 대상에서
제외했습니다. Java trace와 header 계측은 검증합니다.

## 수동 테스트

```bash
docker compose up -d --build --wait node-api java-api
sh scripts/verify-baseline.sh

sudo everyup-otel apply ./compose.yaml --capture-bodies node-api=node java-api=java
sudo everyup-otel verify ./compose.yaml
sh scripts/verify-instrumentation.sh

sh scripts/generate-traffic.sh 10

sudo everyup-otel rollback ./compose.yaml
sh scripts/verify-baseline.sh
docker compose down
```

Windows에서 트래픽만 만들려면 다음을 사용합니다.

```powershell
.\scripts\generate-traffic.ps1 -Iterations 10
```

## ARM64 서버에서 실행

ARM 서버에 저장소를 clone한 뒤 SSH에서 같은 E2E 명령을 실행하면 됩니다. 포트는
기본적으로 `127.0.0.1`에만 열리므로 인터넷에 노출되지 않습니다. PC에서 접근하려면
SSH 터널을 권장합니다.

```bash
ssh -L 18080:127.0.0.1:18080 -L 18081:127.0.0.1:18081 user@your-server
```

실행 아키텍처는 아래처럼 확인할 수 있습니다.

```bash
docker compose exec node-api uname -m
docker compose exec java-api uname -m
```

문제가 생기면 `docker compose logs --tail=100 node-api java-api`와
`sudo everyup-otel status ./compose.yaml`을 먼저 확인하세요. eBPF를 사용할 수 없는
호스트에서도 Node/Java OpenTelemetry trace는 계속 동작해야 합니다.
