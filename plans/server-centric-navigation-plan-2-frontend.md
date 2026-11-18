# 서버 중심 개편 2단계: 프론트엔드 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바의 기능별 메뉴 다섯 개를 `서버` 화면(목록, 상세, 기능별 탭)으로 대체하고, 기존 주소와 여러 대상을 가로지르는 화면을 새 구조에 맞춘다.

**Architecture:** 새 화면은 `/servers` 아래에 추가하고, 기존 메뉴별 상세 페이지의 본문을 ID를 props로 받는 패널로 바꿔서 서버 상세의 탭 안에서 재사용한다. 서버 목록의 상태와 수치는 새 집계 API 없이 기존 목록 응답을 `serverId`로 묶어서 만든다. 옛 화면은 새 화면과 e2e가 모두 준비된 뒤에 한 번에 제거하므로, 작업마다 e2e 전체가 통과하는 상태를 유지한다.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, react-router, Playwright(e2e), Go(백엔드의 작은 변경 한 건).

**Spec:** `plans/server-centric-navigation-design.md` (6절, 7절이 이 계획의 범위이다. 5절의 API는 1단계에서 구현되어 `main`에 있다.)

세 단계 가운데 두 번째이다. 사용자 문서와 스크린샷 갱신, 기존 화면용 엔드포인트의 제거는 3단계에서 다룬다.

## Global Constraints

- 작업 디렉터리는 worktree 루트이고, 프론트엔드 명령은 `web/frontend`에서 pnpm으로 실행한다(npm 사용 금지).
- 프론트엔드에는 단위 테스트 실행기가 없다. 새 의존성을 추가하지 않는다. 동작 검증은 Playwright e2e로 한다. 데모 빌드(포트 4173, `mockRouter`)를 대상으로 하는 spec과, mock을 끈 개발 서버(포트 4174)에서 `page.route`로 API를 가로채는 spec 두 종류가 있다.
- 작업 하나를 끝내는 기준: `pnpm lint`, `pnpm typecheck`, `pnpm build`가 통과하고, `pnpm test:e2e`(내부에서 `pnpm build:demo`를 먼저 실행한다)가 전부 통과한다. `pnpm build`는 타입을 검사하지 않으므로 `typecheck`를 생략하지 않는다.
- e2e를 실행하기 전에 4173과 4174 포트를 다른 프로세스가 점유하고 있는지 확인한다(`netstat -ano | grep -E ":4173|:4174"`). 점유되어 있으면 그 서버를 종료하지 말고, Playwright가 남의 서버를 재사용하지 않도록 `CI=1 pnpm test:e2e`로 실행하거나 진행을 멈추고 보고한다.
- 디자인 규약의 정본은 `web/frontend/DESIGN.md`이다. **배치는 설계 문서 6절을 따르고, 표현은 `DESIGN.md`를 따른다.** 새 색·크기 값을 만들지 않고 기존 토큰과 공용 컴포넌트를 쓴다. 특히 다음을 지킨다.
  - 페이지 섹션을 테두리 카드로 감싸지 않는다. 목록·표에 바깥 카드 셸과 헤더 배경을 쓰지 않는다(§3.1).
  - 대상의 상태는 `StatusLight`(점과 문구)로 표시하고, 상태 문구를 상태색으로 칠하지 않는다(§5.1). 문구 없이 점만 놓을 때는 접근 가능한 이름을 준다(§5.2).
  - 패널을 바꾸는 것은 `role="tablist"`의 밑줄 탭이다(§4.6).
  - 목록 화면의 조작 위치는 §4.5 "목록 조작의 자리"를 따른다.
  - 카드 좌측 상태 보더, 파스텔 틴트 박스, 붉은 위험 영역 카드를 쓰지 않는다. 위험 동작은 중립 표면에 붉은 글자의 조작으로 표현한다.
- 문구는 한국어이고, 한 줄에 띄어 쓴 가운뎃점은 하나까지만 쓴다. 줄표를 쓰지 않고 말줄임은 `…`를 쓴다. 기술 용어는 `DESIGN.md` §9.15의 표기를 따른다.
- 디자인 검사의 기준선(이 계획을 시작한 시점의 `main`): Hallmark 정적 검사 FAIL 37건(gate 48 28건, 67 4건, 30a 3건, 20 1건, 33 1건), Impeccable 정적 검사 3건. UI를 변경하는 작업은 이 수치를 늘리지 않아야 한다. 명령은 다음과 같고 `web/frontend`에서 실행한다.
  - `node C:/dev/mt-app/.claude/skills/hallmark/scripts/sloplint.mjs src --scope app --genre modern-minimal --json` (출력의 `summary.fails`로 판정한다. 종료 코드는 판정 기준이 아니다.)
  - `node C:/dev/mt-app/.claude/skills/impeccable/scripts/detect.mjs --json src` (배열의 길이로 판정한다.)
- 320px 폭에서도 페이지에 가로 스크롤이 생기지 않아야 한다. 모바일에서 누르는 대상의 높이는 44px 이상이다.
- 데이터 영역은 로딩, 비어 있음, 검색 결과 없음(검색이 있는 경우), 오류의 상태를 모두 가진다. 검색어·필터·선택한 대상은 주소(쿼리 또는 경로)에 둔다.
- 대화 상자에서 대상을 만들거나 옮긴 뒤에 화면이 바뀌면, 포커스를 바뀐 화면의 탭 패널 제목으로 옮기고 토스트로 결과를 알린다. 상태를 색만으로 전달하지 않는다.
- `src/services/api/index.ts`는 배럴이다. 새 타입과 함수는 도메인 파일과 배럴 양쪽에 추가한다.
- 화면 경로 문자열을 컴포넌트마다 직접 만들지 않는다. 서버 화면의 경로는 Task 4의 `serverPath`로만 만든다.
- 커밋은 작업마다 하나 이상 만들고, `git add`에는 변경한 파일의 경로를 직접 지정한다(`git add -A`, `git add .` 금지). 작업 트리에는 이 작업과 무관한 변경(`pnpm-lock.yaml`, `web/frontend/.hallmark/`, `web/frontend/.impeccable/`)이 있다. 커밋 메시지는 영어 제목을 쓰고 마지막 줄에 `Co-Authored-By: Claude <noreply@anthropic.com>`를 넣는다. push는 하지 않는다.
- 새 주석은 왜 그렇게 했는지가 코드만으로 드러나지 않을 때만 쓰고, 이 저장소의 프론트엔드 주석 관례(한국어)를 따른다.
- 기능 탭의 패널(Task 7~10)에 적용하는 규칙(Task 6 이후의 디자인 점검에서 추가):
  - 서버 상세에는 이미 머리말과 탭 줄이 있다. 패널 안에 두 번째 머리말을 쌓지 않는다. 기존 상세 화면의 `PageHeader`와 `DetailActionToolbar`를 통째로 가져오지 않고, 대상 이름은 패널의 제목(h2) 한 줄로, 조작은 그 줄의 오른쪽에 둔다.
  - 자동 새로고침의 주체는 하나이다. 서버 상세(`useServers`)가 30초마다 다시 불러오므로, 패널이 같은 데이터를 따로 주기적으로 불러오지 않는다. 패널 고유의 데이터(체크 이력, 로그 등)만 패널이 관리한다.
  - 화살표 키로 탭을 옮기면 지나가는 탭마다 패널이 마운트된다. 패널은 마운트 시점의 요청이 취소되거나 버려져도 문제가 없어야 하고(언마운트 뒤의 상태 갱신 금지), 마운트만으로 쓰기 요청을 보내지 않는다.
  - 로그, API 요청, 메트릭의 상태 문구는 `serverStatus.ts`의 기능별 문구 함수를 사용한다("정상" 대신 "수집 중" 등).
  - 업타임 목록의 행 단위 일시정지 조작은 유지한다.

## Review Focus

1. **서버 없는 인프라 리소스.** Docker 환경에서 온 인프라 리소스(`adapter: 'everyup-agent'`)에는 `serverId`가 없다. 서버 화면의 어떤 목록에도 나타나면 안 된다. (Task 4)
2. **부분 실패.** 대상 목록 가운데 하나만 조회에 실패했을 때 서버 목록이 빈 화면이나 "정상"으로 보이면 안 된다. 실패한 종류의 칸은 `-`이고 안내가 보여야 한다. (Task 4)
3. **옛 주소의 쿼리 보존.** `/logs/:id?range=6h&pattern=…`으로 들어오면 새 주소에서도 같은 쿼리가 유지되어야 한다. 존재하지 않는 ID는 무한 로딩이 아니라 안내 화면이어야 한다. (Task 13)
4. **대상이 하나도 없는 서버와 앱이 여러 개인 서버.** 탭마다 0개, 1개, 2개 이상의 경우가 설계 문서 6.4절의 표대로 동작해야 한다. (Task 5, 7, 9, 10)
5. **수정 요청의 `serverId` 누락.** 앱과 인프라 리소스의 수정 요청에서 `serverId`를 빼면 백엔드가 기존 화면의 요청으로 보고 서버 전체의 그룹을 해제한다. 새 화면의 모든 수정 요청은 `serverId`를 보내야 한다. (Task 14에서 타입으로 강제)
6. **공용 함수의 모든 호출자.** 시그니처를 바꾸는 공용 함수(`getLogPatterns`, `UptimeTargets`, `MonitoringConnection`, `LogServiceOverview` 등)는 저장소 전체에서 호출자를 찾아서 고친다. Docker 환경 화면(`pages/services/`, `features/healthcheck/`)도 이 함수들을 쓴다.

## File Structure

| 경로 | 책임 |
|---|---|
| `src/services/api/servers.ts` (신규) | 서버 API와 `Server` 타입 |
| `src/features/servers/serverPaths.ts` (신규) | 서버 화면의 경로를 만드는 유일한 곳 |
| `src/features/servers/serverStatus.ts` (신규) | 대상과 서버의 상태 판정, 서버 행 구성 |
| `src/features/servers/useServers.ts` (신규) | 서버와 대상 목록을 불러와 서버 행으로 묶는 훅 |
| `src/features/servers/components/` (신규) | 서버 목록 표, 서버 머리말, 개요 탭, 기능 탭, 대화 상자 |
| `src/pages/servers/` (신규) | `ServersPage`, `ServerFormPage`, `ServerDetailPage`, `LegacyTargetRedirect` |
| `src/components/common/Tabs.tsx` (신규) | 공용 밑줄 탭 |
| `src/features/uptime/components/UptimeMonitorPanel.tsx`, `UptimeMonitorList.tsx` (신규) | 업타임 상세 본문과 목록 본문 |
| `src/features/telemetry/` | 앱 패널 세 개(로그, API, 메트릭)와 공용 훅 |
| `src/features/infra/components/InfrastructurePanel.tsx` (신규) | 인프라 상세 본문 |
| `src/services/mockRouter.ts`, `src/mocks/demoTargets.ts` | 서버 mock과 `serverId` |
| `e2e/` | 새 spec과 옛 spec의 이식 |

---

### Task 1: 백엔드 보완 (타임라인 경로, 서버 404 메시지)

