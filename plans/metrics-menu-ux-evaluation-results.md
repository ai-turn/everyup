# 메트릭 메뉴 UI·UX 점검 결과

작성일: 2026-11-12 · 기준: [인프라 점검 계획](infra-menu-ux-evaluation-plan.md)의 방식(약식) · HEAD `0f352726` (제품 코드 변경 없음) · 데모 `http://127.0.0.1:5212/everyup/demo/` (`vite build --mode demo`를 별도 outDir로 빌드해 `vite preview`) · Chromium(Playwright)

인프라 2차 점검과 같은 **약식 점검**이다. 점수는 매기지 않고 심각도(S1~S4)만 붙였다. 데스크톱 1440·모바일 390, 라이트·다크에서 목록·상세·단독 보기·연결 대화상자를 캡처하고 axe를 돌렸다. 상태 처리와 많은 시리즈·많은 메트릭 이름의 동작은 소스로 확인했다. 이번에는 다른 제품의 메트릭 탐색 화면과 기능을 비교하고 추가 여부를 정하는 절(§5)을 붙였다. 증거는 [`metrics-menu-ux-evaluation-evidence/`](metrics-menu-ux-evaluation-evidence/)에 있다(`audit.mjs`·`keyboard.mjs`·`setup.mjs`, API Key는 마스킹).

대상 화면: 목록 `/metrics` (`MetricsPage`·`MetricServices`), 상세 `/metrics/:serviceId` (`DirectMetricsDetailPage` → `AgentServiceMetricsTab`의 `ServiceMetricsPanel`), 단독 보기 `?metric=` (`MetricChart` expanded + `MetricExplorerControls`), 연결 대화상자 (`MonitoringConnection` → `DirectTelemetrySetupDialog`·`DirectTelemetrySetupResult`).

## 1. 요약

- 목록 → 상세 → 단독 보기 → 복귀 흐름과 빈 목록, 연결 대화상자는 막힘 없이 동작했다. 가로 넘침은 4개 환경 모두 없고, axe 위반은 모바일 상세의 1건(M-12)뿐이다.
- **눈에 보이는 결함 두 개가 모든 상세에 있다.** 시리즈가 하나인 차트의 툴팁이 내부 키 `series_0`을 이름으로 보여 주고(M-01), 고정 버튼 아이콘이 `?` 도움말 모양으로 나온다(M-02, `push_pin` 아이콘 경로 없음).
- **키보드로는 격자 차트의 값을 읽을 수 없다.** 인프라가 I-05에서 고친 문제가 메트릭 격자에는 그대로 남아 있다(M-03). 패널마다 Tab 정지점이 4개라 12개 패널이면 48번 눌러야 지나간다(M-05).
- **많은 메트릭에서 중요한 섹션이 빠질 수 있다.** 처음 12개를 이름순으로 자른 뒤 섹션으로 나눠서, `요청과 응답` 지표가 이름이 앞서는 사용자 정의 지표에 밀려 숨는다(M-04, 소스로 확인).
- **인프라에서 고친 공통 문제 셋이 메트릭에는 아직 적용되지 않았다.** 헤더 `연결 활성`과 본문 `수집 중`이 따로 놀고(M-06), 모바일 첫 화면에 차트가 없으며(M-07), 연결 안내가 "로그 또는 요청을 발생시켜 주세요"다(M-09).
- 참고 제품 5개와 비교한 결과, 빠진 기능 대부분(Attribute 자동완성·group by·집계·시간축 백분위)은 계획서 3단계에 해당해 **보류**한다. 바로 추가할 것은 단독 보기에서 **해당 메트릭으로 알림 규칙 추가**(메트릭 이름 미리 채움) 하나다(§5).

## 2. 이슈

