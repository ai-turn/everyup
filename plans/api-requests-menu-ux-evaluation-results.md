# API 요청 메뉴 UI·UX 점검 결과

작성일: 2026-11-12 · 기준: [인프라 점검 계획](infra-menu-ux-evaluation-plan.md)의 방식을 따름 · HEAD `0f352726` (제품 코드 변경 없음) · 데모 `http://127.0.0.1:5211/everyup/demo/` (`vite build --mode demo`를 별도 출력 폴더로 빌드) · Chromium(Playwright)

인프라 2차와 같은 **약식 점검**이다. 점수는 매기지 않고 심각도(S1~S4)만 붙였다. 데스크톱 1440·모바일 390, 라이트·다크에서 목록(카드·표)·상세(요청·트레이스 탭)·트레이스 패널·연결 대화상자를 캡처하고 axe를 돌렸다. 빈·실패·수신 대기 상태는 소스로 확인했다. 이번에는 참고 제품의 소스를 읽어 기능을 비교하고, 빠진 기능마다 추가 여부를 정하는 단계를 더했다(§3). 증거는 [`api-requests-menu-ux-evaluation-evidence/`](api-requests-menu-ux-evaluation-evidence/)에 있다(`audit.mjs`, `cap/`).

## 1. 요약

- 기본 흐름(대상 선택 → 상세 → 기간·지표 전환 → 요청 행에서 트레이스 패널 → 로그로 이동)과 필터 빈 결과, 추이 실패·과다 조회 상태는 막힘 없이 동작했다. 데스크톱은 4개 환경 모두 가로 넘침과 axe 위반이 없다.
- **가장 큰 문제는 삭제다.** API 상세의 `삭제`는 그 서비스의 로그·메트릭·트레이스·알림 규칙을 모두 지운다. 확인 문구는 "이 Observed Service를 삭제할까요? 이 서비스의 traces와 연결된 다른 데이터…"라서 무엇이 사라지는지 알 수 없다(A-01).
- **수신 전 서비스와 한산한 서비스가 똑같이 보인다.** 목록과 상세 모두 "연결 활성"이고, 요약은 "이 기간에 수집된 HTTP 요청 없음"이다. 트레이스를 받아도 HTTP SERVER span이 아니면 목록이 비는데, 이 조건은 상세의 접힌 안내 안에만 있다(A-02, A-03).
- **"어느 endpoint가 문제인가"에 답하는 화면이 없다.** 참고 제품 네 곳 모두 endpoint별 요약 표가 기본 화면인데, EveryUp은 `5xx 최다` 한 줄뿐이다. 실패 원인(`api_requests.error`, span `statusMessage`)도 저장만 되고 어디에도 보이지 않는다(A-08, A-10).

## 2. 이슈

