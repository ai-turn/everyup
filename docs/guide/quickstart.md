# 빠른 시작

대시보드 서버에 Web을 띄우고, 모니터링할 서버에 모니터링 번들(Docker Collector와 필요한 구성
요소)을 설치하는 가장 작은 구성입니다. 서버가 한 대라면 둘을 같은 서버에서 실행해도 됩니다.
4단계에서 Docker 환경이 **수집 중**으로 바뀌면 완료입니다.

## 준비물

- **대시보드 서버**: Docker와 Docker Compose
- **모니터링할 서버**: Linux, Docker Engine, Docker Compose 2.23.1 이상, `curl`, `sudo` 권한.
  Compose 버전은 `docker compose version`으로 확인하세요.
- **네트워크**: 모니터링할 서버에서 대시보드 서버의 `3001` 포트(또는 `EVERYUP_PUBLIC_URL`로
  지정한 주소)에 접속할 수 있어야 합니다.

## 1. Web 실행

대시보드 서버에서 Compose 파일을 받아 실행합니다.

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

::: details 받은 Compose 파일의 내용
[`web/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/web/docker-compose.yml)은 다음과 같습니다.

```yaml
services:
  everyup:
    image: aiturn/everyup:latest
    container_name: everyup
    environment:
      EVERYUP_PUBLIC_URL: ${EVERYUP_PUBLIC_URL:-}
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
:::

브라우저에서 `http://<대시보드 서버 IP>:3001`을 열고 첫 관리자 계정을 만듭니다.

::: warning 외부 접속 주소가 따로 있다면
사용자나 모니터링할 서버가 다른 주소(예: `https://monitor.example.com`)로 Web에 접속한다면,
`docker compose up -d` 전에 셸이나 `.env`에 `EVERYUP_PUBLIC_URL`을 지정하세요. EveryUp은 이
주소를 Docker 설치 명령, 직접 OTLP 연결, 인프라 Collector 설정에 넣습니다. 그래서 대상 서버에서
접근할 수 있는 절대 HTTP(S) 주소여야 하며, **`localhost`는 쓸 수 없습니다**.
지정하지 않으면 연결 화면이 브라우저가 접속한 주소를 제안하고, 그 화면에서 고칠 수도 있습니다.
:::

## 2. Docker 연결 명령 만들기

대시보드의 **Docker 환경** 화면에서 오른쪽 위의 **Docker 연결**을 누릅니다. 환경 이름을 정하고
수집 범위를 고르세요.

- **전체**: 업타임, 로그, 인프라, API 요청, 메트릭을 한 번에 설정합니다.
- **기본**: Docker 서비스 상태와 로그만 수집합니다.
- **사용자 지정**: 필요한 기능만 골라 권한과 Collector를 최소화합니다.

::: details 사용자 지정 프로필에서 업타임을 빼는 경우
Docker 상태 수집(업타임)을 선택하지 않은 프로필(예: 메트릭 전용)에서 앱 데이터를 Collector의
OTLP 게이트웨이(`:4318`)로 보낸다면 서비스별 bearer 토큰이 필요합니다. 앱마다 토큰을 발급해
`Authorization` 헤더에 설정하세요. 발급 명령과 설정 예시는
[Collector 네트워킹 안내](../reference/collector#networking)에 있습니다.
:::

선택을 마치면 설치 명령이 표시됩니다. 명령은 다음과 같은 형태입니다.

```bash
curl -fsSL 'https://<Web 주소>/api/v1/agents/install.sh' | sudo sh -s -- 'https://<Web 주소>' '<연결 코드>'
```

::: warning 연결 코드는 10분 동안 한 번만 쓸 수 있습니다
코드가 만료되었거나 이미 사용했다면 설치 화면에서 **새 코드**를 눌러 다시 발급하세요.
장기 API Key는 브라우저에 표시되지 않고, 설치 과정에서 대상 서버로 직접 전달됩니다.
:::

## 3. 모니터링 번들 설치

화면에 표시된 명령을 복사해 모니터링할 Linux Docker 서버에서 실행합니다.

설치기는 Docker와 Compose 버전을 확인한 뒤 `/opt/everyup-agent`에 설정을 만들고, 선택한 수집
범위에 필요한 구성 요소만 시작합니다. 기존 설정이 있으면 덮어쓰기 전에 백업합니다. 앱의
Compose 파일, 이미지, 포트, 컨테이너는 바꾸지 않습니다.

- **전체** 프로필이나 API 요청 수집을 포함한 사용자 지정 프로필은 Docker Collector와 권한이
  분리된 [eBPF Observer](./ebpf-observer)(OBI)를 함께 실행합니다. eBPF Observer는 앱을 고치지 않고
  API 요청의 latency와 트레이스를 수집하는 구성 요소입니다.
- **기본** 프로필은 eBPF Observer 없이 Docker 서비스 상태와 로그만 수집합니다.

설치기 없이 직접 구성하려면
[`agent/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/agent/docker-compose.yml)과
[Docker Collector 설정](../reference/collector)을 참고하세요.

## 4. 연결 확인

약 30초 안에 **Docker 환경** 화면에서 해당 환경이 **설치 대기**에서 **수집 중**으로 바뀝니다.
업타임 수집을 선택했다면 그 서버의 컨테이너도 서비스로 나타납니다.

![Docker 환경 화면. prod-server 카드는 수집 중, staging-api 카드는 설치 대기 상태이고, 오른쪽 위에 Docker 연결 버튼이 있다.](/images/quickstart-docker-env-ko.png)

<p class="screenshot-caption"><strong>수집 중</strong>이면 연결된 것이고, <strong>설치 대기</strong>면 아직 Collector가 연결되지 않은 것입니다.</p>

API 요청 수집을 선택했다면 eBPF Observer가 컨테이너 프로세스를 자동으로 찾으므로 포트 목록을
관리할 필요가 없습니다. 시간이 지나도 **설치 대기**에 머문다면
[트러블슈팅](./troubleshooting#not-collecting)을 확인하세요.

## 다음 단계

- [모니터링 설정](./monitoring-setup): 수집 상태 진단, 기존 환경에 기능 추가, OpenTelemetry 직접 연결
- [자동 eBPF Observer](./ebpf-observer): API latency와 트레이스
- [헤더·바디 상세 수집](./otel-instrumentation): 요청이 실패한 이유까지 진단
- [알림 채널](./notifications): Telegram, Discord, Slack으로 장애 알림 받기
