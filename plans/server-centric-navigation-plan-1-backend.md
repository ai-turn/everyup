# 서버 중심 개편 1단계: 백엔드 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직접 설정 대상(업타임 모니터, 앱, 인프라 리소스)을 소유하는 `servers` 엔티티와 그 API를 백엔드에 추가하되, 기존 프론트엔드가 수정 없이 계속 동작하게 한다.

**Architecture:** `servers` 테이블 하나와 세 대상 테이블의 `server_id` 컬럼으로 소속을 표현한다. 그룹 소속의 출처는 `servers.project_id` 하나이며, 대상 API의 `projectId`는 서버에서 읽어 온다. "이름과 그룹으로 서버를 찾고 없으면 만든다"는 규칙 하나를 마이그레이션과 대상 생성 API가 함께 사용한다.

**Tech Stack:** Go 1.24, Fiber v2, modernc.org/sqlite (`CGO_ENABLED=0`), 표준 `testing` 패키지.

**Spec:** `plans/server-centric-navigation-design.md` (5절이 이 계획의 범위이다. 6절 이후의 화면 작업은 2단계 계획에서 다룬다.)

이 문서는 세 단계 가운데 첫 번째이다. 2단계(프론트엔드 전환)와 3단계(정리와 문서)의 계획은 1단계가 끝나서 API가 확정된 뒤에 작성한다.

## Global Constraints

- 모든 명령은 `web/backend`에서 실행하고, 테스트는 `CGO_ENABLED=0 go test ...`로 실행한다.
- DB 연결 수가 1개이므로 `rows.Next()` 반복문 안에서 다른 쿼리를 실행하지 않는다. 먼저 전체 행을 슬라이스로 읽고 `rows.Close()`를 호출한 뒤에 다음 쿼리를 실행한다.
- 마이그레이션은 재실행해도 결과가 같아야 한다. 컬럼 추가는 `duplicate column name` 오류를 무시한다(`migrations.go`의 V49 구현 방식).
- 응답 형식은 기존과 같다: 성공은 `{"success": true, "data": ...}`, 실패는 `{"success": false, "error": {"code": "...", "message": "..."}}`.
- 직접 설정 대상은 세 종류이다: `services`에서 `type IN ('http','tcp')`인 행, `observed_services`의 모든 행, `hosts`에서 `collector_type = 'otel-collector'`인 행. 이 밖의 행(`services`의 `log`·`icmp`, 다른 `hosts`)은 건드리지 않는다.
- 이 단계가 끝난 뒤에도 기존 프론트엔드와 기존 테스트는 그대로 통과해야 한다. 기존 엔드포인트를 삭제하거나 응답 필드를 제거하지 않는다.
- 수집, OTLP 수신, 알림 평가 코드는 수정하지 않는다.
- 커밋은 작업마다 하나씩 만들고, `git add`에는 변경한 파일의 경로를 직접 지정한다. 작업 트리에는 이 작업과 무관한 변경(`pnpm-lock.yaml`, `web/frontend/.hallmark/`, `web/frontend/.impeccable/`)이 있으므로 `git add -A`나 `git add .`를 사용하지 않는다.
- 커밋 메시지는 `feat(server): ...` 형식의 영어 한 줄 제목을 쓰고, 마지막 줄에 `Co-Authored-By: Claude <noreply@anthropic.com>`를 넣는다.
- 새 주석은 영어로 쓰고, 왜 그렇게 했는지가 코드만으로 드러나지 않을 때만 쓴다.

## Review Focus

테스트가 없으면 놓치기 쉬운 입력이며, 각 항목의 테스트는 표시한 작업에 들어 있다.

1. **삭제된 그룹을 가리키는 `project_id`가 남아 있는 기존 DB.** 대상 테이블의 `project_id`에는 외래 키가 없다. 마이그레이션은 이런 값을 "그룹 없음"으로 취급해야 하고, 외래 키 오류로 서버 기동이 실패해서는 안 된다. (Task 1)
2. **이름 접미사의 충돌.** `web-01 (2)`라는 이름의 서버가 이미 있을 때 접미사를 붙이면 ` (3)`이 되어야 한다. (Task 1)
3. **그룹 삭제 시의 이름 충돌.** 그룹 A의 `web`과 그룹이 없는 `web`이 있을 때 그룹 A를 삭제해도 성공해야 하고, A에 있던 서버는 `web (2)`가 된다. (Task 6)
4. **같은 서버로의 이동.** 인프라 리소스의 수정 요청에 현재 소속 서버의 `serverId`를 넣으면 409가 아니라 정상 응답이어야 한다. (Task 5)
5. **그룹 변경으로 생기는 이름 충돌.** 서버의 그룹을 바꾼 결과 같은 그룹에 같은 이름이 생기면 500이 아니라 409 `SERVER_NAME_TAKEN`이어야 한다. (Task 2, Task 3)

## File Structure

| 파일 | 책임 |
|---|---|
| `internal/models/server.go` (신규) | `Server` 모델 |
| `internal/database/repository_server.go` (신규) | `migrateV58`, 서버 찾기 규칙, `ServerRepository` 전체 |
| `internal/database/migrations.go` | `migrateV58` 등록 |
| `internal/api/handlers/servers.go` (신규) | 서버 CRUD, 합치기, 삭제 핸들러 |
| `internal/api/routes.go` | `/servers` 라우트 |
| `internal/models/service.go`, `observed_service.go`, `infrastructure_resource.go`, `project.go` | `ServerID`, `ServerCount` 필드 |
| `internal/database/repository_service.go`, `repository_observed_service.go`, `repository_infrastructure_resource.go`, `repository_project.go` | `server_id` 읽기·쓰기, 그룹을 서버에서 읽기 |
| `internal/directtelemetry/manager.go`, `internal/infrastructure/manager.go` | 생성·수정 시 서버 연결 |
| `internal/api/handlers/services.go`, `observed_services.go`, `infrastructure_resources.go`, `projects.go`, `logs.go` | 요청의 `serverId` 처리, 오류 매핑 |
| `internal/database/repository_log_summary.go` | 로그 요약·패턴의 서버 범위 |
| `docs/adr/0011-*.md`, `CONTEXT.md` 등 | 결정 기록과 용어집 |

