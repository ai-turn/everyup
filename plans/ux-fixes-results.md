# 첫 방문 UX · 디자인 점검 후 수정 결과

수정·검증: 2026-11-07~08 · 기준 커밋: `2d37ed3d` · 현재 작업트리 반영

[첫 방문 UX 점검](first-visit-ux-audit-results.md) 9건과 [Impeccable·Hallmark 점검](impeccable-hallmark-check.md) 7건에서 중복 2건을 제외한 **14건을 수정했다.** 기존 디자인 체계와 직접 연결/Docker 대상의 구분을 유지했다. 아래 결과는 로컬 데모와 소스에 대한 검증이며, 실제 Collector 설치나 신규 사용자 실험의 성공을 뜻하지 않는다.

## 1. 반영한 수정

| 점검 ID | 수정한 동작 | 주요 소스·검증 |
| --- | --- | --- |
| UX-01 | 데모 수집 시각을 요청 시점에 맞춰 갱신한다. 의도한 지연은 유지하고 정상 수집이 체류 시간 때문에 만료되지 않게 했다. | [mockRouter.ts](../web/frontend/src/services/mockRouter.ts). 브라우저 시계를 3분 전진한 뒤 자동 갱신·수동 갱신·메뉴 왕복에서 정상 0건/확인 필요 1건 유지 |
| UX-02 | 첫 시작에서 새로 추가한 환경을 초기 예시 대상과 구분해 조회·설치 상태·목록에 유지한다. 설치 화면에 데모 제약, 새로고침 시 초기화, 실제 설치 가이드를 표시한다. | [AddServiceModal.tsx](../web/frontend/src/features/services/components/AddServiceModal.tsx), mockRouter. 설치 오류 0건, 닫은 뒤 `설치 대기` 행 확인 |
| UX-03 | 서비스별 장애 구간에서 기간별 체크·일별 업타임을 계산한다. payment-worker의 결제 요청을 해당 서비스의 HTTP 목록에 포함하고, 트레이스가 있는 로그의 오류 여부를 실제 span 상태에 맞췄다. | mockRouter, [serviceTelemetry.ts](../web/frontend/src/mocks/serviceTelemetry.ts). 최근 6시간 실패 체크, 결제 HTTP 요청↔트레이스, 오류 로그↔ERROR span 검증 |
| UX-04 / C-02 | 부모 행의 키 처리 대상이 부모 자신일 때만 활성화한다. 내부 버튼의 기본 Enter·Space 동작을 보존한다. | [a11y.ts](../web/frontend/src/utils/a11y.ts). 트레이스 열기·닫기·원래 버튼 포커스 복귀 통과 |
| UX-05 | 사이드바와 모바일 배너에 예시 데이터·연결/발송 제약을 알리고 `실제 사용 시작하기`, `서비스 소개` 링크를 제공한다. | [DemoHelpLinks.tsx](../web/frontend/src/components/layout/DemoHelpLinks.tsx), Sidebar, DemoBanner. Quick Start 목적지·화면 확인 |
| UX-06 | 로그·API·인프라·메트릭 메뉴의 직접 연결 범위를 설명한다. Docker 환경이 있으면 데이터 위치와 이동 링크를 목록이 채워진 상태에서도 보여 준다. | [capabilities](../web/frontend/src/pages/capabilities), DockerEnvironmentHint. 기존 직접 연결 대상 구분 테스트 통과 |
| UX-07 | 모바일 Docker 서비스 상세의 속성을 `서비스 정보`로 접는다. 장애·지연 시간·마지막 체크·반복 재시작 상태는 계속 노출한다. | [DetailMeta.tsx](../web/frontend/src/components/common/DetailMeta.tsx), AgentHealthCheckDetailView. 업타임 수치가 첫 화면에 표시되고 속성 펼침 동작 확인 |
| UX-08 / C-03 | 모바일 데모 배너에 테마별 시맨틱 표면·글자 색을 사용한다. | [DemoBanner.tsx](../web/frontend/src/components/layout/DemoBanner.tsx). Live Demo 대비 라이트 **5.22:1**, 다크 **7.84:1** |
| UX-09 | 전체 수집 프로필이 OTLP 메트릭 수신을 지원하며 앱 메트릭은 별도 전송 설정이 필요하다고 설명한다. | AddServiceModal. 실제 수집 프로필과 기존 Quick Start의 제약을 대조 |
| C-01 | EveryUp 자체 UI의 Telegram 라벨을 보조 텍스트 토큰으로 바꾼다. 메시지 미리보기의 브랜드 색은 유지한다. | [ChannelForm.tsx](../web/frontend/src/features/alerts/components/ChannelForm.tsx). 대비 라이트 **5.79:1**, 다크 **8.06:1** |
| C-04 | 입력·검색·선택 컨트롤의 경계를 별도 시맨틱 토큰으로 보강한다. | Input, SearchInput, Select, [index.css](../web/frontend/src/index.css), [DESIGN.md](../web/frontend/DESIGN.md). 실제 입력 경계 **3.60/3.16:1**, 검색 경계 **3.78/3.49:1**(라이트/다크) |
| C-05 | 기간 선택 버튼 자체를 모바일 44px로 늘렸다. 재점검에서 확인한 24px 메트릭 제목 버튼도 모바일 44px·데스크톱 40px로 맞췄다. | TimeRangePicker, SegmentedControl, [MetricChart.tsx](../web/frontend/src/features/metrics/MetricChart.tsx). DOM 실측·메트릭 회귀 테스트 통과 |
| C-06 | 메트릭 경고의 출처·조건·확인 시각을 각각 배치하고, 동명 지표 선택의 이름·타입·단위를 구분된 요소로 표시한다. 중간점 연쇄를 제거했다. | [AgentServiceMetricsTab.tsx](../web/frontend/src/features/healthcheck/components/AgentServiceMetricsTab.tsx). 동명 지표 선택·URL 복원 테스트 유지, 변경된 접근성 이름을 기존 테스트에 반영 |
| C-07 | 소개 캐러셀의 색·그림자 리터럴 10곳을 역할별 CSS 변수로 옮겼다. 기존 시각적 값과 양 테마 동작은 유지한다. | [custom.css](../docs/.vitepress/theme/custom.css). 문서 빌드·데스크톱/모바일 라이트·다크 화면 확인 |

