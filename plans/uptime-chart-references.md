# 업타임 응답시간 차트 레퍼런스 조사

확인일: 2026-11-08. 이 문서는 다음 세션에서 차트 구조와 구현 방향을 결정하기 위한 조사다. 앱 코드와 의존성은 변경하지 않았다.

## 먼저 판단할 점

**먼저 읽을 제품 저장소는 Beszel → Grafana → Uptime Kuma 순서다.** Beszel은 현재 React·Recharts 코드에 연결하기 쉽고, Grafana는 차트 탐색과 정보 구성, Uptime Kuma는 업타임 실패와 응답시간을 함께 전달하는 방식을 참고하기 좋다. 이 순서는 아래 구현을 확인한 뒤 내린 프로젝트 적합성 판단이다.

**현재 모습만으로 Recharts가 부족하다고 판단할 수 없다. 정식 Recharts 차트 구성을 기준 시안으로 만들고, uPlot을 대안으로 비교하는 순서가 합리적이다.** 이는 아래 API 확인과 현재 코드 구조를 바탕으로 한 구현 비용 판단이다. 라이브러리를 바꿔도 시간 범위, 집계, 축, 장애 표시, 툴팁을 설계하지 않으면 같은 문제가 반복된다.

현재 프로젝트는 React 19, TypeScript, Vite와 `recharts: ^3.7.0`을 사용한다. `web/frontend/src/features/uptime/components/ResponseTimeCard.tsx`는 Recharts의 `Curve`만 가져와 선을 그리고, 축·그리드·포커스 영역·상세 텍스트는 별도로 계산한다. `Curve`는 좌표를 받아 SVG 경로를 만드는 도형이고, `ComposedChart`는 축 기반 툴팁을 포함한 Cartesian 차트 문맥을 제공한다. 따라서 현재 화면은 정식 Recharts 차트 구성을 평가한 결과와 다르다. [Curve v3.7.0 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/shape/Curve.tsx), [ComposedChart v3.7.0 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/chart/ComposedChart.tsx)

## 실제 모니터링 제품에서 볼 세 곳