---

### Task 0: 브랜치 준비

- [ ] **Step 1: 최신 main에서 브랜치를 만든다**

```bash
git fetch origin main
git switch -c claude/server-centric-backend origin/main
```

작업 트리에 있던 무관한 변경(`pnpm-lock.yaml` 수정, 추적되지 않는 `web/frontend/.hallmark/`, `web/frontend/.impeccable/`)은 그대로 둔다. `git switch`가 `pnpm-lock.yaml` 때문에 거부되면 진행을 멈추고 보고한다.

- [ ] **Step 2: 기준 상태를 확인한다**

Run: `cd web/backend && CGO_ENABLED=0 go build ./... && CGO_ENABLED=0 go test ./... 2>&1 | tail -15`
Expected: 모든 패키지가 `ok` 또는 `no test files`. 실패하는 테스트가 있으면 목록을 기록하고 보고한다(이후 작업의 회귀와 구분하기 위함이다).

- [ ] **Step 3: 설계 문서와 계획을 커밋한다**

```bash
git add plans/server-centric-navigation-design.md plans/server-centric-navigation-plan-1-backend.md
git commit -m "docs(plans): server-centric navigation design and backend plan"
```

---

### Task 1: 서버 스키마, 서버 찾기 규칙, 기존 데이터 이전

**Files:**
- Create: `web/backend/internal/models/server.go`
- Create: `web/backend/internal/database/repository_server.go`
- Modify: `web/backend/internal/database/migrations.go` (`migrate()`의 `migrateV57` 호출 다음)
- Test: `web/backend/internal/database/migrations_v58_test.go` (`package database`)

**Interfaces:**
- Produces:

```go
// models/server.go
type Server struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	ProjectID   string    `json:"projectId,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// database/repository_server.go
func migrateV58() error

// resolveServerTx applies the find-or-create rule (spec 5.4) and returns the server id.
// projectID "" means no group. forInfra makes a matching server that already owns an
// otel-collector host ineligible, so a suffixed server is created instead.
func resolveServerTx(tx *sql.Tx, name, projectID string, forInfra bool, now time.Time) (string, error)

// nextFreeServerNameTx returns name, or name + " (2)", " (3)", ... — the first
// candidate not taken (case-insensitively, trimmed) within projectID.
func nextFreeServerNameTx(tx *sql.Tx, name, projectID string) (string, error)
```

스키마는 설계 문서 5.2절의 SQL을 그대로 사용한다(`servers` 테이블, `idx_servers_name_group` 표현식 고유 인덱스, 세 테이블의 `server_id` 컬럼, `idx_hosts_server_id` 부분 고유 인덱스).

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`migrations_v58_test.go`에 다음 테스트를 작성한다. 각 테스트는 `Connect(":memory:")`로 전체 스키마를 만든 뒤(`t.Cleanup`에서 `Close()`), `server_id`가 NULL인 행을 SQL로 직접 넣고 `migrateV58()`을 다시 호출한다. 필요한 컬럼은 `repository_*.go`의 INSERT 문을 참고한다.

| 테스트 | 준비 | 검증 |
|---|---|---|
| `TestMigrateV58GroupsTargetsWithSameNameAndProject` | 그룹 `P`. otel-collector 호스트 `web-01`(P), 앱 ` Web-01 `(P), http 모니터 `web-01`(P) | `servers` 행 1개, 이름 `web-01`, `project_id = P`. 세 대상의 `server_id`가 모두 그 서버 |
| `TestMigrateV58KeepsDifferentGroupsApart` | 앱 `api`(그룹 P), 앱 `api`(그룹 없음) | `servers` 행 2개, 각각 `project_id`가 P와 NULL |
| `TestMigrateV58SuffixesSecondInfrastructureResource` | otel-collector 호스트 `db` 2개(같은 그룹), 그리고 이름이 `db (2)`인 앱 1개(같은 그룹) | `servers` 행 2개(`db`, `db (2)`). 호스트 2개의 `server_id`가 서로 다르고, 앱의 `server_id`는 `db (2)` 서버 |
| `TestMigrateV58IgnoresDanglingProject` | `project_id = 'gone'`(projects에 없음)인 http 모니터 | 오류 없이 성공, 서버의 `project_id`는 NULL |
| `TestMigrateV58LeavesOtherRowsAlone` | `type = 'log'`인 services 행, `collector_type = ''`인 hosts 행 | 두 행의 `server_id`는 NULL, `servers` 행 0개 |
| `TestMigrateV58IsIdempotent` | 위 첫 번째 준비 | `migrateV58()`을 두 번 더 호출해도 `servers` 행 수와 각 대상의 `server_id`가 변하지 않음 |
| `TestMigrateV58LeavesNoDirectTargetWithoutServer` | 세 종류를 섞어 6개 | 세 조건(`services` http/tcp, `observed_services`, `hosts` otel-collector)에서 `server_id IS NULL`인 행이 0개 |

`TestMigrateV58SuffixesSecondInfrastructureResource`의 기대값은 처리 순서(호스트 → 앱 → 모니터)에서 나온다. 호스트 두 개가 먼저 처리되어 `db`와 `db (2)`가 만들어지고, 그다음에 처리되는 앱 `db (2)`는 같은 키의 서버 `db (2)`에 합류한다.

접미사 충돌은 `TestNextFreeServerNameSkipsTakenSuffix`로 따로 검증한다: 그룹 없는 서버 `db`와 `db (2)`가 있을 때 `nextFreeServerNameTx(tx, "db", "")`는 `db (3)`을 반환하고, 그룹 P를 넘기면 `db`를 반환한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/database/ -run 'MigrateV58|NextFreeServerName' -v`
Expected: 컴파일 오류(`migrateV58` 미정의).

- [ ] **Step 3: 구현한다**

`migrateV58`은 스키마를 만든 뒤 트랜잭션 하나에서 이전을 수행한다. 이전은 `server_id IS NULL`인 대상을 호스트, 앱, 모니터 순서로, 각 종류 안에서는 `created_at, id` 순서로 슬라이스에 읽어 온 뒤에 한 건씩 `resolveServerTx`를 호출하고 `server_id`를 기록한다. 대상의 `project_id`가 `projects`에 없으면 빈 문자열로 바꿔서 넘긴다. 서버 이름은 대상 이름의 앞뒤 공백을 제거한 값이다.