**Files:**
- Modify: `web/backend/internal/api/handlers/incidents.go` (`uptimeEpisode`, 214행 부근과 그 호출부)
- Modify: `web/backend/internal/api/handlers/servers.go` (404 응답)
- Test: `web/backend/internal/api/handlers/servers_test.go`, 타임라인을 검증하는 기존 테스트 파일(`grep -rn "targetPath\|TargetPath" web/backend/internal --include=*_test.go`로 찾는다)

**Interfaces:**
- Produces: `GET /incidents/timeline`의 업타임 항목 `targetPath`가 `/servers/<serverId>/uptime/<monitorId>`가 된다. 서버 404 응답 본문은 `{"success": false, "error": {"code": "NOT_FOUND", "message": "server not found"}}`이다.

개요 화면은 `targetPath`를 링크뿐 아니라 "현재 확인 필요" 항목과 장애 이력을 잇는 키로도 쓴다. 따라서 프론트엔드가 만드는 경로(Task 4의 `serverPath`)와 형식이 같아야 한다. 모니터의 `server_id`를 알 수 없는 경우(있어서는 안 되지만 방어용)에는 지금의 `/uptime/<id>`를 유지한다. Docker 항목의 `targetPath`(`/services/...`)는 바꾸지 않는다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**
  - `TestIncidentTimelineUptimeTargetPathPointsAtServer`: 서버 `web`에 tcp 모니터를 만들고(`"host": "1.1.1.1", "port": 53, "interval": 5`), `database` 패키지로 그 모니터의 인시던트를 한 건 넣은 뒤(기존 타임라인 테스트가 인시던트를 넣는 방식을 따른다) `GET /api/v1/incidents/timeline` → 해당 항목의 `targetPath == "/servers/" + serverId + "/uptime/" + monitorId`.
  - `TestServerNotFoundHasMessage`: `GET /api/v1/servers/missing` → 404, `error.code == "NOT_FOUND"`, `error.message == "server not found"`.
  - 기존 테스트 가운데 `"/uptime/"` 형식의 `targetPath`를 기대하는 검증이 있으면 새 형식으로 바꾼다(설계 변경에 따른 기대값 변경이다).
- [ ] **Step 2: 실패를 확인한다** — Run: `cd web/backend && CGO_ENABLED=0 go test ./internal/api/handlers/ -run 'IncidentTimelineUptimeTargetPath|ServerNotFoundHasMessage' -v` / Expected: FAIL.
- [ ] **Step 3: 구현한다.** 모니터 ID에서 `server_id`를 얻는 조회는 반복문 밖에서 한 번에 수행한다(연결 수 1개 제약).
- [ ] **Step 4: 통과를 확인한다** — Run: `CGO_ENABLED=0 go vet ./... && CGO_ENABLED=0 go test ./internal/... 2>&1 | tail -8` / Expected: 모든 패키지 `ok`.
- [ ] **Step 5: 커밋한다** — `fix(server): timeline links point at the server, server 404 carries a message`

---

### Task 2: API 계층과 mock 데이터

**Files:**
- Create: `web/frontend/src/services/api/servers.ts`
- Modify: `src/services/api/index.ts`, `services.ts`, `observedServices.ts`, `hosts.ts`, `projects.ts`
- Modify: `src/services/mockRouter.ts`, `src/mocks/demoTargets.ts`, `src/mocks/SCENARIOS.md`
- Modify: `getLogPatterns`의 호출부 전체(`pages/capabilities/LogsPage.tsx`, `pages/services/ProjectDetailPage.tsx` 등)

**Interfaces:**
- Produces:

```ts
// services/api/servers.ts
export interface Server { id: string; name: string; description?: string; projectId?: string; createdAt: string; updatedAt: string }
export interface ServerInput { name: string; description?: string; projectId?: string }
export const serversApi = {
  getServers: () => request<Server[]>('/servers'),
  getServer: (id: string) => request<Server>(`/servers/${id}`),
  createServer: (data: ServerInput) => request<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  updateServer: (id: string, data: ServerInput) => request<Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServer: (id: string) => request<void>(`/servers/${id}`, { method: 'DELETE' }),
  mergeServer: (id: string, targetServerId: string) => request<Server>(`/servers/${id}/merge`, { method: 'POST', body: JSON.stringify({ targetServerId }) }),
};
```

- `UptimeMonitor.serverId: string`, `ObservedService.serverId: string`, `InfrastructureResource.serverId?: string`(Docker 환경에서 온 리소스에는 없다).
- 이 작업에서는 입력 타입에 `serverId?: string`을 선택 필드로 추가하고 기존 `projectId?`는 그대로 둔다. 필수로 바꾸고 `projectId`를 없애는 일은 Task 14가 한다(그때까지 기존 화면이 컴파일되어야 한다).
- `Project.serverCount: number`를 추가한다. 기존 개수 필드 네 개는 그대로 둔다.
- `getLogSummary: (serverId?: string) => ...`, `getLogPatterns: (scope?: { agentId?: string; serverId?: string; limit?: number }) => ...`로 바꾼다. 쿼리 문자열은 `limit`, `agentId`, `serverId` 순서로 만들고 값은 `encodeURIComponent`로 인코딩한다. `limit`의 기본값은 10이다.

**mock의 동작 (`mockRouter.ts`).** 백엔드의 동작(설계 문서 5.4절, 5.5절)을 따른다.

- `mockServers` 배열과 `scenarioServers(scenario)`를 추가한다. `empty` 시나리오에서는 처음부터 있던 서버를 숨기고 사용자가 만든 서버만 남긴다(기존 대상들의 `initial…Ids` 방식과 같다).
- 모든 직접 대상(mock의 업타임 모니터, 앱, `otel-collector` 인프라 리소스)에 `serverId`를 부여한다. 대상의 `projectId`는 저장값을 쓰지 않고 응답할 때 소속 서버의 `projectId`로 채운다.
- 핸들러: `GET /servers`, `GET /servers/:id`(없으면 `ApiError('server not found', 'NOT_FOUND', 404)`), `POST /servers`, `PUT /servers/:id`, `DELETE /servers/:id`(소속 대상을 함께 제거), `POST /servers/:id/merge`. 같은 그룹 안의 이름 충돌(대소문자와 앞뒤 공백 무시)은 `ApiError('server name already exists in this group', 'SERVER_NAME_TAKEN', 409)`이다. 양쪽 모두 인프라 리소스가 있는 합치기와, 이미 인프라 리소스가 있는 서버로의 인프라 리소스 생성·이동은 `ApiError(..., 'SERVER_HAS_INFRASTRUCTURE', 409)`이다.
- 대상 생성: 본문에 `serverId`가 있으면 그 서버에 넣고, 없으면 이름과 그룹으로 서버를 찾거나 만든다. 대상 수정: 본문의 `serverId`가 현재와 다르면 이동한다.
- `GET /projects`의 `serverCount`와 기존 개수는 서버를 거쳐 계산한다.
- `/logs/summary`와 `/logs/patterns`는 `serverId` 쿼리를 받아 그 서버의 앱으로 범위를 좁힌다. 현재 `endpoint === '/logs/summary'`로 정확 비교하고 있으므로 쿼리가 붙은 경우도 처리하게 고친다.
- 타임라인 mock의 업타임 `targetPath`(807행, 1017행 부근)를 `/servers/<serverId>/uptime/<monitorId>` 형식으로 바꾼다.

**데모 데이터의 구성.** 기존 대상의 ID와 이름은 바꾸지 않는다(기존 e2e가 참조한다). 대상들을 서버로 묶을 때 다음 조건을 모두 만족시킨다. 구성 결과는 `src/mocks/SCENARIOS.md`에 표로 적는다.

- 업타임, 인프라, 로그, API 요청, 메트릭이 모두 연결되어 있고 로그 신호를 가진 앱이 2개 이상인 서버가 1개 이상 있다.
- 일부 기능만 연결된 서버가 있다.
- 업타임 모니터만 가진 서버(외부 대상)가 있다.
- 대상이 하나도 없는 서버가 1개 있다(이름 `staging-empty`, 그룹 없음).
- 업타임 모니터가 2개 이상인 서버와 1개인 서버가 모두 있다.
- `attention` 시나리오에서 장애 상태인 대상을 가진 서버가 1개 이상 있고, `normal` 시나리오에서는 없다.
- 서로 다른 그룹의 서버와 그룹 없는 서버가 있다.

- [ ] **Step 1: 타입과 API를 추가하고 mock을 구현한다.**
- [ ] **Step 2: 호출부를 고친다.** `getLogPatterns`와 `getLogSummary`의 호출자를 저장소 전체에서 찾아 새 시그니처에 맞춘다.
- [ ] **Step 3: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. 이 작업은 화면을 바꾸지 않으므로 기존 e2e가 그대로 통과해야 한다. 기존 spec이 실패하면 데모 데이터의 변경이 원인인지 확인하고, spec을 고치기 전에 데이터 구성을 다시 본다(기존 대상의 ID·이름·그룹이 바뀌지 않았는지).
- [ ] **Step 4: 커밋한다** — `feat(server): server api client, types and demo data`

---

### Task 3: 공용 탭 컴포넌트

**Files:**
- Create: `src/components/common/Tabs.tsx`, 그리고 `components/common`의 배럴에 export 추가
- Modify: `src/features/healthcheck/components/AgentServiceTabs.tsx`(자체 `TabBar` 제거), `src/pages/capabilities/DirectApiDetailPage.tsx`(205~219행의 직접 만든 탭)
- Test: `web/frontend/e2e/tabs.spec.ts` (신규)

**Interfaces:**
- Produces:

```ts
export interface TabItem<T extends string> {
  key: T;
  label: string;
  /** 문제가 있는 탭에 붙는 상태 점. 점의 접근 가능한 이름은 toneLabel이다. */
  tone?: StatusTone;
  toneLabel?: string;
  /** 라벨 옆의 보조 문구(예: "연결 전"). */
  caption?: string;
  /** 연결되지 않은 탭처럼 흐리게 표시한다. 선택은 가능하다. */
  muted?: boolean;
}
export function Tabs<T extends string>(props: {
  items: readonly TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  ariaLabel: string;
  /** 탭과 패널의 id를 만드는 접두사 */
  idPrefix: string;
}): JSX.Element
export const tabId: (idPrefix: string, key: string) => string       // `${idPrefix}-tab-${key}`
export const tabPanelId: (idPrefix: string, key: string) => string  // `${idPrefix}-panel-${key}`
```

