# EveryUp 첫 방문 UX 점검 결과

> 후속 상태: 2026-11-07~08에 아래 개선 항목을 수정했다. 이 문서는 수정 전 관찰을 보존하며, 최신 상태는 [수정·재검증 결과](ux-fixes-results.md)에서 확인한다.

점검일: 2026-11-07 · 기준 계획: [first-visit-ux-audit.md](first-visit-ux-audit.md)

소개 페이지에서 서비스의 용도와 데모 진입 경로는 확인할 수 있었다. 데모 개요도 현재 장애 대상을 먼저 보여 준다. 우선 고칠 부분은 **시간이 지나면 바뀌는 데모 상태, 첫 등록 후 오류, 키보드로 열리지 않는 트레이스**다. 그다음 대표 장애 데이터의 연결과 실제 사용 문서로 나가는 경로를 보완하는 것이 좋다.

이 결과는 배포 화면을 조작한 에이전트 점검이다. 실제 신규 사용자의 이해도·과업 수행 시간·성공률을 측정한 결과가 아니다. 제품 코드는 수정하지 않았다.

## 1. 환경과 증거

| 항목 | 확인 조건 |
| --- | --- |
| 배포 화면 | [한국어 소개](https://ai-turn.github.io/everyup/), [데모](https://ai-turn.github.io/everyup/demo/), [Quick Start](https://ai-turn.github.io/everyup/guide/quickstart) |
| 초기 탐색 | Orca 내장 브라우저, Windows, Chrome 150.0.7871.250. 기존 문서 테마 저장값이 있는 다크 상태였으므로 아래의 초기화된 캡처와 구분했다. |
| 재현·캡처 | Playwright 1.62.1 / Chromium 151.0.7922.34, `ko-KR`, `Asia/Seoul`, 배포 화면 직접 접속 |
| 화면 크기 | 데스크톱 1440×900, 모바일 390×844. 소개·개요·서비스 상세·Quick Start는 320×844도 확인 |
| 초기화 | 각 시나리오·화면 크기별 새 브라우저 컨텍스트. 기존 쿠키·테마·필터·데모 상태를 상속하지 않음 |
| 테마 | OS 선호가 라이트인 첫 방문을 기본 여정으로 사용. OS 선호가 다크인 새 컨텍스트에서 소개·개요·장애 상세·로그·트레이스를 비교 |
| 모바일 | 터치 입력, `pointer: coarse`, CSS 픽셀 기준 캡처. 실제 휴대전화의 브라우저 UI·노치·운영체제 확대는 포함하지 않음 |
| 데모 상태 | `attention`, `normal`, `empty`, `partial-failure`. URL 주입 대신 화면의 상태 선택기로 변경 |
| 캡처 시간 | 22시대 KST. 각 캡처의 정확한 UTC 시각은 동명 JSON의 `time`, 전체 구간은 manifest의 `timeRangeUtc`에 기록 |
| 로컬 소스 | `2d37ed3d`. 배포 커밋은 화면만으로 확인하지 못했으며 로컬 실행 화면으로 대체하지 않음 |
| 배포 식별 정보 | 데모 주 번들 `index-DO9SNNYE.js`, CSS `index-BxaN-usw.css`. 캡처별 `assets`에 URL 보관 |

모든 스크린샷은 [증거 폴더](first-visit-ux-audit-evidence/captures)에 있다. 각 PNG와 이름이 같은 JSON에 URL, 브라우저 UA, 화면 크기, 테마, 상태, 시각, 보이는 텍스트·컨트롤·위치를 기록했다. 아래의 환경 표기는 이 기록을 가리킨다. 로컬 코드는 배포 화면에서 확인한 현상의 원인 후보를 설명하는 데 사용했으며, 같은 빌드임을 확인했다는 뜻은 아니다.

## 2. 먼저 개선할 다섯 항목

| 순서 | ID | 우선순위 | 개선할 내용 | 선정 이유 | 규모 |
| --- | --- | --- | --- | --- | --- |
| 1 | UX-01 | P1 | 데모의 수집 시각을 시나리오에 맞게 유지 | 정상 운영이 약 110초 뒤 확인 필요 11건으로 바뀌어 상태 선택기의 의미가 무너짐 | M |
| 2 | UX-02 | P1 | 첫 시작에서 등록한 예시 환경을 후속 단계에서도 조회 | 첫 연결 과업이 다음 단계에서 즉시 오류로 이어짐 | M |
| 3 | UX-04 | P1 | 로그 안의 트레이스 버튼에 키보드 기본 동작 보장 | Tab으로 찾은 버튼이 Enter·Space로 열리지 않아 핵심 조사 경로가 막힘 | S |
| 4 | UX-03 | P2 | 대표 장애의 상태·체크·로그·트레이스·요청 연결 | 첫 행에서는 원인 설명이 끊기고 다른 로그를 다시 골라야 함 | M |
| 5 | UX-05 | P2 | 데모 범위와 실제 시작 문서를 상시 안내 | 직접 들어온 방문자는 예시 데이터의 범위와 설치 문서의 위치를 별도로 찾아야 함 | S |

S는 한 컴포넌트 또는 가까운 문구 수정, M은 여러 mock 응답·상태 또는 공통 레이아웃 조정이다. 작업 시간 추정은 하지 않았다.

## 3. 과업별 결과

아래 결과는 에이전트의 실행 결과다. 후속 자동 재현은 경로를 지정한 점검이므로 신규 사용자의 자연스러운 클릭 분포나 실패 횟수로 해석하지 않는다.

| 과업 | 데스크톱·모바일 결과 | 첫 행동·관찰 경로 | 경로 이탈·되돌아가기 기록 |
| --- | --- | --- | --- |
| 용도와 체험 경로 찾기 | 도움 없이 완료 | 첫 화면의 셀프호스팅 모니터링 설명, 업타임·로그·API·서버 자원 문구, 라이브 데모 확인 | 최초 소개 화면에서는 스크롤 전에도 CTA가 보임. 정확한 준비물은 시작 문서에서 확인 |
| 설치 없이 데모 열기 | 도움 없이 완료 | 소개의 **라이브 데모** → 개요 | 첫 클릭으로 새 탭 1개 열림. 브라우저 뒤로가기는 사용하지 않음 |
| 지금 확인할 대상 찾기 | 도움 없이 완료 | 현재 확인 필요 → `payment-worker` | 대상 이름·timeout 이유·발생 시각이 한 링크에 있음. 상세까지 경로 이탈 없음 |
| 장애 원인 좁히기 | 탐색·혼동 후 완료 | 상세 → 에러 확인 → 첫 error 행의 트레이스 → 다른 timeout 행의 트레이스 | 첫 트레이스에서는 OK span만 확인. `Payment gateway timeout after 5000ms` 행을 다시 골라 ERROR span·응답 바디 확인. 첫 선택 후 다른 행 선택 1회 |
| 같은 조사 과업을 키보드로 수행 | 미완료 | Tab·Enter로 데모·장애 상세·로그 진입 → 트레이스 버튼에 Tab 포커스 | Enter·Space가 로그 행을 펼치거나 접음. 패널 열기는 포인터로 대체해 별도 확인 |
| 로그·API·서버 자원 메뉴 찾기 | 도움 없이 완료 / 대상 범위는 추가 설명 필요 | 데스크톱 주 메뉴, 모바일 더보기 → 로그·API 요청·인프라 | 목적지는 열리지만 Docker 대상이 기능 메뉴에 없다는 것은 본문만으로 설명되지 않음. 사용자 오선택 횟수는 측정하지 않음 |
| 정상 운영과 첫 시작 구분 | 진입 직후 도움 없이 완료 | 정상 운영의 이상 없음 / 첫 시작의 등록 CTA | 정상 상태를 유지하지 못하는 장기 체류 문제는 UX-01로 분리 |
| 첫 등록·연결 방법 찾기 | 탐색·혼동 후 미완료 | 첫 시작 → Docker 연결 → 이름 입력 → 추가 | 설치 단계에서 환경 조회 오류. 실제 설치를 실행하지 않고 여기서 중단 |
| 일부 조회 실패 이해·회복 경로 찾기 | 도움 없이 완료 / 회복 성공은 검증 불가 | 불러오지 못한 영역·판단 불가 안내 → 다시 시도 | 성공한 영역은 유지됨. 선택된 실패 fixture가 계속 실패하므로 재시도로 회복되지는 않음 |
| 실제 사용 문서 찾기 | 소개 경유: 탐색 후 완료 / 데모 직접 진입: 확인한 화면에서는 미완료 | 개요·상세·더보기에 시작 문서 링크가 없어 남아 있는 소개 탭 → 시작하기 → Quick Start | 소개 탭으로 이동한 뒤 완료. 직접 진입한 탭의 화면에서는 같은 탈출 경로를 찾지 못함 |

Quick Start에서는 **대시보드 서버에 Docker·Compose 준비 → Compose 파일 받기 → 실행 → 관리자 계정 생성 → 업타임 모니터 추가**의 순서를 찾을 수 있었다. Docker 환경 연결과 직접 OpenTelemetry 연결이 선택 사항이라는 설명도 있다. 명령 실행·실제 계정 생성·Collector 연결은 이번 범위에서 수행하지 않았다.

## 4. 전체 발견 목록

| ID | 카테고리 | 영향받는 과업·범위 | 우선순위 | 근거 확실성 | 규모 |
| --- | --- | --- | --- | --- | --- |
| UX-01 | 데모 상태 이해 | 정상/확인 필요 상태로 오래 탐색, 양 화면 크기 | P1 | 실행 관찰 + 코드 확인 | M |
| UX-02 | 데모 탐색·사용 시작 | 첫 시작에서 첫 Docker 환경 등록 | P1 | 실행 관찰 + 코드 확인 | M |
| UX-03 | 기능 가치·데이터 해석 | 기본 장애에서 원인을 좁히는 경로 | P2 | 실행 관찰 + 코드 확인 | M |
| UX-04 | 조작성·접근성 | 키보드로 로그에서 트레이스 열기 | P1 | 실행 관찰 + 코드 확인 | S |
| UX-05 | 데모 안내·다음 행동 | 데모 직접 진입·체험 후 설치 문서 찾기 | P2 | 실행 관찰 + 코드 확인 | S |
| UX-06 | 메뉴·용어 | Docker 대상과 기능별 메뉴의 대상 구분 | P2 | 실행 관찰 + 코드 확인. 실제 혼동 정도는 사용자 검증 필요 | S |
| UX-07 | 정보 위계·가독성 | 모바일 상세에서 로그·차트 읽기 | P2 | 실행 관찰 + 코드 확인. 선호 배치는 사용자 검증 필요 | M |
| UX-08 | 가독성·대비 | 모바일 라이트 테마의 데모 식별 | P2 | 실행 관찰 + 계산 + 코드 확인 | S |
| UX-09 | 기능 설명 정확성 | Docker 연결의 전체 수집 범위 이해 | P2 | 실행 관찰 + 코드·문서 대조 | S |

사용자 영향 설명은 관찰한 UI에서 예상되는 영향이며, 사람에게서 측정한 결과와 구분한다.

### UX-01 — 정상 운영 데모가 체류 중 수집 지연으로 바뀐다

- **환경·URL·과업:** 데스크톱 라이트, [데모 개요](https://ai-turn.github.io/everyup/demo/), `normal`·`attention`. 선택한 상태로 탐색하며 현재 이상 유무를 이해한다.
- **재현:** 새 컨텍스트에서 정상 운영 선택 → 개요를 열린 채 약 110초 유지 → 앱의 새로고침. 브라우저 시계는 변경하지 않았다.
- **관찰:** 정상 운영은 확인 필요 **0 → 11건**, 확인 필요는 **1 → 12건**이 됐다. 선택기 값은 그대로였고 새로고침해도 수집 지연이 남았다. 정상 상태 전후 캡처 간격은 약 111초다.
- **화면 근거:** [정상 진입](first-visit-ux-audit-evidence/captures/aging-normal-start.png), [정상 110초 후](first-visit-ux-audit-evidence/captures/aging-normal-after-110s.png), [확인 필요 110초 후](first-visit-ux-audit-evidence/captures/aging-attention-after-110s.png), [시간 기록](first-visit-ux-audit-evidence/aging.json).
- **영향:** 정상과 수집 실패의 차이를 배우려는 방문자가 의도하지 않은 실패를 만나며, 새로고침이 고장 난 것으로 해석할 여지가 있다.
- **코드 근거:** [mockRouter.ts:450·989](../web/frontend/src/services/mockRouter.ts)의 모듈 로드 시각 `nowAgent`로 수신 시각을 만들고 재사용한다. [operationalStatus.ts:3](../web/frontend/src/utils/operationalStatus.ts)는 2분을 넘기면 stale로 판단한다. 정상 시나리오도 요청 시점의 현재 시각을 사용하지 않는다.
- **개선안 / M:** 데모 전용 clock 또는 요청 시점의 상대 시각을 사용해 정상 수집을 유지한다. 의도적인 지연 대상만 별도 fixture로 남긴다. 실제 운영의 freshness 기준은 유지한다.
- **수정 후 확인:** 두 상태를 최소 3분 유지하고 자동 갱신·수동 새로고침·메뉴 왕복 후에도 의도한 이상 대상만 남는지 확인한다. 재로드로만 정상화되는지도 함께 검사한다.

### UX-02 — 첫 시작에서 추가한 환경이 설치 단계에서 사라진다

- **환경·URL·과업:** 데스크톱 라이트, `empty`, [Docker 환경](https://ai-turn.github.io/everyup/demo/environments). 최초 환경 등록 절차를 체험한다. 모바일에서는 동일 입력 폼까지 확인했다.
- **재현:** 첫 시작 선택 → 개요의 Docker 연결 → Docker 환경 이름 입력 → 추가.
- **관찰:** 다음 단계에서 **“Docker 환경을 찾을 수 없습니다”**와 **“Docker Collector 연결을 기다리는 중”**이 함께 표시된다. 설치 명령에는 `monitor.example.com`과 예시 연결 코드가 들어가지만 해당 화면에 데모용 명령이라는 안내는 없다. 실제 서버로 향한 POST는 관찰되지 않았고 명령은 실행하지 않았다.
- **화면 근거:** [등록 폼](first-visit-ux-audit-evidence/captures/desktop-light-empty-docker-connect.png), [추가 후 설치 단계](first-visit-ux-audit-evidence/captures/demo-docker-install-command.png), [네트워크 관찰](first-visit-ux-audit-evidence/interaction.json)의 `demo-add-network`.
- **영향:** 방문자는 자신이 방금 한 등록이 실패했다고 해석하기 쉽다. 예시 명령을 실제 설치에 사용할 수 있는지도 화면에서 구분하기 어렵다.
- **코드 근거:** [mockRouter.ts:1307](../web/frontend/src/services/mockRouter.ts)은 POST에서 fixture 배열에 환경을 추가하지만, `scenarioAgents`는 `empty`에서 항상 빈 배열을 반환한다. 같은 파일의 setup-status는 그 빈 결과에서 환경을 찾다가 오류를 발생시킨다.
- **개선안 / M:** 첫 시작을 “초기 목록만 비어 있는 상태”로 만들고 이후 생성한 예시 대상은 조회·설정 확인에도 반영한다. 데모 설치 단계에는 **“예시 설치 화면입니다. 여기서 서버를 연결할 수는 없습니다.”**와 **실제 설치 방법 보기**를 표시한다. 예시 코드 복사도 그 범위를 알 수 있게 처리한다.
- **수정 후 확인:** 첫 시작에서 추가 → 설치 단계에 이름 유지 → 조회 오류 없음 → 예시 연결 상태와 실제 설치 문서의 구분 확인. 브라우저 새로고침 시 예시 변경의 유지/초기화 정책도 안내와 일치해야 한다.

### UX-03 — 대표 장애의 데이터가 하나의 조사 흐름으로 이어지지 않는다

- **환경·URL·과업:** 양 화면 크기·양 테마, `attention`, [payment-worker 상세](https://ai-turn.github.io/everyup/demo/services/agent_demo_01/shop%3Apayment-worker?tab=uptime). 장애를 발견하고 관련 증거로 원인을 좁힌다.
- **재현:** 개요의 payment-worker → 업타임 → 에러 확인 → 첫 error 행의 트레이스 → 같은 서비스의 API 요청 탭. 이어 `Payment gateway timeout after 5000ms` 행의 트레이스와 비교.
- **관찰:** 개요는 12분째 진행 중인 timeout을 보여 주고 상세는 **장애·5001ms**다. 기본 6H 응답 시간 차트는 **실패 0회**다. 첫 error 행은 5760ms timeout인데 연결된 네 span은 모두 OK이며 루트는 480ms다. 다른 timeout 행을 고르면 ERROR span과 `upstream_timeout` 응답 바디가 나온다. 그 트레이스에는 HTTP POST가 보이지만 같은 서비스 API 요청 목록은 0건이다.
- **화면 근거:** [업타임 상세](first-visit-ux-audit-evidence/captures/desktop-light-payment-uptime.png), [차트 요약의 실패 0회](first-visit-ux-audit-evidence/captures/desktop-payment-response-summary.png), [첫 error 트레이스](first-visit-ux-audit-evidence/captures/desktop-light-payment-trace.png), [다른 timeout 트레이스](first-visit-ux-audit-evidence/captures/desktop-seed-error-trace.png), [API 요청 0건](first-visit-ux-audit-evidence/captures/desktop-journey-payment-api.png).
- **영향:** 원인을 찾을 단서는 있지만 첫 조사 경로에서 수치와 상태를 해석할 추가 탐색이 필요하다. 일반적으로 error 로그와 OK span이 함께 존재할 수 있다는 이유만으로 제품 오류로 판정한 것은 아니다. 이 데모의 대표 사건이 해당 차이를 설명하거나 일관되게 연결하지 못하는 점을 문제로 보았다.
- **코드 근거:** [mockRouter.ts:452·1526](../web/frontend/src/services/mockRouter.ts)은 서비스별 구분 없이 같은 체크 이력을 반환한다. [serviceTelemetry.ts:56·109](../web/frontend/src/mocks/serviceTelemetry.ts)는 span 실패와 error 로그를 서로 다른 인덱스 규칙으로 생성한다. payment-worker의 `routes`는 비어 있고 seed 요청도 전달하지 않아 HTTP span과 요청 목록이 분리된다.
- **개선안 / M:** 대표 장애 한 건을 기준으로 발생 시각·실패 체크·원인 로그·실패 span·관련 요청을 함께 만든다. 에러 확인은 그 사건의 오류 로그로 좁히거나 대표 원인 행을 먼저 보여 준다. HTTP 요청이 없는 worker 예시를 의도했다면 HTTP span을 넣지 않거나 그 차이를 설명한다.
- **수정 후 확인:** 첫 장애 → 첫 원인 로그 → 트레이스·관련 요청에서 대상·시각·오류 이유가 이어지는지 확인한다. 정상 운영에 과거 장애 이력이 남는 것 자체는 결함이 아니므로 과거 기록을 모두 제거하지 않는다.

### UX-04 — 로그 안의 트레이스 버튼을 키보드로 실행할 수 없다

- **환경·URL·과업:** 데스크톱 라이트, `attention`, [payment-worker 로그](https://ai-turn.github.io/everyup/demo/services/agent_demo_01/shop%3Apayment-worker?tab=logs). 키보드만으로 트레이스 상세를 연다.
- **재현:** Tab·Enter로 데모·장애 상세·에러 확인에 진입 → 로그 행 안의 트레이스 버튼까지 Tab → Enter 또는 Space.
- **관찰:** 버튼에는 보이는 포커스 링이 생긴다. Enter·Space는 트레이스 패널 대신 바깥 로그 행의 메타데이터를 펼치거나 접는다. 같은 버튼을 클릭하면 패널이 열린다.
- **화면 근거:** [실행 전 포커스](first-visit-ux-audit-evidence/captures/keyboard-trace-trigger.png), [Enter 후 펼쳐진 로그](first-visit-ux-audit-evidence/captures/keyboard-trace-after-enter.png), [클릭으로 연 패널](first-visit-ux-audit-evidence/captures/keyboard-trace-open.png), [행동 확인값](first-visit-ux-audit-evidence/interaction.json)의 `keyboard-trace-enter`·`keyboard-trace-space`는 모두 `false`.
- **영향:** 링크·버튼의 모양은 갖추었지만 키보드 사용자는 이 조사 경로를 끝내지 못한다.
- **코드 근거:** [AgentServiceLogsTab.tsx:180·195](../web/frontend/src/features/healthcheck/components/AgentServiceLogsTab.tsx)의 부모 행은 `activatable`을 사용한다. 자식 버튼은 click만 전파를 막는다. [a11y.ts:27](../web/frontend/src/utils/a11y.ts)의 keydown은 자식에서 올라온 Enter·Space도 `preventDefault`한 뒤 행을 토글한다.
- **개선안 / S:** 부모의 키보드 활성화는 `event.target === event.currentTarget`일 때만 처리하거나 자식 컨트롤을 제외한다. 로그 요약과 독립 버튼의 상호작용 경계를 분명하게 한다.
- **수정 후 확인:** Tab으로 부모 행과 자식 버튼을 각각 선택 → 부모 Enter는 펼침, 자식 Enter·Space는 트레이스 열기 → Escape 닫기·버튼으로 포커스 복귀 확인. 이 helper를 사용하는 다른 중첩 컨트롤도 같은 방식으로 검토한다.

### UX-05 — 데모 범위와 실제 사용 문서를 상시 안내하지 않는다

- **환경·URL·과업:** 데모 전체, 기본 상태와 첫 시작, 양 화면 크기. 직접 진입해 체험 범위를 이해하고 설치 문서로 이동한다.
- **재현:** 데모 URL 직접 열기 → 안내·메뉴·하단 확인 → 설치 방법을 찾기. 소개 탭이 남아 있는 경유 진입과 비교.
- **관찰:** 데스크톱 안내는 **Live Demo + 데모 상태**뿐이다. 모바일에는 예시 데이터·실제 서버 미연결 설명이 있다. 확인한 개요·상세·더보기에는 소개/Quick Start 링크가 없고 하단은 GitHub·피드백 링크만 제공한다. 설치 문서를 읽으려면 소개 탭으로 돌아가야 했다.
- **화면 근거:** [데스크톱 진입](first-visit-ux-audit-evidence/captures/desktop-journey-entry.png), [모바일 진입](first-visit-ux-audit-evidence/captures/mobile-journey-entry.png), [모바일 더보기](first-visit-ux-audit-evidence/captures/mobile-journey-more.png), [문서 링크 검사](first-visit-ux-audit-evidence/journey.json).
- **영향:** 직접 들어온 방문자는 데이터의 성격과 실제 사용 시작을 별도로 추론해야 한다. 소개를 경유한 경우에는 기존 탭으로 돌아가 완료할 수 있으므로 전체 설치 과업이 불가능하다고 일반화하지 않는다.
- **코드 근거:** [Sidebar.tsx:76](../web/frontend/src/components/layout/Sidebar.tsx), [DemoBanner.tsx](../web/frontend/src/components/layout/DemoBanner.tsx), [Footer.tsx](../web/frontend/src/components/layout/Footer.tsx). 알림·상세 수집 내부의 개별 가이드 링크는 코드에 있지만 상시 보이는 시작 문서 경로와는 구분했다.
- **개선안 / S:** 두 레이아웃 모두에 **“예시 데이터로 둘러보는 데모입니다. 서버 연결과 알림 발송은 실행되지 않습니다.”**를 표시한다. **실제 사용 시작하기**를 Quick Start에, **서비스 소개**를 소개 페이지에 연결한다. 폼 변경의 초기화 범위는 실제 정책과 맞춰 별도 안내한다.
- **수정 후 확인:** 소개 탭이 없는 데스크톱·모바일 첫 방문에서 안내를 읽고 한 링크로 Quick Start에 도착할 수 있는지 확인한다. 연결 폼·알림 화면에서도 모의 동작을 실제 성공으로 오해하지 않게 한다.

### UX-06 — 기능 메뉴가 Docker 데이터도 포함하는지 알기 어렵다

- **환경·URL·과업:** 양 화면 크기, `attention`, [로그](https://ai-turn.github.io/everyup/demo/logs)·[API 요청](https://ai-turn.github.io/everyup/demo/api)·[인프라](https://ai-turn.github.io/everyup/demo/infrastructure). 방금 본 Docker 대상의 관련 데이터를 찾는다.
- **재현:** payment-worker 상세에서 로그가 있음을 확인 → 주 메뉴의 로그 / 모바일 더보기의 로그 → 목록과 화면 설명 확인.
- **관찰:** 기능 메뉴의 로그 목록에는 checkout-api 등 직접 연결 대상이 보이고 payment-worker는 없다. 화면 설명은 “서비스별 최근 오류·경고…”로 범위를 한정하지 않는다. API·인프라 메뉴도 직접 연결 범위를 설명하는 상시 문구가 부족하다. 빈 목록일 때의 직접 연결 안내는 있지만 이미 데이터가 있는 첫 방문에는 보이지 않는다.
- **화면 근거:** [기능 로그 목록](first-visit-ux-audit-evidence/captures/desktop-journey-logs.png), [Docker 로그](first-visit-ux-audit-evidence/captures/desktop-light-payment-logs.png), [더보기 설명](first-visit-ux-audit-evidence/captures/mobile-journey-more.png).
- **영향·확실성:** 서로 다른 대상 집합이라는 사실은 실행·코드로 확인했다. 사용자가 실제로 얼마나 혼동하는지는 신규 사용자 검증이 필요하다.
- **코드 근거:** [ADR 0007](../docs/adr/0007-capability-menus-show-only-directly-configured-targets.md), [LogsPage.tsx:48](../web/frontend/src/pages/capabilities/LogsPage.tsx), [ApiPage.tsx:18](../web/frontend/src/pages/capabilities/ApiPage.tsx), [InfrastructurePage.tsx:75](../web/frontend/src/pages/capabilities/InfrastructurePage.tsx), [navSections.ts](../web/frontend/src/components/layout/navSections.ts).
- **개선안 / S:** 대상 분리 설계는 유지하고 본문에 **“OpenTelemetry로 직접 연결한 앱의 로그입니다. Docker 로그는 Docker 환경에서 확인하세요.”**를 표시한다. 마지막 Docker 환경은 실제 이동 링크로 제공한다. API·인프라도 해당 연결 방식에 맞춰 범위를 명시한다.
- **수정 후 확인:** Docker 대상과 직접 연결 대상의 로그를 각각 찾는 과업을 주고, 대상이 없는 이유와 다른 경로를 화면만으로 설명할 수 있는지 확인한다.

### UX-07 — 모바일 상세의 속성 목록이 조사 데이터를 첫 화면 밖으로 밀어낸다

- **환경·URL·과업:** 390×844·320×844, 양 테마, `attention`·`normal`, payment-worker 상세. 업타임 차트 또는 로그를 읽는다.
- **재현:** 개요에서 장애 상세 열기 → 스크롤 전 화면 확인 → 로그 탭 선택 후 다시 첫 화면 확인.
- **관찰:** 390px에서 데모 안내·헤더 아래에 Protocol, Runtime, Image, Uptime, Restarts, 수집 레벨이 한 줄씩 놓인다. 데이터 탭의 위쪽 위치는 y=735px, 높이는 42px이며 하단 내비는 y≈780px부터다. 업타임과 로그 모두 본문 데이터는 스크롤해야 나온다. 탭 선택은 정상 동작하며 본문이 영구히 가려진 것은 아니다.
- **화면 근거:** [업타임 첫 화면](first-visit-ux-audit-evidence/captures/mobile-light-payment-uptime.png), [로그 첫 화면](first-visit-ux-audit-evidence/captures/mobile-light-payment-logs.png), [위치 수치](first-visit-ux-audit-evidence/captures/mobile-light-payment-uptime.json), [320px 상세](first-visit-ux-audit-evidence/captures/narrow-light-payment.png).
- **영향·확실성:** 본문이 첫 화면 밖이라는 점은 확인했다. 어떤 메타정보를 먼저 보길 원하는지는 사용자 검증이 필요하다.
- **코드 근거:** [AgentHealthCheckDetailView.tsx:90](../web/frontend/src/features/healthcheck/components/AgentHealthCheckDetailView.tsx), [DetailMeta.tsx:23](../web/frontend/src/components/common/DetailMeta.tsx). 모바일에서 모든 속성이 1열로 배치된다.
- **개선안 / M:** 모바일에서는 상태·마지막 체크·재시작 이상과 조사 액션을 먼저 두고 이미지·런타임·수집 설정은 **서비스 정보** 접기로 묶는다. 접기를 닫았을 때 탭과 첫 데이터 요약이 보이도록 한다.
- **배치 제안:** 현재 `제목 → 상태 → 6개 속성 → 액션 → 탭 → 데이터`를 `제목 → 상태·이상 → 액션 → 탭 → 데이터 → 서비스 정보 펼치기`로 바꾼다. 데모 안내의 가독성을 줄여 공간을 확보하지 않는다.
- **수정 후 확인:** 390px·320px에서 본문 요약과 탭이 첫 화면에 보이는지, 속성을 펼쳤을 때 긴 이미지명과 키보드 포커스가 잘리지 않는지 확인한다.

### UX-08 — 모바일 라이트 테마의 Live Demo 글자 대비가 낮다

- **환경·URL·과업:** 모바일 라이트, 데모 전체, `attention`. 체험 화면임을 식별한다.
- **재현:** OS 라이트 선호의 새 컨텍스트 → 데모 상단 Live Demo 배지 확인 → 같은 위치를 다크 선호와 비교.
- **관찰:** 14px 일반 텍스트의 전경은 RGB(58,91,199), 투명 배경을 합성한 유효 배경은 약 RGB(24,38,78)이다. 대비는 **2.44:1**이며 다크에서는 **8.30:1**이다. 계산에는 브라우저가 해석한 sRGB와 실제 조상 배경의 알파 합성을 사용했다. 옆의 예시 데이터 설명 전체가 낮은 대비라는 뜻은 아니다.
- **화면 근거:** [라이트](first-visit-ux-audit-evidence/captures/mobile-light-demo-contrast.png), [다크](first-visit-ux-audit-evidence/captures/mobile-dark-demo-contrast.png), [색·대비 계산](first-visit-ux-audit-evidence/interaction.json)의 `mobile-demo-contrast-*`.
- **영향:** 라이트에서도 어두운 배너를 사용하지만 글자는 라이트의 action 색을 따라가 데모 라벨이 흐리다. 일반 크기 텍스트의 기준 4.5:1에 미달한다. [W3C의 대비 기준](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- **코드 근거:** [DemoBanner.tsx:23](../web/frontend/src/components/layout/DemoBanner.tsx)의 어두운 고정 배경과 `text-action` 조합.
- **개선안 / S:** 어두운 배너에 맞는 고대비 전경을 테마와 무관하게 적용한다. 또는 배너 표면과 글자색이 함께 전환되는 토큰 조합을 사용한다.
- **수정 후 확인:** 실제 두 테마의 배지 배경과 전경을 다시 합성해 4.5:1 이상인지 확인한다. 라이트·다크·터치 화면에서 육안 검토도 한다. 이 한 항목의 검사가 앱 전체 접근성 준수를 의미하지는 않는다.

### UX-09 — 전체 프로필 설명이 앱 메트릭까지 자동 수집한다고 읽힌다

- **환경·URL·과업:** 양 화면 크기, `empty`, Docker 연결 폼. 연결 후 어떤 데이터를 얻는지 예상한다.
- **재현:** 첫 시작 → Docker 연결 → 수집 범위의 전체 선택 → 설명 읽기 → Quick Start의 전체 프로필 표와 비교.
- **관찰:** 폼은 **“업타임, 로그, 인프라, API, 메트릭을 한 번에 수집합니다.”**라고 한다. 같은 컴포넌트의 메트릭 설명은 OTLP 메트릭 수신 기능이고, Quick Start는 앱/Collector에서 별도로 전송 설정해야 한다고 설명한다.
- **화면 근거:** [폼](first-visit-ux-audit-evidence/captures/desktop-light-empty-docker-connect.png), [모바일 폼](first-visit-ux-audit-evidence/captures/mobile-light-empty-docker-connect.png), [Quick Start 텍스트 기록](first-visit-ux-audit-evidence/captures/desktop-journey-quickstart.json).
- **영향:** 별도 전송 설정 없이 앱 메트릭도 자동으로 보일 것으로 기대할 수 있다. 실제 Collector 수집 성공 여부를 시험해 얻은 결론은 아니며, UI·설정 설명의 불일치를 지적한 것이다.
- **코드 근거:** [AddServiceModal.tsx:99·165](../web/frontend/src/features/services/components/AddServiceModal.tsx), [quickstart.md:119](../docs/guide/quickstart.md).
- **개선안 / S:** **“컨테이너 상태·로그·호스트 자원·API 요청을 수집하고 OTLP 메트릭을 받을 수 있습니다. 앱 메트릭은 앱이나 OpenTelemetry Collector에서 별도로 보내 주세요.”**로 바꾼다.
- **수정 후 확인:** 전체·기본·사용자 지정 설명이 실제로 켜는 수집/수신 기능과 일치하는지 대조하고, 전송 설정이 필요한 기능을 설치만으로 완료했다고 안내하지 않는지 확인한다.

## 5. 문구 수정안

실제 UI 이름은 유지하고, 체험 조건과 다음 행동을 구체적으로 적는 방향이다. 제안 문구는 아직 제품에 반영하지 않았다.

| 위치 | 현재 | 수정안 |
| --- | --- | --- |
| 데스크톱 데모 카드 | Live Demo | 예시 데이터 데모 + “실제 서버와 연결되지 않습니다.” |
| 데모 안내의 다음 행동 | Quick Start 링크 없음 | 실제 사용 시작하기 → Quick Start / 서비스 소개 → 소개 페이지 |
| 데모 설치 단계 | Linux Docker 서버에서 실행 | “예시 설치 화면입니다. 실제 설치는 시작 문서에서 진행하세요.” + 실제 설치 방법 보기 |
| 첫 시작의 등록 후 오류 | Docker 환경을 찾을 수 없습니다 | 조회 결함을 먼저 고친 후 실제 상태에 따라 “예시 환경을 추가했습니다. 연결 과정은 이 화면에서 살펴볼 수 있습니다.” |
| 로그 페이지 설명 | 서비스별 최근 오류·경고 건수를 보고, 서비스를 열어 로그를 검색합니다. | OpenTelemetry로 직접 연결한 앱의 로그입니다. Docker 로그는 Docker 환경에서 확인하세요. |
| API 요청 페이지 설명 | 수집된 HTTP 요청과 오류를 비교하고 조사할 서비스를 선택합니다. | 직접 연결한 앱의 HTTP 요청과 오류를 비교합니다. Docker 서비스의 요청은 Docker 환경에서 확인하세요. |
| 인프라 페이지 설명 | 서버의 CPU, 메모리, 디스크 상태를 확인하고 자원 이상을 찾습니다. | 인프라 Collector로 직접 연결한 서버의 자원 상태입니다. Docker 호스트 자원은 Docker 환경에서 확인하세요. |
| 전체 프로필 | 업타임, 로그, 인프라, API, 메트릭을 한 번에 수집합니다. | 컨테이너 상태·로그·호스트 자원·API 요청을 수집하고 OTLP 메트릭을 받을 수 있습니다. 앱 메트릭은 별도 전송 설정이 필요합니다. |

UX-01·02·03·04는 문구 수정만으로 해결되지 않는다. 특히 등록 후 오류를 성공 문구로 덮거나 정상 시나리오의 지연 경고를 숨기는 방식은 개선안에 포함하지 않는다.

## 6. 유지할 요소

- **소개 첫 화면:** 셀프호스팅이라는 운영 조건과 주요 데이터 종류를 명시하고 시작하기·라이브 데모를 스크롤 전 제공한다. 별도 조작 없는 이미지 자동 넘김도 없다. 데스크톱 제품 미리보기와 양 테마의 시각 구분을 유지한다.
- **개요의 우선순위:** 장애 대상 이름·이유·시작 시각을 바로 누를 수 있다. 모니터링 범위는 별도 카드로 나눠 역할이 분명하다.
- **빈 상태와 정상 상태의 구분:** 진입 직후에는 정상 운영의 “현재 확인이 필요한 이상이 없습니다”와 첫 시작의 “아직 모니터링 대상이 없습니다”가 명확히 다르다. 이 문구는 유지하고 UX-01·02의 동작을 고친다.
- **일부 실패 시 정보 보존:** 실패한 영역을 명시하고 정상 여부를 판단할 수 없다고 설명하며 재시도 버튼을 제공한다. 성공한 영역과 장애 이력은 유지한다. [부분 실패 화면](first-visit-ux-audit-evidence/captures/desktop-light-partial-failure-overview.png)
- **실제 원인까지 보여 주는 트레이스 예시:** seed timeout 로그에서는 실패한 외부 호출, ERROR span, 마스킹된 요청과 응답 바디를 확인할 수 있다. 이 데이터를 대표 사건과 연결하면 가치 전달에 도움이 된다. [원인 트레이스](first-visit-ux-audit-evidence/captures/desktop-seed-error-trace.png)
- **모바일 더보기:** 업타임·로그·API·인프라를 텍스트 설명과 함께 찾을 수 있다. 양 테마에서 배너·상태 선택기가 보이며 320px 검사 화면에는 문서 전체의 가로 넘침이 없었다. 가로 스크롤 탭은 문서 넘침과 구분했다.
- **차트와 키보드의 일부 지원:** 본문 바로가기, 메뉴 Tab·Enter, 상태 선택기의 ArrowDown, 응답 시간 차트의 방향키 조작이 작동한다. 터치 탭으로도 응답 시간·정상 체크 수를 읽었다. [키보드 메뉴/차트 기록](first-visit-ux-audit-evidence/accessibility.json), [터치 차트](first-visit-ux-audit-evidence/captures/mobile-response-plot-interaction.png)
- **사용 시작 문서:** Web 설치와 첫 업타임 모니터를 먼저 안내하고 직접 연결·Docker 환경을 선택 단계로 구분한다. 준비물·정상 결과·문제가 생겼을 때의 링크가 있다.

## 7. 검증 범위와 남은 확인

| 계획의 확인 조건 | 실행 결과 |
| --- | --- |
| 소개 → 데모 → 장애 상세 → 로그·트레이스 → 시작 문서 | 양 화면 크기에서 실행. 앱에서 문서로 나가는 링크 부재와 키보드 실패는 발견 항목으로 기록 |
| 데모 직접 진입 | 초기화된 컨텍스트에서 실행. 로그인 없이 개요 진입 |
| 네 가지 데모 상태 | 양 화면 크기의 개요·대표 화면에서 실행. 정상·확인 필요의 110초 체류와 첫 시작의 등록 후 오류는 데스크톱에서 재현. 부분 실패는 양 화면 크기에서 재시도 |
| 주요 화면의 라이트·다크 | 소개·개요·서비스 상세·로그·트레이스, 양 화면 크기에서 캡처·비교 |
| 모바일 메뉴와 시나리오 선택 | 더보기에서 기능 메뉴 이동, 상태 변경 후 표시·선택 유지 확인 |
| Tab·Enter·Escape | 데모 진입·메뉴·상세·로그까지 실행. 로그의 트레이스 버튼은 Enter/Space 실패. 클릭으로 연 뒤 Escape는 초점의 툴팁을 먼저 닫고 두 번째에 패널을 닫는 경우 확인 |
| 차트의 기간·단위·색 이외의 정보 | 6H 선택, ms·건/10분·최근 7일 설명·상태 라벨 확인. 응답 시간 차트를 방향키/터치로 읽음. 모든 차트의 모든 툴팁을 전수 점검한 것은 아님 |
| 320px·긴 표시값 | 소개·개요·서비스 상세·Quick Start 확인. 기존 긴 이미지 경로가 줄바꿈됨. 임의의 극단적으로 긴 서비스명 입력은 미검증 |
| 실제 브라우저 200% 확대 | 미검증. 320px 반응형 확인을 확대 검사 통과로 대체하지 않음 |
| 실제 신규 사용자 | 미실시. 5초 이해도·탐색 시간·성공률·용어 선호는 판단하지 않음 |
| 실제 설치·수집·알림 | 계획 범위 밖. 예시 화면·mock 응답을 실제 외부 연결 성공으로 판정하지 않음 |
| 로컬 실행·기존 E2E 전체 | 미실시. 제품 코드 변경이 없어 배포 화면의 재현 수집으로 검증. 기존 테스트의 경로·예상 동작을 참고했으며 로컬 통과를 보고하지 않음 |

후속 사용자 확인에서는 모니터링 경험이 적은 개발자와 다른 도구 경험이 있는 개발자를 포함해 3~5명에게 같은 과업을 제시한다. 특히 **Docker 로그와 직접 연결 로그 구분, 모바일에서 첫 조사 행동 찾기, 체험 후 실제 설치로 이동**을 관찰한다. 정답 메뉴를 먼저 알려 주지 않으며 소규모 정성 점검을 통계적 성공률로 바꾸지 않는다.

## 8. 재현 자료와 점검 기준

- [캡처 스크립트](first-visit-ux-audit-evidence/capture.mjs): 배포 화면에 접속해 새 컨텍스트를 만들고 증거를 저장한다. `matrix`, `journey`, `narrow`, `aging`, `interaction`, `supplement`, `accessibility` 단계를 분리했다. 테스트 실패를 숨기지 않도록 행동 확인값은 원래 boolean으로 남긴다.
- [matrix.json](first-visit-ux-audit-evidence/matrix.json): 화면 크기·테마·상태의 기본 비교.
- [journey.json](first-visit-ux-audit-evidence/journey.json): 메뉴·Quick Start 경유와 새 탭·문서 링크 검사.
- [aging.json](first-visit-ux-audit-evidence/aging.json): 시계를 바꾸지 않은 체류 후 상태 비교.
- [interaction.json](first-visit-ux-audit-evidence/interaction.json): 키보드 실패, mock 등록과 네트워크 관찰, 실제 CSS 대비 계산.
- [supplement.json](first-visit-ux-audit-evidence/supplement.json): 별도의 timeout 트레이스·인프라 상세·직접 API 상세.
- [accessibility.json](first-visit-ux-audit-evidence/accessibility.json): 키보드 메뉴·상태 선택·차트 터치/방향키.
- [narrow.json](first-visit-ux-audit-evidence/narrow.json): 320px 네 화면.
- [manifest.json](first-visit-ux-audit-evidence/manifest.json): 모든 캡처 PNG·동명 JSON의 파일명·크기·SHA-256.

문구는 `toss-technical-writing`의 제품 동작 대조·독자 행동 중심 원칙을 적용했다. UI는 프로젝트 [DESIGN.md](../web/frontend/DESIGN.md), Vercel의 [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), W3C의 [텍스트 대비 설명](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)을 참고했다. 외부 스킬·플러그인은 추가 설치하지 않았다. Playwright는 저장소 의존성을 변경하지 않고 임시 경로에 설치해 사용했다.