`resolveServerTx`의 조회 조건은 인덱스와 같은 표현식이어야 한다: `lower(trim(name)) = lower(trim(?)) AND COALESCE(project_id, '') = ?`. 일치하는 서버가 있고 (`forInfra`가 아니거나 그 서버에 otel-collector 호스트가 없으면) 그 서버를 반환한다. 그렇지 않으면 `nextFreeServerNameTx`가 준 이름으로 새 서버를 만든다(ID는 `uuid.NewString()`).

`migrate()`에 `migrateV58` 호출을 추가한다(오류 문구는 `v58 migration failed: %w`).

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/database/ -v 2>&1 | tail -30`
Expected: 새 테스트와 기존 마이그레이션 테스트가 모두 PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add web/backend/internal/models/server.go web/backend/internal/database/repository_server.go web/backend/internal/database/migrations.go web/backend/internal/database/migrations_v58_test.go
git commit -m "feat(server): servers table and backfill of direct targets (migrateV58)"
```

---

### Task 2: 서버 CRUD API

**Files:**
- Modify: `web/backend/internal/database/repository_server.go`
- Create: `web/backend/internal/api/handlers/servers.go`
- Modify: `web/backend/internal/api/routes.go` (프로젝트 라우트 다음)
- Test: `web/backend/internal/api/handlers/servers_test.go` (`package handlers_test`)

**Interfaces:**
- Consumes: Task 1의 `models.Server`, `resolveServerTx`, `nextFreeServerNameTx`.
- Produces:

```go
// database/repository_server.go
var (
	ErrServerMissing           = errors.New("server not found")
	ErrServerNameTaken         = errors.New("server name already exists in this group")
	ErrServerHasInfrastructure = errors.New("server already has an infrastructure resource")
)

type ServerRepository struct{}
func NewServerRepository() *ServerRepository
func (r *ServerRepository) GetAll() ([]models.Server, error)          // ORDER BY name
func (r *ServerRepository) GetByID(id string) (*models.Server, error) // nil, nil when missing
func (r *ServerRepository) Create(server *models.Server) error        // fills timestamps; ErrServerNameTaken
func (r *ServerRepository) Update(server *models.Server) error        // name, description, project; sql.ErrNoRows; ErrServerNameTaken

// api/handlers/servers.go
type ServerHandler struct{ /* ... */ }
func NewServerHandler(scheduler *checker.Scheduler) *ServerHandler
func (h *ServerHandler) GetAll(c *fiber.Ctx) error
func (h *ServerHandler) GetByID(c *fiber.Ctx) error
func (h *ServerHandler) Create(c *fiber.Ctx) error
func (h *ServerHandler) Update(c *fiber.Ctx) error
```

라우트: `GET /servers`, `POST /servers`, `GET /servers/:id`, `PUT /servers/:id` (`local` 그룹). `NewServerHandler`가 `scheduler`를 받는 이유는 Task 7의 삭제가 모니터의 예약을 취소해야 하기 때문이다.

요청 본문은 `{"name": string, "description"?: string, "projectId"?: string}`이다. 검증과 응답 코드는 다음과 같다.

| 조건 | 응답 |
|---|---|
| `name`이 공백 제거 후 비어 있거나 200자를 넘음 | 400 `VALIDATION_ERROR` |
| `projectId`가 존재하지 않는 그룹 | 400 `VALIDATION_ERROR`, 메시지 `group not found` |
| 같은 그룹에 같은 이름(대소문자·공백 무시)이 있음 | 409 `SERVER_NAME_TAKEN` |
| 없는 서버의 조회·수정 | 404 `NOT_FOUND` |
| 생성 성공 | 201, `data`는 `Server` |

이름 충돌은 고유 인덱스 위반을 `ErrServerNameTaken`으로 바꿔서 반환한다. 저장 전에 같은 표현식으로 조회해서 판정해도 되지만, 인덱스 위반 오류도 같은 오류로 매핑해야 한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`servers_test.go`에 `setupTestServer`, `setupAdmin`, `doRequest`, `authHeader`를 사용해서 다음을 작성한다(`projects_test.go`의 작성 방식을 따른다).

- `TestServerCRUD`
  - `POST /api/v1/servers {"name":" web-01 ","description":"front"}` → 201, `name == "web-01"`, `id`가 비어 있지 않음.
  - `GET /api/v1/servers` → 길이 1.
  - `GET /api/v1/servers/{id}` → 200, 같은 `id`.
  - 그룹을 하나 만든 뒤 `PUT /api/v1/servers/{id} {"name":"web-01","projectId":P}` → 200, `projectId == P`.
  - `PUT`에서 `projectId`를 생략 → 200, 응답에 `projectId`가 없음(그룹 해제).
  - `GET /api/v1/servers/missing` → 404, `error.code == "NOT_FOUND"`.
- `TestServerValidation`
  - `{"name":"  "}` → 400 `VALIDATION_ERROR`.
  - `{"name":"x","projectId":"nope"}` → 400.
  - 인증 헤더 없이 `GET /api/v1/servers` → 401.