모양은 현재 `AgentServiceTabs.tsx`의 `TabBar`(34~64행)를 그대로 옮긴다: `role="tablist"`, 한 줄 가로 스크롤(`overflow-x-auto overflow-y-hidden`), 선택된 탭에만 밑줄, 탭 아래 전폭 선 없음. 키보드는 `DirectApiDetailPage.tsx`(209~215행)의 방식(←, →, Home, End로 이동하며 선택)을 넣는다. 선택되지 않은 탭은 `tabIndex={-1}`이다. 기존 Docker 서비스 상세의 탭 id(`service-tab-…`, `service-panel-…`)를 참조하는 e2e가 있으면 그 spec이 깨지지 않도록 `idPrefix`를 맞춘다.

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`tabs.spec.ts`, 데모 빌드 대상)
  - Docker 서비스 상세 화면(`demo.spec.ts`가 여는 경로를 따른다)에서 탭 목록에 포커스를 두고 `ArrowRight`를 누르면 다음 탭이 `aria-selected="true"`가 되고, `End`를 누르면 마지막 탭이, `Home`을 누르면 첫 탭이 선택된다.
  - 선택된 탭만 `tabindex="0"`이다.
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- tabs.spec.ts` / Expected: FAIL(화살표 키로 이동하지 않음).
- [ ] **Step 3: 구현하고 두 호출부를 교체한다.**
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과.
- [ ] **Step 5: 커밋한다** — `feat(ui): shared underline tabs with keyboard support`

---

### Task 4: 서버 목록 화면

**Files:**
- Create: `src/features/servers/serverPaths.ts`, `serverStatus.ts`, `useServers.ts`, `components/ServerTable.tsx`
- Create: `src/pages/servers/ServersPage.tsx`
- Modify: `src/App.tsx`(라우트 `/servers` 추가. 사이드바는 Task 13에서 바꾼다.)
- Modify: `src/pages/projects/projectMembers.ts`(대상별 상태 판정을 `serverStatus.ts`의 함수로 교체)
- Test: `web/frontend/e2e/servers-list.spec.ts` (신규)

**Interfaces:**
- Produces:

```ts
// serverPaths.ts
export type ServerCapability = 'uptime' | 'infrastructure' | 'logs' | 'api' | 'metrics';
export const SERVER_CAPABILITIES: readonly { key: ServerCapability; label: string }[]
// 순서와 라벨: uptime 업타임, infrastructure 인프라, logs 로그, api API 요청, metrics 메트릭
export function serverPath(serverId: string, capability?: ServerCapability, targetId?: string): string
// '/servers/<id>', '/servers/<id>/logs', '/servers/<id>/logs/<targetId>'. 각 조각은 encodeURIComponent로 인코딩한다.

// serverStatus.ts
export interface TargetState { state: StatusTone; detail: string }
export function monitorState(monitor: UptimeMonitor): TargetState
export function appState(service: ObservedService): TargetState
export function infrastructureState(resource: InfrastructureResource): TargetState
export interface ServerTargets { monitors: UptimeMonitor[]; apps: ObservedService[]; infrastructure?: InfrastructureResource }
export interface ServerRow {
  server: Server;
  targets: ServerTargets;
  state: StatusTone;
  /** 가장 나쁜 대상의 원인과 그 대상의 주소. 정상이거나 대상이 없으면 없다. */
  cause?: { text: string; to: string };
  /** 기능별 상태. 연결된 대상이 없으면 null. */
  capabilities: Record<ServerCapability, StatusTone | null>;
  cpu?: number; memory?: number; disk?: number;
  /** 소속 모니터들의 24시간 가용률 가운데 가장 낮은 값 */
  uptime?: number;
  /** 로그 신호를 가진 앱들의 24시간 오류 로그 합계 */
  errorLogs?: number;
}
export function buildServerRows(input: {
  servers: Server[];
  monitors: UptimeMonitor[] | null;        // null은 조회 실패
  apps: ObservedService[] | null;
  infrastructure: InfrastructureResource[] | null;
  logSummaries: LogServiceSummary[] | null;
}): ServerRow[]

// useServers.ts
export function useServers(): {
  rows: ServerRow[];
  loading: boolean;
  /** 서버 목록 자체를 불러오지 못했다 */
  error: string | null;
  /** 대상 목록 가운데 불러오지 못한 종류의 라벨. 비어 있으면 전부 성공 */
  failed: string[];
  updatedAt: Date | null;
  reload: () => void;
}
```

**상태 판정 규칙.** 대상별 판정은 지금 `projectMembers.ts`(56~58행)에 있는 규칙을 그대로 옮긴다. 추가되는 규칙은 인프라 리소스의 사용률 하나이다.

| 대상 | 조건 | 상태 | detail |
|---|---|---|---|
| 모니터 | `status === 'unhealthy'` | error | `장애` |
| 모니터 | `status === 'healthy'` | healthy | `정상` |
| 모니터 | 그 밖 | idle | `상태 확인 중` |
| 앱 | `!isActive` | idle | `연결 비활성화됨` |
| 앱 | `isActive`이고 `lastSeenAt` 없음 | warn | `데이터 대기 중` |
| 앱 | `isActive`이고 `lastSeenAt` 있음 | healthy | 기존 문구 유지 |
| 인프라 | `!isActive` | idle | `Collector 비활성화됨` |
| 인프라 | 활성이지만 수신이 오래됨(`isCollectorFresh`가 false) | warn | `데이터 확인 필요` |
| 인프라 | 활성·수신 중이고 `peakUsage(resource) >= WARNING_PCT` | warn | 가장 높은 항목과 값(예: `메모리 88%`) |
| 인프라 | 그 밖 | healthy | `데이터 유입 중` |

`WARNING_PCT`와 `peakUsage`는 `features/infra/usage.ts`의 것을 쓴다(70%). 사용률만으로는 error가 되지 않는다.

- 서버의 상태는 소속 대상의 상태 가운데 가장 나쁜 값이다. 순서는 error, warn, idle, healthy이다(`projectMembers.ts`의 `STATE_ORDER`). 대상이 하나도 없는 서버는 idle이다.
- 서버 행의 `cause`는 error 또는 warn 상태인 대상 가운데 가장 나쁜 것의 원인이다. 모니터 장애의 문구는 `응답 없음`이고 `activeIncident`가 있으면 지속 시간을 쉼표 뒤에 붙인다(예: `응답 없음, 3분째`. 지속 시간의 표기는 `UptimeTargets`가 진행 중인 장애에 쓰는 표기를 재사용한다). 그 밖의 대상은 `detail`을 쓴다. `to`는 그 대상의 `serverPath`이다.
- 기능별 상태: `uptime`은 모니터들, `infrastructure`는 인프라 리소스, `logs`·`api`·`metrics`는 각각 `logs`·`traces`·`metrics` 신호를 가진 앱들의 가장 나쁜 값이다.
- `serverId`가 없는 인프라 리소스(Docker 환경에서 온 것)는 어느 서버에도 넣지 않는다.
- 조회에 실패한 종류(`null`)는 상태 계산에서 빼고, 해당 수치는 `undefined`로 둔다.

**화면 (설계 문서 6.3절).**
- `PageHeader menu`: 제목 `서버`, 설명 없음. 헤더 조작은 `새로고침`, `ButtonLink to="/servers/new"`의 `서버 추가`. 크기와 모양은 헤더 기본값을 쓴다.
- 툴바: 검색(왼쪽), 상태 요약, 그룹 필터. 상태 요약은 `장애, 확인 필요, 대기, 정상` 순서의 수치 버튼이고 누르면 필터가 된다(`aria-pressed`, 쿼리 `status=error|warn|idle|healthy`). 업타임 목록(`AgentServiceCapabilityPage.tsx` 137~153행)의 버튼 그룹과 같은 모양을 쓴다. 검색은 쿼리 `q`, 그룹 필터는 쿼리 `group`(그룹 ID, 그룹 없음은 `none`)이다.
- 검색은 서버 이름, 소속 모니터의 이름과 주소(`url`), 앱의 이름, 인프라 리소스의 이름을 대소문자 구분 없이 찾는다. 서버 이름이 아닌 대상이 일치한 경우에는 서버 이름 아래에 일치한 대상의 이름을 보여 준다.
- 표: `ResourceTable`을 쓴다. 열은 서버, 상태, CPU, 메모리, 업타임 24시간, 오류 로그 24시간, 그룹이다.
  - 서버 열: 이름은 `data-row-link`가 붙은 링크(`serverPath(id)`)이다. 좁은 폭에서 숨긴 수치를 이름 아래에 모은다.
  - 상태 열: `StatusLight`(문구는 `장애`, `확인 필요`, `대기`, `정상`)와, 그 아래 줄의 원인 보조 문구(`type-caption text-text-muted`).
  - 수치 열은 오른쪽 정렬과 `tabular-nums`이다. 수집하지 않는 값은 `-`이고 `title`과 `aria-label`이 `수집 안 함`이다. CPU와 메모리가 `WARNING_PCT` 이상이면 그 칸의 글자를 `text-status-warn`으로 한다.
  - 열을 숨기는 기준은 목록 컨테이너의 폭이다(`UptimeTargets`의 `@container` 방식). 서버와 상태는 항상 보이고, 폭이 좁아지면 그룹, 수치 열 순서로 숨긴다.
- 정렬: 상태가 나쁜 순서, 같은 상태 안에서는 이름순(`localeCompare`).
- 상태별 화면: 로딩, 서버 없음(`EmptyState`, 주 버튼 `서버 추가`. Docker 환경이 하나라도 있으면 "Docker Collector가 수집한 데이터는 Docker 환경에서 확인합니다."를 함께 보여 준다), 검색·필터 결과 없음(필터 해제 버튼), 서버 목록 조회 실패(다시 시도). `failed`가 비어 있지 않으면 표 위에 "일부 정보를 불러오지 못했습니다"와 실패한 종류, 다시 시도 버튼을 보여 준다.
- 30초마다 자동 갱신한다(`useAutoRefresh`).

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`servers-list.spec.ts`, 데모 빌드 대상. 구체적인 서버 이름은 Task 2의 `SCENARIOS.md`에서 가져온다.)
  - `./servers`를 열면 제목이 `서버`인 화면이고, 표의 첫 행은 장애 상태인 서버이며 그 행의 상태 칸에 `장애`와 `응답 없음`이 보인다.
  - 대상이 없는 서버 `staging-empty`의 행은 상태가 `대기`이고 수치 칸은 `-`이다.
  - 검색창에 모니터 이름을 넣으면 그 모니터가 속한 서버만 남고, 서버 이름 아래에 모니터 이름이 보이며, 주소에 `q=`가 들어간다.
  - 상태 요약의 `장애` 버튼을 누르면 장애 서버만 남고 `aria-pressed="true"`, 주소에 `status=error`가 들어간다. 다시 누르면 해제된다.
  - 그룹 필터를 고르면 그 그룹의 서버만 남는다.
  - 서버 이름을 누르면 `/servers/<id>`로 이동한다(Task 5 전에는 화면이 없으므로 주소만 확인한다).
  - 결과가 없는 검색어를 넣으면 결과 없음 안내와 필터 해제 버튼이 보인다.
  - 데모 시나리오를 `empty`로 바꾸면(`demo-data.spec.ts`가 시나리오를 바꾸는 방식을 따른다) 서버 없음 안내와 `서버 추가` 버튼이 보인다.
  - 뷰포트 320×700에서 `document.documentElement.scrollWidth <= clientWidth`이다.
  - (Review Focus 1) Docker 환경에서 온 인프라 리소스의 이름이 표 어디에도 없다.
  - (Review Focus 2) `partial-failure` 시나리오에서 "일부 정보를 불러오지 못했습니다"가 보이고, 서버 행은 그대로 그려진다.
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- servers-list.spec.ts` / Expected: FAIL(화면 없음).
- [ ] **Step 3: 구현한다.** `projectMembers.ts`가 새 상태 함수를 쓰도록 바꾸되 그룹 화면의 동작은 바꾸지 않는다(인프라 사용률의 경고만 새로 반영된다).
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. Global Constraints의 디자인 검사 두 명령을 실행하여 기준선을 넘지 않는지 확인하고 수치를 보고서에 적는다.
- [ ] **Step 5: 커밋한다** — `feat(server): server list`