| ID | 심각도 | 화면 | 내용 | 근거 | 권장 수정 | 규모 |
| --- | :-: | --- | --- | --- | --- | :-: |
| M-01 | S2 | 상세 격자·단독 보기 | 시리즈가 하나인 차트(gauge 등)의 툴팁 행 이름이 `series_0`이다. 마우스·키보드 모두 같다. `ChartTooltip`이 `dataKey`로 중복을 지우며 먼저 온 항목을 남기는데, 이름 없는 채움 `Area`(`tooltipType: 'none'`)가 이름 있는 `Line`보다 먼저 온다. | `keyboard-expanded.png`, `chart-keyboard-arrows.json`(mouse 행), `MetricChart.tsx:196`, `ChartElements.tsx:204` | `ChartTooltip`에서 `type === 'none'` 항목을 거르거나 Area에 `name`을 준다. `InfraTrends.tsx:189`·`AgentServiceRequestTrends.tsx:332`도 같은 구성이라 함께 확인 | S |
| M-02 | S2 | 상세 격자·단독 보기 | 고정 버튼이 `?` 원 아이콘으로 보인다. `materialIconPaths.ts`에 `push_pin`이 없어 `help_outline`으로 대체된다. 도움말 버튼으로 읽히고, 누르면 지표가 고정된다. | `1440-light-detail.png`, `MetricChart.tsx:101`, `MaterialIcon.tsx:13` | `push_pin` 경로 추가 (MUI에서 추출, 메모리 규칙대로) | S |
| M-03 | S2 | 상세 격자·단독 보기 | 격자 차트 SVG가 Tab 정지점(`role=application`)이고 화살표로 6개 패널의 십자선이 함께 움직이지만, 툴팁은 마우스를 올린 패널에만 보여서 값이 나오지 않는다. 단독 보기는 툴팁이 나오지만 Home·End는 무시된다(알려진 Recharts 숫자 시간축 문제). 인프라 I-05와 같다. | `chart-keyboard-arrows.json`(grid: 툴팁 빈 값), `tab-sequence.json`, `AgentServiceMetricsTab.tsx`의 `showTooltip={expanded \|\| hovered === …}` | 인프라 I-05 처리(`InfraTrends`의 직접 키보드 처리, 차트 아래 `aria-live` 값 줄)를 메트릭 차트로 옮김 | M |
| M-04 | S2 | 상세 격자 | `displayed`가 이름순 전체 목록을 12개로 자른 뒤 섹션별로 나눈다. 메트릭이 많고 `app.*`·`db.*` 같은 사용자 정의 지표가 이름순으로 앞서면 첫 섹션 `요청과 응답`이 비거나 빠지고, `메트릭 12개 더 보기`를 누르면 위쪽 섹션에 패널이 끼어들어 보던 위치가 밀린다. 데모 서비스는 지표가 3개 이하라 재현되지 않아 소스로만 확인했다. | `AgentServiceMetricsTab.tsx:74`, `:112` | 섹션 순서 → 이름순으로 정렬한 뒤 자름 | S |
| M-05 | S2 | 상세 격자 | 패널 제목 버튼의 접근 이름은 원본 이름(`billing.jobs.completed`)인데 보이는 글자는 `완료된 작업`이다(WCAG 2.5.3 Label in Name, 음성 입력으로 누를 수 없음). 패널마다 Tab 정지점이 제목·고정·원본 이름 툴팁·차트 4개라 12개 패널이면 48번이다. 검색창도 접근 이름 `메트릭 이름으로 찾기`와 안내 `이름 또는 설명으로 지표 찾기`가 다르다. | `tab-sequence.json`, `MetricChart.tsx:92`, `:104`, `AgentServiceMetricsTab.tsx:105` | 제목 버튼은 보이는 제목을 이름으로, 원본 이름은 `aria-describedby`. 원본 이름 줄의 `focusable` 툴팁 제거(이미 보이는 글자). 검색창 이름을 안내와 맞춤 | S |
| M-06 | S2 | 상세 | 헤더는 `연결 활성 · 마지막 수집 21:57:26`, 바로 아래 본문은 `수집 중 · 마지막 수신 21:57:49`다. 상태 둘과 시각 둘이 다른 이름으로 나온다. 수신 전이거나 5분 넘게 끊겨도 헤더는 `연결 활성`이다. 인프라 I-06(로그 I-05)과 같은 문제이며, 인프라는 `DirectConnectionMeta`의 `collection` prop으로 고쳤지만 메트릭 상세는 쓰지 않는다. | `1440-light-detail.png`, `DirectMetricsDetailPage.tsx:154` | 헤더에 `collection`(목록·본문과 같은 `metricCollection` 판정)을 넘기고, 본문의 수집 현황 줄은 `N개 지표`만 남김 | S |
| M-07 | S2 | 상세·단독 보기 (모바일) | 390px에서 첫 차트가 y=898(첫 화면 844px 밖), 단독 보기는 y=1103에서 시작한다. 연결 정보가 첫 화면의 절반 이상을 차지한다. 인프라 I-08과 같으며 인프라는 `collapseOnMobile`로 고쳤다. | `390-light-detail-fold.png`, `390-light-expanded.png`, `390-*-detail.json`의 `firstChartTop` | `collapseOnMobile` + `collapseLabel="서비스 정보"` | S |
| M-08 | S2 | 단독 보기 (데스크톱) | 1440×900에서 차트가 y=861에서 시작해 첫 화면에 거의 보이지 않는다. 차트 위에 연결 정보, 기간 툴바, 수집 현황, `← 전체 메트릭`, 탐색 조건 카드(원값·초당 증가량 + 설명 문장 + 접힌 두 줄, 약 210px), 제목·종류·요약, 메타 줄이 쌓인다. | `1440-light-expanded.png`, `1440-light-expanded.json` | §3 대안 B | M |
| M-09 | S2 | 연결 대화상자 | 메트릭만 연결해도 수신 확인 안내가 "설정을 적용한 뒤 **로그 또는 요청**을 발생시켜 주세요… 권한 추가만으로 앱의 전송 설정이 변경되지는 않습니다"다. SDK의 메트릭은 요청과 관계없이 주기적으로(기본 60초, `OTEL_METRIC_EXPORT_INTERVAL`) 전송된다. 인프라 I-03과 같고 `note` prop은 이미 있다. | `setup-flow.json`, `setup-result-desktop.png`, `TelemetryReceiptStatus.tsx:44`, `DirectTelemetrySetupResult.tsx:64` | 신호가 `metrics`뿐이면 "앱을 재시작하면 1분 안에 첫 메트릭이 들어옵니다(내보내기 주기 기본 60초)" | S |
| M-10 | S1 | 연결 대화상자 | 기존 서비스 탭의 안내가 "기존 연결 키의 범위에 **메트릭를** 추가합니다"다. 로그·API는 `를`이 맞고 메트릭만 틀린다. | `setup-flow.json`, `DirectTelemetrySetupDialog.tsx:180` | "범위에 메트릭 권한을 추가합니다"처럼 조사가 필요 없는 문장 | S |
| M-11 | S2 | 상세 (수신 전) | 메트릭을 하나도 받지 않은 서비스는 "수신한 메트릭이 없습니다 / OpenTelemetry SDK가 메트릭을 보내면 여기에 표시됩니다"만 보인다. 헤더는 `연결 활성`(M-06)이라 정상처럼 보이고, 설정을 다시 볼 방법이 없다. 인프라 I-01은 `수신 대기` + `설정 다시 받기`로 고쳤다. | `AgentServiceMetricsTab.tsx:110` | 수신 대기 상태와 내보내기 주기 안내, 설정 안내(`TelemetrySetupGuidance`) 또는 키 재발급 액션 | S |
| M-12 | S2 | 상세 격자 (모바일) | 여러 시리즈 패널의 범례 칩 영역이 `max-h-24 overflow-y-auto`인데 포커스를 받지 않아 키보드로 스크롤할 수 없다. axe `scrollable-region-focusable`(serious), 390 라이트·다크. | `390-light-detail.json`, `MetricChart.tsx:203` | `tabIndex={0}` + `aria-label="시리즈 범례"`, 또는 높이 제한 제거 | S |
| M-13 | S1 | 단독 보기 | 격자는 `완료된 작업` + 원본 이름을 보여 주는데 단독 보기 제목은 원본 이름뿐이다. 패널을 누르면 제목이 바뀌어 같은 지표인지 다시 확인하게 된다. | `1440-light-detail.png` ↔ `1440-light-expanded.png`, `MetricChart.tsx:91` | 단독 보기도 표시 이름을 제목으로, 원본 이름을 보조 줄로(긴 이름 줄바꿈은 유지) | S |
| M-14 | S1 | 상세 격자 | DESIGN.md §4.2는 "패널 제목 줄에 `StatusLight`로 상태를 띄우고"와 "검색은 8개 초과일 때"라고 적었지만, 코드는 상태를 단독 보기에서만 보이고(`fa222463`부터) 검색은 지표가 1개만 있어도 보인다. 격자를 훑을 때 어느 패널이 `확인 필요`인지 알 수 없다. | `MetricChart.tsx:110`, `AgentServiceMetricsTab.tsx:105`, `DESIGN.md` 677·680행 | 격자 패널 제목 줄에 상태를 다시 띄울지 결정하고 문서나 코드 중 하나에 맞춤 | S |
| M-15 | S1 | 상세 | 오류·확인 문구에 영어 리소스명과 내부 용어가 남아 있다: "직접 Metrics 서비스를 불러오지 못했습니다", "이 서비스에는 Metrics 기능이…", "이 Observed Service를 삭제할까요?", 수집 데이터 값 `logs, metrics`. DESIGN.md §2(라벨에 `Logs`·`Metrics` 금지, signal → `데이터` 한국어)와 어긋난다. | `DirectMetricsDetailPage.tsx:47`, `:111`, `:124`, `:141`, `:158` | "메트릭 서비스를…", "이 서비스를 삭제할까요?", `로그, 메트릭`. 수집 데이터 표기는 로그·API 상세도 같이 | S |
| M-16 | S1 | 목록·상세 (데모) | 데모의 모든 시나리오(확인 필요·일부 실패·정상)에서 서비스 5개가 모두 `수집 중`, `확인 필요 0`이다. mock health가 `breached`·지연 상태를 만들지 않아 목록의 핵심 기능(`확인 필요순`)과 상세의 `확인 필요` 목록을 데모로 볼 수 없다. 6시간 창에서 포인트가 마지막 약 1시간에만 있는 것도 mock 데이터 때문이다. 실제 코드 경로(`repository_otel_metric_health.go`)는 문제없다. | `scenario-*-list.json`, `mockRouter.ts:1495` | `attention` 시나리오에서 한 서비스에 임계값 초과·수신 지연 지표를 둠 | S |
| M-17 | S1 | 단독 보기 | URL에 `metricType`만 있고 `metricUnit`이 없으면 단위가 있는 메트릭도 "메트릭을 찾을 수 없습니다"가 된다. 앱이 만드는 링크는 항상 단위를 넣으므로 손으로 쓴 링크에서만 생긴다. | `AgentServiceMetricsTab.tsx`의 `matches` 계산 | `metricUnit`이 없으면 단위 비교를 생략 | S |