| 우선순위 | 저장소 | 이번 작업에서 볼 부분 | 적용할 때의 차이 |
| --- | --- | --- | --- |
| 1 | [henrygd/beszel](https://github.com/henrygd/beszel) | React·Recharts 기반 네트워크 응답시간 차트, 공통 툴팁, 결측과 고립점 처리 | 소스의 Recharts는 2.x, 현재 프로젝트는 3.x |
| 2 | [grafana/grafana](https://github.com/grafana/grafana) | 시간축·선택 시각·범례·임계값·장애 구간의 정보 구성 | Grafana 내부 데이터 모델과 플러그인 의존성이 큼 |
| 3 | [louislam/uptime-kuma](https://github.com/louislam/uptime-kuma) | 응답시간과 실패·점검 상태를 같은 시간축에 배치하는 방식 | Vue·Chart.js 구현이므로 React 코드로 바로 이식하기 어려움 |

### Beszel — 가장 먼저 읽을 구현

- [응답시간 차트 `monitors-charts.tsx`](https://github.com/henrygd/beszel/blob/main/internal/site/src/components/routes/system/charts/monitors-charts.tsx): 네트워크 모니터별 응답시간과 평균·최소·최대 시리즈를 구성한다. 차트 제목·기간·범례와 데이터 연결을 함께 살펴볼 수 있다.
- [공통 `line-chart.tsx`](https://github.com/henrygd/beszel/blob/main/internal/site/src/components/charts/line-chart.tsx): `LineChart`, `CartesianGrid`, `YAxis`, `ChartTooltip`을 한 좌표계 안에서 사용한다. 주변 선분이 없어 사라질 수 있는 단일 점을 그리는 `isolatedDot`도 있다.
- [데이터 처리 `network-monitor-utils.ts`](https://github.com/henrygd/beszel/blob/main/internal/site/src/lib/network-monitor-utils.ts): 성공한 측정값의 평균, 전부 실패한 구간의 `null`, 모니터 수집 간격에 따른 공백 삽입을 다룬다. 표현을 복사하기 전에 데이터 의미를 맞추는 데 유용하다.
- [툴팁·축 공통 코드 `ui/chart.tsx`](https://github.com/henrygd/beszel/blob/main/internal/site/src/components/ui/chart.tsx), [공식 화면 이미지가 있는 README](https://github.com/henrygd/beszel#readme).

확인한 `main`의 의존성은 React `^19.1.2`, Recharts `^2.15.4`다. 현재 프로젝트의 Recharts 3.x에 맞는 props·타입·툴팁 동작 확인이 필요하다. 라이선스는 MIT다. [package.json](https://github.com/henrygd/beszel/blob/main/internal/site/package.json), [LICENSE](https://github.com/henrygd/beszel/blob/main/LICENSE)

### Grafana — 모니터링 차트의 탐색 방식 참고

[TimeSeries](https://github.com/grafana/grafana/blob/main/public/app/core/components/TimeSeries/TimeSeries.tsx)는 [GraphNG](https://github.com/grafana/grafana/blob/main/public/app/core/components/GraphNG/GraphNG.tsx)를 통해 uPlot 기반 차트와 범례를 구성한다. [uPlot 컴포넌트 디렉터리](https://github.com/grafana/grafana/tree/main/packages/grafana-ui/src/components/uPlot)에는 축·스케일·임계값 빌더와 툴팁·키보드 플러그인이 있다. 단순 선 모양보다 축, 선택 시각, 읽는 값, 장애 구간이 어떻게 함께 동작하는지를 참고할 대상이다.

[공식 Time series 문서](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/time-series/)에서 툴팁, 범례 통계, y축 범위, 보간과 null 연결 정책을 확인할 수 있다. 문서가 연결한 [Grafana Play](https://play.grafana.org/d/000000016/)에서 실제 탐색 흐름을 볼 수 있다.

기본 라이선스는 AGPL-3.0-only이며 `packages/grafana-ui/` 등 일부 디렉터리는 Apache-2.0이다. 파일을 가져올 때는 해당 경로의 적용 범위를 구분해야 한다. [공식 LICENSING.md](https://github.com/grafana/grafana/blob/main/LICENSING.md)

### Uptime Kuma — 업타임에 가까운 상태 표현 참고

핵심 파일은 **[`PingChart.vue`](https://github.com/louislam/uptime-kuma/blob/master/src/components/PingChart.vue)**다. 시간축·가까운 지점 툴팁·기간 선택을 구성하고, heartbeat 모드에서는 응답시간 선과 실패·점검 상태의 배경 막대를 겹쳐 보여준다. 통계 모드에서는 평균·최소·최대 응답시간 시리즈를 구성한다. 실패와 큰 수집 공백을 응답시간 선에서 끊는 처리도 들어 있다.

이 구현에서 참고할 것은 **실패를 0ms에 찍힌 값처럼 보이게 하지 않는 표현과 시계열 의미**다. Vue·Chart.js·vue-chartjs를 사용하므로 이번 React 프로젝트에서는 표현과 데이터 처리 방식을 참고하는 편이 적합하다는 판단이다. [README와 공식 데모 안내](https://github.com/louislam/uptime-kuma#-live-demo), [MIT LICENSE](https://github.com/louislam/uptime-kuma/blob/master/LICENSE)

## 렌더러 후보 비교

| 후보 | 이번 화면에 유용한 기능 | 우리 프로젝트에서 추가로 맡을 일 | 판단 |
| --- | --- | --- | --- |
| [recharts/recharts](https://github.com/recharts/recharts) | React 구성, 시간 스케일, 축 기반 툴팁과 커서, 기준선·영역, Brush, 반응형 컨테이너 | 정식 차트로 재구성하고 시간축·장애 표현·툴팁을 설계 | 기존 의존성을 활용하는 첫 비교안 |
| [leeoniya/uPlot](https://github.com/leeoniya/uPlot) | 시계열 중심 Canvas, 시간축, 커서 동기화, 선택 영역 줌, null gap | React 수명주기, 상세 툴팁 플러그인, 크기 감지, 장애 주석 | 지속 갱신·다중 지표 탐색을 확대할 때 유력 |
| [apache/echarts](https://github.com/apache/echarts) | 시간축, 축 툴팁·십자선, 휠/드래그 줌, 범위 슬라이더, 선·영역 주석 | 인스턴스 수명주기, 리사이즈, 테마, 추가 의존성 도입 | 탐색과 주석 기능을 한 엔진으로 묶을 때 후보 |

위 표의 기능 근거는 아래 후보별 소스에 연결했다. 번들 크기와 렌더링 속도는 현재 앱에서 측정하지 않았으며 순위를 매기지 않았다.

### 1. Recharts — 기존 도구를 제대로 구성하는 안

조사 기준은 프로젝트와 같은 **v3.7.0**, 라이선스는 **MIT**다. 해당 버전의 peer dependency에 React 19가 포함되어 있다. 최신 웹 문서에는 이후 버전 API가 함께 나타날 수 있으므로 구현 시 v3.7.0 소스와 대조해야 한다. [라이선스](https://github.com/recharts/recharts/blob/v3.7.0/LICENSE), [package.json](https://github.com/recharts/recharts/blob/v3.7.0/package.json)

- **시간축:** `XAxis`의 `type="number"`는 실제 숫자 차이에 비례해 배치한다. `scale="time"` 또는 `"utc"`, 명시적인 표시 범위와 시간 포맷을 조합할 수 있다. 시간 문자열을 category 축에 넣으면 누락 구간도 등간격으로 보이므로 피해야 한다. [XAxis 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/cartesian/XAxis.tsx), [ScaleType 정의](https://github.com/recharts/recharts/blob/v3.7.0/src/util/types.ts)
- **읽기와 탐색:** `Tooltip`의 `content`로 시간·응답시간·HTTP 상태·실패 사유를 묶고 `cursor`로 선택 시각을 표시한다. `Brush`는 시작/끝 데이터 인덱스를 선택하는 범위 UI다. 휠 줌이나 Grafana식 범위 드래그와 동일한 기능으로 가정하면 안 된다. [Tooltip 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/component/Tooltip.tsx), [Brush 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/cartesian/Brush.tsx)
- **결측과 주석:** `Line connectNulls={false}`로 null 구간을 끊고, `ReferenceLine`으로 임계값, `ReferenceArea`로 장애 시간대를 표현할 수 있다. 실패의 설명은 별도 데이터로 남겨야 한다. [Line 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/cartesian/Line.tsx), [ReferenceLine 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/cartesian/ReferenceLine.tsx), [ReferenceArea 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/cartesian/ReferenceArea.tsx)
- **반응형:** `ResponsiveContainer`는 `ResizeObserver`로 크기를 감지한다. 현재처럼 고정 SVG 좌표와 HTML 축을 별도로 맞추는 부담을 줄일 수 있다. [ResponsiveContainer 소스](https://github.com/recharts/recharts/blob/v3.7.0/src/component/ResponsiveContainer.tsx)

기준 구성은 `ResponsiveContainer → ComposedChart → CartesianGrid / XAxis / YAxis / Tooltip / ReferenceArea / ReferenceLine / Line`이다. 선 하나만 있으면 `LineChart`도 가능하다. 이것이 화면을 좋게 보이게 하는 완성된 디자인은 아니며, 좌표·축·포커스를 하나의 차트 체계에 맡기는 출발점이다.

### 2. uPlot — 모니터링 시계열에 집중하는 안

조사 기준은 **1.6.32 release 태그**, 라이선스는 **MIT**다. master에는 이 release에 없는 새 API가 있으므로 섞어 사용하지 않는다. 핵심 렌더러는 Canvas 2D이며, 공식 README가 React 연동을 **third-party integration**으로 구분한다. [1.6.32 README](https://github.com/leeoniya/uPlot/blob/1.6.32/README.md), [라이선스](https://github.com/leeoniya/uPlot/blob/1.6.32/LICENSE)

- **시간축·데이터:** 기본 데이터는 오름차순의 공통 X 배열과 시리즈별 Y 배열이다. 시간축은 기본적으로 Unix **초**를 사용한다. 현재 앱의 밀리초 timestamp는 변환 규칙이 필요하다. Y의 `null`과 `spanGaps: false`로 결측을 표현한다. [데이터 형식과 gap 옵션](https://github.com/leeoniya/uPlot/blob/1.6.32/docs/README.md)
- **커서·줌:** 수직/수평 커서, 차트 간 커서 동기화, 드래그 선택에 따른 스케일 변경을 제공한다. 다만 휠·터치 탐색은 공식 플러그인 예제를 별도로 살펴야 한다. [Cursor·Drag API](https://github.com/leeoniya/uPlot/blob/1.6.32/dist/uPlot.d.ts), [커서 동기화 예제](https://github.com/leeoniya/uPlot/blob/1.6.32/demos/sync-cursor.html), [휠 줌 예제](https://github.com/leeoniya/uPlot/blob/1.6.32/demos/zoom-wheel.html)
- **상세 툴팁·임계값:** 이 release의 공식 툴팁 예제는 DOM과 `setCursor` hook을 사용하는 플러그인이다. 임계값·장애 배경은 추가 시리즈나 draw hook 등의 설계가 필요하다. ECharts의 `markLine/markArea` 같은 선언형 주석 API와 비용을 같게 보면 안 된다. [툴팁 플러그인 예제](https://github.com/leeoniya/uPlot/blob/1.6.32/demos/tooltips.html), [hooks·좌표변환 API](https://github.com/leeoniya/uPlot/blob/1.6.32/dist/uPlot.d.ts)
- **React·반응형:** `new uPlot`, `setData`, `setSize`, `destroy`를 React effect와 연결하고, 컨테이너 변경을 감지해 `setSize`를 호출하는 어댑터가 필요하다. 생성·갱신·해제를 반복할 때 이벤트가 남지 않는지도 검증해야 한다. [인스턴스 API](https://github.com/leeoniya/uPlot/blob/1.6.32/dist/uPlot.d.ts), [resize 예제](https://github.com/leeoniya/uPlot/blob/1.6.32/demos/resize.html)

이 프로젝트에서는 정렬·단위 변환·결측 삽입을 렌더러 밖에서 명확히 관리하고, 향후 다중 차트 커서 동기화와 지속 갱신을 강화할 경우 도입 가치가 커진다는 판단이다. 단일 응답시간 차트의 외형만 고치기 위해 바로 교체할 근거는 부족하다.

### 3. Apache ECharts — 탐색·주석을 통합하는 안

소스 확인 기준은 **6.1.0 태그**, 라이선스는 **Apache-2.0**다. Recharts와 다른 엔진을 추가하는 선택이므로 React 어댑터 또는 직접 인스턴스 연동 방식을 결정해야 한다. 특정 외부 React wrapper의 React 19 호환성까지 이번 조사에서 확인한 것은 아니다. [저장소](https://github.com/apache/echarts), [라이선스](https://github.com/apache/echarts/blob/6.1.0/LICENSE)

- **시간축·포커스:** `xAxis.type: 'time'`, `tooltip.trigger: 'axis'`, `axisPointer.type: 'cross'`를 공식 문서에서 제공한다. [시간축과 축 툴팁 문서](https://echarts.apache.org/handbook/en/concepts/axis/)
- **시간 탐색:** `dataZoom`의 `inside`는 휠 줌·마우스 이동 옵션을, `slider`는 범위 선택 UI를 제공한다. 페이지 스크롤과 차트 휠 줌이 충돌하지 않도록 제품 차원의 조작 규칙을 정해야 한다. [InsideZoomModel](https://github.com/apache/echarts/blob/6.1.0/src/component/dataZoom/InsideZoomModel.ts), [SliderZoomModel](https://github.com/apache/echarts/blob/6.1.0/src/component/dataZoom/SliderZoomModel.ts)
- **gap·임계값·장애 영역:** line series의 `connectNulls`를 명시하고, `markLine`의 `yAxis`로 임계값을, `markArea`의 시작/끝 좌표로 구간을 표현할 수 있다. [LineSeries](https://github.com/apache/echarts/blob/6.1.0/src/chart/line/LineSeries.ts), [MarkLineModel](https://github.com/apache/echarts/blob/6.1.0/src/component/marker/MarkLineModel.ts), [MarkAreaModel](https://github.com/apache/echarts/blob/6.1.0/src/component/marker/MarkAreaModel.ts)
- **반응형·수명주기:** 컨테이너 크기를 확보한 뒤 초기화하고, 크기 변경 시 `resize()`, 제거 시 `dispose()`를 호출한다. 공식 문서는 창 resize로 잡히지 않는 컨테이너 변경에 `ResizeObserver` 사용을 안내한다. [Chart Container 문서](https://echarts.apache.org/handbook/en/concepts/chart-size/)

확대·이동·구간 주석이 제품 요구의 중심이 될 때 비교할 가치가 있다. 테마와 축 간격, 선 스타일, 툴팁 정보 구조를 현재 앱과 맞추는 작업은 여전히 필요하다.

## 렌더러를 결정하기 전에 고정할 기준

아래 항목은 소스에서 자동으로 해결되는 기능 목록이 아니라, 이번 화면에 대한 **설계 제안**이다.

1. **응답시간과 상태를 구분한다.** 응답시간이 없는 실패를 `0ms`로 그리지 않는다. latency는 `null`로 유지하고 장애 시각·지속시간·실패 사유를 상태 레이어와 툴팁으로 전달한다.
2. **시간을 실제 간격으로 그린다.** 정상·불규칙 간격·수집 중단을 같은 축에서 구별한다. `connectNulls=false`만 설정해도 원본에 아예 없는 timestamp를 자동 감지하는 것은 아니므로, 수집 간격에 따른 gap 데이터 정책을 먼저 정한다.
3. **선 형태는 실제 수집 주기의 데이터로 비교한다.** 현재 공통 `lineProps`는 `monotoneX`를 사용하며, 과거 성긴 표본의 직선 표현을 되돌린 이유도 코드에 남아 있다. 실제 변동·급등·복구 데이터로 직선과 기존 보간을 평가하고, 다른 화면까지 전역 변경하지 않는다.
4. **축은 적게, 시간은 명확하게 표시한다.** 날짜가 바뀌는 구간과 현재 범위·시간대를 알 수 있어야 한다. `ms`를 반복하지 않고 단위를 축에 한 번 표시하며, y축 시작점과 범위는 지표 비교 목적에 맞춰 정한다.
5. **한 시각을 가리키면 필요한 설명을 한곳에 모은다.** 수직 커서와 선택점, 정확한 날짜/시간, latency, HTTP 상태, 실패/부분 실패의 의미를 함께 보여준다. 마우스와 키보드로 같은 사실에 접근할 수 있어야 한다.
6. **집계 규칙을 숨기지 않는다.** 장기간 범위에서 평균·최대·p95 중 무엇을 그리는지 표시하고, 평균 버킷 안의 일부 실패가 사라지지 않게 한다. timeout을 응답시간으로 환산하지 않는다.

다음 시안은 **정식 Recharts 구성부터** 비교하는 것을 제안한다. 정상 변동, 짧은 spike, 연속 장애, 수집 공백, 전부 실패, 단일 포인트, 날짜 변경을 포함하고 좁은 화면에서 축·툴팁이 유지되는지 확인한다. 요구를 충족하기 어렵다면 같은 데이터로 uPlot을 비교하고, 줌·주석 요구가 중심이면 ECharts를 평가한다. 이는 현재 의존성과 예상 구현 범위를 고려한 제안이며, 실제 앱 성능 측정 결과는 아니다.

## 프로젝트 도입 제안

사용자의 후속 요청에 따라 현재 코드와 대조한 제안이다. 구현 완료나 사용자 확정을 뜻하지 않는다.

| 대상 | 도입 범위 | 이유 |
| --- | --- | --- |
| Recharts | 기존 엔진을 유지하고 `ResponseTimeCard`를 정식 차트 구성으로 교체 | 앱에 같은 방식의 차트와 공통 테마·축·툴팁이 이미 있음 |
| Beszel | 공통 차트 구성, 결측·고립점 처리 방식 참고 | 데이터와 표현을 연결하는 구체적인 React 구현 |
| Grafana | 수직 커서·선택점·정보를 모은 툴팁·범례와 축 구성 참고 | 어느 시각의 어떤 값을 읽는지 분명히 하는 탐색 방식 |
| Uptime Kuma | 응답시간 선과 장애 상태를 같은 시간축에서 표현하는 방식 참고 | 실패를 0ms로 오해하게 하는 현재 X 표시를 대체할 수 있음 |
| uPlot / ECharts | 현재 단계에서는 대안으로 남김 | 대량 시계열·차트 간 커서 동기화·구간 확대 요구와 실제 측정 결과에 따라 재평가 |

우리 코드의 [`AgentServiceRequestTrends.tsx`](../web/frontend/src/features/healthcheck/components/AgentServiceRequestTrends.tsx)는 이미 `ResponsiveContainer`, `ComposedChart`, 시간축, `Tooltip`, `ReferenceLine`을 함께 사용한다. 새 엔진을 추가하기 전에 이 공통 경로에 업타임 차트를 맞추는 것이 비용과 화면 일관성 측면에서 적합하다는 판단이다.

첫 화면안은 다음을 제안한다.

- **헤더:** 응답시간 제목, 현재 집계 단위, 기간 선택. API가 지원하는 `1H / 6H / 24H`를 사용하고 `최근`처럼 길이가 변하는 이름은 명확한 기간으로 정리한다. 초기 범위는 6H를 제안한다.
- **요약:** 선택 기간 평균 응답시간 하나를 중심으로 표시하고 `체크 72회 중 실패 2회` 같은 보조 정보를 붙인다. 동일한 무게의 성공·실패·평균·최대 네 항목은 다시 구성한다.
- **플롯:** 응답시간 선, 절제한 수평 눈금, 실제 시간 간격. 확인된 장애 지속 구간은 옅은 배경으로 표시하고 단발 실패는 해당 시각의 주석으로 구분한다. 수집 공백은 선을 끊되 장애로 단정하지 않는다.
- **선택 시각:** 수직 커서와 선택점을 함께 표시한다. 원시 체크는 정확한 시각·응답시간·상태·오류 사유를, 버킷은 시작/끝 시간·평균·총 체크 수·실패 수를 표시한다. 버킷에 없는 HTTP 상태나 p95를 만들어 표시하지 않는다.
- **축 범위:** 급등값을 자르지 않고 평탄한 값의 작은 변화를 과장하지 않도록 최소 표시 폭을 둔다. 날짜가 바뀌는 범위와 시간대를 읽을 수 있게 한다.

범용 차트 엔진을 새로 만드는 범위까지 넓히지 않는다. 우선 업타임 카드와 공유 중인 Docker 업타임 탭에서 적용하고, 실제로 반복되는 부분만 기존 공통 차트에 반영한다. 30초 자동 갱신·갱신 실패 시 기존 차트 유지·기간 변경·라이트/다크·좁은 화면·전부 실패·단일 점·수집 공백에서 화면과 탐색 동작을 확인한다.

## 다음 세션을 위한 현재 상태

### 사용자의 요청과 피드백

- 업타임 목록의 빠른 확인 버튼·패널을 없애고 필요한 정보를 행·카드에 넣는 방향으로 변경했다.
- 목록의 최근 체크는 10개다. 그리드 평균 응답시간은 숫자로 표시하며 옆의 작은 선 그래프는 제거했다. 프로토콜·수집 간격은 별도 컬럼이다.
- 상세페이지의 응답시간을 막대에서 선으로 바꾸고, 상단의 개별 결과 가로행을 대체하도록 요청했다.
- 현재 상세 선 그래프는 사용자가 시각적 완성도 부족으로 거절했다. 테스트 통과를 디자인 승인으로 취급하지 않는다. 상단 요약을 포함해 카드 구성을 다시 검토할 수 있다.
- 이번 요청은 다음 세션에서 활용할 GitHub 레퍼런스 조사다.

### 먼저 열 파일

| 파일 | 확인할 내용 |
| --- | --- |
| [`ResponseTimeCard.tsx`](../web/frontend/src/features/uptime/components/ResponseTimeCard.tsx) | `Curve` + 수동 SVG 좌표·HTML 축·hover 영역·0축의 실패 X 표시. 현재 재설계 대상 |
| [`BucketedResponseTimeChart.tsx`](../web/frontend/src/features/uptime/components/BucketedResponseTimeChart.tsx) | 버킷 평균과 성공률을 슬롯으로 변환. 모니터 상세와 Docker 서비스 업타임 탭에서 공유 |
| [`UptimeMonitorDetailPage.tsx`](../web/frontend/src/pages/uptime/UptimeMonitorDetailPage.tsx) | 최근 원시 체크 / 6H / 24H 범위와 화면 구성 |
| [`chartTheme.ts`](../web/frontend/src/components/charts/chartTheme.ts) · [`ChartElements.tsx`](../web/frontend/src/components/charts/ChartElements.tsx) | 기존 공통 테마·축·툴팁·카드 구성 재사용 가능성 |
| [`mockRouter.ts`](../web/frontend/src/services/mockRouter.ts) | 데모 시계열과 집계 데이터 |
| [`uptime-response.spec.ts`](../web/frontend/e2e/uptime-response.spec.ts) | 결측·실패·범위·반응형 관련 기존 검증. 새 디자인에 맞게 검토 |
| [`DESIGN.md`](../web/frontend/DESIGN.md) | 공통 규칙. 이번 작업에서 추가한 현재 업타임 차트 설명은 사용자의 최신 재설계 피드백과 함께 해석 |

### 데이터에서도 해결할 문제

1. **데모 간격이 설정과 다르다.** `mockRouter.ts:693–695`의 Storefront는 30초 수집이지만, `:719–728`의 72개 원시 체크는 30분 간격이고 `Math.sin(index / 5)`로 값을 만든다. 따라서 화면의 약 36시간짜리 매끈한 물결은 렌더러뿐 아니라 데모 데이터에도 원인이 있다. 실제 수집 간격에 맞춘 변동·spike·장애·누락 사례로 비교해야 한다.
2. **버킷 평균으로 원시 최대값을 알 수 없다.** 현재 `ResponseTimeCard`의 최대 통계는 전달된 latency 중 최댓값이다. 버킷 모드에서는 최대 버킷 평균이며 원시 측정의 최대 응답시간과 다르다. p95·최소·최대가 필요하면 API 제공 여부와 집계 방식을 먼저 확인한다.
3. **실패와 수집 공백의 의미를 구분한다.** timeout·연결 실패·미수집을 정상적인 `0ms`로 그리지 않는다. 완료된 HTTP 오류 응답의 소요시간을 표시할지는 원시 메트릭의 의미와 함께 정한다. 장애 구간 길이도 실패 샘플 하나에서 임의로 확장하지 않는다.
4. **범위와 집계를 툴팁에 반영한다.** 원시 체크와 5분·20분 버킷의 시간·응답시간·실패 수는 의미가 다르다. 기간을 바꾸어도 같은 값처럼 읽히지 않게 한다.

### 새 세션 시작용 문장

```text
plans/uptime-chart-references.md를 읽고 업타임 상세 응답시간 차트를 재설계해줘.
현재 ResponseTimeCard의 수동 Curve/SVG 그래프는 사용자가 거절한 상태야.
Beszel의 응답시간 구현과 Grafana의 차트 탐색 방식을 우선 참고하고,
기존 Recharts의 정식 차트 구성으로 해결할 수 있는지부터 판단해줘.
모양뿐 아니라 시간축·툴팁·장애/수집 공백·집계 의미와 데모 데이터도 함께 개선해줘.
목록의 최근 체크 10개와 평균 응답시간 숫자 표시는 유지하고,
상세 차트는 실제 화면에서 라이트/다크·좁은 화면·실패/누락 데이터를 확인해줘.
기존 작업 변경사항이 있으니 먼저 diff를 확인하고 이어서 진행해줘.
```