---

### Task 5: 서버 상세의 뼈대와 개요 탭

**Files:**
- Create: `src/pages/servers/ServerDetailPage.tsx`
- Create: `src/features/servers/components/ServerHeader.tsx`, `ServerOverviewTab.tsx`, `ServerCapabilityPlaceholder.tsx`
- Modify: `src/App.tsx` (라우트 `/servers/:serverId`, `/servers/:serverId/:capability`, `/servers/:serverId/:capability/:targetId`)
- Test: `web/frontend/e2e/servers-detail.spec.ts` (신규)

**Interfaces:**
- Consumes: Task 3의 `Tabs`, Task 4의 `useServers`, `ServerRow`, `serverPath`, `SERVER_CAPABILITIES`.
- Produces: `ServerDetailPage`가 탭마다 그릴 내용을 다음 형태의 컴포넌트로 받는다. Task 7~10이 이 자리를 하나씩 채운다.

```ts
export interface ServerCapabilityTabProps {
  row: ServerRow;
  /** 경로의 :targetId. 없으면 탭의 첫 화면 */
  targetId?: string;
  /** 대상이 추가·삭제·이동된 뒤 서버 데이터를 다시 불러온다 */
  onChanged: () => void;
}
```

이 작업에서는 다섯 기능 탭 모두 `ServerCapabilityPlaceholder`(연결된 대상의 이름 목록만 보여 주는 임시 본문)를 그린다.

**화면 (설계 문서 6.4절).**
- 주소의 `:capability`가 `SERVER_CAPABILITIES`에 없는 값이면 개요 탭으로 `replace` 이동한다. 서버를 찾지 못하면 "서버를 찾을 수 없습니다"와 서버 목록으로 가는 링크를 보여 준다.
- 경로 표시: `useBreadcrumb([{ label: server.name, to: serverPath(id) }])`. 특정 대상의 주소에서는 대상 이름을 한 칸 더 붙인다. 탭은 경로 표시에 넣지 않는다. 사이드바의 섹션 연결은 Task 13이 한다.
- 머리말(`ServerHeader`): h1은 서버 이름, `StatusLight`, 원인 문구(문제 대상으로 가는 링크, `cause`가 있을 때만), 그룹 이름(없으면 `미분류`). 조작은 `새로고침`이다. 서버 설정은 Task 6이 추가한다. 여러 사실을 가운뎃점으로 잇지 않고 `DetailMeta`를 쓴다.
- 탭: 키는 `overview`와 다섯 기능이다. 탭을 바꾸면 `navigate(serverPath(...))`로 경로를 바꾼다(개요는 `serverPath(id)`). 이미 선택된 탭을 다시 누르면 그 탭의 첫 화면(`:targetId` 없는 주소)으로 간다.
  - 기능의 상태가 error 또는 warn이면 `tone`과 `toneLabel`(`장애`, `확인 필요`)을 준다.
  - 연결된 대상이 없는 기능은 `muted`와 `caption: '연결 전'`을 준다.
  - 탭 이름 옆에 대상 수를 숫자로 표시하지 않는다.
- 탭 패널은 `role="tabpanel"`이고 `tabPanelId`와 `aria-labelledby`를 가진다.
- 개요 탭(`ServerOverviewTab`):
  - 진행 중인 장애(모니터의 `activeIncident`)가 있으면 맨 위에 상태 배너를 둔다. 배너의 링크는 그 모니터의 주소(`serverPath(id, 'uptime', monitorId)`)이다.
  - 연결된 기능을 섹션 행으로 나열한다. 카드로 감싸지 않는다. 각 행은 기능 이름(`type-card-title`), `StatusLight`, 수치 두세 개, 해당 탭으로 가는 링크로 구성하고, 상태가 나쁜 기능을 위에 둔다. 수치는 업타임(모니터 수, 24시간 가용률), 인프라(CPU, 메모리, 디스크), 로그(앱 수, 24시간 오류 로그), API 요청(앱 수), 메트릭(앱 수)이다. 업타임 행에는 최근 체크 띠(`RecentUptimeChecks`)를 모니터별로 넣는다(모니터가 3개를 넘으면 상태가 나쁜 순으로 3개까지).
  - 연결되지 않은 기능은 맨 아래 "연결할 수 있는 기능" 섹션 하나에 텍스트 버튼(`Button variant="text"`)으로 모은다. 버튼은 해당 탭으로 이동한다.
  - 대상이 하나도 없는 서버에서는 위 내용 대신 `EmptyState` 하나를 보여 준다. 제목은 "아직 연결한 기능이 없습니다", 주 버튼은 `업타임 모니터 추가`(업타임 탭으로 이동), 나머지 네 기능은 보조 버튼이다.

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`servers-detail.spec.ts`, 데모 빌드 대상)
  - 장애 서버를 열면 h1이 서버 이름이고, 머리말에 `장애`와 원인 링크가 있으며, 원인 링크의 주소가 그 모니터의 `/servers/<id>/uptime/<monitorId>`이다.
  - 탭 목록(`role="tablist"`)에 개요, 업타임, 인프라, 로그, API 요청, 메트릭이 이 순서로 있다. 업타임 탭에 이름이 `장애`인 상태 점이 있다.
  - 일부 기능만 연결된 서버에서 연결되지 않은 탭에 `연결 전`이 보인다.
  - 로그 탭을 누르면 주소가 `/servers/<id>/logs`가 되고 `aria-selected="true"`가 로그 탭으로 옮겨 가며, 뒤로 가기로 개요 탭에 돌아온다.
  - 개요 탭에서 장애 배너가 가장 위에 있고, 기능 섹션 가운데 업타임이 가장 위에 있다.
  - `staging-empty` 서버의 개요에는 "아직 연결한 기능이 없습니다"와 `업타임 모니터 추가` 버튼이 있다.
  - `./servers/<id>/nonsense`는 `./servers/<id>`로 바뀐다. `./servers/missing`은 "서버를 찾을 수 없습니다"와 서버 목록 링크를 보여 준다.
  - 뷰포트 320×700에서 페이지에 가로 스크롤이 없고, 탭 목록은 한 줄이다(탭 목록의 높이가 탭 하나의 높이와 같다).
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- servers-detail.spec.ts` / Expected: FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. 디자인 검사 두 명령의 수치를 보고서에 적는다.
- [ ] **Step 5: 커밋한다** — `feat(server): server detail shell and overview tab`

---

### Task 6: 서버 추가, 설정, 합치기, 삭제

**Files:**
- Create: `src/pages/servers/ServerFormPage.tsx`
- Create: `src/features/servers/components/ServerSettingsDialog.tsx`, `MergeServerDialog.tsx`
- Modify: `src/features/servers/components/ServerHeader.tsx`, `src/App.tsx`(라우트 `/servers/new`. `/servers/:serverId`보다 앞에 둔다.)
- Test: `web/frontend/e2e/servers-manage.spec.ts` (신규)

**Interfaces:**
- Consumes: `api.createServer`, `updateServer`, `deleteServer`, `mergeServer`, `api.getProjects`.

**화면 (설계 문서 6.5절).**
- 서버 추가(`/servers/new`): 입력은 이름(필수), 설명, 그룹(선택 상자, 첫 항목 `미분류`)이다. 기능을 고르는 체크박스는 두지 않는다. 버튼은 `서버 만들기`(primary)와 `취소`이다. 만들면 `serverPath(newId)`로 이동하고 토스트로 알린다. 409 `SERVER_NAME_TAKEN`이면 이름 입력란 아래에 "이 그룹에 같은 이름의 서버가 있습니다"를 보여 주고 입력을 유지한다. 저장하는 동안에는 입력과 버튼을 비활성화한다.
- 서버 설정(`ServerSettingsDialog`): 머리말의 `서버 설정` 버튼이 연다. 이름, 설명, 그룹을 바꾼다. 수정 요청은 전체 교체이므로 세 값을 항상 모두 보낸다. 409 처리는 추가 화면과 같다.
- **(수정 1차에서 변경됨)** 합치기의 방향이 "다른 서버 여러 개를 이 서버로 가져오기"로 바뀌었다. 설계 문서 6.5절과 수정 지시서(`task-6-fix-1.md`)가 기준이며, 아래 문단은 처음 구현의 기록이다.
- 합치기(`MergeServerDialog`): 서버 설정 안의 `다른 서버와 합치기`가 연다. 대상 서버를 고르는 선택 상자와, 옮겨질 대상의 종류별 개수를 보여 준다. 이 서버와 대상 서버가 모두 인프라 리소스를 가지고 있으면 그 서버를 선택지에서 비활성으로 표시하고 이유("인프라 리소스가 이미 있습니다")를 붙인다. 확인하면 `mergeServer`를 호출하고 대상 서버의 화면으로 이동한다.
- 삭제: 서버 설정 안의 `서버 삭제`(붉은 글자의 조작, 중립 표면). `ConfirmDialog variant="danger"`에서 함께 삭제되는 대상의 종류별 개수(업타임 모니터, 앱, 인프라 리소스)와 "수집된 데이터도 함께 삭제됩니다"를 보여 준다. 삭제하면 `/servers`로 이동한다.

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`servers-manage.spec.ts`, 데모 빌드 대상. mock은 쓰기 요청을 메모리에 반영한다.)
  - `./servers/new`에서 이름을 비우고 제출하면 요청이 나가지 않는다(폼 검증). 이름 `new-box`로 만들면 `/servers/<새 id>`로 이동하고 개요에 "아직 연결한 기능이 없습니다"가 보인다. 서버 목록에 `new-box`가 있다.
  - 이미 있는 서버의 이름(같은 그룹)으로 만들면 "이 그룹에 같은 이름의 서버가 있습니다"가 보이고 입력한 이름이 남아 있다.
  - 서버 설정에서 이름을 바꾸면 h1이 바뀐다. 그룹을 바꾸면 머리말의 그룹이 바뀐다.
  - 대상이 있는 서버를 `staging-empty`로 합치면 `staging-empty`의 화면으로 이동하고, 원래 서버는 목록에서 사라지며, 옮겨 온 대상이 `staging-empty`의 탭에 보인다.
  - 인프라 리소스가 있는 서버의 합치기 대화 상자에서, 인프라 리소스가 있는 다른 서버는 선택할 수 없다(`disabled`).
  - 서버 삭제의 확인 창에 대상의 종류별 개수가 보이고, 삭제하면 `/servers`로 이동하며 목록에서 사라진다.
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- servers-manage.spec.ts` / Expected: FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. 디자인 검사 두 명령의 수치를 보고서에 적는다.
- [ ] **Step 5: 커밋한다** — `feat(server): add, edit, merge and delete servers`