확인했지만 문제로 보지 않은 것: 목록 빈 상태(원인과 `메트릭 연결`이 함께 있음), 목록·상세·패널별 조회 실패의 `다시 시도`, 시리즈 상한(6개 표시·200개 발견·5,000 포인트) 안내 문구, 초당 증가량을 계산할 수 없을 때의 설명, `확인 필요`가 서버 health 검사 전체 기준이라는 점, 다크 테마 대비(axe 위반 없음), 시리즈 이름의 `key="value"` 따옴표 표기(값 타입 보존 목적).

많은 시리즈·많은 이름에서의 동작(소스): 목록 카탈로그와 상세 health는 모든 이름을 상한 없이 돌려준다. 상세는 패널마다 쿼리를 하나씩 보내 12개가 단일 SQLite 커넥션에서 차례로 처리된다. 시리즈 발견은 `DISTINCT … LIMIT 201`, 포인트는 5,000개, 기간은 24시간까지다(`repository_otel_metric_query.go:26-27`, `metric_query.go:68`). 지금 규모에서는 문제가 아니며, 실제 부하는 계획서 0단계 측정 대상이다.

미확인: 320px 이하·200% 확대, 실제 OTLP 수신부터 화면까지(데모 mock만 사용), 많은 메트릭(12개 초과)의 실제 화면(M-04는 소스로만 확인).

