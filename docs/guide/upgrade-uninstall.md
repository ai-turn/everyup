# 업그레이드·제거

Web과 Docker Collector는 `latest` 태그 이미지를 사용합니다. 업그레이드는 새 이미지를 받아
컨테이너를 다시 만드는 것이고, 수집한 데이터와 설정은 그대로 유지됩니다.

번들의 eBPF Observer(`everyup-ebpf`)는 검증된 버전에 고정되어 있어 `pull`로는 바뀌지 않습니다.
Web을 업그레이드한 뒤 그 Web에서 설치 명령을 다시 만들어 실행하면, 새 Web이 검증한 버전으로 바뀝니다.

## Web 업그레이드 {#upgrade-web}

**대시보드 서버에서** Quick Start에서 만든 `everyup` 디렉터리로 이동해 실행합니다.

```bash
cd everyup
docker compose pull
docker compose up -d
```

데이터는 `everyup-data` 볼륨에 있으므로 컨테이너를 다시 만들어도 남아 있습니다. 중요한 운영
환경이라면 업그레이드 전에 [백업](./backup-restore)을 만들어 두세요.

## 모니터링 번들 업그레이드 {#upgrade-bundle}

**모니터링할 서버에서** 실행합니다. 설치기가 만든 설정 파일은 root만 읽을 수 있으므로 `sudo`가
필요합니다.

```bash
cd /opt/everyup-agent
sudo docker compose --env-file .env -f compose.yaml pull
sudo docker compose --env-file .env -f compose.yaml up -d
```

수집 범위를 바꾸거나 설정을 새로 받고 싶다면 Web에서 설치 명령을 다시 만들어 실행해도 됩니다.
설치기는 기존 `compose.yaml`을 `compose.yaml.bak.<날짜시각>`으로 백업한 뒤 덮어씁니다.

## 모니터링 번들 제거 {#uninstall-bundle}

**모니터링할 서버에서** 다음 순서로 실행합니다.

1. [헤더·바디 상세 수집](./otel-instrumentation)을 적용한 앱이 있다면 먼저 원래 설정으로 되돌립니다.
   앱의 Compose 파일마다 실행하세요.

   ```bash
   sudo everyup-otel rollback ./docker-compose.yml
   ```

2. 컨테이너, 네트워크, Collector의 로컬 상태 볼륨을 삭제합니다.

   ```bash
   sudo docker compose --env-file /opt/everyup-agent/.env -f /opt/everyup-agent/compose.yaml down -v
   ```

3. 설정 디렉터리와 CLI를 삭제합니다.

   ```bash
   sudo rm -rf /opt/everyup-agent
   sudo rm -f /usr/local/bin/everyup-otel
   ```

앱의 Compose 파일, 이미지, 컨테이너는 설치할 때 바꾸지 않았으므로 따로 되돌릴 것이 없습니다.

대시보드에서도 정리하려면 **Docker 환경** 화면에서 해당 환경을 열고 **비활성화**를 누르세요. Collector
연결이 차단되고, 이미 수집한 데이터는 보존됩니다.

## Web 제거 {#uninstall-web}

**대시보드 서버에서** `everyup` 디렉터리로 이동해 실행합니다.

```bash
cd everyup
docker compose down
```

`docker compose down`은 컨테이너만 삭제하고 데이터 볼륨은 남깁니다. 같은 디렉터리에서 다시
`docker compose up -d`를 실행하면 이전 데이터 그대로 시작합니다.

::: danger 데이터까지 삭제하려면
`docker compose down -v`는 `everyup-data` 볼륨을 함께 삭제합니다. 수집한 모든 데이터, 계정,
알림 채널, 암호화 키가 지워지며 되돌릴 수 없습니다. 필요하면 먼저 [백업](./backup-restore)하세요.
:::

## 처음부터 다시 설치하기 {#reinstall}

설치 중 문제가 생겨 깨끗한 상태에서 다시 시작하려면 [모니터링 번들 제거](#uninstall-bundle)를
마친 뒤 Web에서 새 설치 명령을 만들어 실행하세요. 연결 코드는 한 번만 쓸 수 있으므로 이전
명령을 다시 실행하면 실패합니다.