---

### Task 7: 업타임 탭

**Files:**
- Create: `src/features/uptime/components/UptimeMonitorPanel.tsx` (`pages/uptime/UptimeMonitorDetailPage.tsx`의 본체와 그 파일 안의 비공개 컴포넌트를 옮긴다)
- Create: `src/features/uptime/components/UptimeMonitorList.tsx` (`pages/capabilities/AgentServiceCapabilityPage.tsx`의 목록 본문을 옮긴다)
- Create: `src/features/servers/components/ServerUptimeTab.tsx`, `MoveTargetDialog.tsx`, `ConnectPrompt.tsx`
- Modify: `src/features/uptime/components/UptimeTargets.tsx`(링크를 props로 받는다), `pages/uptime/UptimeMonitorDetailPage.tsx`와 `AgentServiceCapabilityPage.tsx`(새 컴포넌트를 쓰는 얇은 껍데기로 바꾼다. Task 13에서 삭제한다.), `src/pages/servers/ServerDetailPage.tsx`
- Test: `web/frontend/e2e/servers-uptime.spec.ts` (신규)

**Interfaces:**
- Consumes: `ServerCapabilityTabProps`.
- Produces:

```ts
// UptimeTargets의 Props에 추가. 하드코딩된 `/uptime/${monitor.id}`를 대체한다.
hrefFor: (monitor: UptimeMonitor) => string;

export function UptimeMonitorPanel(props: {
  monitorId: string;
  /** 삭제가 끝난 뒤 */
  onDeleted: () => void;
  /** 찾지 못했을 때와 모바일 복귀 링크의 목적지 */
  back: { label: string; to: string };
  /** 알림 규칙, 수정, 삭제 옆에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  extraActions?: ReactNode;
}): JSX.Element

export function UptimeMonitorList(props: {
  /** 이 목록이 다루는 모니터만 고른다 */
  filter: (monitor: UptimeMonitor) => boolean;
  hrefFor: (monitor: UptimeMonitor) => string;
  /** 새 모니터를 만들 때 입력에 덧붙일 값(예: { serverId }) */
  createDefaults?: Partial<UptimeMonitorInput>;
  /** 목록 화면의 조작(보기 전환, 추가 버튼)을 그릴 자리. 없으면 목록 위에 그린다 */
  renderControls?: (controls: { viewToggle: ReactNode; addButton: ReactNode; refresh: ReactNode }) => ReactNode;
  onChanged?: () => void;
}): JSX.Element

// 대상 종류에 공통인 이동 대화 상자 (Task 8~10도 사용)
export function MoveTargetDialog(props: {
  kind: 'monitor' | 'app' | 'infrastructure';
  targetName: string;
  currentServerId: string;
  onClose: () => void;
  /** 선택한 서버로 옮긴다. 실패하면 던진다 */
  onMove: (serverId: string) => Promise<void>;
}): JSX.Element

// 연결되지 않은 탭의 안내 (Task 8~10도 사용)
export function ConnectPrompt(props: { title: string; description: string; children: ReactNode }): JSX.Element
// EmptyState를 쓰고, children 자리에 연결을 시작하는 버튼을 받는다.
```

**동작 (설계 문서 6.4절의 표).**
- 모니터가 0개: `ConnectPrompt`(제목 "이 서버의 업타임 모니터를 추가하세요", 설명 "확인할 URL이나 호스트와 포트만 입력하면 됩니다. 서버에 설치할 것은 없습니다.")와 `업타임 모니터 추가` 버튼. 버튼은 `UptimeMonitorDialog`를 열고, 저장 시 `createUptimeMonitor({ ...input, serverId })`를 호출한다.
- 모니터가 1개이고 `targetId`가 없음: 그 모니터의 `UptimeMonitorPanel`을 바로 보여 준다. 패널 위에 `모니터 추가` 버튼(secondary)을 둔다.
- 모니터가 2개 이상이고 `targetId`가 없음: `UptimeMonitorList`(상태 필터, 보기 전환, 카드 보기의 선택과 일괄 일시 중지·재개·삭제, 최근 체크). `hrefFor`는 `serverPath(serverId, 'uptime', monitor.id)`이다.
- `targetId`가 있음: 그 모니터의 `UptimeMonitorPanel`. 이 서버에 속하지 않은 모니터의 ID이면 "이 서버의 모니터가 아닙니다"와 탭의 첫 화면으로 가는 링크를 보여 준다. 모바일에서는 `← 목록으로` 링크를 둔다(`back`).
- 패널의 `extraActions`에 `다른 서버로 옮기기`를 넣는다. `MoveTargetDialog`의 `onMove`는 `updateUptimeMonitor(id, { ...현재 값, serverId })`를 호출하고, 성공하면 옮겨 간 서버의 그 모니터 주소로 이동한다.
- `MoveTargetDialog`: 현재 서버를 제외한 서버를 이름순으로 보여 준다. `kind`가 `infrastructure`이면 이미 인프라 리소스가 있는 서버를 비활성으로 표시한다. 옮길 서버가 하나도 없으면 "옮길 수 있는 다른 서버가 없습니다"와 서버 추가 링크를 보여 준다.
- 삭제, 추가, 이동 뒤에는 `onChanged`로 서버 데이터를 다시 불러온다. 삭제 후에는 탭의 첫 화면으로 간다.
- 생성이 끝난 뒤 포커스를 탭 패널의 제목으로 옮기고 토스트로 결과를 알린다.

옮기는 과정에서 기존 화면(`/uptime`, `/uptime/:monitorId`)의 동작이 달라지면 안 된다. 기존 업타임 e2e가 그대로 통과해야 한다.

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`servers-uptime.spec.ts`, 데모 빌드 대상)
  - 모니터가 2개 이상인 서버의 업타임 탭에 모니터 목록이 보이고, 다른 서버의 모니터는 없다. 모니터를 누르면 `/servers/<id>/uptime/<monitorId>`로 이동하고 그 모니터의 상세(응답 시간 차트, 장애 이력)가 보인다. 경로 표시에 모니터 이름이 있다.
  - 모니터가 1개인 서버의 업타임 탭은 목록 없이 그 모니터의 상세를 바로 보여 준다.
  - `staging-empty`의 업타임 탭에서 `업타임 모니터 추가`로 모니터를 만들면 그 서버의 업타임 탭에 상세가 보이고, 서버 목록에서 그 서버의 상태가 `대기`에서 바뀐다.
  - 모니터를 `다른 서버로 옮기기`로 옮기면 옮겨 간 서버의 주소로 이동하고, 원래 서버의 업타임 탭에서는 사라진다.
  - 모니터를 삭제하면 그 서버의 업타임 탭의 첫 화면으로 돌아간다.
  - 다른 서버의 모니터 ID를 주소에 넣으면 "이 서버의 모니터가 아닙니다"가 보인다.
  - 목록의 상태 필터와 카드 보기의 일괄 일시 중지가 그 서버의 모니터에만 적용된다.
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- servers-uptime.spec.ts` / Expected: FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과(기존 업타임 spec 포함). 디자인 검사 두 명령의 수치를 보고서에 적는다.
- [ ] **Step 5: 커밋한다** — `feat(server): uptime tab`

---

### Task 8: 인프라 탭

**Files:**
- Create: `src/features/infra/components/InfrastructurePanel.tsx` (`pages/capabilities/DirectInfrastructureDetailPage.tsx`의 본체를 옮긴다)
- Create: `src/features/servers/components/ServerInfrastructureTab.tsx`
- Modify: `src/features/infrastructure/components/InfrastructureCollectorSetupDialog.tsx`, `src/features/telemetry/components/DirectConnectionMeta.tsx`, `pages/capabilities/DirectInfrastructureDetailPage.tsx`(얇은 껍데기), `src/pages/servers/ServerDetailPage.tsx`
- Test: `web/frontend/e2e/servers-infrastructure.spec.ts` (신규)

**Interfaces:**
- Consumes: `ServerCapabilityTabProps`, Task 7의 `MoveTargetDialog`, `ConnectPrompt`.
- Produces:

```ts
export function InfrastructurePanel(props: {
  resourceId: string;
  onDeleted: () => void;
  back: { label: string; to: string };
  extraActions?: ReactNode;
  /** 서버 화면에서는 그룹을 서버가 정하므로 그룹 선택을 숨긴다 */
  hideGroup?: boolean;
}): JSX.Element

// InfrastructureCollectorSetupDialog의 props에 추가
serverId?: string;   // 주어지면 생성 입력에 넣고 그룹 선택을 숨긴다

// DirectConnectionMeta: 그룹 관련 props(projects, projectId, savedProjectId, onProjectChange, onSaveProject, savingProject 등)를 모두 선택으로 바꾸고, 주어지지 않으면 그룹 영역을 그리지 않는다.
```

**동작.**
- 인프라 리소스가 없음: `ConnectPrompt`(제목 "이 서버의 인프라를 연결하세요", 설명 "CPU, 메모리, 디스크를 수집합니다. 서버에 OpenTelemetry Collector를 설치해야 합니다.")와 `인프라 연결` 버튼. 버튼은 `InfrastructureCollectorSetupDialog`를 `serverId`와 함께 연다.
- 있음: `InfrastructurePanel`(`hideGroup`). `extraActions`에 `다른 서버로 옮기기`(`MoveTargetDialog kind="infrastructure"`). 이동은 `updateInfrastructureResource(id, { name, serverId })`이다.
- 이 탭에는 `targetId`가 없다. `targetId`가 붙은 주소로 들어오면 탭의 첫 화면으로 `replace` 이동한다.
- 리소스를 삭제하면 탭은 연결 안내로 돌아간다.

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`servers-infrastructure.spec.ts`)
  - 인프라 리소스가 있는 서버의 인프라 탭에 사용률 추이 차트와 연결 정보가 보이고, 그룹 선택은 보이지 않는다.
  - 인프라 리소스가 없는 서버의 탭에는 연결 안내가 보이고, `인프라 연결`로 리소스를 만들면 설정 안내(키와 Collector 설정)가 뜨며, 닫은 뒤에 탭에 상세가 보인다.
  - `다른 서버로 옮기기` 대화 상자에서 이미 인프라 리소스가 있는 서버는 선택할 수 없다. 인프라 리소스가 없는 서버로 옮기면 그 서버의 인프라 탭으로 이동한다.
  - 삭제하면 연결 안내로 돌아간다.
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- servers-infrastructure.spec.ts` / Expected: FAIL.
- [ ] **Step 3: 구현한다.** `DirectConnectionMeta`의 props를 바꾸므로 호출자 전체(로그, API, 메트릭 상세 페이지 포함)가 그대로 동작하는지 확인한다.
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. 디자인 검사 두 명령의 수치를 보고서에 적는다.
- [ ] **Step 5: 커밋한다** — `feat(server): infrastructure tab`

---

