# 백업과 복원

기본 Docker 배포에서 EveryUp 데이터는 `/app/data` 아래에 저장됩니다.

이 디렉터리에는 다음 파일이 들어갑니다.

- SQLite 데이터베이스인 `monitoring.db`
- `EVERYUP_ENCRYPTION_KEY`를 지정하지 않은 설치에서 자동 생성되는 암호화 키 파일 `.encryption_key`

`EVERYUP_ENCRYPTION_KEY`를 설정했다면 해당 키도 배포에 쓰는 비밀값과 함께 보관하거나 백업 절차에 포함하세요. 일치하는 키가 없으면 데이터베이스만 복원해도 암호화된 값을 다시 읽지 못할 수 있습니다.

## 백업

SQLite 파일을 함께 복사할 수 있도록 데이터 디렉터리를 복사하기 전에 컨테이너를 중지합니다.

```bash
docker stop everyup
docker cp everyup:/app/data/. ./everyup-data-backup
docker start everyup
```

저장소에 포함된 Docker Compose 파일도 기본 서비스와 컨테이너 이름이 `everyup`이므로 같은 명령을 사용할 수 있습니다.

## 복원

EveryUp 컨테이너를 중지한 상태에서 데이터를 복원한 뒤 다시 시작합니다.

```bash
docker stop everyup
docker cp ./everyup-data-backup/. everyup:/app/data/
docker start everyup
```

복원 후에는 로그인한 뒤 암호화된 값을 사용하는 저장된 연동 설정이나 알림 채널을 하나 이상 확인하세요. `EVERYUP_ENCRYPTION_KEY`를 사용한 배포를 복원할 때는 백업을 만들 때 사용한 같은 키 값으로 시작해야 합니다.
