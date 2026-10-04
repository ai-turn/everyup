# 빠른 시작

Web 1개와 모니터링 번들 1개를 Docker Compose로 실행하는 가장 작은 구성입니다.
단일 서버라면 둘을 같은 서버에서 실행해도 됩니다. Compose 템플릿은
[`web/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/web/docker-compose.yml)과
[`agent/docker-compose.yml`](https://github.com/ai-turn/everyup/blob/main/agent/docker-compose.yml)에 있습니다.

## 1. Web 실행

대시보드 서버에서 `docker-compose.yml`을 작성합니다.

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

```bash
docker compose up -d
```

`http://WEB_SERVER_IP:3001`을 열고 첫 관리자 계정을 만들면 완료입니다.

외부에서 접속할 별도 주소가 있다면 셸이나 `.env`에
`EVERYUP_PUBLIC_URL=https://monitor.example.com`을 지정하세요. 위 Compose 예제와 저장소의
Compose 파일이 이 값을 Web 컨테이너에 전달합니다. EveryUp은 이 주소를 Docker 설치 명령,
직접 OTLP 연결, 인프라 Collector 설정에 공통으로 사용합니다. 값을 생략하면 브라우저가
접속한 API 주소를 기준으로 제안하며, 연결 화면에서 직접 수정할 수도 있습니다. 대상
서버에서 접근 가능한 절대 HTTP(S) 주소를 사용해야 하며 `localhost`는 사용할 수 없습니다.

## 2. Docker 연결 명령 만들기

대시보드에서 **Docker 환경**을 열고 **Docker 연결**을 누릅니다. 환경 이름을 정한 뒤
수집 범위를 선택하세요.

- **전체**: 업타임, 로그, 인프라, API 요청, 메트릭을 한 번에 설정합니다.
- **기본**: Docker 서비스 상태와 로그만 수집합니다.
- **사용자 지정**: 필요한 기능만 골라 권한과 Collector를 최소화합니다.

Docker 상태 수집(업타임)을 선택하지 않은 사용자 지정 프로필(예: 메트릭 전용)에서
앱 데이터를 Collector의 OTLP 게이트웨이(`:4318`)로 보낸다면 서비스별 bearer 토큰이
필요합니다. 앱마다 토큰을 발급해 `Authorization` 헤더에 설정하세요. 발급 명령과
설정 예시는 [Collector 네트워킹 안내](../reference/collector#networking)에 있습니다.

선택을 마치면 10분 동안 한 번만 사용할 수 있는 설치 명령이 표시됩니다. 장기 API Key는
브라우저에 노출되지 않고 설치 과정에서 대상 서버로 직접 전달됩니다.

## 3. 모니터링 번들 설치

설치기는 선택한 수집 범위에 필요한 구성만 실행합니다. **전체** 프로필이나 API 요청 수집을
포함한 사용자 지정 프로필에서는 Docker Collector와 권한이 분리된 eBPF Observer(OBI)를 함께
실행합니다. **기본** 프로필은 eBPF Observer 없이 Docker 서비스 상태와 로그만 수집합니다.
앱의 Compose 파일, 이미지, 포트, 컨테이너는 바꾸지 않습니다. Docker Compose 2.23.1
이상이 필요합니다.

표시된 명령 한 줄을 대상 Linux Docker 서버에서 실행합니다. 설치기는 Docker와
Compose 버전을 먼저 확인한 후 `/opt/everyup-agent`에 설정을 만들고, 선택한 수집 범위에
맞는 구성 요소를 시작합니다. 기존 설정이 있으면 덮어쓰기 전에 백업합니다.

연결 코드가 만료되거나 이미 사용됐다면 Docker 설치 화면에서 **새 코드**를 눌러 다시
발급할 수 있습니다.

약 30초 안에 Web에서 Docker 환경이 online으로 표시됩니다. 업타임 수집을 선택했다면
그 서버의 컨테이너도 자동으로 나타납니다. API 요청 수집을 선택했다면 eBPF Observer가 컨테이너
프로세스를 자동으로 찾으므로 포트 목록을 관리할 필요가 없습니다. 문제가 생기면
[트러블슈팅](./troubleshooting)을 참고하세요.

Docker Collector는 마운트된 Docker 소켓으로 컨테이너·로그에 접근하므로 자체
Compose 프로젝트에서도 동작합니다. 가장 깔끔한 구성은 `everyup-agent`를 그
서버의 앱 스택과 같은 Compose 파일에 두는 것입니다.

## 모니터링 설정 가이드

Docker 환경 화면의 **모니터링 설정 가이드**가 Collector 연결, 기본 수집, API 요청 자동 수집을
순서대로 진단합니다. Java·Node.js 서비스가 발견되면 같은 가이드에서 선택 기능인
헤더·바디 상세 수집까지 바로 이어서 설정할 수 있습니다.

로그·API·메트릭·인프라 메뉴의 **연결** 버튼에서는 등록된 대상을 이어 쓰거나 새 대상을
연결할 수 있습니다. 기존 Docker 환경에 기능을 추가하면 ID·키·Project·수집 이력은
유지되고, 새 적용 명령이 발급됩니다. 이 명령을 해당 서버에서 실행하면 선택한 기능이
Docker 환경 전체에 적용됩니다.

직접 OpenTelemetry로 연결한 서비스는 기존 ID와 API Key를 유지한 채 필요한 데이터 권한만
추가합니다. 이후 안내에 따라 앱 또는 Collector 설정을 갱신하고 데이터를 발생시켜 수신
여부를 확인하세요.

설정 가이드는 최근 2분 내 Collector 통신과 요청한 수집 범위의 적용 확인을 구분합니다.
로그·트레이스·메트릭·인프라는 실제 저장된 데이터의 최초·마지막 수신 시각을 기록하고
5초마다 화면에서 확인합니다. 마지막 수신 후 10분이 지나면 **수집 지연**, 아직 한 번도
수신하지 않았다면 **수신 대기**로 표시합니다. 이 표시는 수신 이력에 근거하므로 현재 연결이
항상 정상이라는 보장은 아닙니다.
구버전 Collector는 통신하더라도 설정 적용 확인이 대기 상태일 수 있으므로 최신 설치 명령으로
업데이트하세요. DB 마이그레이션 이전 데이터의 수신 기록은 소급 생성하지 않습니다.

각 메뉴의 연결 화면은 기존 대상 선택과 Docker 설치를 한곳에서 안내합니다. 로그·API·메트릭은
앱을 OpenTelemetry로 직접 연결할 수 있고, 인프라는 표준 OpenTelemetry Collector를 연결할
수 있습니다. 이미 설정된 대상은 수신 기록을 확인한 뒤 해당 데이터 화면으로 이동합니다.
직접 연결 화면은 기존 OTel 사용 여부와 Java·Node.js·Go 환경에 맞춰 설정 적용, 재시작,
데이터 발생, 수신 확인 순서를 안내합니다.

상세 수집은 적용할 Java·Node.js 서비스를 직접 선택한 뒤 **변경 사항 확인**으로
재시작 범위를 확인합니다. 서버의 `everyup-otel plan`으로 실제 Compose를 검증하고
적용 명령을 실행하면 실행별 적용·검증·복구 결과가 웹에 표시됩니다.
설정 검증과 새 트레이스 수신은 별도로 표시하며, 트래픽이 없다는 이유로 복구하지 않습니다.
자세한 내용은 [헤더·바디 상세 수집](./otel-instrumentation)을 참고하세요.