- `TestServerNameIsUniqueWithinGroup`
  - `web` 생성 후 `{"name":"WEB "}` 생성 → 409 `SERVER_NAME_TAKEN`.
  - 그룹 P를 만들고 `{"name":"web","projectId":P}` 생성 → 201(다른 그룹).
  - P의 `web`을 `PUT`으로 그룹 없음으로 변경 → 409 `SERVER_NAME_TAKEN`.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'TestServer' -v`
Expected: 404 응답으로 인한 FAIL(라우트 없음).

- [ ] **Step 3: 저장소 메서드, 핸들러, 라우트를 구현한다**

핸들러의 오류 응답은 `projects.go`의 `agentBadRequest`, `internalError`와 같은 헬퍼를 사용한다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'TestServer' -v`
Expected: PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add web/backend/internal/database/repository_server.go web/backend/internal/api/handlers/servers.go web/backend/internal/api/handlers/servers_test.go web/backend/internal/api/routes.go
git commit -m "feat(server): server CRUD endpoints"
```

---

### Task 3: 업타임 모니터의 서버 소속

**Files:**
- Modify: `web/backend/internal/database/repository_server.go`
- Modify: `web/backend/internal/models/service.go` (`Service`, `ServiceCreateRequest`, `ToService`)
- Modify: `web/backend/internal/database/repository_service.go` (모든 SELECT와 `Create`)
- Modify: `web/backend/internal/api/handlers/services.go` (`Create`, `Update`)
- Modify: `web/backend/internal/database/repository_project.go` (`AssignMonitor`), `web/backend/internal/api/handlers/projects.go` (오류 매핑)
- Test: `web/backend/internal/api/handlers/server_targets_test.go`

**Interfaces:**
- Consumes: Task 2의 `ServerRepository`와 오류 값.
- Produces (Task 4, 5가 그대로 사용한다):

```go
// database/repository_server.go
type ServerTargetKind string
const (
	ServerTargetMonitor ServerTargetKind = "monitor" // services, type http/tcp
	ServerTargetApp     ServerTargetKind = "app"     // observed_services
	ServerTargetInfra   ServerTargetKind = "infra"   // hosts, collector_type otel-collector
)

// ResolveForTarget returns the server a new target should join. With serverID it
// verifies the server exists (ErrServerMissing) and, for infra, that it has no
// infrastructure resource yet (ErrServerHasInfrastructure). Without serverID it
// applies the find-or-create rule with name and projectID.
func (r *ServerRepository) ResolveForTarget(kind ServerTargetKind, serverID, name, projectID string) (string, error)

// MoveTarget re-parents an existing target. Moving to the current server is a no-op.
// Errors: sql.ErrNoRows (target missing), ErrServerMissing, ErrServerHasInfrastructure.
func (r *ServerRepository) MoveTarget(kind ServerTargetKind, targetID, serverID string) error

// SetProjectForTarget writes projectID ("" clears) to the server that owns the target.
// This is the legacy group-assignment path. Errors: sql.ErrNoRows, ErrServerNameTaken.
func (r *ServerRepository) SetProjectForTarget(kind ServerTargetKind, targetID, projectID string) error
```

- `models.Service`에 `ServerID string \`json:"serverId,omitempty"\`` 필드를, `ServiceCreateRequest`에 같은 JSON 이름의 `ServerID` 필드를 추가하고 `ToService`가 복사한다.
- `repository_service.go`의 모든 SELECT는 `COALESCE(project_id, '')` 자리를 `COALESCE((SELECT project_id FROM servers WHERE servers.id = services.server_id), '')`로 바꾸고, `COALESCE(server_id, '')`를 함께 읽어서 `ServerID`에 넣는다. `Create`의 INSERT는 `server_id`를 기록한다. `Update`는 `server_id`를 바꾸지 않는다.
- `ServiceHandler.Create`: `ResolveForTarget(ServerTargetMonitor, req.ServerID, name, "")`의 결과를 `service.ServerID`에 넣은 뒤 저장한다.
- `ServiceHandler.Update`: 본문에 `serverId`가 있고 기존 값과 다르면 `MoveTarget`을 호출한다. 응답은 변경 후의 `serverId`와 `projectId`를 담는다.
- `ProjectRepository.AssignMonitor(projectID, monitorID)`: `services.project_id`를 쓰는 대신 `SetProjectForTarget(ServerTargetMonitor, monitorID, projectID)`를 호출한다. 엔드포인트의 주소와 응답은 바꾸지 않는다.

오류 매핑: `ErrServerMissing` → 400 `VALIDATION_ERROR`(메시지 `server not found`), `ErrServerHasInfrastructure` → 409 `SERVER_HAS_INFRASTRUCTURE`, `ErrServerNameTaken` → 409 `SERVER_NAME_TAKEN`.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

모니터는 기존 테스트처럼 `{"name": ..., "type": "tcp", "host": "1.1.1.1", "port": 53, "interval": 5}`로 만든다.

- `TestMonitorJoinsServer`
  - `serverId` 없이 `public-dns` 생성 → 응답의 `serverId`가 비어 있지 않고, `GET /servers`에 이름이 `public-dns`인 서버가 1개.
  - 같은 이름으로 한 번 더 생성 → 두 모니터의 `serverId`가 같음(서버는 여전히 1개).
  - 서버 `edge`를 만들고 `serverId`를 지정해서 생성 → 응답의 `serverId`가 `edge`의 ID.
  - `"serverId": "nope"`로 생성 → 400 `VALIDATION_ERROR`, 모니터가 만들어지지 않음(`GET /services?type=http,tcp`의 개수 불변).
- `TestMonitorMovesBetweenServers`
  - 모니터를 `PUT /services/{id}`에 `serverId`를 `edge`로 넣어 수정 → 200, `serverId`가 `edge`.
  - `serverId`를 생략한 `PUT` → `serverId`가 그대로 유지됨.
- `TestLegacyMonitorGroupAssignmentMovesTheServer`
  - 그룹 P 생성, `PUT /projects/P/monitors/{monitorId}` → 200. `GET /services/{id}`의 `projectId == P`이고 `GET /servers/{serverId}`의 `projectId == P`.
  - `DELETE /projects/P/monitors/{monitorId}` → 204, 두 곳 모두 `projectId` 없음.
  - 그룹 없는 서버 `dup`과 그룹 P의 서버 `dup`(각각 모니터 1개)을 만든 뒤, 그룹 없는 쪽 모니터를 P에 배정 → 409 `SERVER_NAME_TAKEN`.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'TestMonitorJoinsServer|TestMonitorMovesBetweenServers|TestLegacyMonitorGroup' -v`
Expected: FAIL(`serverId` 필드 없음).

- [ ] **Step 3: 구현한다**

`ResolveForTarget`가 서버를 새로 만든 뒤에 대상 저장이 실패하면 빈 서버가 남는다. 이 경우는 허용하고, 해당 위치에 그 사실을 한 줄 주석으로 남긴다.

- [ ] **Step 4: 전체 핸들러 테스트가 통과하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ 2>&1 | tail -5`
Expected: `ok`. 기존 `projects_test.go`, `uptime_*_test.go`가 수정 없이 통과해야 한다.

