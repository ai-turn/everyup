# 백업·복원

아래 명령은 EveryUp Web 컨테이너가 실행되는 **대시보드 서버에서** 실행하세요.
기본 Docker 배포에서 `/app/data`는 Web 컨테이너 안의 데이터 디렉터리입니다.

이 디렉터리에는 다음 파일이 들어갑니다.

- SQLite 데이터베이스인 `monitoring.db`
- `EVERYUP_ENCRYPTION_KEY`를 지정하지 않은 설치에서 자동 생성되는 암호화 키 파일 `.encryption_key`

`EVERYUP_ENCRYPTION_KEY`를 설정했다면 데이터 디렉터리와 함께 해당 키도 별도로 보관하세요.
같은 키가 없으면 데이터베이스를 복원해도 저장된 Bot Token·Webhook URL 등을 복호화할 수 없습니다.

## 백업

복사하는 동안 데이터베이스가 바뀌지 않도록, 데이터 디렉터리를 복사하기 전에 컨테이너를 중지합니다.
백업은 명령을 실행한 현재 디렉터리의 `everyup-data-backup`에 저장합니다.

```bash
docker stop everyup
docker cp everyup:/app/data/. ./everyup-data-backup
docker start everyup
```

저장소에 포함된 Docker Compose 파일도 기본 서비스와 컨테이너 이름이 `everyup`이므로 같은 명령을 사용할 수 있습니다.

## 복원

백업 디렉터리를 대시보드 서버에 준비하세요. `EVERYUP_ENCRYPTION_KEY`를 사용했다면
복원 전에 백업 당시와 같은 키를 설정하세요. 컨테이너를 중지하고 데이터를 복원한 뒤 다시 시작합니다.

```bash
docker stop everyup
docker cp ./everyup-data-backup/. everyup:/app/data/
docker start everyup
```

복원한 뒤에는 로그인해서 알림 채널 목록의 **테스트** 버튼으로 알림 전송을 확인하세요.
암호화 키가 맞지 않으면 채널에 저장된 Bot Token과 Webhook URL을 읽지 못합니다.