## 3. UI 구성 대안

### 대안 A. 상세 머리 정리: 인프라에서 쓴 공통 처리 그대로

M-06·M-07·M-11을 한 번에 다룬다. 헤더에 `collection` 상태를 넘기고 본문 수집 현황 줄은 `N개 지표`로 줄인다. 모바일은 연결 정보를 `서비스 정보`로 접는다. 수신 전에는 본문에 `수신 대기`와 설정 안내를 둔다.

- **효과:** 상태·시각이 한 번만 나오고, 390px에서 첫 차트가 첫 화면 근처로 올라온다(인프라에서 같은 처리로 확인됨).
- **비용:** S. 새 컴포넌트 없이 인프라 상세에서 쓴 prop을 그대로 쓴다.

### 대안 B. 단독 보기: 탐색 조건을 차트 머리의 한 줄로

지금은 탐색 조건이 차트 위의 별도 카드(약 210px)다. `원값 / 초당 증가량` 전환, `Attribute 필터 (N)`, `시리즈 선택 (6/8)`을 차트 제목 아래 한 줄의 버튼으로 두고, 필터·시리즈 목록은 그 아래로 펼친다. 초당 증가량 설명 문장은 전환 버튼의 툴팁으로 옮긴다. 적용한 필터 칩은 그 줄에 그대로 둔다.

