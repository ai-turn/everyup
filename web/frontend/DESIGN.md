---
version: alpha
name: EveryUp
description: 개발자용 모니터링 대시보드. 흰 표면 한 톤에 무채색 액션, 유채색은 상태와 데이터에만 싣는다.
colors:
  primary: "#1c2024"
  primary-hover: "#363a3f"
  on-primary: "#ffffff"
  action: "#1c2024"
  bg-main: "#ffffff"
  bg-surface: "#ffffff"
  ui-border: "#d9d9e0"
  ui-control-border: "#80838d"
  ui-border-soft: "#e8e8ec"
  ui-hover: "#f0f0f3"
  ui-hover-soft: "#f9f9fb"
  ui-table-header: "#f0f0f3"
  ui-active: "#e8e8ec"
  ui-raised: "#ffffff"
  text-base: "#1c2024"
  text-secondary: "#363a3f"
  text-muted: "#60646c"
  text-dim: "#6b6f78"
  status-healthy: "#127058"
  status-warn: "#925500"
  status-error: "#c4282d"
  status-idle: "#60646c"
  status-healthy-fill: "#059669"
  status-warn-fill: "#c77700"
  status-error-fill: "#dc2626"
  status-idle-fill: "#80838d"
  danger: "#dc2626"
  danger-hover: "#b91c1c"
  chart-border: "#e0e1e6"
  primary-dark: "#edeef0"
  primary-hover-dark: "#c8cbd0"
  on-primary-dark: "#111113"
  action-dark: "#edeef0"
  bg-main-dark: "#111113"
  bg-surface-dark: "#18191b"
  ui-border-dark: "#363a3f"
  ui-control-border-dark: "#6b6f78"
  ui-border-soft-dark: "#363a3f"
  ui-hover-dark: "#212225"
  ui-hover-soft-dark: "#212225"
  ui-table-header-dark: "#111113"
  ui-active-dark: "#2e3135"
  ui-raised-dark: "#2e3135"
  text-base-dark: "#edeef0"
  text-secondary-dark: "#c8cbd0"
  text-muted-dark: "#b0b4ba"
  text-dim-dark: "#8b8f97"
  status-healthy-dark: "#3dd6c6"
  status-warn-dark: "#ffca16"
  status-error-dark: "#ff6369"
  status-idle-dark: "#b0b4ba"
  status-healthy-fill-dark: "#3dd6c6"
  status-warn-fill-dark: "#ffca16"
  status-error-fill-dark: "#ff6369"
  status-idle-fill-dark: "#80838d"
  chart-border-dark: "#2e3135"
  series-emerald: "#059669"
  series-amber: "#d97706"
  series-violet: "#7c3aed"
  series-red: "#dc2626"
  series-teal: "#0d9488"
  level-info: "#0284c7"
  level-debug: "#7c3aed"
  level-trace: "#64748b"
typography:
  page-title:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
  section-title:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 20px
    fontWeight: 500
    lineHeight: 28px
  card-title:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 24px
  body:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 21px
  label:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
  label-sm:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
  caption:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  kpi:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 32px
  stat:
    fontFamily: "Spoqa Han Sans Neo"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 28px
  code:
    fontFamily: "JetBrains Mono Variable"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  line: 2px
  dense: 4px
  pair: 6px
  group: 8px
  block: 12px
  card-gap: 16px
  section: 20px
  card-padding: 16px
  card-padding-roomy: 24px
  panel-padding: 20px
  modal-padding: 24px
---

# EveryUp 프론트엔드 디자인 시스템

React 19 · Tailwind v4 · Recharts 3. 이 문서가 **디자인 규약의 SSOT**다.
값의 실제 정의는 [`src/index.css`](src/index.css)(토큰)와 각 컴포넌트 파일에 있고, 이 문서는 **무엇을 언제 쓰는가**를 정한다.