### Task 9: 로그 탭과 앱 패널의 공용 훅

**Files:**
- Create: `src/features/telemetry/useDirectServicePanel.ts`
- Create: `src/features/telemetry/components/DirectLogsPanel.tsx` (`pages/capabilities/DirectLogsDetailPage.tsx`의 본체를 옮긴다)
- Create: `src/features/servers/components/ServerLogsTab.tsx`
- Modify: `src/features/telemetry/components/DirectTelemetrySetupDialog.tsx`, `src/features/logs/components/LogServiceOverview.tsx`(필요한 경우), `pages/capabilities/DirectLogsDetailPage.tsx`(얇은 껍데기), `src/pages/servers/ServerDetailPage.tsx`
- Test: `web/frontend/e2e/servers-logs.spec.ts` (신규)

**Interfaces:**
- Consumes: `ServerCapabilityTabProps`, `MoveTargetDialog`, `ConnectPrompt`, `api.getLogSummary(serverId)`, `api.getLogPatterns({ serverId })`.
- Produces (Task 10이 그대로 사용한다):

```ts
// 로그·API·메트릭 상세 페이지 세 곳에 중복되어 있는 로직(서비스 조회, 키 재발급, 연결 중지,
// 삭제 또는 신호 연결 해제, 확인 대화 상자의 상태)을 한 곳으로 모은다.
export function useDirectServicePanel(serviceId: string, signal: TelemetrySignal, onRemoved: () => void): {
  service: ObservedService | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** DirectConnectionMeta에 그대로 넘길 연결 관련 props (그룹 관련 props는 포함하지 않는다) */
  connection: { isActive: boolean; apiKeyMasked?: string; lastSeenAt?: string | null; onRotateKey: () => void; onRevoke: () => void };
  /** 삭제 또는 "신호 연결 해제" 버튼 */
  removalButton: ReactNode;
  /** 확인 대화 상자와 재발급된 키 대화 상자. 패널이 렌더링 트리에 넣는다 */
  dialogs: ReactNode;
  /** 다른 서버로 옮긴다 */
  move: (serverId: string) => Promise<void>;
}

export function DirectLogsPanel(props: {
  serviceId: string;
  onRemoved: () => void;
  back: { label: string; to: string };
  extraActions?: ReactNode;
}): JSX.Element

// DirectTelemetrySetupDialog의 props에 추가
serverId?: string;
// 주어지면 (1) 새 앱의 생성 입력에 serverId를 넣고, (2) "기존 서비스에 추가"의 후보를 그 서버의 앱으로 제한하며,
// (3) 그룹 선택을 숨기고, (4) 기존 앱에 신호를 추가하는 수정 요청에도 serverId를 넣는다.
```

**동작 (설계 문서 6.4절).**
- 로그 신호를 가진 앱이 없음: `ConnectPrompt`(제목 "이 서버의 로그를 연결하세요", 설명 "서버에서 실행되는 앱이 OTLP로 로그를 보냅니다. 앱마다 연결을 하나씩 만듭니다.")와 `로그 연결` 버튼. 버튼은 `DirectTelemetrySetupDialog`를 `signal="logs"`, `serverId`와 함께 연다.
- 1개 이상이고 `targetId`가 없음: 서버 범위의 요약과 패턴, 앱 목록. `LogServiceOverview`를 재사용하며, 데이터는 `getObservedServices('logs')`에서 이 서버의 앱만 고르고 `getLogSummary(serverId)`, `getLogPatterns({ serverId })`를 쓴다(`pages/capabilities/LogsPage.tsx`의 20~43행과 `withLogSummaries`의 구성을 따른다). 각 앱 행의 `to`는 `serverPath(serverId, 'logs', app.id) + '?range=24h'`이다. 패턴 행은 지금처럼 그 앱의 주소에 `pattern` 쿼리를 붙인다. 목록 위에 `앱 연결 추가` 버튼(secondary)을 둔다. 제목(`title`)은 `앱`이다. 서버 범위의 검색창과 수준 필터는 두지 않는다.
- `targetId`가 있음: 그 앱의 `DirectLogsPanel`. 이 서버의 앱이 아니면 "이 서버의 앱이 아닙니다"와 탭의 첫 화면 링크를 보여 준다. `extraActions`에 `다른 서버로 옮기기`(`MoveTargetDialog kind="app"`)를 넣는다.
- 기존 화면의 그룹 저장(`saveProject`)은 패널로 옮기지 않는다. 그룹은 서버가 정한다.
- 패턴 조회만 실패하면 앱 목록은 그대로 그리고 패턴 영역에 다시 시도 버튼을 보여 준다(`LogServiceOverview`의 `patterns: null` 동작).

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`servers-logs.spec.ts`)
  - 로그 앱이 2개 이상인 서버의 로그 탭에 앱 목록과 패턴 표가 보이고, 다른 서버의 앱과 패턴은 없다.
  - 앱을 누르면 `/servers/<id>/logs/<appId>`로 이동하고 로그 목록이 보인다. 패턴을 누르면 주소에 `pattern=`이 붙은 앱 화면으로 이동하고 목록이 그 패턴으로 좁혀진다.
  - 로그 앱이 없는 서버의 탭에는 연결 안내가 보이고, `로그 연결`로 앱을 만들면 키 안내가 뜬 뒤에 탭에 그 앱이 보인다. 만든 앱의 `serverId`가 이 서버인지는 서버 목록에서 이 서버의 상태가 바뀌는 것으로 확인한다.
  - 메트릭만 연결된 앱이 있는 서버에서 `로그 연결` 대화 상자의 "기존 서비스에 추가" 후보에 그 앱만 보이고 다른 서버의 앱은 보이지 않는다.
  - 앱을 다른 서버로 옮기면 옮겨 간 서버의 주소로 이동하고 원래 서버의 로그 탭에서 사라진다.
  - 다른 서버의 앱 ID를 주소에 넣으면 "이 서버의 앱이 아닙니다"가 보인다.
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- servers-logs.spec.ts` / Expected: FAIL.
- [ ] **Step 3: 구현한다.** `DirectTelemetrySetupDialog`와 `LogServiceOverview`의 다른 호출자(Docker 환경 화면 포함)가 그대로 동작하는지 확인한다.
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. 디자인 검사 두 명령의 수치를 보고서에 적는다.
- [ ] **Step 5: 커밋한다** — `feat(server): logs tab and shared direct-service panel logic`

---

### Task 10: API 요청 탭과 메트릭 탭

**Files:**
- Create: `src/features/telemetry/components/DirectApiPanel.tsx`, `DirectMetricsPanel.tsx` (각각 `DirectApiDetailPage.tsx`, `DirectMetricsDetailPage.tsx`의 본체를 옮기고 `useDirectServicePanel`을 쓴다)
- Create: `src/features/servers/components/ServerAppTab.tsx`, `AppSelector.tsx`
- Modify: `pages/capabilities/DirectApiDetailPage.tsx`, `DirectMetricsDetailPage.tsx`(얇은 껍데기), `src/pages/servers/ServerDetailPage.tsx`
- Test: `web/frontend/e2e/servers-apps.spec.ts` (신규)

**Interfaces:**
- Consumes: Task 9의 `useDirectServicePanel`과 `DirectLogsPanel`의 props 형태, `MoveTargetDialog`, `ConnectPrompt`.
- Produces:

```ts
export function DirectApiPanel(props: { serviceId: string; onRemoved: () => void; back: { label: string; to: string }; extraActions?: ReactNode }): JSX.Element
export function DirectMetricsPanel(props: { serviceId: string; onRemoved: () => void; back: { label: string; to: string }; extraActions?: ReactNode }): JSX.Element

export function AppSelector(props: {
  apps: { id: string; name: string; state: StatusTone; stateLabel: string }[];
  value: string;
  onChange: (appId: string) => void;
  ariaLabel: string;
}): JSX.Element
// 앱이 4개 이하이면 SegmentedControl, 넘으면 Select를 쓴다. 선택지마다 상태 점(이름은 stateLabel)을 보여 준다.

// 두 탭에 공통인 본문
export function ServerAppTab(props: ServerCapabilityTabProps & { capability: 'api' | 'metrics' }): JSX.Element
```

**동작 (설계 문서 6.4절).**
- 대상 앱: API 요청 탭은 `traces` 신호, 메트릭 탭은 `metrics` 신호를 가진 이 서버의 앱이다.
- 0개: `ConnectPrompt`. API 요청은 제목 "이 서버의 API 요청을 연결하세요", 설명 "앱이 OTLP로 트레이스를 보내면 요청 상태와 오류를 확인할 수 있습니다." 메트릭은 제목 "이 서버의 메트릭을 연결하세요", 설명 "앱이 OTLP로 보내는 메트릭을 확인합니다." 버튼은 `DirectTelemetrySetupDialog`를 해당 신호와 `serverId`로 연다.
- 1개: 그 앱의 패널. 선택 컨트롤은 없다.
- 2개 이상: `AppSelector`와 선택한 앱의 패널. `targetId`가 없으면 상태가 가장 나쁜 앱의 주소로 `replace` 이동한다(같은 상태면 이름순 첫 번째). 앱을 고르면 `navigate(serverPath(serverId, capability, appId))`이다. 앱의 상태는 Task 4의 `appState`이다.
- 패널 위에 `앱 연결 추가` 버튼(secondary)과, 패널의 `extraActions`에 `다른 서버로 옮기기`를 둔다.
- API 패널 안의 요청/트레이스 탭과 `range`, 메트릭 패널의 쿼리는 지금처럼 주소의 쿼리를 쓴다. 앱을 바꿀 때는 쿼리를 버린다(다른 앱의 필터가 넘어가지 않게 한다).
- 여러 앱을 합친 화면은 만들지 않는다.

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`servers-apps.spec.ts`)
  - 트레이스 앱이 1개인 서버의 API 요청 탭에 그 앱의 요청 화면이 보이고 선택 컨트롤은 없다.
  - 메트릭 앱이 2개 이상인 서버의 메트릭 탭을 열면 주소가 `/servers/<id>/metrics/<appId>`로 바뀌고, 선택된 앱은 상태가 가장 나쁜 앱이다. 다른 앱을 고르면 주소와 본문이 바뀐다.
  - API 요청 패널 안에서 `트레이스` 탭을 누르면 주소에 `tab=traces`가 붙고, 서버 탭(`role="tablist"` 이름 `서버 기능`)의 선택은 `API 요청` 그대로이다.
  - 연결되지 않은 서버의 메트릭 탭에는 연결 안내가 보인다.
  - 신호가 로그뿐인 앱은 API 요청 탭과 메트릭 탭에 나타나지 않는다.
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- servers-apps.spec.ts` / Expected: FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. 디자인 검사 두 명령의 수치를 보고서에 적는다.
- [ ] **Step 5: 커밋한다** — `feat(server): api request and metrics tabs`

---

### Task 11: 업타임 e2e의 이식