디자인 토큰과 실제 터치 높이를 DESIGN.md에 동기화했다. 제거된 기존 slate 클래스에 맞춰 디자인 규칙 검사 상한도 76→69로 낮췄다.

## 2. 기능 검증

| 검증 | 결과 |
| --- | --- |
| `pnpm typecheck` | 통과 |
| `pnpm lint` | 통과. ESLint와 디자인 규칙 검사 포함 |
| `pnpm build:demo` | 통과. 주 JS 청크 378.98 kB / gzip 125.06 kB |
| 문서 `pnpm build` | 통과 |
| 관련 Playwright 13개 파일 | **68개 통과**. [실행 로그](ux-fixes-validation/playwright.log) |
| 새 회귀 테스트 | 위 68개 중 **10개**. 데이터 연결 2개, 시간 경과 2개, 첫 시작 등록, Enter·Space 2개, 모바일 배치, 양 테마 대비 2개 |
| 모바일 배치 검증 보강 후 재실행 | 새 회귀 테스트 10개 통과. 화면 판정에는 숨겨진 제목 대신 실제 `24시간 업타임` 라벨을 사용 |
| 메트릭 제목 터치 높이 보강 후 재실행 | 메트릭 상세·상태 테스트 **10개 통과**. [확인 로그](ux-fixes-validation/playwright-metrics-confirm.log) |
| DOM·색상·상태 관찰 | 페이지 오류 0건. [측정값](ux-fixes-validation/verified-observations.json), [회귀 테스트](../web/frontend/e2e/first-visit-fixes.spec.ts) |

최종 린트는 브라우저 테스트 종료 후 실행했다. 중간에 Playwright가 `test-results`를 초기화하는 순간 ESLint가 같은 폴더를 읽어 ENOENT가 한 번 발생했으며, 순차 재실행으로 통과했다.

390×844 모바일에서 실제 업타임 라벨은 y=573~589px, 하단 내비게이션은 y=781px부터다. 기본 정보는 첫 화면에서 읽을 수 있고, 속성은 펼쳐서 확인한다. 브라우저 시계 전진 검사는 자동화된 3분 경과 검사이며 사람이 3분 기다린 실험과 구분한다.

## 3. Impeccable · Hallmark 재점검

원시 결과와 [화면 43장](ux-fixes-validation/screenshots)을 별도로 저장했다. 최초 점검 증거는 보존했다. Impeccable은 4개 대표 화면×2개 크기×2개 테마를 확인했고, 마지막 제목 버튼 변경 후 메트릭 화면 4개 조합만 확인했다. Hallmark는 앱 3개 경로와 소개 페이지의 반응형 렌더를 확인했다.

| 검사 | 최초 → 수정 후 | 해석 |
| --- | --- | --- |
| Hallmark 앱 static | FAIL 41→40, WARN 4→3 | 실제 메트릭 중간점 위반 제거. 남은 40건은 최초 보고서에서 분류한 기존 예외·오탐 |
| Hallmark 소개 static | FAIL 26→19 | 캐러셀 리터럴 10곳 제거. `.dark` 변수 정의 3곳이 같은 규칙의 오탐으로 추가 집계됨. 남은 19건은 `.dark` 토큰 18건 + 기존 stamp 1건 |
| Hallmark 앱 render | FAIL 4→1, REFLEX 1→0 | 글자 대비·입력 경계·기간 버튼·메트릭 제목 버튼 문제 해소. 남은 1건은 스크롤 가능한 폼과 고정 푸터의 겹침 오탐으로 최초 점검에서 실제 도달 가능함을 확인한 항목 |
| Hallmark 소개 render | FAIL 0, REFLEX 4, WARN 2 유지 | VitePress 내비게이션의 hero 오인, 캐러셀 이미지 총면적 계산 등 기존 결과 유지 |
| Impeccable static | warning 2, advisory 1 유지 | 서드파티 메시지 미리보기 예외와 기존 토스트 색 폴백 |
| Impeccable render | warning 47→52, advisory 82→56 | 일반 디자인 제안은 남음. 새 모바일 경고 10건은 닫힌 `details` 내부를 그려진 텍스트로 오인. DOM `checkVisibility()`는 닫힘 false / 펼침 true이며 실제 화면 겹침은 없음 |

도구 원시 출력의 전체 PASS를 주장하지 않는다. 기존 예외의 근거는 [최초 디자인 보고서](impeccable-hallmark-check.md)와 [ADR 0009](../docs/adr/0009-hallmark-label-and-punctuation-rules.md)에 있다. 이 작업의 14개 개선 항목은 수정·재검증했다. 실제 신규 사용자의 이해도·탐색 성공률은 별도 사용자 검증 대상으로 남는다.

실제 Collector 연결, 외부 알림 발송, 배포는 이번 로컬 검증에 포함하지 않았다. 기존 루트 잠금 파일 상태는 유지했다.

검증용 루트 `.hallmark` 폴더의 삭제는 자동 승인 검토에서 정책상 차단되어 유지했다. 이 폴더에는 렌더 도구가 만든 `.gitignore`와 화면 사본이 있다. 최종 검증 증거는 `plans/ux-fixes-validation`에 따로 저장했다.