| ID | 심각도 | 화면 | 내용 | 근거 | 권장 수정 | 규모 |
| --- | :-: | --- | --- | --- | --- | :-: |
| A-01 | S3 | 상세 (삭제) | API 메뉴의 `삭제`가 Observed Service 전체를 지운다(logs·api_requests·spans·otel_metrics·알림 규칙). 데모의 orders-api처럼 로그·메트릭도 받는 서비스라면, API 모니터링만 끄려던 사용자가 로그와 메트릭까지 잃는다. 확인 문구는 내부 용어(`Observed Service`)와 원시 값(`traces`)을 쓰고, 지워질 데이터 유형을 말하지 않는다. 로그 상세는 "이 서비스의 로그…가 함께 삭제됩니다"라고 해서 더 좁게 읽힌다. | `DirectApiDetailPage.tsx` `confirmCopy.delete`, `repository_observed_service.go:259-265`, `DirectLogsDetailPage.tsx:118-119` | 다른 데이터 유형이 있으면 기본 액션을 `API 연결 해제`(signals에서 `traces` 제거. 백엔드 `Manager.Update`가 이미 signals를 통째로 바꾸므로 프론트만 고치면 된다)로 바꾼다. 전체 삭제는 지워질 유형을 이름으로 나열한다("로그·API·메트릭 데이터와 알림 규칙을 모두 삭제합니다"). 로그·메트릭 상세에도 같은 규칙을 적용한다 | S |
| A-02 | S2 | 목록·상세 | 목록 상태는 `TelemetryCollectionStatus`(키 활성 여부)라서 수신 기록이 전혀 없는 서비스도 "연결 활성"이다. 요약은 "이 기간에 수집된 HTTP 요청 없음"이라 한산한 서비스와 구분되지 않는다. 상세는 추이 카드를 숨기고 "기간을 바꾸거나 트레이스 탭에서…" 빈 상태를 보여 주며, 설정 안내는 접혀 있다. DESIGN.md §4.2의 "수집 허용 상태와 실제 trace 수신은 구분한다"를 지키지 못한다. 알려진 공통 문제(`DirectConnectionMeta`의 "연결 활성")가 여기에도 해당한다. | `new-nodata-detail.png`, `ApiTargets.tsx:13-18`, `TelemetryCollectionStatus.tsx` | 인프라 I-01·I-06과 같은 방식이다. 상태는 `lastSeenAt`(서비스 전체, 로그 수신으로도 갱신됨)이 아니라 `/setup-status`의 `traces` 수신 시각으로 정한다. 수신 기록이 없으면 `수신 대기` 배지를 보이고 상세 빈 상태에 수집 설정 안내를 펼쳐 둔다 | S~M |
| A-03 | S2 | 연결 대화상자 | 수신 확인이 "API 트레이스 수집 중"이 되어도 API 요청 목록은 비어 있을 수 있다. method와 상태코드가 있는 SERVER span만 `api_requests`로 투영되기 때문이다. 대화상자는 이 조건을 말하지 않는다. 안내 문구 "권한 추가만으로 앱의 전송 설정이 변경되지는 않습니다"는 기존 서비스에 권한을 추가할 때의 말인데, 새 서비스에도 나온다. | `otlp_ingest.go:710-718`, `TelemetryReceiptStatus.tsx` `APP_NOTE`, `setup-result.png` | 인프라 I-03에서 만든 `note` prop으로 API 전용 문구를 준다: "HTTP 요청을 한 번 보내 주세요. API 요청 목록에는 method와 상태코드가 있는 SERVER span만 표시됩니다." | S |
| A-04 | S2 | 상세 차트 | 요청 추이 차트 SVG가 Tab 정지점(`role=application`)이 되지만, 화살표를 눌러도 툴팁이 보이지 않는다(`hidden`). 알려진 Recharts 문제(숫자 시간축)와 같다. 인프라는 `InfraTrends`에서 직접 처리했고, 로그는 `accessibilityLayer={false}`로 껐다. | `keyboard-chart.png`, `notes.json` `chartFocus`·`chartTooltipAfterArrows`, `tab-sequence.json` | `InfraTrends.tsx:127-142`의 키 처리와 `aria-live` 값 읽기를 적용한다. 세 번째 사용처이므로 훅 하나로 뽑는다 | S~M |
| A-05 | S2 | 상세 (모바일) | 390px에서 탭이 y=565, 첫 차트가 y=1007, 요청 표가 y=1421에서 시작한다. 연결 정보가 첫 화면의 2/3를 차지한다(알려진 공통 문제). | `390-light-detail-fold.png`, `notes.json` `390-light-positions` | 인프라에서 만든 `collapseOnMobile`·`collapseLabel`(`서비스 정보`)을 API 상세에도 켠다 | S |
| A-06 | S2 | 트레이스 탭 (모바일) | 트레이스 표(537px)가 356px 카드 안에서 `overflow-hidden`에 잘린다. 소요·Span·시작 열이 보이지 않고 "소요" 헤더가 세로로 깨진다. 요청 표는 좁은 화면에서 열을 숨기는데 트레이스 표에는 그 처리가 없다. 표에 접근 가능한 이름도 없다. | `390-light-traces.png`, `390-*-traces.json` `wideTables` | 요청 표(`ApiRequestResults`)처럼 `sm` 미만에서 종류·Span 열을 숨기고 소요·시작은 이름 아래 줄로 내린다. `aria-label="트레이스 목록"`을 단다 | S |
| A-07 | S2 | 목록 | 판단 단서가 요청 수와 5xx 건수뿐이다. 에러율·p95·마지막 수신이 없고 정렬도 없다. 상세의 `에러율`은 5xx와 OTel ERROR를 합치므로, 목록 5xx 0건인 서비스가 상세에서는 에러율이 있을 수 있다. | `1440-light-list-card.png`, `useApiTargets.ts`, `otlp_ingest.go:748` | §4 대안 B | S~M |
| A-08 | S2 | 상세 | 어떤 endpoint가 느리거나 실패하는지 볼 곳이 `5xx 최다: POST /v1/orders ×3` 한 줄뿐이다. 요청 목록은 원래 경로(`/v1/orders/4201`)를 시간순으로 보여 주므로 묶어서 볼 수 없다. `path_template`은 이미 저장되어 있다. | `1440-light-detail.png`, `repository_api_request.go` `StatusSummary`, `otlp_ingest.go:728-732` | §4 대안 A | M |
| A-09 | S2 | 트레이스 패널 | axe `color-contrast` serious(라이트, 1440·390): 로그 `warn` 배지가 amber-700 on amber-500/10에서 4.42:1이다. 로그 탭은 `logLevelStyle`의 틴트 없는 토큰으로 이미 고쳤는데, 패널은 자체 `logLevelBadge`를 쓴다. 같은 파일의 `spanKindBadge`도 트레이스 탭의 수정본(amber-800)과 갈라져 있다. | `1440-light-trace-panel.json`, `TracePanel.tsx:39-66`, `AgentServiceTracesTab.tsx:37-45` | 패널이 `LEVEL_BASE`/`LEVEL_TEXT`와 트레이스 탭의 `spanKindBadge`를 가져다 쓰게 한다(복사본 삭제) | S |
| A-10 | S2 | 트레이스 패널·요청 목록 | 실패 원인이 화면에 없다. `api_requests.error`(span status message)와 span `statusMessage`·`attributes`·`events`가 응답에 있지만, 목록은 "오류", 패널은 `ERROR` 배지만 보인다. 데모 오류 행에는 "deadline exceeded"가 들어 있는데 볼 방법이 없다. span 목록은 `parentSpanId`를 무시해서 부모·자식 관계도 보이지 않는다. | `TracePanel.tsx` `SpanList`, `services/api/services.ts:99-118`, `mocks/serviceTelemetry.ts:66,86`, `1440-light-trace-panel.png` | span 행을 펼치면 status message·attributes·events가 보이게 하고, `parentSpanId`로 들여쓴다. 오류 요청 행에도 `error`를 한 줄 보인다. 프론트만 고친다(§3 결정 "추가") | S |
| A-11 | S1 | 트레이스 패널 | 패널의 API 요청 상태 배지는 `isError` 기준이라 422가 초록으로 보인다. 요청 목록에서는 같은 422가 주황(`statusClass`)이다. | `TracePanel.tsx` `ApiRequestList`, `ApiRequestResults.tsx:5-7` | 목록의 `statusClass`를 같이 쓴다 | S |
| A-12 | S1 | 목록 | 기간 캡션 "최근 6시간의 수집 요청"이 섹션 제목 위에 따로 있고, 건수 "4개"는 제목 반대쪽 끝에 떨어져 있다. 인프라 I-11과 같은 문제다. | `1440-light-list-card.png` | 인프라처럼 "API 대상 4개 · 최근 6시간" 한 줄로 합친다 | S |
| A-13 | S1 | 목록·요청 표 | 빈 값 표시에 `—`를 쓴다(`ApiTargets.tsx` 4곳, `ApiRequestResults.tsx` 소요 열). 경로 버튼의 `title`에도 ` — `가 있다. ADR 0009 위반이다(빈 값은 `-`). `check-design-rules`는 대시를 세지 않아서 걸리지 않았다. | `ApiTargets.tsx:41-42,51-52`, `ApiRequestResults.tsx:24,39` | `-`로 바꾸고 `title`은 쉼표나 괄호로 고친다 | S |
| A-14 | S1 | 상세 헤더 | `수집 데이터` 값이 원시 신호명(`traces, logs`)이다. 같은 서비스의 수신 확인은 `API 트레이스`, 메뉴는 `API 요청`이라고 부른다. | `1440-light-detail.png`, `TelemetryReceiptStatus.tsx` `labels` | 값을 `로그, API, 메트릭`으로 표시한다(DESIGN.md §9 금지 사항 15의 "signal → 데이터 유형") | S |
| A-15 | S1 | 목록 (데모) | 데모에서는 네 서비스의 요약이 모두 같다(요청 72, 5xx 6, 에러율 8.3%, 분포 84.7/6.9/8.3%). 경로와 p95는 서비스마다 다르다. mock이 서비스마다 같은 개수로 요청을 만들기 때문이고, 실제 코드 경로에는 문제가 없다. 다만 공개 데모에서는 비교 목록이 무의미해 보인다. | `scenario-*-list.json`, `mocks/serviceTelemetry.ts:56-100` | 프로필별로 요청 수와 실패율을 다르게 준다 | S |
| A-16 | S1 | 목록 (행 실패) | 한 대상의 요약 조회가 실패하면 표 보기에서 "요약 조회 실패"(경로 열)와 "요약을 불러오지 못했습니다 + 다시 시도"(이름 아래)가 함께 나온다. 데모의 partial-failure 시나리오는 API 목록에 영향이 없어서 소스로만 확인했다. | `ApiTargets.tsx:13-14,23-26` | 경로 열은 `-`, 안내는 한 곳에만 둔다 | S |