**Files:**
- Modify: `web/frontend/e2e/fixtures/uptime.ts`
- Modify: `web/frontend/e2e/uptime*.spec.ts` 가운데 직접 만든 업타임 모니터를 다루는 spec(약 18개. `uptime-docker.spec.ts`와 `uptime-docker-list.spec.ts`는 Docker 환경 화면을 다루므로 주소가 바뀌는 부분만 고친다.)

옛 주소(`/uptime`, `/uptime/:monitorId`)를 여는 spec을 서버 화면의 주소로 옮긴다. 이 작업이 끝난 뒤에는 `e2e/uptime*.spec.ts`가 옛 업타임 메뉴 화면에 의존하지 않아야 한다. 화면의 동작을 검증하는 내용은 바꾸지 않는다.

- `uptimeFixture(page)`가 반환하는 상태에 `server: { id: 'server-1', name: 'web-01' }`을 추가하고, `GET /servers`, `GET /servers/server-1`과 그 밖에 서버 화면이 호출하는 API(`/observed-services`, `/infrastructure-resources`, `/projects`, `/logs/summary`)를 처리한다. `monitor()` 빌더는 기본값으로 `serverId: 'server-1'`을 넣는다.
- 주소의 대응: `./uptime` → `./servers/server-1/uptime`, `./uptime/<id>` → `./servers/server-1/uptime/<id>`.
- 서버의 업타임 탭은 모니터가 1개이면 목록 없이 상세를 보여 준다. 목록의 동작을 검증하는 spec이 모니터 1개만 준비하고 있으면 두 번째 모니터를 추가한다. 반대로 상세를 검증하는 spec은 그대로 둔다.
- 경로 표시의 첫 칸 `업타임`을 눌러 목록으로 돌아가는 검증은 서버 화면의 경로 표시(`서버`, 서버 이름)와 탭에 맞게 바꾼다. 무엇을 검증하던 것인지(목록으로 돌아갔을 때 검색어와 필터가 유지되는지 등)를 유지한다.
- 옛 화면에만 있던 동작(예: 메뉴 첫 화면의 헤더 조작 위치)을 검증하는 내용은, 같은 동작이 서버 화면에 있으면 옮기고 없으면 삭제한다. 삭제한 검증은 보고서에 spec 이름과 이유를 함께 나열한다.