- [ ] **Step 5: 커밋한다**

```bash
git add web/backend/internal/database/repository_server.go web/backend/internal/models/service.go web/backend/internal/database/repository_service.go web/backend/internal/database/repository_project.go web/backend/internal/api/handlers/services.go web/backend/internal/api/handlers/projects.go web/backend/internal/api/handlers/server_targets_test.go
git commit -m "feat(server): uptime monitors belong to a server"
```

---

### Task 4: 앱(Observed Service)의 서버 소속

**Files:**
- Modify: `web/backend/internal/models/observed_service.go` (`ObservedService`, `ObservedServiceInput`)
- Modify: `web/backend/internal/database/repository_observed_service.go` (`observedServiceSelect`, `scanObservedService`, `Create`, `Update`)
- Modify: `web/backend/internal/directtelemetry/manager.go` (`Create`, `Update`)
- Modify: `web/backend/internal/api/handlers/observed_services.go` (`observedServiceError`)
- Test: `web/backend/internal/api/handlers/server_targets_test.go`

**Interfaces:**
- Consumes: Task 3의 `ResolveForTarget`, `MoveTarget`, `SetProjectForTarget`, `ServerTargetApp`.
- Produces: `ObservedService.ServerID`, `ObservedServiceInput.ServerID` (둘 다 `json:"serverId,omitempty"`).

- `observedServiceSelect`의 `COALESCE(o.project_id, '')`를 `COALESCE((SELECT project_id FROM servers WHERE servers.id = o.server_id), '')`로 바꾸고 `COALESCE(o.server_id, '')`를 추가한다.
- `Repository.Create`는 `server_id`를 기록하고 `project_id`는 더 이상 기록하지 않는다. `Repository.Update`는 `name`과 `updated_at`만 바꾼다.
- `Manager.Create`: `ResolveForTarget(ServerTargetApp, input.ServerID, input.Name, input.ProjectID)`로 서버를 정한다. `input.ServerID`가 있으면 `input.ProjectID`는 무시한다.
- `Manager.Update`: `input.ServerID`가 있으면 `MoveTarget`을 호출하고 `input.ProjectID`를 무시한다. 없으면 `SetProjectForTarget(ServerTargetApp, id, input.ProjectID)`를 호출한다(기존 화면의 그룹 지정).
- `observedServiceError`에 Task 3의 오류 매핑 세 가지를 추가한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

앱은 `{"name": ..., "signals": ["logs"]}`로 만든다.

- `TestObservedServiceJoinsServer`
  - `{"name":"checkout","signals":["logs"],"projectId":P}` → 201, `serverId`가 있고 `projectId == P`. `GET /servers/{serverId}`의 `projectId == P`, 이름 `checkout`.
  - 서버 `web`을 만들고 `{"name":"worker","signals":["logs"],"serverId":web,"projectId":P}` → `serverId == web`, 응답에 `projectId` 없음(서버에 그룹이 없으므로 무시됨).
- `TestObservedServiceUpdateWithServerIdIgnoresProjectId`
  - 그룹 P의 서버에 속한 앱을 `PUT {"name":"checkout","signals":["logs"],"serverId":<현재 서버>}` → 200, `projectId == P` 유지.
  - `PUT {"name":"checkout","signals":["logs"],"serverId":<다른 서버>}` → `serverId`가 바뀜.
- `TestLegacyObservedServiceUpdateSetsServerGroup`
  - `serverId` 없이 `PUT {"name":"checkout","signals":["logs"],"projectId":P2}` → `projectId == P2`, 서버의 `projectId == P2`.
  - `serverId`와 `projectId` 모두 없이 `PUT` → 응답과 서버 모두 그룹 없음.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'ObservedService(JoinsServer|UpdateWithServerId)|LegacyObservedService' -v`
Expected: FAIL.

- [ ] **Step 3: 구현한다**

- [ ] **Step 4: 전체 핸들러 테스트가 통과하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ ./internal/directtelemetry/... 2>&1 | tail -5`
Expected: `ok`. `direct_telemetry_test.go`와 `projects_test.go`가 수정 없이 통과해야 한다.

- [ ] **Step 5: 커밋한다**

```bash
git add web/backend/internal/models/observed_service.go web/backend/internal/database/repository_observed_service.go web/backend/internal/directtelemetry/manager.go web/backend/internal/api/handlers/observed_services.go web/backend/internal/api/handlers/server_targets_test.go
git commit -m "feat(server): observed services belong to a server"
```

---

### Task 5: 인프라 리소스의 서버 소속

**Files:**
- Modify: `web/backend/internal/models/infrastructure_resource.go` (`InfrastructureResource`, `InfrastructureResourceInput`)
- Modify: `web/backend/internal/database/repository_infrastructure_resource.go` (`infrastructureResourceSelect`, `scanInfrastructureResource`, `Create`, `Update`)
- Modify: `web/backend/internal/infrastructure/manager.go` (`Create`, `Update`)
- Modify: `web/backend/internal/api/handlers/infrastructure_resources.go` (`infrastructureError`)
- Test: `web/backend/internal/api/handlers/server_targets_test.go`

**Interfaces:**
- Consumes: Task 3의 함수들과 `ServerTargetInfra`.
- Produces: `InfrastructureResource.ServerID`, `InfrastructureResourceInput.ServerID` (둘 다 `json:"serverId,omitempty"`). Docker Collector에서 만들어지는 리소스(`Manager.GetAll`이 `agents`에서 합치는 항목)는 `ServerID`가 비어 있고 `ProjectID`는 지금처럼 환경의 그룹이다.

변경 내용은 Task 4와 같은 구조이다. 차이는 다음과 같다.
- `infrastructureResourceSelect`는 테이블 별칭 없이 `hosts`를 조회하므로 서브쿼리는 `(SELECT project_id FROM servers WHERE servers.id = hosts.server_id)`이다.
- `ResolveForTarget(ServerTargetInfra, ...)`는 `serverId`가 지정된 서버에 이미 인프라 리소스가 있으면 `ErrServerHasInfrastructure`를 반환하고, `serverId`가 없으면 접미사가 붙은 새 서버를 만든다.
- `MoveTarget(ServerTargetInfra, ...)`는 현재 소속 서버로의 이동을 그대로 통과시킨다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

