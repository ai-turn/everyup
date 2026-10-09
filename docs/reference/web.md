---
outline: [2, 3]
pageClass: reference-page
---

# Web 설정

EveryUp Web은 대시보드이자 API 서버입니다. 모니터링 이력을 저장하고, 사용자를 관리하며,
Docker Collector 데이터와 OTLP 데이터를 받고, 설정한 알림 규칙에 따라 알림을 보냅니다.

## 설치

저장소를 clone하지 않고 Compose 파일만 받아 실행할 수 있습니다.

```bash
mkdir everyup && cd everyup
curl -O https://raw.githubusercontent.com/ai-turn/everyup/main/web/docker-compose.yml
docker compose up -d
```

브라우저에서 `http://<대시보드 서버 IP>:3001`(같은 서버라면 `http://localhost:3001`)을 열고 첫 관리자 계정을 만드세요. 이 Compose 파일은 Web만
실행합니다. 모니터링할 Docker 호스트에는 [Quick Start](../guide/quickstart)의 안내대로
Docker Collector를 설치하세요.

## 환경변수

기본 구성은 환경변수 없이 동작합니다. 아래 변수는 운영 배포, 네트워크, 자동화에 필요할 때
지정합니다. 우선순위는 환경변수 > `config.json` > 기본값입니다.

### 서버

- **`EVERYUP_PUBLIC_URL`**\
  사용자와 모니터링 대상 서버가 Web에 접속하는 외부 주소. Docker 설치 명령, 직접 OTLP 연결, 인프라 Collector 설정에 사용합니다. 자격증명·쿼리·fragment가 없는 절대 http(s) 주소여야 합니다
- **`EVERYUP_SERVER_HOST`** · 기본값 `0.0.0.0`\
  바인딩 주소
- **`EVERYUP_SERVER_PORT`** · 기본값 `3001`\
  대시보드·API 포트
- **`EVERYUP_SERVER_MODE`** · 기본값 `production`\
  `development`로 설정하면 상세 에러와 스택 트레이스를 반환합니다
- **`EVERYUP_SERVER_ALLOWORIGINS`**\
  CORS 허용 origin. 프론트엔드를 다른 도메인에서 제공할 때 지정합니다(예: `https://app.example.com`)
- **`EVERYUP_DATABASE_PATH`** · 기본값 `./data/monitoring.db`\
  SQLite 파일 경로. Docker 이미지는 `/app/data`를 보존합니다

### 보안과 계정

- **`EVERYUP_ENCRYPTION_KEY`** · 기본값 자동 생성\
  secret(Docker Collector API Key, 알림 채널)을 암호화하는 64자 hex(32바이트) AES 키. **운영 환경에서는 지정하세요.** 지정하지 않으면 키를 생성해 데이터 디렉터리에 저장하므로, DB만 복원하면 secret을 풀 수 없습니다 ([백업·복원](../guide/backup-restore))
- **`EVERYUP_ADMIN_USERNAME`**\
  시작할 때 설정 화면 없이 첫 관리자를 생성합니다(headless 프로비저닝)
- **`EVERYUP_ADMIN_PASSWORD`**\
  `EVERYUP_ADMIN_USERNAME`과 함께 필요합니다. 8자 이상

### 보존 기간

- **`EVERYUP_RETENTION_METRICS`** · 기본값 `7d`\
  health check 메트릭
- **`EVERYUP_RETENTION_LOGS`** · 기본값 `3d`\
  로그
- **`EVERYUP_RETENTION_SYSTEMMETRICS`** · 기본값 `7d`\
  호스트 메트릭
- **`EVERYUP_RETENTION_APIREQUESTSDAYS`** · 기본값 `14`\
  API 요청(일)
- **`EVERYUP_RETENTION_SPANSDAYS`** · 기본값 `7`\
  트레이스(일)
- **`EVERYUP_RETENTION_BODYCAPTUREDAYS`** · 기본값 `7`\
  캡처한 요청/응답 바디와 바디 열람 audit 기록(일). 기간이 지나면 바디만 지우고 트레이스는 남깁니다
- **`EVERYUP_RETENTION_OTELMETRICSDAYS`** · 기본값 `7`\
  OTLP 메트릭(일)

### 알림

- **`EVERYUP_ALERTS_CONSECUTIVEFAILURES`** · 기본값 `3`\
  서비스를 down으로 표시하기 전 연속 실패 횟수
- **`EVERYUP_ALERTS_LOGALERTCOOLDOWN`** · 기본값 `5`\
  같은 로그 알림을 다시 보내기까지의 최소 간격(분)

### Web 호스트 메트릭

Web이 실행 중인 호스트 자체의 메트릭 수집 설정입니다. 다른 서버의 메트릭은 Docker
Collector가 수집합니다.

- **`EVERYUP_SYSTEM_ENABLED`** · 기본값 `true`\
  수집 여부
- **`EVERYUP_SYSTEM_COLLECTINTERVAL`** · 기본값 `5`\
  수집 주기(초). 환경설정 화면에서도 바꿀 수 있습니다
- **`EVERYUP_SYSTEM_STOREINTERVAL`** · 기본값 `60`\
  저장 주기(초)

## API 개요

기본 prefix는 `/api/v1`입니다.

| 영역 | 예시 |
| --- | --- |
| Health·인증 | `GET /health`, `POST /auth/login`, `GET /auth/me` |
| 모니터링 | `GET /services`, `GET /hosts`, `GET /dashboard/summary` |
| 로그·트레이스 | `GET /logs`, `POST /otlp/v1/logs`, `POST /otlp/v1/traces` |
| 알림 | `GET /notifications/channels`, `GET /alert-rules` |
| Docker Collector 동기화 (`/agents` 호환 API) | `POST /agents/enroll`, `POST /agents/:agentId/services`, `POST /agents/:agentId/events`, `POST /agents/:agentId/metrics` |
| Docker 서비스 상세 | `GET /agents/services/all`, `GET /agents/:agentId/services/:key/history`, `GET /agents/:agentId/services/:key/uptime`, `GET /agents/:agentId/services/:key/logs`, `GET /agents/:agentId/services/:key/requests` |

Docker Collector 동기화와 OTLP 수집에는 Web의 **Docker 환경 → Docker 연결**에서 Docker 환경마다
발급하는 API Key를 사용합니다. 이 키는 Collector가 보관하며, 모니터링 대상 앱에는 필요하지
않습니다.