확인했지만 문제로 보지 않은 것: 필터 빈 결과(원인과 `필터 해제`가 함께 있음), 추이 실패와 과다 조회(10만 건 초과) 안내, 트레이스 행 Enter로 패널 열기, 연결 대화상자의 키 1회 표시와 바깥 클릭 보호, 다크 테마(axe 위반 0건), 탭의 화살표·Home·End 이동. 추가 직후 목록에 새 서비스가 보이지 않은 것은 점검 스크립트가 페이지를 다시 읽어 데모 메모리가 초기화된 탓이다(제품 문제 아님). 320px와 200% 확대는 확인하지 않았다.

## 3. 참고 제품 비교와 추가 결정

비교 대상은 SigNoz, Jaeger UI, Uptrace, HyperDX의 소스(기본 브랜치, 2026-11-12)와 Grafana Traces Drilldown(소스와 문서 일부)이다. 경로 약어는 다음과 같다. SZ=`SigNoz/signoz:frontend/src/`, JG=`jaegertracing/jaeger-ui:packages/jaeger-ui/src/components/`, UT=`uptrace/uptrace:vue/src/`, HX=`hyperdxio/hyperdx:packages/app/src/`, GD=`grafana/traces-drilldown:`.

### 3.1 기능 비교

| 기능 | 가진 제품 (근거) | EveryUp |
| --- | --- | --- |
| endpoint별 요약 표(요청 수·에러율·p50/p95/p99, 정렬) | SigNoz Key Operations (SZ `container/MetricsApplication/TopOperationsTable.tsx`), Jaeger operations 표 (JG `Monitor/ServicesView/operationDetailsTable/index.tsx`), Uptrace span groups (UT `tracing/GroupsTable.vue`, `use/uql.ts`), HyperDX Top 20 endpoints (HX `ServicesDashboardPage/HttpTab.tsx`) | **부분.** `5xx 최다` 한 줄뿐 (`AgentServiceRequestTrends.tsx`, `StatusSummary`). `path_template`은 저장됨 |
| 서비스 목록의 RED 값(요청량·에러율·지연) | SigNoz Services (SZ `container/ServiceTable/Columns/ColumnContants.ts`), Jaeger Monitor, Uptrace System overview (UT `tracing/views/Overview.vue`) | **부분.** 요청 수·5xx 건수만 (`features/api-requests/ApiTargets.tsx`) |
| RED 추이 차트 | 전부 (SZ `Tabs/Overview.tsx`, JG `Monitor/ServicesView/index.tsx`, HX `HttpTab.tsx`, Grafana 문서) | **있음.** 지표 타일 3개 + p50/p95/p99 (`AgentServiceRequestTrends.tsx`) |
| 상태코드 분포, 상태·메서드 필터 | SigNoz 퀵 필터와 External API 상태코드 차트 (SZ `container/ApiMonitoring/.../StatusCodeBarCharts.tsx`), Jaeger는 tag 필터로만 | **부분.** 분포 띠는 있고 필터는 `에러만`뿐. 백엔드는 `minStatus`/`maxStatus`를 이미 받는다 (`observed_services.go:315-316`) |
| 지연 히스토그램·히트맵 | HyperDX (HX `components/Search/DBSearchHeatmapChart`), Grafana (GD `src/components/Explore/panels/histogram.ts`) | 없음 |
| 이전 기간과 비교 | SigNoz `timeShift` (SZ `constants/queryFunctionOptions.ts`), Uptrace 이전 기간 이동 (UT `components/date/DateRangePicker.vue`) | **있음.** 지난주 같은 시간 점선 |
| 선택 구간과 기준 비교(속성 차이) | HyperDX Event Deltas (HX `components/DBDeltaChart.tsx`), Grafana Comparison | 없음 |
| 외부 API 호출(CLIENT span을 호스트별로) | SigNoz External API Monitoring (SZ `container/ApiMonitoring/utils.tsx`, https://signoz.io/docs/external-api-monitoring/overview/), Jaeger Server/Client 전환 | 없음. `api_requests`는 SERVER span만 투영한다 (`otlp_ingest.go:710`) |
| 트레이스 waterfall의 span 트리, 속성·이벤트 보기 | 전부 (JG `TracePage/TraceTimelineViewer/SpanTreeOffset.tsx`, `SpanDetail/Accordion*.tsx`; UT `tracing/TraceTimeline.vue`; SZ `pages/TraceDetailsV3`; HX `DBTraceWaterfallChart.tsx`) | **부분.** 시간 막대만 있고 들여쓰기가 없다. 속성은 헤더·바디만 보인다 (`TracePanel.tsx`). `parentSpanId`·`attributes`·`events`·`statusMessage`는 응답에 이미 있다 |
| 트레이스끼리 비교(diff) | Jaeger만 (JG `TraceDiff/TraceDiff.tsx`) | 없음 |
| 느린 요청·Top-N | Uptrace Slowest groups (UT `tracing/views/OverviewSlowestGroups.vue`), HyperDX 느린 5% (HX `ServiceDashboardEndpointSidePanel.tsx`), Jaeger 소요 범위 검색 | **부분.** 트레이스 탭 `느린순` (`AgentServiceTracesTab.tsx`). 요청 목록은 시간순만 |
| Apdex | SigNoz만 (SZ `Tabs/Overview/ApDex`) | 없음 |
| 임의 attribute 필터 | 전부 (SigNoz 퀵 필터, JG `SearchTracePage/SearchForm.tsx` tags, UT `tracing/query/AttrFilterMenu.vue`, GD `AttributesSidebar.tsx`, HyperDX 검색) | 없음. 경로 부분 일치 검색만 있다 |
| 요청에서 로그로 이동 | SigNoz (SZ `SpanDetailsPanel/SpanLogs`), Uptrace (UT `tracing/TraceTabs.vue`), HyperDX (HX `TraceLogsPanel.tsx`) | **있음.** 트레이스 패널 `탭에서 보기: 로그` (`TracePanel.tsx` `traceTargetPath`) |
| endpoint 에러율·지연 알림 | Uptrace span group 모니터 (UT `tracing/NewMonitorMenu.vue`), SigNoz trace 알림, HyperDX 검색 알림 | **부분.** 서비스 단위 `error_rate`·`latency_p95`·`latency_p99` (`models/alert_rule.go:31-33`). endpoint 단위는 없다 |
| 배포·버전 표시 | Uptrace annotations (UT `org/use-annotations.ts`) | **부분.** Docker 서비스만. 직접 연결 서비스는 배포를 알 수 없다 (DESIGN.md §4.2) |

### 3.2 결정

판단 기준은 이 제품의 방향이다. 작은 자체 호스팅 도구, SQLite 단일 연결, 패시브 Agent 하나, `api_requests`는 SERVER span 전용이라는 불변식을 유지한다. 프록시·eBPF 자체 개발·pcap은 다시 꺼내지 않는다. 아직 실제 운영 데이터가 없으므로, 테스트 앱 하나로도 바로 쓸모가 보이는 것을 앞에 둔다.

| 기능 | 결정 | 규모 | 이유 |
| --- | :-: | :-: | --- |
| span 트리·속성·이벤트·실패 원인 보기 | **추가** | S | 데이터가 이미 응답에 있어서 프론트만 고치면 된다. OTel을 붙인 앱이면 첫 요청부터 쓸모가 있다(A-10) |
| endpoint별 요약 표 | **추가** | M | 참고 제품 네 곳 모두의 기본 화면이고 "어느 API가 문제인가"에 직접 답한다. `path_template`이 있어 `GROUP BY` 한 번과 Go 백분위(`RequestStats`와 같은 방식, 같은 행 상한)로 된다. 행 루프 안에서 다시 쿼리하지 않는다(§4 대안 A) |
| 상태코드·메서드 필터 | **추가** | S | 백엔드가 `minStatus`/`maxStatus`를 이미 받는다. 분포 띠의 `4xx`·`5xx`를 누르면 목록이 걸러지게 하면 된다. 메서드 필터는 handler에 한 줄 추가한다(repo는 `Methods`를 이미 지원) |
| 서비스 목록의 에러율·p95 | **추가** | S~M | 목록의 역할이 문제 서비스 찾기다. 알림용 `WindowStats`가 한 번에 count·errors·p95를 내므로 요약 응답에 붙인다(§4 대안 B) |
| 느린 요청 별도 목록 | 보류 | S | 트레이스 탭 `느린순`과 endpoint 표의 p95 정렬로 대부분 해결된다. 둘을 쓴 뒤에도 부족하면 그때 요청 목록에 `소요 순`을 단다 |
| endpoint 단위 알림 | 보류 | M | endpoint 표가 생긴 뒤 표에서 "이 경로로 알림 규칙 만들기"로 진입하는 방안을 본다. 지금은 서비스 단위 규칙으로 충분하다 |
| 외부 API 호출 보기(CLIENT span) | 보류 | M~L | `api_requests` 불변식을 건드리지 않으려면 spans에서 따로 집계해야 한다. 클라이언트 계측 데이터가 실제로 들어오는지 확인한 뒤 판단한다. 데모 트레이스에는 `payments.partner.io` 같은 CLIENT span이 이미 있다 |
| 직접 연결 서비스의 배포 표시 | 보류 | M | `service.version` resource attribute가 바뀌는 시점을 표시하는 방안이다. 실제 데이터에 이 값이 오는지 먼저 본다 |
| 임의 attribute 필터 | 보류 | L | spans의 JSON 속성을 질의해야 하고 SQLite 단일 연결에 부담이 된다. 경로 검색과 trace ID 이동으로 버틴다 |
| 지연 히스토그램·히트맵 | 제외 | M | 작은 데이터에서는 해상도가 나오지 않고, p50/p95/p99 선과 지난주 점선이 같은 질문에 답한다 |
| 선택 구간과 기준 비교 | 제외 | L | 대량 데이터 탐색 도구의 기능이다. 이 제품 규모에서는 쓸 일이 드물다 |
| 트레이스 diff | 제외 | L | Jaeger에만 있는 전문가 기능이다. 트레이스 두 개를 패널에서 번갈아 보는 것으로 충분하다 |
| Apdex | 제외 | S | 목표 응답 시간 설정이 하나 더 생기는데, p95와 에러율 알림이 이미 같은 역할을 한다 |

## 4. UI 구성 대안

### 대안 A. 상세: 추이 카드와 요청 목록 사이에 `Endpoint` 표

- **대안:** 열은 `method + path_template`, 요청, 에러율, p95, 마지막 오류 시각이다. 기본 정렬은 에러 수 내림차순, 같으면 p95 내림차순이다. 행을 누르면 아래 요청 목록이 그 endpoint로 걸러진다. 지금의 `q`는 원래 경로의 부분 일치라서 `/v1/orders`가 `/v1/orders/:id/cancel`까지 잡으므로, `pathTemplate` 필터 파라미터를 하나 추가한다. 표가 `5xx 최다` 한 줄을 대신하므로 그 줄은 지운다. 기간은 페이지 기간을 따르고, 상위 10개를 보인 뒤 `모두 보기`로 펼친다.
- **효과:** A-08이 해결된다. 실패 원인(A-10)과 이어서 "어느 endpoint → 어느 요청 → 왜 실패"가 한 화면에서 끝난다.
- **비용:** M. 백엔드 집계 하나(`GROUP BY method, path_template`, 백분위는 Go, `RequestStats`의 10만 행 상한과 `truncated` 규칙 재사용)와 표 컴포넌트 하나다. Docker 서비스 상세(`AgentServiceRequestsTab`)도 같은 패널을 쓰므로 함께 바뀐다. 표는 `ResourceTable`과 DESIGN.md §4.5의 데이터 표 규약을 따른다.

### 대안 B. 목록: 에러율·p95·수신 상태 열 + 문제 순 정렬

- **대안:** 표 보기의 열을 `대상 | 수집 | 요청 | 에러율 | p95 | 5xx 최다 경로`로 바꾼다. 수집 열은 `traces` 수신 기준의 `수집 중·수집 지연·수신 대기`이다(A-02). 기본 정렬은 에러율, 같으면 5xx 건수 내림차순이고, 수신 대기 대상은 맨 아래에 둔다. 머리는 인프라와 같은 꼴인 "API 대상 4개 · 에러율 높은 순"(A-12)이다. 카드 보기도 같은 순서로 `요청 | 에러율 | p95` 세 칸을 보인다.
- **효과:** A-07과 A-02가 함께 해결되고, 목록 5xx와 상세 에러율의 정의 차이도 사라진다.
- **비용:** S~M. 요약 응답에 `WindowStats`의 `errorCount`·`p95`·`timed`를 붙이고, 수신 상태는 대상별 `setup-status`를 같이 부른다. 대상이 많아지면 요청 수가 늘어나므로, 그때는 목록용 일괄 엔드포인트로 바꾼다. 인프라 대안 B와 같은 틀이라 메뉴 간 일관성도 좋아진다.

### 대안 C (권장하지 않음). 요청 탭과 트레이스 탭 합치기

요청 행이 곧 트레이스 진입점이므로 탭 하나로 합치는 방안도 검토했다. 그러나 트레이스 탭에는 HTTP가 아닌 루트(데모의 CONSUMER 트레이스 같은 메시지 처리)도 있다. 합치면 이 트레이스들이 사라지거나, `api_requests` 불변식을 깨고 섞어야 한다. 탭은 그대로 두고 대안 A로 탐색 경로를 짧게 하는 편이 낫다.

## 5. 권장 순서

1. **바로 고칠 것 (S, 한 PR):** A-03, A-05, A-06, A-09, A-11, A-12, A-13, A-14, A-16, 그리고 A-01의 확인 문구.
2. **공통 컴포넌트·결정이 필요한 것:** A-01의 `API 연결 해제` 액션(로그·메트릭 상세에도 같은 규칙), A-02 수신 상태 기준(인프라와 달리 `lastSeenAt`이 아니라 `traces` 수신 시각), A-04 차트 키보드 처리를 훅으로 추출.
3. **기능 추가 (§3.2 "추가"):** A-10 span 트리·속성·실패 원인(S) → 대안 A endpoint 표(M) → 대안 B 목록 열·정렬과 상태코드 필터(S~M). A-15 데모 데이터 차등은 대안 B와 함께 고친다. 데모 값이 같으면 정렬을 확인할 수 없다.