- **효과:** 1440×900에서 차트가 첫 화면 안으로 들어온다(M-08). 조건과 결과가 한 카드 안에 있어 조건을 바꿨을 때 결과가 바로 보인다.
- **비용:** M. DESIGN.md §4.2 "단독 보기의 탐색 조건 — 차트 앞의 중립 카드"를 바꾸는 결정이므로 문서도 고친다. 참고 제품은 엇갈린다: SigNoz·HyperDX는 쿼리 편집기를 차트 위에, Grafana Metrics Drilldown은 큰 패널을 먼저 두고 탭을 아래에 둔다.

### 대안 C (권장하지 않음). 격자 대신 SigNoz식 메트릭 요약 표

SigNoz Summary·Uptrace처럼 이름·타입·단위·설명·시리즈 수·마지막 수신 표를 상세 첫 화면으로 두고 행을 눌러 차트를 여는 방안도 검토했다. 그러나 DESIGN.md §4.2에 따르면 메트릭을 하나씩 고르는 방식(차트 아래 표, 왼쪽 레일)은 이미 두 번 바꿨다가 *"한눈에 들어오지 않는다"*는 피드백으로 격자로 돌아왔다. 시리즈 수 열은 카디널리티를 실제로 본 뒤에 의미가 생긴다(0단계). 지금은 격자를 유지하고 M-04로 순서만 바로잡는다.

## 4. 권장 순서

1. **바로 고칠 것 (S, 한 PR):** M-01, M-02, M-04, M-05, M-09, M-10, M-12, M-13, M-17.
2. **인프라에서 쓴 공통 처리 옮기기:** 대안 A(M-06, M-07, M-11), M-03(인프라 차트 키보드 처리).
3. **결정이 필요한 것:** 대안 B(M-08), M-14(격자 패널에 상태를 다시 띄울지), M-15(수집 데이터 표기를 로그·API와 함께 바꿀지), M-16(데모 시나리오).
4. **§5에서 추가로 정한 것:** 단독 보기에서 알림 규칙 추가. 다음 차례인 알림 메뉴 점검 때 같이 한다.

## 5. 참고 제품 비교와 추가 결정

### 5.1 비교 대상

2026-11-12에 각 저장소의 기본 브랜치 소스를 `gh api`로 읽었다. 표의 경로는 그 파일이다.

| 제품 | 메트릭 탐색 화면의 구성 | 주요 소스 |
| --- | --- | --- |
| Grafana Metrics Drilldown | 메트릭별 작은 패널 격자 + 검색·정렬, 메트릭을 고르면 큰 패널 아래 Breakdown·Related metrics 탭 | `grafana/metrics-drilldown` `src/MetricsReducer/`, `src/MetricScene/` |
| SigNoz Metrics Explorer | Summary(트리맵 + 메트릭 표 → 상세 드로어) / Explorer(쿼리 빌더 + 차트) / Volume Control 탭 | `SigNoz/signoz` `frontend/src/container/MetricsExplorer/` |
| Uptrace | 메트릭 표(설명·instrument·시리즈 수) → 모달 탐색기(MQL 빌더 + 차트) | `uptrace/uptrace` `vue/src/metrics/` |
| HyperDX (ClickStack) | 범용 Chart Explorer + 메트릭 찾기 모달(이름 트리, Attribute key·값) | `hyperdxio/hyperdx` `packages/app/src/components/MetricExplorer/`, `DBChartPage.tsx` |
| Prometheus UI | PromQL 쿼리 패널 + Metrics Explorer 모달(Labels Explorer로 카디널리티) | `prometheus/prometheus` `web/ui/mantine-ui/src/pages/query/` |

### 5.2 기능 비교와 결정

EveryUp 상태: 있음 / 일부 / 없음. 계획 단계는 [`.scratch/metrics-upgrade/spec.md`](../.scratch/metrics-upgrade/spec.md)(로컬 전용)의 0~6단계다. 1~2단계는 PR #101로 머지됐고, **0·3~6단계는 실제 모니터링 데이터가 생길 때까지 보류**한 상태다. 보류 항목은 실제 시리즈 수와 attribute 분포를 봐야 정할 수 있어서, 아래 결정도 기본은 `보류`다.