- `TestInfrastructureResourceJoinsServer`
  - `{"name":"db-01"}` → 201, `serverId`가 있음. 서버 이름 `db-01`.
  - `{"name":"db-01"}`을 한 번 더 → 201, `serverId`가 첫 번째와 다르고 그 서버의 이름은 `db-01 (2)`.
  - 첫 번째 서버의 ID를 `serverId`로 지정해서 생성 → 409 `SERVER_HAS_INFRASTRUCTURE`.
- `TestInfrastructureResourceMoveRules`
  - 리소스를 `PUT {"name":"db-01","serverId":<현재 서버>}` → 200(같은 서버로의 이동은 통과).
  - 인프라 리소스가 없는 서버 `empty`로 `PUT` → 200, `serverId == empty`.
  - 이미 리소스가 있는 서버로 `PUT` → 409 `SERVER_HAS_INFRASTRUCTURE`, `GET`으로 확인한 `serverId`는 바뀌지 않음.
- `TestInfrastructureListKeepsDockerBackedResourcesWithoutServer`
  - 인프라 기능이 있는 Docker 환경(`POST /agents`, `projects_test.go` 참고)과 직접 리소스를 하나씩 만든 뒤 `GET /infrastructure-resources` → `adapter == "everyup-agent"`인 항목에는 `serverId`가 없고, `adapter == "otel-collector"`인 항목에는 있음.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'TestInfrastructure(ResourceJoinsServer|ResourceMoveRules|ListKeepsDocker)' -v`
Expected: FAIL.

- [ ] **Step 3: 구현한다**

- [ ] **Step 4: 전체 핸들러 테스트가 통과하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ ./internal/infrastructure/... 2>&1 | tail -5`
Expected: `ok`. `direct_infrastructure_test.go`가 수정 없이 통과해야 한다.

- [ ] **Step 5: 커밋한다**

```bash
git add web/backend/internal/models/infrastructure_resource.go web/backend/internal/database/repository_infrastructure_resource.go web/backend/internal/infrastructure/manager.go web/backend/internal/api/handlers/infrastructure_resources.go web/backend/internal/api/handlers/server_targets_test.go
git commit -m "feat(server): infrastructure resources belong to a server"
```

---

### Task 6: 그룹의 대상 수와 그룹 삭제

**Files:**
- Modify: `web/backend/internal/models/project.go`
- Modify: `web/backend/internal/database/repository_project.go` (`GetAll`, `Delete`)
- Test: `web/backend/internal/api/handlers/server_targets_test.go`

**Interfaces:**
- Consumes: Task 1의 `nextFreeServerNameTx`.
- Produces: `models.Project.ServerCount int \`json:"serverCount"\``.

- `GetAll`: `MonitorCount`, `ObservedServiceCount`, `InfrastructureResourceCount`는 대상 테이블을 `servers`와 조인하여 `servers.project_id = p.id`인 대상을 센다. `ServerCount`는 `servers`에서 센다. `AgentCount`는 그대로이다.
- `Delete`: 트랜잭션 안에서 다음 순서로 처리한다. (1) 그 그룹의 서버를 슬라이스로 읽는다. (2) 각 서버에 대해, 그룹 없는 서버 가운데 같은 이름이 있으면 `nextFreeServerNameTx(tx, name, "")`로 이름을 바꾼다. (3) 그 서버의 `project_id`를 NULL로 바꾼다. (4) `agents`의 `project_id`를 NULL로 바꾼다. (5) `projects` 행을 지운다. 대상 테이블의 `project_id`를 NULL로 바꾸던 기존 문장 세 개는 삭제한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

- `TestProjectCountsFollowServers`
  - 그룹 P에 서버 `web`을 만들고, 그 서버에 모니터 1개와 앱 2개를 `serverId`로 연결 → `GET /projects`에서 P의 `serverCount == 1`, `monitorCount == 1`, `observedServiceCount == 2`, `infrastructureResourceCount == 0`.
  - 서버를 그룹 없음으로 수정 → 네 값이 모두 0.
- `TestProjectDeleteRenamesCollidingServers`
  - 그룹 없는 서버 `web`, 그룹 P의 서버 `web`(모니터 1개 연결)과 `api` 생성.
  - `DELETE /projects/P` → 204.
  - `GET /servers` → 3개, 모두 `projectId` 없음, 이름은 `api`, `web`, `web (2)`. 모니터의 `serverId`는 `web (2)` 서버.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'TestProjectCountsFollowServers|TestProjectDeleteRenames' -v`
Expected: FAIL.

- [ ] **Step 3: 구현한다**

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ 2>&1 | tail -5`
Expected: `ok`.

- [ ] **Step 5: 커밋한다**

```bash
git add web/backend/internal/models/project.go web/backend/internal/database/repository_project.go web/backend/internal/api/handlers/server_targets_test.go
git commit -m "feat(server): group counts and group deletion follow servers"
```

---

### Task 7: 서버 삭제와 서버 합치기

**Files:**
- Modify: `web/backend/internal/database/repository_server.go`
- Modify: `web/backend/internal/api/handlers/servers.go`, `web/backend/internal/api/handlers/services.go`
- Modify: `web/backend/internal/api/routes.go`
- Test: `web/backend/internal/api/handlers/servers_test.go`

**Interfaces:**
- Consumes: Task 2~5.
- Produces:

```go
// database/repository_server.go
type ServerTargets struct {
	MonitorIDs         []string
	ObservedServiceIDs []string
	InfrastructureID   string // "" when none
}
func (r *ServerRepository) Targets(serverID string) (ServerTargets, error)

// Merge moves every target of sourceID to targetID and deletes sourceID, in one transaction.
// Errors: ErrServerMissing (either id), ErrServerHasInfrastructure (both own one).
func (r *ServerRepository) Merge(sourceID, targetID string) error

// DeleteEmpty deletes a server that owns no targets. sql.ErrNoRows when missing.
func (r *ServerRepository) DeleteEmpty(id string) error

// api/handlers/services.go — extracted from ServiceHandler.Delete so both callers share it
func deleteMonitor(repo *database.ServiceRepository, scheduler *checker.Scheduler, id string) error

// api/handlers/servers.go
func (h *ServerHandler) Delete(c *fiber.Ctx) error // DELETE /servers/:id → 204
func (h *ServerHandler) Merge(c *fiber.Ctx) error  // POST /servers/:id/merge {"targetServerId": "..."} → 200, data = target Server
```

