# 트러블슈팅

## Docker 환경이 online으로 뜨지 않습니다

`EVERYUP_WEB_BASE_URL`은 Docker Collector 컨테이너 안에서 접근 가능한 Web 주소여야 합니다.
같은 서버라도 컨테이너 안의 `localhost`는 Web이 아니라 Collector 자신을 가리킬 수
있습니다. Compose 서비스명이나 호스트에서 접근 가능한 IP를 사용하세요.

## Docker Collector가 Docker 소켓을 읽지 못합니다

권한 문제입니다. 한 줄 설치기는 Docker 소켓의 group ID를 감지해
`EVERYUP_DOCKER_GID`를 자동으로 기록합니다. 수동 배포라면 이 값을
`stat -c '%g' /var/run/docker.sock` 결과로 설정하고 `group_add`에 추가하세요.
`user: "0:0"`은 짧은 진단 용도로만 사용하세요. 운영 환경에서 소켓 접근 권한을 좁히려면
[Docker socket proxy 가이드](https://github.com/ai-turn/everyup/blob/main/agent/docs/docker-socket-proxy.md)를 사용하세요.

## 로그가 보이지 않습니다

컨테이너 안의 파일에만 쓰는 로그는 Docker 로그로 보이지 않으므로 Docker Collector도 수집할
수 없습니다. 앱이나 프록시 로그를 stdout/stderr로 출력하세요.

## 운영 배포 시 백업

`/app/data`를 백업하세요. `EVERYUP_ENCRYPTION_KEY`를 설정했다면 같은 64자 hex
키를 배포 secret과 함께 보관해야 합니다. 키 없이 데이터베이스 백업만으로는
암호화된 Docker Collector API Key나 알림 secret을 복원할 수 없습니다.
자세한 내용은 [백업·복원 가이드](./backup-restore)를 참고하세요.
