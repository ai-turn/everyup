# 트러블슈팅

각 항목은 **증상 → 확인 → 해결** 순서입니다. 명령마다 어느 서버에서 실행하는지 적어 두었습니다.
설치를 처음부터 다시 하고 싶다면 [업그레이드·제거](./upgrade-uninstall#reinstall)를 참고하세요.

## 대시보드가 열리지 않습니다 {#web-not-reachable}

**증상**: 브라우저에서 `http://<대시보드 서버 IP>:3001`이 열리지 않거나 오류가 납니다.

**확인** (대시보드 서버의 `everyup` 디렉터리에서):

```bash
docker compose ps                # STATUS가 healthy인지 확인
docker logs everyup --tail 100   # 시작 오류 확인
curl -fsS http://localhost:3001/api/v1/health
```

**해결**:

- `curl`이 성공하는데 브라우저에서만 안 열린다면 방화벽이나 보안 그룹에서 `3001` 포트를 여세요.
- 컨테이너가 계속 재시작한다면 로그의 첫 오류를 확인하세요. 환경변수 값이 잘못된 경우가 많습니다.
  값은 [Web 설정](../reference/web)에서 확인할 수 있습니다.

## 설치기가 Compose 버전 때문에 멈춥니다 {#compose-version}

**증상**: 설치 명령이 `Docker Compose v2.23.1 or newer is required`로 끝납니다.

**확인** (모니터링할 서버에서):

```bash
docker compose version
```

**해결**: Docker Compose 플러그인을 2.23.1 이상으로 업데이트하세요. 패키지로 Docker를 설치했다면
보통 `docker-compose-plugin` 패키지를 업데이트하면 됩니다. 단독 실행형 `docker-compose`(v1)는
지원하지 않습니다.

## 설치기가 Docker에 접근하지 못합니다 {#docker-access}

**증상**: 설치 명령이 `Docker Engine is not reachable.` 또는
`/var/run/docker.sock is not readable.`로 끝납니다.

**확인** (모니터링할 서버에서):

```bash
sudo docker info --format '{{.ServerVersion}}'
ls -l /var/run/docker.sock
```

**해결**:

- 설치 명령은 `sudo sh`로 실행해야 합니다. Web이 보여 준 명령을 그대로 복사했는지 확인하세요.
- `docker info`가 실패한다면 Docker 데몬이 꺼져 있는 것입니다. `sudo systemctl start docker`로
  시작하세요.

## 연결 코드 오류로 설치가 실패합니다 {#join-code}

**증상**: `Exchanging the one-time EveryUp join code...` 다음에
`curl: (22) The requested URL returned error: 401`이 나옵니다.

**해결**: 연결 코드는 발급 후 10분 동안 한 번만 쓸 수 있습니다. 설치 화면에서 **새 코드**를 눌러
명령을 다시 만들고 실행하세요. 이전 명령을 다시 실행하면 같은 오류가 납니다.

## 모니터링할 서버에서 Web에 접속하지 못합니다 {#web-unreachable-from-target}

**증상**: 설치 명령이 `curl: (7) Failed to connect` 또는 `curl: (28) … timed out`으로 끝납니다.

**확인** (모니터링할 서버에서, 설치 명령에 들어 있는 Web 주소로):

```bash
curl -fsS https://<Web 주소>/api/v1/health
```

**해결**:

- 접속이 안 되면 대시보드 서버의 방화벽이나 보안 그룹에서 `3001` 포트(또는 리버스 프록시
  포트)를 여세요.
- 명령에 들어 있는 주소가 `localhost`나 내부 전용 주소라면 Web을
  [`EVERYUP_PUBLIC_URL`](./quickstart#public-url)로 다시 시작한 뒤 설치 명령을 새로 만드세요.

## Docker 환경이 수집 중으로 바뀌지 않습니다 {#not-collecting}

**증상**: 설치는 끝났지만 **Docker 환경** 화면에서 **설치 대기**에 머뭅니다.

**확인** (모니터링할 서버에서):

```bash
sudo docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml ps
sudo docker logs everyup-agent --tail 50
sudo grep EVERYUP_WEB_BASE_URL /opt/everyup-agent/compose.yaml
```

**해결**: Collector는 `EVERYUP_WEB_BASE_URL`로 Web에 접속합니다. 이 주소는 Collector 컨테이너
안에서 접근할 수 있어야 합니다. 같은 서버라도 컨테이너 안의 `localhost`는 Web이 아니라 Collector
자신을 가리킵니다. Compose 서비스명이나 호스트에서 접근 가능한 IP로 고친 뒤 다시 시작하세요.

```bash
sudo docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml up -d
```

## Docker Collector가 Docker 소켓을 읽지 못합니다 {#docker-socket}

**증상**: `everyup-agent` 로그에 `query docker socket … permission denied`가 보이고 서비스가 나타나지 않습니다.

**해결**: 한 줄 설치기는 Docker 소켓의 group ID를 감지해 `EVERYUP_DOCKER_GID`를 자동으로
기록합니다. 수동 배포라면 이 값을 `stat -c '%g' /var/run/docker.sock` 결과로 설정하고
`group_add`에 추가하세요. `user: "0:0"`은 잠깐 진단할 때만 사용하세요. 운영 환경에서 소켓 접근
권한을 좁히려면
[Docker socket proxy 가이드](https://github.com/ai-turn/everyup/blob/main/agent/docs/docker-socket-proxy.md)를 사용하세요.

## 로그가 보이지 않습니다 {#no-logs}

**증상**: 서비스는 보이지만 로그 탭이 비어 있습니다.

**확인** (모니터링할 서버에서):

```bash
docker logs <앱 컨테이너> --tail 20
```

**해결**: 여기서도 아무것도 나오지 않는다면 앱이 컨테이너 안의 파일에만 로그를 쓰는 것입니다.
Docker 로그로 보이지 않는 로그는 Docker Collector도 수집할 수 없습니다. 앱이나 프록시 로그를
stdout/stderr로 출력하세요.