- `Delete`: `Targets`로 목록을 얻고, 모니터는 `deleteMonitor`, 앱은 `directtelemetry.NewManager().Delete`, 인프라 리소스는 `infrastructure.NewManager().Delete`로 지운 뒤 `DeleteEmpty`를 호출한다. 중간에 실패하면 오류를 반환하고, 그때까지 지운 것은 되돌리지 않는다. 전체를 트랜잭션 하나로 묶지 않는 이유(기존 삭제 경로가 각자 트랜잭션을 가진다)를 주석 한 줄로 남긴다.
- `Merge`의 응답 코드: `targetServerId`가 비어 있거나 자기 자신이면 400 `VALIDATION_ERROR`, 어느 한쪽이 없으면 404 `NOT_FOUND`, 양쪽 모두 인프라 리소스가 있으면 409 `SERVER_HAS_INFRASTRUCTURE`.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

- `TestServerDeleteRemovesTargetsAndTheirData`
  - 서버 `web`에 모니터 1개(`"alertOnDown": true`로 생성), 앱 1개, 인프라 리소스 1개를 `serverId`로 연결한다.
  - `DELETE /servers/{id}` → 204.
  - `GET /servers/{id}` → 404. `GET /services/{monitorId}` → 404. `GET /observed-services/{appId}` → 404. `GET /infrastructure-resources/{infraId}` → 404.
  - `database.DB`를 직접 조회하여 `alert_rules`에서 `service_id`가 모니터 ID인 행이 0개임을 확인한다.
  - `DELETE /servers/missing` → 404.
- `TestServerMerge`
  - 서버 `a`(모니터 1, 앱 1)와 `b`(앱 1, 인프라 1)를 만든다.
  - `POST /servers/{a}/merge {"targetServerId": b}` → 200, 응답의 `id == b`.
  - `GET /servers` → `a`가 없음. 세 대상의 `serverId`가 모두 `b`.
- `TestServerMergeConflicts`
  - 인프라 리소스가 있는 서버 둘을 합치기 → 409 `SERVER_HAS_INFRASTRUCTURE`, 두 서버와 대상의 소속이 그대로임.
  - `targetServerId`가 자기 자신 → 400. 없는 서버 → 404.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'TestServerDelete|TestServerMerge' -v`
Expected: FAIL(라우트 없음).

- [ ] **Step 3: 구현한다**

`ServiceHandler.Delete`는 `deleteMonitor`를 호출하도록 바꾸고 동작은 그대로 둔다(404 응답, 예약 취소, 상태 규칙 정리).

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ 2>&1 | tail -5`
Expected: `ok`.

- [ ] **Step 5: 커밋한다**

```bash
git add web/backend/internal/database/repository_server.go web/backend/internal/api/handlers/servers.go web/backend/internal/api/handlers/services.go web/backend/internal/api/handlers/servers_test.go web/backend/internal/api/routes.go
git commit -m "feat(server): delete a server with its targets, merge servers"
```

---

### Task 8: 로그 요약과 패턴의 서버 범위

**Files:**
- Modify: `web/backend/internal/database/repository_log_summary.go` (`Summary`, `Patterns`)
- Modify: `web/backend/internal/api/handlers/logs.go` (`GetSummary`, `GetPatterns`)과 두 함수의 다른 호출부
- Test: `web/backend/internal/api/handlers/log_summary_test.go`

**Interfaces:**
- Produces:

```go
func (r *LogRepository) Summary(from time.Time, bucketMins int, serverID string) ([]models.LogServiceSummary, error)
func (r *LogRepository) Patterns(from time.Time, agentID, serverID string, limit int) ([]models.LogPattern, error)
```

`serverID`가 비어 있으면 동작은 지금과 같다. 값이 있으면 `service_id IN (SELECT id FROM observed_services WHERE server_id = ?)`인 로그만 대상으로 한다. `Patterns`에서는 이 조건을 `LIMIT`보다 먼저 적용해야 하므로 SQL의 WHERE 절에 넣는다. HTTP에서는 두 엔드포인트 모두 쿼리 `serverId`로 받는다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`TestLogSummaryAndPatternsScopeToServer`: 서버 `a`와 `b`를 만들고 각각 로그 신호를 가진 앱을 하나씩 `serverId`로 연결한다. 각 앱의 키(생성 응답의 `apiKey`)로 OTLP 로그를 보낸다. 로그를 보내는 방법은 같은 파일의 `TestLogSummaryAndPatterns`와 `direct_telemetry_test.go`를 따른다. 앱 A에는 error 로그 `"db timeout 1"`, `"db timeout 2"`를, 앱 B에는 error 로그 `"queue full"`을 보낸다.