- [ ] **Step 1: fixture를 고치고 spec을 이식한다.** spec을 하나씩 실행하면서 진행한다(`pnpm test:e2e -- <파일>`).
- [ ] **Step 2: 옛 주소가 남아 있지 않은지 확인한다** — Run: `grep -n -E "['\"\`]\\.?/uptime" e2e/uptime*.spec.ts` / Expected: 출력 없음(백엔드 API 경로 `/services/:id/uptime`의 접미사는 제외).
- [ ] **Step 3: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm test:e2e` / Expected: 모두 통과.
- [ ] **Step 4: 커밋한다** — `test(server): move uptime e2e to server routes`

---

### Task 12: 나머지 e2e의 이식

**Files:**
- Modify: `web/frontend/e2e/fixtures/metrics.ts`
- Modify: `api-layouts`, `api-requests`, `connection-setup`, `demo-data`, `demo`, `first-visit-fixes`, `infrastructure`, `list-views`, `logs-states`, `logs`, `metric-series`, `metrics-detail`, `metrics-explorer`, `metrics-health`, `metrics`, `overview-timeline`, `uptime-alerts` 가운데 옛 메뉴 주소를 여는 spec

Task 11과 같은 방식으로, 옛 주소(`/logs/:id`, `/infrastructure`, `/infrastructure/:id`, `/api`, `/api/:id`, `/metrics`, `/metrics/:id`)를 여는 spec을 서버 화면의 주소로 옮긴다. `/logs`(전체 로그 화면)는 남는 화면이므로 그 화면을 검증하는 spec은 주소를 바꾸지 않는다. `capability-menus.spec.ts`는 이 작업에서 건드리지 않는다(Task 13이 교체한다).

- 데모 빌드 대상 spec은 대상이 속한 서버의 ID를 Task 2의 `SCENARIOS.md`에서 찾아서 쓴다.
- `metricsFixture`도 Task 11의 `uptimeFixture`와 같은 방식으로 서버를 제공한다.
- 옛 목록 화면(`/api`, `/metrics`, `/infrastructure`)에만 있던 동작을 검증하는 spec은 다음과 같이 처리한다. 서버 목록이나 탭에 같은 동작이 있으면 옮기고(예: 정렬, 빈 화면, 연결 흐름), 없으면 삭제한다. 삭제한 검증은 보고서에 spec 이름과 이유를 함께 나열한다.

- [ ] **Step 1: spec을 이식한다.**
- [ ] **Step 2: 옛 주소가 남아 있지 않은지 확인한다** — Run: `grep -n -E "['\"\`]\\.?/(infrastructure|api|metrics)(/|['\"\`?])" e2e/*.spec.ts | grep -v "/api/v1"` 그리고 `grep -n -E "['\"\`]\\.?/logs/" e2e/*.spec.ts` / Expected: 화면 주소로 쓰인 출력이 없음(백엔드 API 경로는 제외). 남은 줄은 보고서에서 하나씩 설명한다.
- [ ] **Step 3: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm test:e2e` / Expected: 모두 통과.
- [ ] **Step 4: 커밋한다** — `test(server): move logs, api, metrics and infrastructure e2e to server routes`

---

### Task 13: 내비게이션 전환과 옛 화면의 제거

**Files:**
- Modify: `src/components/layout/navSections.ts`, `src/App.tsx`, `src/pages/capabilities/LogsPage.tsx`, `src/pages/capabilities/MorePage.tsx`(필요한 경우)
- Create: `src/pages/servers/LegacyTargetRedirect.tsx`
- Delete: `src/pages/capabilities/AgentServiceCapabilityPage.tsx`, `InfrastructurePage.tsx`, `ApiPage.tsx`, `MetricsPage.tsx`, `DirectLogsDetailPage.tsx`, `DirectApiDetailPage.tsx`, `DirectMetricsDetailPage.tsx`, `DirectInfrastructureDetailPage.tsx`, `src/pages/uptime/UptimeMonitorDetailPage.tsx`, `src/pages/capabilities/UptimeList.prototype.tsx`, 그리고 이 삭제로 더 이상 쓰이지 않게 되는 컴포넌트와 훅(`ApiTargets`, `useApiTargets`, `MetricServices`, `useMetricServices`의 사용처를 확인하여 다른 호출자가 없으면 삭제한다)
- Modify: `src/components/common/PrototypeSwitcher.tsx`(업타임 프로토타입 관련 부분 제거)
- Modify: `web/frontend/e2e/capability-menus.spec.ts`를 `e2e/navigation.spec.ts`로 교체
- Test: `web/frontend/e2e/navigation.spec.ts`, `e2e/legacy-routes.spec.ts` (신규)

**Interfaces:**
- Produces:

```ts
// navSections.ts
group?: '모니터링 대상' | '관리';
export const NAV_SECTIONS: NavSection[] = [
  { to: '/', label: '개요', icon: 'dashboard', mobile: 'bottom' },
  { to: '/servers', label: '서버', icon: 'dns', group: '모니터링 대상', mobile: 'bottom', aliases: ['/logs'] },
  { to: '/environments', label: 'Docker 환경', icon: <지금 Docker 환경이 쓰는 것과 다른 아이콘>, group: '모니터링 대상', mobile: 'more', aliases: ['/agents', '/services'], description: 'Collector 연결과 발견된 서비스를 관리합니다.' },
  { to: '/projects', label: '그룹', icon: 'folder_open', group: '모니터링 대상', mobile: 'more', description: '서버와 Docker 환경을 묶어서 봅니다.' },
  { to: '/alerts', label: '알림', icon: 'notifications', group: '관리', mobile: 'bottom' },
  { to: '/settings', label: '환경 설정', icon: 'settings', group: '관리', mobile: 'more', description: 'EveryUp 환경을 설정합니다.' },
];

// LegacyTargetRedirect.tsx
export function LegacyTargetRedirect(props: { kind: ServerCapability }): JSX.Element
```

- 아이콘: 서버와 Docker 환경이 같은 아이콘을 쓰지 않게 한다. `MaterialIcon`에 등록된 아이콘(`materialIconPaths.ts`) 가운데서 고르고, 새 아이콘이 필요하면 path 데이터를 추가한다.
- 사이드바의 장애 수 배지는 지금처럼 개요 항목에 둔다.
- 라우트:
  - `/uptime`, `/infrastructure`, `/api`, `/metrics`, `/services` → `<Navigate to="/servers" replace />`
  - `/uptime/:monitorId`, `/logs/:serviceId`, `/api/:serviceId`, `/metrics/:serviceId`, `/infrastructure/:resourceId` → `LegacyTargetRedirect`
  - `/logs`는 `LogsPage`를 유지한다.
- `LegacyTargetRedirect`: 주소의 ID로 대상을 조회하여(`getUptimeMonitor`, `getObservedService`, `getInfrastructureResource`) `serverId`를 얻고, `serverPath(serverId, kind, id)`에 원래의 쿼리 문자열과 해시를 붙여 `replace` 이동한다. 인프라는 `targetId` 없이 `serverPath(serverId, 'infrastructure')`로 간다. 조회하는 동안에는 로딩 표시를, 대상을 찾지 못하거나 `serverId`가 없으면 "대상을 찾을 수 없습니다"와 서버 목록 링크(`EmptyState`)를 보여 준다.
- 전체 로그(`LogsPage`): 제목과 경로 표시를 `전체 로그`로 바꾼다(`PageHeader`의 `menu`는 쓰지 않는다. 사이드바에 없는 화면이므로 제목을 숨기지 않는다). 각 행에 서버 이름을 함께 표시하고, 행과 패턴의 링크를 `serverPath(serverId, 'logs', app.id)`로 바꾼다. 헤더의 `로그 연결` 버튼은 없앤다(연결은 서버의 로그 탭에서 한다). 빈 화면의 안내는 서버 목록으로 보낸다.
- 삭제한 페이지를 참조하는 곳이 남지 않게 한다(`grep -rn "DirectLogsDetailPage\|AgentServiceCapabilityPage" src`).

- [ ] **Step 1: 실패하는 e2e를 작성한다**
  - `navigation.spec.ts`(데모 빌드 대상):
    - `주 메뉴` 내비게이션의 링크가 `개요, 서버, Docker 환경, 그룹, 알림, 환경 설정` 순서이고, `업타임`, `로그`, `인프라`, `API 요청`, `메트릭` 링크가 없다. 그룹 제목은 `모니터링 대상`과 `관리`이다.
    - 서버 상세 화면에서 사이드바의 `서버`가 현재 위치(`aria-current="page"`)이고, 경로 표시의 첫 칸이 `서버`이다.
    - 뷰포트 390×844에서 하단 내비게이션에 `개요, 서버, 알림, 더보기`가 있고, 더보기 화면에 `Docker 환경, 그룹, 환경 설정`이 있다.
    - 명령 팔레트를 열어 `서버`를 검색하면 서버 화면으로 가는 항목이 있다.
    - `./logs`의 제목은 `전체 로그`이고, 행에 서버 이름이 보이며, 행을 누르면 `/servers/<id>/logs/<appId>`로 이동한다.
  - `legacy-routes.spec.ts`(데모 빌드 대상):
    - `./uptime`, `./infrastructure`, `./api`, `./metrics`는 `./servers`로 바뀐다.
    - `./uptime/<모니터 ID>`는 `./servers/<serverId>/uptime/<모니터 ID>`로 바뀐다.
    - (Review Focus 3) `./logs/<앱 ID>?range=6h&pattern=abc`는 `./servers/<serverId>/logs/<앱 ID>?range=6h&pattern=abc`로 바뀐다.
    - `./infrastructure/<리소스 ID>`는 `./servers/<serverId>/infrastructure`로 바뀐다.
    - `./metrics/missing`은 "대상을 찾을 수 없습니다"와 서버 목록 링크를 보여 준다.
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- navigation.spec.ts legacy-routes.spec.ts` / Expected: FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. Task 11과 12에서 spec을 이미 옮겼으므로 전체가 통과해야 한다. 실패하는 spec이 있으면 옛 주소에 의존하는 부분이 남아 있는 것이므로 그 spec을 고친다. 디자인 검사 두 명령의 수치를 보고서에 적는다(삭제된 파일 때문에 수치가 줄어들 수 있다. 줄어든 수치를 새 기준선으로 보고한다).
- [ ] **Step 5: 커밋한다** — `feat(server): servers replace the capability menus`

---

### Task 14: 여러 서버를 가로지르는 화면과 타입 정리

**Files:**
- Modify: `src/pages/overview/OverviewPage.tsx`, `src/pages/overview/Overview.prototype.tsx`(옛 주소 참조 제거 또는 파일 삭제)
- Modify: `src/pages/projects/projectMembers.ts`, `ProjectsPage.tsx`, `ProjectOverviewPage.tsx`, `AddTargetsDialog.tsx`
- Modify: `src/features/alerts/components/AlertRuleForm.tsx`, `src/features/alerts/ruleDisplay.ts`
- Modify: `src/components/layout/CommandPalette.tsx`, `src/features/traces/components/TracePanel.tsx`, `src/features/services/components/MonitoringConnection.tsx`
- Modify: `src/services/api/observedServices.ts`, `hosts.ts`, `projects.ts`(타입 정리)
- Test: `web/frontend/e2e/servers-cross.spec.ts` (신규), 기존 `overview-*.spec.ts`, 그룹·알림 관련 spec

**Interfaces:**
- Produces:

```ts
// 타입 정리 (Review Focus 5)
export interface ObservedServiceInput { name: string; serverId: string; signals: TelemetrySignal[] }   // projectId 제거, serverId 필수
export interface InfrastructureResourceInput { name: string; serverId: string }                       // projectId 제거, serverId 필수
// UptimeMonitorInput.serverId는 선택으로 둔다(수정 요청에서 생략하면 서버가 유지된다).
// projectsApi에서 assignMonitor, unassignMonitor를 제거한다.

// projectMembers.ts
export type AssignableTarget =
  | { kind: 'agent'; item: ConnectedAgent }
  | { kind: 'server'; item: Server };
export type ProjectSources = { agents: ConnectedAgent[]; services: AgentServiceFlat[]; servers: ServerRow[] };
```

**동작 (설계 문서 6.6절).**
- 개요 화면:
  - "현재 확인 필요" 항목의 링크를 `serverPath`로 만든다. 모니터는 `serverPath(serverId, 'uptime', id)`, 앱은 신호에 따라 로그, 메트릭, API 요청 순으로 고른 탭의 주소, 인프라 리소스는 `serverPath(serverId, 'infrastructure')`이다. Docker 환경에서 온 인프라 리소스와 Docker 서비스의 링크는 바꾸지 않는다. 백엔드의 `targetPath`(Task 1)와 형식이 같아야 장애 이력과 연결된다.
  - "모니터링 범위"는 `서버`(서버 수, `/servers`), `Docker 환경`(`/environments`) 두 항목과 `그룹으로 정리` 링크로 줄인다.
  - 대상이 하나도 없을 때의 버튼은 `서버 추가`(`/servers/new`, primary)와 `Docker 연결`(secondary)이다.
  - `전체 로그` 링크(`/logs`)를 "현재 확인 필요" 섹션의 머리에 둔다.
- 그룹 화면: 구성원은 Docker 환경, 서버, 그리고 지금처럼 장애 상태인 Docker 서비스이다. 서버 구성원의 상태와 문구는 `ServerRow`의 `state`와 `cause`를 쓰고 링크는 `serverPath(id)`이다. 그룹 목록의 개수 열은 `Docker 환경`과 `서버` 두 개이다. `AddTargetsDialog`는 Docker 환경과 서버만 다루고, 서버의 그룹 지정은 `updateServer(id, { name, description, projectId })`이다. 빈 상태 문구는 "서버나 Docker 환경을 먼저 등록하면 여기에 나타납니다."로 바꾼다.
- 알림 규칙: 대상 선택 상자와 규칙 목록의 대상 라벨에서 직접 대상의 이름 앞에 서버 이름을 붙인다. 형식은 `서버 이름 / 대상 이름`이다(지금의 `직접 연결 / …`, `업타임 / …`, `Collector / …` 접두사를 대체한다). Docker 쪽 라벨은 바꾸지 않는다.
- 명령 팔레트: 서버를 검색 대상에 넣는다(`to: serverPath(id)`, `meta: '서버'`). placeholder는 "서버, Docker 환경, 서비스, 페이지 검색…"이다.
- 트레이스 패널(`traceTargetPath`): 직접 연결 앱의 경로는 옛 주소(`/logs/<id>?…`, `/api/<id>?…`)를 그대로 두고 `LegacyTargetRedirect`가 옮기게 한다. 이 선택의 이유를 `// ponytail:` 주석 한 줄로 남긴다(패널이 앱의 `serverId`를 모르고, 이동 한 번을 위해 조회를 추가하지 않는다).
- `MonitoringConnection`: 다른 호출자가 남아 있으면 `serverId`를 필수 props로 받고 생성 후 `serverPath`로 이동하게 고친다. 호출자가 없으면 삭제한다.
- 타입 정리 뒤에 `pnpm typecheck`가 가리키는 호출부를 모두 고친다. 수정 요청마다 현재의 `serverId`를 넣는다.

- [ ] **Step 1: 실패하는 e2e를 작성한다** (`servers-cross.spec.ts`, 데모 빌드 대상)
  - 개요의 "현재 확인 필요"에서 장애 모니터 항목을 누르면 `/servers/<id>/uptime/<monitorId>`로 이동한다. "최근 장애 이력"의 같은 장애가 그 항목과 연결되어 한 번만 나타난다(기존 `overview-timeline.spec.ts`의 검증 방식을 따른다).
  - 개요의 모니터링 범위에 `서버`와 `Docker 환경`이 있고 `업타임 모니터`, `직접 연결 서비스`, `인프라 리소스`가 없다.
  - 그룹 상세의 구성원에 서버가 있고, 서버를 누르면 서버 화면으로 이동하며 경로 표시가 `그룹 › <그룹 이름>`으로 시작한다(기존 그룹 경로 유지 동작).
  - 그룹의 `대상 추가`에서 서버를 추가하면 그 서버의 머리말에 그룹 이름이 보인다.
  - 알림 규칙 추가 폼의 대상 선택지에 `<서버 이름> / <모니터 이름>` 형식의 항목이 있다.
  - (Review Focus 5) 4174 서버에서 앱의 이름을 바꾸는 흐름을 실행했을 때 `PUT /observed-services/:id` 요청 본문에 `serverId`가 들어 있다(`page.route`로 요청을 기록한다).
- [ ] **Step 2: 실패를 확인한다** — Run: `pnpm test:e2e -- servers-cross.spec.ts` / Expected: FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 옛 주소가 남아 있지 않은지 확인한다** — Run: `grep -rn -E "\`/(uptime|infrastructure|metrics)/|'/(uptime|infrastructure|api|metrics)'" src --include=*.ts --include=*.tsx` / Expected: `App.tsx`의 이동용 라우트와 `TracePanel.tsx`의 주석이 달린 두 줄만 남는다.
- [ ] **Step 5: 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` / Expected: 모두 통과. 디자인 검사 두 명령의 수치를 보고서에 적는다.
- [ ] **Step 6: 커밋한다** — `feat(server): overview, groups, alerts and palette follow servers`

---

### Task 15: 디자인 규약 문서와 최종 검증

**Files:**
- Modify: `web/frontend/DESIGN.md`
- Modify: `web/frontend/src/mocks/SCENARIOS.md`(필요한 경우)

- [ ] **Step 1: `DESIGN.md`를 고친다.** 메뉴를 전제로 한 서술을 서버 화면 기준으로 바꾼다. 대상은 다음 절이다.
  - §3.4 내비게이션 셸: 사이드바 구성, 경로 표시의 예시(`서버 › web-01 › Storefront`), `navSections.ts`의 `group` 값, "탭은 크럼이 아니다"에 서버 상세의 탭 추가, "메뉴 첫 화면의 h1" 규칙의 대상(서버, Docker 환경, 그룹, 알림).
  - §4.5 표: 목록 보기의 대상에서 없어진 메뉴를 빼고 서버 목록(그리드만 제공)을 넣는다. "업타임 목록"과 "메트릭 목록"의 규칙은 각각 서버의 업타임 탭과 서버 화면에 맞게 고치거나, 없어진 화면의 규칙은 삭제한다. "목록 조작의 자리"의 예시를 고친다. ADR 0007을 가리키는 문장을 ADR 0011로 바꾼다.
  - §4.6 탭: 공용 `Tabs` 컴포넌트, 상태 점과 `연결 전` 보조 문구, 키보드 동작, 서버 상세가 경로로 탭을 표현한다는 점.
  - §4.1 컴포넌트 카탈로그: 이 계획에서 추가한 공용 컴포넌트(`Tabs`)를 추가한다.
  - 서버 목록과 서버 상세의 규칙(상태 칸의 구성, 수집하지 않는 값의 표기, 개요 탭이 카드가 아니라 섹션 행이라는 점, 연결 안내)을 해당 절에 기록한다.
  - §10의 "해결됨" 이력은 과거의 기록이므로 고치지 않는다.
- [ ] **Step 2: 전체를 검증한다** — Run: `pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e` 그리고 `cd ../backend && CGO_ENABLED=0 go vet ./... && CGO_ENABLED=0 go test ./internal/... 2>&1 | tail -8` / Expected: 모두 통과.
- [ ] **Step 3: 디자인 검사의 최종 수치를 기록한다.** Global Constraints의 두 명령을 실행하고, 기준선과 비교한 결과를 보고서에 적는다.
- [ ] **Step 4: 커밋한다** — `docs(design): server screens in DESIGN.md`

렌더링 검사(Hallmark `--render`)와 구현된 화면에 대한 Impeccable `critique`는 이 계획의 작업이 아니라, 실행을 조율하는 쪽이 Task 6, Task 10, Task 14가 끝난 뒤에 별도로 수행한다.