| 기능 | 갖춘 제품 (근거) | EveryUp | 단계 | 결정 | 규모 | 이유 |
| --- | --- | --- | :-: | :-: | :-: | --- |
| 서비스 목록 + 상태 요약 | 없음 (HyperDX가 메트릭별 송신 서비스만 나열, `MetricDetailPanel.tsx:88-93`) | 있음 `MetricsPage.tsx`, `MetricServices.tsx` | 4 | 유지 | - | 비교 대상에 없는 장점이다. 목록의 대표 지표 열은 4단계 몫 |
| 메트릭 메타데이터(타입·단위·설명·마지막 수신) | SigNoz (`ME/Summary/utils.tsx:21-72`, `MetricDetails/Highlights.tsx`), Uptrace (`MetricsTable.vue`), HyperDX (`useMetricCatalog.ts`) | 일부: 타입·단위·마지막 측정·수신은 패널·단독 보기, 설명은 단독 보기만 | 1~2 | 유지 | - | 필요한 값은 이미 보인다 |
| 메트릭별 시리즈 수(카디널리티) | SigNoz Summary, Uptrace `numTimeseries`, Prometheus `LabelsExplorer.tsx:103-135` | 없음: health가 `freshSeries`(최근 5분)를 이미 돌려주지만 화면에 없음 | 0 | 보류 | S | 0단계 측정 항목과 같다. 실제 카디널리티를 보고 표시 위치(목록 열·상세 칩)를 정한다 |
| Attribute key·값 자동완성 | 5개 모두 (Grafana `DataTrail.tsx:339`, SigNoz `QuerySearch.tsx`, Uptrace `WhereSuggestions.vue`, HyperDX `MetricAttributeHelperPanel.tsx`, Prometheus `complete/hybrid.ts`) | 없음: key·값·타입 직접 입력 `MetricExplorerControls.tsx` | 3 | 보류 (3단계 대기) | M | 서버 자동완성은 3단계. 실제 데이터가 생기면 첫 후보로, 이미 받은 시리즈 목록에서 `datalist`를 만드는 S 규모 방법이 있다 |
| 필터 연산자(!=, 정규식) | 5개 모두 (Uptrace `mql/ast/ast.go:403-416`, SigNoz `QuerySearch/constants.ts`) | 일부: 완전 일치 AND만, 최대 8개 | 3 | 보류 (3단계 대기) | M | 어떤 연산자가 필요한지는 실제 attribute를 봐야 안다 |
| Group by | Grafana `Breakdown/GroupByVariable.tsx`, SigNoz `MetricsAggregateSection.tsx:216`, Uptrace `DashGroupingMenu.vue`, HyperDX | 없음: 시리즈 = attribute 조합 전체 | 3 | 보류 (3단계 대기) | L | 서버 집계가 필요하다. 계획서 3단계 핵심 |
| 집계 함수 + 시간 버킷 | SigNoz (`stepInterval`, `ME/Inspect/constants.ts`), HyperDX `GranularityPicker.tsx`, Grafana·Uptrace 일부 | 없음: 원시 포인트, 5,000개 상한 | 3 | 보류 (3단계 대기) | L | 버킷 크기와 조회 상한은 실제 포인트 수로 정한다 |
| Counter 초당 증가량 | Grafana 자동(`getTimeseriesQueryRunnerParams.ts:43`), SigNoz·HyperDX 선택 | 있음: sum 기본 초당 증가량 `metricSeries.ts` `metricRates` | - | 유지 | - | Grafana와 같은 방식이다 |
| 시간축 백분위(p50/p95/p99 선) | Grafana `percentiles-options.ts`, SigNoz, Uptrace `MetricsAggMenu.vue:148`, HyperDX | 일부: 단독 보기에 기간 전체 p50/p95/p99 값, 선은 수신 평균 | 3 | 보류 (3단계 대기) | M~L | 버킷별 백분위는 시간 버킷이 먼저다. 계획서 3단계 "기간별 p95/p99" |
| Breakdown·연관 메트릭 탭 | Grafana `MetricActionBar.tsx:46-77` | 없음 (의미별 섹션 `metricGroup`만) | - | 제외 | L | group by 위에 얹는 기능이다. 지표 수십 개 규모의 작은 도구에는 섹션 묶음으로 충분하다 |
| 시리즈 상한과 안내 | Grafana `addCardinalityInfo.ts`, HyperDX `ChartUtils.tsx:170-209` | 있음: 6개 표시·200개 발견·잘림 안내 | - | 유지 | - | Grafana처럼 잘렸다고 알려 준다 |
| Exemplar → Trace | Grafana 일부 (`EnableExemplarsAction.tsx`) | 있음: histogram 단독 보기 `느린 예시` → `TracePanel` | - | 유지 | - | 비교 대상 중 드문 기능이다 |
| 드래그로 구간 확대 | SigNoz `TimeSeriesView.tsx:144`, HyperDX `HDXMultiSeriesTimeChart.tsx:1323`, Prometheus | 없음 | 4 | 보류 (4단계 대기) | M | 4단계 "시각 구간 확대". 24시간 상한 안에서는 1H 선택으로 대체된다 |
| 절대 시간 범위 | Grafana `SceneTimePicker`, SigNoz `DateTimeSelector`, Uptrace, Prometheus `TimeInput.tsx` | 없음: 1H·6H·24H 상대 기간 | 4 | 보류 (4단계 대기) | M | 7일 보관과 24시간 조회 상한 안에서 범위를 정해야 한다 |
| 이전 기간과 비교 | HyperDX만 (`ChartDisplaySettingsDrawer.tsx:57`) | 없음 | 6 | 보류 (6단계 대기) | M | 한 제품만 가졌고, 7일 이상 비교는 rollup이 먼저다 |
| URL로 조회 조건 공유 | 5개 모두 | 있음: `range`·`metric`·`metricAttributes`·`metricSeries`·`metricMode` (`useMetricQuery.ts`) | - | 유지 | - | |
| 저장한 보기 | Grafana `SaveQueryButton.tsx`, SigNoz saved views | 없음 (고정 4개만) | 6 | 보류 (6단계 대기) | M | 계획서가 대시보드 빌더보다 먼저 두기로 한 항목. URL 공유로 대신할 수 있다 |
| 대시보드에 추가 | Grafana `PanelMenu.tsx:58`, SigNoz `AddToDashboardButton.tsx`, HyperDX | 없음 | - | 제외 | L | 대시보드 빌더는 만들지 않는다(계획서 방향). 고정 지표가 그 역할을 한다 |
| **탐색 화면에서 알림 만들기** | Grafana `CreateAlertAction.ts`, SigNoz `CreateAlertButton.tsx`, HyperDX `TileAlertEditor.tsx` | 일부: 상세의 `알림 규칙`은 서비스로만 거른 목록으로 간다. 메트릭 이름을 미리 채우지 않는다(`alertTarget.ts`) | - | **추가** | S~M | 메트릭 임계값 알림(`alert_rules.metric_name`)은 이미 있고 ingest 시점 원값으로 평가하므로 조회 엔진(3단계)을 기다릴 이유가 없다. 단독 보기에 `알림 추가`를 두고 서비스·메트릭 이름을 채운다. 알림 메뉴 점검 때 같이 한다 |
| 지표 고정 | Grafana bookmarks `useBookmarks.ts` | 있음: 최대 4개, 브라우저 저장 (아이콘은 M-02) | - | 유지 | - | |
| 자동 새로고침 | Grafana `SceneRefreshPicker`, SigNoz `showAutoRefresh`, Uptrace `autoReloadEnabled` | 없음: 수동 새로고침 | 4 | 보류 (4단계 대기) | S | 패널 12개의 쿼리가 단일 SQLite 커넥션에 주기적으로 걸린다. 0단계에서 조회 지연을 잰 뒤 주기를 정한다 |
| 단위 자동 환산 / 수동 변경 | 자동은 5개 모두, 수동은 SigNoz `TimeSeries.tsx:176-231`, Uptrace `UnitPicker` | 자동 있음 `metricDisplayUnit`, 수동 없음 | - | 수동은 제외 | - | OTel 단위 메타데이터를 그대로 믿는다. 단위가 틀린 지표는 앱 계측에서 고친다 |

요약: **추가 1건**(단독 보기에서 알림 추가), **보류 11건**(0단계 1, 3단계 5, 4단계 3, 6단계 2), **제외 3건**(Breakdown·연관 메트릭, 대시보드에 추가, 단위 수동 변경). 비교한 다섯 제품 가운데 메트릭 화면 안에 서비스 목록과 상태 요약을 둔 제품은 없었다. EveryUp의 목록·`확인 필요` 구성은 따라갈 대상이 아니라 유지할 차별점이다.