맨 위 frontmatter는 토큰의 **기계 판독용 사본**이다([DESIGN.md 형식](https://github.com/google-labs-code/design.md)). 값을 바꿀 때 `index.css`와 함께 고친다 — 둘이 어긋나도 자동으로 잡히지 않는다. impeccable `detect`(`web/frontend`에서 실행해야 이 파일을 찾는다)가 이 값을 허용 목록으로 읽는데, **잡는 범위가 좁다** — `text-[Npx]` 임의 크기, CSS 선언·`style={{}}`의 색·radius·폰트만 본다. `bg-[#hex]`·`rounded-[10px]` 같은 Tailwind 임의값과 `slate-*` primitive·`dark:` 이중 작성(§10.A)은 보지 않는다 — 그쪽은 `pnpm lint`가 센다(§10).

관련 문서: [`../../CLAUDE.md`](../../CLAUDE.md)(엔지니어링 규약 — 디자인 내용은 없다) · [`src/components/charts/chartTheme.ts`](src/components/charts/chartTheme.ts)(차트 스펙 코드)

---

## 0. 개요

개발자가 쓰는 모니터링 대시보드다. 화면이 답할 첫 질문은 **"지금 이상이 있는가"**이고, 나머지 설계는 그 답을 빨리 찾게 하는 쪽으로 정했다. 아래 원칙은 새 규칙이 아니라 이 문서 전체에 흩어진 결정의 요약이다.

- **컨테이너는 중립, 색은 데이터와 액션에만** (§5.3). 장애를 눈에 띄게 하려면 색을 더 쓰지 않고 덜 쓴다 — 전부 같은 형태에 점 색만 다르면 붉은 하나가 튄다(§5.1). AI 생성 디자인처럼 보인다는 피드백을 받은 장식(좌측 컬러 보더, 파스텔 틴트 박스, 3중 배지)은 §9에 금지로 남겼다.
- **데이터를 정직하게 그린다** (§4.2). 수집 공백은 공백으로, 0건은 "이상 없음"이 아니라 "모름"으로, 타임아웃은 응답 시간이 아닌 것으로 보여 준다.
- **접근성은 계산이 아니라 실측이다.** 대비는 토큰 하나가 아니라 실제 배경과의 조합으로 재고(§1.3), 상태색은 색각이상 시뮬레이션까지 확인했다(§1.4).
- **한 역할에 컴포넌트 하나.** 버튼은 `Button`, 상태는 `StatusLight`, 차트 틀은 `ChartCard`가 유일한 진입점이다. 같은 일을 화면마다 손으로 만들면 반드시 어긋났다(§10 해결 이력).
- **조밀하되 누르기 쉽게.** 운영 화면이라 정보 밀도를 우선하지만, 터치 화면에서는 컨트롤 높이 44px를 지킨다(§4.1).
- **용어는 개발자의 말로** (§9.15). 업계가 영어로 부르는 말은 영어 그대로 쓴다.

참고한 제품: Grafana(차트), Datadog Synthetics(업타임), Sentry Issues·Grafana Logs Drilldown(로그), Adobe Spectrum(상태 표현), Carbon·Primer·Polaris(버튼·폼).

---

## 1. 색

### 1.1 토큰 규약 — `dark:` 이중 작성 금지

시맨틱 토큰은 **라이트 값**을 담고, `index.css`의 `.dark` 블록에서 대응 `-dark` 값으로 **자가 재할당**된다.
따라서 컴포넌트는 클래스 하나로 양쪽 테마를 커버한다.

```tsx
// ✅
<p className="text-text-muted">

// ❌ 토큰이 이미 전환된다 — dark: 짝은 중복이자 유지보수 부채
<p className="text-slate-500 dark:text-text-muted-dark">
```

`*-dark` 접미 토큰(`--color-text-muted-dark` 등)은 **`.dark` 블록 재할당 전용**이다. 컴포넌트에서 직접 쓰지 않는다.

### 1.2 표면 · 경계

팔레트 출처는 [Radix Colors](https://www.radix-ui.com/colors)의 slate(중립)와 indigo(브랜드)다(2026-10-25 교체, 이전은 Tailwind slate + 자체 파랑). 아래 괄호 안 숫자는 Radix 12단계 스케일의 단계다 — 1–2 배경, 3–5 컴포넌트 채움, 6–8 보더, 9–10 채움색, 11–12 텍스트.

| 역할 | 클래스 | light | dark |
|------|--------|-------|------|
| 페이지 배경 | `bg-bg-main` | `#ffffff` | `#111113` (1) |
| 카드 표면 | `bg-bg-surface` | `#ffffff` | `#18191b` (2) |
| 헤어라인 | `border-ui-border` | `#d9d9e0` (6) | `#363a3f` (6) |
| 입력 컨트롤 경계 | `border-ui-control-border` | `#80838d` (10) | `#6b6f78` |
| 내부 구분선 | `border-ui-border-soft` | `#e8e8ec` (4) | `#363a3f` |
| hover 채움 | `bg-ui-hover` | `#f0f0f3` (3) | `#212225` (3) |
| 옅은 내부 채움 | `bg-ui-hover-soft` | `#f9f9fb` (2) | `#212225` |
| 표 헤더 | `bg-ui-table-header` | `#f0f0f3` | `#111113` |
| 눌린 표면 | `bg-ui-active` | `#e8e8ec` (4) | `#2e3135` (5) |
| **떠오른 표면** | `bg-ui-raised` | `#ffffff` | `#2e3135` (5) |

`ui-active`와 `ui-raised`는 **다크값이 같지만 역할이 반대다.** `ui-active`(라이트 `#e8e8ec`)는 스켈레톤·칩·hover처럼 트랙보다 **눌려** 보여야 하는 자리, `ui-raised`(라이트 흰색)는 세그먼티드 컨트롤의 선택된 칸처럼 `ui-hover` 트랙 **위로 솟아** 보여야 하는 자리다. 라이트에서 흰색이어야 하므로 `bg-bg-surface`로 대체할 수 없다 — 다크값(`#18191b`)이 트랙(`#212225`)보다 어두워 방향이 뒤집힌다.

**라이트의 페이지 배경은 카드와 같은 흰색이다**(2026-11-15, Linear Docs 레퍼런스). 회색 페이지 위에 흰 카드를 띄우는 구성이 위젯을 모아 놓은 화면처럼 보여서, 라이트는 한 톤으로 두고 구분은 간격·헤어라인·hover 채움으로 한다. 다크는 main/surface 2단을 유지한다.

다크에서 `soft` 계열은 상위 토큰과 동일하다 — **다크 모드의 명도 계층은 2단(main/surface)뿐**이고, 이는 의도된 설계다.

입력·검색·선택 컨트롤은 장식용 구분선보다 뚜렷한 `ui-control-border`를 쓴다. 기본 표면에서 경계 대비 3:1 이상을 유지하고, 카드·표의 구분선은 기존 `ui-border`를 쓴다.

**라이트의 `#ffffff` 표면은 유지한다**(2026-10-27, [ADR 0009](../../docs/adr/0009-hallmark-label-and-punctuation-rules.md)). Hallmark 7b(순백 표면)는 modern-minimal 장르에 `#fff`를 허용하고, §1.3의 대비 수치가 전부 이 값 기준이다. sloplint를 `--genre modern-minimal` 없이 돌리면 REFLEX로 다시 나온다.

### 1.3 텍스트 4단 위계

| 역할 | 클래스 | light | 대비 | dark |
|------|--------|-------|------|------|
| 제목·강조 | `text-text-base` | `#1c2024` (12) | 16.39 | `#edeef0` (12) |
| 본문 | `text-text-secondary` | `#363a3f` | 11.45 | `#c8cbd0` |
| 보조 | `text-text-muted` | `#60646c` (11) | 5.94 | `#b0b4ba` (11) |
| 메타·placeholder | `text-text-dim` | `#6b6f78` | 5.04 | `#8b8f97` |

한 화면에서 4단을 전부 쓰지 않는다. 카드 하나에는 보통 **base + muted 2단**이면 충분하다.

대비 열은 **라이트의 흰 카드 배경 기준**이다. 다크 `dim`은 페이지 5.81:1, 카드 5.42:1, hover 4.90:1이다. Radix의 dim 후보인 10단계(`#80838d`)는 흰 카드에서 3.8:1로 AA에 미달해 11단계 쪽으로 당긴 값을 쓴다. `secondary`도 Radix에 없는 단계라 11과 12 사이에 둔 값이다. 대비는 토큰 하나가 아니라 실제 배경과의 조합으로 확인한다. 더 옅은 등급을 추가하지 말 것.

**`dim`이 허용되는 배경은 `bg-main`·`bg-surface`·`ui-hover-soft`까지다.** 그보다 진한 채움 위에서는 AA에 미달한다 — 라이트 기준 `ui-hover` 4.43, `ui-active` 4.12. `ui-hover` 이상의 채움 위에는 `muted`(같은 자리에서 5.22)나 `secondary`를 쓴다. 다크 `ui-active`/`ui-raised`(`#2e3135`)에서는 `dim`이 4.03으로 미달이고, `muted`(6.28)와 `secondary`(8.03)는 통과한다.

**읽는 산문에 `dim`을 쓰지 않는다.** `dim`은 표에 적힌 대로 **메타·placeholder 전용**이다 — `최근 3건`, 타임스탬프, 차트 축 라벨, endpoint 값처럼 훑는 자리. 문장으로 읽어야 하는 설명문·경고문은 `muted`(5.94)다. 산문은 훑는 값보다 오래 눈이 머물기 때문에 하한선에 가까운 `dim`에 두면 흐리게 읽힌다.

### 1.4 브랜드 · 상태

**브랜드 색은 무채색이다** (2026-11-15). 이전의 indigo(`#3e63dd`)를 뺐고, 화면에서 유채색은 상태색(§1.4 아래 표)만 남는다. 레퍼런스는 Linear Docs다: 주 버튼은 검정, 링크·선택 상태는 글자색과 hover 채움으로 구분한다.

| 역할 | 클래스 | light | dark | 근거 |
|---|---|---|---|---|
| 주 액션 채움 | `bg-primary` | `#1c2024` (slate-12) | `#edeef0` | 글자 최고 단계를 채움으로 쓴다 |
| 채움 hover | `bg-primary-hover` | `#363a3f` | `#c8cbd0` | 한 단계 옅어진다. 채움 위 글자 대비는 라이트 11.45로 AA를 넘는다 |
| 채움 위 글자 | `text-on-primary` | `#ffffff` | `#111113` | 다크의 채움이 밝아서 `text-white`를 쓰면 글자가 사라진다. **`bg-primary` 위에 `text-white`를 쓰지 않는다** |
| 채움 없는 액션 | `text-action` | `#1c2024` | `#edeef0` | 제목 글자와 같은 값. 텍스트 링크는 색이 아니라 밑줄(`link-underline`: 쉴 때 dim, hover·포커스에서 글자색)로 드러낸다. **글자에 화살표(→, ›)를 붙이지 않는다**(hallmark gate 63) |

`bg-primary/10` 같은 옅은 틴트(사이드바 현재 위치, 선택된 옵션)는 그대로 쓴다. 무채색이 되면서 회색 선택 배경이 된다.

**차트 첫 시리즈는 UI primary와 분리했다.** `chartTheme.ts`의 `primaryColor`는 CSS 변수를 읽지 않고 indigo `#3e63dd` 상수를 쓴다. 검정 선은 축·격자·글자와 구분되지 않기 때문이다.

Toggle의 켜진 손잡이도 `bg-on-primary`다. 다크에서 켜진 트랙이 밝아지므로 흰 손잡이가 묻힌다.

**상태색도 시맨틱 토큰이다.** `emerald-600 dark:emerald-400` 같은 primitive 직접 사용 금지 — 토큰이 `.dark`에서 자가 전환하므로 `dark:` 짝이 필요 없다.

| 상태 | 클래스 | light | dark |
|------|--------|-------|------|
| healthy · online | `text-status-healthy` | `#127058` | `#3dd6c6` teal |
| warning | `text-status-warn` | `#925500` | `#ffca16` amber-11 |
| error · critical · degraded | `text-status-error` | `#c4282d` | `#ff6369` |
| offline · paused · unknown | `text-status-idle` | `#60646c` slate-11 | `#b0b4ba` slate-11 |

상태색은 Radix 스케일을 그대로 쓰지 않았다. 두 가지 이유가 있으니 근거를 남긴다.

- **라이트가 Radix 11단계보다 한 칸 진하다.** 11단계 그대로(`#218358`·`#ab6400`·`#ce2c31`)면 배지가 자기 `/10` 틴트 위에서 healthy 4.16 / warn 4.08 / error 4.47로 AA(4.5) 미달이었다. 지금 값은 `ui-hover-soft` 위 틴트에서도 4.63 이상이다. 11px bold는 WCAG large text(18.66px bold)가 아니라 4.5:1이 적용된다. 이전 Tailwind 팔레트에서 700~800단계를 쓴 것과 같은 이유다.
- **다크 healthy는 green이 아니라 teal이고, error는 Radix red-11보다 붉다.** Radix 다크 green-11(`#3dd68c`)과 red-11(`#ff9592`)은 적록색각이상(Machado 2009 deuteranopia) 시뮬레이션에서 ΔE 2.3으로 **사실상 같은 색**이 됐다. 모니터링 도구에서 정상/장애를 구분 못 하는 건 기능 실패라 healthy를 teal로, error를 채도가 높은 `#ff6369`로 옮겨 42.8까지 벌렸다(라이트는 39.8). 같은 방식으로 잰 이전 팔레트는 다크 38.2 / 라이트 39.5였고, 그 전의 emerald-400 / red-400 조합은 18.5였다.

**글자와 채움은 다른 토큰이다** (2026-11-13, [ADR 0010](../../docs/adr/0010-status-color-roles-and-floating-surfaces.md)). 위 표의 `status-*`는 **글자 역할**이다. 상태 점·게이지·막대·체크 띠·임계선·입력 검증 보더처럼 글자가 아닌 표시는 `status-*-fill`을 쓴다.

| 역할 | 클래스 | 기준 | light | dark |
|---|---|---|---|---|
| 글자·아이콘 | `text-status-{tone}` | 4.5:1 | 위 표 | 위 표 |
| 채움·선 | `bg-status-{tone}-fill` · `border-status-{tone}-fill` · 차트 `theme.errorColor`/`warnColor` | 3:1 (WCAG 1.4.11) | healthy `#059669` · warn `#c77700` · error `#dc2626` · idle `#80838d` | 글자와 같은 값 · idle `#80838d` |
| 옅은 틴트 | `bg-status-{tone}/10` | 틴트 위 글자 4.5:1 | 글자 토큰에 알파 | 같음 |
| 파괴 확정 채움 | `bg-danger` · `hover:bg-danger-hover` | 흰 글자 4.5:1 | `#dc2626` / `#b91c1c` | 같은 값 |

하나의 토큰이 두 역할을 맡던 때 생긴 문제가 셋이다. 라이트 warn `#925500`은 글자 대비를 맞추려 진하게 잡은 값이라 점·게이지에서 갈색으로 보였다. 다크 error `#ff6369`는 밝아서 흰 글자를 올릴 수 없어 `danger` 버튼만 primitive `bg-red-600`을 썼다. 그리고 에러 하나가 status `#c4282d`, 로그 레벨 `red-600`/`red-700`, danger `red-600`으로 네 가지 빨강이 됐다. 채움은 3:1만 넘으면 되므로 더 밝게 둘 수 있다. 채움 값은 흰 카드·`bg-main`·`ui-hover` 위에서 3:1 이상이다(warn은 `ui-hover`에서 3.04로 가장 낮다).

채움 값은 색각이상 거리도 다시 쟀다(위 근거와 같은 Machado 2009 deuteranopia ΔE). **이전 팔레트는 정상과 회색(idle)이 붙어 있었다**: 라이트 8.9, 다크 4.5다. idle 채움을 slate-11에서 slate-10(`#80838d`)으로 옮겨 17.1 / 21.0까지 벌렸다. healthy↔error는 41.2 / 42.8, warn↔error는 13.3 / 49.2다. 라이트 healthy를 teal(`#0d9488`)로 두면 error와의 거리는 58.4로 더 벌어지지만 idle과의 거리가 1.5로 무너져 emerald를 골랐다.

글자 역할을 단색 채움에 쓰는 것(`bg-status-error` 단독)은 `pnpm lint`가 막는다. 고대비 모드 규칙(§8)도 `-fill`이라는 이름에 기대므로 이름을 지켜야 한다.

`info` 역할은 아직 토큰으로 만들지 않았다. Tailwind v4는 미사용 `@theme` 변수를 트리셰이킹하므로 소비처 없는 토큰은 죽은 토큰이 된다. 2026-11-13 기준 소비처는 둘이다. 로그 레벨 info(§1.5)와 알림 severity info(`SEVERITY_TONE`, §1.5 아래)가 같은 sky 쌍(`text-sky-700 dark:text-sky-400`, 채움 `sky-600`)을 쓴다. 두 곳이 한 쌍을 공유하는 동안은 primitive로 두고, 세 번째 소비처가 생기거나 값이 갈라질 때 `status-info`(글자·`-fill`)를 만든다.

### 1.5 로그 레벨 — 상태색과 별개 축

[`logLevelStyle.ts`](src/features/healthcheck/logLevelStyle.ts)의 `LEVEL_BASE`·`LEVEL_TEXT`(로그 행) / `LEVEL_CHIP`(필터 칩 선택 상태) / `LEVEL_FILL`(로그 카드 추이 막대), `AgentServiceLogsTab`의 `LEVEL_BAR`(히스토그램)가 SSOT.

| 레벨 | 색 | 바 | 행 토큰 |
|------|-----|--------|------------------|
| error | 상태색 | `status-error-fill` | `text-status-error` |
| warn | 상태색 | `status-warn-fill` | `text-status-warn` |
| info | **sky** | `#0284c7` | `text-sky-700` |
| debug | violet | `#7c3aed` | `text-violet-700` |
| trace | slate | `#64748b` | `text-text-muted` |

info가 sky인 이유: 이전 primary였던 indigo(#3e63dd, 지금은 차트 첫 시리즈)와 붙어 있으면 "선택된 항목"으로 오독됐다.

**알림 severity도 같은 규칙을 따른다** (2026-11-13). severity(critical·warning·info)는 규칙을 만든 사람이 정한 중요도라 상태와 별개 축이지만, 발송 이력 한 행에 `실패`(상태)와 `심각`(severity)이 나란히 서서 빨강이 둘이면 뜻이 둘로 읽힌다. critical·warning은 상태 글자 토큰·`/10` 틴트·`-fill` 점을, info는 위 표의 sky를 쓴다. SSOT는 `features/alerts/utils/severityLabel.ts`의 `SEVERITY_TONE`이고 `SeverityBadge`·규칙 폼·모바일 카드가 모두 이것을 쓴다.

**error·warn은 상태색을 쓴다** (2026-11-13). 레벨은 상태와 별개 축이지만 `error`·`warn`의 뜻은 상태의 장애·주의와 같다. 같은 화면에서 로그 행의 error와 서비스 상태의 장애가 서로 다른 빨강이면 뜻이 둘로 읽힌다. 행 글자·필터 칩은 `status-*`, 막대는 `status-*-fill`(§1.4)이다. 상태에 없는 info·debug·trace만 이 절의 고유 색을 쓴다.

**로그 행의 레벨은 채움 없는 mono 텍스트다** (`LEVEL_BASE` = `inline-block shrink-0 w-12 font-mono text-xs font-medium`). 레벨은 서버가 보내는 값 그대로 소문자(`error`·`warn`)로 쓴다 — 2026-10-27까지는 `uppercase`로 `ERROR`를 만들었다(§2.5). 2026-09-20까지는 `bg-red-100` 계열 불투명 파스텔 틴트를 깐 배지였는데, 사용자 피드백은 *"색상이 너무 AI스럽다"*였다. 두 가지가 겹쳐 있었다:

1. **`-100` 틴트는 부트스트랩 alert 팔레트 그대로다.** §9.3이 다른 자리에서는 이미 금지하던 패턴인데 배지만 예외였고, 로그 표는 행마다 색 블록이 찍혀 그 예외가 가장 크게 드러나는 자리였다.
2. **기계 토큰에 가변폭 sans를 썼다.** 같은 표의 메시지 컬럼이 `font-mono`인데 레벨만 Spoqa였다(시간 컬럼은 2026-09-23부터 Spoqa — §2.1). `ERROR`/`WARN`/`INFO`는 글자폭이 제각각이라 컬럼이 들쭉날쭉했고, **틴트가 그 들쭉날쭉함을 덮는 역할도 하고 있었다.** mono 고정폭 + `w-12`로 컬럼 모양을 잡으면 채움이 필요 없어진다.

틴트를 빼서 대비가 같이 올랐다. 실측 라이트 error 5.69 / warn 5.96 / info 5.86(행 hover 위에서도 4.81 이상), 다크 error 5.48 / warn 10.39 / info 7.94(행 hover 기준)다. error·warn은 2026-11-13부터 상태 글자 토큰 값이다.

**필터 칩의 선택 상태(`LEVEL_CHIP`)는 틴트를 유지한다.** 거기 채움은 장식이 아니라 토글이 켜졌음을 말한다 — 읽기 전용 토큰과 달리 선택/비선택을 구분할 수단이 필요하다. 같은 색을 쓰지만 역할이 다르므로 상수를 나눠 뒀다.

info·debug·trace 바 색이 600단계인 이유: 500단계는 흰 배경에서 warn 2.15 / info 2.77 / trace 2.56으로 WCAG 1.4.11(3:1) 미달이었다. 배지 텍스트가 700단계인 이유: 600은 자기 `-100` 배경 위에서 red 3.95 / sky 3.57로 AA 미달이었다.

### 1.6 차트 시리즈 팔레트

`chartTheme.ts`의 `SERIES_HEX` + `getSeriesPalette(theme)`. **첫 슬롯은 indigo `#3e63dd` 상수다** — UI primary가 무채색이 된 뒤(§1.4) 차트는 이전 브랜드색을 그대로 쓴다.

```
primary #3e63dd → emerald #059669 → amber #d97706 → violet #7c3aed → red #dc2626 → teal #0d9488
```

2026-10-25 Radix로 팔레트를 바꿀 때 시리즈는 첫 슬롯(primary)만 바꾸고 나머지 다섯 색은 Tailwind 600단계로 유지했다. 이 다섯 색은 라이트·다크 양쪽 3:1과 아래의 색각이상 순서 검증을 이미 거쳤고, `SERIES_HEX`의 키 이름(`emerald`·`amber` …)이 여러 파일에서 쓰인다.

시리즈 색 하드코딩 금지. mock 데이터도 `SERIES_HEX`를 import한다.

**600단계인 이유** — 500단계일 때 라이트 배경에서 emerald 2.54 / teal 2.49 / amber 2.15로 WCAG 1.4.11(3:1)에 미달했다. 팔레트가 Grafana를 참고하면서 다크 배경만 보고 튜닝된 결과였다. 600으로 내려 양쪽 테마 모두 3:1을 넘긴다.

**⚠ 4개를 넘는 시리즈는 색만으로 구분되지 않는다.** 적록색각이상에서 앞 3슬롯(primary/emerald/amber)은 안전하지만 4슬롯째부터는 어떤 순서로 배열해도 충돌한다(primary/violet 16.0, emerald/teal 11.8, amber/red 12.8). 6색이 (a)색각 구분 (b)라이트 3:1 (c)다크 3:1을 동시에 만족하는 조합은 존재하지 않는다 — Okabe-Ito 정통 8색조차 라이트에서 orange 2.25, skyblue 2.31로 떨어진다. 시리즈가 4개를 넘으면 **선 스타일을 병행**한다 — `getSeriesDash(i)`가 4슬롯째부터 `strokeDasharray`를 돌려준다(앞 3슬롯은 `undefined`라 실선 유지). 시리즈 개수가 데이터에 달린 차트에서 쓴다:

```tsx
<Line {...lineProps(colors[i % colors.length])} strokeDasharray={getSeriesDash(i)} />
```

시리즈가 1~3개로 고정된 차트는 넣지 않아도 된다 — 어차피 `undefined`를 받으므로 모습이 같다.

### 1.7 하드코딩이 허용되는 유일한 경우

`ChannelForm`의 텔레그램/디스코드/슬랙 **미리보기 UI**. 서드파티 브랜드 색(`#26A5E4`, `#5865F2`, `#E01E5A`, `#313338` …)을 재현하는 목적이므로 토큰화 대상이 아니다. 같은 이유로 미리보기 안의 이모지·Discord `APP` 태그 같은 서드파티 표기도 §2.5의 예외다. 그 외 hex 리터럴은 전부 부채다.

---

## 2. 타이포그래피

### 2.1 폰트

- **본문** Spoqa Han Sans Neo (self-hosted, `spoqa-han-sans` 패키지) → `--font-sans`. body와 `font-sans` 유틸리티가 같은 토큰을 본다 — 토큰 없이 두면 `font-sans`가 Tailwind 기본 스택으로 떨어져 한글이 Spoqa를 못 만난다
- **정적 폰트다.** 굵기는 100/300/400/500/700 다섯 개뿐이고 가변 축이 없다 — 중간 굵기를 만들 수 없다
- **본문과 숫자는 Spoqa, 코드·로그만 JetBrains Mono다** (2026-09-23). **숫자·시간·개수도 Spoqa다** — Spoqa는 숫자 글리프가 원래 고정폭이다(실측 20px에서 `0000`·`1111`·`8888` 모두 47.69px). KPI·표·차트 범례·타임스탬프에 mono를 쓸 이유가 없다. 자리 이동이 없어야 하는 곳은 의도를 드러내려 `tabular-nums`를 그대로 건다
- **`font-mono`는 기계 문자열에만** — 코드·설정 블록(`<pre>`, YAML·명령어), 로그 메시지 본문·스택 트레이스, API Key·trace ID·span 이름, URL·경로·HTTP method+path, 이미지명·메트릭명, `key=value` 속성 칩, 로그 레벨 토큰(§1.5). 기준은 **"들여쓰기·줄 맞춤이 의미이거나, `l`/`I`/`1`·`O`/`0`을 가려 읽어야 하는가"**다. 폰트는 JetBrains Mono Variable(latin subset, self-hosted)이다 — 로그·트레이스처럼 오래 읽는 화면이 OS와 무관하게 같은 모양이어야 해서 OS 고정폭 대신 웹폰트를 쓴다. 브라우저는 `font-mono` 글자가 화면에 있을 때만 파일을 받으므로 숫자를 뺀 뒤로는 개요·목록에서 내려받지 않는다. `<kbd>`·`<code>`·`<pre>`는 브라우저 기본값이 mono라는 점에 주의 — 단축키 표시(`Ctrl K`)는 UI 라벨이므로 `font-sans`를 건다(사이드바 `<kbd>` 하나 때문에 모든 페이지가 이 폰트를 받고 있었다). 한글 글리프가 없어 폴백 2순위가 Spoqa다 — 한글이 섞인 줄은 폭이 정확히 맞지 않는다(한글 줄 맞춤이 필요해지면 D2Coding 서브셋을 검토)
- **mono는 값에만 건다 — 라벨·분류명·제품명은 본문 폰트다.** `Docker 환경`·`Collector`·`OpenTelemetry Collector`·`Bot Token`·`Telegram`처럼 우리가 UI에 써 넣은 말은 mono가 아니다. 컨테이너(`<table>`, 메타 줄)에 `font-mono`를 걸면 라벨까지 같이 딸려오니, 해당 값 셀에 직접 건다. 값 하나를 여러 성격이 공유하는 prop(`detail={{label, value}}`)은 특히 주의 — 한쪽이 코드면 다른 쪽은 아닐 확률이 높다

### 2.2 역할별 타이포그래피

크기·행간·굵기는 `index.css`의 역할 유틸리티를 쓴다. 색·여백·정렬은 호출부가 정한다.

| 역할 | 클래스 | 크기 / 행간 | 굵기 |
|---|---|---|---|
| 페이지 제목 | `type-page-title` | 24 / 32px | 700 |
| 카드 밖 섹션 제목 | `type-section-title` | 20 / 28px | 500 |
| 카드·차트·모달 제목 | `type-card-title` | 16 / 24px | 500 |
| 본문·설명·도움말 | `type-body` | 14 / 21px | 400 |
| 버튼·폼 라벨·조밀한 항목 제목 | `type-label` | 14 / 20px | 500 |
| 컨트롤·조밀한 행 안의 글(입력·선택 상자의 값, 표 칸, 메뉴·목록 항목) | `type-control` | 14 / 20px | 정하지 않음(400, 컨트롤이 500을 주면 그대로) |
| 표 헤더·배지·작은 버튼·키 표시 | `type-label-sm` | 12 / 16px | 500 |
| 메타·시간·짧은 보조 값 | `type-caption` | 12 / 16px | 400 |
| 쌓이는 12px 줄(두 줄 목록의 둘째 줄, 표 칸의 보조 줄) | `type-caption-stack` | 12 / 18px | 400 |
| KPI 카드·요약 줄의 대표 수치 | `type-kpi` | 24 / 32px | 500, 고정폭 숫자 |
| 목록 카드 안의 작은 통계 | `type-stat` | 18 / 28px | 500, 고정폭 숫자 |

페이지 헤더는 [PageHeader](src/components/common/PageHeader.tsx)를 쓴다. **본문 1단계 섹션은 [Section](src/components/common/Section.tsx) 하나다** (2026-11-20 `SectionHeader`, 2026-11-21 `Section`으로 바뀜 — 제목 → 내용 16px을 머리의 아래 여백이 아니라 섹션이 갖는다): 제목은 언제나 `type-section-title`(20px)이고, 개수·기간 같은 메타는 제목과 같은 기준선(`items-baseline`)에, 보기 전환·버튼은 제목 줄과 세로 가운데에 둔다. 설명은 둘째 줄이라 조작의 위치를 끌어내리지 않는다. 이전에는 h2 29곳이 16px, 10곳이 20px이라 같은 화면 안에서도 섞였고(로그, Docker 환경 상세), 메타가 제목 기준선에서 2~5px, 조작이 제목 중심에서 6~12px 어긋났다. 카드·차트·다이얼로그 제목과 섹션 안의 하위 제목(차트, 이력, API 요청 패널의 `Endpoint`)은 `type-card-title`(16px) 그대로다. 모바일 전용 화면의 h1은 기존 `text-xl font-bold`(20px)을 허용한다. 404 같은 디스플레이 숫자와 로고 워드마크는 별도 크기를 허용한다. 그 밖에 18px 이상 원시 크기(`text-lg`~)는 `pnpm lint`가 센다.

**숫자는 두 역할뿐이다** (2026-11-14). 대표 수치(KPI 카드, 업타임 상태 요약, 요청 추이 타일, 알림 발송 요약, 인프라 게이지, 응답 시간)는 `type-kpi`, 목록 카드 안에 나란히 놓인 작은 통계(API·로그·메트릭·인프라·그룹 카드)는 `type-stat`이다. 둘 다 500이고 고정폭 숫자를 역할이 건다. 이전에는 숫자가 11곳에서 16·18·20·24·30px, 400·500·700의 일곱 조합으로 갈려 있었다(같은 업타임 상세 안에서 24px/500과 30px/700). 400은 24px에서 가늘게 보이고 700은 페이지 제목과 겨룬다. 숫자 색은 상태가 있을 때만 싣는다(§4.1 KPI 설명문과 같은 규칙).

**역할 유틸리티와 같은 모양을 손으로 조합하지 않는다.** `text-sm font-medium`은 `type-label`, `text-xs font-medium`은 `type-label-sm`이다. 역할 위에 굵기를 덧씌우지 않는다(`type-body font-medium` → `type-label`). 둘 다 `pnpm lint`가 막는다. 여러 줄이 될 수 있는 문단(`<p>`)은 `text-sm`(행간 20px)이 아니라 `type-body`(21px)다. 한국어 산문은 행간 1.5에서 읽기 편하다.

크기 토큰은 `text-xs`(12), `text-sm`(14), `text-base`(16), `text-lg`(18), `text-xl`(20), `text-2xl`(24), `text-3xl`(30)이다. `text-[Npx]`로 임의 크기를 추가하지 않는다. 역할 유틸리티 위에 다른 크기·굵기·행간을 중복 지정하지 않는다.

**한국어 줄바꿈은 어절 단위다.** `body`에 `word-break: keep-all` + `overflow-wrap: anywhere`가 걸려 있다(2026-10-11) — 개별 요소에 `break-keep`을 다시 걸지 않는다. 라벨의 대문자·자간은 §2.5를 따른다.

**12px는 배지·시간·차트 눈금·조밀한 데이터용이다.** 설명문·경고문·설정 도움말은 `type-body`를 사용한다. 같은 14px라도 제목은 500, 본문은 400으로 구분할 수 있다. 설명을 작게 줄여 제목과 구분하지 않는다. 로그 테이블·코드 블록은 12px를 유지할 수 있다.

### 2.3 제목과 강조

상위 섹션은 20px·500, 카드 제목은 16px·500, 조밀한 항목명은 14px·500으로 구분한다. 카드 안 제목과 본문은 굵기와 여백을 함께 사용한다. HTML 헤딩 레벨은 문서 구조를 따르고, 시각적 등급은 역할을 따른다.

상태색과 굵기는 함께 사용할 수 있다. 배지는 12px·500으로 읽기 쉽게 만들고, 장애 안내의 제목도 500을 사용할 수 있다. 본문 전체를 굵게 만들거나 모든 값을 강조하지 않는다. 색만으로 상태를 전달하지 않는 규칙은 유지한다.

### 2.4 굵기 — 400 / 500 / 700

| 유틸리티 | 실제 굵기 | 용도 |
|---|---|---|
| `font-normal` | 400 | 본문·메타·일반 데이터 |
| `font-medium` | 500 | 제목·버튼·라벨·배지 |
| `font-bold` | 700 | 페이지 제목·특별히 중요한 짧은 강조 |

유틸리티 이름과 실제 굵기를 다르게 재정의하지 않는다. Spoqa Han Sans Neo에서 로드한 굵기는 400/500/700이다. `font-semibold`(600), `font-extrabold`(800), Light(300)는 사용하지 않는다. 이전의 `font-semibold=500`, `font-medium=400` 매핑은 폐지했다.

### 2.5 대문자와 문장부호 (2026-10-27)

[Hallmark](https://github.com/Nutlope/hallmark)의 sloplint가 "기계가 조판한 티"로 잡는 규칙을 그대로 따른다. 결정과 예외의 근거는 [ADR 0009](../../docs/adr/0009-hallmark-label-and-punctuation-rules.md)에 있다. 이전에는 영문 라벨의 대문자·자간과 ` · ` 메타 줄을 허용하거나 규정했다.

- **대문자로 바꾸거나 자간을 벌리지 않는다.** 라벨·캡션·표 헤더·태그·칩·배지에 `uppercase`와 `tracking-wide` 이상을 쓰지 않는다. 영문도 같다(`API Key`, `Live Demo`). 대문자는 글자 자체가 대문자인 곳에만 남는다: 약어(`CPU`·`HTTP`·`TCP`), HTTP method(`GET`), 이니셜, 브랜드 표기(`Telegram`이지 `TELEGRAM`이 아니다). 로그 레벨·심각도처럼 서버 값을 보여 주는 토큰은 값 그대로 소문자다(`error`, `critical`)
- **한 줄에 띄어 쓴 가운뎃점(` · `)은 하나까지다.** 캡션이나 바이라인의 `A · B`는 된다. 사실이 셋 이상이면 열로 나눈다(`flex flex-wrap gap-x-3` 안의 `<span>`들). 같은 종류의 목록은 `, `로 잇는다(`errors.join(', ')`). `DetailMeta` status에는 `·` span을 넣지 않는다 — 행의 `gap-x-3`이 이미 구분한다. 붙여 쓴 한국어 열거 부호(`오류·경고`, `CPU·메모리·디스크`)는 맞춤법이지 구분자가 아니므로 그대로 쓴다
- **UI 문구에 줄표(`—`·`–`)를 쓰지 않는다.** 절은 콜론·쉼표·마침표·괄호로 잇는다(`진행 중 장애: payment-api`). 범위는 `~`다(`1~20`, `13:00 ~ 13:20`). **값이 없음(모름)은 `-`**다 — 0과 구분하는 뜻은 이전의 `—`와 같다. 코드 주석, mock 로그 메시지, 코드로 보여 주는 셸 예시는 UI 문구가 아니다
- **말줄임표는 `…` 한 글자다.** `로딩 중...`처럼 마침표 셋을 쓰지 않는다
- **푸터에 상투 문구를 두지 않는다.** `© 2026 EveryUp`까지만 쓰고 `All rights reserved`는 뺀다

`uppercase`·`tracking-wide(r|st)`·문자열 안의 `...`는 `pnpm lint`가 센다(§10). 가운뎃점과 줄표는 문맥으로 판단하므로 sloplint와 리뷰가 본다: `node ../../.claude/skills/hallmark/scripts/sloplint.mjs src --scope app --genre modern-minimal`(`web/frontend`에서).

### 2.6 시각 표기 (2026-11-19)

**화면의 시각은 `ko-KR` 24시간제로 고정한다.** 브라우저 로캘을 따르면 한 화면에 `오전 05:21`과 `05:21 AM`, `Nov 17`이 섞였다(서버 화면 점검). 시간대는 브라우저를 따른다. 이전에는 차트 축(§4.2 `formatTimeTick`)에만 적힌 규칙이었다.

표기는 [`utils/incidentFormat.ts`](src/utils/incidentFormat.ts)의 함수로 만든다. 호출부에서 `toLocaleString` 옵션을 다시 조합하지 않는다.

| 함수 | 모양 | 자리 |
|---|---|---|
| `formatClock` | `05:21`, 초까지 `05:21:53` | 갱신 시각(`RefreshStatus`) |
| `formatIncidentTime` | 오늘이면 `05:21`, 그 전이면 `11월 17일` | 목록의 장애·이력 시각. 폭이 일정하다 |
| `formatDateTime` | 오늘이면 `05:21:53`, 그 전이면 `11월 17일 05:21:53` | 마지막 수집처럼 한 번 보이는 시각 |
| `formatFullDateTime` | `2026. 11. 19. 05:21:53` | 툴팁, 감사 기록 |

서버 화면과 그 탭 안에서 그려지는 컴포넌트(로그·트레이스·API 요청 행, `TracePanel`, 요청 추이, 응답 시간 카드), Docker 서비스 상세의 같은 탭, 개요, 그룹, 직접 연결 패널(`DirectConnectionMeta`)이 이 함수를 쓴다. 2026-11-19 최종 수정 전에는 트레이스 목록이 12시간제(`오후 03:21:53`), `TracePanel`이 `en-US`였고 몇 곳이 옵션을 직접 조합했다. 로그 행은 오늘이 아니면 `11월 17일 05:21:53`이다(이전 `11. 17. 05:21:53`).

**`toLocale*`가 남은 곳**(2026-11-19, `git grep -n "toLocale" -- web/frontend/src` 기준). 화면의 시각을 새로 만들 때 이 목록에 더하지 않는다.

| 위치 | 까닭 |
|---|---|
| `components/charts/chartTheme.ts`의 `formatTimeTick`·`formatTimeLabel` | 차트 축과 차트 툴팁 제목. `ko-KR`, `hourCycle: 'h23'`이라 규칙과 같다(§4.2) |
| `utils/incidentFormat.ts` | 공용 함수 자체 |
| `UptimeMonitorPanel`·`UptimeOverview`의 `toLocaleDateString('sv-SE')` | 화면 표기가 아니라 날짜 키(`YYYY-MM-DD`) |
| `ResponseTimeCard`의 `Intl.DateTimeFormat` | 시간대 이름만 얻는다 |
| `ChannelForm`의 메시지 미리보기 3곳 | 외부 서비스(Telegram 등) 화면을 재현한다. `hourCycle`이 없어 12시간제(`오후 03:21`)로 나오며, 이 규칙 밖이다 |
| 숫자의 `toLocaleString()` | 시각이 아니다(천 단위 구분) |

---

## 3. 레이아웃

### 3.1 테두리와 카드 (2026-11-15, Linear 레퍼런스)

**구분은 간격과 hover 채움으로 하고, 선은 섹션 경계에만 남긴다.** 회색 페이지 위에 테두리 카드를 쌓고 카드 안을 가로선으로 나누던 구성이 위젯을 모아 놓은 화면처럼 보였다(개요 점검, 2026-11-15). 라이트 페이지는 흰색 한 톤(§1.2)이므로 섹션은 제목과 간격으로 나눈다.

| 대상 | 규칙 |
|---|---|
| 페이지 섹션 | 카드로 감싸지 않는다. 섹션 제목(`Section`, 20px — §2.2. 하위 그룹 라벨은 `type-label` + `text-text-secondary`, §3.7 세로 위계) + `section-stack`(32px 간격 가운데 `ui-border-soft` 가로선 하나, 2026-11-15 추가). 선은 **섹션 경계에만** 긋는다. 차트 카드처럼 테두리가 있는 요소끼리는 선이 겹치므로 `space-y-8`만 쓴다. 헤더·툴바·배너처럼 섹션이 아닌 머리 요소끼리는 기존 `5` |
| 페이지 머리 | `PageHeader` 아래 `ui-border-soft` 한 줄(본문과의 경계) |
| 목록·표 | 바깥 카드 셸(`rounded-xl border bg-bg-surface`)을 쓰지 않는다. 헤더 행은 배경 없이 아래 `border-ui-border-soft` 한 줄만. 본문 행 사이 구분선(`divide-y`, 행 `border-t/b`)은 쓰지 않는다. 행은 `hover:bg-ui-hover-soft`로 드러낸다 |
| 회색 띠 | 헤더·그룹 제목·카드 머리에 배경 띠(`bg-ui-table-header`, `bg-ui-hover` 헤더)를 깔지 않는다 |
| 탭 줄 | 탭 아래 전폭 가로선을 두지 않는다. 선택 표시(밑줄)는 선택된 탭에만 |
| 정의 목록(`DetailMeta` 등) | 행마다 선을 긋지 않는다. 라벨 열과 행 간격으로 정렬한다 |
| 남기는 카드 | 차트 카드(`chartCardClass`), KPI·요약 타일(`Stat`을 담은 카드), **카드 보기**의 항목 카드, 상태 배너만 카드다. 테두리는 `border-ui-border-soft` |
| 떠 있는 표면 | 다이얼로그·팝오버·메뉴·툴팁은 그대로 `border-ui-border`(§3.5). 본문 위에 떠 있어 경계가 필요하다 |
| 입력 컨트롤 | 그대로 `border-ui-control-border`(§1.2, 3:1) |
| 코드·명령 블록 | 테두리 없이 `bg-ui-hover-soft rounded-md` |

카드 안 서브블록이 필요하면 `bg-ui-hover-soft rounded-md`(테두리 없음)이고, 부모와 같은 `rounded-xl`을 쓰지 않는다(§3.2 동심 규칙). 내부 패딩은 `p-4`(조밀) 또는 `p-6`(여유)다.

### 3.2 radius

| 값 | 용도 |
|----|------|
| `rounded-xl` | 카드, 패널, 모달, 큰 입력 |
| `rounded-lg` | 버튼, 입력, 아이콘 버튼, 드롭다운 |
| `rounded-md` | 조밀한 칩, 인라인 코드 |
| `rounded` | 배지 |
| `rounded-full` | 상태 점, pill, 아바타 |

`rounded-2xl` 이상은 쓰지 않는다.

**중첩은 동심(concentric) 규칙을 따른다 — `안쪽 = 바깥쪽 − 여백`.** 갭에는 패딩과 보더가 모두 들어간다. 안팎이 같은 radius면 두 곡선이 평행하지 않아 안쪽 모서리가 각져 보인다.

```
카드 rounded-xl(12) + p-4(16)  →  서브블록은 12−16 < 0  →  rounded-md(6)
카드 rounded-xl(12) + p-6(24)  →  같은 이유로 rounded-md(6)
```

6px은 `max(0, 바깥−여백)`이 0으로 떨어지는 구간에서 완전한 직각 대신 쓰는 최소 단계다. 실무에서 카드 서브블록은 전부 여기에 해당하므로 **서브블록 = `rounded-md` 하나로 고정**하고 매번 계산하지 않는다.

### 3.3 본문 그리드

`MainLayout` 본문 래퍼: `p-4 sm:px-6 sm:py-6 page-stack max-w-320 mx-auto` — 최대 폭 **1280px** 중앙 정렬. `Header`와 같은 값을 쓴다. 이전의 풀블리드(max-width 없음)는 폐기했다 — 1920px 화면에서 3열 카드 한 장이 500px를 넘어가면서 내용은 그대로인데 화면만 비어 보였다. 카드 간 간격은 래퍼의 `space-y-5`가 담당하므로 개별 카드에 `mb-*`를 붙이지 않는다.

설정 화면은 최대 폭 `max-w-4xl`의 단일 컬럼이다. 카드 안에서는 라벨 아래에 14px 설명을 놓고, 컨트롤은 오른쪽에 배치한다. 모바일에서는 컨트롤을 설명 아래로 내려 읽는 순서를 유지한다. 항목이 하나뿐인 보조 내비게이션은 만들지 않는다.

### 3.4 내비게이션 셸

- `lg` 이상: 좌측 `Sidebar`(로고 → nav → Docker Collector 상태 푸터) + 상단 `AppHeader`(위치 표시). `Header`는 `lg:hidden`으로 모바일 전용
- `lg` 미만: `Header` + `BottomNavMobile`. 하단바 겹침은 `pb-safe-bottom` 유틸리티가 처리
- 뒤로가기 버튼은 **데스크톱에 두지 않는다** — 사이드바가 상시 내비이고, `AppHeader`의 첫 크럼이 목록 링크다(예외는 아래 "목록으로" 버튼 규칙)
- **사이드바 활성 항목은 브레드크럼의 첫 크럼과 같다** — 담김 관계를 따른다. 서버 상세(`/servers/…`)는 어떤 탭을 보고 있든 `서버`가, Docker 서비스 상세(`/services/…`)는 `Docker 환경`이 활성이다. 탭은 위치가 아니다(아래 "탭은 크럼이 아니다")

**사이드바 구성** (2026-11-18, [ADR 0011](../../docs/adr/0011-servers-own-directly-configured-targets.md)) — 기능별 메뉴(업타임, 로그, 인프라, API 요청, 메트릭)를 없애고 서버를 중심에 두었다. 그 기능들은 서버 상세의 탭이다(§4.6).

```
개요
모니터링 대상   서버, Docker 환경, 그룹
관리           알림, 환경 설정
```

그룹 헤더는 `navSections.ts`의 `group` 값(`'모니터링 대상'`, `'관리'`)이고, `group`이 없는 개요는 맨 위 항목이다. 장애 수 배지는 개요 항목에 둔다(Docker 서비스의 장애도 세므로 서버 항목에 두지 않는다). 모바일 하단 내비는 `mobile: 'bottom'`인 `개요, 서버, 알림`에 `더보기`를 더한 네 칸이고, 더보기 화면(`MorePage`)은 `전체 로그`, `Docker 환경`, `그룹`, `환경 설정`이다. `전체 로그`는 `navSections.ts`의 항목이 아니라 `MorePage`가 앞에 붙인다(아래 "전체 로그").

**서버와 Docker 환경의 아이콘은 다르다.** 서버 `dns`, Docker 환경 `deployed_code`, 그룹 `folder_open`. 둘 다 "모니터링 대상"이라 같은 아이콘이면 사이드바, 개요의 범위 줄, 명령 팔레트에서 구분되지 않는다. 세 곳이 같은 아이콘을 쓴다.

#### 브라우저 탭 제목 (2026-11-20)

`MainLayout`이 `현재 위치 · EveryUp`으로 만든다. 현재 위치는 `AppHeader`와 같은 크럼(`useLocationCrumbs`)의 마지막이다(`서버`, `edge-host-01`, `Checkout API`). 장애가 있으면 어느 화면에서든 앞에 `(N) 장애 · `를 붙인다 — N은 사이드바 개요 배지와 같은 값(`useFailureCount`)이다. 이전에는 모든 화면이 `EveryUp | Self-hosted Monitoring Platform`이었고 장애 수는 개요에서만 붙었다(UI/UX 점검 A3). 화면에서 `document.title`을 직접 바꾸지 않는다.

#### `AppHeader` — 현재 위치 (데스크톱 전용, 2026-09-20)

```
서버  ›  web-01  ›  Storefront
Docker 환경  ›  prod-server  ›  payment-worker
그룹  ›  Production  ›  web-01
```

높이 **`h-16`(64px)** — `Sidebar` 로고 블록과 같은 값이라 크롬 상단이 사이드바 경계 너머로 한 줄로 이어진다. 배경은 `bg-bg-surface`, 아래 `border-ui-border` 한 줄. 내용 폭은 본문 래퍼와 같은 `max-w-320 mx-auto px-4 sm:px-6`에 맞춘다.

**첫 크럼(섹션)은 경로에서 자동으로 나온다** — [`navSections.ts`](src/components/layout/navSections.ts)의 prefix 표, 가장 긴 것이 이긴다. 목록 페이지는 아무 코드도 추가하지 않아도 된다.

**`navSections.ts`가 내비게이션의 유일한 출처다** (2026-10-10) — 사이드바, 모바일 하단 내비와 더보기, 명령 팔레트, 첫 크럼이 모두 이 표의 경로·라벨·아이콘을 읽는다. 섹션을 추가·이름 변경할 때 이 파일만 고친다. 항목마다 사이드바 그룹(`group`), 모바일에서 들어가는 곳(`mobile`: 하단 내비 또는 더보기), 더보기 설명, 상세 경로(`aliases` — `/agents`·`/services`는 Docker 환경)를 함께 적는다. 사이드바 활성 항목과 첫 크럼은 같은 `sectionFor()`를 쓰므로 어긋날 수 없다.

**상세 페이지는 그 뒤쪽만 선언한다** — [`useBreadcrumb`](src/contexts/BreadcrumbContext.tsx). 훅은 조건부로 호출할 수 없으므로 데이터 로딩 전에는 배열을 비운다:

```tsx
useBreadcrumb(monitor ? [{ label: monitor.name }] : []);
```

**"목록으로" 버튼을 따로 두지 않는다.** 첫 크럼이 목록 링크라 목적지가 같다. 모바일은 `AppHeader`가 없으므로 기존 `← 목록으로` 버튼을 `lg:hidden`으로 유지한다(서버 상세는 `← 서버 목록`).

**예외: 서버 탭 안의 대상 상세** (2026-11-18). 모니터가 둘 이상인 업타임 탭과 로그 탭에서 대상 상세를 열면 `모니터 목록`, `앱 목록` 복귀 링크(`TabBackLink`)를 데스크톱에도 둔다. 링크는 패널 위의 한 줄이 아니라 탭 줄의 조작 자리(§4.6)에서 추가 버튼 앞에 선다(2026-11-21). 둘째 크럼(서버 이름)은 서버의 개요 탭으로 가고, 탭은 크럼이 아니므로 탭의 목록으로 가는 크럼이 없다. 목적지가 다르다. 링크는 목록에서 넘겨받은 주소로 돌아가므로 검색어, 필터, 보기 방식이 유지된다(`useListReturn`). 탭의 목록 말고 돌아갈 수 있는 목록은 탭마다 `otherLists` 인자로 정한다: 2026-11-19 기준 로그 탭만 전체 로그(`/logs`)를 받고, 전체 로그에서 연 앱의 링크는 `전체 로그`다. 그 밖의 주소에서 왔으면 탭의 첫 화면으로 돌아간다.

**탭은 크럼이 아니다.** Docker 서비스 상세의 `?tab=logs` 같은 하위 뷰는 위치가 아니라 같은 위치의 다른 단면이므로 trail에 넣지 않는다. 서버 상세의 탭은 경로에 있지만(`/servers/web-01/uptime`, §4.6) 같은 이유로 크럼에 넣지 않는다: 크럼은 `서버 › web-01`이고, 대상을 고른 주소(`/servers/web-01/uptime/<id>`)에서만 `서버 › web-01 › Storefront`가 된다.

**서버 화면의 주소는 `serverPath()`로만 만든다** (2026-11-18, [`features/servers/serverPaths.ts`](src/features/servers/serverPaths.ts)). `/servers/:serverId`(개요 탭), `/servers/:serverId/:capability`, `/servers/:serverId/:capability/:targetId`. 컴포넌트마다 문자열을 이어 붙이면 인코딩과 순서가 어긋난다. 옛 메뉴의 주소는 서버 주소로 넘어간다: `/uptime`, `/infrastructure`, `/api`, `/metrics`, `/services`는 `/servers`로, `/uptime/<id>` 같은 대상 주소는 대상을 조회해 서버를 알아낸 뒤 그 탭으로 간다(`LegacyTargetRedirect`, 쿼리 보존). 이미 발송된 알림의 링크가 이 길로 들어온다.

**전체 로그(`/logs`)는 사이드바에 없는 서버 섹션의 화면이다** (2026-11-18). `navSections.ts`에서 서버의 `aliases`이므로 사이드바의 `서버`가 현재 위치이고 크럼은 `서버 › 전체 로그`다. 서버 목록 머리말의 `전체 로그`(갱신 시각 옆, 서버가 없거나 목록을 불러오지 못한 화면에도 있다), 서버 로그 탭의 `모든 서버의 로그`, 개요, 명령 팔레트, 모바일 더보기에서 들어간다. 사이드바에 없는 화면이므로 h1을 숨기지 않는다(아래 규칙의 대상이 아니다).

**그룹에서 연 서버는 그룹 안에 머문다** (2026-11-18). 그룹 상세에서 구성원을 누르면 같은 `/servers/…` 주소라도 사이드바 활성 항목과 첫 크럼이 `그룹`이고 크럼은 `그룹 › Production › web-01`이다(`useGroupTrail`, `useCurrentSection`). 맥락은 sessionStorage에 둔다. 기간이나 탭을 바꾸는 이동이 router state를 버리기 때문이다. 그 대상의 경로를 벗어나면 지우므로, 나중에 서버 목록에서 같은 서버를 열면 서버 맥락이다. 모바일은 `GroupBackLink`가 그 그룹으로 돌아가는 링크다.

**메뉴 첫 화면의 제목은 하나다** (2026-11-21, 소유자 요청 — 2026-11-15 "h1을 데스크톱에서 숨긴다"와 2026-11-20 "개수를 가진 제목은 데스크톱에서도 보인다"를 대체). 대상은 사이드바 항목의 첫 화면(개요, 서버, Docker 환경, 그룹, 알림, 환경 설정)이다.
- **데스크톱(`lg`+)은 `AppHeader`가 제목이다.** 크럼이 하나뿐인 메뉴 첫 화면에서는 그 크럼을 페이지 제목 크기(`type-page-title`, 24px)로 그리고 개수를 붙인다(`서버 9`, 개수는 같은 크기의 `text-muted` 500). 본문 h1은 `lg:sr-only`라 스크린리더의 제목 탐색만 맡는다. 2026-11-15에는 크럼(본문 글자 크기)만 보여 위계가 약했고, 2026-11-20 서버 목록에 개수 제목을 본문에 보였더니 바로 위 크럼 `서버`와 본문 `서버 9`가 같은 말을 두 번 했다. 위치·제목·조작이 `AppHeader` 한 줄이고 본문 위 빈 띠가 없다.
- **모바일은 본문 h1이 제목이다**(`AppHeader`가 없다). h1에 같은 개수를 붙이고, 주 액션은 제목 줄 오른쪽이다. 자리가 없으면 조작 묶음이 다음 줄 오른쪽으로 접힌다(Docker 환경). meta(서버 목록의 갱신 시각·전체 로그)는 제목 아래 줄이다.
- **개수는 한 목록이 화면의 전부인 메뉴만 단다**: 서버, Docker 환경(설치 대기 포함 환경 수), 그룹. 탭이 목록을 나누는 알림은 탭이 개수를 말하므로 제목에 달지 않는다. 개요·환경 설정은 목록이 아니다. 개수를 아직 모르면(`count={null}`) 숫자 자리만 비운다.
- **구현**: `PageHeader menu`가 마운트된 동안 `useRegisterMenuTitle`로 `BreadcrumbContext`의 `menuTitle`(개수)을 알리고, `AppHeader`가 그것이 있을 때만 크럼을 제목으로 그린다. 상세 화면이 데이터를 불러오는 동안 크럼이 하나여도 제목 크기로 커지지 않는다. 주 액션(children)과 meta는 데스크톱에서 `AppHeader` 오른쪽 자리(`actionSlot`)로 포털된다. 그리기 전(`useLayoutEffect`)에 정해 크기가 바뀌어 보이지 않는다.
- 메뉴 첫 화면에는 설명 문구(subtitle)를 두지 않는다: 무엇을 하는 화면인지는 메뉴 이름과 내용이 말한다. h1만 남으면 데스크톱에서 띠의 여백·구분선을 0으로 접는다(`lg:hidden`은 h1까지 접근성 트리에서 지우므로 쓰지 않는다). 새로고침처럼 화면 전체에 걸리는 조작도 같은 자리, 주 액션 앞이다(§4.5 "목록 조작의 자리"). 키보드 순서상 헤더의 주 액션은 본문 앞이다: `본문 바로가기`는 그것을 건너뛰고, Shift+Tab으로 닿는다.
- 사이드바에 없는 화면(전체 로그, 모바일 더보기)과 상세는 본문 h1이 보이는 제목이고 크럼은 위치(`type-label`)다. 상세 화면의 h1은 대상 이름이 상태·메타를 이끈다.

전체 화면 높이를 계산하는 페이지는 **`lg`에서 빼는 값이 다르다** — 모바일 `Header` 3.5rem 대신 `AppHeader` 4rem이 추가로 붙어 `lg:h-[calc(100dvh-8rem)]`이다. 모바일은 높이를 계산하지 않고 자연 높이로 두며, 하단 제출 바를 `sticky`로 하단 내비(4rem + safe-area) 위에 붙인다 — 데모 배너처럼 위쪽 크롬이 늘면 높이 계산이 틀려 제출 바가 `BottomNavMobile` 뒤로 숨었다 (`ChannelFormPage`).

**헤더는 본문과 같은 스크롤바 거터를 예약해야 좌변이 맞는다.** 본문 스크롤 컨테이너가 `[scrollbar-gutter:stable]`로 15px(플랫폼마다 다름)을 예약하는데 `AppHeader`는 그 바깥이다. 안쪽 `max-w-320` 박스를 `mx-auto`로 가운데 두면 그 15px이 양쪽 7.5px씩 갈려 **헤더 크럼이 본문 제목보다 7.5px 오른쪽**으로 밀린다. 그래서 헤더에도 `overflow-y-hidden [scrollbar-gutter:stable]`을 건다 — 장식이 아니라 정렬 장치다. 오버레이 스크롤바 환경(macOS 기본)에서는 양쪽 다 0을 예약하므로 자동으로 맞는다. 헤더에 드롭다운처럼 넘치는 요소를 넣으려면 이 클립을 먼저 풀고 거터를 다른 방법으로 맞춰야 한다.

**풀블리드로 빠져나가는 페이지의 음수 마진은 본문 래퍼 패딩과 정확히 같아야 한다.** 래퍼는 `p-4 sm:px-6 sm:py-6`이므로 탈출값은 `-m-4 sm:-mx-6 sm:-my-6`이다. `ChannelFormPage`가 쓰던 `md:-m-8`은 존재하지 않는 32px 패딩을 가정해 8px 더 당겼고, 헤더가 기준선을 주기 전까지 드러나지 않았다.

### 3.5 그림자

`shadow-sm`(선택된 세그먼트) / `shadow-lg`(오버레이·툴팁)만. 카드에는 그림자를 쓰지 않는다 — 경계는 보더가 담당한다.

**떠 있는 표면은 둘로 나뉜다** (2026-11-13, [ADR 0010](../../docs/adr/0010-status-color-roles-and-floating-surfaces.md)).

| 종류 | 예 | 표면 |
|---|---|---|
| 스크림 없이 본문 위에 뜨는 것 | 툴팁, 차트 툴팁, `Select` 목록, 카드 안 더보기 메뉴, 토스트 | `bg-ui-raised border border-ui-border shadow-lg` |
| 스크림 위에 뜨는 것 | 모달, `ConfirmDialog`, 사이드 패널, 명령 팔레트 | `bg-bg-surface border border-ui-border shadow-lg` |

다크 모드에서 `shadow-lg`는 거의 보이지 않고 카드와 페이지의 대비도 1.07이다. 스크림이 없는 요소가 `bg-surface`면 카드 안에서 연 드롭다운이 카드와 같은 색이 되어 보더(1.54)로만 구분됐다. `ui-raised`(다크 `#2e3135`)는 카드보다 밝아서 그림자 없이도 위에 있다고 읽힌다. 스크림 위의 요소는 스크림이 이미 배경을 가라앉히므로 `bg-surface`로 둔다. 라이트에서는 두 값이 같은 흰색이다.

`ui-raised` 위의 글자는 §1.3의 제약을 따른다. 다크에서 `dim`은 4.03으로 미달이니 `muted` 이상을 쓴다. 목록 항목의 hover는 `ui-hover`다. 다크에서 표면보다 어두워지는 방향이지만 선택 항목(`bg-primary/10`)과 구분된다.

### 3.6 클릭 가능한 카드 hover

`.card-interactive` **하나만** 쓴다 (`index.css` 정의). 2px 들어올림 + 보더 `primary/40` + 배경 `ui-hover-soft`, 150ms. 터치 기기 제외(`hover: hover`), `:active`에서 원위치, 모션 최소화 설정에서는 들어올림 생략.

카드마다 `hover:-translate-y-*`·`hover:shadow-md`·`transition-all`을 직접 조합하지 않는다 — 메뉴별로 hover가 제각각이 된 원인이었다. 클릭 가능한 **행**(테이블·로그)은 카드가 아니므로 `hover:bg-ui-hover-soft` 채움만 쓴다.

### 3.7 간격 (2026-10-09)

**관계가 가까울수록 좁게 둔다.** 간격은 값이 아니라 두 요소의 관계로 고른다. 코드 전수 샘플링에서 다수가 이미 이 순서를 따르고 있었고, 아래 표는 그 다수를 규칙으로 올린 것이다. `gap-*`·`space-y-*`·`mt-*`가 같은 표를 따른다.

**부모가 간격을 정한다** (2026-11-21, 간격 체계화 P0). 형제 사이의 간격은 부모의 `gap`·`space-y`·`page-stack`·`section-stack`이 갖는다. 컴포넌트의 루트 요소에는 바깥 여백(`mt-*`, `mb-*`)을 두지 않는다 — 같은 컴포넌트가 놓이는 자리마다 앞뒤 관계가 다르기 때문이다. 예외는 hover 패딩을 상쇄하는 음수 여백(`list-bleed`, `table-bleed`)과 밀어내기(`ml-auto`)뿐이다. 여백 하나만 가진 감싸개(`<div className="mt-3">`)도 같은 이유로 쓰지 않는다. 2026-11-21 기준 이탈 건수와 이관 단계는 §10.I, 측정 방법은 `pnpm measure`(`scripts/measure-layout.mjs`)다.

**관계 토큰** (2026-11-21, 간격 체계화 P1). 아래 이름이 `index.css` `@theme`의 `--spacing-*`라 `gap-heading`, `space-y-label`, `mt-intra`처럼 쓴다. 숫자 클래스(`gap-4`)는 같은 값이지만 관계를 말하지 않으므로, 쌓기 간격은 이름으로 쓴다(`pnpm lint` S8이 숫자 세로 간격을 센다). 2026-11-21 이전에는 관계별 표(9단)와 세로 위계 표(V1~V6)가 따로 있어 같은 4px이 "제목 → 설명"과 "한 항목의 두 줄"로 이름이 갈렸다. 이 표 하나로 합쳤다.

세로(블록 쌓기) — 위계가 읽히게 하는 **보이는 간격**이다(소유자 피드백 "제목과 `장애`가 붙어 있고 글이 뭉친다", 2026-11-21).

| 토큰 | 값 | 단계 | 관계 | 담당 |
|------|-----|------|------|------|
| `intra` | 4px | V1 | 한 항목의 줄 사이: 제목 → 설명, 이름 → 메타, 컨트롤 → 도움말·오류, 라벨 → 값 | `PageHeader`·`Section` 설명, `Field` 도움말, `OptionText`, `Stat`, `SettingRow` 설명. `ListRow` 둘째 줄은 줄 상자(20/21) 위의 `mt-0.5`로 같은 4px을 보인다 |
| `label` | 8px | V2 | 라벨 → 그 내용 | `Field` 라벨 → 컨트롤, `ListGroup` 라벨 → 항목, 좁은 화면 `SettingRow` 라벨 → 컨트롤 |
| `heading` | 16px | V3 | 제목(·설명) → 첫 내용, 폼 필드 사이 | `Section`(머리와 본문 두 자식의 gap, 덮어쓰지 않는다), `ChartCard`(같은 방식) 머리 → 본문, `FormStep` |
| `item` | 20px | V4 | 두 줄 항목끼리, 모달·패널 본문의 섹션 | `ListRow` `py-2.5`(위아래 합), 모달 본문 |
| `group` | 24px | V5 | 같은 섹션 안 하위 그룹끼리, **페이지 블록 사이**(머리말 → 탭 → 패널, 패널 안의 블록, 툴바 → 표) | `page-stack`(본문 래퍼, 페이지·탭 패널의 루트). Tailwind `space-y`와 같은 방식(마지막이 아닌 자식의 아래 여백, 명시도 0)이라 자식이 직접 준 여백이 이긴다. 2026-11-20까지 같은 관계에 20px과 24px이 섞여 있었다 |
| `section` | 32px + 선 + 32px | V6 | 카드 없이 놓인 페이지 섹션 사이 | `section-stack`(개요의 그룹, 상세의 지표 → 차트 → 이력, 설정 섹션, §3.1). 테두리가 하던 구분을 간격이 맡으므로 `group`보다 넓다 |

가로(한 줄에 놓기):

| 토큰 | 값 | 관계 | 예 |
|------|-----|------|-----|
| `pair` | 6px | 한 요소를 이루는 짝(4px 격자 밖이지만 의도) | 점 + 라벨(`StatusLight`), 인라인 아이콘 + 텍스트, 브레드크럼, 칩 목록 |
| `inline` | 8px | 같은 무리의 독립 요소 | 버튼 사이, 제목 + 단위·배지, 메뉴 행의 아이콘 + 라벨 |
| `lead` | 12px | 선행 요소가 블록을 이끈다, 블록 안의 구획 | 선행 아이콘·타일 + 텍스트 블록, `justify-between` 행의 최소 간격, 툴바 컨트롤 사이 |
| `tile` | 16px | 카드·타일 사이(가로·세로) | 카드 그리드, 폼 필드 2열, 세로로 쌓인 카드 목록(모바일 채널 카드) |

2px(`0.5`)은 토큰이 아니다. 줄 상자 보정(`ListRow` 둘째 줄)과 프리미티브 내부(`SegmentedControl` 트랙, 배지 `py-0.5`)에서만 쓴다.

**간격이 아닌 값** (2026-11-21, P4). 아래는 형제 사이의 관계가 아니라 상자의 밀도나 정렬이라 관계 토큰으로 바꾸지 않고, 정해진 자리가 값을 갖는다.

- **조밀한 표 칸·코드 블록의 세로 안쪽 10px**: `cell` 유틸리티(`padding-block: 0.625rem`). 손으로 만든 표(알림 이력·규칙, Endpoint, 트레이스)와 코드 블록이 쓴다. 가로 안쪽은 호출부(`px-4` 등)다.
- **아이콘·체크박스·작은 표지를 옆 글의 첫 줄에 맞추는 2px**: `icon-lead` 유틸리티. `items-start` 행의 배너 아이콘, 체크박스(16px), 로그 레벨·시각 같은 작은 글이 쓴다. 상태 점(10px)은 `flex h-5 items-center`로 감싸 첫 줄 가운데에 둔다.
- **목록 끝 조작의 자리**: `list-more` 유틸리티(`list-bleed`의 아래 -10px을 되돌려 마지막 항목과 20px).
- **상자 안쪽 패딩의 반 단계**(컨트롤·칩·안내 상자의 `py-1.5` 등): 컴포넌트 안쪽 값이다. 같은 줄의 컨트롤은 높이 하나를 쓴다(#133).
- **세로·가로가 바뀌는 묶음**(`flex-col sm:flex-row`)은 넓은 화면의 가로 관계 토큰을 쓴다(`gap-lead`). 좁은 화면에서 같은 값이 세로가 된다.
- **외부 서비스 흉내**: 채널 폼의 미리보기(`ChannelPreview.tsx`, Telegram·Discord·Slack 메시지 모양)는 그 서비스의 크기·색·간격을 따르므로 글자 역할(S6)과 간격 규칙(S2·S3·S8)에서 뺀다(§1.7과 같은 예외).

**관계 검사 표지.** 공용 프리미티브는 자기가 맡은 간격에 `data-gap-after="<토큰>"`(이 요소와 다음 내용 사이) 또는 `data-gap="<토큰>"`(앞 내용과 이 요소 사이)을 단다. e2e 관계 검사(§10.I P2)가 이 표지만 잰다. 화면 코드에는 달지 않는다.

**기계가 지키는 것** (2026-11-21, 간격 체계화 P6). 아래는 사람이 화면마다 다시 재지 않는다.

- `pnpm lint`(금지, 0건이어야 한다): 임의값 간격(S1), 블록 사이 세로 반 단계(S2), 화면 코드의 줄 상자 보정 `mt-0.5`(S3), 여백만 가진 감싸개(S4), 컴포넌트 루트의 바깥 여백(S5, TypeScript AST), 역할 없는 글자 크기(S6), `leading-*`(S7), 숫자 세로 간격(S8). 세는 범위와 예외는 §10.I 표다.
- `e2e/spacing-rhythm.spec.ts`: 14개 화면 × 1440·390에서 관계 표지의 간격이 토큰 ±1px이고 `intra < label < heading < item ≤ group < section`이다. 재시도 없이 돈다. 어긋난 자리 목록(`KNOWN_OFF`)은 비어 있다.
- `pnpm measure`: 화면을 바꾸지 않는 정리는 전후 비교가 "차이 없음"이어야 한다(`node scripts/measure-layout.mjs --compare`). 화면을 바꾸는 PR은 같은 도구의 `--shots`로 전후 캡처를 붙인다.
- **의도한 예외**: 서버 개요 탭의 기능 묶음은 넓은 화면에서 제목을 왼쪽 열, 내용을 오른쪽 열에 두는 옆 라벨 배치다. 제목 → 내용이 세로 간격이 아니어서 `Section`으로 바꾸지 않고, 관계 검사에서도 표지가 없는 화면(`KNOWN_EMPTY`)으로 둔다.

- **불변식: intra < label < heading < item ≤ group < section** (V1 < V2 < V3 < V4 ≤ V5 < V6). 라벨은 자기 항목에, 제목은 섹션 전체에 붙고, 그룹 경계는 항목 사이보다 넓다.
- **hover 행은 패딩만큼 펼친다(`list-bleed`).** 행의 hover 채움 패딩(`px-3 py-2.5`)이 보이는 간격에 더해지면 같은 `mb-3`이 목록 앞에서 14px, 표 앞에서 29px로 보였다. 목록을 사방으로 펼쳐 글자는 본문 정렬선에 서고 V2·V3이 그대로 보인다. 가로 `table-bleed`와 같은 원리다.
- **표는 이 표 밖이다.** `ResourceTable`은 행 안 4px(`mt-1` 보조 줄) / 행 사이 32px(`py-4`)로 이미 같은 비율이다. 표 머리(`th`)의 패딩 때문에 제목 → 표 머리는 보이는 값으로 약 33px다.
- **쌓이는 줄은 행간 1.5.** 두 줄 항목의 둘째 줄과 여러 줄이 될 수 있는 한국어 글은 14/21(`type-body`) 또는 12/18(`type-caption-stack`)이다. `type-caption`(12/16)은 다른 글자 옆에 한 줄로 놓이는 메타에만 쓴다.
- **카드 안쪽** (2026-11-21, 전체 간격 점검): 수치 타일은 라벨 → 값 4px(V1), 타일 안쪽 16px다. 공용 `Stat`(라벨 `type-caption` → 값 `type-kpi` → 보조)을 쓴다 — 알림 발송 요약과 API 요청 타일이 각자 `gap-0.5`(2px)로 만들어 라벨과 값이 붙어 있었고, 발송 요약 카드는 세로 패딩이 14px(`py-3.5`)였다. 탭 안의 하위 그룹 머리(메트릭 그룹 등)는 `ListGroup` 라벨과 같은 `SUBGROUP_LABEL`(14/20/500 secondary)이고 내용까지 8px다. 담긴 차트 카드 제목(16px base)과 같은 크기면 무엇이 무엇을 담는지 읽히지 않았다. 표 칸에서 여러 줄로 접히는 12px 글(로그의 최근 메시지)도 `type-caption-stack`이다.

- **`gap-1`(4px)은 조밀한 액션끼리만**이다 — 표 행·카드 헤더에 나란히 놓인 `IconButton sm`·`Button sm`. `gap-2.5`는 쓰지 않는다.
- **인라인 아이콘과 메뉴 행을 가르는 기준**: 아이콘이 글자 한 줄에 붙어 다니면(메타 줄, 링크, 버튼 라벨) 짝이라 `1.5`다. 행 전체가 누르는 대상인 목록 항목(사이드바·명령 팔레트·드롭다운 메뉴)은 아이콘이 행을 이끄는 독립 요소라 `2`다. 둘이 `1`·`1.5`·`2`·`2.5` 네 값으로 갈려 있었다.
- **선행 요소가 텍스트 블록을 이끌면 크기와 무관하게 `3`**이다 — 배너·안내 상자, `items-start`로 제목·설명을 이끄는 아이콘·타일·**상태 점**. 배너의 아이콘 + 문장이 `2`·`2.5`·`3`으로 갈려 있었다. 상태 점이 **한 줄 라벨**에 붙으면 블록이 아니라 짝이라 `1.5`다(`StatusLight`).
- **가운데 정렬 빈 상태의 제목 → 설명은 `2`**다 — `EmptyState`와 같은 값. 카드 안에 손으로 만든 작은 빈 상태("이상이 없습니다" 등)도 따른다. 제목 아래 바로 붙는 설명(`0.5`)과 달리, 아이콘·제목·설명이 세로로 쌓여 한 덩어리가 되는 자리라 한 단계 띄운다(2026-10-10).
- **프리미티브 내부 값은 컴포넌트가 소유한다.** `Button sm`의 `gap-1`, `SegmentedControl` 트랙의 `gap-0.5`는 이 표의 대상이 아니다. 표는 화면·카드를 조립하는 호출부에 적용한다.
- 헤더 아래 24px(§4.1 액션 앵커)와 설정 행의 라벨 ↔ 컨트롤(`sm:gap-6`)은 이 표 밖의 기존 규칙이다.

**패딩**

| 대상 | 값 |
|------|-----|
| 카드 | `p-4`(기본) / `p-6`(차트 카드처럼 여유가 필요한 곳) — §3.1 |
| 한 줄 배너·띠 | `px-4 py-3` |
| 모달 | 헤더·푸터 `px-6 py-4`, 본문 `p-6` |
| 사이드 패널 | 헤더·본문 `px-5 py-4` |

모달과 사이드 패널의 패딩이 다른 것은 의도다. 패널은 화면 가장자리에 붙은 좁은 기둥이라 한 단계 좁다. 이탈은 §10.F.

### 3.8 반응형 (2026-10-09)

Tailwind 기본 브레이크포인트만 쓴다. `2xl`은 쓰지 않는다 — 본문 최대 폭이 1280px(§3.3)라 그 위로는 바뀌는 것이 없다.

| 경계 | 바뀌는 것 |
|------|-----------|
| `sm` 640 | 터치 높이 44 → 40px(`Button md`·입력·`IconButton md`, §4.1) · `SegmentedControl md` 트랙 44 → 40px(선택 버튼 44 → 36px) · 툴바 버튼 라벨 표시(`collapseLabel`) · 목록 검색창 전체 폭 → 320px · `DetailMeta` 속성 2열 · 본문 래퍼 패딩 `p-4` → `px-6 py-5` |
| `md` 768 | **뷰 분기** — `useIsMobile()`(767px 이하)이 알림·설정을 모바일 전용 뷰(`*MobileView`)로 가른다 · `PageHeader` 액션이 설명과 같은 행 · 대상 카드 목록 2열 |
| `lg` 1024 | **셸 전환** — `Sidebar` + `AppHeader` ↔ `Header` + `BottomNavMobile`(§3.4) · 차트 패널 2열 · 모바일 `← 목록으로` 숨김 |
| `xl` 1280 | 대상 카드 목록 3열 · KPI 게이지 4열 |

**대상 카드 목록은 `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`이다.** `lg`에서 사이드바(240px)가 생기면 본문이 약 720px로 줄어, 3열이면 카드 한 장이 230px까지 좁아진다 — `lg:grid-cols-3`을 쓰지 않는 이유다. `xl`의 3열은 카드당 약 315px다. 차트 패널은 `lg:grid-cols-2`(§4.2 메트릭 탐색·인프라 추세), KPI 행은 장수에 맞춘다(3장 `sm:grid-cols-3`, 게이지 4장 `grid-cols-2 xl:grid-cols-4`).

**`md`~`lg` 구간(768~1023px)은 데스크톱 뷰 + 모바일 셸이다.** 뷰 분기(`md`)와 셸 전환(`lg`)의 경계가 달라서, 태블릿 가로 폭에서는 알림·설정이 데스크톱 표를 보여 주면서 내비는 하단바다. 의도로 기록된 결정이 아니므로, 이 구간을 손볼 때 경계를 하나로 맞출지 먼저 정한다(§10.G).

---

## 4. 컴포넌트 카탈로그

### 4.1 `components/common/` — 공용 프리미티브

| 컴포넌트 | props | 규약 |
|----------|-------|------|
| **`Button`** | `variant` `size` + 네이티브 button | 라벨 있는 액션 버튼의 **유일한** 진입점 |
| **`Input`** | `invalid?` `warn?` `mono?` | 폼 입력 (§6) |
| **`Textarea`** | `invalid?` `mono?` + 네이티브 textarea | 여러 줄 입력. `Input`과 같은 셸 (§6) |
| **`Select`** | 네이티브 `option` children + 기존 select props | 앱 스타일 listbox (§6) |
| **`SearchInput`** | `wrapperClassName?` `onClear?` `resultCount?` `shortcut?` | 아이콘 붙은 검색창 (§6). `onClear`면 값이 있을 때 안쪽 ✕, `resultCount`면 검색 중 `N개`, `shortcut`이면 `/`로 포커스(목록의 주 검색 하나에만) |
| **`StatusLight`** | `tone` `label` `pulse?` | 대상 상태의 정본 — 점 + 라벨 (§5.1) |
| **`StatusBadge`** | `healthy: boolean` | 정상/장애 `StatusLight` 래퍼 (§5.1) |
| **`CollectionStatusBadge`** | `collecting` \| `partial` \| `delayed` \| `waiting` \| `not-configured` | 수집 신선도·설정 상태. 서비스 상태와 별도 축 (§5.1) |
| **`Toggle`** | `checked` `onChange` `disabled` `title` | w-9 h-5, `role="switch"`. 켜짐 트랙은 `status-healthy-fill`이다(2026-11-16) — primary 검은 채움이면 알림 표의 토글 열과 업타임 헤더 스위치가 화면에서 가장 진했다 |
| **`SegmentedControl<T>`** | `options` `value` `onChange` `size?` `ariaLabel` `scroll?` | 2~4지 배타 선택. `size`를 주지 않으면 자리가 정한다: `AppHeader` 안(`ControlDefaultsContext`)은 `sm`, 본문은 `md`(2026-11-20). 선택지에 `icon`을 주면 label을 접근성 이름·툴팁으로 유지. 선택지에 `tone`·`toneLabel`을 주면 이름 있는 상태 점을 붙이고, 정상이 아니면 문구도 보인다(서버의 앱 선택, 2026-11-18). `scroll`은 줄바꿈 대신 감싼 영역 안에서 가로 스크롤하고, 이름이 `max-w-36`에서 잘리므로 툴팁에 전체 이름을 넣는다(정상인 선택지는 `이름, 수집 중`, 2026-11-19) |
| **`Tabs<T>`** | `items` `active` `onChange(key, source?)` `ariaLabel` `idPrefix` | 패널을 바꾸는 밑줄 탭(§4.6, 2026-11-18). 항목은 `label` `tone?` `toneLabel?` `caption?` `srDetail?` `muted?`. 패널의 id는 `tabIds.ts`의 `tabId`·`tabPanelId`로 맞춘다. 상태 점이 있는 탭은 툴팁으로 `toneLabel`을 보인다(2026-11-19) |
| **`ListViewToggle`** | `view` `onChange` | 대상 목록의 그리드·카드 전환. `SegmentedControl` 래퍼라 크기도 자리를 따른다 — 헤더 32px, 본문 40px(§4.5). 크기를 화면마다 넘기지 않는다 |
| **`ResourceTable<T>`** | `rows` `columns` `rowKey` `ariaLabel` `renderDetails?` `alertRow?` | 대상 비교 표. 숫자 우측 정렬·반응형 열·행 아래 구성 관리 (§4.5). `alertRow`가 참인 행(진행 중인 장애)은 옅은 `status-error-fill/6` 채움이다(2026-11-20, §4.5 서버 목록) |
| **`TimeRangePicker`** | `value: GlobalTimeRange` `onChange` | `1h`\|`6h`\|`24h`. SegmentedControl 래퍼 |
| **`ConfirmDialog`** | `isOpen` `title` `message` `variant` `icon` … | `window.confirm()` 금지 — 항상 이것 |
| **`EmptyState`** | `icon` `title` `description?` `action?` `children?` `headingLevel?` | 빈 목록의 정본. 라벨+핸들러면 `action`, 자체 상태를 가진 트리거(연결 다이얼로그 등)는 children. 제목은 기본 h3, 페이지의 h1 바로 아래면 `h2`, 화면 전체가 이 안내면 `h1` |
| **`PageHeader`** | `title` `subtitle?` `meta?` `aside?` `actions?` `children` `menu?` `compactActions?` `truncateTitle?` `count?` | h1 등급 고정. `count`는 제목 뒤의 개수다: 데스크톱은 `AppHeader` 제목에, 모바일은 h1에 붙는다(§3.4, 서버·Docker 환경·그룹). `actions`는 상세의 대상 조작으로 제목 줄 오른쪽, 제목과 세로 가운데다(§4.1 상세 헤더). `meta`는 대상 메타데이터 — 상세는 `DetailMeta`. `aside`는 서비스 상세의 우측 조회 제어·바로가기. `menu`는 메뉴 첫 화면(§3.4): 모바일에서 조작이 제목 줄 오른쪽이다. `compactActions`는 메뉴가 아닌 화면에서 조작을 제목과 같은 줄에 둔다(전체 로그, 서버 상세, §4.1 액션 앵커의 예외). `truncateTitle`은 긴 제목을 말줄임한다(서버 상세) |
| **`OverflowMenu`** | `items` `label?` | 상세 머리말의 `더보기` 메뉴(2026-11-21). 항목은 `label` `icon?` `onSelect` 또는 `to`, `danger?`(메뉴 끝, 붉은 글자), `disabled?` `disabledReason?`. 40px(터치 44px) 아이콘 버튼과 `role="menu"` 목록. 주 조작 하나 외의 조작을 여기에 둔다(§4.1 상세 헤더) |
| **`RefreshStatus`** | `updatedAt` `onRefresh?` `refreshing?` `autoRefresh?` `onAutoRefreshChange?` | 갱신 상태 한 묶음: 마지막 갱신 시각(툴팁에 전체 시각), 새로고침, `30초마다 자동 갱신` 스위치. 상세 헤더 상태 줄의 오른쪽 끝, 개요·서버 목록의 머리. 좁은 화면에서는 스위치 옆 글자를 숨긴다 |
| **`DetailMeta`** | `status` `connection?` `fields?` `collapseOnMobile?` `collapsed?` | 상세 헤더 `meta`의 정본. 상태 줄 + (대상 상세의 연결 줄, §4.7) + 속성 목록(라벨 좌 / 값 우, `sm` 이상 2열). 속성이 많은 Docker 서비스 상세는 모바일에서 `서비스 정보`를 펼쳐 확인하며 상태는 항상 노출. `collapsed`는 모든 폭에서 접고 요약 줄에 속성 이름을 적는다(서버 탭의 `연결 정보`, `모니터 정보`)  행 높이는 하나다: sm 이상 40px(값 안의 조작은 `ControlDefaultsContext`로 sm 32px), 터치 화면 44px. 이전에는 조작이 든 행만 44~48px였다(2026-11-21) |
| **`ListToolbar`** | `search` `children?` | 목록 검색은 왼쪽, 필터는 그다음 |
| **`FilterChips<T>`** | `ariaLabel` `options` `value` `onChange` | 목록을 한 값으로 거르는 토글 칩(2026-11-20). 선택지는 `label` `count` `tone?`. 라벨과 개수는 같은 `type-body` 크기이고 개수만 500·고정폭 숫자다. 둥근 테두리 칩(`rounded-full`, 높이는 버튼과 같은 40px, 모바일 44px), 칩 사이 `gap-2`, 칩 안 `gap-1.5`(모바일은 둘 다 한 단계 좁혀 390px에서 네 칩이 한 줄이다). 선택은 `aria-pressed` + 진한 테두리(`border-primary`)와 `ui-hover` 채움이고, 다시 누르면 해제한다. 키보드는 버튼 그대로다(Tab, Enter, Space). `tone`은 상태 점이다: 상태 필터 전용이고(§5.3 칩은 상태 전용), 0건인 장애·확인 필요는 호출부가 `idle`로 넘긴다(§5.4). 개수는 다른 필터(검색·그룹·심각도 등)를 따르고 자기 선택은 따르지 않는다(고른 칩 옆의 다른 칩이 0이 되지 않는다). 쓰는 곳(2026-11-21): 서버 목록·그룹 목록의 상태(`stateChipOptions`, 장애·확인 필요·대기·정상), Docker 환경의 서비스 상태(장애·정상), 업타임 탭의 상태(장애·정상·확인 대기·일시정지), 알림 규칙의 유형(`categoryChipOptions`, 데스크톱·모바일 같음, 0건인 유형도 자리를 지킨다), 데스크톱 발송 이력의 상태(발송·실패, 라벨은 행의 `historyStatus`). 툴바에 선택(`Select`)과 함께 놓이면 선택이 먼저이고 칩 묶음이 마지막이다: 줄이 넘치면 칩 묶음이 통째로 다음 줄로 간다. 검색어와 칩 선택은 `useListSearch`가 주소(`q`, `status`)에 둔다(알림 탭 안의 필터는 화면 상태다) |
| **`ResourceCardHeader`** | `title` `badge?` `subtitle?` `status?` | 대상 이름·출처·상태의 고정 배치 (종류 아이콘 없음) |
| ~~`SummaryCard`~~ | — | 2026-11-21 삭제(사용 0회). 수치는 `Stat`(라벨 → 값 4px, `type-kpi`)으로 쓴다 |
| **`Section`** | `title` `meta?` `description?` `actions?` `id?` `label?` `className?` `children` | 본문 1단계 섹션(§2.2). 20px 제목 + 기준선을 맞춘 메타 + 제목 줄과 가운데를 맞춘 조작 + 둘째 줄 설명, 그리고 본문. 제목 → 본문 16px(`heading`)은 머리와 본문 두 자식의 `gap`이다(2026-11-21, 이전 `SectionHeader`는 루트의 `mb-4`로 간격을 가졌다). `<section>`의 이름은 제목이고 `label`을 주면 그것이다. 2026-11-20에 `DetailActionToolbar`를 없애고 그 조작은 `PageHeader actions`로 옮겼다 |
| **`List` · `ListRow` · `ListGroup` · `ListMore`** | `ListRow`: `to` `marker` `title` `detail?` `detailSize?` `trailing?` `trailingDetail?` | 두 줄 목록(§3.7 세로 위계). 개요의 현재 확인 필요·최근 장애 이력, Docker 환경의 장애 이력, 로그의 반복 패턴이 쓴다. `List`는 `list-bleed`로 행 패딩만큼 펼치고 글자 폭 720px(`max-w-186`, 펼친 24px 포함)까지만 써서 오른쪽 값(시각, 개수)이 이름에서 멀어지지 않게 한다. `ListGroup`은 하위 그룹(라벨 `type-label` `text-text-secondary`, 라벨 → 항목 8px), `ListMore`는 목록 끝의 펼치기 조작으로 아이콘은 표지 열, 글자는 항목 제목 열에 선다. 2026-11-21 이전에는 세 화면이 각자 만들었다 |
| **`Pagination`** | `page` `totalPages` `onChange` … | 목록 페이지 이동 |
| **`MaterialIcon`** | `name` `size` `className` `style` | 로컬 정적 SVG |
| **`Tooltip`** | `content` `focusable?` + 단일 자식 | hover·포커스 힌트. DOM 래퍼 없이 기존 요소에 연결 |
| **`IconButton`** | `icon` `label` `tone?` `size?` `iconClassName?` | 라벨 없는 아이콘 액션. `tone`은 `action`(기본)·`danger`·`quiet`. `danger`는 쉴 때 `text-muted`이고 hover·포커스에서만 붉다(2026-11-21) — 행마다 반복되는 붉은 휴지통이 목록 오른쪽 끝에 색 기둥을 만들어 시선이 규칙 이름보다 거기서 먼저 멈췄다. 표·카드 행의 편집 아이콘은 `quiet`다. className을 받는 자리(CopyButton)는 같은 파일의 `ICON_ACTION`/`ICON_ACTION_SM` |
| **`CopyButton`** | `onCopy` `title` `className` … | 3초 완료 피드백. 클래스는 같은 파일이 export하는 `COPY_ACTION_PRIMARY`/`COPY_ACTION_SUBTLE`을 쓴다 |

상수 파일(2026-11-18): `statusTone.ts`의 `STATUS_DOT`이 상태 점 색의 유일한 정의다(`StatusLight`·`Tabs`·`SegmentedControl`의 점). `collectionStatus.ts`의 `COLLECTION_STATUS_LABEL`은 수집 상태 문구이고, 점 없이 문구만 필요한 자리(인프라 탭 상태 줄의 원인)도 같은 말을 쓴다. 컴포넌트 파일에서 상수를 export하면 fast refresh 규칙에 걸려서 따로 둔다.

**Button 스펙**

| variant | 용도 | 클래스 |
|---------|------|--------|
| `primary` | 주 액션 (화면당 1개) | `bg-primary text-on-primary hover:bg-primary-hover` |
| `secondary` | 보더 있는 보조 액션 | `border border-ui-border text-text-base` + 아이콘 `action` |
| `ghost` | 배경 없는 3순위 | `text-action hover:bg-action/10` |
| `text` | 경로처럼 본문 안에 놓는 액션. hover 채움 없음 | `text-action` |
| `destructive` | 삭제·비활성화 — secondary와 **같은 모양**에 글자만 빨강 | `border border-ui-border text-status-error hover:bg-status-error/10` |
| `quiet` | 정보만 보여주는 다이얼로그의 `닫기` — 눈에 띄지 않아야 하는 이탈 | `text-text-muted hover:bg-ui-hover` |
| `danger` | 확인 다이얼로그의 파괴 확정 | `bg-danger text-white hover:bg-danger-hover` (§1.4) |

**액션은 색이 아니라 형태로 드러낸다 (2026-11-15, 무채색 전환).** `action`이 제목 글자색과 같아졌으므로 `ghost` 버튼은 색으로 본문과 갈리지 않는다. 그래서 **`ghost`는 아이콘을 함께 둔다** — 아이콘 없는 글자만의 `ghost`는 라벨로 읽힌다(예: 개요의 `전체 N건 보기`에 `expand_more`). 아이콘을 둘 수 없으면 `secondary`(보더가 버튼임을 말한다)나 텍스트 링크(`link-underline`)를 쓴다. **예외는 이탈 액션뿐이다** — 닫기를 색으로 강조하면 정작 그 화면의 주 액션보다 먼저 눈에 들어온다. `quiet`가 그 자리다. 폼 푸터의 `취소`는 주 액션과 짝을 이루므로 `secondary`다(§7 푸터 규칙).

**버튼 색을 `className`으로 덮어쓰지 않는다.** `variant="ghost" className="text-status-error"`로 쓰던 삭제 버튼 5곳이 전부 회색으로 렌더되고 있었다 — Tailwind가 같은 속성의 유틸리티를 **알파벳 순**으로 내보내기 때문에 `text-status-error`가 `text-text-muted`보다 앞서 나가 매번 졌다. 색은 variant로 고른다.

| size | 높이 | 용도 |
|------|------|------|
| `sm` | `h-8` (32) | 테이블 행, 조밀한 툴바, 인라인 액션 |
| `md` | `h-11 sm:h-10` (터치 44 / 그 외 40) | **기본** — 입력·검색창과 같은 높이 |

**`md`는 `sm`(640px) 미만에서 44px다.** Apple 44pt·Material 48dp의 터치 영역 권장을 따른다. 입력(`FIELD_HEIGHT`)·`SearchInput`·`IconButton md`·`SegmentedControl md`가 같은 규칙이라 모바일에서도 나란히 놓인 밑변이 맞는다. `lg`(44px 고정)는 로그인 1곳에서만 쓰이다가 이 규칙에 흡수돼 제거했다.

`SegmentedControl`은 트랙을 포함해 `sm` 32px, `md` 40px(모바일 44)로 같은 크기의 `Button`과 높이가 같다. 같은 행의 조작은 한 높이다. `md`의 선택 버튼은 모바일 44px(터치 영역), `sm` 이상 36px다. 모바일 `md` 트랙은 패딩·테두리 대신 높이를 차지하지 않는 안쪽 1px 선(`shadow-[inset_…]`)을 써서 바깥 높이가 버튼과 같은 44px다(2026-11-20 — 이전에는 트랙의 패딩·테두리가 4px를 더해 48px로 옆 버튼보다 컸다). `TimeRangePicker`도 `md`를 써 모바일 터치 영역을 확보한다.

아이콘 전용 `md`도 모바일에서 **버튼 자체를 44×44px**로 둔다(트랙 포함 48px). `sm` 이상은 36×36px(트랙 포함 40px)다. 아이콘은 20px이고, `label`을 `aria-label`과 공통 툴팁으로 제공한다. `aria-pressed` 선택 표현과 전역 포커스 링은 텍스트형과 같다.

**상태**
- **진행 중** — `loading` prop. 라벨은 그대로 두고 스피너가 앞에 붙는다(호출부의 아이콘은 숨김), `aria-busy`, 클릭 불가. `저장 중…`처럼 라벨을 바꾸지 않는다 — 버튼 폭이 흔들리고 화면마다 문구가 갈렸다.
- **비활성** — `opacity-50` 하나다(버튼·아이콘 버튼·입력·`Select`·`Toggle`·`Pagination`·`CopyButton`, 비활성 채널·규칙 카드까지). 40·60이 섞여 있던 것을 2026-11-13에 맞췄다. `disabled`에서도 공통 툴팁의 hover는 유지한다. **키보드로도 이유를 확인해야 하면 `aria-disabled`** 를 쓰고 핸들러에서 실행을 막는다. 네이티브 `disabled`는 Tab 순서에서 제외된다.
- **누름** — 색 변화만. `active:scale-95` 같은 축소 애니메이션은 쓰지 않는다(주요 디자인 시스템 공통, `transition-colors`로 충분). 누름은 hover보다 한 단계 진하다: 채움은 `-hover` 값, 보더·투명 버튼은 `ui-active`·`/15`다. **터치에는 hover가 없다** — Tailwind v4의 `hover:`는 `@media (hover: hover)` 안에서만 걸리므로, `active:`가 없으면 터치 화면에서 버튼을 눌러도 아무 변화가 없었다(2026-11-13까지 코드 전체에 `active:` 0건). `aria-disabled`는 hover와 같이 누름도 막는다.

**이동은 링크다.** 다른 화면으로 가는 버튼은 `<ButtonLink to>`(같은 모양의 `<a href>`)를 쓴다. `<Button onClick={() => navigate(…)}>`은 새 탭 열기·주소 미리보기가 안 되고 스크린리더가 "링크"로 읽지 않는다. `EmptyState`의 `action`도 `{ label, to }`를 받는다. 같은 화면 안에서 상태만 바꾸는 것(탭 전환 등)은 버튼이다.

크기는 **높이로 고정**한다. `px/py` 조합으로 높이를 만들지 않는다 — 나란히 놓았을 때 밑변이 어긋난다.
`p-2 rounded-lg` + 아이콘 하나짜리 **아이콘 전용 토글 버튼은 이 컴포넌트 대상이 아니다**.

**액션 앵커**

- 페이지의 주 액션은 `PageHeader`의 `children`에 둔다. `md` 이상에서는 **설명과 같은 행의 우측 끝**, 그 미만에서는 설명 아래가 고정 위치다. 제목은 자기 행을 독차지한다 — 제목 행에 버튼을 같이 두면 세 글자짜리 제목과 버튼 사이가 1000px 넘게 비어 서로 무관한 요소로 읽혔다. **예외(2026-11-19)**: `PageHeader compactActions`인 서버 목록, 전체 로그, 서버 상세는 조작을 제목과 같은 줄의 오른쪽에 둔다(서버 목록은 데스크톱에서 `AppHeader`로 포털되므로 모바일의 배치다). 버튼만 있는 줄이 본문을 밀었다. 제목이 길면 제목이 줄고 버튼은 줄지 않는다.
- 액션은 **보조 → 주 액션** 순서로 전달해 주 액션을 우측 끝에 둔다. 헤더 내부에 별도 flex 래퍼를 만들지 않는다. 40px 버튼의 중심을 설명 행의 중심에 맞춘다(`md:items-center`). `sm` 미만에서는 버튼을 전체 폭으로 쌓고, 그 이상에서는 같은 순서로 줄바꿈한다. 메뉴 첫 화면(`PageHeader menu`)은 쌓지 않고 한 줄에 두며 마지막(주 액션)이 남은 폭을 채운다 — 아이콘 새로고침 + 주 액션(2026-11-15). 버튼 아이콘은 20px, 버튼 간격은 8px, 헤더 아래 간격은 24px다.
- **버튼 라벨은 명사형이다** — `추가`·`저장`·`삭제`·`수정`·`취소`·`닫기`. 대상을 새로 만드는 액션의 라벨은 **`추가` 하나다.** 편집 제출은 `저장`. `생성`·`규칙 생성`처럼 동사를 바꾸지 않고, `추가하기`처럼 어미를 붙이지 않는다(2026-09-24 — 같은 푸터에 `[취소][추가하기]`와 `[취소][저장]`이 섞여 있었다). 진행 중에도 라벨은 바꾸지 않는다(`loading`). 페이지 헤더 CTA, 빈 상태의 액션, 다이얼로그 제출 버튼 전부 같은 문구를 쓴다. `업타임 추가`·`Logs 직접 추가`·`Collector 추가`처럼 대상을 앞에 붙이지 않는다 — 대상은 페이지 제목이나 모달 제목이 이미 말하고, 명사를 각자 고르게 두면 한글·영어가 섞이고 화면마다 어긋난다. 라벨에 영어 리소스명(`Logs`·`Metrics`·`Collector`)을 넣지 않는다.
- **제목은 이 규칙 밖이다** — 다이얼로그·페이지 제목은 `업타임 추가`·`채널 추가`처럼 대상을 밝힌다. 라벨에서 명사를 뺄 수 있는 근거가 제목이므로, 제목까지 비우면 맥락이 사라진다.
- Docker·로그·API·메트릭·인프라의 연결 진입점은 `Docker 연결`·`로그 연결`·`API 연결`·`메트릭 연결`·`인프라 연결` 하나로 통합한다. 기존 대상 재사용과 새 대상 등록을 모두 포함하므로 위의 생성 전용 `추가` 규칙과 구분한다. 연결 화면 안에서 Docker와 직접 OpenTelemetry 경로를 선택한다.
- **예외: 대상을 말해 주는 화면 제목이 없는 자리에서는 라벨에 대상을 붙인다** (2026-11-19 결정). 라벨에서 명사를 뺄 수 있는 근거가 제목이므로(아래), 제목이 다른 것을 말하는 자리에서는 명사가 필요하다. 2026-11-19 기준 이 예외의 자리:
  - 서버 탭 줄의 조작 자리(§4.6): `모니터 추가`, `로그 연결`, `API 연결`, `메트릭 연결`(`serverPaths.ts`의 `CONNECT_LABEL`). 연결 안내의 주 버튼도 같은 문구다(인프라는 `인프라 연결`). 탭 줄의 버튼은 `secondary`, 연결 안내(빈 상태) 안의 버튼은 `primary`다.
  - 대상이 없는 서버의 개요 탭: `업타임 모니터 추가`.
  - 개요의 빈 화면(`아직 모니터링 대상이 없습니다`)과 서버 목록이 비었을 때의 안내: `서버 추가`. 다른 서버가 없어 옮길 곳이 없는 `다른 서버로 옮기기` 대화 상자의 `서버 추가`도 같다.
  - 제목이 대상을 말하는 자리는 그대로 `추가`다: 서버 목록의 머리말 버튼(2026-11-19에 `서버 추가`에서 바꿨다), 그룹 목록.
- 헤더 블록은 `border-b border-ui-border pb-5`로 띠를 이룬다. 제목과 우측 CTA 사이가 1000px 넘게 벌어지는 넓은 화면에서, 이 선이 없으면 버튼이 헤더에 속하지 않고 구석에 떠 있는 요소로 읽혔다.
- 검색·필터는 페이지 헤더에 섞지 않고 그 아래의 보조 툴바에 둔다. 모바일에서는 툴바가 CTA보다 앞서지 않는다.
- 목록의 보조 툴바는 `ListToolbar`를 쓴다. 검색창은 왼쪽 320px(`sm` 미만 전체 폭), 필터는 오른쪽부터 이어지며 공간이 부족하면 다음 줄로 흐른다. 새로고침·보기 전환은 툴바에 넣지 않는다(§4.5 "목록 조작의 자리"). 검색·필터·버튼 높이는 모두 40px다. 탭 안의 검색은 해당 탭의 목록 위에 둔다. 검색 기능이 없는 화면에 정렬만을 위한 빈 검색창을 만들지 않는다.
- **상세 화면의 헤더는 하나다 — `PageHeader`(제목·설명·`meta`) + `actions`(제목 줄 오른쪽).** 2026-11-20부터 조작은 제목 줄에 둔다: 머리말 아래 조작만 담은 줄(`DetailActionToolbar`)이 본문 위에 64px(40 + 24)를 더 차지했고, 그 줄의 왼쪽 끝에 새로고침 아이콘 하나만 떠 있었다. 조작은 제목 줄의 세로 가운데에 맞고(`min-h-10 items-center`), 좁은 화면에서는 제목 아래로 줄바꿈된다. 대상의 상태(`StatusLight`)는 제목 옆이 아니라 `meta` 줄의 첫 항목이다. 2026-09-23까지 상세 9곳 중 5곳이 `h1`을 직접 쓰고 버튼을 제목 행에 붙여서, 새로고침이 좌측 라벨 버튼·우측 첫 아이콘·우측 끝 아이콘으로 화면마다 달랐고 삭제는 라벨 버튼과 라벨 없는 빨간 아이콘이 섞여 있었다.
  - **조회 제어가 먼저**: `새로고침`(아이콘)이 `actions`의 맨 앞이다. 기간 선택처럼 큰 조회 제어는 `aside`(서비스 상세)나 탭 패널의 머리에 둔다.
  - **그다음 대상 자체에 대한 액션, 순서 고정**: 이동(`알림 규칙`) → 편집(`수정`·설정 다이얼로그) → 파괴(`삭제`·`비활성화`)가 **항상 맨 끝**. `수정 | 삭제`는 붙어 있는 짝이다.
  - **상태 전환은 툴바가 아니라 `meta` 줄의 상태 바로 옆**이다 — `● 정상 [일시정지]`, `● 수집 가능 [연결 중지]`. 대상을 고치거나 지우는 것과 운영 상태를 켜고 끄는 것은 성격이 달라서, 툴바에 섞어 두면 `수정 | 일시정지 | 삭제`처럼 짝이 끊겼다(2026-09-24). `API Key ••• [키 재발급]`처럼 **속성 옆에 그 속성을 바꾸는 액션**을 두는 meta 줄 규칙과 같은 원리다. 버튼은 meta 줄의 다른 액션처럼 `ghost` md, 상태 표시(`StatusLight`)와는 별개 요소다(§5.1 — 상태 표시는 읽기 전용).
  - **툴바 안 버튼은 모두 같은 모양이다** — 테두리 있는 `secondary`, 파괴만 `destructive`(같은 테두리에 빨간 글자), 전부 아이콘 + 라벨. 역할을 `secondary`/`ghost`/`destructive` 모양으로 가르면 한 줄에 놓였을 때 위계가 아니라 들쭉날쭉으로 읽혔다(2026-09-24, *"왜 뭐는 border를 넣고 뭐는 안 넣었어?"*). 위계는 순서와 색으로 말한다 — Primer·Polaris의 danger 버튼도 기본 버튼과 모양이 같다. 테두리 없는 `ghost`는 카드·문장 안의 인라인 액션 전용이다.
  - **좁은 화면(sm 미만)에서는 아이콘만** — 툴바 버튼에 `collapseLabel`을 건다. 라벨은 sr-only로 남아 접근 가능한 이름이 되고 title 툴팁으로도 나온다. 그래서 툴바의 모든 버튼에는 아이콘이 있어야 한다.
  - 상세의 액션은 **라벨 버튼**이다(sm 이상). 데스크톱에서 아이콘 전용 버튼을 나란히 두지 않는다 — 라벨 없는 아이콘 다섯 개(설치·API Key·상세 수집 설정·비활성화)는 hover 전까지 무엇인지 읽히지 않았다. 모바일의 아이콘만 표시는 공간 때문에 허용한 예외이고, title·sr-only 라벨로 보완한다.
  - **예외: 새로고침과 설정은 모든 폭에서 아이콘만이다** (2026-11-19). 상용 모니터링 도구(Grafana·Datadog·Sentry)가 모두 ⟳·⚙을 라벨 없이 쓰고, 누구나 아는 아이콘이라 hover 전에도 읽힌다. 새로고침은 `RefreshIconButton`(`IconButton tone="quiet"`, 불러오는 중 회전·비활성)으로 **갱신 시각 바로 옆**에 둔다 — 갱신 시각이 없는 화면은 머리말 액션의 맨 앞이다. 서버 상세의 `서버 설정`은 제목 줄 오른쪽의 `IconButton tone="quiet"`다. 다른 액션(수정·삭제·API Key 등)은 이 예외에 넣지 않는다.
  - 두 그룹은 양 끝에 둔다. 넘치면 줄이 바뀌어도 액션 그룹은 오른쪽에 붙는다.
- **대상의 속성은 본문이 아니라 헤더 띠 안에 둔다.** API Key·키 재발급·마지막 수집·Project 배정처럼 제목이 가리키는 대상을 설명하는 값은 `PageHeader`의 `meta`에 `DetailMeta`로 싣는다. **상태 줄**(`status`, `type-caption`)은 상태 → 수시로 바뀌는 값(마지막 수집·서비스 수) → 상태 전환 버튼 순이고, **속성 목록**(`fields`)은 라벨 좌(`type-body` `dim`, 96px 고정) / 값 우(`type-body` `base`) 행을 `sm` 이상 2열로 둔다. 값을 바꾸는 액션(`키 재발급`·Project `Select`)은 그 값의 행 안에 둔다. 2026-09-24까지는 모든 항목을 12px 한 줄에 흘려서 라벨·값·버튼이 한 문장처럼 읽혔고, 라벨 위/값 아래 그리드도 시안에서 검토했으나 시선이 칸마다 위아래로 오르내려 기각했다 — 속성 몇 개를 확인하는 자리는 좌→우로 읽히는 키-값 행이 맞다. **최근 결과는 상태 줄에 둔다** (2026-11-14) — 업타임 상세는 `● 정상 · 최근 체크 HTTP 200, 356ms (11:03)`, 장애 중이면 `장애 12분째`가 상태 바로 뒤에 온다. 예전의 "현재 상태" 카드는 제목 둘에 헤더의 상태·"마지막 확인"을 다시 말했다. 상세 속성은 모바일에서 접는다(`collapseOnMobile`). **상세 헤더에는 `subtitle`을 두지 않는다** — `직접 연결한 OpenTelemetry traces 서비스입니다.` 같은 설명은 `허용 신호`·`어댑터` 행을 문장으로 한 번 더 말할 뿐이었다(2026-09-24). 대상의 종류는 `meta`가 말한다. **`fields` 라벨은 개발자가 쓰는 용어 그대로다** — `API Key`·`URL`/`Host`·`Protocol`·`Interval`·`Signals`·`Image`·`Uptime`·`Restarts`·`Version`. `수집 키`·`대상`·`허용 신호`·`어댑터`처럼 기술 용어를 한글로 풀어 쓰지 않는다(2026-09-24 — 모니터링 사용자는 개발자다). 한글이 더 정확한 곳만 한글(`연결 방식`)이고, 값이 늘 같은 행(`출처: 직접 설정`)은 두지 않는다. 직접 연결 상세 4종이 이 값들을 본문 최상단에 카드 두 장(`lg:col-span-2` + Project)으로 펼치고 있어서, 정작 그 페이지가 보여줘야 할 로그·차트가 첫 화면 밖으로 밀려났다 — 메타데이터는 읽는 대상이 아니라 확인하는 값이다. 메타 줄 안의 버튼·입력은 다른 줄과 마찬가지로 40px로 맞춘다.
- 아이콘 전용 액션은 `IconButton md`(`h-11 w-11 sm:h-10 sm:w-10`)다. `sm`(32px)은 테이블 행·다이얼로그 헤더·입력 안의 지우기처럼 조밀한 맥락에서만 쓴다.
- **인라인 액션**(문장 속 `필터 초기화`, 카드 안 `트레이스`·`로그 보기` 이동, `새 코드`)은 `Button variant="ghost" size="sm"`이다. 파란 밑줄 텍스트 링크 버튼이나 `primary/5` 틴트 칩(배경·보더·글자 3중)을 손으로 만들지 않는다. 외부 문서로 가는 진짜 `<a>`는 링크 모양을 유지한다.
- **행·카드 액션은 우측 끝**, 순서는 상태 토글 → 보조(`테스트` 등) → 수정 → 삭제다. 표 행은 `IconButton size="sm"`, 카드는 `ResourceCardHeader`의 `status` 슬롯(우측 상단)에 둔다.
- **다시 시도**: 화면 일부가 실패하면 [`LoadErrorBanner`](src/components/common/LoadErrorBanner.tsx)를 쓴다. 중립 배너(`bg-bg-surface border-ui-border`)에 `status-warn` 아이콘, 제목은 `type-label text-text-base`, 원인은 `type-body text-text-muted`, `Button variant="secondary" size="sm"` `다시 시도`다. 표 칸·카드·차트 카드 안처럼 상자를 하나 더 두면 카드 속 카드가 되는 자리는 `inline`(상자 없이 아이콘 + 글자 + 버튼)이다. 화면 전체가 실패하면 `EmptyState`의 `action`. **실패 문장을 경고색으로 칠하지 않는다** — 2026-11-14까지 10곳이 `text-status-warn` 문장이었다. 색은 아이콘 하나에 싣는다(§5.3). 일회성 주의문(`API Key는 지금 한 번만 표시됩니다`)도 같다: 경고 아이콘 + 기본 글자색.

**아이콘 크기** — `MaterialIcon`은 `size`로 SVG 크기를 정한다. 기본이자 본문 크기는 20px다 — 인라인·버튼·내비게이션·섹션이 전부 같은 20px를 쓴다(2026-09-22, 16px 층 폐지). 24px는 주요 상태용이다. 스피너·빈 상태에는 32/36/48px를 허용한다. `text-*`는 색에만 사용하고 폰트 크기를 아이콘 크기로 사용하지 않는다. 아이콘 획은 SVG 도형이 결정하므로 `font-*`로 두께를 조절하지 않는다. 같은 영역에서는 같은 아이콘 계열을 사용한다. 삭제는 `delete_outline` 하나다(`delete` 채움형과 섞지 않는다). 제출 버튼 아이콘은 생성(`add`)에만 붙인다.

**MaterialIcon 함정** — `iconMarkup` 맵에 없는 `name`은 `help_outline`(`?`)로 폴백한다. 신규 아이콘은 반드시 [`materialIconPaths.ts`](src/components/common/materialIconPaths.ts)에 path를 추가한다.

**(2026-11-21 `SummaryCard` 삭제로 기록만 남는다.) KPI 카드(`SummaryCard`)는 2행이었다** — 라벨(좌)과 숫자(우)가 베이스라인을 맞춘 한 행, 그 아래 설명 한 행. 이전에는 라벨/숫자/설명이 3행으로 쌓이고 아이콘만 우측 상단에 혼자 떠 있어서, 카드 폭 ~300px 중 오른쪽 절반이 비고 내용은 좌측에 쏠렸다. 숫자를 오른쪽 끝으로 보내 그 여백을 쓴다. 숫자는 `tabular-nums`(Spoqa는 숫자가 원래 고정폭)라 카드마다 우측 정렬 위치가 같다.

**KPI 설명문의 색은 `warn`·`error`일 때만 싣는다.** `healthy`·`idle`은 `text-text-muted`다. 카드 4장이 전부 색 문장을 달고 있으면 정작 문제인 카드가 묻힌다 — §5.1 `StatusLight`와 같은 논리다. 이 규칙이 기존 오용도 함께 걷어냈다: 업타임 `정상` 카드의 `전체 5개 대상 중`(분모)과 개요 `Projects` 카드의 `대상을 운영 단위로 묶고 있습니다`(설명)가 `tone="healthy"`를 타고 초록으로 칠해지고 있었는데, 둘 다 상태가 아니다.

**대상 목록의 카드 헤더** — 카드 보기의 대상 카드(업타임 모니터 `UptimeTargetCard`, 로그 앱 `LogServiceOverview`, Docker 환경 `ServiceGridPage`·`PendingServiceCard`, 그룹 목록 `ProjectsPage`, Docker 환경 상세 `ProjectDetailPage`)는 `ResourceCardHeader`를 쓴다(2026-11-19 기준 목록). `ProjectDetailPage`는 이름과 달리 Docker 환경의 상세(`/agents/:agentId`)이고, 그룹의 상세는 `ProjectOverviewPage`다. 출처는 이름 옆, 상태 또는 대상별 작업은 우측이다.

**대상 카드에 종류 아이콘을 달지 않는다** (2026-09-20). 한 목록의 카드가 전부 같은 아이콘을 달고 있어서(업타임=`monitor_heart`, API=`api`, 로그=`article`, …) 카드끼리 구분되는 정보가 **0**이었다. 대상의 종류는 페이지 제목과 사이드바의 활성 항목(서버 화면에서는 탭)이 이미 말한다. 직접 연결/Docker 연결 여부로 아이콘을 달리하는 것도 마찬가지다 — 그건 출처 라벨이 말한다.

아이콘이 의미를 지니는 자리는 남는다: 사이드바 내비, 알림 채널의 브랜드 아이콘, 상태 아이콘, `EmptyState`의 안내 아이콘. 이들은 **선택지마다 아이콘이 다르거나 하나뿐이라** 반복 장식이 아니다.

**카드의 좌측 기준선은 하나다.** 제목·부제·본문(endpoint·통계 그리드·푸터)이 전부 카드 패딩에 정렬한다. 아이콘을 없애면서 자동으로 성립하지만, 무엇이든 제목 줄에 거터를 도입하면 그 아래 본문과 좌변이 어긋난다는 규칙 자체는 유효하다 — `ResourceCardHeader`를 쓰는 8개 카드 전부가 그 증상이었다(2026-09-20 해소).

배치 판단 참고: [PatternFly Page header](https://www.patternfly.org/component-groups/content-containers/page-header/)의 제목 우측 액션, [Carbon Data table](https://carbondesignsystem.com/components/data-table/usage/)의 검색·필터 툴바. 이 프로젝트에서는 기존 페이지 CTA 앵커를 유지하고 목록 조회 제어를 별도 줄로 통일한다.

**상세 헤더는 한 모양이다 (2026-11-21, 점검 B1·B2).** 서버·Docker 환경·Docker 서비스·그룹 상세와 서버 탭의 대상 패널(모니터, 앱, 인프라)이 같다.
- **제목 줄 오른쪽**: 주 조작 하나(secondary)와 `OverflowMenu`(`더보기`, 40px 아이콘 버튼). 드물게 쓰는 조작과 파괴적 조작(삭제, 비활성화, 연결 해제)은 메뉴에 두고 파괴적 항목은 메뉴 끝에 붉은 글자로 둔다. 주 조작: 서버 `서버 설정`(아이콘), Docker 환경 `Collector 설치`(메뉴: API Key, 상세 수집 설정, 비활성화), Docker 서비스 `알림 규칙`(장애일 때만 `에러 확인`을 더한다 — 이전에는 정상일 때 이유 없이 비활성이었다), 그룹 `대상 추가`(메뉴: 수정, 삭제), 모니터 `수정`(메뉴: 알림 규칙, 다른 서버로 옮기기, 삭제), 앱·인프라 `알림 규칙`(메뉴: 다른 서버로 옮기기, 삭제·연결 해제). 이전에는 화면마다 3~4개의 버튼을 같은 무게로 늘어놓았다.
- **갱신 상태는 상태 줄의 오른쪽 끝**: `RefreshStatus`(마지막 갱신 시각 + 새로고침 + `30초마다 자동 갱신` 스위치)다. 개요도 같은 컨트롤을 쓴다(메뉴 화면이라 데스크톱은 `AppHeader`). 서버 목록은 스위치 없이 시각과 새로고침만 둔다. 이전에는 아이콘만, 시각 + 아이콘, 글자로만 적은 자동 갱신 등 다섯 모양이었다.
- **좁은 화면**: `RefreshStatus`는 스위치 옆 글자를 숨긴다(이름은 스위치의 툴팁·aria). 서버·Docker 환경 상세는 복귀 링크와 같은 줄, Docker 서비스 상세는 기간 선택과 같은 줄의 오른쪽 끝에 둔다 — 상태 줄 아래로 흘러 한 줄을 더 쓰던 것을 줄였다. 넓은 화면에서는 새로고침 버튼(40px)이 상태 줄(24px)을 키우지 않게 묶음이 위아래로 8px씩 펼쳐진다(`sm:-my-2`).
- 메뉴(`OverflowMenu`)는 `role="menu"`다. 열면 첫 항목에 포커스가 가고 화살표로 돌며(끝에서 처음으로), Esc·바깥 누름으로 닫힌다. 항목을 고르면 포커스를 먼저 `더보기` 버튼에 두므로, 그 항목이 연 대화 상자가 닫히면 포커스가 버튼으로 돌아온다.

**서비스 상세 헤더 예외 (2026-10-18, 사용자 요청)** — `AgentHealthCheckDetailView`는 `PageHeader.aside`에 기간 선택을 둔다(2026-11-21부터 알림 규칙·에러 확인은 제목 줄, 새로고침은 상태 줄의 `RefreshStatus`). `xl` 이상은 제목·메타데이터의 우측 상단, 그 미만은 메타데이터 다음으로 흐른다. 대상 정보·조회 조작·장애 대응이 한 헤더 띠에 속하며 별도 툴바·전체 폭 장애 배너를 반복하지 않는다. 라벨 있는 `에러 확인` secondary 버튼을 항상 표시하고 기존 로그 탭으로 이동한다. 에러가 없으면 native disabled로 비활성화한다. 새로고침·알림 규칙·에러 확인은 기본적으로 한 행으로 묶고, 공간이 부족하면 기간 선택만 앞줄로 흐른다. 200% 글자 확대처럼 액션 그룹 자체도 한 행에 들어가지 않으면 버튼을 숨기거나 가로로 넘기지 않고 줄바꿈을 허용한다. 별도 박스·원인·마지막 응답·장애 요약은 표시하지 않는다. 모바일에서도 바로가기 라벨을 유지한다. 다른 상세의 `DetailActionToolbar` 배치는 유지한다. `AgentServiceTabs`는 탭과 데이터 본문만 담당한다.

**서버 상세 헤더 예외 (2026-11-18, `ServerHeader`)** — "상세 화면의 헤더는 `PageHeader` + `actions`" 규칙의 예외다. 서버 상세는 탭이 패널을 바꾸므로 머리말이 모든 탭에 걸린다.
- `새로고침`과 `서버 설정`은 서버 이름(h1)과 **같은 줄의 오른쪽**이다(`PageHeader compactActions truncateTitle`). 이름이 길면 이름이 말줄임되고(전체는 툴팁) 버튼은 줄지 않는다. 버튼만 있는 줄이 탭과 본문을 아래로 밀었다.
- 설명(있으면 한 줄) 아래의 상태 줄은 `StatusLight` → 원인 문구 → `그룹 <이름>` → 오른쪽 끝의 `RefreshStatus`(마지막 갱신 시각, 새로고침, `30초마다 자동 갱신` 스위치)다. 좁은 화면에서는 복귀 링크 줄로 올라간다. 원인 문구는 그 대상으로 가는 링크이고, 이미 그 대상을 보고 있으면 같은 높이의 글자다. 그룹 목록을 불러오지 못하면 그룹 항목을 숨긴다.
- **머리말의 높이는 모든 탭에서 같다.** 탭을 바꿔도 탭 줄이 움직이지 않는다. 갱신 중 표시는 새로고침 버튼의 회전이 맡는다(글자를 바꾸면 줄바꿈 위치가 흔들린다).
- **새로고침과 자동 갱신 스위치는 서버 상세의 머리말에 하나씩만 있다.** 열린 패널의 데이터도 함께 다시 불러오고(`refreshToken`), 스위치를 끄면 패널의 주기적 갱신도 멈춘다(`autoRefresh`). 패널 안에 새로고침을 다시 두지 않는다. 서버 목록에는 갱신 시각과 새로고침만 있다(§4.5 "목록 조작의 자리"). Docker 환경·Docker 서비스·그룹 상세와 개요는 2026-11-21부터 같은 `RefreshStatus`로 자동 갱신을 끌 수 있다.

**서버 탭 안의 패널 (2026-11-18)** — 옛 메뉴의 상세 본문(`UptimeMonitorPanel`, `DirectLogsPanel`, `DirectApiPanel`, `DirectMetricsPanel`, `InfrastructurePanel`)이 서버 탭 안에 들어가면서 정한 배치다. 서버 이름이 h1이므로 패널의 대상 이름은 h2다.
- **대상 이름을 h2 한 줄로 두고, 대상에 대한 조작은 그 줄의 오른쪽이다**: `알림 규칙` → `다른 서버로 옮기기` → `수정` → `삭제`(다른 데이터도 보내는 앱은 그 데이터의 연결 해제). "제목 행에 버튼을 두지 않는다"와 `DetailActionToolbar` 규칙의 예외다. 순서(이동 → 편집 → 파괴, 파괴는 맨 끝)와 버튼 모양(`secondary`, 파괴만 `destructive`, `collapseLabel`)은 툴바 규칙 그대로다.
- **상태 전환(`일시정지`, `연결 중지`)은 기존 규칙대로 상태 표시 옆**이다(`DetailMeta` 상태 줄).
- **기간 선택과 보기 전환은 상태 줄의 오른쪽 끝**이다(`DirectConnectionMeta`의 `statusAside`). 좁으면 상태 줄 아래로 흐른다.
- **연결 정보는 접어 둔다.** API Key, 수집 데이터, 연결 방식은 `DetailMeta collapsed`의 `연결 정보`(모니터는 `모니터 정보`)다. 탭 안에서는 본문(차트, 로그, 요청)이 먼저다.
- **인프라 탭은 제목을 화면에서 숨긴다**(`sr-only` h2). 리소스가 서버마다 하나이고 이름이 서버 이름과 같은 경우가 많다. 그래서 조작(`알림 규칙` 등)을 상태 줄의 오른쪽, 기간 선택 뒤에 둔다. 리소스 이름이 서버 이름과 다를 때만 상태 줄에 적는다.
- **상태 줄의 상태는 탭이 계산해서 넘긴다** (2026-11-19). 패널은 상태를 스스로 판정하지 않는다. 앱 패널(`DirectLogsPanel`, `DirectApiPanel`, `DirectMetricsPanel`)은 `appPanelStatus(row, capability, app, stale)`, 인프라 패널은 `infrastructurePanelStatus(resource, stale)`의 결과(`PanelStatus`: `tone`, `label`, `detail?`, `stale`)를 `status` 인자로 받고, `DirectConnectionMeta`가 그린다. 그래서 패널의 상태는 탭의 점, 앱 선택, 개요 탭의 행과 같은 판정과 문구다(§5.4): 메트릭은 임계값을 넘은 지표가 있으면 `임계값 초과`, 이전에 불러온 목록(`stale`)이면 `확인 불가`(중립색)이고 원인과 `마지막 수집` 시각을 숨긴다. 이전에는 패널이 따로 계산해서 임계값을 넘은 앱의 메트릭 패널이 `수집 중`이었다. 업타임 패널은 자기 모니터를 단건 조회해서 상태를 보이고, 그 조회가 실패하면 `확인 불가`다.

### 4.2 `components/charts/` — 차트 스펙

**차트는 `ChartCard` 안에 넣고, 팩토리를 스프레드해서 쓴다. 개별 차트에서 카드 헤더·선 굵기·그리드·축을 다시 정의하지 않는다.**

```tsx
const theme = useChartTheme();                       // 테마 전환 시 다시 그린다
const gradientId = useId().replace(/[^\w-]/g, '');
const { rows, gaps } = splitGaps(data);              // 행마다 t(epoch ms)
<ChartCard title="응답 시간" unit="ms" right={<ChartSummary values={v} unit="ms" />}>
<ResponsiveContainer height={CHART_HEIGHT}>
<ComposedChart data={rows} margin={CHART_MARGIN}>
  {areaGradient(gradientId, color)}
  <CartesianGrid {...gridProps(theme)} />
  <XAxis {...timeXAxisProps(theme, [from, to])} />   // 조회한 창
  <YAxis {...yAxisProps(theme)} {...niceYAxis(max)} />
  {rangeAreas(gaps, theme.tickColor, 0.06)}
  <Area {...areaProps(gradientId)} dataKey="v" />     // 시리즈 1개일 때만
  <Line {...lineProps(color, theme)} dataKey="v" name="…" />
</ComposedChart>
</ResponsiveContainer>
</ChartCard>
```

**차트 카드 표준 구조 (2026-09-25)** — 메뉴마다 제목 크기·여백·숫자 요약·범례·높이·빈 상태가 제각각이던 것을 `ChartCard` 하나로 고정했다. 캔버스 ⑦에 해부도가 있다.

**머리 줄 높이는 40px 하나다** (2026-11-21). `ChartCard`의 제목 줄은 `min-h-10 items-center`라 오른쪽 조작(기간 선택 40px)이 있든 없든, 좁은 폭에서 오른쪽 값이 다음 줄로 내려가든 제목이 카드 위에서 같은 거리(카드 패딩 24 + 8)에 선다. 이전에는 `items-baseline min-h-6`이라 조작이 있는 카드만 제목이 8px 내려가, 같은 탭에 나란히 놓인 카드의 제목 선이 어긋났다.

**제목 아래 설명은 머리에 속한다** (2026-11-21, P6). 코어 수·용량(인프라), 원본 메트릭 이름(메트릭 단독 보기)처럼 제목 아래 한 줄은 `ChartCard`의 `description`이다. 제목 줄 → 설명 4px(`intra`), 머리 → 본문 16px(`heading`)이다. 이전에는 본문 첫 줄을 `-mt-2`로 제목 쪽에 끌어올려 머리 → 본문이 8px로 보였다.

1. **제목 + 단위** — 왼쪽. `type-card-title` + `type-caption text-text-dim`. 제목은 한국어, 기술 용어는 영어(`CPU`·`메모리`·`디스크`·`네트워크`). 메트릭 이름처럼 식별자인 제목만 `font-mono text-sm`
2. **오른쪽 칸 — 하나만** — 요약(`ChartSummary` 현재·평균·최대, 이미 계산된 값은 `ChartStats`) · 상태(`StatusLight`) + 요약 · 범례 칩(`ChartLegend`) · 기간 선택 중 하나
3. **지표 타일** — 한 대상의 지표가 여럿이고 동시에 볼 필요가 없을 때만(요청 추이). 인프라는 네 추이를 동시에 보는 편이 낫다고 판단해 2×2를 유지했다
4. **캡션 줄** — 타일 카드에서만: 단위 · 범례 칩. 메트릭 탐색은 histogram 단독 보기에서 분포 줄(아래 "메트릭 탐색")
5. **차트** — `CHART_HEIGHT` 220px. 목록 위에 붙는 막대 띠(로그 발생량)만 `CHART_STRIP_HEIGHT` 120px
6. **빈 상태 · 로딩** — `ChartEmpty`("이 기간에 데이터 없음") · `ChartSkeleton`, 둘 다 차트 높이. 예외: 요청 추이는 데이터가 없으면 카드 자체를 숨긴다 — 바로 아래 요청 목록이 수집 설정 안내를 보여 주므로 빈 카드는 소음이다

요청 화면의 **서비스 전체 추이**는 대상과 기간을 기준으로 한다. 아래 요청 결과의 경로·오류·trace 필터는 적용하지 않는다고 표시한다. 검색 결과 수는 목록 헤더에 두고, 현재 페이지의 오류 수·평균을 별도 KPI 카드로 반복하지 않는다. p95 타일은 마지막 유효 측정 구간의 값과 시각을 함께 표시한다. 조회 실패는 재시도를, 집계 한도 초과는 기간을 줄이라는 안내를 보여 준다. 제한된 시계열을 전체 기간의 통계나 실제 0건 구간으로 그리지 않는다.

서버의 API 요청 탭은 수집 허용 상태와 실제 trace 수신을 구분한다. API 제외 경로 편집은 결과 아래에서 기본 접힘으로 제공한다. (2026-11-18까지 있던 API 대상 목록의 6시간 요청 수·5xx 비교와 `5xx 최다 경로` 열은 메뉴와 함께 없어졌다. 서버 간 비교는 서버 목록이 맡는다.)

카드 여백은 `p-6` 하나. 차트 아래 표·설명 문장은 두지 않는다 — 메트릭 탐색 단독 보기의 시리즈 표(시리즈 2개 이상일 때)와 데이터가 잘렸다는 경고만 예외. 조작 안내("막대를 누르면…")는 `ChartTooltip`의 `footer`로 포인터가 있는 자리에 둔다.

| export | 역할 |
|--------|------|
| `useChartTheme()` | CSS var를 읽어 `{gridColor, tickColor, surfaceColor, primaryColor, errorColor, warnColor}`(`surfaceColor`는 누적 막대 사이 헤어라인과 활성 점 테두리, `errorColor`·`warnColor`는 상태 채움 §1.4). `<html>.dark` 변경을 구독한다 — 렌더 시점에 한 번 읽는 방식은 테마를 바꿔도 라이트 색이 남았다 |
| `gridProps` `xAxisProps` `yAxisProps` `tooltipCursor` | 축·그리드 |
| `timeXAxisProps` `timeTicks` `formatTimeTick` `formatTimeLabel` | 숫자 시간축 — 정시 눈금, 24시간제, 툴팁 제목에 날짜 |
| `niceYAxis` `niceTicks` | Y축 눈금 1·2·2.5·5×10ⁿ (0·25·50·75·100) |
| `splitGaps` `fillBuckets` | 공백·빈 버킷 |
| `rangeAreas` `thresholdLines` `areaGradient` `OPERATOR_LABEL` | 공백 음영(라벨 없음), 알림 임계값 점선, 채움 그라데이션, 임계값 연산자 기호 |
| `lineProps(color, theme)` `areaProps(gradientId)` | 시리즈 |
| `SERIES_HEX` `getSeriesPalette` | 색 |
| `ChartCard` `ChartEmpty` `ChartSkeleton` `CHART_HEIGHT` `CHART_STRIP_HEIGHT` `CHART_MARGIN` | 카드 틀 · 빈 상태 · 로딩 · 높이 · 여백(위 8px — niceYAxis의 맨 위 눈금 라벨이 플롯 위 끝에 걸려, 4px이면 윗부분이 잘렸다) |
| `formatAxisValue` `formatMetricValue` `metricDisplayUnit` | 포맷 · OTel 단위 → 표시 단위 환산 |
| `ChartTooltip` `ChartSummary` `ChartStats` `ChartStatsLegend` `ChartLegend` | 툴팁·요약·범례 |
| `Sparkline` | 축 없는 32px 추세선(그룹 상세의 인프라 게이지). 장식이라 `aria-hidden` + `accessibilityLayer={false}`. 값만 받으므로 시간 위치가 중요한 자리에는 쓰지 않는다 |

**룩 (Grafana풍 2026-07-10 확정, 2026-09-24 개정)**
- 1.5px `monotoneX` 라인, 둥근 캡, dot 없음. monotoneX는 모든 표본점을 정확히 지나고 점 사이에서 튀어나가지 않는다. 2026-09-24에 잠깐 직선(`linear`)으로 바꿨다가 되돌렸다 — 30분 간격처럼 성긴 표본에서 각진 꺾은선이 되어 *"초등학생이 그린 것 같다"*는 피드백을 받았다
- 라인 아래 채움은 **위 18% → 바닥 0% 그라데이션**(`areaGradient`), **시리즈가 1개일 때만**. 평면 10% 채움은 값이 높을수록 차트 전체를 덮는 파란 판이 됐고, 시리즈가 2개 이상이면 채움이 겹쳐 탁해진다(Read 파랑 + Write 주황 = 갈색)
- 수평 실선 그리드만 (`vertical: false`, opacity 0.55)
- medium 12px 눈금, 축선·틱선 없음
- **애니메이션 없음** (`isAnimationActive: false`)
- activeDot = r4 + **표면색** 테두리 2px (흰색 고정은 다크 카드에서 번쩍인다)

**데이터를 정직하게 그리는 규칙 (2026-09-24)**
- **X축은 숫자 시간축이다.** 문자열 라벨(카테고리) 축은 행을 균등 간격으로 늘어놓아 수집이 끊긴 두 시간을 한 시간 반과 같은 폭으로 그렸다. 도메인은 데이터 범위가 아니라 **조회한 창**이다 — 1시간치만 있으면 6시간 창의 나머지는 비어 보여야 한다
- **공백은 선을 끊고 음영으로 표시한다** (`splitGaps` → `connectNulls: false` + `rangeAreas`). 여러 시리즈의 타임스탬프가 조금씩 어긋나는 OTel 메트릭만 예외로 선을 잇고 음영만 둔다
- **건수 차트의 빈 버킷은 0이다** (`fillBuckets`) — 서버는 데이터가 있는 버킷만 준다. 반대로 지연·에러율처럼 건수가 0이면 값이 없는 지표는 null로 비운다
- **업타임 응답 시간은 성공한 체크의 평균이다.** 실패한 체크의 대기 시간을 응답 시간이나 0ms로 그리지 않는다. 실패 횟수와 장애 구간은 응답 선과 함께 구분해 표시한다. 백엔드 버킷 평균도 성공한 체크만 집계한다
- **구간 표시(음영·띠)에 글자 라벨을 달지 않는다.** 좁은 띠 위의 빨간 "다운" 글씨는 스티커처럼 떠 보였다. 무엇인지는 카드 제목 줄의 `StatusLight`(● 실패 2회)가 한 번 말한다
- **이중축 금지.** 요청 수 + 에러율(0–100% 고정 오른쪽 축)에서 에러율 5% 스파이크가 바닥에 깔려 보이지 않았다. 단위가 다른 지표를 한 카드에 둘 때는 둘 중 하나다:
  - **지표 타일 + 차트 1개** (요청 추이, 2026-09-25) — 카드 위 타일(`요청 수 1,530건 │ 에러율 0.5% │ 지연 시간 p95 121ms`)을 누르면 아래 차트가 그 지표로 바뀐다. 타일은 `aria-pressed` 버튼 그룹(`SegmentedControl`과 같은 이유로 ARIA 탭이 아니다), 선택은 `border-primary` + 안쪽 링. 툴팁은 어느 지표를 그리든 그 버킷의 모든 값을 보여준다(행마다 `unit`). 요청 수 막대는 에러를 빨간색으로 쌓아 기본 화면에서 요청량과 에러가 함께 보인다. 차트 높이는 지표를 바꿔도 같다. 세 패널을 위아래로 쌓은 이전 방식은 *"보기 어렵다"*는 피드백으로 바꿨다
  - **패널 분리 + `syncId`** — 여러 지표를 동시에 봐야 하는 자리(인프라 추세 4종, 메트릭 탐색 격자)
- **나란한 차트는 크로스헤어를 공유한다** (`syncId`). 툴팁 상자는 마우스가 있는 차트에만 띄운다
- **지연 백분위는 p50 primary · p95 emerald · p99 amber** (요청 추이, 2026-09-30) — 팔레트 앞 3슬롯 순서라 색각이상에서도 갈린다. p99는 꼬리 지연, 장애 전조가 가장 먼저 보이는 선이다
- **지난주 같은 시간은 회색 점선이다** (`tickColor`, `strokeDasharray="4 3"`, 요청 추이 2026-09-30) — 지금 그리는 지표의 7일 전 값(지연은 p99)을 겹친다. 알림을 넘지 않고 서서히 나빠진 것을 드러내는 선이다. 범례 칩 `지난주`(지연은 `p99 · 지난주`), 툴팁에 한 줄. 7일 전 데이터가 없으면 선도 칩도 없다
- **배포는 세로 실선이다** (`SERIES_HEX.violet` 1.5px, 라벨 없음, 요청 추이 2026-09-30) — "배포 전이냐 후냐"를 한눈에 가르는 선. 무엇이 바뀌었는지는 그 버킷 툴팁의 `footer`가 말한다(`17:47 api · 배포 api:1.4.1 → api:1.4.2`, 이미지가 같으면 `재시작`) — 선이 가늘어 따로 hover할 수 없다. 범례 칩 `배포`. Docker 서비스만 — Direct 서비스는 배포를 알 수 없다
- **알림 임계값은 점선이다** (`thresholdLines`). 대상에 걸린 규칙만 — 전역 규칙은 어느 차트에서 왔는지 말할 수 없다. 단위가 맞는 차트에만 긋는다(인프라의 CPU·메모리·디스크 차트는 규칙과 같은 사용률 %라 긋고, 네트워크(MB/s)에는 규칙이 없다). Y 스케일에 임계값을 포함해 데이터보다 높아도 보이게 한다
- **새로고침은 이전 차트를 유지한다.** 스켈레톤은 첫 로드와 보는 대상이 바뀔 때만

**범례**
- **시리즈 1개** → 범례 없음(제목이 곧 범례). 통계는 카드 제목 줄 오른쪽 `ChartSummary` — `현재 105 · 평균 116 · 최대 149 ms`
- **시리즈 2개 이상** → 제목 줄 오른쪽 범례 칩(`ChartLegend`). 시리즈별 통계 표(`ChartStatsLegend`)는 메트릭 탐색 단독 보기에서 시리즈가 2개 이상일 때만 — 칩 대신 차트 아래 왼쪽에 붙는 좁은 표로. 격자 패널은 칩이다. 카드 폭 전체로 펼친 표는 숫자가 시리즈 이름에서 멀어져 읽히지 않았다
- 차트 아래에 설명 문장을 붙이지 않는다 — 말해야 할 사실(실패 횟수)은 제목 줄로 올린다
- 바 차트 헤더 → `ChartLegend` (칩) — 로그 히스토그램은 레벨별 건수를 함께 쓴다. 지표 타일 차트도 시리즈 이름은 차트 위 칩이다(통계는 타일이 맡는다 — 지표를 바꿀 때 아래 표가 생겼다 사라지며 높이가 흔들리지 않게)
- recharts `<Legend>` **사용 금지**

**메트릭 탐색 (`AgentServiceMetricsTab`, 2026-09-26, 2026-11-03·11-06 보완)** — 한 차트를 보려고 눈이 여섯 곳을 오간다는 피드백(*"정보가 너무 흩어져 있다"*)으로 고쳤다.
- **메트릭을 이름순 격자로 그린다** (Grafana 대시보드처럼 `lg` 이상 2열, 인프라 추세와 같은 틀). 메트릭을 하나씩 고르는 방식은 두 번 바꿨다 — 차트 아래 표는 고르면 화면 밖 차트가 바뀌었고, 왼쪽 레일은 *"한눈에 들어오지 않는다"*는 피드백을 받았다. 패널은 크로스헤어를 시간값으로 공유하고(`syncId` + `syncMethod="value"` — 메트릭마다 행 배열이 달라 index 동기화가 어긋난다) 툴팁은 마우스가 있는 패널에만. 키보드는 차트마다 Tab 한 번(`useChartKeyboard`, 인프라 추세와 같다) — 좌우 방향키·Home·End로 고른 시점은 그 패널의 점선과 차트 아래 `aria-live` 값 줄로 읽는다(툴팁은 마우스 전용이라 키보드 값이 보이지 않았다, 2026-11-12). 격자는 의미별 섹션(`요청과 응답`·`작업과 메시지`·`런타임과 리소스`·`사용자 정의 지표`, `metricGroup`)으로 나누고 **섹션 안은 이름순**이다 — API는 마지막 수신순이라 새로고침마다 격자가 뒤섞였다. 섹션 순서 → 이름순으로 정렬한 **뒤에** 12개를 자른다 — 이름순으로 먼저 자르면 `app.*` 같은 사용자 정의 지표가 `요청과 응답`을 밀어냈다(2026-11-12). 사용자가 고정한 지표(최대 4개, 브라우저에 저장)는 맨 위 `고정한 지표` 섹션에 둔다. 메트릭이 하나라도 있으면 위에 검색창(이름·설명, 접근 이름은 안내 문구와 같다). 처음 12개 패널만 조회하고 `메트릭 12개 더 보기`로 추가한다. 고정한 지표는 12개 한도와 관계없이 항상 그린다
- **패널 제목을 누르면 그 메트릭만 크게 본다** (`?metric=`, Grafana의 View panel). 분포 줄·느린 예시·시리즈별 통계 표는 여기에만 둔다 — 격자 패널마다 붙이면 높이가 제각각이 된다. 브라우저 뒤로가기가 격자로 돌아오고, `← 전체 메트릭`은 history를 replace해 뒤로가기가 단독 보기를 다시 열지 않는다
- **값은 표시 단위로 먼저 환산한다** (`metricDisplayUnit`). OTel은 s·By로 보낸다 — 그대로면 `0.05s`와 `95.4MB · 190.7MB` 눈금(10진 nice tick을 2진으로 찍음)이 된다. 환산 후 눈금·통계·툴팁·임계값이 모두 같은 단위이고, 단위는 제목 옆 캡션에만 쓴다(`gauge, MB`). `1`과 `{request}`는 단위가 아니라 비운다
- **histogram 선은 수신 포인트의 평균이다** — 캡션에 `histogram, 수신 평균, ms`라고 쓴다. p50·p95·p99는 선택한 시리즈의 조회 기간 분포라 선에서 찾을 수 없는 값이다. 제목 줄 대신 **"선택한 시리즈의 기간 분포" 서브블록**에 두고, 느린 예시(exemplar) 버튼도 같은 줄에 묶는다
- **메트릭 패널의 머리는 다른 직접 연결 패널(로그·API 요청·인프라)과 같다** — 2026-11-04에는 API Key·그룹·수집 데이터를 펼친 속성 목록이었다("연결 관리" 접힘은 메뉴마다 헤더가 달라 보인다는 피드백으로 없앴다). 2026-11-18부터는 서버의 메트릭 탭 안이라 §4.1 "서버 탭 안의 패널"을 따른다: 앱 이름 h2와 조작 한 줄, 상태 줄, 접힌 `연결 정보`. 상태는 서버 탭이 넘긴 상태다(§4.1 서버 탭 안의 패널, §5.4). 본문 수집 현황 줄은 `N개 지표`만 남긴다. 한 번도 받지 않은 앱은 `메트릭 수신 대기` + 내보내기 주기 안내 + `설정 다시 받기`(키 재발급)다(2026-11-12).
- **단독 보기의 정보는 차트 가까이에 둔다** — 종류·표시 단위는 제목 옆, 해당 메트릭의 마지막 수신과 조회 구간은 차트 위 메타 줄이다. 제목은 격자 패널과 같은 표시 이름이고 원본 이름은 그 아래 mono 줄이다(패널을 눌러 제목이 바뀌면 같은 지표인지 다시 확인하게 된다, 2026-11-12). 긴 이름은 `ChartCard.wrapTitle`·`break-all`로 줄바꿈해 전부 읽게 한다. 조회 구간은 표시 중인 차트의 성공한 조회 창을 따른다.
- **조회 조건과 조회 창** — 메트릭 패널(서버의 메트릭 탭)의 `range`, 메트릭 검색 `metricSearch`, 선택 메트릭 `metric`을 URL로 복원한다. 모든 차트와 분포는 같은 `from`·`to`를 쓰며, 기간 변경·새로고침 때 창을 다시 잡는다. 검색·단독 보기 전환·개별 재시도는 창을 바꾸지 않는다. 새로고침 중에는 이전 차트와 그 조회 구간을 유지한다.
- **attribute의 전체 이름을 보존한다** — `http.method`와 `rpc.method`를 모두 `method`로 줄이지 않는다. 표시 이름은 전체 key와 JSON 형식의 값이며, 시리즈 식별자는 key 순서와 관계없는 attribute 조합이다. 차트 data key는 별도로 둔다. 격자는 범례를 줄바꿈하고, 단독 보기의 통계 표는 좁은 화면에서 표 안에서만 가로 스크롤한다.
- **단독 보기의 탐색 조건** — 차트 카드 안, 제목 아래 한 줄이다: `원값 / 초당 증가량` 전환(계산 기준은 옆 정보 아이콘의 툴팁), `Attribute 필터 (N)`·`시리즈 선택 (6/8)` 버튼, 적용한 필터 칩, 초기화. 필터 입력과 시리즈 목록은 버튼을 누르면 그 줄 아래로 펼친다(기본 접힘, 한 번에 하나). 차트 앞의 별도 카드(약 210px)는 1440×900에서 차트를 첫 화면 밖으로 밀었고 조건과 결과가 떨어져 있었다(2026-11-12). 값 타입을 보존한 완전 일치 필터(최대 8개)와 최대 6개 시리즈 선택을 차트·분포에 함께 적용한다. resource·instrumentation scope가 다른 새 수신 스트림은 같은 attribute라도 분리하고 인스턴스·scope 및 스트림 식별자를 라벨에 표시한다. `metricAttributes`, `metricSeries`, `metricMode`를 URL로 복원한다. 조건을 바꿀 때는 이전 차트를 새 조건의 결과처럼 표시하지 않는다.
- **격자 순서는 상태로 바꾸지 않고, 확인할 것은 위에 모은다** (2026-11-04, *"디테일을 눌러야 보인다"* 피드백) — 패널 제목 줄에 `StatusLight`로 상태를 띄우고, 같은 상태를 격자 위 `확인 필요` 목록에 메트릭 버튼으로 모은다 — 패널을 상태순으로 재배치하면 순서의 안정성을 잃는다. **`확인 필요`는 서버의 health API(`otel-metrics/health`)가 전체 메트릭의 최신 시리즈를 검사한 결과다**(2026-11-06) — 이전에는 그려진 12개 패널만 집계해 13번째 이후의 문제가 빠졌다. 상태는 `임계값 초과`(최근 5분 측정값의 원값이 대상 규칙을 넘음, 알림 발화와는 다르다 — 쿨다운·dedup이 있다), `타입·단위 충돌`, 수신 상태(`5분 이상 수신 없음`·`측정 지연`·`측정 시각 확인 필요`·`수신 시각 미확인`)다. **수신은 서버 도착 시각(`receivedAt`), 측정은 OTLP 시각이다** — 둘을 섞으면 늦게 도착한 오래된 측정값이 '방금 수신'처럼 보인다. 이 기록 이전의 행은 수신 시각을 추정하지 않고 `수신 시각 미확인`으로 둔다. 같은 이름에 타입·단위가 여러 개면 단독 보기에서 하나를 고르게 한다(`?metric=`과 함께 타입·단위를 URL에 남긴다). 다중 시리즈 칩에는 시리즈별 최근값을 붙인다(`worker-6 1/s`)
- **초당 증가량** — sum은 격자와 단독 보기 모두 초당 증가량이 기본이다(누적 카운터는 오르기만 해서 원값 선이 정보를 주지 않는다). 계산할 수 없는 sum(UpDownCounter, 시작 시각 없음)은 원값으로 돌아간다. 단독 보기에서 원값과 전환하며, 고른 값은 `metricMode`로 URL에 남는다. monotonic·temporality·시작 시각이 확인된 포인트만 계산하며, 누락·재시작·겹침은 공백이다. 값의 단위에는 `/s`를 붙이고 원값 임계선을 그리지 않는다. gauge·histogram에 증가율을 적용하지 않는다.
- **조회 한도** — 시리즈 목록 200개, 선택한 시리즈 포인트 5,000개, 분포 포인트 50,000개. 한도 초과를 응답으로 구분해 표시한다. 분포 한도를 넘으면 부분 분포 수치를 표시하지 않는다. 기간·Attribute 필터를 좁히거나 시리즈 선택을 바꿀 수 있게 한다.

**업타임 응답 시간 (`ResponseTimeCard`, 2026-11-08)** — 모니터 상세와 Docker 서비스 업타임 탭이 같은 선 그래프를 쓴다.
- **선택 기간 평균**을 큰 숫자로 표시하고 실제 체크 수·실패 수를 보조 정보로 둔다. 평균은 성공한 체크 수로 가중한다. 버킷 평균에서 원시 최대값이나 p95를 추정하지 않는다.
- `ResponsiveContainer → ComposedChart` 안에서 축·선·커서·툴팁·장애 배경을 함께 렌더링한다. 선은 공용 `lineProps`의 `monotoneX`·1.5px·둥근 캡을 사용한다. 고립된 성공 버킷은 점으로 표시한다.
- **전체 실패·미수집 버킷은 선을 끊는다.** 성공한 0ms는 유효한 값이다. 모든 체크가 실패하면 평균은 `—`로 표시하고 성공 응답이 없다는 안내를 둔다.
- 서버가 확인한 장애 구간만 옅은 오류색 배경으로 표시한다. 장애 배경 밖의 실패 버킷은 플롯 위쪽의 짧은 표시로 구분한다. 미수집은 장애로 추정하지 않는다.
- 조회 범위를 실제 시간축으로 유지하고 누락 버킷을 null로 채운다. Y축은 성공 평균값의 범위에 여유와 최소 표시 폭을 둬 작은 변화를 과장하지 않는다. 화면 범위 안의 알림 임계값은 점선으로 표시하며, 범위 밖의 값도 텍스트로 안내한다.
- Tab 한 번으로 차트에 진입하고 좌우 방향키로 버킷을 옮긴다. 포인터와 키보드 모두 같은 툴팁에서 날짜·구간·평균 응답·체크/실패 수를 읽는다. 미수집 툴팁은 `수집 데이터 없음`으로 구분한다. 카드 아래에는 조회 기간과 시간대를 표시한다.
- 모니터 상세에는 별도 체크 기록 표를 두지 않는다. 최신 체크는 현재 상태 요약에서, 장기 기록은 장애 이력에서 확인한다.
- **응답 시간 범위**는 `1H · 6H · 24H`, 기본 `6H`다. 각각 2분·5분·20분 평균이다. 첫 조회 실패에서도 범위 선택과 재시도를 유지하며, 자동 갱신 실패 시 마지막 차트를 유지한다. 기간 변경 시 이전 기간의 데이터를 새 범위로 표시하지 않는다.
- **장애 이력**(모니터 상세)은 업타임 현황 카드 안, 90일 띠 바로 아래에 붙는 보조 표다(2026-10-28 — 별도 카드에서 옮김). 두 종류를 시간순으로 섞는다: 장애(연속 실패가 환경설정 기준을 넘은 구간, `장애 진행 중` 오류 · `장애 복구` 정상, 지속 시간 있음)와 장애로 이어지지 않은 실패 체크(`실패` 주의, 지속 시간 `-`, `GET /services/:id/failures` — 장애 구간과 그 장애를 연 연속 실패는 서버가 뺀다). 열은 상태 · 시각 · 지속 시간 · 메시지, `전체 · 장애 · 실패` 구분(`SegmentedControl`), 10행 뒤는 `N개 더 보기`. 90일 띠의 날짜를 누르거나 Enter로 고르면 그날 이력만 남고(`aria-current="date"`, 링), 표 제목 옆 날짜 버튼으로 해제한다
- 모니터 헤더 메타에 HTTP는 `기대 상태 코드`(폼과 같은 이름 — `Expected status`는 라벨 칸에서 두 줄로 접혔다)를, 모든 모니터는 `마지막 확인`을 더한다. 인증서 만료는 메타가 아니라 업타임 현황의 네 번째 수치다(HTTPS만, `D-83`) — 14일 이하 `text-status-warn`, 지나면 `만료됨` + `text-status-error`, 색은 넘은 경우에만 싣는다(§5.3)
- **업타임 현황**(`UptimeOverview`)은 제목 없이 큰 수치 한 줄(`text-2xl`, 사이 구분선) + 지난 90일 띠(`일부 실패 N일, 전체 실패 N일`). 프로젝트 상세에서도 카드 사이에 놓이므로 카드 테두리는 유지한다. 모니터 상세의 수치는 `24시간 업타임 · 30일 업타임 · 평균 응답 (24시간)`에 HTTPS면 `인증서 만료`(`마지막 확인`은 큰 수치로 읽을 정보가 아니라 헤더 메타로 내렸다, 2026-10-28)이고, 90일 업타임은 타일이 아니라 띠 머리글(`지난 90일 · 99.98%`, `historyUptime`)에 둔다 — 타일로 두면 바로 아래 띠와 같은 것을 두 번 말한다(2026-10-26). Docker 서비스 상세도 같은 묶음과 순서다(`uptimeKpis`, §4.7 대상 상세의 틀, 2026-11-21)

**로그 요약 (`LogServiceOverview`, 2026-09-27 — Grafana Logs Drilldown·Sentry Issues 참고)** — 2026-11-18부터 전체 로그(`LogsPage`)와 서버의 로그 탭 첫 화면이 같은 본문을 쓴다(로그 탭은 그 서버의 앱만). 질문은 "지금 이상이 있는가"이고 창은 24시간 하나다.
- **앱 카드**: 오류·경고 건수(라벨은 표 보기와 같은 한국어) → 시간대별 오류·경고 막대(HTML, 24칸) → 한 줄(가장 최근 오류, 없으면 경고 — 레벨 토큰 + mono 메시지 + 상대 시각). 오류가 많은 순으로 정렬한다
- **추세 배지를 달지 않는다** — 막대가 추세를 말한다. 게이지 카드와 같은 이유다(아래)
- **막대 척도는 카드마다지만 바닥이 10건이다.** 하루 경고 3건이 카드 높이를 꽉 채우자 급증처럼 읽혔다
- **창 안에 수신한 로그가 하나도 없으면 건수는 `-`, 상태는 `수집 지연`**(수신 기록이 없으면 `수신 대기`)이다. 0건은 "이상 없음"이 아니라 "모름"이고, 문구도 "오류·경고 없음"이라 하지 않고 마지막 수신 시각만 말한다. 상태는 `CollectionStatusBadge`(수신 시각 = 서버 `signal_receipts`)
- **자주 발생한 오류·경고**: 숫자·ID만 다른 메시지를 하나로 센 목록(오류 먼저, 건수순). 처음 발생이 창 안이면 `새로 발생 2시간 전`을 `font-medium`으로 — 배지로 만들지 않는다(§5.1b). 행을 누르면 그 서비스 로그가 `?range=24h&pattern=`로 열리고, 필터는 `같은 패턴만` 칩으로 해제한다. 오류가 하나도 없으면 섹션째 숨긴다

**KPI 게이지 카드 (`InfraGauges`)** — 그룹 상세의 호스트 요약에만 쓴다. 색은 임계값(85%)을 넘은 카드에만 싣는다. 비율 지표(CPU·네트워크)는 6시간 스파크라인, 용량 지표(메모리·디스크)는 막대. 값은 목록·차트와 같은 소수 한 자리. 라벨은 차트 제목과 같은 한국어다(`CPU`만 영어). 추세 배지·상태 pill·색 막대를 한 카드에 겹치지 않는다(§9-12의 3중 강조와 같은 문제).

**서버의 인프라 탭(`InfrastructurePanel`)·Docker 환경 인프라 탭 (2026-11-11)** — 게이지 줄 없이 2×2 추세(`InfraTrends`)만 둔다. 게이지가 아래 차트의 "현재"를 한 번 더 말했고, 스파크라인은 기간 선택과 무관하게 6시간이라 24H에서 두 선의 범위가 달랐다. 대신 사용률 차트 머리에 `주의`(70%↑)·`위험`(85%↑) `StatusLight`를, 제목 아래 보조 줄에 용량(`27.1 GB / 32.0 GB`)·코어 수를 둔다(모르는 값은 줄째 뺀다). 조회 실패는 `EmptyState` + 다시 시도, 한 번도 수신하지 않은 호스트는 `Collector 수신 대기` + 설정 다시 받기(키 재발급) — 빈 차트로 그리지 않는다. 차트는 Tab으로 들어가 좌우·Home·End로 시점을 고르면 점선과 그 시점 값을 차트 아래 글로 읽는다(Recharts `accessibilityLayer`는 시간 X축에서 방향키가 먹지 않는다).

**~~인프라 목록 (2026-11-11)~~ → 서버 목록 (2026-11-18)** — 인프라 목록은 메뉴와 함께 없어졌다. 당시 규칙은 가장 높은 사용률 순 정렬, 숫자 + 가는 막대, 색은 `주의`(70%↑, `status-warn`)·`위험`(85%↑, `status-error`)만이었다. 사용률의 선은 화면용이며 알림 임계값과 별개라는 점(`features/infra/usage.ts`)과 70% 미만을 칠하지 않는 점은 남았다. 서버 목록의 CPU·메모리 칸은 `WARNING_PCT`(70%) 이상만 `status-warn` 글자로 칠하고(§4.5 서버 목록), 인프라 차트 머리의 `주의`·`위험`은 위와 같다.

### 4.3 `components/layout/`

`MainLayout`(셸) · `Sidebar`(lg+) · `Header`(모바일) · `BottomNavMobile` · `Footer` · `CommandPalette`(⌘K/Ctrl+K) · `DemoBanner`

### 4.4 기타

`components/error/`(ErrorBoundary·ErrorFallback) · `components/feedback/NetworkStatusBanner` · `components/skeleton/Skeleton` · `components/icons/`(ChannelIcons·SidebarIcons)

### 4.5 표 (2026-10-09)

대상 비교 목록은 공용 `ResourceTable`을 쓴다. 정렬·페이지·고정 작업 열이 있는 알림 데스크톱 표와 로그·트레이스 표는 아래 마크업 규약을 따른다. 두 종류다.

**데이터 표** — 목록 하나를 통째로 보여 주는 표(알림 규칙·채널·발송 이력, 트레이스). 카드 셸 없이 페이지에 바로 놓는다(§3.1).

API 요청 경로에서 사이드패널을 여는 액션은 경로와 오른쪽 화살표를 하나의 `Button text`에 함께 표시한다. 버튼의 hover 채움 없이 경로에만 밑줄을 표시하며, 키보드 포커스에서도 같은 밑줄을 표시한다. `aria-haspopup="dialog"`와 접근 가능한 이름으로 목적을 알린다. 긴 경로는 말줄임하고 전체 경로를 공통 툴팁과 접근 가능한 이름에 유지한다. trace ID가 없는 경로에는 액션을 표시하지 않는다.

| 부분 | 클래스 |
|------|--------|
| 헤더 행 | 배경 없이 `border-b border-ui-border-soft` 한 줄 |
| 헤더 셀 | `px-4 py-3 text-left text-xs font-medium text-text-muted` |
| 본문 셀 | `px-4 py-2.5`, 행 사이 구분선 없음(§3.1) |
| 숫자·시간 열 | 헤더와 셀 모두 `text-right`, 셀은 `tabular-nums` |
| 상세로 이동하는 행 | `hover:bg-ui-hover-soft`(§3.6 — 배지 대비 유지), `data-row-link` 제목 링크와 `tableRowLinkHandlers`. 행 빈 공간도 같은 링크로 이동 |
| 넓은 표 | `overflow-x-auto` 안에 `min-w-[…] table-fixed`. 작업 열은 `sticky right-0`에 행과 같은 배경(세로선 없음) |

본문 글자는 `text-sm`, 로그·트레이스처럼 기계 문자열이 주인 표는 `text-xs`(§2.2).

헤더는 배경을 쓰지 않는다. 행 hover는 배지·본문 대비를 유지하도록 기존 `ui-hover-soft`로 둔다. 상세 행의 기본 클릭은 제목의 실제 링크로 전달해 Router state와 복귀 경로를 보존하고, Ctrl/Meta/중간 클릭은 같은 URL을 새 탭에서 연다. 키보드는 같은 제목 링크를 사용하며, 행을 별도 버튼으로 바꾸거나 중복 Tab 지점을 추가하지 않는다. 행 안의 링크·버튼·토글·입력·summary와 텍스트 선택은 행 이동을 실행하지 않는다. `table-row-link`는 비활성 버튼도 클릭 대상으로 유지해 `pointer-events:none` 때문에 클릭이 행에 전달되는 것을 막는다. 상세 목적지가 없는 행은 이동 가능한 커서를 표시하지 않는다.

**목록 보기 (2026-10-18, 대상 화면은 2026-11-18 기준)** — 서버의 업타임 탭(모니터가 둘 이상일 때)과 로그 탭, 전체 로그, Docker 환경, 그룹, 알림의 기본은 그리드(비교 표)다. 환경 상세의 서비스 목록과 그룹 상세의 구성 목록도 같다. **서버 목록은 그리드만 있고 보기 전환이 없다.** 목록 툴바 오른쪽의 `ListViewToggle`로 카드를 선택하며, `useListView`가 `view=card`를 URL에 보존한다. 기본값과 알 수 없는 값은 그리드다. 보기만 바꿀 때 검색·탭·대상 필터를 지우지 않고, 두 보기는 같은 데이터·순서·작업을 사용한다. 개요 상태판·상세 차트·설정 폼에는 적용하지 않는다.

`ResourceTable`의 셀은 `px-4`, 본문은 `py-4`다. **표는 `table-bleed`(셀 가로 패딩만큼 바깥으로 펼침)로 글자를 본문 정렬선에 맞춘다** (2026-11-20). 테두리 없는 표(§3.1)에서는 셀 패딩이 보이지 않아 글자 열이 정렬선이 되는데, 제목·툴바(데스크톱 x=264, 모바일 16)보다 16px(모바일 12px) 안쪽에서 시작해 정렬선이 둘이었다. hover 채움과 머리 아래 선은 정렬선 밖으로 16px 나간다. 수제 표(알림, 트레이스, API 요청, 업타임 모니터)와 표처럼 hover 행을 쓰는 목록(로그의 반복 패턴)도 셀 가로 패딩을 `px-4`로 두고 같은 유틸리티를 쓴다. 모바일에서는 보조 열을 숨기고 필요한 수치·수집 상태를 대상 이름 아래로 모아 페이지의 가로 넘침을 막는다. Project의 배정·해제·수정은 행의 `구성 관리`로 펼치며, 설치 대기 Docker 환경의 명령·키·비활성화는 `설치·작업`에서 연다. 카드 선택 시에는 기존 대상 카드의 반응형 열 수를 따른다.

**서버 목록** (2026-11-18, `ServersPage`·`ServerTable`) — 서버를 나란히 비교하는 그리드다.
- **열**: `서버 | 상태 | CPU | 메모리 | 업타임 24시간 | 오류 로그 24시간`. "수집 중인 기능" 열은 두지 않는다. 수치 칸과 같은 말을 되풀이하고, 한 줄에 가운뎃점이 여럿 생긴다(§2.5). **이름 열은 폭을 정하고(`@3xl` 256px, `@5xl` 288px) 남는 폭은 상태 열이 받는다** (2026-11-20). 이름 열이 남는 폭을 모두 받던 때는 1340px 화면에서 570px가 되어, 이름에서 상태까지 빈 공간을 건너야 했다.
- **행은 두 줄이다** (2026-11-20): 이름 아래 그룹(`type-caption text-text-muted`, 그룹이 없으면 `미분류`, 그룹 목록을 모르면 빈 줄), 상태 아래 원인. 그룹은 보조 정보라 열을 두지 않는다. 모든 행의 높이가 같아 목록의 리듬이 끊기지 않는다(검색이 소속 대상에 맞으면 그 줄이 하나 더 붙는다).
- **상태 칸**: `StatusLight`(상태 문구) 아래 줄에 원인 문구(`type-caption text-text-muted`, 한 줄 말줄임, 전체는 툴팁)다. 두 줄까지 두던 때(2026-11-19)는 원인이 긴 행만 높아졌다. 원인은 서버 상태를 만든 대상이다(§5.4). 상태 문구를 상태색으로 칠하지 않는다.
- **값이 없는 까닭은 셋이고 모양이 다르다** (2026-11-20, 0이 아니다). 그 수치를 내는 기능에 연결한 대상이 없으면(인프라 없음 → CPU·메모리, 모니터 없음 → 업타임, 로그 앱 없음 → 오류 로그) **빈 칸**이다. 연결했지만 값이 아직 없으면 `-`(`데이터 없음`)다. 대상 목록이나 로그 요약을 불러오지 못했으면 `sync_problem` 아이콘(`text-muted`, `불러오지 못함`)이다. 모두 `-`이던 때는 해당 없는 칸이 화면을 대시로 채웠고, 조회 실패와 구분되지 않았다. 까닭은 툴팁과 `sr-only` 글자(`수집 안 함`, `데이터 없음`, `불러오지 못함`)가 말한다. 칸마다 Tab 지점을 늘리지 않는다. 수집기 자체의 실패는 수치 칸이 아니라 상태와 원인(`인프라 수신 끊김` 등)이 말한다.
- **장애 행은 옅게 채운다** (2026-11-20): `ResourceTable alertRow`, `status-error-fill/6`(hover `/10`). 작은 빨간 점만으로는 장애 행이 목록에서 먼저 보이지 않았다. 좌측 세로선은 쓰지 않는다(§9 1번). 행 전체를 덮는 데이터 상태 표시라 §9 3번(공지 박스의 파스텔 틴트)의 대상이 아니다. 확인 필요는 채우지 않는다: 둘 다 채우면 다시 구분되지 않는다.
- **수치의 색**: CPU·메모리가 `WARNING_PCT`(70%) 이상이면 `status-warn` 글자이고, 화면 낭독기에는 `, 주의 기준 초과`를 붙인다(색만으로 전달하지 않는다).
- **정렬**: 상태가 나쁜 순서(장애, 확인 필요, 대기, 정상), 같은 상태 안에서는 이름순. 사용자가 바꾸는 정렬은 없다.
- **좁은 폭**: 열은 목록 컨테이너의 폭에 맞춘다. 서버 이름과 상태(원인 포함)는 항상 보이고, 수치 열은 `@3xl`부터 보인다. 숨긴 수치는 이름 아래 그룹 줄에 앞서 모은다(값이 없는 수치는 그 줄에서 뺀다). 좁은 폭의 상태 열은 144px이다.
- **머리말**(2026-11-20, 제목은 2026-11-21): 제목은 `서버 9`이고 데스크톱에서는 `AppHeader`, 모바일에서는 본문 h1이다(§3.4 메뉴 첫 화면의 제목은 하나다). `meta`는 `[마지막 갱신 시각] [새로고침 아이콘] [전체 로그]`이고, 주 액션은 `[추가]`다. 데스크톱은 모두 `AppHeader` 오른쪽, 모바일은 제목 줄에 `추가`, 제목 아래에 meta다. `전체 로그`는 목록을 거르는 조작이 아니라 보조 이동이라 툴바에서 빼고 `quiet` 버튼으로 낮췄다(2026-11-19까지 툴바 끝의 밑줄 링크가 목록과 무관한데 눈을 끌었다). 생성 버튼은 화면 제목이 대상을 말하므로 `추가`다(§4.1 액션 앵커).
- **툴바**: 검색, 상태 칩(`FilterChips`), 그룹 필터(2026-11-20). 검색은 서버 이름, 소속 대상(모니터, 앱, 인프라 리소스)의 이름, 모니터의 주소, 그리고 그 서버 앱의 메트릭 지표 이름(원래 이름과 표시 이름)을 찾는다(2026-11-19). 서버 이름이 아니라 소속 대상이 맞으면 서버 이름 아래 한 줄에 맞은 것을 쉼표로 잇는다: 대상은 그 이름, 지표는 `앱 이름 지표 표시 이름`. 행의 구조는 바뀌지 않는다. **상태 요약은 필터 칩이다**: `장애, 확인 필요, 대기, 정상` 순서이고, 누르면 그 상태만(`?status=`, `aria-pressed`), 다시 누르면 해제한다. 장애·확인 필요가 0이면 점을 중립색으로 둔다. 개수는 검색어와 그룹을 따른다(상태 선택은 따르지 않는다). 22px 굵은 숫자와 12px 라벨이던 때(2026-11-19)는 요약인지 필터인지 읽히지 않았고 검색과 그룹 사이에서 툴바를 붐비게 했다. 검색어, 상태, 그룹은 주소에 남고(`q`, `status`, `group`), 서버를 삭제한 뒤에는 그 주소의 목록으로 돌아간다.
- **빈 상태**: 서버가 없으면 `서버 추가`를 안내하고, Docker 환경이 있으면 그 데이터가 Docker 환경에 있다고 함께 적는다. 한 번도 불러오지 못했으면 서버가 없는 것이 아니라 모르는 것이므로 빈 상태가 아니라 조회 실패(`다시 시도`)다. `전체 로그`는 머리말에 있으므로 두 화면에도 그대로 있다(2026-11-20, 그전에는 버튼 옆에 따로 두었다).
- **조회 실패**: 일부 대상 목록만 실패하면 해당 칸이 `불러오지 못함` 표시가 되고 `일부 정보를 불러오지 못했습니다` 배너와 다시 시도를 둔다. **서버 목록을 다시 불러오다 실패하면**(2026-11-19) 이전 행을 지우지 않는다: 마지막으로 성공한 서버 목록과 새로 받은 대상 목록으로 행을 다시 만들고, `서버 목록을 새로 불러오지 못했습니다`(`이전에 불러온 정보입니다.` + 원인) 배너와 다시 시도를 둔다. 마지막 갱신 시각은 서버 목록과 대상 목록(모니터, 앱, 인프라)이 모두 성공해야 바뀐다. 서버 상세도 같은 배너(`서버 정보를 새로 불러오지 못했습니다`)이고, 실패한 동안 주소의 서버를 이전 목록에서 찾지 못하면 "찾을 수 없습니다"가 아니라 `서버를 불러오지 못했습니다` + 다시 시도다.

**목록 필터의 공통 규칙** (2026-11-21). 서버, Docker 환경, 그룹, 업타임 탭, 알림 규칙·발송 이력이 같은 방식이다.
- 툴바는 `ListToolbar`: 검색 → (선택) → 칩. 요약이 곧 필터라 요약 줄을 따로 두지 않는다.
- 상태·유형 요약은 `FilterChips`이고 개수는 다른 필터를 따른다. 상태를 모르면(목록을 불러오지 못함, 이전 정보) 칩을 두지 않는다: 모르는 것을 세지 않는다(그룹 목록, 업타임 탭).
- 검색어와 칩 선택은 주소에 남는다(`useListSearch`): 입력은 로컬 상태가 쥐고 주소는 replace로 따라간다(한글 조합 중 글자가 덮이지 않게). 링크·뒤로 가기로 주소가 바뀌면 검색창이 주소를 따른다. 서버 목록·업타임 탭에 따로 있던 같은 코드를 2026-11-21 하나로 합쳤다.
- 거른 결과가 비면 `검색 결과가 없습니다` + `필터 해제`(검색어와 칩 선택을 함께 지운다).
- Docker 환경의 상태 칩은 서비스의 상태를 센다. 상태를 고르면 그 상태의 서비스가 있는 환경만, 그 서비스만 펼치고 서비스가 없는 설치 대기 환경은 뺀다.
- 데스크톱 발송 이력은 서버가 쪽을 나누므로 칩의 개수는 같은 조건(유형, 채널, 기간, 검색)의 `total`을 상태마다 한 건짜리 요청으로 받는다. 모바일 발송 이력은 최근 30건만 보이는 목록이라 칩을 두지 않는다: 일부만 센 숫자가 바로 위 7일 발송 요약과 어긋난다.
- 알림 채널에는 상태·유형 요약이 없어 칩도 없다.

**업타임 목록** (2026-11-08, 2026-11-18부터 서버의 업타임 탭) — 모니터가 둘 이상인 서버의 업타임 탭(`UptimeMonitorList`)이 옛 업타임 목록의 본문을 서버 범위로 좁혀 쓴다. 아래 규칙은 그대로다. `UptimeTargets`의 두 보기는 검색 결과와 상태 우선 순서를 공유한다. 상태 요약은 `장애, 정상, 확인 대기, 일시정지` 순서의 `FilterChips`다(2026-11-21, 그전에는 라벨 아래 24px 숫자를 둔 수치 행이라 서버 목록의 칩과 모양이 달랐다). 개수는 검색어를 따른다. 그리드의 대상 열에는 이름과 체크 주소만 두 줄로 표시한다. HTTP/TCP는 `방식`, 주기는 `수집 간격` 열로 옮겨 행 높이를 늘리지 않는다. 수치 열은 24시간 업타임과 평균 응답(성공한 체크만)이다. 평균 응답은 숫자만 오른쪽으로 정렬하고, 응답 추이는 상세 화면에서 확인한다. 일시정지했거나 24시간 체크가 없으면 `-`, 모두 실패했으면 `0.00%`다. 평균 응답은 정수 ms로 표시한다.

표와 카드의 배치는 뷰포트 대신 **목록 컨테이너의 폭**에 맞춘다. 표에는 선택 체크박스를 두지 않고 상태부터 표시한다. 업타임은 `@xl`(576px), 방식·수집 간격·평균 응답·최근 체크는 `@3xl`(768px)부터 별도 열로 표시한다. 숨긴 수치와 최근 체크는 대상 열로 옮긴다. 이름과 주소, 상태, 상태 변경은 항상 보인다. 카드 열 수는 `@2xl`부터 2열, `@5xl`부터 3열이다.

**갱신과 최근 체크** — `RefreshStatus`(2026-11-21 `UptimeRefreshControls`에서 이름이 바뀌어 공용이 되었다)는 마지막 성공 갱신 시각과 30초 자동 갱신 스위치다. 2026-11-18부터 서버 상세의 머리말에 하나만 있고 업타임 탭의 목록과 모니터 상세가 그것을 따른다(§4.1 서버 상세 헤더). 서버 목록은 같은 표기에서 스위치를 뺀다. 숨긴 탭에서는 자동 조회를 멈추고 다시 보이면 갱신한다. 조회가 실패하면 성공 시각을 유지하고 이전 정보임을 표시한다. 서버 수준의 자동 갱신(서버 데이터)은 대화 상자가 열려 있어도 계속된다. 대신 변경 요청(일시정지, 저장, 삭제, 키 재발급 등)이 진행 중인 패널은 그동안 들어온 머리말의 새로고침 신호를 버린다(`useHeldToken`): 변경이 끝나면 패널이 어차피 다시 불러오고, 변경 전에 시작한 조회의 응답이 변경 뒤의 화면을 덮지 않게 한다. 모니터 패널은 자기 30초 갱신을 수정·삭제 확인 창이 열려 있거나 변경 중일 때 멈춘다.

최근 체크와 장애 정보는 그리드·카드에서 바로 읽는다. 별도 빠른 확인 버튼이나 패널은 사용하지 않는다. `RecentUptimeChecks`는 최근 10회까지의 성공·실패를 높이 12px의 띠와 한 줄 결과로 표시한다. 마지막 확인 시각도 이 줄에 함께 표시한다. 띠는 Tab 한 번으로 진입하며 방향키로 체크를 고른다. 긴 실패 메시지와 정확한 시각은 툴팁에서 읽는다. 진행 중인 장애는 상태 아래 지속 시간을 표시하고, 툴팁에 시작 시각과 메시지를 담는다. 일시정지한 대상의 이력에는 `정지 전 기록`을 붙인다. 일시정지는 `quiet`, 재개는 `ghost` 변형으로 표시한다. 제목 링크와 행 빈 공간의 상세 이동, 새 탭 동작은 유지한다.

목록은 `GET /services?type=http,tcp&include=checks`로 최근 체크와 진행 중인 장애를 함께 받는다. 대상마다 이력 API를 추가로 호출하지 않는다. 일반 목록 호출은 이 상세 필드를 생략한다. 체크 없음은 빈 배열, 확인할 수 없는 이력은 필드 생략으로 구분한다. 실패한 체크의 대기 시간을 응답 시간으로 표시하지 않는다. 모니터 패널(`UptimeMonitorPanel`)은 상태 줄(`UptimeMonitorStatusBadge` + 최근 체크 `UptimeLatestCheck` + `일시정지`)이 현재 체크를 설명하고, 화면은 현재 체크 상태 → 기간별 수치 → 응답 추이 → 90일 이력 순서다.

요약 숫자는 **상태 필터**이기도 하다. 누르면 그 상태만(`?status=`, `aria-pressed`), 다시 누르면 해제한다. 그리드는 행마다 일시정지·재개를 제공한다. **일괄 작업**은 카드 보기의 체크박스로 고르고, 목록 위 `N개 선택 · 일시정지 · 재개 · 삭제 · 선택 해제` 막대로 실행한다. 보기 방식을 바꾸면 선택을 해제한다. 검색·필터로 가려진 대상은 작업에서 빠진다. 실패한 대상만 선택에 남아 다시 시도할 수 있다. 일괄 작업은 서버 하나의 업타임 탭 안에서만 동작한다(여러 서버에 걸친 일괄 작업은 없다, 설계 문서 10절 4).

**~~메트릭 목록~~** (2026-11-07 ~ 2026-11-18) — 메뉴와 함께 없어졌다. 당시의 열은 `서비스 | 수집 | 확인 필요 | 메트릭 | 확인할 지표`였다. 판정은 서버로 옮겨 남았다: 임계값을 넘은 지표가 있는 앱은 서버의 메트릭 기능에서 확인 필요(`임계값 초과`)이고, 원인 문구는 이 목록의 `확인할 지표` 표현(`임계값 초과 <첫 지표> 외 N개`)을 이어 쓴다(§5.4).

**Docker 환경 목록 트리** (2026-11-15) — 그리드는 환경 행 아래에 서비스 행을 끼운 트리다(Linear Initiatives 레퍼런스). 실제 부모-자식 관계가 있는 목록에만 쓴다: 평평한 목록에 들여쓰기를 넣으면 관계 없는 장식이 된다. 행은 같은 `ResourceTable`의 평평한 배열이고(`kind: env | service`), 이름 열만 깊이에 따라 들여쓴다. 펼침 버튼(20px, `aria-expanded`)의 가운데가 연결선의 x이고, 선은 `-my-4 py-4`로 셀 높이 전체를 덮어 행 사이에서 끊기지 않는다. 마지막 자식은 가로선 높이까지만 그린다(└). 기본은 모두 펼침, 서비스는 장애 먼저. 검색은 환경 이름이 맞으면 하위를 모두, 서비스만 맞으면 맞은 서비스만 펼친다. 카드 보기도 같은 서비스 링크를 갖는다(제목 링크를 `after:inset-0`으로 늘리고 서비스 목록은 `z-10`). **부모와 자식은 같은 열을 채운다**: 업타임 30일·요청 24h·p95는 `/agents/overview`가 환경 값과 함께 서비스별 값(`services[]`)을 준다. 부모에만 있는 값(서비스 수)은 열로 두지 않고 이름 아래 보조 줄로 옮긴다. 자식 행의 같은 자리에는 체크 주소가 온다. 빈 열이 생기면 열을 줄이거나 양쪽이 가진 값으로 바꾼다.

목록 보기 전환은 텍스트 대신 `view_list`(그리드의 행·열 비교)와 `grid_view`(카드 배열) 아이콘을 쓴다. 순서는 그리드 → 카드이며, 접근성 이름과 툴팁은 `그리드`·`카드`다.

**목록 조작의 자리** (2026-11-15, 2026-11-14 "보기 전환의 자리"를 대체, 대상 화면은 2026-11-18 기준). 메뉴 h1이 데스크톱에서 사라진 뒤(§3.4) 같은 조작이 메뉴마다 다른 자리에 있었다 — 당시 보기 전환은 업타임·메트릭·Docker 환경에서 검색 툴바, 로그·인프라·그룹에서 제목 줄, API에서 기간 줄이었고, 새로고침은 개요는 헤더, 업타임은 상태 줄, 메트릭·API는 툴바였다. 모든 목록 메뉴가 같은 세 층을 쓴다.
1. **화면 전체 조작은 헤더**: 새로고침은 `PageHeader`에서 주 액션 **앞**에 둔다 — 데스크톱은 `AppHeader` 오른쪽에 `[갱신 조작] [주 액션]`. 수집 데이터를 보여 주는 목록 메뉴(서버, Docker 환경)는 `children`에 `새로고침` 버튼을 둔다(2026-11-16). 그룹은 설정 목록이라 없다. 서버 목록의 헤더는 `[갱신 시각] [새로고침] [전체 로그] [추가]`다(2026-11-20, 앞의 셋은 `meta`). 개요는 `meta`(시각 + 버튼, 문구는 `30초마다 자동 갱신`)다. 자동 갱신을 끌 수 있는 곳은 서버 상세의 머리말 하나다(§4.1 서버 상세 헤더, 2026-11-18 전에는 업타임 목록이었다).
2. **툴바는 검색이나 필터가 있을 때만**: 왼쪽 검색, 그 옆 필터(상태 요약·그룹·기간·정렬). 새로고침과 보기 전환은 툴바에 두지 않는다. 둘 다 없는 화면(그룹)은 툴바 줄을 만들지 않는다. 상태 요약(서버 목록의 장애·확인 필요·대기·정상, 업타임 탭의 장애·정상·확인 대기·일시정지)은 필터이므로 검색 오른쪽이다(2026-11-16) — 따로 한 줄이면 두 줄 모두 오른쪽 60%가 비었다. 서버 목록의 툴바는 검색, 상태 칩, 그룹뿐이다(2026-11-20, 갱신 시각과 `전체 로그`는 머리말로 옮겼다).
3. **보기 전환도 헤더, 목록 제목 줄은 없다** (2026-11-16): 메뉴 첫 화면의 목록은 메뉴 이름을 되풀이하는 제목(당시 `로그 서비스`·`인프라 대상`)과 개수 메타를 보이지 않는다 — 크럼이 이미 이름을 말했고, 제목을 빼자 메타와 토글만 남은 줄이 어정쩡했다(사용자 요청). `ListViewToggle`은 `PageHeader` children으로 **주 액션 바로 앞**에 두고 목록이 있을 때만 그린다(Docker 환경, 그룹): 데스크톱 `AppHeader`는 `[갱신 조작] [보기 전환] [주 액션]`. 목록 `section`에는 `sr-only` `h2`만 남겨 스크린리더 제목 탐색을 지킨다. 전체 개수는 메뉴 제목이(§3.4, 2026-11-21), 거른 개수는 검색창의 결과 수가 말한다. `PageHeader menu`는 조작을 `ControlDefaultsContext`로 감싼다: 데스크톱 헤더로 포털된 조작은 크기·variant를 정하지 않은 `Button`·`ListViewToggle`이 32px(sm) + secondary, 모바일 메뉴 첫 화면은 secondary + 내용 폭(터치 높이 md 유지)이다 — 40px 검은 채움 버튼(모바일은 남은 폭까지 채운)이 화면에서 가장 무거웠는데 `Docker 연결`·`추가`는 가끔 쓰는 설정 조작이다(사용자 지적). 빈 상태(EmptyState)의 연결 버튼과 대화상자는 그대로 primary다(헤더 버튼 안에서 대화상자를 열던 `MonitoringConnection`은 2026-11-18에 메뉴와 함께 없어졌다). 알림의 추가 버튼은 탭에 따라 `규칙 추가`·`채널 추가`다. 메뉴가 아닌 화면 안의 목록(전체 로그, 서버의 로그 탭, 그룹 상세 등)은 여러 섹션 중 하나라 제목 줄을 유지하고 보기 전환을 그 줄 오른쪽에 둔다. 서버의 업타임 탭은 탭 줄의 조작 자리(§4.6)에 `[보기 전환] [모니터 추가]`를 둔다.

알림은 탭이 패널을 바꾸므로 예외다 — 보기 전환은 데스크톱·모바일 모두 탭 줄 오른쪽 끝이고(데스크톱은 헤더와 같은 sm), 7일 발송 요약은 탭 위가 아니라 `발송 이력` 탭의 머리다(2026-11-16 — 규칙·채널 탭에서도 표보다 먼저, 더 크게 섰다), 모바일에서는 탭의 장식 아이콘을 `sm` 미만에서 빼서 폭을 낸다. 헤더 아래에 토글만 있는 줄을 두지 않는다. 메뉴 첫 화면 위의 안내 문장(`Docker Collector가 수집한 데이터는 Docker 환경에서 확인합니다.`)은 없앴다(2026-11-16, 사용자 요청). 서버와 Docker 환경의 구분은 [ADR 0011](../../docs/adr/0011-servers-own-directly-configured-targets.md)과 내비가 말한다. 같은 문장은 서버 목록의 빈 상태에만 남는다(Docker 환경이 있을 때).

**목록 행 높이는 내용으로만 달라진다.** 행 안의 인라인 버튼(`트레이스`, 경로 링크)이 행을 키우지 않게 한다: 로그 행은 펼침 버튼처럼 `-my-1.5`, 요청 행은 첫 칸에 `min-h-8`(버튼 높이)을 주고 셀 여백을 `py-2`로 둔다. 버튼이 있는 행만 높아져 목록이 들쭉날쭉했다.

**반복 패턴 목록은 상위 5개**를 먼저 보이고 `전체 보기 (N)`로 펼친다. 20행이 이어지면 위의 서비스 목록보다 길어졌다.

**거르는 조작은 거르는 대상의 제목 아래에 둔다.** 서버의 API 요청 탭(과 Docker 서비스의 요청 탭)의 검색·`에러만`은 "요청 결과" 제목과 표 사이다 — 제목 위에 있으면 위의 Endpoint 표를 거르는 것처럼 읽혔다.

**카드 안 보조 표** — 패딩 있는 카드 안의 짧은 기록(업타임 체크 기록). 헤더 채움 없이 `type-caption text-text-muted`, 래퍼 `-mx-2` + 셀 `px-2`로 글자를 카드 좌측 기준선에 맞춘다(§4.1 "카드의 좌측 기준선은 하나다").

**헤더에 `uppercase`·`tracking-wider`를 걸지 않는다.** 영어 헤더(`Span`)도 옆 헤더와 같은 모양으로 둔다(§2.5).

### 4.6 탭 (2026-10-09)

**패널을 바꾸면 탭, 같은 데이터의 보기·필터를 바꾸면 `SegmentedControl`이다.** 탭은 `role="tablist"`/`role="tab"` + `aria-selected`, `SegmentedControl`은 `aria-pressed`다. 탭은 위치가 아니므로 브레드크럼에 넣지 않는다(§3.4).

**공용 `Tabs`** (2026-11-18, [`components/common/Tabs.tsx`](src/components/common/Tabs.tsx)) — 서버 상세와 Docker 서비스 상세(`AgentServiceTabs`)가 쓴다. 이전에는 `AgentServiceTabs`가 자기 탭 줄을 그렸다.
- **밑줄 탭**: 탭은 `border-b-2 px-4 py-2.5 type-label`. 선택은 `border-primary text-text-base`, 비선택은 `border-transparent text-text-muted hover:text-text-base`. 탭 아래 전폭 기준선은 두지 않는다(§3.1). **라벨을 `action`으로 칠하지 않는다** — 밑줄이 이미 선택을 말한다(§4.1 `secondary` 라벨을 칠하지 않는 것과 같은 이유).
- **상태 점**: 장애나 확인 필요인 기능의 탭에만 `tone`을 주고, 점의 이름은 `toneLabel`(`role="img"`, §5.2)이다. 정상인 탭에는 점이 없다. 알림 링크나 옛 주소로 다른 탭에 바로 들어와도 어느 기능에 문제가 있는지 보여야 한다. 이름 없이 점만 주면 점은 `aria-hidden`이 되므로 `toneLabel`을 함께 준다. 점이 있는 탭은 마우스를 올리거나 키보드로 포커스하면 툴팁으로 `toneLabel`(`확인 필요`, `임계값 초과` 등)을 보인다(2026-11-19). 점은 탭 버튼 안이라 따로 포커스를 받지 못하므로 탭 버튼이 툴팁의 트리거다.
- **보조 문구**(`caption`, `type-caption text-text-dim`): `연결 전`은 대상이 없는 기능이고 탭 글자를 `muted`(`text-text-dim`)로 흐린다. 선택은 가능하다(연결 안내가 나온다). `확인 불가`는 대상 목록을 불러오지 못했거나 이전에 불러온 목록인 기능이다(`capabilityUnverified`). 연결 전이 아니므로 흐리게 두지 않고 상태 점도 붙이지 않는다(§5.4).
- **대상 수는 화면에 숫자로 그리지 않는다.** 탭 옆 숫자가 오류 건수로 읽힌다. `srDetail`(`, 모니터 2개`)로 접근 가능한 이름에만 담는다.
- **키보드**: 선택된 탭 하나만 Tab 순서에 있고(`tabIndex` 0/-1), ←/→로 옮긴다(끝에서 반대쪽으로 돈다). Home·End는 처음과 끝이다. 키로 옮기면 `onChange(key, 'keyboard')`이고 포커스가 새 탭으로 간다. 서버 상세와 Docker 서비스 상세(2026-11-19부터)는 첫 키보드 이동만 기록을 쌓고 이어지는 키보드 이동은 그 기록을 덮어써서, 뒤로 가기 한 번이면 키보드 탐색을 시작한 탭으로 돌아간다. 마우스 이동은 매번 쌓인다.
- **넘침**: 탭 줄은 줄바꿈하지 않고 탭 줄만 가로로 스크롤한다(320px에서도 페이지는 가로로 넘치지 않는다). 주소로 바로 들어와 선택된 탭이 줄 밖에 있으면 탭 줄의 `scrollLeft`만 맞춰 보이게 한다. `scrollIntoView`는 탭 줄이 화면 밖이면 페이지까지 세로로 움직였다. 가로 스크롤 영역은 세로도 잘라서 포커스 링(2px + 간격 2px)이 잘렸으므로 탭 목록에 안쪽 여백 `p-1`을 두고 같은 만큼 `-m-1`로 끌어당긴다. (이전의 "`-mb-px` 대신 `absolute` 기준선" 조합은 기준선을 없애면서 필요 없어졌다.)

**서버 상세는 탭을 경로로 표현한다** (2026-11-18) — `/servers/<id>`(개요), `/servers/<id>/uptime`, `/servers/<id>/uptime/<monitorId>`. `?tab=`을 쓰지 않는 것은 API 요청 탭의 요청 쿼리가 이미 `?tab=requests|traces`를 쓰기 때문이다. 탭을 바꾸면 주소가 바뀌어 뒤로 가기로 돌아온다. **이미 선택된 탭을 다시 누르면 쿼리 없는 그 탭의 첫 화면으로 간다**(대상 상세나 필터를 걸어 둔 상태에서 탭의 처음으로 돌아가는 길이다). Docker 서비스 상세는 지금처럼 `?tab=`이다.

**Docker 환경 상세도 탭을 경로로 표현한다** (2026-11-19) — `/agents/<id>`(개요), `/agents/<id>/infrastructure`·`/logs`·`/api`. 섹션 여섯 개를 세로로 쌓은 스크롤 화면이라 로그·요청 추이가 서비스 목록 아래로 멀었고, 서버 상세·Docker 서비스 상세와 같은 깊이인데 형식이 달랐다(사용자 요청). **서비스 목록은 개요 탭**이다: 이 화면의 주 내용이고(어느 서비스가 죽었는지 보고 들어간다), 진행 중 장애·90일 업타임·장애 이력·타임라인·설정 가이드가 함께 있다. 설정 가이드는 탭 위에 두면 모든 탭에서 탭 줄을 밀어내서 개요로 옮겼다. 수집하지 않는 기능의 탭은 두지 않고(`profile.capabilities`), 없는 탭 주소는 개요로 보낸다. 메트릭 탭은 없다: Docker 메트릭은 서비스 목록의 열로만 보인다.

**탭 줄의 오른쪽 끝은 현재 탭의 조작 자리다** (2026-11-18). 탭이 자기 조작을 이 자리로 포털한다(`TabAction`, `actionSlot`): 추가·연결 버튼(`모니터 추가`, `로그 연결`, `API 연결`, `메트릭 연결`, §4.1)과 업타임 목록의 보기 전환(추가 앞). 연결 전인 탭은 연결 안내 안에 주 버튼이 있으므로 비어 있고, 인프라 탭은 서버마다 하나라 추가할 것이 없어 비어 있다. 대상 상세에서는 탭의 목록으로 돌아가는 `TabBackLink`(§4.1 예외)도 이 자리의 맨 앞이다. 탭 줄이 넘치는 좁은 폭에서는 탭 줄 아래 한 줄로 내려가고, 비어 있으면 높이가 없다. 모바일(< sm)에서 그 줄은 폭 전체이고 복귀 링크가 왼쪽 끝, 조작이 오른쪽 끝이다 — 조작 줄과 링크 줄이 따로 있던 2026-11-21 이전에는 탭 → 대상 제목이 152px(데스크톱 78px)였고, 한 줄로 합쳐 84px(데스크톱 30px)이 되었다. 패널 안에 조작이나 복귀 링크만 있는 줄을 따로 두지 않는다.

**탭 안에서 같은 데이터의 보기를 바꾸는 것은 `SegmentedControl`이다. 탭 줄을 두 겹으로 쌓지 않는다.** API 요청 탭의 `요청`/`트레이스` 전환(상태 줄 오른쪽), API 요청·메트릭 탭의 앱 선택(`AppSelector`)이 그렇다. 앱 선택은 앱이 4개까지면 상태 점을 단 `SegmentedControl`(정상이 아닌 앱은 문구도 보인다), 넘으면 `Select`다. 기본 선택은 첫 앱이 아니라 상태가 가장 나쁜 앱이다. 앱이 하나면 줄째 없다.

**공용 `Tabs`가 아닌 탭** (2026-11-19 기준)
- **알림 데스크톱 탭**은 같은 밑줄 모양을 자기 마크업으로 그린다(`AlertsDesktopView`, §10.H).
- **세그먼트 모양 탭** — 모바일에서 화면 폭을 탭 수로 나눠 쓰는 자리(알림 모바일). 표면은 `SegmentedControl`과 같다: 트랙 `bg-ui-hover`, 선택 칸 `bg-ui-raised`. `bg-bg-surface`로 칠하면 다크에서 선택 칸이 트랙보다 어두워져 방향이 뒤집힌다(§1.2).

### 4.7 서버 상세의 본문 (2026-11-18)

**대상 상세의 위계** (2026-11-21). 탭이 대상 하나(주소의 모니터·로그 앱, 모니터가 하나뿐인 업타임 탭, 앱 패널을 그리는 API·메트릭 탭)를 보여 주면 그 대상의 제목이 화면에서 가장 크다: 대상 제목 h2는 `type-page-title`(24/700), 서버 머리말의 h1은 `PageHeader subordinateTitle`로 `type-card-title`(16/500)이 된다. h1은 그대로라 제목 구조가 같고, 제목 줄은 설정 버튼(40px) 높이라 머리말 높이도 같다 — 탭을 바꿔도 탭 줄이 움직이지 않는다(§4.6). 이전에는 서버 이름(24/700)이 모니터 이름(20/500)보다 커서 지금 보는 대상보다 서버가 먼저 읽혔다(2026-11-20 시각 점검 2.6).

**대상 상세의 틀** (2026-11-21, 소유자 결정: 대상 하나 = 한 페이지). 업타임 모니터, 직접 연결한 앱, Docker 서비스의 상세는 연결 방식과 상관없이 같은 머리말과 같은 수치를 쓴다. 지금은 Docker 서비스 상세가 이 틀을 쓰고, 서버의 앱과 모니터가 차례로 옮겨 온다.
- **머리말은 `TargetHeader` 하나다**(`features/targets/TargetHeader.tsx`): 제목(24/700) → 상태 줄(오른쪽 끝 `RefreshStatus`) → **연결 줄** → 접히는 속성(`DetailMeta`). 제목 줄 오른쪽에 주 조작과 `더보기`(§4.1 상세 헤더), 머리말 오른쪽 칸에 기간 선택이다. 좁은 화면(`lg` 미만)은 복귀 링크가 맨 위 줄이고, 갱신 상태는 기간 선택과 같은 줄이다(기간 선택이 없는 대상은 복귀 링크와 같은 줄).
- **연결 줄은 대상이 어떻게 연결되어 있는지를 한 자리에서 말한다**(`DetailMeta connection`, `data-connection`): `연결 Docker Collector · <환경> 환경`, `연결 직접 OpenTelemetry · <받는 신호>`, `연결 업타임 모니터 · <방식과 간격>`. 오른쪽에 방식마다 조작 하나를 둔다: Docker는 수집이 환경 단위라 `설정 가이드`(그 Docker 환경), 직접 연결은 데이터를 더하는 곳, 업타임은 수정. 좁은 화면에서는 따로 한 줄을 쓰지 않고 복귀 링크 줄의 오른쪽 끝에 아이콘·방식·조작만 둔다(세부는 넓은 화면의 연결 줄에만 있다). 처음에는 좁은 화면에도 한 줄을 따로 두어 탭 줄이 76px 내려갔고, 탭 → 첫 내용을 줄인 정리(#141)를 되돌렸다. 연결 설정 흐름 자체는 이 틀이 바꾸지 않는다.
- **업타임 수치는 한 묶음이다**(`uptimeKpis`): `24시간 업타임 · 30일 업타임 · 평균 응답 (24시간)`에 HTTPS면 `인증서 만료`. 90일 업타임은 띠 머리글이다. 순서는 수치 → 응답 시간 → 90일 띠 → 기록이다. Docker 서비스는 일별 업타임(30일·90일, 체크 수로 가중)과 24시간 이력(평균 응답은 성공한 체크 수로 가중)에서 같은 값을 계산한다. 예전의 `24시간 체크`·`90일 장애` 칸은 띠(`일부 실패 N일`)와 응답 시간 카드(`체크 N회 중 실패 N회`)가 이미 말하므로 없앴다.
- 높이: Docker 서비스의 탭 줄은 1440에서 343 → 375px(연결 줄), 1024에서 403 → 435px, 390에서 343 → 367px(복귀 링크 줄을 터치 높이 44px로)이다. 서버의 앱과 모니터는 이 틀로 옮기면 서버 머리말이 빠져 지금보다 짧아진다.

**대상의 이름** — 서버 화면에서는 직접 연결한 대상을 "앱"이라고 부르고(로그·API 요청·메트릭 탭, 개요, 대화 상자) "서비스"와 "메뉴"라는 말을 쓰지 않는다. "서비스"는 Docker 환경의 서비스에만 쓴다. 업타임의 대상은 "모니터", 인프라의 대상은 "인프라 리소스"다. 여러 부모를 가로지르는 목록에서 대상의 이름은 **`부모 / 대상`** 형식이다(`edge-host-01 / Checkout API`, `prod-server / payment-worker`): 개요의 현재 확인 필요와 최근 장애 이력, 알림 규칙의 대상 선택과 목록(`directTargetLabel`). 개요에서는 대상 이름이 부모 이름과 같으면(인프라 리소스) 부모 이름만 쓴다.

**개요 탭은 카드가 아니라 섹션 행이다** (`ServerOverviewTab`). 같은 무게의 기능 카드 다섯 장 대신 페이지 섹션 규칙(§3.1)을 따른다.
- 진행 중인 장애가 둘 이상일 때만 맨 위에 상태 배너를 두고 장애 대상마다 링크를 나열한다. 하나면 머리말의 원인 링크가 같은 말을 하므로 두지 않는다. 깜빡이는 점은 머리말에만 있다.
- 연결된 기능을 `section-stack` 행으로 나열한다. 행은 기능 이름(h2) + `StatusLight` + `<기능> 보기` 링크(왼쪽 고정 폭, 위에서 아래로)와 수치(`dl`)다. 링크는 2026-11-21에 행 오른쪽 끝에서 제목 아래로 옮겼다 — 제목에서 약 1,070px 떨어져 다섯 번 반복되어 무엇을 여는지 짝지어 읽기 어려웠다. 수치는 업타임 `모니터`·`24시간 가용률`, 인프라 `CPU`·`메모리`·`디스크`, 로그 `앱`·`24시간 오류 로그`, API 요청과 메트릭은 `앱` 하나다. 문제가 있는 기능이 위이고, 상태를 확인할 수 없는 기능은 연결된 기능들 다음이다. 업타임 행은 상태가 나쁜 순으로 모니터 셋까지 최근 체크 띠(`RecentUptimeChecks`)를 넣는다.
- 연결되지 않은 기능은 맨 아래 `연결할 수 있는 기능` 섹션 하나에 텍스트 버튼으로 모은다. 누르면 그 탭(연결 안내)으로 간다.

**대상이 없는 서버** — 개요 탭은 `EmptyState` 하나다: `아직 연결한 기능이 없습니다`, 주 버튼은 설치가 필요 없는 업타임 모니터 추가(업타임 탭으로 옮기면서 추가 대화 상자를 연다), 그 아래 `다른 기능은 각 탭에서 연결합니다.` 다른 기능의 선택지는 탭 줄의 `연결 전`이 이미 보여 주므로 버튼을 늘어놓지 않는다.

**연결 안내** (`ConnectPrompt`) — 연결되지 않은 탭의 본문이다. `EmptyState`(h2)에 **무엇이 필요한지와 누른 뒤에 일어나는 일**을 적는다: 서버에 설치할 것이 있는지(업타임은 없다, 인프라는 OpenTelemetry Collector), 누르면 무엇을 받는지(앱 이름을 정하고 키와 설정 예시, 인프라는 API Key와 Collector 설정 파일), 키가 한 번만 표시되는지. 실제로 제공하는 동작만 말한다. 주 버튼은 탭 줄과 같은 문구(`CONNECT_LABEL`)이고 `primary`다. "개요로 돌아가기" 같은 버튼은 바로 위 탭 줄과 겹치므로 두지 않는다. 연결을 마치면 그 대상의 주소로 가서 포커스를 탭 패널로 옮기고 토스트로 알린다.

**위험 동작** — 서버 삭제와 다른 서버 합치기는 서버 설정 대화 상자의 입력란 아래, 저장 줄 위에 둔다. 저장 줄의 오른쪽 끝(주 액션 자리)에 파괴 조작이 오지 않게 한다. 표현은 §9.2(중립 표면에 앞에 하는 일을 적은 muted 문장과 버튼)다: `서버 삭제`는 `destructive`, `다른 서버 합치기`는 이 서버를 지우지 않으므로 `secondary`다. 확인 창의 규칙:
- 삭제 확인 창은 제목에 대상 이름을 넣는다(`edge-host-01 서버를 삭제할까요?`). 합치기 대화 상자의 제목은 `다른 서버 합치기`이고 고른 서버의 이름은 선택 목록이 보인다. 삭제 확정은 `danger`, 합치기 확정도 선택한 서버가 삭제되므로 `danger`다(§7).
- **함께 삭제되거나 옮겨질 대상을 종류와 개수로 보인다**(`TargetCountList`: `업타임 모니터 2개`, `앱 1개`, `인프라 리소스 1개`, 0개인 종류는 뺀다). 합치기는 삭제될 서버의 수도 적는다.
- **모르는 것을 단정하지 않는다.** 대상 목록을 불러오지 못했으면 "연결된 대상이 없다"고 쓰지 않고 확인하지 못했다고 쓴다. 이전에 불러온 목록이면 지금과 다를 수 있다고 적는다. 인프라 리소스 목록을 몰라 합치기의 충돌을 미리 확인하지 못했으면 그것도 적는다.
- 인프라 리소스는 서버마다 하나이므로 이미 리소스가 있는 서버는 합치기·옮기기의 선택지에서 비활성으로 두고 까닭을 적는다.
- 삭제한 뒤에는 사용자가 보던 검색 조건의 서버 목록으로 돌아간다.

**탭 본문의 진행 중·실패 상태** (2026-11-19)
- **이전 목록에 대상이 없어도 연결 안내를 보이지 않는다.** 업타임·로그·API 요청·메트릭 탭은 목록이 이전 정보(`stale`)이고 대상이 0개이면 연결 안내 대신 처음부터 실패한 경우와 같은 `LoadErrorBanner inline`(`<기능> 정보를 불러오지 못했습니다` + 다시 시도)이다. 대상이 정말 없는지 모르기 때문이다(인프라 탭은 예외로 남아 있다, §10.H).
- **삭제나 이동을 시작한 화면은 화면이 바뀔 때까지 본문이 자리 표시다**(`PanelPlaceholder`, `role="status"` + `로딩 중…`). 끝난 뒤 다시 불러오는 동안 지운 대상의 패널이나 빈 탭의 연결 안내가 잠깐 보이지 않게 한다. 다른 화면으로 옮겨 가면(뒤로 가기로 같은 화면에 돌아와도) 잊는다.

**요청의 규칙** (2026-11-19, 화면이 보여 주는 정보의 정확성에 관한 것이라 여기 적는다)
- **대상 전체를 보내는 수정 요청은 실행 직전에 대상을 다시 조회해서 만든다**([`utils/readLatest.ts`](src/utils/readLatest.ts)). 화면의 객체(최대 한 주기 전, 다시 불러오기에 실패했으면 더 이전)로 만들면 그 사이의 변경(일시정지, 신호 연결 해제)을 조용히 되돌린다. 다른 서버로 옮기기, 모니터의 수정과 일시정지·재개가 그렇다. 다시 읽은 대상이 삭제되었으면(404) 요청을 보내지 않고 `대상이 삭제되어 <동작>할 수 없습니다`를 알린 뒤 서버 데이터를 다시 불러온다.
- **서버 데이터의 조회에서 화면이 쓰지 않는 무거운 조회는 그 화면에서 끈다.** `useServers({ logSummary: false })`: 개요, 그룹 목록, 그룹 상세는 오류 로그 건수를 보이지 않으므로 로그 요약을 30초마다 묻지 않는다. 끈 화면에서는 오류 로그 값을 만들지 않고 실패 목록에도 넣지 않는다.

### 4.8 개요의 현재 확인 필요 (2026-11-19)

개요(`OverviewPage`)의 `현재 확인 필요`는 서버와 Docker 환경을 가로지르는 목록이다. 판정은 서버 화면과 같다(§5.4).
- **장애와 확인 필요의 두 묶음**이다(묶음 제목은 h3). 섹션 제목 옆의 건수도 나눈다: `장애 1, 확인 필요 4`. 장애 수는 사이드바 배지와 같은 판정이다.
- **장애가 없으면 `진행 중인 장애 없음`을 먼저 보인다.** 경고 몇 건이 장애처럼 읽히지 않게 한다. 둘 다 없으면 `현재 확인이 필요한 이상이 없습니다` 한 줄이다.
- **확인 필요는 세 건을 먼저 보이고 나머지는 제자리에서 펼친다**: `확인 필요 N건 모두 보기` / `우선 항목만 보기`(`ghost`, `aria-expanded`). 서버 목록의 필터로 보내지 않는다(Docker 환경의 항목은 서버 목록에 없다).
- **확인 필요의 순서**는 수집이 끊겼거나 수신 전인 대상(데이터 대기 중인 앱, 끊긴 인프라, 지연된 Docker Collector) → 메트릭의 임계값 초과 → 리소스 사용률이다.
- **조회가 일부 실패한 동안에는 건수를 표시하지 않고 "없다"고 단정하지 않는다**: 제목 옆 건수를 숨기고, 빈 묶음 문구는 `불러온 영역에서는 진행 중인 장애가 없습니다`, `불러온 영역에서는 이상이 없지만, 전체가 정상인지는 아직 알 수 없습니다.`이고 아이콘은 `sync_problem`(경고색)이다. 위에 `일부 모니터링 정보를 불러오지 못했습니다` 배너와 다시 시도를 둔다.
- 항목의 이름은 `부모 / 대상`이다(§4.7). 사용률 항목은 값과 기준을 함께 적는다(`메모리 84.6%, 기준 70%`).

---

## 5. 상태 표현 문법

### 5.1 대상의 상태 — `StatusLight` (점 + 라벨)

```tsx
<StatusBadge healthy={service.healthy} />   {/* → StatusLight */}
<StatusLight tone="warn" label="수집 지연" />
```

```
inline-flex items-center gap-1.5  type-caption  text-text-secondary
└ 점: h-2 w-2 rounded-full bg-status-{tone}-fill   (aria-hidden)
```

**대상의 상태는 배지가 아니다.** [Adobe Spectrum](https://spectrum.adobe.com/page/status-light/)이 두 컴포넌트를 이렇게 가른다:

| | 정의 | 형태 |
|---|---|---|
| **Status light** | *"describe the condition of an entity"* | 점 + 라벨, 채움 없음 |
| **Badge** | *"color-categorized **metadata** … ideal for getting a user's attention"* | 단색 채움 |

서비스 정상/장애, 업타임 상태, 수집 상태는 전부 앞쪽이다. Spectrum의 semantic 변형도 그대로 맞는다 — positive=정상, negative=장애, neutral(*paused, not started*)=일시정지·미설정, notice(*pending, syncing, processing*)=수집 지연·수신 대기.

**라벨을 상태색으로 칠하지 않는다.** Spectrum의 *"Do not change the text color to match the dot."* 색을 지닌 요소를 점 하나로 줄여야 목록에서 색이 흩어지지 않는다. 카드 50장이 전부 틴트 배지를 달고 있으면 그중 붉은 하나가 묻히지만, 전부 같은 형태에 점 색만 다르면 하나만 튄다 — **장애를 눈에 띄게 만드는 건 색을 더 쓰는 게 아니라 덜 쓰는 쪽이다.**

부수 효과로 대비가 올라갔다. 라벨이 상태색(라이트 healthy 4.78)에서 `text-secondary`(10.35)로 바뀌었고, 점은 표면 대비 5.48~7.58로 WCAG 1.4.11(3:1)을 크게 넘는다 — 형태를 그리던 `/10` 틴트가 1.1 수준이었던 것과 대조된다.

`StatusBadge`는 `healthy` boolean 하나만 받는다. 실제로 렌더되는 상태가 정상/장애 둘뿐이라 그 이상은 지원하지 않는다 — 3단계 이상이 필요해지면 그때 union으로 넓힌다. 이름이 Badge인 건 호출부 9곳의 도메인 어휘라 남겨둔 것이고, 형태는 `StatusLight`다.

상태 표시는 읽기 전용이다. 업타임의 일시정지·재개는 별도 `Button`으로 표시해 상태와 액션을 구분한다. 길이가 변하는 상태 문자열은 줄바꿈하지 않는다.

### 5.1a 수집 상태 — `CollectionStatusBadge`

**서비스 상태**(정상·장애)와 **수집 상태**(수집 중·부분 수집·지연·수신 대기·미설정)는 섞지 않는다. 전자는 대상의 동작 결과이고 후자는 관측 가능성이다. 환경·프로젝트 목록과 개요의 범위/연결 정보, 연결 설정의 데이터 수신 확인에는 `CollectionStatusBadge`를 쓴다. `waiting`(수신 대기)은 **설정은 했는데 첫 데이터가 아직 없는** 상태이고 `not-configured`(미설정)는 설정 자체가 없는 상태다 — 둘을 바꿔 쓰지 않는다. 오래된 수신 기록은 `delayed`이지 `collecting`이 아니다. 장애 lifecycle이 실제로 없다면 “Incident” 같은 단계명으로 바꾸지 않는다.

### 5.1b 배지 — 표 컬럼의 고정 어휘 토큰

`badge`는 `index.css`의 공통 형태다: **12px / 16px, 500, 최소 높이 24px, 좌우 6px 패딩, 4px radius**.

**남은 소비처는 둘뿐이고 전부 "표 컬럼에 반복되는 고정 어휘"다** — 알림 severity(`SeverityBadge`, 색은 `SEVERITY_TONE`: critical·warning은 `status-*/10` 틴트, info는 sky, §1.5), span kind(`AgentServiceTracesTab`). 로그 레벨은 2026-09-20에 배지를 떠나 mono 텍스트 토큰이 됐다(§1.5). 여기서는 박스가 제 값을 한다: 좁은 컬럼에서 severity·span kind 값이 같은 폭의 덩어리로 보여야 세로 스캔이 된다. 대상 상태처럼 카드마다 하나씩 흩어지는 자리와 다르다.

**강조 수단은 하나만 쓴다 — 틴트 배경·보더·단색 채움 중 택1.** Radix Themes·shadcn의 배지 variant가 `soft`(틴트+텍스트) / `outline`(보더+텍스트) / `solid`(단색+흰 텍스트)로 갈리는 것과 같은 규칙이다. 셋을 겹치는 `surface` 변형은 배경이 복잡해 배지가 자기 경계를 만들어야 할 때만 쓰는데, 우리 배지는 아래 제약대로 평면 표면 위에만 놓이므로 해당 없다.

`badge`에 보더 색을 주지 않는다. `index.css`의 `border: 1px solid transparent`는 **박스 크기 유지용**이라 지우지 않지만, 색을 입히면 대비 1.33~1.64짜리 "스티커 테두리"가 생겨 틴트와 이중으로 형태를 그린다. 이전 `border-status-{role}/20`은 2026-09-20에 제거했다.

**배지 모양의 것을 손으로 만들지 않는다.** `rounded border bg-*/10 text-*` 조합을 직접 쓰면 `badge`의 높이·패딩·radius와 어긋나고, 위의 1겹 규칙도 같이 새어나간다. Tailwind v4에서 `border`만 쓰면 색이 `currentColor`라 보더가 텍스트 색 그대로 진하게 나오는 것도 함정이다.

Tailwind v4는 `/10` 같은 투명도 수식자를 `oklab()` `color-mix`로 컴파일한다. 대비를 직접 잴 때 `getComputedStyle().backgroundColor`를 rgb로 가정하면 값이 어긋나니, 소스 hex와 알파로 합성해 계산할 것.

**`/10` 틴트는 알파라서 뒤에 오는 배경과 합성된다 — 배지가 놓이는 배경을 제한한다.** 남은 배지도 전부 알파 틴트다(`bg-emerald-500/10`, `bg-slate-500/10`, …). 대비가 검증된 배경은 `bg-surface`·`bg-main`·`ui-hover-soft` 셋뿐이다.

아래는 status 팔레트로 잰 값이다. 배지가 status 토큰을 쓰던 시절의 측정이지만, 감쇠 폭은 알파가 같으면 팔레트와 무관하므로 **남은 배지에도 그대로 적용된다.**

| 배지 텍스트 | surface | hover-soft | ui-hover | ui-active |
|---|---|---|---|---|
| light healthy | 4.78 | 4.57 | 4.35 ❌ | 3.92 ❌ |
| light error | 5.45 | 5.24 | 4.99 | 4.48 ❌ |
| dark error | 5.43 | 4.62 | — | 3.31 ❌ |
| dark idle | 5.72 | 4.83 | — | 3.45 ❌ |

`hover-soft`의 여유가 0.07밖에 없다. **§3.6의 "클릭 가능한 행·카드의 hover 채움은 `ui-hover-soft`" 규칙이 이 표를 떠받치고 있다** — 행 hover를 `ui-hover`나 `ui-active`로 올리면 그 행의 배지가 조용히 AA 아래로 떨어진다. 로그 표·트레이스 표가 정확히 그 구조이므로, 행 채움을 바꾸려면 여기부터 다시 잴 것. 더 진한 배경이 필요하면 틴트 없이 §5.1의 `StatusLight`를 쓴다 — 점은 색을 1겹만 쓰므로 배경에 흔들리지 않는다.

### 5.2 맨 상태 점 (라벨 없이)

**라벨이 같이 붙는 자리는 §5.1 `StatusLight`를 쓴다.** 이 절은 라벨 없이 점만 놓는 자리 — 배너 앞머리, 타임라인 행, 셋업 다이얼로그의 단계 표시처럼 인접 문장이 이미 상태를 말하고 있는 경우다.

```
h-2.5 w-2.5 rounded-full bg-status-{role}-fill
```
목록 안의 조밀한 자리는 `h-1.5 w-1.5`. `StatusLight`의 점은 `h-2 w-2`다. 진행 중인 장애는 `animate-pulse`를 더한다(`prefers-reduced-motion`에서 전역 규칙이 정지시킨다) — `StatusLight`는 `pulse` prop으로 같은 동작을 낸다.

**점이 유일한 정보원이면 이름을 준다** — 점 옆에 같은 뜻의 텍스트(배지·라벨)가 없으면 색만으로 상태를 전달하는 것이라 WCAG 1.4.1 위반이다:
```tsx
<span role="img" aria-label={healthy ? '정상' : '장애'} className="h-1.5 w-1.5 rounded-full bg-status-healthy-fill" />
```
인접 텍스트가 이미 상태를 말하고 있으면(장애 배너, 온라인/오프라인 라벨) 점은 장식이므로 그대로 둔다.

### 5.3 색을 싣는 곳

**데이터(상태)에만 색을 싣는다. 컨테이너와 액션은 중립이다** (2026-11-15부터 액션도 무채색, §1.4).
배지 · 아이콘 · 텍스트 · 게이지 채움 · 차트 시리즈 = 색 OK.
카드 배경 · 카드 보더 · 섹션 헤더 = 항상 중립.

**칩은 상태 전용이다.** 분류·출처처럼 "정상/장애를 말하지 않는" 라벨은 배경 없는 맨 텍스트(`type-caption text-text-muted`)로 둔다. 한 카드에 칩이 둘이면 어느 쪽이 상태인지 읽히지 않고, 대상 이름보다 라벨이 먼저 눈에 들어온다.

**중립 칩으로는 부족하다 — 형태로 갈라야 한다.** 출처를 `bg-ui-hover text-text-muted` 칩으로 만들어 봤더니 `일시정지`(status-idle) 배지와 구분이 되지 않았다. `status-idle` 라이트와 `text-muted`가 **둘 다 slate-11(`#60646c`)로 값이 같고**, 틴트 배경(`status-idle/10`)과 `ui-hover`도 브라우저 실측에서 거의 겹쳤다. 회색 상태가 존재하는 한 중립 색으로는 상태와 분류를 못 가른다.

**분류 축에 `primary`를 쓰지 않는다.** primary는 선택 상태·주 액션·링크의 색이라 라벨에 쓰면 "선택됨"으로 오독된다 — §1.5에서 로그 `info`를 sky로 밀어낸 것과 같은 이유다. `ConnectionSourceBadge`의 `direct`가 primary 틴트였는데 `docker`는 회색이어서, **같은 축이 두 색으로 갈라져 있었다**(2026-09-20 둘 다 중립으로 통일).

### 5.4 서버의 상태 (2026-11-18)

**판정은 한 곳이다**: [`features/servers/serverStatus.ts`](src/features/servers/serverStatus.ts). 서버 목록, 서버 상세(머리말, 탭의 점, 개요 탭, 앱 선택, 패널의 상태 줄), 개요의 현재 확인 필요, 그룹 목록과 그룹 상세가 같은 함수와 같은 값을 쓴다. 패널은 탭이 계산한 `PanelStatus`를 받는다(§4.1 서버 탭 안의 패널). 따로 계산하면 목록은 "정상"인데 그룹은 "장애"인 대상이 생긴다.

**대상별 판정**

| 대상 | 장애 | 확인 필요 | 대기 | 정상 |
|---|---|---|---|---|
| 업타임 모니터 | 응답 없음(업타임 화면과 같은 `uptimeState`) | 없다 | 일시정지(마지막 상태와 무관), 확인 대기 | 응답 |
| 인프라 리소스 | 없다 | 수신이 없거나 끊김, 또는 CPU·메모리·디스크 중 하나가 `WARNING_PCT`(70%) 이상 | Collector 비활성화 | 데이터 유입 중 |
| 앱 | 없다 | 데이터가 한 번도 오지 않음(`데이터 대기 중`), 메트릭은 임계값을 넘은 지표(`임계값 초과`) | 연결 비활성화 | 받은 적 있음 |

- **리소스 사용률은 장애가 되지 않는다.** 기준 이상이면 확인 필요까지다. 화면은 값과 기준을 함께 적는다(`메모리 84.6%, 기준 70%`).
- **앱은 조용해도 정상이다.** 로그와 트레이스는 사건이 있을 때만 오므로 마지막 수신이 오래된 것을 장애로 보지 않는다.

**서버 상태는 소속 대상의 상태를 합산한다**(`worst`): 장애 > 확인 필요 > **정상 > 대기**. 정상인 대상이 하나라도 있으면 대기가 아니다. 일시정지한 모니터 하나 때문에 서버 전체가 빈 서버처럼 보였다. 대상이 없으면 대기다. **목록의 정렬 순서(`STATE_ORDER`)는 이와 다르다**: 장애, 확인 필요, 대기, 정상 — 볼 것이 위에 온다. 그룹 요약도 같은 `worst`를 쓴다.

**확인하지 못한 기능이 있는 서버** (2026-11-19). 확인한 대상들의 합산이 `장애`나 `확인 필요`이면 그대로 둔다. `정상`이나 `대기`인데 확인하지 못한 기능이 있으면 서버의 상태는 `대기`이고 원인은 링크 없는 `<기능> 확인 불가`다. 모르는 것을 정상이라고 말하지 않는다: 장애 중인 모니터의 목록만 불러오지 못한 서버가 남은 인프라 때문에 `정상`으로 보였다. "확인하지 못한 기능"은 목록 자체를 불러오지 못한 기능과, 다시 불러오지 못해 이전 목록에 대상이 남아 있는 기능이다. 정렬과 상태 요약 필터는 이 결과를 쓴다.

**원인 문구** — 서버 상태를 만든 대상 하나를 적는다. 같은 상태 안에서는 모니터, 인프라, 앱 순이다.
- 모니터와 앱은 `대상 이름 + 문구`(`Checkout API 응답 없음, 6분째`, `billing-api 데이터 대기 중`, `orders-api 임계값 초과 <지표 이름> 외 2개`). 인프라는 문구만이다(`CPU 76.1%`). 리소스 이름이 보통 서버 이름과 같다.
- 대상이 없으면 `연결한 대상 없음`이다. 확인하지 못한 기능이 있고 확인한 대상에 장애·확인 필요가 없으면 `<기능> 확인 불가`(`업타임, 앱 확인 불가`)이고, 다른 대상이 정상인 서버에도 나온다. 확인하지 못한 것을 "대상 없음"이나 "정상"으로 단정하지 않는다.
- 서버 목록의 상태 칸, 서버 상세 머리말의 원인 링크, 개요의 현재 확인 필요가 같은 문구를 쓴다.

**기능별 문구** — 업타임과 인프라는 `장애, 확인 필요, 대기, 정상`이다. **로그, API 요청, 메트릭은 수신 여부만 판정하므로 "정상"이라고 쓰지 않고** 수집 문구를 쓴다: `수집 중`, `데이터 대기 중`, `연결 비활성화됨`. 오류 로그 건수 옆에 "정상"이 놓이면 안 된다. 메트릭은 임계값을 넘은 지표가 있으면 `임계값 초과`다. 탭의 점 이름, 개요 탭의 행, 앱 선택, 패널의 상태 줄이 같은 문구다(`capabilityLabel`, `appCapabilityState`, 패널은 그것을 감싼 `appPanelStatus`).

**조회 실패의 표현** — 지금 불러온 목록으로만 상태를 정한다.
- 대상 목록 하나를 다시 불러오지 못하면 **이전 목록은 유지하되**(대상 이름과 개수는 보인다) 그 기능의 상태는 `확인 불가`다. 이전 상태를 지금의 상태처럼 보이지 않는다. 서버 상태, 원인, 수치에도 쓰지 않는다. 패널의 상태 줄도 `확인 불가`이고 `마지막 수집` 시각을 숨긴다. 이전 목록도 없거나 이전 목록에 대상이 없으면 그 탭은 불러오지 못했다는 안내(`LoadErrorBanner inline`)다(§4.7).
- 서버 목록 자체를 다시 불러오지 못하면 이전 서버 목록과 새로 받은 대상 목록으로 행을 다시 만든다(§4.5 서버 목록).
- 그룹 상세의 대상 추가 대화 상자(`AddTargetsDialog`)는 고를 후보가 없고 목록을 불러오지 못했으면 "추가할 대상이 없다"가 아니라 `대상 목록을 불러오지 못했습니다` + 다시 시도다(2026-11-19).
- **`확인 불가`의 점은 중립색이다**(`StatusLight tone="idle"`, `status-idle-fill`). 경고색이 아니다. 상태를 모르는 것이지 문제가 있다는 뜻이 아니고, 경고색이면 확인 필요와 구분되지 않는다. 탭에서는 점 없이 `확인 불가` 보조 문구만이다(§4.6). 개요 탭은 그 기능 행을 연결된 기능들 다음에 둔다.
- 수치가 없는 까닭이 조회 실패이면 칸은 `-`가 아니라 `불러오지 못함` 표시다(§4.5 서버 목록).
- 상태 요약 필터(서버 목록, 업타임 탭)는 장애·확인 필요가 0건이면 그 점을 중립색으로 둔다. 0건인 장애를 빨간 점으로 보이지 않는다.

---

## 6. 폼

| 컴포넌트 | props | 용도 |
|----------|-------|------|
| **`Input`** | `invalid?` `warn?` `mono?` + 네이티브 | 폼 입력 전부 |
| **`Select`** | 네이티브 `option` children + 기존 select props | 폼 셀렉트 (Input과 같은 셸) |
| **`SearchInput`** | `wrapperClassName?` `onClear?` `resultCount?` `shortcut?` + 네이티브 | 아이콘 붙은 검색창. Astryx PowerSearch(meta/astryx) 참고: 경계는 래퍼가 갖고 돋보기·입력·결과 수·지우기(`IconButton sm`)가 한 줄로 흐른다. 경계는 다른 입력과 같은 `ui-control-border`(3:1), 포커스는 전역 `:focus-visible`과 같은 2px `action` 외곽선을 래퍼에 그린다(입력 자신의 외곽선은 끈다). 쉴 때 옅은 경계·테두리색 포커스를 시도했다가 대비 1.40:1·후광 1.2:1로 hallmark gate 39a/40에 걸려 되돌렸다(2026-11-15). 결과 수는 검색어가 있을 때만 보이고(`number`면 `N개`, 무엇을 셌는지 모호하면 문자열) `aria-live=polite`로 알린다. `shortcut`은 `/` 포커스 + `aria-keyshortcuts`. **URL(`?q=`)에 입력값을 직접 묶지 않는다**: react-router가 transition으로 반영해 한글 조합이 깨진다(`결제`→`ㄱ겨결결ㅈ제제`). 입력은 로컬 상태, URL은 사본이다 |

**클래스를 직접 쓰지 않는다.** Button과 같은 규칙이다.

셸은 `Input.tsx`가 `FIELD_SHELL`·`FIELD_HEIGHT`로 export한다 — `Select`와 텍스트영역이 같은 상수를 쓴다. **높이는 `h-11 sm:h-10`(터치 44 / 그 외 40)으로 고정**한다(Button과 같은 이유, `px/py` 조합 금지). `Select`는 보이는 trigger + portal listbox를 렌더하고, 네이티브 `<select>`는 폼 값과 기존 `onChange` 계약을 유지하는 숨김 요소다. 따라서 브라우저의 기본 option 메뉴가 노출되지 않는다. 높이가 자유로워야 하는 텍스트영역만 `FIELD_SHELL`에 자기 `py`를 덧붙인다.

**상태 표현**
- `invalid` — 검증 실패. `border-status-error-fill` 보더 + `aria-invalid`. 메시지는 필드 아래 `type-body text-status-error` — 경고문이므로 14px(§2.2)이고, `red-500`은 흰 배경 3.8:1로 AA 미달이다
- `warn` — 제출은 막지 않는 주의(예: 원격에서 안 통할 주소). `border-status-warn-fill` 보더

**폼 리듬** (2026-11-21, 전체 간격 점검) — #137의 세로 위계 6단을 폼에 그대로 쓴다. 이전에는 라벨 → 컨트롤 6, 컨트롤 → 도움말 6 / 오류 4로 오류가 뜨면 아래 글이 움직였고, 필드 사이가 대화 상자 16 / 드로어·채널 폼 20으로 갈렸으며, 체크박스·선택지의 제목과 설명이 0~2px로 붙어 있었다.

| 관계 | 값 | 단계 | 구현 |
|------|-----|------|------|
| 라벨 → 컨트롤 | 8px | V2 | `Field` 라벨 줄 `mb-2` |
| 컨트롤 → 도움말·오류 | 4px (같은 자리) | V1 | `Field` 도움말·오류 `mt-1` |
| 필드 → 필드 | 16px | V3 | 대화 상자 본문·`FormStep`·서버 필드 모두 `space-y-4` |
| 번호 단계(필드 묶음) 사이 | 32px + 선 | V6 | 규칙 드로어·채널 폼의 단계 |
| 선택지·체크박스 제목 → 설명 | 4px, 설명 12/18 | V1 | `OptionText`(`components/common`) — 업타임 추가의 `다운되면 알림`, 대상 추가·서버 합치기·대상 옮기기의 선택지, 상세 수집의 바디 수집 |
| 제목 → 설명(단계 머리, 미리보기 머리, 설정 행) | 4px | V1 | `mt-1` |
| 페이지 폼의 마지막 필드 → 버튼 | 24px | V5 | 대화 상자는 바닥 줄(구분선 + `px-6 py-4`) |

손으로 라벨과 입력을 쌓지 않는다(`space-y-1.5` + `<label>`): `Field`를 쓴다. 라벨만 있고 연결할 입력이 없는 묶음(세그먼트 선택 등)은 `type-label text-text-muted` 라벨 + `mt-1` 설명 + 조작까지 `space-y-2`다(Docker 연결의 `수집 범위`). 대화 상자의 바닥 버튼은 본문 안에 두지 않는다 — Docker 연결 모달만 구분선 없이 본문 안에 있었다.

**검증은 브라우저 말풍선이 아니라 필드 아래 문구다** (2026-11-20, UI/UX 점검 A5). 폼에 `noValidate`를 걸고 `required`·`pattern`·`min`·`max` 대신 제출할 때 직접 검사한다. 오류는 `Field`(`features/alerts/components/FormLayout.tsx`)의 `error`로 보이고, `Field`가 입력에 `aria-invalid`·`aria-describedby`를 잇는다. 첫 오류 칸으로 포커스를 옮기고, 그 칸을 고치면 오류를 지운다. 입력의 `title` 툴팁으로 규칙을 알리지 않는다. 이전에는 알림 폼만 이 방식이었고 서버·업타임·그룹·텔레메트리·로그인 폼은 브라우저 말풍선을 써서, 말풍선이 몇 초 뒤 사라지고 `title` 툴팁이 그 위에 겹쳤다. 문구는 마침표 없이 `서버 이름을 입력하세요`, `1~65535 사이의 포트를 입력하세요`처럼 할 일을 말한다.

보더는 선이라 채움 역할(§1.4)이다. 2026-11-13까지 `border-red-500`·`border-amber-400` primitive였고, `Textarea`의 기본 보더는 `ui-control-border`가 아니라 장식용 `ui-border`(1.40:1)였다.

**입력의 글자는 `sm` 미만에서 16px다** (`Input`·`Textarea`·`SearchInput`·명령 팔레트, `max-sm:text-base`). 버튼인 `Select` 트리거는 확대와 무관해서 `FIELD_SHELL`에는 넣지 않는다. iOS Safari는 글자가 16px 미만인 입력에 포커스하면 화면을 확대하고, 입력을 마쳐도 원래 배율로 돌아오지 않는다. 뷰포트에 `maximum-scale=1`을 거는 우회는 사용자의 확대 자체를 막으므로 쓰지 않는다(WCAG 1.4.4).

보더 색은 컴포넌트 내부에서 결정한다. `className`으로 넘기면 base의 `border-ui-control-border`와 **특이도가 같아** 생성된 CSS 순서로 승패가 갈린다 — 호출부가 이길 거라 가정하면 안 된다.

**포커스 링** — `index.css`의 전역 `:focus-visible { outline: 2px solid var(--color-action) }`가 처리한다. `focus:outline-none` + 개별 `focus:ring-*`으로 덮어쓰지 않는다.

> 대비를 스크립트로 잴 때 주의: Tailwind v4의 `transition-colors`는 **`outline-color`를 포함**한다. `.focus()` 직후 `getComputedStyle`을 읽으면 트랜지션 첫 프레임(`currentColor`)이 잡혀 링이 검게 보인다. `transitionProperty='none'`으로 끄고 재야 실제 값이 나온다.

**목록 툴바 필터도 `Select`를 사용한다.** `ListToolbar`의 검색창·버튼과 같은 40px 높이로 맞추며, 시각 라벨이 없으면 `aria-label`을 지정한다. 필터 폭은 `wrapperClassName`으로 바깥 래퍼에 지정한다. 조회 제어의 위치와 폭은 §4.1을 따른다.

**텍스트영역**은 `Textarea`(`components/common/Textarea.tsx`)다. `FIELD_SHELL`에 자기 `py`만 덧붙인다.

**`Field`** (`features/alerts/components/FormLayout.tsx`) — 라벨 + 입력 + 에러/힌트 한 묶음. 도움말(`hint`)은 읽는 문장이라 `type-body text-text-muted`다 — `dim`은 메타·placeholder 전용(§1.3)이고, 2026-11-14까지 모든 폼의 도움말이 `dim`이었다. `htmlFor`를 줄 때만 `<label>`로, 없으면 `<span>` 캡션으로 렌더한다(자식이 버튼 그리드면 `<label>`이 첫 버튼을 눌러버린다). 한글 라벨·힌트에 `uppercase`·`italic`을 걸지 않는다 — 한글에는 대문자가 없어 자간만 벌어지고, 기울임 글리프가 없어 브라우저가 가짜 기울임을 만든다.

---

## 7. 오버레이

### 공통 툴팁

짧은 hover 힌트는 `Tooltip`을 쓴다. `Button`·`ButtonLink`·`CopyButton`·`Input`·`Select`·`Toggle`의 `title` prop과 `IconButton`의 `label`은 공통 툴팁으로 표시하며, DOM에 네이티브 `title`을 남기지 않는다. 일반 요소는 `<Tooltip content="설명" focusable><span>값</span></Tooltip>`으로 연결한다. 독립된 읽기 전용 정보에는 `focusable`을 주고, 버튼·링크 내부나 스파크라인의 각 막대에는 Tab 지점을 추가하지 않는다. 차트의 `ChartTooltip`은 데이터 탐색용으로 유지한다.

- 표면은 `bg-ui-raised`·`text-text-base`·`border-ui-border`, 모서리는 `rounded-md`, 그림자는 `shadow-lg`다. 짧은 힌트는 12px, 최대 폭은 320px이며 긴 문자열과 여러 줄을 허용한다.
- `TooltipProvider`가 최초 hover 400ms·닫기 100ms 지연을 공유한다. 키보드 포커스에서는 바로 표시한다. 힌트 위로 마우스를 옮겨도 유지하고 Escape·클릭·포커스 이탈로 닫는다.
- Floating UI로 위쪽 배치를 우선하고 화면 경계에서는 뒤집거나 옮긴다. portal과 `z-[70]`으로 표·카드의 clipping을 피하며, 네이티브 `<dialog>` 안에서는 같은 dialog로 portal한다.
- `role="tooltip"`·`aria-describedby`로 연결하고 기존 설명 ID를 보존한다. 포커스를 이동하거나 가두지 않으며 `useOverlay`를 사용하지 않는다. 첫 Escape는 툴팁만 닫고, 이후 Escape는 상위 모달이 처리한다.

| 종류 | 용도 | 구현 |
|------|------|------|
| **ConfirmDialog** | 파괴적 확인 | `components/common/ConfirmDialog` |
| **모달** | 짧은 단일 작업 (API Key, 서비스 추가) | `features/services/*Modal` |
| **사이드 패널** | 긴 폼·상세 (알림 규칙, 트레이스) | `FormSidePanel` / `TracePanel` |

**공통 규약** — z-index `z-50`, 배경 클릭 닫기. 표면 색은 §3.5(스크림 위 = `bg-surface`).

**z-index 단계** (2026-11-13 기록). 새 값을 만들지 않고 이 중에서 고른다. 위 단계일수록 아래 단계를 덮어야 하는 이유가 있다.

| 값 | 자리 |
|---|---|
| `z-10` | 컴포넌트 안의 국소 겹침: 카드 안 더보기 메뉴, 헤더 내부, 폼 페이지 하단 고정 제출 바 |
| `z-30` | 모바일 하단 내비(`BottomNavMobile`) |
| `z-50` | 오버레이: 모달·사이드 패널·명령 팔레트, 네트워크 상태 배너, 설계안 비교 막대 |
| `z-[60]` | `Select` 목록 — 모달 안에서 열리므로 모달보다 위 |
| `z-[70]` | 공통 툴팁 — 목록·모달 위에서도 보여야 한다 |
| `z-100` | 스킵 링크(포커스됐을 때만 보임) |

토스트는 react-hot-toast의 기본값(9999)을 그대로 둔다. 어떤 오버레이가 열려 있어도 작업 결과가 보여야 한다.

**푸터 규칙 (2026-09-23)** — 모달·다이얼로그·사이드 패널·폼 페이지가 전부 같다.

| 항목 | 규칙 |
|---|---|
| 정렬 | 우측 정렬. 모달은 위 구분선, 사이드 패널·폼 페이지는 하단 고정 바. 50:50 전체 폭 배치는 쓰지 않는다 |
| 순서 | [보조] [취소] [주 액션] — **주 액션은 항상 오른쪽 끝.** 이탈 버튼이 주 액션 자리에 오지 않는다 |
| 변형 | 취소 `secondary`, 주 액션 `primary`, 삭제 확인 `danger`. 정보만 보여주는 다이얼로그는 `닫기`(`quiet`) 하나 |
| 라벨 | 생성 `추가` / 편집 `저장` (명사형). 진행 중은 `loading` — 라벨은 그대로, 스피너만 붙는다 |
| 아이콘 | 생성 버튼에만 `add`. 저장·확인에는 붙이지 않는다 |
| X 닫기 | `<IconButton icon="close" label="닫기" tone="quiet" />` — 모달 헤더는 `size="sm"` |

알림 규칙·채널 폼의 제출 바는 `FormActions`(`FormLayout.tsx`)가 이 규칙을 담고 있다. 같은 폼이 데스크톱에서는 사이드 패널, 모바일에서는 전용 페이지(`ChannelFormPage`)로 열려도 제출 바는 둘 다 하단 우측이다.

**비네이티브 오버레이는 [`useOverlay(open, onClose, overlayRef)`](src/hooks/useOverlay.ts)를 쓴다.** 직접 `keydown` 리스너를 달지 않는다. `overlayRef`를 넘겨 Escape, 최초 포커스, Tab 순환, 트리거 포커스 복귀를 함께 보장한다. 네이티브 `ConfirmDialog`는 `<dialog>`의 동작을 쓴다.

**배경(scrim)은 상수를 쓴다.** 같은 파일이 export한다.

| 상수 | 값 | 쓰는 곳 |
|------|-----|--------|
| `SCRIM_MODAL` | `bg-slate-900/60 backdrop-blur-sm` | 모달·다이얼로그 |
| `SCRIM_PANEL` | `bg-slate-900/40 backdrop-blur-sm` | 사이드패널·팔레트 |
| `SCRIM_MODAL_DIALOG` | 위와 같은 값의 `backdrop:` 형태 | 네이티브 `<dialog>`의 `::backdrop` |

**농도가 두 단인 이유** — 모달은 배경과 무관한 작업이라 맥락을 끊고, 사이드패널은 배경 목록을 보면서 상세를 확인하는 맥락이라 옅게 둔다.

**Material Design 3(32%)이나 shadcn(80%)과 다른 이유는 blur를 같이 걸기 때문이다.** scrim만 쓰는 시스템은 배경 판독을 막으려 60~80%가 필요하지만, `backdrop-blur`가 이미 판독을 막으므로 scrim은 명도만 낮추면 된다 — 그 구간이 30~40%다.

`bg-black`이 아니라 `slate-900`인 것도 의도다. 다크 배경(`#111113`) 위에서 순수 검정은 대비가 생기지 않아 구멍처럼 보이고, 앱 팔레트가 slate 계열이라 정합도 맞다.

`SCRIM_MODAL_DIALOG`가 따로 있는 이유는 `backdrop:` 접두가 유틸리티마다 필요한데 Tailwind JIT가 런타임 조합을 못 읽기 때문이다. **값을 바꿀 때 둘을 함께 고칠 것.**

스크롤 잠금은 넣지 않았다. 이 앱은 `body`가 아니라 `MainLayout` 내부 컨테이너가 스크롤하는 구조라 `body` overflow를 잠가도 효과가 없고, 브라우저에서 실제 스크롤 누출이 재현되지 않았다. 누출이 확인되면 그때 잠글 대상을 정한다.

### 오류 문구 (2026-11-20)

사용자에게 보이는 오류 문구는 모두 `utils/errors.ts`의 `getErrorMessage`를 거친다 — 토스트, 조회 실패 배너의 설명, 폼 아래 문구. 서버의 원문 메시지(영어)와 브라우저 문구(`Failed to fetch`)는 그대로 보이지 않는다(UI/UX 점검 A2). 코드가 사전(`ERROR_MESSAGES`)에 있으면 그 문구, 서버에 닿지 못했으면 `서버에 연결하지 못했습니다…`, 코드 없이 5xx면 `서버 오류가 발생했습니다…`, 나머지는 `알 수 없는 오류가 발생했습니다.`다. 앱이 직접 쓴 한국어 문구는 그대로 지난다.

이름을 찾지 못한 대상은 내부 ID만 맨 글자로 두지 않는다. `이름을 불러오지 못한 대상`(목록을 다 받지 못함) 또는 `삭제된 대상`(목록을 다 받았는데 없음) 뒤에 ID를 `text-text-dim`으로 붙인다(`RuleTargetName`). 한 줄로 말줄임하는 표 칸에서는 ID를 다음 줄에 둔다.

조회에 실패해 목록이 비었으면 오류 배너만 둔다. 빈 상태(연결 안내)나 `검색 결과가 없습니다`를 함께 보이지 않는다 — 검색하지 않았고, 비었는지도 모른다(UI/UX 점검 A1).

### 토스트 (2026-11-13)

토스트는 **방금 한 작업의 결과**를 알리는 일시 피드백이다. 저장·삭제·복사의 성공, 서버가 거절한 작업의 실패가 여기에 해당한다. 설정은 `main.tsx`의 `Toaster` 한 곳에 있다.

| 항목 | 규칙 |
|---|---|
| 위치 | 우측 상단 |
| 표면 | `--toast-bg` = `ui-raised`, 보더 `ui-border`(§3.5, 스크림 없이 뜨는 표면) |
| 아이콘 | 성공 `status-healthy-fill`, 실패 `status-error-fill`. 아이콘 안 체크는 표면색으로 뚫는다 |
| 시간 | 성공 3초, 실패 5초. 마우스를 올리면 멈춘다(라이브러리 기본) |
| 문장부호 | 작업이 끝났다는 한 문장의 결과 알림은 마침표 없이 끝낸다(`서버를 삭제했습니다`, `업타임 모니터 2개를 삭제했습니다`). 두 문장인 안내는 문장 사이와 끝에 마침표를 둔다(`복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.`). 2026-11-19에 다수(마침표 없음)로 맞췄다. 오류 문구 사전(`utils/errors.ts`의 `ERROR_MESSAGES`)은 마침표로 끝나 그대로 실패 토스트에 실린다(§10.H) |

- **지속되는 상태는 토스트가 아니다.** 네트워크 끊김, 수집 중단, 조회 실패처럼 사용자가 떠나 있다 돌아와도 알아야 하는 것은 그 자리의 배너다(`NetworkStatusBanner`, §4.1 `다시 시도` 배너).
- **검증 실패를 토스트로만 알리지 않는다.** 필드 아래의 인라인 메시지(§6 `invalid`)가 정본이고, 토스트는 화면 밖 필드를 알리는 요약이다.
- **나중에 다시 봐야 할 정보를 담지 않는다.** API Key, 설치 명령처럼 복사해 쓸 값은 사라지면 다시 볼 수 없으므로 다이얼로그나 결과 화면에 둔다. 복사 실패 토스트는 "직접 선택해 복사"를 안내하되 값 자체는 화면에 남아 있어야 한다.

---

## 8. 접근성

- **전역 포커스 링** `:focus-visible` 2px `action` + 2px offset. 개별 컴포넌트에서 재정의 금지. 2026-11-13까지 primary였는데, 다크 배경에서 3.38~3.62로 3:1 하한에 붙어 있었고 `ui-raised` 위에서는 2.51로 미달이었다. `action`은 라이트 5.27~6.00, 다크 6.34~9.15다
- **잘라 내는 컨테이너 안의 포커스 링에는 여백을 둔다** (2026-11-19). 링은 요소 바깥 4px(2px + offset 2px)에 그려지므로 `overflow`가 걸린 스크롤 영역이나 화면 가장자리에 붙은 항목은 링이 잘린다. 그 안쪽에 링이 들어갈 여백을 둔다: 사이드바 nav의 `py-1`, 로고 링크를 블록 가장자리에서 띄운 `px-3` 블록 + 링크의 `px-1`, 모바일 하단 내비의 `px-1 pt-1`, 탭 목록과 앱 선택 영역의 `p-1` + `-m-1`(§4.6). 자리를 바꾸지 않으려면 같은 값의 음수 마진으로 끌어당긴다
- **네이티브 컨트롤도 테마를 따른다** — `:root`는 `color-scheme: light`, `.dark`는 `color-scheme: dark`다. 선언이 없던 때는 다크 모드에서도 체크박스(`accent-primary`)의 빈 칸, 자동완성 배경, 기본 스크롤바가 라이트로 그려졌다
- **강제 색상 모드(Windows 고대비)** — 브라우저가 배경색을 지워 상태 점·게이지·체크 띠가 사라진다. `index.css`가 `bg-status-*-fill`을 쓰는 요소에만 `forced-color-adjust: none`을 걸어 색을 남긴다. 라벨 없는 점(§5.2)은 그 색이 유일한 시각 정보다. 새 상태 채움이 이 이름을 벗어나면 고대비 모드에서 사라진다
- **문장 안의 링크는 밑줄을 긋는다** — `action`과 본문 글자의 대비는 라이트 1.91, 다크 1.27로 3:1에 못 미친다. 색만으로는 링크와 주변 글자를 구분하지 못한다(WCAG 1.4.1). 표 셀 제목, 내비, 아이콘이 붙은 독립 링크처럼 자리가 링크임을 말하는 곳은 예외다. 2026-11-13 기준 문장 안 링크(`DockerEnvironmentHint` — 2026-11-15 삭제, 연결 다이얼로그의 안내문 등)는 이미 `underline underline-offset-2`를 쓰고 있었고, 이 규칙은 그 관례를 명문화한 것이다
- **Skip link** `MainLayout`의 `#main-content` 스킵 링크
- **아이콘 전용 버튼**은 `aria-label` 필수 — `MaterialIcon`이 `aria-hidden="true"`라 아이콘만으로는 스크린리더에 아무것도 읽히지 않는다. 공통 툴팁은 이름을 대체하지 않는다. `IconButton`은 `label`로 접근 가능한 이름과 힌트를 함께 제공한다. `<span className="sr-only">`로 라벨을 넣는 것도 동등하게 유효하다
- **색만으로 정보를 전달하지 않는다** (WCAG 1.4.1) — 상태 점은 §5.2, 4개 초과 차트 시리즈는 §1.6 참조
- **클릭되는 것은 키보드로도 되어야 한다** — `<div onClick>`은 탭으로 도달할 수 없다. 네이티브 `<button>`/`<a>`로 바꿀 수 없는 자리(카드 안에 버튼이 중첩)는 [`activatable()`](src/utils/a11y.ts). **`<tr>`·`<th>`에는 쓰지 말 것** — `role="button"`이 테이블 시맨틱을 덮어써 행·열 관계를 잃는다. 정렬 헤더는 `<th>` 안에 `<button>` + `aria-sort`, 선택 가능한 행은 `tabIndex` + 키핸들러만.
- **폼 컨트롤에는 접근 가능한 이름을 준다** — 라벨이 붙는 자리는 `<label htmlFor>`, 툴바 필터 셀렉트처럼 시각 라벨이 없는 자리는 `aria-label`. `Field`는 `htmlFor`를 줄 때만 `<label>`로 렌더한다(§6) — 자식이 버튼 그리드면 `<label>`이 첫 버튼을 눌러버리므로 `<span>` 캡션 + 그룹에 `role="group"`이 맞다.
- **렌더 중 부작용 금지** — 렌더 본문에서 `navigate()`를 부르거나 ref를 갱신하지 않는다. React가 렌더를 버릴 수 있어 커밋되지 않은 상태가 샌다. 리다이렉트는 `<Navigate>`, ref 갱신은 effect에서.
- **Toggle** `role="switch"` + `aria-checked`
- **`prefers-reduced-motion`** 전역 처리됨 (모든 애니메이션 0.01ms)
- **대비** 작은 메타·placeholder도 일반 텍스트 기준 4.5:1을 만족해야 한다. `text-text-dim`의 다크 값 `#8b8f97`는 페이지·카드·hover 배경에서 검증했다. 더 밝은 표면에서는 `base` 또는 `secondary`를 사용한다 (§1.3).

---

## 9. 금지 사항

사용자 피드백에서 확정된 규칙이다. 근거까지 함께 적는다.

1. **카드 좌측 상태 보더 금지** — warn/crit 3px 세로 컬러 라인. *"AI 생성 디자인 같다."* 상태는 배지·아이콘·텍스트 색으로만.
2. **danger zone 스타일 금지** — 붉은 카드 보더, 붉은 섹션 제목, 앰버 경고 박스. 파괴적 액션은 **중립 카드 + `<Button variant="destructive">`**(채움 없는 `status-error` 텍스트). `text-red-600` 텍스트 링크는 다크에서 표면 대비 3.0이라 쓰지 않는다(§10 경계표). 주의문은 앰버 박스 대신 muted 본문.
3. **파스텔 틴트 박스 금지** — `bg-emerald-50` / `bg-amber-50` / `bg-red-50` 계열 공지 박스. `bg-ui-hover-soft + border-ui-border` + 상태색 아이콘 악센트로 대체. (배지·게이지 채움·hover·장애 행 채움(§4.5 서버 목록)은 데이터 시맨틱이라 예외)
4. **`dark:` 이중 작성 금지** (§1.1) — `text-slate-500 dark:text-text-muted-dark` → `text-text-muted`
5. **상태색 primitive 직접 사용 금지** — `text-emerald-600 dark:text-emerald-400` → `text-status-healthy` (§1.4). 대비·색각 조정이 index.css 한 곳에서 끝나야 한다. 점·막대·보더처럼 글자가 아닌 표시는 `bg-status-*-fill`이다 — 글자 토큰을 단색 채움에 쓰지 않는다(`pnpm lint`가 센다)
6. **`text-[Npx]` 임의값 금지** (§2.2) — 스케일 토큰만
7. **버튼 클래스 직접 작성 금지** — `<button className="px-4 py-2 bg-primary …">` → `<Button>` (§4.1). 높이·radius·굵기가 화면마다 어긋나는 것을 막는다. 아이콘만 있는 액션은 `IconButton`이다 — `text-slate-400 hover:text-primary` 문자열을 손으로 쓰지 않는다
7a. **버튼 색을 `className`으로 덮어쓰기 금지** (§4.1) — variant로 고른다. Tailwind 유틸리티 순서 때문에 override가 조용히 무시된다
8. **`window.confirm()`·`confirm()` 금지** → `ConfirmDialog`
9. **recharts `<Legend>` 금지** → `ChartStatsLegend` / `ChartLegend`
10. **차트 시리즈 색 하드코딩 금지** → `SERIES_HEX`
11. **텍스트 위계에 5단째(더 옅은 등급) 추가 금지** — `dim`이 AA 하한선이다 (§1.3)
12. **대상의 상태를 배지로 표시 금지** (§5.1) — 정상/장애/수집 상태는 `StatusLight`(점 + 라벨). 배지는 표 컬럼의 고정 어휘 토큰 전용이다. 배지 안에서도 보더·배경·텍스트 색 3중 적용 금지 — 강조 수단은 택1. *"초등학생 디자인 같다."* `/20` 보더는 대비 1.33~1.64라 보이지도 않으면서 스티커 테두리 느낌만 남긴다
13. **분류 축을 칩으로 만들지 않기** (§5.3) — 출처·종류 라벨은 배경 없는 `type-caption text-text-muted`. 칩은 상태 전용이다. 중립 칩도 안 되는 이유는 §5.3 참조(`status-idle`과 `text-muted`가 같은 색)
14. **카드 안에 좌측 기준선 2개 금지** (§4.1) — 부제·본문은 아이콘 거터가 아니라 카드 패딩에 정렬한다

15. **기술 용어를 한글로 번역하지 않기** — 사용자는 개발자다. 업계에서 영어로 부르는 말은 영어 그대로 쓴다(2026-09-24, *"개발자가 쓰는 용어를 쓰라고"*). `API Key`(수집 키·API 키 ✗) · `Docker Collector`(수집기·Agent ✗ — [ADR 0005](../../docs/adr/0005-docker-environment-and-collector-product-terminology.md), 문맥상 분명하면 `Collector`) · `attribute`(속성 ✗) · `Span`(스팬 ✗) · `Endpoint`(엔드포인트 ✗) · `Webhook`·`Bot Token`(웹훅·봇 토큰 ✗) · `URL`/`Host`(대상 ✗). 라벨·제목의 첫 영어 단어는 대문자(`Bot Token`), 문장 안의 일반명사는 소문자(`exporter`). **반대로, 영어로 옮겨도 어색한 OTel 개념어는 하는 일을 한국어로 말한다** — 원어도 번역어도 사용자에게 낯설기 때문이다: signal → `데이터`·`데이터 유형`(`Signals` 라벨은 `수집 데이터`), API tracing → `API 요청 수집`(메뉴명 `API 요청`과 같은 말), trace context propagation → `서비스 간 트레이스 연결`, distributed tracing → `분산 트레이싱`, 헤더·바디 instrumentation 주입 → `상세 수집`(`상세 수집 설정`·`상세 수집 적용 결과`). `계측`·`추적`·`신호`는 쓰지 않는다. 이미 한국어로 굳은 음차(로그·메트릭·트레이스·업타임)와 일반어(응답 시간·임계값·환경 변수·대상 목록)는 그대로 둔다. 외부 서비스 화면의 문구를 인용할 때(Discord의 `새 웹후크`)는 그 화면의 표기를 따른다.

16. **대문자 라벨·넓은 자간·가운뎃점 연쇄·UI 문구의 줄표·마침표 셋 금지** (§2.5) — Hallmark sloplint가 AI 생성 티로 잡는 조판 습관이다(2026-10-27, [ADR 0009](../../docs/adr/0009-hallmark-label-and-punctuation-rules.md)). `transition-all`도 금지다 — 바뀌는 속성을 `transition-colors`처럼 이름으로 고른다

1~3, 12~13은 같은 취향의 계열이다: **색은 데이터와 액션에만, 컨테이너는 중립.**

---

## 10. 알려진 부채

**`pnpm lint`가 일부를 센다** — [`scripts/check-design-rules.mjs`](scripts/check-design-rules.mjs). §9의 기계적으로 셀 수 있는 금지 패턴과 스케일 밖 간격 `gap-2.5`·`gap-3.5`(§3.7, 2026-10-10 0건 달성)는 0건이어야 하고, 간격 체계 규칙 S1~S8(§10.I, 2026-11-21 P6부터)도 0건이어야 한다. `*-dark` 직접 사용·`slate-*`·`bg-white`는 현재 건수가 상한이다(늘면 CI 실패, 줄면 상한을 같이 내린다). 새 금지 규칙을 §9에 추가할 때 셀 수 있으면 거기에도 추가한다.

2026-07-26 전수 스캔(`src/**/*.tsx` 76개). 규약 대비 이탈 목록. 2026-09-23 재집계: `dark:` 변형 82건/22파일(대부분 primitive 축 — 아래 B), `slate-*` 하드코딩 117건/18파일. 2026-10-09 재집계(127파일): `dark:` 69건/19파일, `slate-*` 77건/17파일, `*-dark` 접미 토큰 직접 사용 19건 — 남은 덩어리는 `AlertRuleForm`·`ChannelForm`·`TracePanel`이다.

### A. 토큰 규약 이탈

| 항목 | 건수 | 조치 |
|------|------|------|
| 시맨틱 토큰 + `dark:` 짝 | 10 | `dark:` 제거 |
| `*-dark` 접미 토큰 직접 사용 | 37 | 사이트별 확인 후 치환 |
| `bg-white` / `slate-*` 하드코딩 | 109 | 상태색 목적이 아니면 토큰으로 |
| emerald/amber/red/sky primitive | 214 | **대부분 정상** — 아래 B 경계 참조 |

**대부분은 색 문제가 아니라 다른 문제의 증상이었다.** 2026-07-27에 225건을 분류해 다섯 덩어리를 걷어냈다.

| 원인 | 해소 |
|------|------|
| 토큰이 이미 전환하는데 `dark:` 짝을 덧붙임 | 5 |
| `FormStep`·`Field` 중복 정의 | 6 (64줄) |
| 이름 없는 "떠오른 표면" 역할 | 8 → `ui-raised` 신설 |
| 카드 정본과 등가인 하드코딩 | 3 |
| 헤더 스트립 = `ui-hover-soft`의 투명도 변형 | 7 |
| 크롬 표면이 Sidebar와 불일치 | 4 → `bg-bg-surface`로 정합 |

**남은 것은 1회성이고 시각 변화가 따른다.** 반복되는 역할은 다 걷어냈으므로, 이제부터는 한 곳씩 열어 "이 색이 의도인가"를 판단해야 한다 — 자동화할 수 있는 구간은 끝났다.

새 이탈을 발견하면 색을 치환하기 전에 **역할에 이름이 없는지, 컴포넌트가 중복인지**부터 의심할 것.

**기계적 일괄 치환이 안 되는 이유** — 라이트/다크 클래스가 문자열 안에서 인접해 있지 않고(`bg-white … dark:bg-ui-active-dark`), 값이 토큰과 정확히 같지도 않다. 예를 들어 `bg-white dark:bg-ui-active-dark`는 라이트 `#fff`·다크 `#374151`인데 이런 토큰 쌍은 없다. 토큰과 값이 정확히 일치하는 쌍(6파일)은 2026-07-26에 이미 치환했고, 남은 것은 **사이트별로 의도를 확인해야** 한다.

### B. 상태색 primitive — 대부분 정상

**상태색 primitive 214건은 일괄 치환 대상이 아니다.** 2026-07-26에 374건을 전수 분류해 상태에 해당하는 160건만 `status-*` 토큰으로 옮겼고, 남은 214건은 의도적으로 primitive다. 경계:

| 축 | 예 | 토큰 |
|----|-----|------|
| **대상의 정상/장애 여부** | 서비스 정상/장애, 체크 결과, HTTP 2xx/4xx/5xx, 게이지 임계, 알림 전송 성공/실패, 진단 ok/issue | **`status-*` ✓** |
| 액션 의미 | 채움 `danger` 버튼 | **`danger` ✓** (§1.4) |
| 액션 의미 | 복사 완료 피드백 | primitive |
| 채움 없는 파괴 액션 | `destructive` 버튼·`IconButton tone="danger"` | **`status-error` ✓** — 다크에서 red-600은 표면 대비 3.0이라 primitive로는 AA를 못 맞춘다 |
| 카테고리 분류 | HTTP 메서드, span kind(SERVER/CLIENT), 이벤트 타입 | primitive |
| 별도 축 | 로그 레벨 info·debug·trace(§1.5), 알림 severity info | primitive |
| 별도 축이지만 뜻이 상태와 같음 | 로그 레벨 error·warn(§1.5), 알림 severity critical·warning(`SEVERITY_TONE`) | **`status-*` ✓** |
| 폼 | 필수 표시 `*`, 로그인 에러 | primitive (입력 검증 보더는 `status-*-fill` ✓) |
| 3rd-party 재현 | `ChannelForm`의 Slack/Discord/Telegram 미리보기 | 리터럴 hex |

새 코드에서 판단이 서지 않으면 **"이 색이 사라지면 사용자가 대상의 정상/장애를 오판하는가?"** 로 가른다. 그렇다면 `status-*`다.

### C. `Field` htmlFor 배선 — 완료 (2026-08-05)

`AlertRuleForm`의 단일 입력 Field들(규칙명·연산자·임계값·지속시간·쿨다운 등)까지 `htmlFor` + `id` 배선을 마쳤다. raw Field 라벨 잔여 0건.

버튼 그리드 Field(카테고리·프리셋·심각도)는 `<label>` 대상이 아니다. 그룹 자체에 `role="group"` + `aria-label`을 다는 것이 맞고, 이건 `Field`가 아니라 호출부 마크업 변경이라 별도 판단이 필요하다.

### ~~배지 크기 — 정리하지 않기로 함~~ → 11px 폐지로 해소

~~읽기 전용 배지가 `text-2xs`(상태칩·테이블)와 `text-xs`(로그 레벨·span kind) 두 계열이다.~~ **11px 등급을 폐지하면서 배지가 `text-xs` 한 계열로 통일됐다.** 아래는 당시 판단 기록이다. 크기 차이가 밀도(테이블 셀 vs 목록 스캔) 때문이라 강제로 맞추면 로그 레벨 배지가 작아지는 손해만 확실하다.

> 이전에 "같은 severity 배지가 폼과 테이블에서 등급이 다르다"고 적었던 것은 **오진이었다.** 폼 쪽은 배지가 아니라 알림이 어떻게 보일지 보여주는 미리보기 카드(틴트 배경 + 점 + 보더)로, 목적과 형태가 다른 물건이다. 실제 중복이던 `SEVERITY_BADGE` 상수는 `SeverityBadge` 컴포넌트로 통합했다. (2026-11-13: 미리보기 카드도 중립 표면 위에 `SeverityBadge`를 놓는 형태로 바뀌어 severity 색은 한 벌만 남았다.)

### D. 카드 서브블록 radius 미전환 — 27건 (2026-09-20)

§3.2에 동심 규칙을 세우면서 §3.1의 서브블록 정본이 `rounded-xl` → `rounded-md`로 바뀌었다. 기존 호출부 **27건**(`bg-ui-hover-soft` + `rounded-xl` 조합)은 전환하지 않았다 — 각 사이트가 실제로 카드 **안**에 중첩된 것인지, 아니면 그 자체가 최상위 패널인지 열어 봐야 갈리기 때문이다. 최상위 패널은 `rounded-xl`이 맞다.

밀집 파일: `AlertRuleForm`(5) · `InfrastructureCollectorSetupResult`(3) · `ChannelForm`(3) · `ApiKeyModal`(2) · `AddServiceModal`(2) · `InstrumentationOverrideModal`(2) · `DirectTelemetrySetupResult`(2). 해당 파일을 다른 일로 열 때 함께 판단한다.

### ~~E. 사이드바 활성 항목과 breadcrumb 섹션이 어긋난다 (2026-09-20)~~ → 담김 관계로 통일 (2026-09-23)

서비스 상세(`/services/:agentId/:key`)에서 사이드바는 **활성 탭**을 따라간다(`?tab=logs`면 `로그` 하이라이트). `AppHeader`는 **담김 관계**를 따라 `Docker 환경 › 에이전트 › 서비스`를 보여준다. 그래서 탭을 바꾸면 사이드바 하이라이트만 움직이고 breadcrumb은 그대로다.

둘 다 각자의 논리는 맞다 — 탭은 "무엇을 보고 있나"이고 breadcrumb은 "어디에 있나"다. 다만 화면에 동시에 보이면 어긋나 보인다. **결정: 사이드바를 breadcrumb에 맞췄다** — 서비스 상세는 어떤 탭이든 `Docker 환경`이 활성이다(§3.4). "탭은 위치가 아니다"라는 §3.4 원칙과 같은 방향이고, 사이드바의 탭별 active 판정(`detailActive`)은 제거했다.

### ~~경로 → 라벨 목록이 세 벌 (2026-09-20)~~ → 하나로 통합 (2026-10-10)

~~`Sidebar`의 `NavItem`, `CommandPalette`의 `page-*` 항목, 새 `navSections.ts`가 각자 경로→라벨을 갖고 있고 이미 어긋나 있다.~~ 실제로는 모바일 `MorePage`와 하단 내비까지 다섯 벌이었고, 라벨이 세 가지(`환경설정`·`설정`·`환경 설정`), 팔레트에는 Docker 환경이 없고, 모바일 더보기에는 업타임·로그·인프라가 빠져 있었다. 걱정했던 "탭별 active 판정"은 2026-09-23에 이미 없어졌고, 그룹 헤더는 데이터 필드(`group`)로, 개요 배지와 `/#attention` 링크는 사이드바 쪽 처리로 남겼다 — §3.4의 `navSections.ts` 단일 출처. 부수 효과로 모바일 하단 내비가 Docker 환경 상세(`/agents`·`/services`)에서도 `더보기`를 활성으로 표시한다(전에는 아무 탭도 활성이 아니었다).

### ~~F. 간격 스케일 이탈 (2026-10-09)~~ → 해소 (2026-10-10)

§3.7 신설 시점에 기록한 이탈은 화면별 점검(PR #38~#44)과 유형별 정리로 모두 고쳤다. `gap-2.5`·`gap-3.5`는 0건이 되어 `pnpm lint` 금지 규칙으로 옮겼다. 기록된 조치와 다르게 처리한 두 곳:

- 로그인 "계정 찾기" 패널 `p-5` → **`p-6`** — 바로 옆 로그인 카드가 `p-6`이라 짝을 맞췄다(§3.1의 여유 단계)
- 모바일 알림의 다시 시도 상자 `p-3` → **`px-4 py-3`** — 카드가 아니라 배너라 §3.7 배너 패딩을 따랐다

### G. 반응형·표·탭 이탈 (2026-10-09)

§3.8·§4.5·§4.6 신설 시점의 이탈이다.

| 항목 | 위치 | 조치 |
|------|------|------|
| 뷰 분기(`md`)와 셸 전환(`lg`)의 경계 불일치 | `useIsMobile` · `MainLayout` | **결정 필요** — §3.8 |

### H. 서버 개편 이후 (2026-11-19)

서버 중심 개편([ADR 0011](../../docs/adr/0011-servers-own-directly-configured-targets.md)) 점검에서 남긴 것이다. 옛 메뉴의 상세를 서버 탭으로 옮기면서 그대로 따라온 것이 많다.

**측정 조건**: 아래의 픽셀 값은 2026-11-19 설계 점검에서 데모 데이터로 잰 값이다. 첫 화면의 높이는 1440×1000 뷰포트, 터치 영역은 390px 폭에서 쟀다. 같은 날의 최종 수정(코드 커밋 11개) 뒤에 다시 잰 값이 아니다.

| 항목 | 위치 | 조치 |
|------|------|------|
| 첫 화면의 높이: API 요청 탭의 수치 타일이 629px, 앱이 2개인 메트릭 탭의 첫 차트가 615px에서 시작한다(목표 600px) | `DirectApiPanel` · `DirectMetricsPanel` · `AppSelector` | 머리말·탭 줄·패널 머리의 세로 간격을 함께 본다 |
| 모바일 터치 높이 44px 미달: 모니터 상세의 선택 컨트롤 28px(`SegmentedControl` sm: 응답 시간 범위, 장애 이력 구분), API 요청의 상태 코드 버튼 20px | `UptimeMonitorPanel` · API 요청 탭 | 옮겨 온 컴포넌트의 `sm` 컨트롤. `md`로 올리거나 터치 영역만 넓힌다(§4.1) |
| 대화 상자의 닫기 버튼이 모바일에서 32px | 모달 헤더의 `IconButton size="sm"`(§7 푸터 규칙) | 모바일만 `md`로 할지 결정 필요 |
| 알림 채널의 Telegram·Discord·Slack 아이콘이 유채색 | 알림 채널 화면 | 브랜드 아이콘이라 의도일 수 있다(§4.1 아이콘). 색을 데이터·상태에만 싣는 규칙(§5.3)과 맞출지 결정 필요 |
| 공용 `Select`가 열려 있을 때 방향키로 항목 사이를 옮길 수 없다 | `components/common/Select.tsx` | listbox 키보드 동작(↑/↓, Home/End, 첫 글자) |
| 알림 데스크톱 탭이 공용 `Tabs`를 쓰지 않는다(밑줄 모양은 같고 키보드 이동이 없다) | `AlertsDesktopView` | `Tabs`로 옮긴다(§4.6) |
| 명령 팔레트의 대상 표기가 `부모 / 대상`이 아니라 보조 칸의 `web-01의 모니터`, `prod-server의 Docker 서비스`다 | `CommandPalette` | §4.7 이름 형식과 맞출지 결정 필요 |
| 인프라 탭은 목록이 이전 정보(`stale`)이고 이전 목록에 리소스가 없을 때 불러오지 못했다는 안내가 아니라 연결 안내를 보인다 | `ServerInfrastructureTab` | 다른 탭처럼 `LoadErrorBanner inline`(§4.7 탭 본문의 진행 중·실패 상태) |
| 서버 추가 화면의 제출 버튼이 `서버 추가`다. 화면 제목(`서버 추가`)이 대상을 말하는 자리라 §4.1 규칙으로는 `추가`다 | `ServerFormPage` | `추가`로 바꾼다 |
| 오류 문구 사전이 마침표로 끝나 한 문장의 실패 토스트가 결과 알림 규칙(§7 토스트)과 다르다 | `utils/errors.ts`의 `ERROR_MESSAGES` | 실패 문구에도 같은 규칙을 적용할지 결정 필요 |

- ~~업타임 탭의 상태 요약이 서버 목록의 `FilterChips`가 아니라 옛 수치 행이다(2026-11-20)~~ → 해결(2026-11-21). 업타임 탭, Docker 환경, 그룹, 알림 규칙·발송 이력도 같은 칩이다(§4.5 목록 필터의 공통 규칙). 메뉴 제목의 개수도 서버 목록만이던 것을 Docker 환경·그룹에 넓혔다(§3.4).
- ~~생성 버튼 라벨에 대상이 붙어 있다: `서버 추가`(서버 목록 헤더, 빈 상태, 개요 온보딩), `업타임 모니터 추가`(대상이 없는 서버의 개요 탭)~~ → 해결(2026-11-19). 서버 목록의 머리말은 `추가`로 바꿨고, 나머지는 "대상을 말해 주는 화면 제목이 없는 자리" 예외로 §4.1 액션 앵커에 적었다.
- ~~화면 시각을 직접 조합하는 곳(Docker 서비스의 로그·트레이스·메트릭 탭, API 요청 결과, 응답 시간 카드, `TracePanel`의 `en-US`)~~ → 해결(2026-11-19). 모두 `incidentFormat.ts` 함수로 옮겼다. 남은 `toLocale*`는 §2.6의 표다.
- ~~패널의 상태 줄이 탭의 점과 다르게 말한다(임계값을 넘은 앱의 메트릭 패널이 `수집 중`, 이전 목록인데 지금의 상태처럼 보임)~~ → 해결(2026-11-19). 탭이 계산한 `PanelStatus`를 넘긴다(§4.1 서버 탭 안의 패널).

### ~~I. 간격 체계 이관 (2026-11-21)~~ → 완료 (2026-11-21, P6)

화면마다 간격을 다시 재지 않도록 간격을 관계 규칙으로 고르고 기계가 지키게 한다. 진단과 계획은 2026-11-21 간격 체계화 점검(소유자 승인)이다. P0~P5에서 `pnpm lint`가 아래 건수를 상한으로 세며 0건까지 내렸고, P6에서 모두 금지 규칙으로 옮겼다(§3.7 "기계가 지키는 것"). 아래 표와 기록은 각 규칙이 무엇을 세고 무엇을 빼는지의 근거로 남긴다.

| 규칙 | 무엇을 세나 | 2026-11-21 |
|---|---|---|
| S1 | 임의값 간격(`mt-[13px]`). 명령 팔레트의 `pt-[18vh]`만 허용 | 0 |
| S2 | 블록 사이 세로 반 단계(여백·`space-y`·`gap-y`만. 상자 안쪽 패딩과 음수 여백은 세지 않는다) | 55 → 58(P3) → 17(P4a) → 9(P4b) → **0(P4c)** |
| S3 | 화면 코드의 줄 상자 보정 `mt-0.5`. 제목 → 설명은 `mt-intra`, 첫 줄 맞춤은 `icon-lead`, 표 칸은 `cell`. 상자 안쪽 패딩(`py-2.5`)은 P4b부터 세지 않는다(S2와 같은 이유) | 113 → 111(P3) → 71(P4a) → 26(P4b) → **0(P4c)** |
| S4 | 여백만 가진 감싸개·조작(`className="mt-3"`). 밀어내기(`ml-auto`)와 음수 여백은 세지 않는다 | 54 → **0(P3, 금지)** |
| S5 | 컴포넌트 루트의 바깥 여백(TypeScript AST로 센다) | 9 → **0(P3, 금지)** |
| S6 | 역할 없는 글자 크기(`type-*`·`font-mono` 없는 `text-xs/sm/base`). 화면 코드만 센다: 프리미티브의 크기 표, 접두사 붙은 크기(`max-sm:text-base` 입력), 채널 미리보기 제외 | 150 → 155(P4b) → **0(P5)** |
| S7 | `leading-*` 직접 지정. 프리미티브 안쪽(`MaterialIcon`, 툴팁), 로고 워드마크, 채널 미리보기 제외 | 15 → **0(P5)** |
| S8 | 숫자 세로 간격(`space-y-N`, `flex-col`의 `gap-N`) → 관계 토큰으로 | 168 → 165(P1) → 194(P3, 값을 그대로 옮김) → 76(P4a) → 46(P4b) → **0(P4c)** |

2026-11-21 P1: 관계 토큰(`--spacing-intra` 등, §3.7)을 추가하고 공용 프리미티브(`Field`, `FormStep`, `OptionText`, `Stat`, `ListGroup`, `SectionHeader`, `PageHeader`, `ChartCard`, `SettingRow`, `page-stack`, `section-stack`)를 토큰 이름으로 바꿨다(측정 차이 0). 사용하지 않던 `SummaryCard`는 지웠다.

2026-11-21 P6(마무리): S1~S8을 금지 규칙으로 옮겼다(상한 없음). 인프라 차트의 캡션과 메트릭 단독 보기의 원본 이름은 `ChartCard`의 `description`이 되어 `KNOWN_OFF`가 비었다(인프라 캡션이 제목 쪽으로 4px, 차트 위치는 그대로). `servers-tabs-layout`의 첫 내용 상한은 화면 위 절대 좌표가 아니라 탭 줄 아래 거리로 바뀌었다.

2026-11-21 P5(글자 역할): 화면 코드의 원시 크기를 역할로 바꿨다. `text-xs` → `type-caption`(같은 12/16), 컨트롤·표 칸·한 줄 목록의 `text-sm` → 새 역할 `type-control`(14/20, 굵기는 정하지 않음), 문단(`p`·`li`)의 `text-sm` → `type-body`(14/21). 측정한 화면에서는 값이 같아 차이가 없었다. `type-body` 위에 덧씌운 `leading-relaxed`(22.75px) 4곳을 걷어 21px이 되었고, 로그인 화면의 설정 예시는 `font-mono type-caption-stack`이다. S6·S7이 0건이 되었다.

2026-11-21 P4c(Docker 환경·그룹·설정·로그인): 남은 화면의 숫자 세로 간격과 제목 → 설명 `mt-0.5`를 바꿔 S2·S3·S8이 모두 0건이 되었다. 로그인 폼의 필드 사이는 폼 리듬(§6)대로 16px(이전 12), 라벨 → 입력은 8px(이전 6)이다. 상한은 0이고 P6에서 금지 규칙으로 옮긴다.

2026-11-21 P4b(알림): 알림 규칙·채널·발송 이력 화면의 숫자 세로 간격을 관계 토큰으로 바꿨다. 채널 폼의 미리보기는 `ChannelPreview.tsx`로 떼어 규칙에서 뺐다. 모바일 발송 요약은 데스크톱과 같은 `Stat`(라벨 12px → 값 4px)이 되었고, 알림 규칙 드로어의 `textarea`는 `block`이라 입력 → 도움말이 4px이다(이전 10px, P2 `KNOWN_OFF`에서 지움).

2026-11-21 P4a(공용·모니터링 화면): 공용 컴포넌트와 서버·업타임·로그·메트릭·인프라·트레이스·Docker 서비스 화면의 숫자 세로 간격을 관계 토큰으로 바꿨다. 값이 토큰과 같은 자리(4·8·16·20·24·32)는 이름만 바꾸고, 12px(`space-y-3`)은 관계에 따라 `label`(8) 또는 `heading`(16)으로, 6·2px은 `intra`(4) 또는 `label`(8)로 옮겼다. 주요 변화: 상세 머리말 제목 → 메타 12 → 8, `DetailMeta` 상태 줄 → 속성 12 → 8, API 요청 탭의 절 제목 → 표 12 → 16, 제목 → 설명 2 → 4(+2), 사이드바·하단 내비 항목 사이 2 → 4.

2026-11-21 P3: 간격을 부모로 옮겼다(S4·S5 0건, 금지). `Section`이 제목 → 내용을, `ChartCard`가 머리 → 본문을, `ListGroup`이 목록 끝 조작(`ListMore`)의 자리를, `UptimeOverview`가 아래 이력과의 구분선을 갖는다. `ListToolbar`의 `mb-6`은 부모의 `page-stack`으로, 배너의 `mb-4` 감싸개는 배너와 내용을 묶은 `space-y-4`로 옮겼다. `Tabs`는 포커스 링 자리로 `-m-1`을 가져 부모의 간격이 닿지 않으므로 한 겹 감싼다. 값은 그대로 옮겨 화면은 바뀌지 않았다(메트릭 차트 → 범례 12 → 8px 한 곳만 바뀜). 그래서 토큰 밖 값이 부모의 `space-y-N`으로 옮겨져 S8이 165 → 194, S2가 55 → 58로 늘었고, P4에서 토큰으로 바꾸며 내린다(코디네이터 승인).

2026-11-21 P2: `e2e/spacing-rhythm.spec.ts`가 14개 화면 × 1440·390에서 관계 표지(`data-gap`, `data-gap-after`)의 박스 간격이 토큰 ±1px인지, 근접성 불변식(intra < label < heading < item ≤ group < section)을 지키는지 잰다. 재시도 없이 돈다. 지금 어긋난 자리(`KNOWN_OFF`: 인프라 차트 캡션의 `-mt-2`, 알림 규칙 드로어의 inline-block `textarea`)와 표지가 아직 없는 화면(`KNOWN_EMPTY`: 서버 개요 탭, 모바일 발송 이력)은 spec에 적혀 있고, 고치는 단계에서 지운다. 목록과 실제가 다르면 실패한다.

단계: P0 측정·래칫(이 표) → P1 관계 토큰과 프리미티브 → P2 관계 검사(e2e) → P3 부모가 간격을 갖게(S4·S5) → P4 메뉴별 세로 반 단계·숫자 간격(S2·S3·S8) → P5 글자 역할(S6·S7) → P6 모두 금지로 전환. 화면을 바꾸지 않는 단계는 `pnpm measure` 전후 비교(`node scripts/measure-layout.mjs --compare before.json after.json`)가 "차이 없음"이어야 한다.

### 해결됨 (2026-09-24) — 보편 디자인 시스템 대조 (버튼)

Carbon·Primer·Polaris·Material 3의 공통 원칙과 대조해 어긋난 것을 고쳤다.

- ~~primary hover가 밝아져 흰 글자 대비 4.54 → 3.80(AA 미달)~~ → `primary-hover` 토큰(더 진하게, 5.58)
- ~~이동을 `<button onClick={navigate}>`으로 처리 — 이동 버튼 9곳 · 빈 상태 7곳~~ → `ButtonLink`, `EmptyState` `action.to`
- ~~`disabled`가 이유 툴팁을 막음(시스템 규칙 삭제)~~ → `aria-disabled` 지원
- ~~진행 중 문구를 호출부마다 교체(`추가 중...`·`저장 중…`·스피너 3종)~~ → `Button loading` 하나
- ~~모바일 터치 영역 40px~~ → md 계열 전부 `sm` 미만 44px, `lg` 제거
- ~~`active:scale-95` + `transition-all`~~ → 색 변화만
- ~~라벨 말투 혼재(`추가하기` vs `저장`)~~ → 명사형 `추가`
- 이어서(같은 날): 상태 전환(`일시정지`·`연결 중지`)을 툴바에서 meta 줄의 상태 옆으로 — 툴바는 `수정 | 삭제` 짝만
- 이어서(같은 날): 툴바 버튼 모양 통일 — `destructive`에 테두리, 상세 툴바의 `ghost`(`일시정지`·`연결 중지`) → `secondary`, `일시정지`에 아이콘 복원, 모바일에서 `collapseLabel`로 아이콘만
- 보고서 후속: 파란 틴트 링크칩 6·텍스트 링크 버튼 4 → ghost sm, 계정 초기화 → `destructive`, 업타임 일시정지 목록·상세 → ghost 무아이콘, 남은 X 6·테마 토글 2 → `IconButton`(모바일 `Toggle theme` 영어 라벨 해소), 일회성 스타일 5(검정 테스트 전송·rounded-xl 복사/재발급·px/py 다시 시도·34px 재설치) → `Button`/`CopyButton`, `ApiKeyModal`의 `confirm()` → `ConfirmDialog`
- 남은 결정: 툴바 높이 혼재(조회 제어 sm 32), 토글 켜짐 표현 5종, 장애 배너 `로그 확인`의 danger

### 해결됨 (2026-11-14) — 메뉴별 대표 화면 레이아웃 점검

메뉴 18개 화면(데스크톱)과 모바일 3·다크 2장을 찍어 보고 고쳤다. 페이지 높이: 업타임 상세 1,628→1,374px, 로그 목록 2,166→1,276px, Docker 환경 상세 3,527→2,932px, 모바일 업타임 상세 2,052→1,673px.
- ~~보기 전환이 혼자 한 줄~~ → 섹션 제목 줄·탭 줄(§4.5)
- ~~트레이스 버튼 있는 행만 높음~~ → 행 높이 통일(§4.5)
- ~~오류 패턴 20행~~ → 상위 5 + 전체 보기
- ~~API 상세 툴바가 제목 위, 환경 상세 서비스 표 제목 없음~~ → 제목 → 툴바 → 표
- ~~업타임 상세 "현재 상태" 카드~~ → 상태 줄(§4.1), 모바일 속성 접기
- ~~완료된 환경의 설정 가이드가 첫 화면 절반~~ → 필수 완료 + 전부 수신 중이면 한 줄로 접힘(문제가 있으면 펼친 채)
- ~~메트릭 패널 머리 세 줄~~ → 원본 이름·종류를 요약과 한 행에
- ~~개요 "현재 확인 필요" 카드가 옆 카드 높이로 늘어남~~ → `items-start`

### 해결됨 (2026-11-14) — 크기·굵기·색 재점검

실제 화면 23개(라이트·다크, 1440·390)에서 글자 요소 10,296개의 계산된 크기·굵기·행간·색을 모으고 axe 대비 검사를 돌렸다. 굵기는 400·500·700만, 대비 위반은 0건이었다. 고친 것:
- ~~숫자 일곱 조합~~ → `type-kpi`·`type-stat`(§2.2)
- ~~12px 500·`text-sm font-medium` 역할 없음/우회~~ → `type-label-sm` 신설, `type-label`로 87곳 치환, 문단 `text-sm` 90곳 → `type-body`
- ~~`Field` 도움말 `dim`, 설명 문장 12px, 빈 상태·확인창 설명·오류 원인 문장 `dim` 8곳~~ → `type-body text-text-muted`(§1.3). `DetailMeta` 속성 라벨은 메타라 `dim` 유지
- ~~업타임 상세 평균 응답 `320.009ms`~~ → 정수 ms(§4.5, 목록과 같게)
- ~~조회 실패 문장 경고색 10곳~~ → `LoadErrorBanner`(§4.1)
- ~~`선택 기능` 보라색 칩~~ → 중립(§5.3)
- 남김: 로고 워드마크(사이드바 18px 기본색, 로그인 24px primary), API 요청 표 본문 12px(기계 문자열 표로 본다, §4.5), 12px이 전체 글자의 약 절반이라는 밀도

### 해결됨 (2026-11-13) — 상태색 역할 분리 · 떠 있는 표면 · 기본 상태

[ADR 0010](../../docs/adr/0010-status-color-roles-and-floating-surfaces.md). Meta가 공개한 [Astryx](https://github.com/meta/astryx)의 `docs/design/`(색 강조·시스템 상태·사용자 상태·elevation)와 `theme-tokens.md`의 상태 역할 규칙(INV11)을 체크리스트로 대조했다.
- ~~상태색 토큰 하나가 글자·채움을 겸함~~ → `status-*-fill`·`danger` 추가(§1.4). 에러 빨강 네 벌 → 글자·채움 두 벌, 정상↔idle 색각 거리 8.9/4.5 → 17.1/21.0
- ~~스크림 없는 오버레이의 표면이 제각각~~ → `ui-raised`로 통일(§3.5). `Select` 목록·차트 툴팁·업타임 응답 툴팁·토스트
- ~~누름 상태 0건(터치에서 피드백 없음)~~ → Button·IconButton·CopyButton·Pagination에 `active:`(§4.1)
- ~~비활성 opacity 40·50·60 혼재~~ → 50(§4.1)
- ~~`color-scheme` 미선언, 고대비 모드에서 상태 점 소실, 모바일 입력 14px(iOS 확대)~~ → §8·§6
- ~~포커스 링 다크 3.38~3.62~~ → `action`(§8)
- 토스트 규칙·z-index 단계·문장 안 링크 밑줄 규칙을 문서화(§7·§8)

### 해결됨 (2026-10-08~09) — 개요 critique · 전체 audit

- ~~부분 로드 실패 시 개요가 "모두 정상"~~ → 상태 불명 표시 + 실패 영역 이름, 실패 소스 `—`, 조회 실패로는 온보딩을 띄우지 않음
- ~~`text-primary`를 텍스트에 사용 65곳(다크 3.4:1)~~ → `text-action`(§1.4). 로그인 브랜드 워드마크만 예외
- ~~설정 세그먼트 9곳 수제~~ → `SegmentedControl`(`aria-pressed`, 다크 AA)
- ~~`Select` 트리거가 현재 값을 읽지 않음~~ → `role="combobox"`. e2e는 `getByRole('combobox', { name })`로 찾는다
- ~~`Toggle` 꺼짐 트랙 1.2:1, 36×20 타깃~~ → `text-dim` 트랙, `::before`로 44px
- ~~알림 규칙·채널 테이블의 작업 열이 노트북 폭에서 가려짐~~ → 오른쪽 sticky
- ~~다크 사용자 첫 로딩 깜빡임~~ → `public/theme-init.js`(CSP가 인라인 스크립트를 막는다), 테마는 명시적 선택만 저장
- ~~사이드바 수제 배지~~ → 색 있는 숫자 텍스트(§5.1b)
- ~~호출되지 않던 `SidePanel`·`SidePanelContext`~~ → 삭제

### 해결됨 (2026-09-23) — 숫자는 Spoqa, mono는 코드·로그만

- ~~JetBrains Mono Variable을 숫자·시간·코드 전부에 사용~~ → Spoqa 숫자가 이미 고정폭이라 KPI·표·시간·개수 50곳에서 `font-mono`를 뺐다
- 코드·로그·키·ID·URL 41곳만 `font-mono`(JetBrains Mono)로 남겼다 — YAML 들여쓰기와 `l`/`1`·`O`/`0` 구분 때문 (§2.1). 한때 OS 고정폭 스택으로 바꿨으나 로그 화면이 OS마다 달라 보여 JetBrains Mono로 되돌렸다

### 해결됨 (2026-09-23) — 메뉴 간 액션 위치 통일

점검 결과: 목록 화면 9곳은 CTA가 전부 `PageHeader` 우측으로 이미 통일돼 있었고, 흔들리는 곳은 **상세 화면**이었다. 상세 9곳의 헤더가 5가지였다.

- ~~업타임·Docker 환경·Docker 서비스·Project 상세가 `h1`을 직접 쓰고 버튼을 제목 행에 붙임~~ → `PageHeader` + `DetailActionToolbar` (§4.1 상세 헤더). 새로고침은 좌측 라벨 버튼, 파괴 액션은 우측 끝
- ~~Docker 환경 상세의 라벨 없는 아이콘 5개(비활성화 포함)~~ → 라벨 버튼 `수집기 설치`·`API 키`·`계측 설정`·`비활성화`
- ~~Docker 서비스 상세의 데스크톱/모바일 레이아웃 2벌(모바일은 서비스 이름 h1이 두 번)~~ → 한 벌. `AgentIdentity`의 중복 제목·`showServiceName` 제거
- ~~Project 상세에 수정·삭제가 없고 `Project 관리`(목록 이동)만 있음~~ → `수정`·`삭제`. KPI를 `SummaryCard`로(정상일 때 초록 제거)
- ~~모달 푸터 4종(50:50 · 우측 · 이탈 버튼이 주 액션 자리 · 헤더 상단)~~ → §7 푸터 규칙 하나. `ConfirmDialog`·Docker 연결 모달 우측 정렬, 채널 페이지 제출 바를 하단으로, 알림 폼 제출 바는 `FormActions`로 공유
- ~~제출 라벨 `생성`·`규칙 생성`·새 채널 `저장`~~ → `추가하기`
- ~~X 닫기가 `Button quiet sm` 6곳 · 손으로 만든 `<button>` 5곳(`Close panel` 영어 라벨 포함)~~ → `IconButton tone="quiet"`
- ~~개요 `모니터링 시작`(add 아이콘인데 동작은 페이지 이동)~~ → `Docker 연결`, 연결 모달을 바로 연다(`/environments?connect=docker`)
- ~~업타임 목록 빈 상태에만 CTA 없음~~ → `추가하기`
- ~~모바일 알림에 규칙 추가 진입점 없음~~ → 규칙 탭에도 `추가하기`(생성 패널)
- 버그: Docker 환경 상세의 모바일 뒤로가기·비활성화 후 이동이 개요(`/`)로 가던 것 → `/environments`. 인프라 상세 `알림 규칙`이 필터 없이 열리던 것 → `alertTarget`에 `infrastructure` 대상 추가
- 문서: §5.2 `t()` 잔재, §5.1b 배지 소비처, §6 `Textarea`·`Field`, §9.2 파괴 액션 표기, §10 표 구조를 코드에 맞춤

### 해결됨 (2026-09-20) — KPI 카드 2행화 · 개요 KPI 행 제거

사용자 피드백 1: *"수직으로 3개의 행이 있고 좌측에 쏠린 게 가시성이 안 좋다."* → 숫자 우측 2행으로 바꿈.
사용자 피드백 2: *"좀 아쉬운데 다시 한번 생각해줘봐."* → **레이아웃이 문제가 아니었다.**

`SummaryCard` 자체 변경 (업타임 페이지 3장에 유효):

- ~~라벨·숫자·설명 3행 + 아이콘만 우측 상단~~ → 라벨(좌)·숫자(우) 한 행 + 설명 한 행. 카드 폭 ~300px 중 비어 있던 오른쪽을 숫자가 쓴다
- ~~톤이 아이콘과 설명 양쪽에 중복~~ → 아이콘 제거. 종류는 라벨이 이미 말한다
- ~~`healthy` 설명문까지 초록~~ → `warn`/`error`만 색 (§4.1)

**개요 페이지의 KPI 행 4장은 통째로 제거했다** — 바로 아래 두 카드와 같은 말을 하고 있었다:

| KPI 카드 | 이미 말하고 있던 곳 |
|---|---|
| `Docker 수집기 N` | 모니터링 범위 → `Docker 환경 N` (같은 `agents.length`, 링크까지) |
| `서비스 N` | 모니터링 범위 4줄의 합 (분해된 쪽이 더 유용) |
| `…개 연결 확인 필요` · `…개 장애 신호` · `수집 확인 필요 N` | 현재 확인 필요 → `attention` 배열이 unhealthy·stale·awaiting을 **전부** 담고, 대상 이름과 링크까지 준다 |
| `Projects N` | 모니터링 범위 하단 `Project로 대상 정리하기 →` |

첫 화면 전체를 써서 다음 화면이 더 잘 하는 말을 반복하고 있었고, 4장 중 3장은 "괜찮다"만 말했다. 이제 개요는 **문제(현재 확인 필요) → 범위(모니터링 범위)** 두 카드로 끝난다. 동반 제거: `projects` state와 `api.getProjects()` 호출(KPI 카드가 유일한 소비처였다), `reportingAgents`·`connectionIssues` 파생값.

**업타임 페이지의 3장은 유지한다.** 한 모집단(전체 대상)을 정상/장애/일시정지로 **쪼갠** 것이고, 바로 아래 목록에는 그 분해가 없다. 개요 KPI처럼 아래 내용을 되풀이하지 않는다 — KPI 행을 둘지 말지는 **"아래가 이미 더 잘 말하고 있는가"**로 가른다.

### 해결됨 (2026-09-20) — 로그 레벨 배지 → mono 텍스트 토큰

사용자 피드백: *"레벨 컬럼에 있는 INFO, WARN, ERROR 뱃지 색상이 너무 AI스럽다."*

- ~~`bg-red-100`/`amber-100`/`sky-100` 불투명 파스텔 틴트 배지~~ → 채움 없는 색 글자 (§1.5). 부트스트랩 alert 팔레트라 가장 흔해 보이는 조합이었다
- ~~기계 토큰(`ERROR`/`WARN`)에 가변폭 Spoqa~~ → `font-mono` + `w-12` 고정폭. 같은 표의 시간·메시지가 전부 mono인데 레벨만 sans였고, 그래서 생긴 들쭉날쭉함을 틴트가 덮고 있었다
- 대비 동반 상승: 라이트 error 5.30→6.42, warn 4.51→5.03, info 5.17→5.86
- `LEVEL_STYLE` 하나를 `LEVEL_BASE`+`LEVEL_TEXT`(행)와 `LEVEL_CHIP`(필터 선택 상태)으로 분리 — 필터 칩의 채움은 토글 상태 표시라 남겨야 한다
- 스택 로그 행은 토큰(16px 행간)과 메시지(20px 행간)의 첫 줄 중심을 `mt-0.5`로 맞춤(실측 offset 0 — 2026-09-23 재측정, 이전 `mt-1`은 메시지 행간이 24px이던 시절 값이라 2px 어긋나 있었다)

### 해결됨 (2026-09-20) — 대상 카드 아이콘 제거 · 위치 표시 헤더

- ~~대상 카드마다 같은 종류 아이콘이 반복~~ → `ResourceCardHeader`에서 `icon` prop 제거, 호출부 9곳 정리 (§4.1). 한 목록의 카드가 전부 같은 아이콘이라 정보량이 0이었다
- **`AppHeader` 신설** (§3.4) — `navSections.ts`(경로→섹션) + `BreadcrumbContext`(상세가 leaf 선언). 목록 페이지는 코드 추가 없이 동작
- 손으로 만든 breadcrumb 3곳을 헤더로 이관: `AgentHealthCheckDetailView`(`agentName / name` 인라인), `ProjectOverviewPage`(`Projects /` 인라인), `ChannelFormPage`(자체 bordered 헤더)
- `UptimeMonitorDetailPage`의 데스크톱 `← 업타임` 버튼을 `lg:hidden`으로 (§3.4 위반 해소). `ProjectDetailPage`는 이미 `lg:hidden`이었다
- `ChannelFormPage`의 `lg:h-[calc(100dvh-4rem)]` → `8rem` (헤더가 64px 더 먹는다)

### 해결됨 (2026-09-20) — 상태 표현을 배지에서 status light로

사용자 피드백 2차: *"뱃지는 이제 백그라운드랑 폰트 색상을 넣은 것 같은데 이게 최선이야?"*

보더를 뺀 soft 배지는 그 자체로는 표준(shadcn `secondary`, Radix `soft`)이지만, **쓰는 자리가 틀렸다.** Spectrum 기준으로 대상 상태는 badge가 아니라 status light다(§5.1).

- ~~서비스·업타임·수집 상태가 틴트 배지~~ → `StatusLight`(점 + 라벨) 신설, 세 도메인 컴포넌트가 이를 감싼다. 라벨은 상태색이 아니라 `text-secondary`
- 라벨 대비 **4.78 → 10.35**, 점은 표면 대비 5.48~7.58로 1.4.11 여유 확보(틴트가 형태를 그리던 1.1 대비)
- `badge` 유틸은 표 컬럼 토큰 4곳(로그 레벨 ×2, severity, span kind)만 남았다 — 좁은 컬럼의 세로 스캔에는 박스가 제 값을 한다. (같은 날 로그 레벨이 mono 텍스트로 빠져 지금은 2곳 — §5.1b)
- §5.2를 "라벨 없는 맨 점" 전용으로 좁혀 `StatusLight`와의 역할 중복 해소

### 해결됨 (2026-09-20) — 배지 3중 장식 · 카드 정렬

사용자 피드백: *"보더 색상, 백그라운드 색상, 폰트 색상까지 다 줘버리는 게 어딨냐. 각 요소들 정렬도 안 맞아."*

- ~~status 배지가 `/10` 틴트 + `/20` 보더 + 텍스트 3중~~ → 틴트 + 텍스트만. `StatusBadge`·`UptimeMonitorStatusBadge`·`CollectionStatusBadge`. `badge` 유틸의 투명 보더는 박스 크기 유지용이라 남김
- ~~`ConnectionSourceBadge`가 같은 축인데 `direct`=primary 틴트 / `docker`=회색으로 갈림~~ → 칩을 버리고 맨 텍스트(`type-caption text-text-muted`). 중간에 중립 칩으로 통일해 봤으나 `일시정지` 배지와 브라우저 실측상 구분이 안 돼(§5.3) 형태로 갈랐다. 분기가 사라진 className 삼항도 제거
- ~~`ResourceCardHeader`가 부제를 아이콘 거터 안에 둬서 카드 본문과 좌변이 30px 어긋남~~ → 부제를 거터 밖으로. 8개 카드(`UptimeTargetCard`·`ApiPage`·`MetricsPage`·`LogsPage`·`InfrastructurePage`·`ProjectsPage`·`ServiceGridPage`·`PendingServiceCard`) 동시 해소
- ~~배지 모양을 손으로 만든 7곳이 같은 3중 장식~~ → 보더 제거. `Sidebar`(알림 카운트)·`PendingServiceCard`·`AgentIdentity`·`Direct{Api,Infrastructure,Logs,Metrics}DetailPage`

**손으로 만든 배지 7곳은 여전히 `badge` 유틸을 쓰지 않는다.** 높이·패딩·radius가 제각각이라 통합하면 시각 변화가 따르고, 그중 4곳은 안에 상태 점을 품고 있어 `badge`로 그대로 치환되지 않는다. §5.1에 금지 규칙만 세워 두고 컴포넌트화는 보류한다.

### 해결됨 (2026-09-20) — 웹 베스트프랙티스 대조

- ~~모달·다이얼로그 8곳이 `shadow-2xl`(§3.5 위반)~~ → `shadow-lg`. `ConfirmDialog`·`ApiKeyModal`·`AddServiceModal`·`InstrumentationOverrideModal`·`UptimeMonitorDialog`·`InfrastructureCollectorKeyDialog`·`InfrastructureCollectorSetupDialog`·`RotatedTelemetryKeyDialog`
- ~~`AddServiceModal`의 미완료 스텝 번호가 `bg-ui-hover text-text-dim`으로 라이트 4.34(AA 미달)~~ → `text-text-muted`(6.92)
- ~~`AlertsMobileView`의 탭 카운트 칩·비활성 칩이 `bg-ui-active` 위 `text-text-muted`로 다크 4.02(AA 미달)~~ → `text-text-secondary`(6.94)
- §1.3에 `dim` 허용 배경 상한 명시, §3.2에 동심 radius 규칙 신설, §5.1에 배지 틴트의 배경 의존성 표 추가

**배지 알파 틴트는 실제 위반 0건이었다.** 모든 배지 보유 행·카드가 §3.6에 따라 `hover:bg-ui-hover-soft`를 쓰고 있어 최저값이 4.57(라이트 healthy)로 AA를 넘는다. 다만 여유가 0.07이라 §3.6 규칙이 무너지면 즉시 깨지므로, 암묵적 의존을 §5.1에 명문화했다.

### 해결됨 (2026-08-05) — 기술 감사 후속

- ~~토스트 아이콘 색이 제거된 토큰(`--color-success`/`--color-error`)을 읽어 하드코딩 hex로 폴백~~ → `var(--color-status-healthy/error)`로 교체(테마 반응). `main.tsx`의 죽은 `getComputedStyle` 스냅샷 3줄 제거
- ~~모달 컨테이너 3곳이 `rounded-2xl`(§3.2 위반)~~ → `rounded-xl` (`ApiKeyModal`·`AddServiceModal`·`ConfirmDialog`)
- ~~알림 전송 성공/실패 색이 primitive + `dark:` 짝(§10.B 건강 축 오분류)~~ → `AlertsMobileView`를 `text-status-healthy/error`로 토큰화
- ~~카드·상세 헤더 아이콘 버튼 터치 타깃 28~36px~~ → `h-10 w-10`(40px)로 확대, 컨테이너 gap 조정 (`ServiceGridPage`·`PendingServiceCard`·`ProjectDetailPage`). WCAG 2.5.8 AA(24px)는 이전에도 충족, 밀도 유지 위해 44px 대신 40px
- ~~전역 reduced-motion `0.01ms` 킬이 `DemoBanner` 마퀴를 잘라 안내가 잘림~~ → `motion-reduce:`에서 마퀴 정지 + 줄바꿈 + 중복 사본 숨김

### 해결됨 (2026-07-26)

- ~~색 접근성 — `text-dim` 라이트 2.56, 상태 배지 3종, 차트 시리즈 3색, 로그 레벨 3색이 WCAG 미달~~ → 전부 AA/1.4.11 통과. 브라우저에서 8/8 실측 확인
- ~~상태색 시맨틱 레이어 부재~~ → `--color-status-*` 4종 신설. 374건 전수 분류 후 상태 표현 **160건**을 20개 파일에서 토큰으로 이관 (`dark:` 짝 동반 제거)
- ~~죽은 토큰 5종 (`primary-hover`, `chart-surface`, `chart-hover`, `text-chart-dim`, `success`/`warning`/`error`)~~ → 제거
- ~~`chart-bg`와 `bg-surface-dark`가 대비 1.02로 중복~~ → `bg-bg-surface`로 통합 (`dark:` 위반 9건 동반 해소)
- ~~`CLAUDE.md`와 내용 중복~~ → 분리 완료, CLAUDE.md는 포인터만
- ~~`bg-bg-base/35` — 존재하지 않는 토큰이라 배경이 투명하게 렌더~~ → `bg-ui-hover-soft`
- ~~폼 프리미티브 부재 (입력 클래스 10종, 포커스 링 5종, radius 3종, 세로패딩 5종)~~ → `Input`/`Select`/`SearchInput` 신설, 27개 호출부 이관. raw 폼 `<input>` 0건
- ~~아이콘 전용 버튼에 접근 가능한 이름 없음~~ → **20건** 전부 `aria-label` 부여(14건은 기존 `title` 미러링, 6건은 신규). 잔여 0건
- ~~색만으로 상태를 전달하는 점~~ → 인접 텍스트가 없는 **4곳**에 `role="img" aria-label`. 나머지는 텍스트가 이미 상태를 말하므로 장식으로 유지
- ~~죽은 CSS `.status-pulse` + `@keyframes pulse-ring`~~ → 제거(사용처 0곳). §5.2를 실제 패턴으로 정정
- ~~오버레이 4곳이 ESC 핸들러를 복사, 2곳은 ESC 없음~~ → `useOverlay` 훅으로 통합, 6곳 전부 ESC 동작(브라우저 검증)
- ~~헤딩 등급 흔들림~~ → h1/h3 이탈 8건 정리. §2.3을 **컨테이너별 등급표**로 정정 — h2가 카드/모달/섹션에서 다른 것은 이탈이 아니라 정당한 차이였다
- ~~`MainLayout` 주석이 `slate-50 canvas`라고 하나 실제는 `bg-bg-main`~~ → 주석 정정
- ~~렌더 중 부작용 2건 (useDataFetch의 ref 갱신, LoginPage의 navigate)~~ → effect로 이동 / `<Navigate>`로 교체
- ~~카드·행이 `<div onClick>`이라 키보드로 진입 불가~~ → `activatable()` 4곳. Enter/Space 진입 실측
- ~~필터 셀렉트 5개·토글 1개에 접근 가능한 이름 없음~~ → `aria-label`, 토글은 `role="switch"`
- ~~테이블 정렬·행 선택이 키보드로 불가~~ → `<th>` 안 `<button>` + `aria-sort`, 행은 `tabIndex`+키핸들러
- ~~차트 시리즈 4개 초과 시 색만으로 구분~~ → `getSeriesDash(i)` 신설, `AgentServiceMetricsTab`에 적용. 앞 3슬롯은 실선 유지라 1~3시리즈 차트의 모습은 그대로
- ~~`SEVERITY_BADGE` 상수가 두 파일에 md5 동일하게 중복~~ → `SeverityBadge` 컴포넌트로 통합
- ~~오버레이 배경이 6곳 제각각(black/40·slate-900/60·slate-900/40·없음)~~ → `SCRIM_MODAL`/`SCRIM_PANEL` 2역할로 통일. TracePanel은 scrim이 아예 없어 신규 추가
- ~~공용 `StatusBadge`가 미사용이고 `AgentHealthCheckDetailView`의 로컬 중복이 렌더됨~~ → 실제 쓰이던 구현을 공용으로 승격(56→26줄), 로컬 삭제. 쓰이지 않던 10상태 매핑과 그 전용 i18n 키 9개×2언어도 함께 제거

### 권장 순서

1. **A** — 사이트별 확인이 필요해 자동화가 안 된다. 파일 단위로 나눠 처리