- `GET /logs/summary?serverId={a}` → 항목 1개, `serviceId`가 앱 A, `error == 2`.
- `GET /logs/summary` → 앱 A와 앱 B가 모두 포함됨.
- `GET /logs/patterns?serverId={a}` → 항목 1개, `count == 2`, `serviceId`가 앱 A.
- `GET /logs/patterns?serverId={b}&limit=1` → 항목 1개, `message == "queue full"`(다른 서버의 패턴이 자리를 차지하지 않음).
- `GET /logs/patterns?serverId=missing` → 빈 배열.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'TestLogSummaryAndPatternsScopeToServer' -v`
Expected: FAIL(필터가 무시되어 항목 수가 다름).

- [ ] **Step 3: 구현한다**

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `CGO_ENABLED=0 go test ./internal/... 2>&1 | tail -15`
Expected: 모든 패키지 `ok`.

- [ ] **Step 5: 커밋한다**

```bash
git add web/backend/internal/database/repository_log_summary.go web/backend/internal/api/handlers/logs.go web/backend/internal/api/handlers/log_summary_test.go
git commit -m "feat(server): scope log summary and patterns to a server"
```

호출부를 추가로 수정했다면 그 파일도 `git add`에 포함한다.

---

### Task 9: 결정 기록과 용어집

**Files:**
- Create: `docs/adr/0011-servers-own-directly-configured-targets.md`
- Modify: `docs/adr/0007-capability-menus-show-only-directly-configured-targets.md` (Status 줄)
- Modify: `CONTEXT.md`

이 작업에는 테스트가 없다. 문서는 기존 ADR과 같은 형식(영어, `Status`, `Date`, `Context`, `Decision`, `Consequences`)으로 작성한다.

- [ ] **Step 1: ADR 0011을 작성한다**

내용은 설계 문서(`plans/server-centric-navigation-design.md`) 1절, 4절, 5절, 6.1절, 6.6절을 근거로 한다. 반드시 포함할 사항은 다음과 같다.

- Status: `accepted`, Date: `2026-11-17`, `Supersedes: ADR 0007`, `Amends: ADR 0003, ADR 0004`.
- Context: 기능별 메뉴 구조(ADR 0007)가 사용자가 생각하는 단위(서버)와 맞지 않았다는 점과, 검토한 세 방식(A, B, C) 및 B를 고른 이유.
- Decision: Server가 직접 설정 대상 세 종류를 소유한다. 인프라 리소스는 서버당 최대 1개이다. 그룹 소속은 서버가 가지고 대상은 상속받는다(ADR 0003의 규칙을 직접 대상까지 확장). 업타임 모니터와 인프라 리소스는 계속 별도 모듈이지만 서버에 소속된다(ADR 0004 보완). 내비게이션은 `Overview / Servers, Docker Environments, Groups / Alerts, Settings`가 되고 기능별 메뉴는 없어진다. Docker 환경의 데이터는 계속 Docker 환경에만 보인다(ADR 0007에서 유지되는 부분). 여러 서버를 가로지르는 화면은 Overview, Groups, Alerts, 그리고 사이드바 밖의 전체 로그 화면이다.
- Consequences: 기존 대상은 이름과 그룹이 같으면 한 서버로 묶여 이전된다. 여러 서버에 걸친 업타임 일괄 작업이 없어진다. 대상 테이블의 `project_id` 컬럼은 사용하지 않는 채로 남는다. 서버를 삭제하면 소속 대상과 데이터가 함께 삭제된다.

- [ ] **Step 2: ADR 0007의 상태를 바꾼다**

`Status: accepted`를 `Status: superseded by ADR 0011`로 바꾼다. 본문은 수정하지 않는다.

- [ ] **Step 3: `CONTEXT.md`를 고친다**

- 첫 문단을 서버 중심 구조에 맞게 고친다: 사용자는 Server 단위로 모니터링 기능을 설정하고, Docker Environment는 별도의 선택적 통합이며 그 데이터는 Docker Environment에만 보인다.
- `**Server**` 항목을 추가한다: "A named unit the user monitors, usually one host or one deployed system. It owns directly configured targets: Uptime Monitors, Observed Services created for a Direct Telemetry Connection, and at most one directly configured Infrastructure Resource. A Server may belong to a Group, and its targets inherit that Group." `_Avoid_: Docker Environment, Group, host (in product copy)`.
- `**Capability Menu**` 항목을 `**Capability Tab**`으로 바꾼다: Server 화면 안의 Uptime, Infrastructure, Logs, API, Metrics 탭이며, 그 서버의 직접 설정 대상만 보여 준다. `_Avoid_: Capability Menu, Docker Environment view`.
- `**Group**` 항목: 그룹이 직접 묶는 대상은 Docker Environment와 Server이고, 서버의 대상과 Docker에서 발견된 서비스는 각각 소속 서버와 Docker Environment의 그룹을 상속받는다고 고친다.
- `**Uptime Monitor**`, `**Direct Telemetry Connection**`, `**Infrastructure Resource**`, `**Docker Environment**` 항목에서 "Capability Menu"를 언급하는 문장을 Server 기준으로 고친다. Docker Environment의 `_Avoid_`에 있는 `server`는 유지한다.

- [ ] **Step 4: 문서 사이트 빌드에 영향이 없는지 확인한다**

Run: `grep -n "srcExclude" docs/.vitepress/config.mts`
Expected: `adr/**`가 제외 목록에 있음(ADR은 사이트에 발행되지 않는다).

- [ ] **Step 5: 커밋한다**

```bash
git add docs/adr/0011-servers-own-directly-configured-targets.md docs/adr/0007-capability-menus-show-only-directly-configured-targets.md CONTEXT.md
git commit -m "docs(adr): servers own directly configured targets (ADR 0011)"
```

---

### Task 10: 1단계 전체 검증

- [ ] **Step 1: 백엔드 전체를 검증한다**

Run: `cd web/backend && CGO_ENABLED=0 go build ./... && CGO_ENABLED=0 go vet ./... && CGO_ENABLED=0 go test ./... 2>&1 | tail -20`
Expected: 빌드와 vet 통과, 모든 패키지 `ok`. Task 0의 Step 2에서 기록한 기존 실패 외에 새로운 실패가 없어야 한다.

- [ ] **Step 2: 기존 프론트엔드가 영향을 받지 않았는지 확인한다**

Run: `git diff --stat origin/main...HEAD -- web/frontend agent`
Expected: 출력 없음(이 단계는 프론트엔드와 agent를 수정하지 않는다).

- [ ] **Step 3: 기존 데이터가 있는 DB에서 기동을 확인한다**

마이그레이션 이전 상태의 DB를 흉내 내기 위해, 임시 디렉터리에서 서버를 한 번 기동해 DB 파일을 만든 뒤 종료하고, `servers` 행과 대상의 `server_id`를 SQL로 지운 다음(`UPDATE ... SET server_id = NULL`, `DELETE FROM servers`) 다시 기동한다. 기동 방법과 DB 경로 설정은 `web/backend`의 `cmd`와 설정 코드에서 확인한다.
Expected: 두 번째 기동이 오류 없이 끝나고, 직접 대상에 `server_id`가 다시 채워져 있다. 실행 환경 때문에 이 확인을 수행할 수 없으면 수행하지 못한 이유를 보고한다.
