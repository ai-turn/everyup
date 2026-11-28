---
version: alpha
name: EveryUp
description: 개발자용 모니터링 대시보드. 테마 4종(다크·라이트·Latte·Mocha)이 같은 의미 토큰을 쓰고, 유채색은 강조 하나와 상태·데이터에만 싣는다.
colors:
  bg: "#ffffff"
  bg-subtle: "#ffffff"
  surface: "#ffffff"
  surface-hover: "#f4f4f6"
  border: "#e8e8eb"
  border-strong: "#d6d6dc"
  text: "#18181b"
  text-muted: "#4f4f58"
  text-faint: "#6a6a74"
  accent: "#5b4fd1"
  accent-text: "#ffffff"
  focus: "#5b4fd1"
  crit: "#cf3a3a"
  crit-text: "#cf3a3a"
  attn: "#a06e14"
  attn-text: "#a06e14"
  ok: "#1f8f5a"
  ok-text: "#1f8f5a"
  wait: "#70707a"
  chart-1: "#5b4fd1"
  chart-2: "#1f8f5a"
  chart-3: "#a06e14"
  chart-4: "#6a6a74"
  chart-5: "#1d7fa3"
  deploy-marker: "#5b4fd1"
  uptime-ok: "#1f8f5a"
  uptime-fail: "#cf3a3a"
  uptime-no-data: "#d6d6dc"
typography:
  page-title:
    fontFamily: "Geist Variable"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 32px
  section-title:
    fontFamily: "Geist Variable"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
  card-title:
    fontFamily: "Geist Variable"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 24px
  body:
    fontFamily: "Geist Variable"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
  label:
    fontFamily: "Geist Variable"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 20px
  label-sm:
    fontFamily: "Geist Variable"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
  caption:
    fontFamily: "Geist Variable"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  kpi:
    fontFamily: "Geist Variable"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 32px
  stat:
    fontFamily: "Geist Variable"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 28px
  code:
    fontFamily: "Geist Mono Variable"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  xl: 8px
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
값의 실제 정의는 [`src/tokens.css`](src/tokens.css)(색)·[`src/index.css`](src/index.css)(유틸리티)와 각 컴포넌트 파일에 있고, 이 문서는 **무엇을 언제 쓰는가**를 정한다.

맨 위 frontmatter는 토큰의 **기계 판독용 사본**이다([DESIGN.md 형식](https://github.com/google-labs-code/design.md)). 라이트 테마 값이며, 값을 바꿀 때 `tokens.css`와 함께 고친다 — 둘이 어긋나도 자동으로 잡히지 않는다. impeccable `detect`(`web/frontend`에서 실행해야 이 파일을 찾는다)가 이 값을 허용 목록으로 읽는데, **잡는 범위가 좁다** — `text-[Npx]` 임의 크기, CSS 선언·`style={{}}`의 색·radius·폰트만 본다. `bg-[#hex]`·`rounded-[10px]` 같은 Tailwind 임의값과 Tailwind 기본 팔레트·`dark:` 변형(§1.7)은 보지 않는다 — 그쪽은 `pnpm lint`가 센다(§10).

관련 문서: [`../../CLAUDE.md`](../../CLAUDE.md)(엔지니어링 규약 — 디자인 내용은 없다) · [`src/components/charts/chartTheme.ts`](src/components/charts/chartTheme.ts)(차트 스펙 코드)

---

## 0. 개요

개발자가 쓰는 모니터링 대시보드다. 화면이 답할 첫 질문은 **"지금 이상이 있는가"**이고, 나머지 설계는 그 답을 빨리 찾게 하는 쪽으로 정했다. 시각 언어는 2026-11-29의 **G안**이다(레퍼런스: Better Stack, Vercel, Beszel, Hyperping, Coolify).

- **위는 가볍게, 자세한 것은 눌러서.** 목록과 개요는 상태 모양 · 이름 · 짧은 원인 · 숫자만 보인다. 속성 목록·설정·이력은 상세 화면이나 접힌 영역에 있다.
- **업타임은 늘 보인다.** 서버 목록과 서버 개요에 24시간 체크 띠와 가용률이 있다(§4.5, §4.7, §4.8).
- **설명 문장을 두지 않는다.** 제목은 명사(`주의 필요`, `최근 장애`), 메타는 짧은 값(`24시간 · 11개`)이다. 질문형 제목·부제·캡션 문장을 쓰지 않는다. 안내 문장은 빈 상태, 연결 안내, 파괴 확인처럼 다음 행동이나 결과를 말해야 하는 자리에만 남긴다.
- **모든 것을 상자에 담지 않는다.** 섹션은 제목과 간격으로 나누고, 상자는 요약 띠·차트·배너·떠 있는 표면에만 쓴다(§3.1).
- **색은 상태와 위치에만.** 유채색은 상태(장애·확인 필요·정상·대기)와 강조색 하나(현재 위치, 선택 탭, info)뿐이다. 주 버튼은 무채색이다. 거래소처럼 빨강·초록을 가득 칠하지 않는다(§1.4, §5.3).
- **상태는 색과 모양 둘로.** 장애 네모, 확인 필요 세모, 정상 동그라미, 대기 점선 동그라미(§5.1).
- **데이터를 정직하게 그린다** (§4.2). 수집 공백은 공백으로, 모름은 `-`로, 연결하지 않은 것은 `연결 전`으로 보여 준다.
- **한 역할에 컴포넌트 하나.** 버튼은 `Button`, 상태는 `StatusLight`·`StatusShape`, 목록은 `ResourceTable`, 차트 틀은 `ChartCard`, 체크 띠는 `UptimeStrip`이다.
- **조밀하되 누르기 쉽게.** 본문은 13px이지만 터치 화면의 컨트롤은 44px를 지킨다(§4.1).
- **한국어 UI, 용어는 개발자의 말로** (§9.15). 업계가 영어로 부르는 말은 영어 그대로 쓴다. 그룹은 없다(ADR 0013).

---

## 1. 색

### 1.1 토큰 규약 — 테마는 토큰이 바꾼다

색 값은 [`src/tokens.css`](src/tokens.css) 한 파일에만 있다(2026-11-28, G안). 테마는 네 개이고 `<html data-theme="dark|light|latte|mocha">`가 고른다. 토큰 이름 34개는 테마와 무관하고, 테마는 그 이름에 값을 연결하는 표의 열 하나다. 새 테마는 `tokens.css`에 `[data-theme]` 블록 하나, `contexts/themes.ts`의 `THEMES`와 `public/theme-init.js`의 목록에 한 줄씩 더한다.

`index.css`는 Tailwind 기본 팔레트를 지우고(`--color-*: initial`) 색 유틸리티를 토큰에만 연결한다(`@theme inline`). 그래서 `bg-sky-500`·`text-white` 같은 클래스는 아무것도 만들지 않고, `pnpm lint`가 막는다. `dark:` 변형도 쓰지 않는다(외부 서비스를 흉내 내는 채널 미리보기만 예외).

```tsx
// ✅ 한 클래스가 네 테마를 다 덮는다
<p className="text-text-muted">

// ❌ 기본 팔레트·hex·dark: 짝
<p className="text-slate-500 dark:text-slate-400">
```

인라인 스타일·SVG 속성은 `var(--토큰)`을 쓴다(`stroke="var(--chart-1)"`). `var()`는 그 자리에서 풀리므로 테마가 바뀌어도 다시 그릴 필요가 없다.

**선택과 저장.** 테마는 사이드바 아래와 환경 설정에서 고른다. 고르면 `localStorage.theme`에 남고, 고른 적이 없으면 OS의 라이트/다크를 따라간다(OS 설정이 바뀌면 같이 바뀐다). 첫 페인트 전에 `public/theme-init.js`가 `data-theme`를 붙인다.

### 1.2 토큰 표

라이트·다크 값만 적는다. Latte·Mocha는 Catppuccin 공식 값이고 `tokens.css`에 있다.

| 토큰 | 클래스 | 역할 | 라이트 | 다크 |
|---|---|---|---|---|
| bg | `bg-bg` | 페이지 바탕 | `#ffffff` | `#0a0a0b` |
| bg-subtle | `bg-bg-subtle` | 사이드바처럼 한 단 물러난 바탕 | `#ffffff` | `#0d0d0f` |
| surface | `bg-surface` | 카드·입력·메뉴 표면 | `#ffffff` | `#111113` |
| surface-hover | `bg-surface-hover` | hover 채움, 옅은 안쪽 채움, 선택된 세그먼트 | `#f4f4f6` | `#18181b` |
| border | `border-border` | 헤어라인, 행 구분선, 눌린 채움(`bg-border`) | `#e8e8eb` | `#1f1f23` |
| border-strong | `border-border-strong` | 알약, 짧은 막대의 트랙 | `#d6d6dc` | `#2b2b31` |
| text | `text-text` | 제목·본문 | `#18181b` | `#ededef` |
| text-muted | `text-text-muted` | 보조 글, 읽는 설명문 | `#4f4f58` | `#a3a3ab` |
| text-faint | `text-text-faint` | 메타·축·placeholder | `#6a6a74` | `#8a8a93` |
| accent | `bg-accent` · `text-accent` | 현재 위치, 선택된 탭 밑줄, info | `#5b4fd1` | `#8f8ff5` |
| accent-bg | `bg-accent-bg` | 현재 위치·선택의 옅은 바탕 | accent 10% | accent 12% |
| accent-text | `text-accent-text` | accent 채움 위 글자 | `#ffffff` | `#0a0a0b` |
| focus | `outline-focus` | 포커스 링 | `#5b4fd1` | `#8f8ff5` |
| crit · crit-text · crit-bg · crit-border | | 장애: 채움·글자·옅은 바탕·경계 | `#cf3a3a` | `#ef6461` |
| attn · attn-text · attn-bg | | 확인 필요 | `#a06e14` | `#d6a243` |
| ok · ok-text · ok-bg | | 정상 | `#1f8f5a` | `#3fb57a` |
| wait | `bg-wait` | 대기·일시 중지·모름 채움 | `#70707a` | `#80808a` |
| chart-1 ~ chart-5 | `var(--chart-N)` | 차트 시리즈(§1.6) | | |
| deploy-marker | `var(--deploy-marker)` | 차트의 배포 표시선 | accent | accent |
| incident-band | `bg-incident-band` | 차트의 장애 구간 띠 | crit 8% | crit 10% |
| uptime-ok · uptime-fail · uptime-no-data | | 업타임 체크 막대 | ok · crit · `#d6d6dc` | ok · crit · `#2b2b31` |

시안 밖의 보조 토큰은 둘이다. `control-border`(`border-control`)는 입력·선택 상자의 경계로, 표면 위 3:1(WCAG 1.4.11)이 필요해서 `border-strong`(1.3:1)과 따로 둔다(라이트 `#8a8a94`, 다크 `#66666f`). `scrim`은 모달 뒤를 어둡게 하는 막이다(`useOverlay`).

라이트는 페이지·카드·사이드바가 같은 흰색 한 톤이다. 구분은 간격·헤어라인·hover 채움으로 한다(§3.1). 다크는 bg → surface → surface-hover 세 단이다.

### 1.3 글자 3단 위계

`text` > `text-muted` > `text-faint`. 모든 테마에서 bg·surface 위 4.5:1 이상이다. Latte만 공식 값이 모자라 `text-faint`(`#63667d`), `attn-text`(`#8f5a0e`), `ok-text`(`#2d7a1f`)를 어둡게 보정했다. 읽는 문장에는 `text-faint`를 쓰지 않는다. `text-faint`는 시각·개수·축처럼 훑는 값 전용이다.

### 1.4 강조 · 상태

**강조색은 하나(accent)다.** 사이드바 현재 위치(`bg-accent-bg text-accent`), 선택된 탭 밑줄, 체크박스·라디오(`accent-accent`), info 표시에만 쓴다. **주 버튼은 무채색이다**(`bg-text text-bg`, G안 `서버 추가`): 유채색은 상태와 위치에 남긴다. 텍스트 링크는 색이 아니라 밑줄(`link-underline`)로 드러낸다.

**상태색은 글자와 채움이 다른 토큰이다**([ADR 0010](../../docs/adr/0010-status-color-roles-and-floating-surfaces.md)).

| 역할 | 장애 | 확인 필요 | 정상 | 대기 |
|---|---|---|---|---|
| 글자·아이콘 (4.5:1) | `text-crit-text` | `text-attn-text` | `text-ok-text` | `text-text-muted` |
| 점·막대·게이지·선 (3:1) | `bg-crit` | `bg-attn` | `bg-ok` | `bg-wait` |
| 옅은 바탕 | `bg-crit-bg` | `bg-attn-bg` | `bg-ok-bg` | `bg-surface-hover` |
| 경계 | `border-crit-border` | | | |

글자 토큰을 채움에 쓰는 것(`bg-crit-text`)은 `pnpm lint`가 막는다. 파괴 확정 버튼은 `bg-crit text-bg`다(네 테마 모두 4.5:1).

### 1.5 로그 레벨

[`logLevelStyle.ts`](src/features/healthcheck/logLevelStyle.ts)의 `LEVEL_TEXT`(행) / `LEVEL_CHIP`(필터 칩 선택) / `LEVEL_FILL`(추이 막대), `AgentServiceLogsTab`의 `LEVEL_BAR`(히스토그램)가 SSOT다. 알림 severity(`SEVERITY_TONE`)도 같은 규칙이다.

| 레벨 | 글자 | 칩 | 막대 |
|---|---|---|---|
| error | `text-crit-text` | `bg-crit-bg` | crit |
| warn | `text-attn-text` | `bg-attn-bg` | attn |
| info | `text-accent` | `bg-accent-bg` | chart-1 |
| debug | `text-text-muted` | `bg-surface-hover` | chart-4 |
| trace | `text-text-faint` | `bg-surface-hover` | wait |

로그 행의 레벨은 채움 없는 mono 소문자다(`LEVEL_BASE`).

### 1.6 차트 시리즈

`chartTheme.ts`의 `SERIES`와 `getSeriesPalette(theme)`. 값은 `var(--chart-N)`이다.

```
chart-1 → chart-2 → chart-3 → chart-5 → chart-4(회색) → crit
```

4개를 넘는 시리즈는 색만으로 구분되지 않는다. `getSeriesDash(i)`가 4슬롯째부터 선 스타일을 돌려준다. 격자는 `var(--border)`, 축 글자는 `var(--text-muted)`, 오류·경고 막대와 임계선은 `var(--crit)`·`var(--attn)`이다.

### 1.7 원시 색이 허용되는 곳

`tokens.css`와, 서드파티 화면을 재현하는 `ChannelForm`·`ChannelPreview`뿐이다. 그 밖의 hex·`rgb()`·`hsl()`·`oklch()`와 Tailwind 기본 팔레트 클래스는 `pnpm lint`가 막는다(css 파일 포함).

---

## 2. 타이포그래피

### 2.1 폰트

- **본문** Geist Variable(라틴·숫자) + Spoqa Han Sans Neo(한글) → `--font-sans` (2026-11-28, G안). 둘 다 self-hosted다(`@fontsource-variable/geist`, `spoqa-han-sans`; CSP `font-src 'self'`). Geist에는 한글 글리프가 없어 한글은 폴백 2순위인 Spoqa로 그린다
- **굵기는 400/500/700만 쓴다.** Geist는 가변이지만 Spoqa가 정적 폰트(400/500/700만 싣는다)라 600을 쓰면 한글이 합성 굵기로 떨어진다
- **숫자는 본문 폰트 + `tabular-nums`다.** KPI·표·시간처럼 자리 이동이 없어야 하는 곳은 `tabular-nums`(또는 `type-kpi`·`type-stat`)를 건다
- **`font-mono`는 기계 문자열에만** — 코드·설정 블록(`<pre>`, YAML·명령어), 로그 메시지 본문·스택 트레이스, API Key·trace ID·span 이름, URL·경로·HTTP method+path, 이미지명·메트릭명, `key=value` 속성 칩, 로그 레벨 토큰(§1.5). 기준은 **"들여쓰기·줄 맞춤이 의미이거나, `l`/`I`/`1`·`O`/`0`을 가려 읽어야 하는가"**다. 폰트는 Geist Mono Variable(self-hosted)이다 — 로그·트레이스처럼 오래 읽는 화면이 OS와 무관하게 같은 모양이어야 해서 OS 고정폭 대신 웹폰트를 쓴다. 브라우저는 `font-mono` 글자가 화면에 있을 때만 파일을 받으므로 숫자를 뺀 뒤로는 개요·목록에서 내려받지 않는다. `<kbd>`·`<code>`·`<pre>`는 브라우저 기본값이 mono라는 점에 주의 — 단축키 표시(`Ctrl K`)는 UI 라벨이므로 `font-sans`를 건다(사이드바 `<kbd>` 하나 때문에 모든 페이지가 이 폰트를 받고 있었다). 한글 글리프가 없어 폴백 2순위가 Spoqa다 — 한글이 섞인 줄은 폭이 정확히 맞지 않는다(한글 줄 맞춤이 필요해지면 D2Coding 서브셋을 검토)
- **mono는 값에만 건다 — 라벨·분류명·제품명은 본문 폰트다.** `Docker Collector`·`Collector`·`OpenTelemetry Collector`·`Bot Token`·`Telegram`처럼 우리가 UI에 써 넣은 말은 mono가 아니다. 컨테이너(`<table>`, 메타 줄)에 `font-mono`를 걸면 라벨까지 같이 딸려오니, 해당 값 셀에 직접 건다. 값 하나를 여러 성격이 공유하는 prop(`detail={{label, value}}`)은 특히 주의 — 한쪽이 코드면 다른 쪽은 아닐 확률이 높다

### 2.2 역할별 타이포그래피

크기·행간·굵기는 `index.css`의 역할 유틸리티를 쓴다. 색·여백·정렬은 호출부가 정한다.

**본문 크기는 13px이다**(2026-11-29, G안). `index.css`가 `--text-sm`을 13px(줄 20px)로 다시 정의하므로 아래 표의 14px 역할(`type-body`·`type-label`·`type-control`)과 `text-sm`을 쓰는 버튼·입력이 모두 13px이다. 표의 14px는 13px로 읽는다.

| 역할 | 클래스 | 크기 / 행간 | 굵기 |
|---|---|---|---|
| 페이지 제목 | `type-page-title` | 24 / 32px | 600, 자간 -0.02em (G안) |
| 카드 밖 섹션 제목 | `type-section-title` | 14 / 20px | 600 (G안) |
| 카드·차트·모달 제목 | `type-card-title` | 16 / 24px | 500 |
| 본문·설명·도움말 | `type-body` | 14 / 21px | 400 |
| 버튼·폼 라벨·조밀한 항목 제목 | `type-label` | 14 / 20px | 500 |
| 컨트롤·조밀한 행 안의 글(입력·선택 상자의 값, 표 칸, 메뉴·목록 항목) | `type-control` | 14 / 20px | 정하지 않음(400, 컨트롤이 500을 주면 그대로) |
| 표 헤더·배지·작은 버튼·키 표시 | `type-label-sm` | 12 / 16px | 500 |
| 메타·시간·짧은 보조 값 | `type-caption` | 12 / 16px | 400 |
| 쌓이는 12px 줄(두 줄 목록의 둘째 줄, 표 칸의 보조 줄) | `type-caption-stack` | 12 / 18px | 400 |
| KPI 카드·요약 줄의 대표 수치 | `type-kpi` | 24 / 32px | 500, 고정폭 숫자 |
| 목록 카드 안의 작은 통계 | `type-stat` | 18 / 28px | 500, 고정폭 숫자 |

페이지 헤더는 [PageHeader](src/components/common/PageHeader.tsx)를 쓴다. **본문 1단계 섹션은 [Section](src/components/common/Section.tsx) 하나다** (2026-11-20 `SectionHeader`, 2026-11-21 `Section`으로 바뀜 — 제목 → 내용 16px을 머리의 아래 여백이 아니라 섹션이 갖는다): 제목은 언제나 `type-section-title`(14px 600, G안)이고, 개수·기간 같은 메타는 제목과 같은 기준선(`items-baseline`)에, 보기 전환·버튼은 제목 줄과 세로 가운데에 둔다. 설명은 둘째 줄이라 조작의 위치를 끌어내리지 않는다. 이전에는 h2 29곳이 16px, 10곳이 20px이라 같은 화면 안에서도 섞였고(로그, Docker 환경 상세), 메타가 제목 기준선에서 2~5px, 조작이 제목 중심에서 6~12px 어긋났다. 카드·차트·다이얼로그 제목과 섹션 안의 하위 제목(차트, 이력, API 요청 패널의 `Endpoint`)은 `type-card-title`(16px) 그대로다. 모바일 전용 화면의 h1은 기존 `text-xl font-bold`(20px)을 허용한다. 404 같은 디스플레이 숫자와 로고 워드마크는 별도 크기를 허용한다. 그 밖에 18px 이상 원시 크기(`text-lg`~)는 `pnpm lint`가 센다.

**숫자는 두 역할뿐이다** (2026-11-14). 대표 수치(KPI 카드, 업타임 상태 요약, 요청 추이 타일, 알림 발송 요약, 인프라 게이지, 응답 시간)는 `type-kpi`, 목록 카드 안에 나란히 놓인 작은 통계(API·로그·메트릭·인프라 카드)는 `type-stat`이다. 둘 다 500이고 고정폭 숫자를 역할이 건다. 이전에는 숫자가 11곳에서 16·18·20·24·30px, 400·500·700의 일곱 조합으로 갈려 있었다(같은 업타임 상세 안에서 24px/500과 30px/700). 400은 24px에서 가늘게 보이고 700은 페이지 제목과 겨룬다. 숫자 색은 상태가 있을 때만 싣는다(§4.1 KPI 설명문과 같은 규칙).

**역할 유틸리티와 같은 모양을 손으로 조합하지 않는다.** `text-sm font-medium`은 `type-label`, `text-xs font-medium`은 `type-label-sm`이다. 역할 위에 굵기를 덧씌우지 않는다(`type-body font-medium` → `type-label`). 둘 다 `pnpm lint`가 막는다. 여러 줄이 될 수 있는 문단(`<p>`)은 `text-sm`(행간 20px)이 아니라 `type-body`(21px)다. 한국어 산문은 행간 1.5에서 읽기 편하다.

크기 토큰은 `text-xs`(12), `text-sm`(14), `text-base`(16), `text-lg`(18), `text-xl`(20), `text-2xl`(24), `text-3xl`(30)이다. `text-[Npx]`로 임의 크기를 추가하지 않는다. 역할 유틸리티 위에 다른 크기·굵기·행간을 중복 지정하지 않는다.

**한국어 줄바꿈은 어절 단위다.** `body`에 `word-break: keep-all` + `overflow-wrap: anywhere`가 걸려 있다(2026-10-11) — 개별 요소에 `break-keep`을 다시 걸지 않는다. 라벨의 대문자·자간은 §2.5를 따른다.

**12px는 배지·시간·차트 눈금·조밀한 데이터용이다.** 설명문·경고문·설정 도움말은 `type-body`를 사용한다. 같은 14px라도 제목은 500, 본문은 400으로 구분할 수 있다. 설명을 작게 줄여 제목과 구분하지 않는다. 로그 테이블·코드 블록은 12px를 유지할 수 있다.

### 2.3 제목과 강조

페이지 제목 24px·600, 섹션 제목 14px·600, 카드·차트 제목 16px·500, 조밀한 항목명 13px·500이다. 위계는 크기보다 굵기와 간격으로 준다(G안 h2가 14px인 까닭). HTML 헤딩 레벨은 문서 구조를 따르고, 시각적 등급은 역할을 따른다. 본문 전체를 굵게 만들거나 모든 값을 강조하지 않는다. 색만으로 상태를 전달하지 않는다.

### 2.4 굵기 — 400 / 500 / 700 (+ 제목 600)

| 유틸리티 | 실제 굵기 | 용도 |
|---|---|---|
| `font-normal` | 400 | 본문·메타·일반 데이터 |
| `font-medium` | 500 | 버튼·라벨·항목명·배지 |
| `font-bold` | 700 | 특별히 중요한 짧은 강조 |
| `type-page-title`·`type-section-title` 안 | 600 | 페이지·섹션 제목(G안) |

Geist는 가변 폰트라 600을 그리고, 한글은 Spoqa(400/500/700만 싣는다)에서 700으로 떨어진다. 600은 역할 유틸리티 안에만 있다. 클래스로 `font-semibold`·`font-extrabold`·Light를 쓰지 않는다(`pnpm lint`).

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

서버 화면과 그 탭 안에서 그려지는 컴포넌트(로그·트레이스·API 요청 행, `TracePanel`, 요청 추이, 응답 시간 카드), 컨테이너 페이지의 같은 탭, 개요, 직접 연결 패널(`DirectConnectionMeta`)이 이 함수를 쓴다. 2026-11-19 최종 수정 전에는 트레이스 목록이 12시간제(`오후 03:21:53`), `TracePanel`이 `en-US`였고 몇 곳이 옵션을 직접 조합했다. 로그 행은 오늘이 아니면 `11월 17일 05:21:53`이다(이전 `11. 17. 05:21:53`).

**`toLocale*`가 남은 곳**(2026-11-19, `git grep -n "toLocale" -- web/frontend/src` 기준). 화면의 시각을 새로 만들 때 이 목록에 더하지 않는다.

| 위치 | 까닭 |
|---|---|
| `components/charts/chartTheme.ts`의 `formatTimeTick`·`formatTimeLabel` | 차트 축과 차트 툴팁 제목. `ko-KR`, `hourCycle: 'h23'`이라 규칙과 같다(§4.2) |
| `utils/incidentFormat.ts` | 공용 함수 자체 |
| `UptimeMonitorDetail`·`UptimeOverview`의 `toLocaleDateString('sv-SE')` | 화면 표기가 아니라 날짜 키(`YYYY-MM-DD`) |
| `ResponseTimeCard`의 `Intl.DateTimeFormat` | 시간대 이름만 얻는다 |
| `ChannelForm`의 메시지 미리보기 3곳 | 외부 서비스(Telegram 등) 화면을 재현한다. `hourCycle`이 없어 12시간제(`오후 03:21`)로 나오며, 이 규칙 밖이다 |
| 숫자의 `toLocaleString()` | 시각이 아니다(천 단위 구분) |

---

## 3. 레이아웃

### 3.1 테두리와 상자 (G안)

**구분은 간격과 헤어라인으로 하고, 상자는 쓸 자리에만 쓴다.** 라이트는 페이지·카드·사이드바가 흰색 한 톤이고(§1.2), 섹션은 제목과 간격으로 나눈다.

| 대상 | 규칙 |
|---|---|
| 페이지 섹션 | 상자로 감싸지 않는다. `Section`(14px 600 제목 + 흐린 메타 + 오른쪽 조작) 사이는 `gap-section`(32px). 선은 긋지 않는다 |
| 머리말 | 제목 줄 아래 선이 없다. 탭 줄은 아래 헤어라인 하나에 선택 탭만 강조색 밑줄 |
| 목록·표 | `ResourceTable`: 흐린 12px 열 이름, 행마다 위 헤어라인, 표 맨 아래 선 하나, 행 채움 없음, hover는 `surface-hover`. 두 줄 목록(`ListRow`, 개요의 행)도 같은 헤어라인 리듬이다 |
| 요약 띠 | 테두리 하나에 칸을 세로선으로 나눈다(개요 요약, 서버 주요 지표). 카드 넷이 아니다 |
| 남기는 상자 | 요약 띠, 차트 카드(`ChartCard`), 장애 배너(`crit-bg` + `crit-border`), 컨테이너 장애 수치 상자, 카드 보기의 항목, 떠 있는 표면 |
| 정의 목록(`DetailMeta`) | 행마다 선을 긋지 않는다. 대상 상세에서는 접혀 있다(§4.7) |
| 입력 컨트롤 | `border-control`(3:1, §1.2) |
| 코드·명령 블록 | 테두리 없이 `bg-surface-hover rounded-md` |

상자 안 서브블록이 필요하면 `bg-surface-hover rounded-md`(테두리 없음)다.

### 3.2 radius

| 값 | 용도 |
|----|------|
| `rounded-xl`·`rounded-lg` | 8px(G안에서 `--radius-xl`을 8px로 낮췄다). 상자, 패널, 모달, 버튼, 입력 |
| `rounded-md` | 6px. 목록 행의 hover, 조밀한 칩, 인라인 코드, 상자 안 서브블록 |
| `rounded-sm`·`rounded-xs` | 배지(4px), 체크 띠의 칸(2px) |
| `rounded-full` | 알약(탭 개수, 장애 배지), 아바타 |

`rounded-2xl` 이상은 쓰지 않는다(`pnpm lint`).

### 3.3 본문 그리드

`MainLayout` 본문 래퍼: `p-4 sm:px-6 sm:py-6 lg:px-8 lg:pt-7 lg:pb-10 page-stack max-w-290 mx-auto` — 최대 폭 **1160px**(G안) 가운데 정렬. 상단 줄(`AppHeader`)은 폭 제한 없이 `px-8`이다. 설정 화면은 `max-w-4xl` 단일 컬럼이고, 라벨 왼쪽 · 컨트롤 오른쪽, 모바일에서는 컨트롤이 아래로 내려간다.

### 3.4 내비게이션 셸

- `lg` 이상: 좌측 `Sidebar`(로고 → 검색 → nav → 테마 선택·계정) + 상단 `AppHeader`(경로 + 오른쪽 자리 + 알림). `Header`는 `lg:hidden`으로 모바일 전용 (2026-11-29, G안)
- `lg` 미만: `Header` + `BottomNavMobile`. 하단바 겹침은 `pb-safe-bottom` 유틸리티가 처리
- 뒤로가기 버튼은 **데스크톱에 두지 않는다** — 사이드바가 상시 내비이고, `AppHeader`의 첫 크럼이 목록 링크다(예외는 아래 "목록으로" 버튼 규칙)
- **사이드바 활성 항목은 브레드크럼의 첫 크럼과 같다** — 담김 관계를 따른다. 서버 상세(`/servers/…`)는 어떤 탭을 보고 있든 `서버`가, 컨테이너 페이지(`/servers/…/containers/…`)도 서버 안이라 `서버`가 활성이다(2026-11-22, Docker 환경은 서버다 — [ADR 0012](../../docs/adr/0012-servers-include-docker-hosts.md)). 탭은 위치가 아니다(아래 "탭은 크럼이 아니다")

**사이드바 구성** (2026-11-18, [ADR 0011](../../docs/adr/0011-servers-own-directly-configured-targets.md)) — 기능별 메뉴(업타임, 로그, 인프라, API 요청, 메트릭)를 없애고 서버를 중심에 두었다. 그 기능들은 서버 상세의 탭이다(§4.6). 2026-11-22([ADR 0012](../../docs/adr/0012-servers-include-docker-hosts.md))부터 `Docker 환경` 메뉴도 없다: Docker Collector로 연결한 호스트는 같은 ID의 서버이고 서버 목록에 함께 있다. 옛 주소(`/environments`, `/agents`, `/agents/:id`, `/agents/:id/:tab`)는 쿼리·해시를 가지고 서버 목록·서버 화면으로 간다(`LegacyEnvironmentsRedirect`, `LegacyEnvironmentRedirect`).

```
개요      (장애 수 배지)
서버
알림
환경 설정
```

G안(2026-11-29)부터 그룹 헤더(`모니터링 대상`, `관리`)를 그리지 않는다. 항목은 34px 줄, 16px 아이콘, 13px 500 글자이고 현재 위치는 `bg-accent-bg text-accent`다. 사이드바 바탕은 `bg-bg-subtle`(라이트는 흰색, 다크는 한 단 어둡다) + 오른쪽 헤어라인, 폭 232px(`w-58`). 맨 아래는 테마 4칸 선택(§1.1)과 로그인한 계정(이름 + `관리자`)이다. 장애 수 배지는 개요 항목의 옅은 빨강 알약(`bg-crit-bg text-crit-text`)이다. 시안은 배지를 `알림`에 두고 `서버`에 개수를 달았지만, 알림 화면에는 진행 중 장애 목록이 없어(규칙·발송 이력·채널) 배지가 가리키는 곳은 개요의 확인 필요 목록이다. 서버 개수는 서버 목록의 행 수와 같은 값을 사이드바가 따로 셀 방법이 없어 달지 않는다. `navSections.ts`의 `group` 값은 모바일 더보기 구성에만 남는다. 모바일 하단 내비는 `mobile: 'bottom'`인 `개요, 서버, 알림`에 `더보기`를 더한 네 칸이고, 더보기 화면(`MorePage`)은 `전체 로그`, `환경 설정`이다. `전체 로그`는 `navSections.ts`의 항목이 아니라 `MorePage`가 앞에 붙인다(아래 "전체 로그").

**서버와 컨테이너의 아이콘은 다르다.** 서버 `dns`, Docker 컨테이너·Docker Collector `deployed_code`. 같은 아이콘이면 사이드바, 개요의 범위 줄, 명령 팔레트에서 구분되지 않는다. 세 곳이 같은 아이콘을 쓴다.

#### 브라우저 탭 제목 (2026-11-20)

`MainLayout`이 `현재 위치 · EveryUp`으로 만든다. 현재 위치는 `AppHeader`와 같은 크럼(`useLocationCrumbs`)의 마지막이다(`서버`, `edge-host-01`, `Checkout API`). 장애가 있으면 어느 화면에서든 앞에 `(N) 장애 · `를 붙인다 — N은 사이드바 개요 배지와 같은 값(`useFailureCount`)이다. 이전에는 모든 화면이 `EveryUp | Self-hosted Monitoring Platform`이었고 장애 수는 개요에서만 붙었다(UI/UX 점검 A3). 화면에서 `document.title`을 직접 바꾸지 않는다.

#### `AppHeader` — 현재 위치 (데스크톱 전용, 2026-11-29 G안)

```
EveryUp / 서버                      ← 메뉴 첫 화면(크럼 하나)은 앞에 EveryUp을 붙인다
서버 / prod-server / payment-worker
```

높이 **`h-13`(52px)**, 바탕 없이 아래 `border-border` 한 줄, 좌우 `px-8`. 경로는 13px(`type-control`)이고 조상은 `text-text-faint`, 현재 위치는 `text-text` 500, 구분자는 `/`다. 오른쪽은 화면이 포털로 넣는 자리(`actionSlot`: 메뉴 첫 화면의 갱신 상태, 대상 상세의 기간 선택과 목록 복귀 링크)와 알림 링크(종 아이콘)다. 본문 래퍼는 `max-w-290`(1160px) 가운데 정렬, `lg:px-8 lg:pt-7 lg:pb-10`이다.

**첫 크럼(섹션)은 경로에서 자동으로 나온다** — [`navSections.ts`](src/components/layout/navSections.ts)의 prefix 표, 가장 긴 것이 이긴다. 목록 페이지는 아무 코드도 추가하지 않아도 된다.

**`navSections.ts`가 내비게이션의 유일한 출처다** (2026-10-10) — 사이드바, 모바일 하단 내비와 더보기, 명령 팔레트, 첫 크럼이 모두 이 표의 경로·라벨·아이콘을 읽는다. 섹션을 추가·이름 변경할 때 이 파일만 고친다. 항목마다 사이드바 그룹(`group`), 모바일에서 들어가는 곳(`mobile`: 하단 내비 또는 더보기), 더보기 설명, 상세 경로(`aliases` — `/services`의 Docker 서비스 상세는 서버)를 함께 적는다. 사이드바 활성 항목과 첫 크럼은 같은 `sectionFor()`를 쓰므로 어긋날 수 없다.

**상세 페이지는 그 뒤쪽만 선언한다** — [`useBreadcrumb`](src/contexts/BreadcrumbContext.tsx). 훅은 조건부로 호출할 수 없으므로 데이터 로딩 전에는 배열을 비운다:

```tsx
useBreadcrumb(monitor ? [{ label: monitor.name }] : []);
```

**"목록으로" 버튼을 따로 두지 않는다.** 첫 크럼이 목록 링크라 목적지가 같다. 모바일은 `AppHeader`가 없으므로 기존 `← 목록으로` 버튼을 `lg:hidden`으로 유지한다(서버 상세는 `← 서버 목록`).

**대상 페이지의 목록 복귀 링크** (2026-11-21, 그전의 "서버 탭 안의 대상 상세" 예외를 대신한다). 앱과 업타임 모니터는 자기 페이지가 있다(§4.7 대상 상세의 틀). 목록(서버의 업타임·로그·API 요청·메트릭 탭, 전체 로그)에서 연 대상은 그 목록으로 돌아가는 링크(`모니터 목록`, `앱 목록`, `전체 로그`)를 둔다. 링크는 목록에서 넘겨받은 주소(`state.returnTo`)로 돌아가므로 검색어, 필터, 보기 방식이 유지된다(`listBack`). 넓은 화면에서는 상단 바(`AppHeader`)의 오른쪽 조작 자리에 두어 본문의 높이를 쓰지 않고, 좁은 화면에서는 머리말 첫 줄의 복귀 링크가 된다. 크럼(`서버 › edge-host-01 › Storefront`)의 서버 이름은 서버의 개요로 가고 목록의 상태를 모르므로 목적지가 다르다. 모니터는 목록에서 열지 않았어도 그 서버의 업타임 목록으로 돌아가고, 앱은 목록에서 열었을 때만 둔다(앱은 여러 탭에 걸쳐 있다).

**탭은 크럼이 아니다.** 컨테이너 페이지의 `?tab=logs` 같은 하위 뷰는 위치가 아니라 같은 위치의 다른 단면이므로 trail에 넣지 않는다. 서버 상세의 탭은 경로에 있지만(`/servers/web-01/uptime`, §4.6) 같은 이유로 크럼에 넣지 않는다: 크럼은 `서버 › web-01`이고, 대상 페이지(`/servers/web-01/monitors/<id>`, `/servers/web-01/apps/<id>`)에서 `서버 › web-01 › Storefront`가 된다.

**서버 화면의 주소는 `serverPath()`로만 만든다** (2026-11-18, [`features/servers/serverPaths.ts`](src/features/servers/serverPaths.ts)). `/servers/:serverId`(개요 탭)와 `/servers/:serverId/:capability`(기능 탭)는 `serverPath()`, 대상 페이지는 `appPath()`(`/servers/:serverId/apps/:appId?tab=`)와 `monitorPath()`(`/servers/:serverId/monitors/:monitorId`)다(2026-11-21). 컴포넌트마다 문자열을 이어 붙이면 인코딩과 순서가 어긋난다. 옛 주소는 모두 넘어간다(쿼리·해시 보존, 기록 교체): 옛 메뉴의 `/uptime`, `/infrastructure`, `/api`, `/metrics`, `/services`는 `/servers`로, `/uptime/<id>` 같은 대상 주소는 대상을 조회해 서버를 알아낸 뒤 그 대상 페이지로(`LegacyTargetRedirect`), 서버 탭 안의 옛 대상 주소 `/servers/:s/{uptime,logs,api,metrics}/:id`는 대상 페이지로(`LegacyServerMonitorRedirect`, `LegacyServerAppRedirect`), `/servers/:s/infrastructure/:id`는 그 탭으로(`LegacyServerTabRedirect`) 간다. 이미 발송된 알림과 장애 이력의 링크가 이 길로 들어온다.

**전체 로그(`/logs`)는 사이드바에 없는 서버 섹션의 화면이다** (2026-11-18). `navSections.ts`에서 서버의 `aliases`이므로 사이드바의 `서버`가 현재 위치이고 크럼은 `서버 › 전체 로그`다. 서버 목록 머리말의 `전체 로그`(갱신 시각 옆, 서버가 없거나 목록을 불러오지 못한 화면에도 있다), 서버 로그 탭의 `모든 서버의 로그`, 개요, 명령 팔레트, 모바일 더보기에서 들어간다. 사이드바에 없는 화면이므로 h1을 숨기지 않는다(아래 규칙의 대상이 아니다).

**그룹은 없다** (2026-11-24, ADR 0013). 모든 것이 서버 단위다: 그룹 메뉴·화면·필드·필터·API가 없고, 서버 이름은 전체에서 하나다(대소문자·앞뒤 공백 무시). 옛 그룹 주소(`/projects`, `/projects/:id`와 그 아래)는 쿼리·해시를 두고 서버 목록으로 간다(`LegacyGroupRedirect`). 그보다 옛날의 `/projects/:agentId`(Docker 환경)는 그 서버로 간다. 서버를 묶어 보는 자리가 필요하면 그룹을 되살리지 말고 서버 목록의 검색·필터로 푼다.

**메뉴 첫 화면의 제목은 본문 h1이다** (2026-11-29 G안 — 2026-11-21 "데스크톱은 `AppHeader`가 제목"을 대체). 상단 줄은 13px 경로만 그리고, 본문 첫 줄이 `h1`(24px) + 흐린 개수(`서버 13`, 13px `text-text-faint`) + 오른쪽 주 액션이다. 갱신 상태(meta)는 데스크톱에서 `AppHeader` 오른쪽 자리로 포털된다. 머리말 아래에 구분선을 두지 않는다.
- **개수는 한 목록이 화면의 전부인 메뉴만 단다**: 서버(Docker 서버 포함). 탭이 목록을 나누는 알림은 탭이 개수를 말한다. 개수를 아직 모르면(`count={null}`) 숫자 자리만 비운다.
- 메뉴 첫 화면에는 설명 문구(subtitle)를 두지 않는다.
- 상세 화면의 h1은 대상 이름이 상태·메타를 이끈다.

전체 화면 높이를 계산하는 페이지는 **`lg`에서 빼는 값이 다르다** — `lg`에서는 `AppHeader` 3.25rem이 붙어 `lg:h-[calc(100dvh-7.25rem)]`이다. 모바일은 높이를 계산하지 않고 자연 높이로 두며, 하단 제출 바를 `sticky`로 하단 내비(4rem + safe-area) 위에 붙인다 — 데모 배너처럼 위쪽 크롬이 늘면 높이 계산이 틀려 제출 바가 `BottomNavMobile` 뒤로 숨었다 (`ChannelFormPage`).

**풀블리드로 빠져나가는 페이지의 음수 마진은 본문 래퍼 패딩과 정확히 같아야 한다.** 래퍼는 `p-4 sm:px-6 sm:py-6 lg:px-8 lg:pt-7 lg:pb-10`이므로 탈출값은 `-m-4 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-mt-7 lg:-mb-10`이다. `ChannelFormPage`가 쓰던 `md:-m-8`은 존재하지 않는 32px 패딩을 가정해 8px 더 당겼고, 헤더가 기준선을 주기 전까지 드러나지 않았다.

### 3.5 그림자

`shadow-sm`·`shadow-lg`만 쓴다(`pnpm lint`). 상자에는 그림자를 쓰지 않는다. 떠 있는 표면(툴팁, 차트 툴팁, `Select` 목록, 메뉴, 토스트, 모달, `ConfirmDialog`, 사이드 패널, 명령 팔레트)은 `bg-surface border border-border shadow-lg`이고, 모달 뒤는 `bg-scrim`(+ blur)이다.

### 3.6 클릭 가능한 행·카드

행(표, 두 줄 목록)은 `hover:bg-surface-hover`와 6px 모서리다. 카드 보기의 항목은 `.card-interactive`(`index.css`) 하나만 쓴다. 카드마다 `hover:-translate-y-*`·`hover:shadow-md`·`transition-all`을 조합하지 않는다.

### 3.7 간격 (2026-10-09)

**관계가 가까울수록 좁게 둔다.** 간격은 값이 아니라 두 요소의 관계로 고른다. 코드 전수 샘플링에서 다수가 이미 이 순서를 따르고 있었고, 아래 표는 그 다수를 규칙으로 올린 것이다. `gap-*`·`space-y-*`·`mt-*`가 같은 표를 따른다.

**부모가 간격을 정한다** (2026-11-21, 간격 체계화 P0). 형제 사이의 간격은 부모의 `gap`·`space-y`·`page-stack`·`section-stack`이 갖는다. 컴포넌트의 루트 요소에는 바깥 여백(`mt-*`, `mb-*`)을 두지 않는다 — 같은 컴포넌트가 놓이는 자리마다 앞뒤 관계가 다르기 때문이다. 예외는 hover 패딩을 상쇄하는 음수 여백(`list-bleed`, `table-bleed`)과 밀어내기(`ml-auto`)뿐이다. 여백 하나만 가진 감싸개(`<div className="mt-3">`)도 같은 이유로 쓰지 않는다. 2026-11-21 기준 이탈 건수와 이관 단계는 §10, 측정 방법은 `pnpm measure`(`scripts/measure-layout.mjs`)다.

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

**관계 검사 표지.** 공용 프리미티브는 자기가 맡은 간격에 `data-gap-after="<토큰>"`(이 요소와 다음 내용 사이) 또는 `data-gap="<토큰>"`(앞 내용과 이 요소 사이)을 단다. e2e 관계 검사(§10 P2)가 이 표지만 잰다. 화면 코드에는 달지 않는다.

**기계가 지키는 것** (2026-11-21, 간격 체계화 P6). 아래는 사람이 화면마다 다시 재지 않는다.

- `pnpm lint`(금지, 0건이어야 한다): 임의값 간격(S1), 블록 사이 세로 반 단계(S2), 화면 코드의 줄 상자 보정 `mt-0.5`(S3), 여백만 가진 감싸개(S4), 컴포넌트 루트의 바깥 여백(S5, TypeScript AST), 역할 없는 글자 크기(S6), `leading-*`(S7), 숫자 세로 간격(S8). 세는 범위와 예외는 §10 표다.
- `e2e/spacing-rhythm.spec.ts`: 14개 화면 × 1440·390에서 관계 표지의 간격이 토큰 ±1px이고 `intra < label < heading < item ≤ group < section`이다. 재시도 없이 돈다. 어긋난 자리 목록(`KNOWN_OFF`)은 비어 있다.
- `pnpm measure`: 화면을 바꾸지 않는 정리는 전후 비교가 "차이 없음"이어야 한다(`node scripts/measure-layout.mjs --compare`). 화면을 바꾸는 PR은 같은 도구의 `--shots`로 전후 캡처를 붙인다.

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

모달과 사이드 패널의 패딩이 다른 것은 의도다. 패널은 화면 가장자리에 붙은 좁은 기둥이라 한 단계 좁다. 이탈은 §10.

### 3.8 반응형 (2026-10-09)

Tailwind 기본 브레이크포인트만 쓴다. `2xl`은 쓰지 않는다 — 본문 최대 폭이 1280px(§3.3)라 그 위로는 바뀌는 것이 없다.

| 경계 | 바뀌는 것 |
|------|-----------|
| `sm` 640 | 터치 높이 44 → 40px(`Button md`·입력·`IconButton md`, §4.1) · `SegmentedControl md` 트랙 44 → 40px(선택 버튼 44 → 36px) · 툴바 버튼 라벨 표시(`collapseLabel`) · 목록 검색창 전체 폭 → 320px · `DetailMeta` 속성 2열 · 본문 래퍼 패딩 `p-4` → `px-6 py-5` |
| `md` 768 | **뷰 분기** — `useIsMobile()`(767px 이하)이 알림·설정을 모바일 전용 뷰(`*MobileView`)로 가른다 · `PageHeader` 액션이 설명과 같은 행 · 대상 카드 목록 2열 |
| `lg` 1024 | **셸 전환** — `Sidebar` + `AppHeader` ↔ `Header` + `BottomNavMobile`(§3.4) · 차트 패널 2열 · 모바일 `← 목록으로` 숨김 |
| `xl` 1280 | 대상 카드 목록 3열 · KPI 게이지 4열 |

**대상 카드 목록은 `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`이다.** `lg`에서 사이드바(240px)가 생기면 본문이 약 720px로 줄어, 3열이면 카드 한 장이 230px까지 좁아진다 — `lg:grid-cols-3`을 쓰지 않는 이유다. `xl`의 3열은 카드당 약 315px다. 차트 패널은 `lg:grid-cols-2`(§4.2 메트릭 탐색·인프라 추세), KPI 행은 장수에 맞춘다(3장 `sm:grid-cols-3`, 게이지 4장 `grid-cols-2 xl:grid-cols-4`).

**`md`~`lg` 구간(768~1023px)은 데스크톱 뷰 + 모바일 셸이다.** 뷰 분기(`md`)와 셸 전환(`lg`)의 경계가 달라서, 태블릿 가로 폭에서는 알림·설정이 데스크톱 표를 보여 주면서 내비는 하단바다. 의도로 기록된 결정이 아니므로, 이 구간을 손볼 때 경계를 하나로 맞출지 먼저 정한다(§10).

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
| **`Toggle`** | `checked` `onChange` `disabled` `title` | w-9 h-5, `role="switch"`. 켜짐 트랙은 `ok`이다. 무채색 채움이면 토글 열이 화면에서 가장 진했다 |
| **`SegmentedControl<T>`** | `options` `value` `onChange` `size?` `ariaLabel` `scroll?` | 2~4지 배타 선택. `size`를 주지 않으면 자리가 정한다: `AppHeader` 안(`ControlDefaultsContext`)은 `sm`, 본문은 `md`(2026-11-20). 선택지에 `icon`을 주면 label을 접근성 이름·툴팁으로 유지. 선택지에 `tone`·`toneLabel`을 주면 이름 있는 상태 점을 붙이고, 정상이 아니면 문구도 보인다(서버의 앱 선택, 2026-11-18). `scroll`은 줄바꿈 대신 감싼 영역 안에서 가로 스크롤하고, 이름이 `max-w-36`에서 잘리므로 툴팁에 전체 이름을 넣는다(정상인 선택지는 `이름, 수집 중`, 2026-11-19) |
| **`Tabs<T>`** | `items` `active` `onChange(key, source?)` `ariaLabel` `idPrefix` | 패널을 바꾸는 밑줄 탭(§4.6, 2026-11-18). 항목은 `label` `tone?` `toneLabel?` `caption?` `srDetail?` `muted?`. 패널의 id는 `tabIds.ts`의 `tabId`·`tabPanelId`로 맞춘다. 상태 점이 있는 탭은 툴팁으로 `toneLabel`을 보인다(2026-11-19) |
| **`ListViewToggle`** | `view` `onChange` | 대상 목록의 그리드·카드 전환. `SegmentedControl` 래퍼라 크기도 자리를 따른다 — 헤더 32px, 본문 40px(§4.5). 크기를 화면마다 넘기지 않는다 |
| **`ResourceTable<T>`** | `rows` `columns` `rowKey` `ariaLabel` `renderDetails?` | 대상 비교 표. 숫자 우측 정렬·반응형 열·행 아래 구성 관리 (§4.5). G안: 흐린 12px 열 이름, 행마다 위 헤어라인, 맨 아래 선, 행 채움 없음 |
| **`TimeRangePicker`** | `value: GlobalTimeRange` `onChange` | `1h`\|`6h`\|`24h`. SegmentedControl 래퍼 |
| **`ConfirmDialog`** | `isOpen` `title` `message` `variant` `icon` … | `window.confirm()` 금지 — 항상 이것 |
| **`EmptyState`** | `icon` `title` `description?` `action?` `children?` `headingLevel?` | 빈 목록의 정본. 라벨+핸들러면 `action`, 자체 상태를 가진 트리거(연결 다이얼로그 등)는 children. 제목은 기본 h3, 페이지의 h1 바로 아래면 `h2`, 화면 전체가 이 안내면 `h1` |
| **`PageHeader`** | `title` `subtitle?` `meta?` `aside?` `actions?` `children` `menu?` `compactActions?` `truncateTitle?` `count?` | h1 등급 고정. `count`는 제목 뒤의 개수다: 데스크톱은 `AppHeader` 제목에, 모바일은 h1에 붙는다(§3.4, 서버). `actions`는 상세의 대상 조작으로 제목 줄 오른쪽, 제목과 세로 가운데다(§4.1 상세 헤더). `meta`는 대상 메타데이터 — 상세는 `DetailMeta`. `aside`는 서비스 상세의 우측 조회 제어·바로가기. `menu`는 메뉴 첫 화면(§3.4): 모바일에서 조작이 제목 줄 오른쪽이다. `compactActions`는 메뉴가 아닌 화면에서 조작을 제목과 같은 줄에 둔다(전체 로그, 서버 상세, §4.1 액션 앵커의 예외). `truncateTitle`은 긴 제목을 말줄임한다(서버 상세) |
| **`OverflowMenu`** | `items` `label?` | 상세 머리말의 `더보기` 메뉴(2026-11-21). 항목은 `label` `icon?` `onSelect` 또는 `to`, `danger?`(메뉴 끝, 붉은 글자), `disabled?` `disabledReason?`. 40px(터치 44px) 아이콘 버튼과 `role="menu"` 목록. 주 조작 하나 외의 조작을 여기에 둔다(§4.1 상세 헤더) |
| **`RefreshStatus`** | `updatedAt` `onRefresh?` `refreshing?` `autoRefresh?` `onAutoRefreshChange?` | 갱신 상태 한 묶음: 마지막 갱신 시각(툴팁에 전체 시각), 새로고침, `30초마다 자동 갱신` 스위치. 상세 헤더 상태 줄의 오른쪽 끝, 개요·서버 목록의 머리. 좁은 화면에서는 스위치 옆 글자를 숨긴다 |
| **`DetailMeta`** | `status` `connection?` `fields?` `collapseOnMobile?` `collapsed?` | 상세 헤더 `meta`의 정본. 상태 줄 + (대상 상세의 연결 줄, §4.7) + 속성 목록(라벨 좌 / 값 우, `sm` 이상 2열). 속성이 많은 Docker 서비스 상세는 모바일에서 `서비스 정보`를 펼쳐 확인하며 상태는 항상 노출. `collapsed`는 모든 폭에서 접고 요약 줄에 속성 이름을 적는다(서버 탭의 `연결 정보`, `모니터 정보`)  행 높이는 하나다: sm 이상 40px(값 안의 조작은 `ControlDefaultsContext`로 sm 32px), 터치 화면 44px. 이전에는 조작이 든 행만 44~48px였다(2026-11-21) |
| **`ListToolbar`** | `search` `children?` | 목록 검색은 왼쪽, 필터는 그다음 |
| **`FilterChips<T>`** | `ariaLabel` `options` `value` `onChange` | 목록을 한 값으로 거르는 토글 칩(2026-11-20). 선택지는 `label` `count` `tone?`. 라벨과 개수는 같은 `type-body` 크기이고 개수만 500·고정폭 숫자다. 둥근 테두리 칩(`rounded-full`, 높이는 버튼과 같은 40px, 모바일 44px), 칩 사이 `gap-2`, 칩 안 `gap-1.5`(모바일은 둘 다 한 단계 좁혀 390px에서 네 칩이 한 줄이다). 선택은 `aria-pressed` + 진한 테두리(`border-accent`)와 `ui-hover` 채움이고, 다시 누르면 해제한다. 키보드는 버튼 그대로다(Tab, Enter, Space). `tone`은 상태 점이다: 상태 필터 전용이고(§5.3 칩은 상태 전용), 0건인 장애·확인 필요는 호출부가 `idle`로 넘긴다(§5.4). 개수는 다른 필터(검색·연결 방식·심각도 등)를 따르고 자기 선택은 따르지 않는다(고른 칩 옆의 다른 칩이 0이 되지 않는다). 쓰는 곳(2026-11-21): 서버 목록의 상태(`stateChipOptions`, 장애·확인 필요·대기·정상), Docker 환경의 서비스 상태(장애·정상), 업타임 탭의 상태(장애·정상·확인 대기·일시정지), 알림 규칙의 유형(`categoryChipOptions`, 데스크톱·모바일 같음, 0건인 유형도 자리를 지킨다), 데스크톱 발송 이력의 상태(발송·실패, 라벨은 행의 `historyStatus`). 툴바에 선택(`Select`)과 함께 놓이면 선택이 먼저이고 칩 묶음이 마지막이다: 줄이 넘치면 칩 묶음이 통째로 다음 줄로 간다. 검색어와 칩 선택은 `useListSearch`가 주소(`q`, `status`)에 둔다(알림 탭 안의 필터는 화면 상태다) |
| **`ResourceCardHeader`** | `title` `badge?` `subtitle?` `status?` | 대상 이름·출처·상태의 고정 배치 (종류 아이콘 없음) |
| ~~`SummaryCard`~~ | — | 2026-11-21 삭제(사용 0회). 수치는 `Stat`(라벨 → 값 4px, `type-kpi`)으로 쓴다 |
| **`Section`** | `title` `meta?` `description?` `actions?` `id?` `label?` `className?` `children` | 본문 1단계 섹션(§2.2). 20px 제목 + 기준선을 맞춘 메타 + 제목 줄과 가운데를 맞춘 조작 + 둘째 줄 설명, 그리고 본문. 제목 → 본문 16px(`heading`)은 머리와 본문 두 자식의 `gap`이다(2026-11-21, 이전 `SectionHeader`는 루트의 `mb-4`로 간격을 가졌다). `<section>`의 이름은 제목이고 `label`을 주면 그것이다. 2026-11-20에 `DetailActionToolbar`를 없애고 그 조작은 `PageHeader actions`로 옮겼다 |
| **`List` · `ListRow` · `ListGroup` · `ListMore`** | `ListRow`: `to` `marker` `title` `detail?` `detailSize?` `trailing?` `trailingDetail?` | 두 줄 목록(§3.7 세로 위계). 개요의 현재 확인 필요·최근 장애 이력, Docker 환경의 장애 이력, 로그의 반복 패턴이 쓴다. `List`는 `list-bleed`로 행 패딩만큼 펼치고 글자 폭 720px(`max-w-186`, 펼친 24px 포함)까지만 써서 오른쪽 값(시각, 개수)이 이름에서 멀어지지 않게 한다. `ListGroup`은 하위 그룹(라벨 `type-label` `text-text`, 라벨 → 항목 8px), `ListMore`는 목록 끝의 펼치기 조작으로 아이콘은 표지 열, 글자는 항목 제목 열에 선다. 2026-11-21 이전에는 세 화면이 각자 만들었다 |
| **`Pagination`** | `page` `totalPages` `onChange` … | 목록 페이지 이동 |
| **`MaterialIcon`** | `name` `size` `className` `style` | 로컬 정적 SVG |
| **`Tooltip`** | `content` `focusable?` + 단일 자식 | hover·포커스 힌트. DOM 래퍼 없이 기존 요소에 연결 |
| **`IconButton`** | `icon` `label` `tone?` `size?` `iconClassName?` | 라벨 없는 아이콘 액션. `tone`은 `action`(기본)·`danger`·`quiet`. `danger`는 쉴 때 `text-muted`이고 hover·포커스에서만 붉다(2026-11-21) — 행마다 반복되는 붉은 휴지통이 목록 오른쪽 끝에 색 기둥을 만들어 시선이 규칙 이름보다 거기서 먼저 멈췄다. 표·카드 행의 편집 아이콘은 `quiet`다. className을 받는 자리(CopyButton)는 같은 파일의 `ICON_ACTION`/`ICON_ACTION_SM` |
| **`CopyButton`** | `onCopy` `title` `className` … | 3초 완료 피드백. 클래스는 같은 파일이 export하는 `COPY_ACTION_PRIMARY`/`COPY_ACTION_SUBTLE`을 쓴다 |

상수 파일(2026-11-18): `statusTone.ts`의 `STATUS_DOT`이 상태 점 색의 유일한 정의다(`StatusLight`·`Tabs`·`SegmentedControl`의 점). `collectionStatus.ts`의 `COLLECTION_STATUS_LABEL`은 수집 상태 문구이고, 점 없이 문구만 필요한 자리(인프라 탭 상태 줄의 원인)도 같은 말을 쓴다. 컴포넌트 파일에서 상수를 export하면 fast refresh 규칙에 걸려서 따로 둔다.

**Button 스펙**

| variant | 용도 | 클래스 |
|---------|------|--------|
| `primary` | 주 액션 (화면당 1개) | `bg-accent text-accent-text hover:bg-accent/90` |
| `secondary` | 보더 있는 보조 액션 | `border border-border text-text` + 아이콘 `action` |
| `ghost` | 배경 없는 3순위 | `text-text hover:bg-text/10` |
| `text` | 경로처럼 본문 안에 놓는 액션. hover 채움 없음 | `text-text` |
| `destructive` | 삭제·비활성화 — secondary와 **같은 모양**에 글자만 빨강 | `border border-border text-crit-text hover:bg-crit-bg` |
| `quiet` | 정보만 보여주는 다이얼로그의 `닫기` — 눈에 띄지 않아야 하는 이탈 | `text-text-muted hover:bg-surface-hover` |
| `danger` | 확인 다이얼로그의 파괴 확정 | `bg-crit text-white hover:bg-crit` (§1.4) |

**액션은 색이 아니라 형태로 드러낸다 (2026-11-15, 무채색 전환).** `action`이 제목 글자색과 같아졌으므로 `ghost` 버튼은 색으로 본문과 갈리지 않는다. 그래서 **`ghost`는 아이콘을 함께 둔다** — 아이콘 없는 글자만의 `ghost`는 라벨로 읽힌다(예: 개요의 `전체 N건 보기`에 `expand_more`). 아이콘을 둘 수 없으면 `secondary`(보더가 버튼임을 말한다)나 텍스트 링크(`link-underline`)를 쓴다. **예외는 이탈 액션뿐이다** — 닫기를 색으로 강조하면 정작 그 화면의 주 액션보다 먼저 눈에 들어온다. `quiet`가 그 자리다. 폼 푸터의 `취소`는 주 액션과 짝을 이루므로 `secondary`다(§7 푸터 규칙).

**버튼 색을 `className`으로 덮어쓰지 않는다.** `variant="ghost" className="text-crit-text"`로 쓰던 삭제 버튼 5곳이 전부 회색으로 렌더되고 있었다 — Tailwind가 같은 속성의 유틸리티를 **알파벳 순**으로 내보내기 때문에 `text-crit-text`가 `text-text-muted`보다 앞서 나가 매번 졌다. 색은 variant로 고른다.

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

- 페이지의 주 액션은 `PageHeader`의 `children`에 둔다. 메뉴 첫 화면(`menu`)은 **h1 + 흐린 개수·요약 + 오른쪽 주 액션이 한 줄**이다(G안 `서버 13 … 서버 추가`). 전체 로그·서버 상세(`compactActions`)와 대상 상세(`actions`)도 조작이 제목 줄 오른쪽이다. 제목이 길면 제목이 줄고 버튼은 줄지 않는다. 넓은 화면에서 제목 줄의 조작은 32px다.
- 액션은 **보조 → 주 액션** 순서로 전달해 주 액션을 우측 끝에 둔다. 헤더 내부에 별도 flex 래퍼를 만들지 않는다. 40px 버튼의 중심을 설명 행의 중심에 맞춘다(`md:items-center`). `sm` 미만에서는 버튼을 전체 폭으로 쌓고, 그 이상에서는 같은 순서로 줄바꿈한다. 메뉴 첫 화면(`PageHeader menu`)은 쌓지 않고 한 줄에 두며 마지막(주 액션)이 남은 폭을 채운다 — 아이콘 새로고침 + 주 액션(2026-11-15). 버튼 아이콘은 20px, 버튼 간격은 8px, 헤더 아래 간격은 24px다.
- **버튼 라벨은 명사형이다** — `추가`·`저장`·`삭제`·`수정`·`취소`·`닫기`. 대상을 새로 만드는 액션의 라벨은 **`추가` 하나다.** 편집 제출은 `저장`. `생성`·`규칙 생성`처럼 동사를 바꾸지 않고, `추가하기`처럼 어미를 붙이지 않는다(2026-09-24 — 같은 푸터에 `[취소][추가하기]`와 `[취소][저장]`이 섞여 있었다). 진행 중에도 라벨은 바꾸지 않는다(`loading`). 페이지 헤더 CTA, 빈 상태의 액션, 다이얼로그 제출 버튼 전부 같은 문구를 쓴다. `업타임 추가`·`Logs 직접 추가`·`Collector 추가`처럼 대상을 앞에 붙이지 않는다 — 대상은 페이지 제목이나 모달 제목이 이미 말하고, 명사를 각자 고르게 두면 한글·영어가 섞이고 화면마다 어긋난다. 라벨에 영어 리소스명(`Logs`·`Metrics`·`Collector`)을 넣지 않는다.
- **제목은 이 규칙 밖이다** — 다이얼로그·페이지 제목은 `업타임 모니터 추가`·`채널 추가`처럼 대상을 밝힌다. 라벨에서 명사를 뺄 수 있는 근거가 제목이므로, 제목까지 비우면 맥락이 사라진다.
- Docker·로그·API 요청·메트릭·인프라의 연결 진입점은 `Docker Collector 설치`(2026-11-22, 이전 `Docker 연결`)·`로그 연결`·`API 요청 연결`·`메트릭 연결`·`인프라 연결`이다(§9.17). 기존 대상 재사용과 새 대상 등록을 모두 포함하므로 위의 생성 전용 `추가` 규칙과 구분한다. 키나 명령을 받는 연결 대화 상자의 제출 버튼은 `추가`가 아니라 `연결`이다.
- **예외: 대상을 말해 주는 화면 제목이 없는 자리에서는 라벨에 대상을 붙인다** (2026-11-19 결정). 라벨에서 명사를 뺄 수 있는 근거가 제목이므로(아래), 제목이 다른 것을 말하는 자리에서는 명사가 필요하다. 2026-11-19 기준 이 예외의 자리:
  - 서버 탭 줄의 조작 자리(§4.6): `업타임 모니터 추가`, `로그 연결`, `API 요청 연결`, `메트릭 연결`(`connectCopy.ts`의 `connectAction`). 연결 안내의 주 버튼도 같은 문구다(인프라는 `인프라 연결`). 탭 줄의 버튼은 `secondary`, 연결 안내(빈 상태) 안의 버튼은 `primary`다.
  - 대상이 없는 서버의 개요 탭: `업타임 모니터 추가`(primary)와 나머지 네 기능의 `{기능} 연결`(secondary).
  - 개요의 빈 화면(`아직 모니터링 대상이 없습니다`)과 서버 목록이 비었을 때의 안내: `서버 추가`. 다른 서버가 없어 옮길 곳이 없는 `다른 서버로 옮기기` 대화 상자의 `서버 추가`도 같다.
  - 서버 목록의 머리말 버튼도 `서버 추가`다(G안, 2026-11-29 — 2026-11-19의 `추가`를 되돌렸다).
- 헤더 블록은 `border-b border-border pb-5`로 띠를 이룬다. 제목과 우측 CTA 사이가 1000px 넘게 벌어지는 넓은 화면에서, 이 선이 없으면 버튼이 헤더에 속하지 않고 구석에 떠 있는 요소로 읽혔다.
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
- **다시 시도**: 화면 일부가 실패하면 [`LoadErrorBanner`](src/components/common/LoadErrorBanner.tsx)를 쓴다. 중립 배너(`bg-surface border-border`)에 `attn-text` 아이콘, 제목은 `type-label text-text`, 원인은 `type-body text-text-muted`, `Button variant="secondary" size="sm"` `다시 시도`다. 표 칸·카드·차트 카드 안처럼 상자를 하나 더 두면 카드 속 카드가 되는 자리는 `inline`(상자 없이 아이콘 + 글자 + 버튼)이다. 화면 전체가 실패하면 `EmptyState`의 `action`. **실패 문장을 경고색으로 칠하지 않는다** — 2026-11-14까지 10곳이 `text-attn-text` 문장이었다. 색은 아이콘 하나에 싣는다(§5.3). 일회성 주의문(`API Key는 지금 한 번만 표시됩니다`)도 같다: 경고 아이콘 + 기본 글자색.

**아이콘 크기** — `MaterialIcon`은 `size`로 SVG 크기를 정한다. 기본이자 본문 크기는 20px다 — 인라인·버튼·내비게이션·섹션이 전부 같은 20px를 쓴다(2026-09-22, 16px 층 폐지). 24px는 주요 상태용이다. 스피너·빈 상태에는 32/36/48px를 허용한다. `text-*`는 색에만 사용하고 폰트 크기를 아이콘 크기로 사용하지 않는다. 아이콘 획은 SVG 도형이 결정하므로 `font-*`로 두께를 조절하지 않는다. 같은 영역에서는 같은 아이콘 계열을 사용한다. 삭제는 `delete_outline` 하나다(`delete` 채움형과 섞지 않는다). 제출 버튼 아이콘은 생성(`add`)에만 붙인다.

**MaterialIcon 함정** — `iconMarkup` 맵에 없는 `name`은 `help_outline`(`?`)로 폴백한다. 신규 아이콘은 반드시 [`materialIconPaths.ts`](src/components/common/materialIconPaths.ts)에 path를 추가한다.

**(2026-11-21 `SummaryCard` 삭제로 기록만 남는다.) KPI 카드(`SummaryCard`)는 2행이었다** — 라벨(좌)과 숫자(우)가 베이스라인을 맞춘 한 행, 그 아래 설명 한 행. 이전에는 라벨/숫자/설명이 3행으로 쌓이고 아이콘만 우측 상단에 혼자 떠 있어서, 카드 폭 ~300px 중 오른쪽 절반이 비고 내용은 좌측에 쏠렸다. 숫자를 오른쪽 끝으로 보내 그 여백을 쓴다. 숫자는 `tabular-nums`(Spoqa는 숫자가 원래 고정폭)라 카드마다 우측 정렬 위치가 같다.

**KPI 설명문의 색은 `warn`·`error`일 때만 싣는다.** `healthy`·`idle`은 `text-text-muted`다. 카드 4장이 전부 색 문장을 달고 있으면 정작 문제인 카드가 묻힌다 — §5.1 `StatusLight`와 같은 논리다. 이 규칙이 기존 오용도 함께 걷어냈다: 업타임 `정상` 카드의 `전체 5개 대상 중`(분모)과 개요 `Projects` 카드의 `대상을 운영 단위로 묶고 있습니다`(설명)가 `tone="healthy"`를 타고 초록으로 칠해지고 있었는데, 둘 다 상태가 아니다.

**대상 목록의 카드 헤더** — 카드 보기의 대상 카드(업타임 모니터 `UptimeTargetCard`, 로그 앱 `LogServiceOverview`)는 `ResourceCardHeader`를 쓴다(2026-11-22 기준 목록 — Docker 환경 목록 `ServiceGridPage`·`PendingServiceCard`와 상세 `ProjectDetailPage`는 Docker 호스트가 서버가 되면서, 그룹 목록·상세는 그룹이 없어지면서(2026-11-24) 없어졌다). 출처는 이름 옆, 상태 또는 대상별 작업은 우측이다.

**대상 카드에 종류 아이콘을 달지 않는다** (2026-09-20). 한 목록의 카드가 전부 같은 아이콘을 달고 있어서(업타임=`monitor_heart`, API=`api`, 로그=`article`, …) 카드끼리 구분되는 정보가 **0**이었다. 대상의 종류는 페이지 제목과 사이드바의 활성 항목(서버 화면에서는 탭)이 이미 말한다. 직접 연결/Docker 연결 여부로 아이콘을 달리하는 것도 마찬가지다 — 그건 출처 라벨이 말한다.

아이콘이 의미를 지니는 자리는 남는다: 사이드바 내비, 알림 채널의 브랜드 아이콘, 상태 아이콘, `EmptyState`의 안내 아이콘. 이들은 **선택지마다 아이콘이 다르거나 하나뿐이라** 반복 장식이 아니다.

**카드의 좌측 기준선은 하나다.** 제목·부제·본문(endpoint·통계 그리드·푸터)이 전부 카드 패딩에 정렬한다. 아이콘을 없애면서 자동으로 성립하지만, 무엇이든 제목 줄에 거터를 도입하면 그 아래 본문과 좌변이 어긋난다는 규칙 자체는 유효하다 — `ResourceCardHeader`를 쓰는 8개 카드 전부가 그 증상이었다(2026-09-20 해소).

배치 판단 참고: [PatternFly Page header](https://www.patternfly.org/component-groups/content-containers/page-header/)의 제목 우측 액션, [Carbon Data table](https://carbondesignsystem.com/components/data-table/usage/)의 검색·필터 툴바. 이 프로젝트에서는 기존 페이지 CTA 앵커를 유지하고 목록 조회 제어를 별도 줄로 통일한다.

**상세 헤더는 한 모양이다 (2026-11-21, 점검 B1·B2).** 서버·컨테이너 상세와 서버 탭의 대상 패널(모니터, 앱, 인프라)이 같다.
- **제목 줄 오른쪽**: 주 조작 하나(secondary)와 `OverflowMenu`(`더보기`, 40px 아이콘 버튼). 드물게 쓰는 조작과 파괴적 조작(삭제, 비활성화, 연결 해제)은 메뉴에 두고 파괴적 항목은 메뉴 끝에 붉은 글자로 둔다. 주 조작: 서버 `서버 설정`(아이콘), Docker Collector가 있는 서버는 설치 전에만 `설치 명령`을 더한다(메뉴: 설치 뒤의 `다시 설치`, API Key, 상세 수집 설정, `Docker Collector 비활성화` — `useDockerActions`), Docker 서비스 `알림 규칙`(장애일 때만 `에러 확인`을 더한다 — 이전에는 정상일 때 이유 없이 비활성이었다), 모니터 `수정`(메뉴: 알림 규칙, 다른 서버로 옮기기, 삭제), 앱·인프라 `알림 규칙`(메뉴: 다른 서버로 옮기기, 삭제·연결 해제). 이전에는 화면마다 3~4개의 버튼을 같은 무게로 늘어놓았다.
- **갱신 상태는 상태 줄의 오른쪽 끝**: `RefreshStatus`(마지막 갱신 시각 + 새로고침 + `30초마다 자동 갱신` 스위치)다. 개요도 같은 컨트롤을 쓴다(메뉴 화면이라 데스크톱은 `AppHeader`). 서버 목록은 스위치 없이 시각과 새로고침만 둔다. 이전에는 아이콘만, 시각 + 아이콘, 글자로만 적은 자동 갱신 등 다섯 모양이었다.
- **좁은 화면**: `RefreshStatus`는 스위치 옆 글자를 숨긴다(이름은 스위치의 툴팁·aria). 서버 상세는 복귀 링크와 같은 줄, 컨테이너 페이지 상세는 기간 선택과 같은 줄의 오른쪽 끝에 둔다 — 상태 줄 아래로 흘러 한 줄을 더 쓰던 것을 줄였다. 넓은 화면에서는 새로고침 버튼(40px)이 상태 줄(24px)을 키우지 않게 묶음이 위아래로 8px씩 펼쳐진다(`sm:-my-2`).
- 메뉴(`OverflowMenu`)는 `role="menu"`다. 열면 첫 항목에 포커스가 가고 화살표로 돌며(끝에서 처음으로), Esc·바깥 누름으로 닫힌다. 항목을 고르면 포커스를 먼저 `더보기` 버튼에 두므로, 그 항목이 연 대화 상자가 닫히면 포커스가 버튼으로 돌아온다.

**서비스 상세 헤더 예외 (2026-10-18, 사용자 요청)** — `AgentHealthCheckDetailView`는 `PageHeader.aside`에 기간 선택을 둔다(2026-11-21부터 알림 규칙·에러 확인은 제목 줄, 새로고침은 상태 줄의 `RefreshStatus`). `xl` 이상은 제목·메타데이터의 우측 상단, 그 미만은 메타데이터 다음으로 흐른다. 대상 정보·조회 조작·장애 대응이 한 헤더 띠에 속하며 별도 툴바·전체 폭 장애 배너를 반복하지 않는다. 라벨 있는 `에러 확인` secondary 버튼을 항상 표시하고 기존 로그 탭으로 이동한다. 에러가 없으면 native disabled로 비활성화한다. 새로고침·알림 규칙·에러 확인은 기본적으로 한 행으로 묶고, 공간이 부족하면 기간 선택만 앞줄로 흐른다. 200% 글자 확대처럼 액션 그룹 자체도 한 행에 들어가지 않으면 버튼을 숨기거나 가로로 넘기지 않고 줄바꿈을 허용한다. 별도 박스·원인·마지막 응답·장애 요약은 표시하지 않는다. 모바일에서도 바로가기 라벨을 유지한다. 다른 상세의 `DetailActionToolbar` 배치는 유지한다. `AgentServiceTabs`는 탭과 데이터 본문만 담당한다.

**서버 상세 헤더 예외 (2026-11-18, `ServerHeader`)** — "상세 화면의 헤더는 `PageHeader` + `actions`" 규칙의 예외다. 서버 상세는 탭이 패널을 바꾸므로 머리말이 모든 탭에 걸린다.
- `새로고침`과 `서버 설정`은 서버 이름(h1)과 **같은 줄의 오른쪽**이다(`PageHeader compactActions truncateTitle`). 이름이 길면 이름이 말줄임되고(전체는 툴팁) 버튼은 줄지 않는다. 버튼만 있는 줄이 탭과 본문을 아래로 밀었다.
- 설명(있으면 한 줄) 아래의 상태 줄은 `StatusLight` → 원인 문구 → 오른쪽 끝의 `RefreshStatus`(마지막 갱신 시각, 새로고침, `30초마다 자동 갱신` 스위치)다. 좁은 화면에서는 복귀 링크 줄로 올라간다. 원인 문구는 그 대상으로 가는 링크이고, 이미 그 대상을 보고 있으면 같은 높이의 글자다.
- **머리말의 높이는 모든 탭에서 같다.** 탭을 바꿔도 탭 줄이 움직이지 않는다. 갱신 중 표시는 새로고침 버튼의 회전이 맡는다(글자를 바꾸면 줄바꿈 위치가 흔들린다).
- **새로고침과 자동 갱신 스위치는 서버 상세의 머리말에 하나씩만 있다.** 열린 패널의 데이터도 함께 다시 불러오고(`refreshToken`), 스위치를 끄면 패널의 주기적 갱신도 멈춘다(`autoRefresh`). 패널 안에 새로고침을 다시 두지 않는다. 서버 목록에는 갱신 시각과 새로고침만 있다(§4.5 "목록 조작의 자리"). Docker 환경·Docker 서비스 상세와 개요는 2026-11-21부터 같은 `RefreshStatus`로 자동 갱신을 끌 수 있다.

**서버 탭 안의 패널 (2026-11-18)** — 옛 메뉴의 상세 본문이 서버 탭 안에 들어가면서 정한 배치다. 지금은 인프라 패널(`InfrastructurePanel`)만 남았다. 앱 패널과 업타임 모니터 상세는 2026-11-21에 자기 페이지로 옮겼다(§4.7 대상 상세의 틀). 서버 이름이 h1이므로 패널의 대상 이름은 h2다.
- **대상 이름을 h2 한 줄로 두고, 대상에 대한 조작은 그 줄의 오른쪽이다**: `알림 규칙` → `다른 서버로 옮기기` → `수정` → `삭제`(다른 데이터도 보내는 앱은 그 데이터의 연결 해제). "제목 행에 버튼을 두지 않는다"와 `DetailActionToolbar` 규칙의 예외다. 순서(이동 → 편집 → 파괴, 파괴는 맨 끝)와 버튼 모양(`secondary`, 파괴만 `destructive`, `collapseLabel`)은 툴바 규칙 그대로다.
- **상태 전환(`일시정지`, `연결 중지`)은 기존 규칙대로 상태 표시 옆**이다(`DetailMeta` 상태 줄).
- **기간 선택과 보기 전환은 상태 줄의 오른쪽 끝**이다(`DirectConnectionMeta`의 `statusAside`). 좁으면 상태 줄 아래로 흐른다.
- **연결 정보는 접어 둔다.** API Key, 수집 데이터, 연결 방식은 `DetailMeta collapsed`의 `연결 정보`다. 탭 안에서는 본문(차트)이 먼저다. 대상 페이지(앱, 모니터, Docker 서비스)는 넓은 화면에서 속성을 펼쳐 둔다(`TargetHeader`).
- **인프라 탭은 제목을 화면에서 숨긴다**(`sr-only` h2). 리소스가 서버마다 하나이고 이름이 서버 이름과 같은 경우가 많다. 그래서 조작(`알림 규칙` 등)을 상태 줄의 오른쪽, 기간 선택 뒤에 둔다. 리소스 이름이 서버 이름과 다를 때만 상태 줄에 적는다.
- **상태 줄의 상태는 탭이 계산해서 넘긴다** (2026-11-19). 패널은 상태를 스스로 판정하지 않는다. 앱 목록과 앱 페이지(`ServerAppPage`, 앱이 받는 데이터 유형 중 가장 나쁜 것)는 `appPanelStatus(row, capability, app, stale)`, 인프라 패널은 `infrastructurePanelStatus(resource, stale)`의 결과(`PanelStatus`: `tone`, `label`, `detail?`, `stale`)를 쓴다. 인프라는 `DirectConnectionMeta`가, 앱 페이지는 `TargetHeader`의 상태 줄이 그린다. 그래서 상태는 탭의 점, 앱 목록, 개요 탭의 행과 같은 판정과 문구다(§5.4): 메트릭은 임계값을 넘은 지표가 있으면 `임계값 초과`, 이전에 불러온 목록(`stale`)이면 `확인 불가`(중립색)이고 원인과 `마지막 수집` 시각을 숨긴다. 이전에는 패널이 따로 계산해서 임계값을 넘은 앱의 메트릭 패널이 `수집 중`이었다. 업타임 패널은 자기 모니터를 단건 조회해서 상태를 보이고, 그 조회가 실패하면 `확인 불가`다.

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

1. **제목 + 단위** — 왼쪽. `type-card-title` + `type-caption text-text-faint`. 제목은 한국어, 기술 용어는 영어(`CPU`·`메모리`·`디스크`·`네트워크`). 메트릭 이름처럼 식별자인 제목만 `font-mono text-sm`
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
| `SERIES` `getSeriesPalette` | 색 |
| `ChartCard` `ChartEmpty` `ChartSkeleton` `CHART_HEIGHT` `CHART_STRIP_HEIGHT` `CHART_MARGIN` | 카드 틀 · 빈 상태 · 로딩 · 높이 · 여백(위 8px — niceYAxis의 맨 위 눈금 라벨이 플롯 위 끝에 걸려, 4px이면 윗부분이 잘렸다) |
| `formatAxisValue` `formatMetricValue` `metricDisplayUnit` | 포맷 · OTel 단위 → 표시 단위 환산 |
| `ChartTooltip` `ChartSummary` `ChartStats` `ChartStatsLegend` `ChartLegend` | 툴팁·요약·범례 |
| `Sparkline` | 축 없는 32px 추세선(Docker 서버의 호스트 게이지). 장식이라 `aria-hidden` + `accessibilityLayer={false}`. 값만 받으므로 시간 위치가 중요한 자리에는 쓰지 않는다 |

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
  - **지표 타일 + 차트 1개** (요청 추이, 2026-09-25) — 카드 위 타일(`요청 수 1,530건 │ 에러율 0.5% │ 지연 시간 p95 121ms`)을 누르면 아래 차트가 그 지표로 바뀐다. 타일은 `aria-pressed` 버튼 그룹(`SegmentedControl`과 같은 이유로 ARIA 탭이 아니다), 선택은 `border-accent` + 안쪽 링. 툴팁은 어느 지표를 그리든 그 버킷의 모든 값을 보여준다(행마다 `unit`). 요청 수 막대는 에러를 빨간색으로 쌓아 기본 화면에서 요청량과 에러가 함께 보인다. 차트 높이는 지표를 바꿔도 같다. 세 패널을 위아래로 쌓은 이전 방식은 *"보기 어렵다"*는 피드백으로 바꿨다
  - **패널 분리 + `syncId`** — 여러 지표를 동시에 봐야 하는 자리(인프라 추세 4종, 메트릭 탐색 격자)
- **나란한 차트는 크로스헤어를 공유한다** (`syncId`). 툴팁 상자는 마우스가 있는 차트에만 띄운다
- **지연 백분위는 p50 primary · p95 emerald · p99 amber** (요청 추이, 2026-09-30) — 팔레트 앞 3슬롯 순서라 색각이상에서도 갈린다. p99는 꼬리 지연, 장애 전조가 가장 먼저 보이는 선이다
- **지난주 같은 시간은 회색 점선이다** (`tickColor`, `strokeDasharray="4 3"`, 요청 추이 2026-09-30) — 지금 그리는 지표의 7일 전 값(지연은 p99)을 겹친다. 알림을 넘지 않고 서서히 나빠진 것을 드러내는 선이다. 범례 칩 `지난주`(지연은 `p99 · 지난주`), 툴팁에 한 줄. 7일 전 데이터가 없으면 선도 칩도 없다
- **배포는 세로 실선이다** (`SERIES.deploy`(`deploy-marker`) 1.5px, 라벨 없음, 요청 추이 2026-09-30) — "배포 전이냐 후냐"를 한눈에 가르는 선. 무엇이 바뀌었는지는 그 버킷 툴팁의 `footer`가 말한다(`17:47 api · 배포 api:1.4.1 → api:1.4.2`, 이미지가 같으면 `재시작`) — 선이 가늘어 따로 hover할 수 없다. 범례 칩 `배포`. Docker 서비스만 — Direct 서비스는 배포를 알 수 없다
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

**업타임 응답 시간 (`ResponseTimeCard`, 2026-11-08)** — 모니터 상세와 컨테이너 페이지의 상태 탭이 같은 선 그래프를 쓴다.
- **선택 기간 평균**을 큰 숫자로 표시하고 실제 체크 수·실패 수를 보조 정보로 둔다. 평균은 성공한 체크 수로 가중한다. 버킷 평균에서 원시 최대값이나 p95를 추정하지 않는다.
- `ResponsiveContainer → ComposedChart` 안에서 축·선·커서·툴팁·장애 배경을 함께 렌더링한다. 선은 공용 `lineProps`의 `monotoneX`·1.5px·둥근 캡을 사용한다. 고립된 성공 버킷은 점으로 표시한다.
- **전체 실패·미수집 버킷은 선을 끊는다.** 성공한 0ms는 유효한 값이다. 모든 체크가 실패하면 평균은 `—`로 표시하고 성공 응답이 없다는 안내를 둔다.
- 서버가 확인한 장애 구간만 옅은 오류색 배경으로 표시한다. 장애 배경 밖의 실패 버킷은 플롯 위쪽의 짧은 표시로 구분한다. 미수집은 장애로 추정하지 않는다.
- 조회 범위를 실제 시간축으로 유지하고 누락 버킷을 null로 채운다. Y축은 성공 평균값의 범위에 여유와 최소 표시 폭을 둬 작은 변화를 과장하지 않는다. 화면 범위 안의 알림 임계값은 점선으로 표시하며, 범위 밖의 값도 텍스트로 안내한다.
- Tab 한 번으로 차트에 진입하고 좌우 방향키로 버킷을 옮긴다. 포인터와 키보드 모두 같은 툴팁에서 날짜·구간·평균 응답·체크/실패 수를 읽는다. 미수집 툴팁은 `수집 데이터 없음`으로 구분한다. 카드 아래에는 조회 기간과 시간대를 표시한다.
- 모니터 상세에는 별도 체크 기록 표를 두지 않는다. 최신 체크는 현재 상태 요약에서, 장기 기록은 장애 이력에서 확인한다.
- **응답 시간 범위**는 `1H · 6H · 24H`, 기본 `6H`다. 각각 2분·5분·20분 평균이다. 모니터 페이지에서는 머리말의 기간 선택(`?range=`)이 정한다(2026-11-21, 그전에는 응답 시간 카드 안의 `응답 시간 범위` 조작이었다). 첫 조회 실패에서도 범위 선택과 재시도를 유지하며, 자동 갱신 실패 시 마지막 차트를 유지한다. 기간 변경 시 이전 기간의 데이터를 새 범위로 표시하지 않는다.
- **장애 이력**(모니터 상세)은 업타임 현황 카드 안, 90일 띠 바로 아래에 붙는 보조 표다(2026-10-28 — 별도 카드에서 옮김). 두 종류를 시간순으로 섞는다: 장애(연속 실패가 환경설정 기준을 넘은 구간, `장애 진행 중` 오류 · `장애 복구` 정상, 지속 시간 있음)와 장애로 이어지지 않은 실패 체크(`실패` 주의, 지속 시간 `-`, `GET /services/:id/failures` — 장애 구간과 그 장애를 연 연속 실패는 서버가 뺀다). 열은 상태 · 시각 · 지속 시간 · 메시지, `전체 · 장애 · 실패` 구분(`SegmentedControl`), 10행 뒤는 `N개 더 보기`. 90일 띠의 날짜를 누르거나 Enter로 고르면 그날 이력만 남고(`aria-current="date"`, 링), 표 제목 옆 날짜 버튼으로 해제한다
- 모니터 헤더 메타에 HTTP는 `기대 상태 코드`(폼과 같은 이름 — `Expected status`는 라벨 칸에서 두 줄로 접혔다)를, 모든 모니터는 `마지막 확인`을 더한다. 인증서 만료는 메타가 아니라 업타임 현황의 네 번째 수치다(HTTPS만, `D-83`) — 14일 이하 `text-attn-text`, 지나면 `만료됨` + `text-crit-text`, 색은 넘은 경우에만 싣는다(§5.3)
- **업타임 현황**(`UptimeOverview`)은 제목 없이 큰 수치 한 줄(`text-2xl`, 사이 구분선) + 지난 90일 띠(`일부 실패 N일, 전체 실패 N일`). 프로젝트 상세에서도 카드 사이에 놓이므로 카드 테두리는 유지한다. 모니터 상세의 수치는 `24시간 업타임 · 30일 업타임 · 평균 응답 (24시간)`에 HTTPS면 `인증서 만료`(`마지막 확인`은 큰 수치로 읽을 정보가 아니라 헤더 메타로 내렸다, 2026-10-28)이고, 90일 업타임은 타일이 아니라 띠 머리글(`지난 90일 · 99.98%`, `historyUptime`)에 둔다 — 타일로 두면 바로 아래 띠와 같은 것을 두 번 말한다(2026-10-26). Docker 서비스 상세도 같은 묶음과 순서다(`uptimeKpis`, §4.7 대상 상세의 틀, 2026-11-21)

**로그 요약 (`LogServiceOverview`, 2026-09-27 — Grafana Logs Drilldown·Sentry Issues 참고)** — 2026-11-18부터 전체 로그(`LogsPage`)와 서버의 로그 탭 첫 화면이 같은 본문을 쓴다(로그 탭은 그 서버의 앱만). 질문은 "지금 이상이 있는가"이고 창은 24시간 하나다.
- **앱 카드**: 오류·경고 건수(라벨은 표 보기와 같은 한국어) → 시간대별 오류·경고 막대(HTML, 24칸) → 한 줄(가장 최근 오류, 없으면 경고 — 레벨 토큰 + mono 메시지 + 상대 시각). 오류가 많은 순으로 정렬한다
- **추세 배지를 달지 않는다** — 막대가 추세를 말한다. 게이지 카드와 같은 이유다(아래)
- **막대 척도는 카드마다지만 바닥이 10건이다.** 하루 경고 3건이 카드 높이를 꽉 채우자 급증처럼 읽혔다
- **창 안에 수신한 로그가 하나도 없으면 건수는 `-`, 상태는 `수집 지연`**(수신 기록이 없으면 `수신 대기`)이다. 0건은 "이상 없음"이 아니라 "모름"이고, 문구도 "오류·경고 없음"이라 하지 않고 마지막 수신 시각만 말한다. 상태는 `CollectionStatusBadge`(수신 시각 = 서버 `signal_receipts`)
- **자주 발생한 오류·경고**: 숫자·ID만 다른 메시지를 하나로 센 목록(오류 먼저, 건수순). 처음 발생이 창 안이면 `새로 발생 2시간 전`을 `font-medium`으로 — 배지로 만들지 않는다(§5.1b). 행을 누르면 그 서비스 로그가 `?range=24h&pattern=`로 열리고, 필터는 `같은 패턴만` 칩으로 해제한다. 오류가 하나도 없으면 섹션째 숨긴다

**KPI 게이지 카드 (`InfraGauges`)** — Docker 서버의 호스트 요약(`DockerDataSections`)에만 쓴다. 색은 임계값(85%)을 넘은 카드에만 싣는다. 비율 지표(CPU·네트워크)는 6시간 스파크라인, 용량 지표(메모리·디스크)는 막대. 값은 목록·차트와 같은 소수 한 자리. 라벨은 차트 제목과 같은 한국어다(`CPU`만 영어). 추세 배지·상태 pill·색 막대를 한 카드에 겹치지 않는다(§9-12의 3중 강조와 같은 문제).

**서버의 인프라 탭(`InfrastructurePanel`)(Docker Collector의 호스트 지표 포함, 2026-11-11)** — 게이지 줄 없이 2×2 추세(`InfraTrends`)만 둔다. 게이지가 아래 차트의 "현재"를 한 번 더 말했고, 스파크라인은 기간 선택과 무관하게 6시간이라 24H에서 두 선의 범위가 달랐다. 대신 사용률 차트 머리에 `주의`(70%↑)·`위험`(85%↑) `StatusLight`를, 제목 아래 보조 줄에 용량(`27.1 GB / 32.0 GB`)·코어 수를 둔다(모르는 값은 줄째 뺀다). 조회 실패는 `EmptyState` + 다시 시도, 한 번도 수신하지 않은 호스트는 `Collector 수신 대기` + 설정 다시 받기(키 재발급) — 빈 차트로 그리지 않는다. 차트는 Tab으로 들어가 좌우·Home·End로 시점을 고르면 점선과 그 시점 값을 차트 아래 글로 읽는다(Recharts `accessibilityLayer`는 시간 X축에서 방향키가 먹지 않는다).

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
| 헤더 행 | 배경 없이 `border-b border-border` 한 줄 |
| 헤더 셀 | `px-4 py-3 text-left text-xs font-medium text-text-muted` |
| 본문 셀 | `px-4 py-2.5`, 행 사이 구분선 없음(§3.1) |
| 숫자·시간 열 | 헤더와 셀 모두 `text-right`, 셀은 `tabular-nums` |
| 상세로 이동하는 행 | `hover:bg-surface-hover`(§3.6 — 배지 대비 유지), `data-row-link` 제목 링크와 `tableRowLinkHandlers`. 행 빈 공간도 같은 링크로 이동 |
| 넓은 표 | `overflow-x-auto` 안에 `min-w-[…] table-fixed`. 작업 열은 `sticky right-0`에 행과 같은 배경(세로선 없음) |

본문 글자는 `text-sm`, 로그·트레이스처럼 기계 문자열이 주인 표는 `text-xs`(§2.2).

헤더는 배경을 쓰지 않는다. 행 hover는 배지·본문 대비를 유지하도록 기존 `surface-hover`로 둔다. 상세 행의 기본 클릭은 제목의 실제 링크로 전달해 Router state와 복귀 경로를 보존하고, Ctrl/Meta/중간 클릭은 같은 URL을 새 탭에서 연다. 키보드는 같은 제목 링크를 사용하며, 행을 별도 버튼으로 바꾸거나 중복 Tab 지점을 추가하지 않는다. 행 안의 링크·버튼·토글·입력·summary와 텍스트 선택은 행 이동을 실행하지 않는다. `table-row-link`는 비활성 버튼도 클릭 대상으로 유지해 `pointer-events:none` 때문에 클릭이 행에 전달되는 것을 막는다. 상세 목적지가 없는 행은 이동 가능한 커서를 표시하지 않는다.

**목록 보기 (2026-10-18, 대상 화면은 2026-11-18 기준)** — 서버의 업타임 탭(모니터가 둘 이상일 때)과 로그 탭, 전체 로그, 서버의 컨테이너 탭, 알림의 기본은 그리드(비교 표)다. **서버 목록은 그리드만 있고 보기 전환이 없다.** 목록 툴바 오른쪽의 `ListViewToggle`로 카드를 선택하며, `useListView`가 `view=card`를 URL에 보존한다. 기본값과 알 수 없는 값은 그리드다. 보기만 바꿀 때 검색·탭·대상 필터를 지우지 않고, 두 보기는 같은 데이터·순서·작업을 사용한다. 개요 상태판·상세 차트·설정 폼에는 적용하지 않는다.

`ResourceTable`의 셀은 `px-4`, 본문은 `py-4`다. **표는 `table-bleed`(셀 가로 패딩만큼 바깥으로 펼침)로 글자를 본문 정렬선에 맞춘다** (2026-11-20). 테두리 없는 표(§3.1)에서는 셀 패딩이 보이지 않아 글자 열이 정렬선이 되는데, 제목·툴바(데스크톱 x=264, 모바일 16)보다 16px(모바일 12px) 안쪽에서 시작해 정렬선이 둘이었다. hover 채움과 머리 아래 선은 정렬선 밖으로 16px 나간다. 수제 표(알림, 트레이스, API 요청, 업타임 모니터)와 표처럼 hover 행을 쓰는 목록(로그의 반복 패턴)도 셀 가로 패딩을 `px-4`로 두고 같은 유틸리티를 쓴다. 모바일에서는 보조 열을 숨기고 필요한 수치·수집 상태를 대상 이름 아래로 모아 페이지의 가로 넘침을 막는다. Project의 배정·해제·수정은 행의 `구성 관리`로 펼치며, 설치 대기 Docker 환경의 명령·키·비활성화는 `설치·작업`에서 연다. 카드 선택 시에는 기존 대상 카드의 반응형 열 수를 따른다.

**서버 목록** (2026-11-18, G안 2026-11-29, `ServersPage`·`ServerTable`) — 서버를 나란히 비교하는 그리드다.
- **Docker 호스트도 서버다** (ADR 0012): `useServers({ includeDocker: true })`라 Docker Collector로 연결한 호스트가 같은 행으로 있다. 검색은 컨테이너 이름도 찾는다. Docker 서버가 있으면 `연결 방식으로 거르기`(`모든 연결 방식`·`Docker Collector`·`직접 연결`, `?connection=`)가 검색 옆에 선다. 옛 `?connect=docker`는 서버 추가의 `Docker Collector 설치`로 간다.
- **열**(G안): `서버 | 상태 | CPU | 메모리 | 디스크 | 업타임 · 24시간 | 에러 로그 | 수집`. 이름 칸은 상태 모양(`StatusShape`) + 이름 + 아래 줄의 연결 방식(`Docker Collector · 컨테이너 3개`, `직접 연결 · 업타임 모니터 2개`, `Docker Collector 설치 대기`, `연결한 대상 없음`). 상태 칸은 상태 단어(장애 빨강, 확인 필요 노랑, 정상 `text-muted`, 대기 `text-faint`)와 아래 흐린 한 줄의 원인이다(전체는 툴팁). CPU·메모리·디스크는 수치 + 얇은 막대(84px, 4px, 트랙 `border-strong`, 채움 70% 미만 `ok`, 70% 이상 `attn`, 85% 이상 `crit`). 업타임은 서버 모니터들의 24시간 체크 띠(§4.8) + 가장 낮은 가용률. 수집은 연결된 기능(`컨테이너, 업타임, 인프라, 로그 …`), 넓은 화면(`@6xl`)에서만 보인다.
- **값이 없는 까닭은 셋이고 모양이 다르다**: 그 수치를 내는 기능에 연결한 대상이 없으면 점선 상자 `연결 전`(G안), 연결했지만 값이 아직 없으면 `-`(`데이터 없음`), 불러오지 못했으면 `sync_problem` 아이콘(`불러오지 못함`). 까닭은 툴팁과 `sr-only` 글자가 말하고, 칸마다 Tab 지점을 늘리지 않는다.
- **행을 채우지 않는다**(G안, 2026-11-20의 장애 행 채움을 대체): 상태는 행 앞의 모양과 상태 단어가 말한다. 모든 목록(`ResourceTable`)이 같다: 흐린 12px 열 이름, 행마다 위 헤어라인, 표 맨 아래 선 하나.
- **수치의 색**: 70% 이상은 `attn-text` 글자이고, 화면 낭독기에는 `, 주의 기준 초과`를 붙인다(색만으로 전달하지 않는다).
- **정렬**: 상태가 나쁜 순서(장애, 확인 필요, 대기, 정상), 같은 상태 안에서는 이름순.
- **좁은 폭**: 열은 목록 컨테이너의 폭에 맞춘다. 이름·상태·에러 로그는 항상 보이고, CPU·메모리는 `@3xl`, 디스크 `@4xl`, 업타임 `@5xl`, 수집 `@6xl`부터다. 숨긴 수치는 이름 아래 줄에 모은다.
- **머리말**: 제목 `서버 13`(본문 h1), 오른쪽 주 액션 `서버 추가`(primary, 무채색 채움). 갱신 상태와 `전체 로그`(quiet)는 데스크톱에서 상단 줄 오른쪽, 모바일에서 제목 아래다.
- **상태 탭**(G안): 목록 위 한 줄의 밑줄 탭 `전체 13 | ■ 장애 2 | ▲ 확인 필요 3 | ◌ 대기 2 | ● 정상 6`(`FilterChips variant="tabs"`). 누르면 그 상태만(`?status=`, `aria-pressed`), 다시 누르거나 `전체`를 누르면 해제한다. 장애·확인 필요가 0이면 모양을 중립(대기)으로 둔다. 개수는 검색어와 연결 방식을 따른다(상태 선택은 따르지 않는다). 탭 줄 오른쪽에 검색(32px)과 연결 방식이 선다. 검색은 서버 이름, 소속 대상(모니터·앱·인프라)의 이름, 모니터 주소, 앱의 지표 이름을 찾고, 서버 이름이 아니라 소속 대상이 맞으면 이름 아래에 맞은 것을 쉼표로 잇는다. 검색어·상태·연결 방식은 주소에 남는다(`q`, `status`, `connection`).
- 시안의 `24시간` 기간 선택은 두지 않는다: 목록의 수치(업타임·에러 로그)는 서버가 24시간으로만 준다.
- **빈 상태**: 서버가 없으면 `서버 추가` 하나를 안내한다(Docker 호스트는 서버를 추가할 때 Docker Collector 설치를 고른다). 개요의 빈 상태도 같다. 한 번도 불러오지 못했으면 서버가 없는 것이 아니라 모르는 것이므로 빈 상태가 아니라 조회 실패(`다시 시도`)다. `전체 로그`는 머리말에 있으므로 두 화면에도 그대로 있다(2026-11-20, 그전에는 버튼 옆에 따로 두었다).
- **조회 실패**: 일부 대상 목록만 실패하면 해당 칸이 `불러오지 못함` 표시가 되고 `일부 정보를 불러오지 못했습니다` 배너와 다시 시도를 둔다. **서버 목록을 다시 불러오다 실패하면**(2026-11-19) 이전 행을 지우지 않는다: 마지막으로 성공한 서버 목록과 새로 받은 대상 목록으로 행을 다시 만들고, `서버 목록을 새로 불러오지 못했습니다`(`이전에 불러온 정보입니다.` + 원인) 배너와 다시 시도를 둔다. 마지막 갱신 시각은 서버 목록과 대상 목록(모니터, 앱, 인프라)이 모두 성공해야 바뀐다. 서버 상세도 같은 배너(`서버 정보를 새로 불러오지 못했습니다`)이고, 실패한 동안 주소의 서버를 이전 목록에서 찾지 못하면 "찾을 수 없습니다"가 아니라 `서버를 불러오지 못했습니다` + 다시 시도다.

**목록 필터의 공통 규칙** (2026-11-21). 서버, 업타임 탭, 알림 규칙·발송 이력이 같은 방식이다.
- 툴바는 `ListToolbar`: 검색 → (선택) → 칩. 요약이 곧 필터라 요약 줄을 따로 두지 않는다.
- 상태·유형 요약은 `FilterChips`이고 개수는 다른 필터를 따른다. 상태를 모르면(목록을 불러오지 못함, 이전 정보) 칩을 두지 않는다: 모르는 것을 세지 않는다(그룹 목록, 업타임 탭).
- 검색어와 칩 선택은 주소에 남는다(`useListSearch`): 입력은 로컬 상태가 쥐고 주소는 replace로 따라간다(한글 조합 중 글자가 덮이지 않게). 링크·뒤로 가기로 주소가 바뀌면 검색창이 주소를 따른다. 서버 목록·업타임 탭에 따로 있던 같은 코드를 2026-11-21 하나로 합쳤다.
- 거른 결과가 비면 `검색 결과가 없습니다` + `필터 해제`(검색어와 칩 선택을 함께 지운다).
- 데스크톱 발송 이력은 서버가 쪽을 나누므로 칩의 개수는 같은 조건(유형, 채널, 기간, 검색)의 `total`을 상태마다 한 건짜리 요청으로 받는다. 모바일 발송 이력은 최근 30건만 보이는 목록이라 칩을 두지 않는다: 일부만 센 숫자가 바로 위 7일 발송 요약과 어긋난다.
- 알림 채널에는 상태·유형 요약이 없어 칩도 없다.

**업타임 목록** (2026-11-08, 2026-11-18부터 서버의 업타임 탭) — 모니터가 둘 이상인 서버의 업타임 탭(`UptimeMonitorList`)이 옛 업타임 목록의 본문을 서버 범위로 좁혀 쓴다. 아래 규칙은 그대로다. `UptimeTargets`의 두 보기는 검색 결과와 상태 우선 순서를 공유한다. 상태 요약은 `장애, 정상, 확인 대기, 일시정지` 순서의 `FilterChips`다(2026-11-21, 그전에는 라벨 아래 24px 숫자를 둔 수치 행이라 서버 목록의 칩과 모양이 달랐다). 개수는 검색어를 따른다. 그리드의 대상 열에는 이름과 체크 주소만 두 줄로 표시한다. HTTP/TCP는 `방식`, 주기는 `수집 간격` 열로 옮겨 행 높이를 늘리지 않는다. 수치 열은 24시간 업타임과 평균 응답(성공한 체크만)이다. 평균 응답은 숫자만 오른쪽으로 정렬하고, 응답 추이는 상세 화면에서 확인한다. 일시정지했거나 24시간 체크가 없으면 `-`, 모두 실패했으면 `0.00%`다. 평균 응답은 정수 ms로 표시한다.

표와 카드의 배치는 뷰포트 대신 **목록 컨테이너의 폭**에 맞춘다. 표에는 선택 체크박스를 두지 않고 상태부터 표시한다. 업타임은 `@xl`(576px), 방식·수집 간격·평균 응답·최근 체크는 `@3xl`(768px)부터 별도 열로 표시한다. 숨긴 수치와 최근 체크는 대상 열로 옮긴다. 이름과 주소, 상태, 상태 변경은 항상 보인다. 카드 열 수는 `@2xl`부터 2열, `@5xl`부터 3열이다.

**갱신과 최근 체크** — `RefreshStatus`(2026-11-21 `UptimeRefreshControls`에서 이름이 바뀌어 공용이 되었다)는 마지막 성공 갱신 시각과 30초 자동 갱신 스위치다. 2026-11-18부터 서버 상세의 머리말에 하나만 있고 업타임 탭의 목록과 모니터 상세가 그것을 따른다(§4.1 서버 상세 헤더). 서버 목록은 같은 표기에서 스위치를 뺀다. 숨긴 탭에서는 자동 조회를 멈추고 다시 보이면 갱신한다. 조회가 실패하면 성공 시각을 유지하고 이전 정보임을 표시한다. 서버 수준의 자동 갱신(서버 데이터)은 대화 상자가 열려 있어도 계속된다. 대신 변경 요청(일시정지, 저장, 삭제, 키 재발급 등)이 진행 중인 패널은 그동안 들어온 머리말의 새로고침 신호를 버린다(`useHeldToken`): 변경이 끝나면 패널이 어차피 다시 불러오고, 변경 전에 시작한 조회의 응답이 변경 뒤의 화면을 덮지 않게 한다. 모니터 패널은 자기 30초 갱신을 수정·삭제 확인 창이 열려 있거나 변경 중일 때 멈춘다.

최근 체크와 장애 정보는 그리드·카드에서 바로 읽는다. 별도 빠른 확인 버튼이나 패널은 사용하지 않는다. `RecentUptimeChecks`는 최근 10회까지의 성공·실패를 높이 12px의 띠와 한 줄 결과로 표시한다. 마지막 확인 시각도 이 줄에 함께 표시한다. 띠는 Tab 한 번으로 진입하며 방향키로 체크를 고른다. 긴 실패 메시지와 정확한 시각은 툴팁에서 읽는다. 진행 중인 장애는 상태 아래 지속 시간을 표시하고, 툴팁에 시작 시각과 메시지를 담는다. 일시정지한 대상의 이력에는 `정지 전 기록`을 붙인다. 일시정지는 `quiet`, 재개는 `ghost` 변형으로 표시한다. 제목 링크와 행 빈 공간의 상세 이동, 새 탭 동작은 유지한다.

목록은 `GET /services?type=http,tcp&include=checks`로 최근 체크와 진행 중인 장애를 함께 받는다. 대상마다 이력 API를 추가로 호출하지 않는다. 일반 목록 호출은 이 상세 필드를 생략한다. 체크 없음은 빈 배열, 확인할 수 없는 이력은 필드 생략으로 구분한다. 실패한 체크의 대기 시간을 응답 시간으로 표시하지 않는다. 모니터 패널(`UptimeMonitorPanel`)은 상태 줄(`UptimeMonitorStatusBadge` + 최근 체크 `UptimeLatestCheck` + `일시정지`)이 현재 체크를 설명하고, 화면은 현재 체크 상태 → 기간별 수치 → 응답 추이 → 90일 이력 순서다.

요약 숫자는 **상태 필터**이기도 하다. 누르면 그 상태만(`?status=`, `aria-pressed`), 다시 누르면 해제한다. 그리드는 행마다 일시정지·재개를 제공한다. **일괄 작업**은 카드 보기의 체크박스로 고르고, 목록 위 `N개 선택 · 일시정지 · 재개 · 삭제 · 선택 해제` 막대로 실행한다. 보기 방식을 바꾸면 선택을 해제한다. 검색·필터로 가려진 대상은 작업에서 빠진다. 실패한 대상만 선택에 남아 다시 시도할 수 있다. 일괄 작업은 서버 하나의 업타임 탭 안에서만 동작한다(여러 서버에 걸친 일괄 작업은 없다, 설계 문서 10절 4).

**~~메트릭 목록~~** (2026-11-07 ~ 2026-11-18) — 메뉴와 함께 없어졌다. 당시의 열은 `서비스 | 수집 | 확인 필요 | 메트릭 | 확인할 지표`였다. 판정은 서버로 옮겨 남았다: 임계값을 넘은 지표가 있는 앱은 서버의 메트릭 기능에서 확인 필요(`임계값 초과`)이고, 원인 문구는 이 목록의 `확인할 지표` 표현(`임계값 초과 <첫 지표> 외 N개`)을 이어 쓴다(§5.4).

목록 보기 전환은 텍스트 대신 `view_list`(그리드의 행·열 비교)와 `grid_view`(카드 배열) 아이콘을 쓴다. 순서는 그리드 → 카드이며, 접근성 이름과 툴팁은 `그리드`·`카드`다.

**목록 조작의 자리** (2026-11-15, 2026-11-14 "보기 전환의 자리"를 대체, 대상 화면은 2026-11-18 기준). 메뉴 h1이 데스크톱에서 사라진 뒤(§3.4) 같은 조작이 메뉴마다 다른 자리에 있었다 — 당시 보기 전환은 업타임·메트릭·Docker 환경에서 검색 툴바, 로그·인프라·그룹에서 제목 줄, API에서 기간 줄이었고, 새로고침은 개요는 헤더, 업타임은 상태 줄, 메트릭·API는 툴바였다. 모든 목록 메뉴가 같은 세 층을 쓴다.
1. **화면 전체 조작은 헤더**: 새로고침은 `PageHeader`에서 주 액션 **앞**에 둔다 — 데스크톱은 `AppHeader` 오른쪽에 `[갱신 조작] [주 액션]`. 수집 데이터를 보여 주는 목록 메뉴(서버, Docker 환경)는 `children`에 `새로고침` 버튼을 둔다(2026-11-16). 서버 목록의 헤더는 `[갱신 시각] [새로고침] [전체 로그] [추가]`다(2026-11-20, 앞의 셋은 `meta`). 개요는 `meta`(시각 + 버튼, 문구는 `30초마다 자동 갱신`)다. 자동 갱신을 끌 수 있는 곳은 서버 상세의 머리말 하나다(§4.1 서버 상세 헤더, 2026-11-18 전에는 업타임 목록이었다).
2. **툴바는 검색이나 필터가 있을 때만**: 왼쪽 검색, 그 옆 필터(상태 요약·연결 방식·기간·정렬). 새로고침과 보기 전환은 툴바에 두지 않는다. 둘 다 없는 화면은 툴바 줄을 만들지 않는다. 상태 요약(서버 목록의 장애·확인 필요·대기·정상, 업타임 탭의 장애·정상·확인 대기·일시정지)은 필터이므로 검색 오른쪽이다(2026-11-16) — 따로 한 줄이면 두 줄 모두 오른쪽 60%가 비었다. 서버 목록의 툴바는 검색, 상태 칩, 연결 방식뿐이다(2026-11-20, 갱신 시각과 `전체 로그`는 머리말로 옮겼다).
3. **보기 전환도 헤더, 목록 제목 줄은 없다** (2026-11-16): 메뉴 첫 화면의 목록은 메뉴 이름을 되풀이하는 제목(당시 `로그 서비스`·`인프라 대상`)과 개수 메타를 보이지 않는다 — 제목 줄이 이미 이름을 말했고, 제목을 빼자 메타와 토글만 남은 줄이 어정쩡했다(사용자 요청). `ListViewToggle`은 `PageHeader` children으로 **주 액션 바로 앞**에 두고 목록이 있을 때만 그린다(Docker 환경): 데스크톱 `AppHeader`는 `[갱신 조작] [보기 전환] [주 액션]`. 목록 `section`에는 `sr-only` `h2`만 남겨 스크린리더 제목 탐색을 지킨다. 전체 개수는 메뉴 제목이(§3.4, 2026-11-21), 거른 개수는 검색창의 결과 수가 말한다. `PageHeader menu`는 조작을 `ControlDefaultsContext`로 감싼다: 데스크톱 헤더로 포털된 조작은 크기·variant를 정하지 않은 `Button`·`ListViewToggle`이 32px(sm) + secondary, 모바일 메뉴 첫 화면은 secondary + 내용 폭(터치 높이 md 유지)이다 — 40px 검은 채움 버튼(모바일은 남은 폭까지 채운)이 화면에서 가장 무거웠는데 `Docker 연결`·`추가`는 가끔 쓰는 설정 조작이다(사용자 지적). 빈 상태(EmptyState)의 연결 버튼과 대화상자는 그대로 primary다(헤더 버튼 안에서 대화상자를 열던 `MonitoringConnection`은 2026-11-18에 메뉴와 함께 없어졌다). 알림의 추가 버튼은 탭에 따라 `규칙 추가`·`채널 추가`다. 메뉴가 아닌 화면 안의 목록(전체 로그, 서버의 로그 탭 등)은 여러 섹션 중 하나라 제목 줄을 유지하고 보기 전환을 그 줄 오른쪽에 둔다. 서버의 업타임 탭은 탭 줄의 조작 자리(§4.6)에 `[보기 전환] [모니터 추가]`를 둔다.

알림은 탭이 패널을 바꾸므로 예외다 — 보기 전환은 데스크톱·모바일 모두 탭 줄 오른쪽 끝이고(데스크톱은 헤더와 같은 sm), 7일 발송 요약은 탭 위가 아니라 `발송 이력` 탭의 머리다(2026-11-16 — 규칙·채널 탭에서도 표보다 먼저, 더 크게 섰다), 모바일에서는 탭의 장식 아이콘을 `sm` 미만에서 빼서 폭을 낸다. 헤더 아래에 토글만 있는 줄을 두지 않는다. 메뉴 첫 화면 위의 안내 문장(`Docker Collector가 수집한 데이터는 Docker 환경에서 확인합니다.`)은 없앴다(2026-11-16, 사용자 요청). 서버와 Docker 환경의 구분은 [ADR 0011](../../docs/adr/0011-servers-own-directly-configured-targets.md)과 내비가 말한다. 같은 문장은 서버 목록의 빈 상태에만 남는다(Docker 환경이 있을 때).

**목록 행 높이는 내용으로만 달라진다.** 행 안의 인라인 버튼(`트레이스`, 경로 링크)이 행을 키우지 않게 한다: 로그 행은 펼침 버튼처럼 `-my-1.5`, 요청 행은 첫 칸에 `min-h-8`(버튼 높이)을 주고 셀 여백을 `py-2`로 둔다. 버튼이 있는 행만 높아져 목록이 들쭉날쭉했다.

**반복 패턴 목록은 상위 5개**를 먼저 보이고 `전체 보기 (N)`로 펼친다. 20행이 이어지면 위의 서비스 목록보다 길어졌다.

**거르는 조작은 거르는 대상의 제목 아래에 둔다.** 서버의 API 요청 탭(과 컨테이너 페이지의 요청 탭)의 검색·`에러만`은 "요청 결과" 제목과 표 사이다 — 제목 위에 있으면 위의 Endpoint 표를 거르는 것처럼 읽혔다.

**카드 안 보조 표** — 패딩 있는 카드 안의 짧은 기록(업타임 체크 기록). 헤더 채움 없이 `type-caption text-text-muted`, 래퍼 `-mx-2` + 셀 `px-2`로 글자를 카드 좌측 기준선에 맞춘다(§4.1 "카드의 좌측 기준선은 하나다").

**헤더에 `uppercase`·`tracking-wider`를 걸지 않는다.** 영어 헤더(`Span`)도 옆 헤더와 같은 모양으로 둔다(§2.5).

### 4.6 탭 (2026-10-09)

**패널을 바꾸면 탭, 같은 데이터의 보기·필터를 바꾸면 `SegmentedControl`이다.** 탭은 `role="tablist"`/`role="tab"` + `aria-selected`, `SegmentedControl`은 `aria-pressed`다. 탭은 위치가 아니므로 브레드크럼에 넣지 않는다(§3.4).

**공용 `Tabs`** (2026-11-18, [`components/common/Tabs.tsx`](src/components/common/Tabs.tsx)) — 서버 상세와 컨테이너 페이지(`AgentServiceTabs`)가 쓴다. 이전에는 `AgentServiceTabs`가 자기 탭 줄을 그렸다.
- **밑줄 탭**: 탭은 `border-b-2 px-4 py-2.5 type-label`. 선택은 `border-accent text-text`, 비선택은 `border-transparent text-text-muted hover:text-text`. 탭 아래 전폭 기준선은 두지 않는다(§3.1). **라벨을 `action`으로 칠하지 않는다** — 밑줄이 이미 선택을 말한다(§4.1 `secondary` 라벨을 칠하지 않는 것과 같은 이유).
- **상태 점**: 장애나 확인 필요인 기능의 탭에만 `tone`을 주고, 점의 이름은 `toneLabel`(`role="img"`, §5.2)이다. 정상인 탭에는 점이 없다. 알림 링크나 옛 주소로 다른 탭에 바로 들어와도 어느 기능에 문제가 있는지 보여야 한다. 이름 없이 점만 주면 점은 `aria-hidden`이 되므로 `toneLabel`을 함께 준다. 점이 있는 탭은 마우스를 올리거나 키보드로 포커스하면 툴팁으로 `toneLabel`(`확인 필요`, `임계값 초과` 등)을 보인다(2026-11-19). 점은 탭 버튼 안이라 따로 포커스를 받지 못하므로 탭 버튼이 툴팁의 트리거다.
- **보조 문구**(`caption`, `type-caption text-text-faint`): `연결 전`은 대상이 없는 기능이고 탭 글자를 `muted`(`text-text-faint`)로 흐린다. 선택은 가능하다(연결 안내가 나온다). `확인 불가`는 대상 목록을 불러오지 못했거나 이전에 불러온 목록인 기능이다(`capabilityUnverified`). 연결 전이 아니므로 흐리게 두지 않고 상태 점도 붙이지 않는다(§5.4).
- **대상 수는 화면에 숫자로 그리지 않는다.** 탭 옆 숫자가 오류 건수로 읽힌다. `srDetail`(`, 모니터 2개`)로 접근 가능한 이름에만 담는다.
- **키보드**: 선택된 탭 하나만 Tab 순서에 있고(`tabIndex` 0/-1), ←/→로 옮긴다(끝에서 반대쪽으로 돈다). Home·End는 처음과 끝이다. 키로 옮기면 `onChange(key, 'keyboard')`이고 포커스가 새 탭으로 간다. 서버 상세와 Docker 서비스 상세(2026-11-19부터)는 첫 키보드 이동만 기록을 쌓고 이어지는 키보드 이동은 그 기록을 덮어써서, 뒤로 가기 한 번이면 키보드 탐색을 시작한 탭으로 돌아간다. 마우스 이동은 매번 쌓인다.
- **넘침**: 탭 줄은 줄바꿈하지 않고 탭 줄만 가로로 스크롤한다(320px에서도 페이지는 가로로 넘치지 않는다). 주소로 바로 들어와 선택된 탭이 줄 밖에 있으면 탭 줄의 `scrollLeft`만 맞춰 보이게 한다. `scrollIntoView`는 탭 줄이 화면 밖이면 페이지까지 세로로 움직였다. 가로 스크롤 영역은 세로도 잘라서 포커스 링(2px + 간격 2px)이 잘렸으므로 탭 목록에 안쪽 여백 `p-1`을 두고 같은 만큼 `-m-1`로 끌어당긴다. (이전의 "`-mb-px` 대신 `absolute` 기준선" 조합은 기준선을 없애면서 필요 없어졌다.)

**서버 상세는 탭을 경로로 표현한다** (2026-11-18) — `/servers/<id>`(개요), `/servers/<id>/uptime`, `/servers/<id>/uptime/<monitorId>`. `?tab=`을 쓰지 않는 것은 API 요청 탭의 요청 쿼리가 이미 `?tab=requests|traces`를 쓰기 때문이다. 탭을 바꾸면 주소가 바뀌어 뒤로 가기로 돌아온다. **이미 선택된 탭을 다시 누르면 쿼리 없는 그 탭의 첫 화면으로 간다**(대상 상세나 필터를 걸어 둔 상태에서 탭의 처음으로 돌아가는 길이다). Docker 서비스 상세는 지금처럼 `?tab=`이다. **Docker Collector가 있는 서버는 `/servers/<id>/containers`(컨테이너 탭)를 더 갖는다**(2026-11-22, ADR 0012): 탭은 개요 바로 다음이고, 옛 Docker 환경 개요의 장애 배너, 컨테이너 표, 체크 이력, 장애 이력, 타임라인이 그대로 온다(`DockerContainersPanel`). 컨테이너 탭이 없는 서버의 그 주소는 개요로 간다. Docker Collector가 모으는 데이터는 같은 서버의 기능 탭에 붙는다: 인프라 탭의 호스트 게이지, 로그 탭의 `컨테이너 로그`, API 요청 탭의 Docker 요청(`DockerDataSections`). 개요에는 기능 행과 같은 틀의 `컨테이너` 행이 맨 앞에 서고, 설정 가이드(`MonitoringSetupPanel`)가 그 위에 있다.

**~~Docker 환경 상세도 탭을 경로로 표현한다~~** (2026-11-19, 2026-11-22 화면과 함께 없어짐 — 옛 `/agents/<id>/<tab>`은 같은 키의 서버 탭으로 간다) — `/agents/<id>`(개요), `/agents/<id>/infrastructure`·`/logs`·`/api`. 섹션 여섯 개를 세로로 쌓은 스크롤 화면이라 로그·요청 추이가 서비스 목록 아래로 멀었고, 서버 상세·Docker 서비스 상세와 같은 깊이인데 형식이 달랐다(사용자 요청). **서비스 목록은 개요 탭**이다: 이 화면의 주 내용이고(어느 서비스가 죽었는지 보고 들어간다), 진행 중 장애·90일 업타임·장애 이력·타임라인·설정 가이드가 함께 있다. 설정 가이드는 탭 위에 두면 모든 탭에서 탭 줄을 밀어내서 개요로 옮겼다. 수집하지 않는 기능의 탭은 두지 않고(`profile.capabilities`), 없는 탭 주소는 개요로 보낸다. 메트릭 탭은 없다: Docker 메트릭은 서비스 목록의 열로만 보인다.

**탭 줄의 오른쪽 끝은 현재 탭의 조작 자리다** (2026-11-18). 탭이 자기 조작을 이 자리로 포털한다(`TabAction`, `actionSlot`): 추가·연결 버튼(`업타임 모니터 추가`, `로그 연결`, `API 요청 연결`, `메트릭 연결`, §4.1)과 업타임 목록의 보기 전환(추가 앞). 연결 전인 탭은 연결 안내 안에 주 버튼이 있으므로 비어 있고, 인프라 탭은 서버마다 하나라 추가할 것이 없어 비어 있다. 탭 줄이 넘치는 좁은 폭에서는 탭 줄 아래 한 줄로 내려가고, 비어 있으면 높이가 없다. 모바일(< sm)에서 그 줄은 폭 전체이고 조작이 오른쪽 끝이다. 패널 안에 조작만 있는 줄을 따로 두지 않는다. 대상(앱, 모니터)은 자기 페이지라 이 자리에 복귀 링크를 두지 않는다(2026-11-21, 그전에는 `TabBackLink`가 맨 앞이었다).

**탭 안에서 같은 데이터의 보기를 바꾸는 것은 `SegmentedControl`이다. 탭 줄을 두 겹으로 쌓지 않는다.** 대상 상세(컨테이너 페이지, 앱 페이지)에서 요청과 트레이스는 한 탭 줄의 두 탭이다(2026-11-21, 그전에는 서버 탭 안 API 요청 패널의 `요청`/`트레이스` 전환이었다). 서버의 API 요청·메트릭 탭은 앱 목록(`ResourceTable`, 상태가 나쁜 순)이고, 앱을 고르던 `AppSelector`는 없앴다.

**공용 `Tabs`가 아닌 탭** (2026-11-19 기준)
- **알림 데스크톱 탭**은 같은 밑줄 모양을 자기 마크업으로 그린다(`AlertsDesktopView`, §10).
- **세그먼트 모양 탭** — 모바일에서 화면 폭을 탭 수로 나눠 쓰는 자리(알림 모바일). 표면은 `SegmentedControl`과 같다: 트랙 `bg-surface-hover`, 선택 칸 `bg-surface`. `bg-surface`로 칠하면 다크에서 선택 칸이 트랙보다 어두워져 방향이 뒤집힌다(§1.2).

### 4.7 서버 상세의 본문 (2026-11-18)

**대상 상세의 위계** (2026-11-21). 대상(앱, 모니터)은 자기 페이지가 있어 서버 화면이 대상을 그리지 않는다. 그래서 서버 이름(h1)은 늘 `type-page-title`이다. #151에서 탭 안에 대상을 열면 서버 이름을 16px로 낮추던 `PageHeader subordinateTitle`과 `ServerHeader targetOpen`은 지웠다. 대상 페이지에서는 대상 이름이 h1(24/700)이고 서버는 크럼에만 있다.

**대상 상세의 틀** (2026-11-21, 소유자 결정: 대상 하나 = 한 페이지). 업타임 모니터, 직접 연결한 앱, 컨테이너의 상세는 연결 방식과 상관없이 같은 머리말과 같은 수치를 쓴다. 컨테이너 페이지, 직접 연결한 앱의 페이지, 업타임 모니터의 페이지가 이 틀을 쓴다.
- **머리말은 `TargetHeader` 하나다**(`features/targets/TargetHeader.tsx`): 제목(24/600) → 상태 줄 → **연결 줄** → 접힌 속성(`DetailMeta collapsed`, G안 2026-11-29: 모든 폭에서 접고, 요약 줄에 속성 이름을 적는다 — 자세한 것은 눌러서 본다). 넓은 화면의 `RefreshStatus`·기간 선택·목록 복귀는 상단 줄(`AppHeader`) 오른쪽이고, 제목 줄의 조작은 32px다. 제목 줄 오른쪽에 주 조작과 `더보기`(§4.1 상세 헤더), 머리말 오른쪽 칸에 기간 선택이다. 좁은 화면(`lg` 미만)은 복귀 링크가 맨 위 줄이고, 갱신 상태는 기간 선택과 같은 줄이다(기간 선택이 없는 대상은 복귀 링크와 같은 줄).
- **연결 줄은 대상이 어떻게 연결되어 있는지를 한 자리에서 말한다**(`DetailMeta connection`, `data-connection`): `연결 Docker Collector · <모으는 데이터 유형>`(예: `컨테이너 상태·로그·API 요청`, 서버 이름은 크럼에 있다, 2026-11-22), `연결 직접 OpenTelemetry · <받는 신호>`, `연결 업타임 모니터 · <방식과 간격>`. 오른쪽에 방식마다 조작 하나를 둔다: Docker는 수집이 서버 단위라 `설정 가이드`(그 서버의 개요), 직접 연결은 데이터를 더하는 곳, 업타임은 수정. 좁은 화면에서는 따로 한 줄을 쓰지 않고 복귀 링크 줄의 오른쪽 끝에 아이콘·방식·조작만 둔다(세부는 넓은 화면의 연결 줄에만 있다). 처음에는 좁은 화면에도 한 줄을 따로 두어 탭 줄이 76px 내려갔고, 탭 → 첫 내용을 줄인 정리(#141)를 되돌렸다. 연결 설정 흐름 자체는 이 틀이 바꾸지 않는다.
- **업타임 수치는 한 묶음이다**(`uptimeKpis`): `24시간 업타임 · 30일 업타임 · 평균 응답 (24시간)`에 HTTPS면 `인증서 만료`. 90일 업타임은 띠 머리글이다. 순서는 수치 → 응답 시간 → 90일 띠 → 기록이다. Docker 서비스는 일별 업타임(30일·90일, 체크 수로 가중)과 24시간 이력(평균 응답은 성공한 체크 수로 가중)에서 같은 값을 계산한다. 예전의 `24시간 체크`·`90일 장애` 칸은 띠(`일부 실패 N일`)와 응답 시간 카드(`체크 N회 중 실패 N회`)가 이미 말하므로 없앴다.
- **컨테이너도 서버 아래에 자기 페이지가 있다** (2026-11-22, `ServerContainerPage`, `/servers/:serverId/containers/:key?tab=logs|requests|traces|metrics|infra`, ADR 0012). 크럼은 `서버 › <서버> › <컨테이너>`로 앱 페이지와 같고, 서버의 Docker Collector(`agents.serverId`)를 찾아 그 Collector의 컨테이너를 키로 찾는다. 키는 주소의 원래 조각을 읽는다(인코딩된 `/`). 서버의 `컨테이너` 탭이나 로그 탭에서 열었으면 `컨테이너 목록`으로 돌아가는 링크가 있다. 옛 주소 `/services/:agentId/:key`는 같은 ID의 서버로 쿼리·해시·state를 넘겨 옮긴다(`LegacyContainerRedirect`). 장애 이력의 `targetPath`도 이 주소다(백엔드 `incidents.go`, Docker Collector를 비활성화해 서버가 없으면 옛 주소).
- **직접 연결한 앱은 자기 페이지가 있다** (2026-11-21, `ServerAppPage`, `/servers/:serverId/apps/:appId?tab=logs|requests|traces|metrics`. 머리말·탭 본문·탭 상태·이 앱에 더하기는 `features/servers/app/`에 있다). 예전에는 같은 앱이 서버의 로그·API 요청·메트릭 탭에 따로 나와 "앱 하나"를 한 번에 볼 수 없었다. 탭 이름과 순서, 주소의 `tab` 값은 Docker 서비스 상세와 같다(업타임·인프라는 앱에 없다). 앱이 보내지 않는 데이터 유형은 흐린 `연결 전` 탭이고, 그 본문은 이 앱에 그 유형을 더하는 연결 안내다(대화 상자는 고를 것 없이 이 앱에 더한다). `?tab`이 없으면 첫 탭은 앱이 받는 데이터로 고른다(로그 > 메트릭 > API 요청, 그룹 화면과 같은 순서).
  - 연결 줄: `연결 직접 OpenTelemetry · <받는 신호> 수신`. 조작은 받지 않는 유형이 있으면 `연결 추가`(그 유형의 탭으로 옮기면서 연결 대화 상자를 연다. 둘 이상이면 고르는 메뉴, `OverflowMenu textTrigger`), 다 받으면 `설정 다시 받기`(키 재발급)다. `연결 중지`는 상태 줄, 옮기기와 연결 해제(마지막 유형이면 삭제)는 `더보기`다. 연결 해제의 대상은 열린 탭의 데이터 유형이다.
  - 서버의 로그·API 요청·메트릭 탭은 앱 목록이다. 앱을 누르면 그 탭의 앱 페이지로 간다. 목록에서 열었으면 그 목록(`앱 목록`, 전체 로그에서 열었으면 `전체 로그`, 검색·보기 방식 포함)으로 돌아가는 링크가 있다: 좁은 화면은 머리말 첫 줄, 넓은 화면은 상단 바 오른쪽(§3.4 `AppHeader`의 대상 페이지의 목록 복귀 링크). 기간은 주소(`?range=`)에 둔다.
  - 옛 주소: `/servers/:s/logs/:app` → `?tab=logs`, `/servers/:s/api/:app` → `?tab=requests`(옛 `tab=traces`는 `?tab=traces`), `/servers/:s/metrics/:app` → `?tab=metrics`. 쿼리와 해시, 화면 state를 그대로 넘기고 기록을 바꾼다(`LegacyServerAppRedirect`). 옛 기능 메뉴 주소(`/logs/:id` 등)도 바로 앱 페이지로 간다.
  - 높이: 첫 데이터(로그 발생량 차트, 요청 수, 첫 지표 차트)가 1440에서 541·630·556 → 496·585·511px, 390에서 809·839·776 → 620·650·587px에서 시작한다. 서버 머리말과 서버 탭 줄이 빠진 만큼이다(§10 첫 화면의 높이 중 API 요청·메트릭 항목을 지웠다).
  - 탭 패널이 h1 바로 아래라 로그 발생량과 요청 추이 카드의 제목은 h2다(예전 앱 패널은 h2 제목 아래라 h3였고, Docker 서비스 상세에서는 h1 → h3로 한 단계를 건너뛰었다).
- **업타임 모니터도 자기 페이지가 있다** (2026-11-21, `ServerMonitorPage` + `UptimeMonitorDetail`, `/servers/:serverId/monitors/:monitorId`). 예전에는 서버의 업타임 탭 안에서 서버 머리말과 탭 줄 아래에 그렸고, 모니터가 하나면 탭의 첫 화면이 그 상세였다. 이제 업타임 탭은 모니터가 하나여도 목록이다.
  - 머리말: 모니터 이름(h1), 상태 줄(상태, 최근 체크, 일시정지), 연결 줄 `연결 업타임 모니터 · <확인 대상> <간격>초마다 · 수정`, 속성(Protocol, Interval, 기대 상태 코드). 주 조작은 다른 대상과 같은 `알림 규칙`(예전에는 `수정`이 주 조작이고 알림 규칙이 더보기 안이었다), 더보기는 `다른 서버로 옮기기`·`삭제`. 수정은 연결을 바꾸는 일이라 연결 줄의 조작이다.
  - 기간은 머리말의 기간 선택(`?range=`)이다. 응답 시간 카드 안의 `응답 시간 범위` 조작은 없앴다. 구역 제목은 h2(주요 지표, 응답 시간, 업타임 현황), 장애 이력은 h3다.
  - 옛 주소 `/servers/:s/uptime/:id`는 쿼리·해시·state를 넘겨 바꾼다(`LegacyServerMonitorRedirect`). 옛 기능 메뉴 주소 `/uptime/:id`와 백엔드 장애 이력의 `targetPath`(`handlers/incidents.go`)도 새 주소다. 대상 페이지가 없는 `/servers/:s/infrastructure/:id`는 그 탭으로 간다(`LegacyServerTabRedirect`).
  - 높이: 첫 수치(24시간 업타임)가 1440에서 463 → 340px, 390에서 625 → 401px에서 시작하고, 응답 시간 카드는 593 → 458px, 823 → 594px이다.
- 높이: Docker 서비스의 탭 줄은 1440에서 343 → 375px(연결 줄), 1024에서 403 → 435px, 390에서 343 → 367px(복귀 링크 줄을 터치 높이 44px로)이다. 서버의 앱과 모니터는 이 틀로 옮기면 서버 머리말이 빠져 지금보다 짧아진다.

**서버·Docker 통합 뒤의 용어** (2026-11-22, [ADR 0012](../../docs/adr/0012-servers-include-docker-hosts.md)). 제품 문구에서 `Docker 환경`은 없다: Docker Collector가 있는 호스트도 `서버`이고, 구분이 필요하면 연결 방식인 `Docker Collector`로 말한다(서버 목록의 캡션·필터, 연결 줄). Docker Collector가 발견한 대상은 `컨테이너`(이전 `Docker 서비스`)이고, 시작 버튼은 `Docker Collector 설치`(이전 `Docker 연결`, `DOCKER_INSTALL`)다. 설정 가이드의 제목은 `Docker Collector 설정 가이드`(이전 `모니터링 설정 가이드`)다. 이 문서의 날짜가 붙은 기록과 취소선 항목에 남은 옛 이름은 당시 이름이다.

**대상의 이름** — 서버 화면에서는 직접 연결한 대상을 "앱"이라고 부르고(로그·API 요청·메트릭 탭, 개요, 대화 상자) "서비스"와 "메뉴"라는 말을 쓰지 않는다. Docker Collector가 발견한 대상은 "컨테이너"다(2026-11-22, ADR 0012, 이전 "Docker 서비스"). "서비스"라는 말은 대상의 이름으로 쓰지 않는다(알림 규칙의 대상 선택도 `대상`이다). 업타임의 대상은 "모니터", 인프라의 대상은 "인프라 리소스"다. 여러 부모를 가로지르는 목록에서 대상의 이름은 **`부모 / 대상`** 형식이다(`edge-host-01 / Checkout API`, `prod-server / payment-worker`): 개요의 현재 확인 필요와 최근 장애 이력, 알림 규칙의 대상 선택과 목록(`directTargetLabel`, 컨테이너는 `containerLabel`). 부모는 언제나 서버다: 컨테이너 앞의 이름도 Docker Collector가 속한 서버의 이름이다(2026-11-22, ADR 0012). 대상 이름이 부모 이름과 같으면(인프라 리소스) 부모 이름만 쓴다(개요, 알림 규칙). 알림 규칙의 대상 선택은 `Docker Collector`(컨테이너, Docker 호스트 인프라)와 `직접 연결` 묶음이다.

**개요 탭은 서버 한 대의 대시보드다** (G안 2026-11-29, `ServerOverviewTab`). 위에서 아래로:
- **장애 배너**: 지금 장애인 대상마다 한 줄(최대 셋). 옅은 빨강 바탕(`bg-crit-bg`) + `crit-border`, 장애 모양, 원인 문구(`Checkout API 응답 없음, 6분째`), 오른쪽 `모니터 보기`·`컨테이너 보기` 등. 하나여도 둔다(2026-11-21의 "둘 이상일 때만"을 대체). 이전에 불러온 모니터의 장애는 띄우지 않는다.
- **주요 지표 띠**: 개요의 요약 띠와 같은 틀. CPU(코어 수)·메모리(사용/전체 GB)·디스크(사용/전체 GB)·네트워크(수신, 송신)·업타임 24시간(모니터 수). 값이 있는 칸만 보인다. 70% 이상은 `attn-text`와 `, 주의 기준 초과`.
- **컨테이너**(Docker 서버): 장애가 먼저인 여섯 줄 표(`ResourceTable`: 컨테이너 · 이미지 · 재시작 · 상태 단어 `실행 중`/`응답 없음`/`대기`), 제목 옆 `6 · 실행 중 5`, `전체 보기`는 컨테이너 탭.
- **인프라**(인프라를 연결한 서버): 인프라 탭과 같은 `InfraTrends` 2×2. 기간은 넓은 화면에서 상단 줄 오른쪽의 `기간`, 좁은 화면은 섹션 제목 줄이다.
- **최근 에러 로그 | 업타임 90일**(3:2): 로그는 앱마다 가장 최근의 오류(없으면 경고) 한 줄씩 새것부터 다섯(`/logs/summary?serverId=`의 `latest`), mono 한 줄(시각 · 앱 · 메시지), `로그 열기`. 90일은 서버 모니터들의 일별 상태를 합친 띠(하루에 전체 실패가 하나라도 있으면 장애, 일부 실패면 확인 필요)와 가장 낮은 90일 가용률.
- 연결되지 않은 기능은 맨 아래 `연결할 수 있는 기능` 섹션 하나에 텍스트 버튼으로 모은다(그대로).
- 기능별 상태는 탭(모양·`확인 불가`·`연결 전`)과 머리말의 한 줄 메타(`로그, API 요청, 인프라 수집`)가 말한다. 2026-11-18의 기능 행(옆 라벨 배치)은 없앴다.

**컨테이너의 첫 탭은 `개요`다**(G안 2026-11-29, `AgentServiceTabs`): 응답하지 않는 동안만 맨 위에 장애 수치 상자 넷(`IncidentFigures`: 응답 없음 지속 · 마지막 정상 응답 · 재시작 · 장애 7일), 그 아래 업타임 수치·응답 시간(장애 구간은 `incident-band`)·90일 띠, 맨 아래 `최근 로그`(마지막 여덟 줄, mono, `전체 로그`는 로그 탭) | `이벤트`(상태 변경·배포·알림 발송·복구 알림, 새것부터 여덟, `AgentFailureHistory`). 알림 발송만 보이던 `최근 알림 기록`(아이콘 타일 + 설명)을 대신한다.

**서버 머리말**(G안): 이름(h1) → 설명 → 한 줄 메타 `상태 · 원인 | 연결 방식과 대상 수 | 수집 중인 기능`(세로선으로 나눈다). 갱신 상태는 넓은 화면에서 상단 줄 오른쪽이다.

**대상이 없는 서버** — 개요 탭은 `EmptyState` 하나다: `아직 연결한 기능이 없습니다`, 주 버튼은 설치가 필요 없는 `업타임 모니터 추가`이고, 나머지 네 기능의 `{기능} 연결`이 secondary로 옆에 있다. 모두 그 기능의 탭으로 옮기면서 대화 상자를 연다(2026-11-22: 예전에는 업타임만 버튼이고 다른 기능은 `각 탭에서 연결합니다`라는 문장뿐이었다).

**연결 안내** (`ConnectPrompt`) — 연결되지 않은 탭의 본문이다. `EmptyState`(h2)에 **무엇이 필요한지와 누른 뒤에 일어나는 일**을 적는다: 서버에 설치할 것이 있는지(업타임은 없다, 인프라는 OpenTelemetry Collector), 누르면 무엇을 받는지(앱 이름을 정하고 키와 설정 예시, 인프라는 API Key와 OpenTelemetry Collector 설정 파일), 키가 한 번만 표시되는지. 실제로 제공하는 동작만 말한다. 주 버튼은 탭 줄과 같은 문구(`connectAction`)이고 `primary`다. "개요로 돌아가기" 같은 버튼은 바로 위 탭 줄과 겹치므로 두지 않는다. 연결을 마치면 그 대상의 주소로 가서 포커스를 탭 패널로 옮기고 토스트로 알린다.

**위험 동작** — 서버 삭제와 다른 서버 합치기는 서버 설정 대화 상자의 입력란 아래, 저장 줄 위에 둔다. 저장 줄의 오른쪽 끝(주 액션 자리)에 파괴 조작이 오지 않게 한다. 표현은 §9.2(중립 표면에 앞에 하는 일을 적은 muted 문장과 버튼)다: `서버 삭제`는 `destructive`, `다른 서버 합치기`는 이 서버를 지우지 않으므로 `secondary`다. 확인 창의 규칙:
- 삭제 확인 창은 제목에 대상 이름을 넣는다(`edge-host-01 서버를 삭제할까요?`). 합치기 대화 상자의 제목은 `다른 서버 합치기`이고 고른 서버의 이름은 선택 목록이 보인다. 삭제 확정은 `danger`, 합치기 확정도 선택한 서버가 삭제되므로 `danger`다(§7).
- **함께 삭제되거나 옮겨질 대상을 종류와 개수로 보인다**(`TargetCountList`: `업타임 모니터 2개`, `앱 1개`, `인프라 리소스 1개`, 0개인 종류는 뺀다). 합치기는 삭제될 서버의 수도 적는다.
- **모르는 것을 단정하지 않는다.** 대상 목록을 불러오지 못했으면 "연결된 대상이 없다"고 쓰지 않고 확인하지 못했다고 쓴다. 이전에 불러온 목록이면 지금과 다를 수 있다고 적는다. 인프라 리소스 목록을 몰라 합치기의 충돌을 미리 확인하지 못했으면 그것도 적는다.
- 인프라 리소스는 서버마다 하나이므로 이미 리소스가 있는 서버는 합치기·옮기기의 선택지에서 비활성으로 두고 까닭을 적는다.
- **같은 호스트 합치기** (2026-11-22, ADR 0012): Docker 서버도 합친다. 다음 다섯 가지를 지킨다.
  - 서버에 Docker Collector는 하나다. Docker Collector가 있는 서버를 고르면 다른 Docker 서버는 `Docker Collector가 이미 있습니다`로 비활성이다(백엔드 409 `SERVER_HAS_TWO_DOCKER`).
  - 합친 서버의 Docker Collector가 호스트 지표를 모으고 OpenTelemetry Collector 리소스도 있으면, 창 안의 `호스트 지표 출처`(라디오)에서 하나를 고르기 전까지 `합치기`가 비활성이다. `Docker Collector`를 고르면 OpenTelemetry 리소스의 연결을 중지하고(기록은 남는다), `OpenTelemetry Collector`를 고르면 Docker 프로필에서 인프라를 뺀 뒤 서버에서 실행할 `적용 명령` 창을 연다.
  - Docker Collector가 있는 서버는 삭제하지 않는다(서버 설정의 삭제 대신 안내 문장, 더보기의 `Docker Collector 비활성화`). 합치기는 된다.
  - 합쳐서 사라진 Docker 서버의 주소(`/servers/<Collector ID>/…`)는 그 Collector가 지금 속한 서버의 같은 아래 경로로 간다(`useMergedServerRedirect`). 별도의 표가 필요 없다.
  - 이름이 같은 Docker 서버와 직접 연결 서버(` (2)` 같은 접미사 무시, `sameHostPairs`)는 개요의 `같은 호스트인가요?`에 `합치기`·`아님`으로 제안한다. 확인 없이 합치지 않는다. `합치기`는 직접 연결 서버의 화면에서 Docker 서버를 고른 합치기 창을 열고(`state.mergeFrom`), `아님`은 서버에 기록해 모든 브라우저·사용자에게 다시 보이지 않는다(`/same-host-dismissals`, migrateV60, 어느 서버든 지워지면 기록도 지워진다).
- 삭제한 뒤에는 사용자가 보던 검색 조건의 서버 목록으로 돌아간다.

**탭 본문의 진행 중·실패 상태** (2026-11-19)
- **이전 목록에 대상이 없어도 연결 안내를 보이지 않는다.** 업타임·로그·API 요청·메트릭 탭은 목록이 이전 정보(`stale`)이고 대상이 0개이면 연결 안내 대신 처음부터 실패한 경우와 같은 `LoadErrorBanner inline`(`<기능> 정보를 불러오지 못했습니다` + 다시 시도)이다. 대상이 정말 없는지 모르기 때문이다(인프라 탭은 예외로 남아 있다, §10).
- **삭제나 이동을 시작한 화면은 화면이 바뀔 때까지 본문이 자리 표시다**(`PanelPlaceholder`, `role="status"` + `로딩 중…`). 끝난 뒤 다시 불러오는 동안 지운 대상의 패널이나 빈 탭의 연결 안내가 잠깐 보이지 않게 한다. 다른 화면으로 옮겨 가면(뒤로 가기로 같은 화면에 돌아와도) 잊는다.

**요청의 규칙** (2026-11-19, 화면이 보여 주는 정보의 정확성에 관한 것이라 여기 적는다)
- **대상 전체를 보내는 수정 요청은 실행 직전에 대상을 다시 조회해서 만든다**([`utils/readLatest.ts`](src/utils/readLatest.ts)). 화면의 객체(최대 한 주기 전, 다시 불러오기에 실패했으면 더 이전)로 만들면 그 사이의 변경(일시정지, 신호 연결 해제)을 조용히 되돌린다. 다른 서버로 옮기기, 모니터의 수정과 일시정지·재개가 그렇다. 다시 읽은 대상이 삭제되었으면(404) 요청을 보내지 않고 `대상이 삭제되어 <동작>할 수 없습니다`를 알린 뒤 서버 데이터를 다시 불러온다.
- **서버 데이터의 조회에서 화면이 쓰지 않는 무거운 조회는 그 화면에서 끈다.** `useServers({ logSummary: false })`: 개요는 오류 로그 건수를 보이지 않으므로 로그 요약을 30초마다 묻지 않는다. 끈 화면에서는 오류 로그 값을 만들지 않고 실패 목록에도 넣지 않는다.

### 4.8 개요 (2026-11-29, G안)

개요(`OverviewPage`)는 위에서 아래로 제목 줄 → 요약 띠 → 주의 필요 → (같은 호스트 제안) → 최근 장애 | 업타임 모니터다. 판정은 서버 화면과 같은 서버 행이다(§5.4).
- **제목 줄**: `개요` + 흐린 `13개 서버 · 24시간` + 오른쪽 `서버 전체 보기 ›`(quiet). 갱신 상태는 상단 줄 오른쪽이다(§3.4).
- **요약 띠**: 테두리 하나에 네 칸을 세로선으로 나눈다(카드 넷이 아니다). 정상 서버 `6 / 13`과 장애·확인 필요·대기 수, 평균 업타임(모니터 24시간 가용률의 평균)과 24시간 선, 활성 장애(사이드바 배지와 같은 판정)와 최장 경과, 에러 로그(24시간 합계, 시간별 막대, 제목이 전체 로그 링크). 좁은 화면은 한 칸씩 쌓는다.
- **주의 필요는 서버 단위다**: 장애 → 확인 필요 → 대기 순, 같은 상태 안은 이름순. 대기는 아직 아무것도 연결하지 않은 서버만이다(`연결 전`). 일시정지만 있는 서버는 할 일이 아니라 넣지 않는다. 열은 서버(상태 모양 + 이름) · 상태 단어 · 원인(그 서버의 이상을 ` · `로 모두 잇는다, 사용률은 `메모리 84.6% · 기준 70%`) · 경과(진행 중 장애가 있을 때) · 업타임 24시간(서버 모니터들의 체크 띠 + 가장 낮은 가용률). 행은 서버 화면으로 간다. 좁은 화면은 이름 · 원인 · 상태만 남긴다.
- 장애·확인 필요가 없으면 `장애·확인 필요 없음` 한 줄을 먼저 보이고, 대기 행은 그 아래에 남는다.
- **최근 장애**(7일): 제목은 장애 메시지, 둘째 줄은 `서버 / 대상 · 시각`, 오른쪽은 `진행 중 · 6분`(빨강) 또는 `해결 · 8분` 알약. 행은 대상 페이지로 간다.
- **업타임 모니터**(24시간): 장애가 먼저, 이름순. 상태 모양 · 이름과 서버 · 체크 띠 · 가용률 · 응답 시간(장애는 `실패`, 일시정지는 `일시정지`). 여섯 개를 먼저 보이고 나머지는 제자리에서 펼친다.
- **체크 띠(`UptimeStrip`)**: 모니터의 24시간 20분 버킷을 둘씩 묶어 36칸. 모두 성공 `uptime-ok`, 모두 실패 `uptime-fail`, 일부 실패 `attn`, 체크 없음 `uptime-no-data`. 서버 띠는 모니터들의 버킷을 체크 수로 가중해 합친다(`combineBuckets`).
- **상태 모양(`StatusShape`)**: 장애 네모, 확인 필요 세모, 정상 동그라미, 대기 점선 동그라미. 색이 없어도 갈린다.
- **조회가 일부 실패한 동안에는 건수를 단정하지 않는다**: 주의 필요 제목 옆 개수와 정상 서버 수를 숨기고(`-`), 빈 문구는 `불러온 영역에서는 장애·확인 필요 없음`이다. 위에 `일부 모니터링 정보를 불러오지 못했습니다` 배너와 다시 시도를 둔다. 장애 이력만 실패하면 그 섹션 안에 알리고, 이전에 불러온 기록이면 그렇다고 적는다.

---

## 5. 상태 표현 문법

### 5.1 대상의 상태 — 모양 + 라벨

```tsx
<StatusLight tone="error" label="장애" />        {/* ■ 장애 */}
<StatusShape tone="warn" label="확인 필요" />    {/* 라벨 없는 자리의 모양(role="img") */}
```

| 상태 | 모양 | 채움 | 글자 |
|---|---|---|---|
| 장애 | 네모(모서리 2) | `crit` | `crit-text` |
| 확인 필요 | 세모 | `attn` | `attn-text` |
| 정상 | 동그라미 | `ok` | 목록에서는 `text-muted`(정상은 덜 칠한다) |
| 대기·모름 | 점선 동그라미 | `wait` | `text-faint` |

모양이 색을 거든다: 색각이상이나 흑백에서도 장애와 정상이 갈린다. `StatusShape`(10px, 조밀한 자리 8px)가 유일한 그리기 수단이고 `StatusLight`·탭·세그먼트·필터 칩이 이것을 쓴다. 진행 중 장애의 머리말 상태는 `pulse`로 깜빡인다(`prefers-reduced-motion`에서 멈춘다). **상태 단어는 상태색으로 칠할 수 있다**(G안 목록의 `장애`·`확인 필요`). 정상은 칠하지 않는다.

**서비스 상태와 수집 상태는 섞지 않는다**(`CollectionStatusBadge`: 수집 중·지연·수신 대기·미설정). 상태 표시는 읽기 전용이다. 일시정지·재개는 별도 `Button`이다.

### 5.1b 배지 — 표 컬럼의 고정 어휘 토큰

`badge`(12px 500, 최소 높이 24px, 4px 모서리)는 표 컬럼에 반복되는 고정 어휘에만 쓴다: 알림 severity(`SEVERITY_TONE`), span kind. 강조는 하나만: 옅은 바탕(`*-bg`) + 글자색. 보더를 칠하지 않는다. 배지 모양을 손으로 만들지 않는다.

### 5.2 라벨 없는 모양

인접 문장이 상태를 말하면 모양은 장식이다(`aria-hidden`). 모양이 유일한 정보원이면 `StatusShape label`로 이름을 준다(WCAG 1.4.1).

### 5.3 색을 싣는 곳

**데이터(상태)와 위치에만 색을 싣는다.** 모양 · 상태 단어 · 원인 글자 · 막대 채움 · 체크 띠 · 차트 시리즈 = 색. 상자 바탕 · 상자 보더 · 섹션 제목 · 주 버튼 = 중립. 장애 배너만 옅은 빨강 바탕이다.

**칩은 상태 전용이다.** 분류·출처 같은 라벨은 배경 없는 글자(`type-caption text-text-muted`)다. 분류에 강조색을 쓰지 않는다(선택됨으로 읽힌다).

### 5.4 서버의 상태 (2026-11-18)

**판정은 한 곳이다**: [`features/servers/serverStatus.ts`](src/features/servers/serverStatus.ts). 서버 목록, 서버 상세(머리말, 탭의 점, 개요 탭, 앱 목록, 패널의 상태 줄), 앱 페이지의 상태 줄, 개요의 현재 확인 필요가 같은 함수와 같은 값을 쓴다. 패널은 탭이 계산한 `PanelStatus`를 받는다(§4.1 서버 탭 안의 패널). 따로 계산하면 목록은 "정상"인데 그룹은 "장애"인 대상이 생긴다.

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
- **`확인 불가`의 점은 중립색이다**(`StatusLight tone="idle"`, `wait`). 경고색이 아니다. 상태를 모르는 것이지 문제가 있다는 뜻이 아니고, 경고색이면 확인 필요와 구분되지 않는다. 탭에서는 점 없이 `확인 불가` 보조 문구만이다(§4.6). 개요 탭은 그 기능 행을 연결된 기능들 다음에 둔다.
- 수치가 없는 까닭이 조회 실패이면 칸은 `-`가 아니라 `불러오지 못함` 표시다(§4.5 서버 목록).
- 상태 요약 필터(서버 목록, 업타임 탭)는 장애·확인 필요가 0건이면 그 점을 중립색으로 둔다. 0건인 장애를 빨간 점으로 보이지 않는다.

---

## 6. 폼

| 컴포넌트 | props | 용도 |
|----------|-------|------|
| **`Input`** | `invalid?` `warn?` `mono?` + 네이티브 | 폼 입력 전부 |
| **`Select`** | 네이티브 `option` children + 기존 select props | 폼 셀렉트 (Input과 같은 셸) |
| **`SearchInput`** | `wrapperClassName?` `onClear?` `resultCount?` `shortcut?` + 네이티브 | 아이콘 붙은 검색창. Astryx PowerSearch(meta/astryx) 참고: 경계는 래퍼가 갖고 돋보기·입력·결과 수·지우기(`IconButton sm`)가 한 줄로 흐른다. 경계는 다른 입력과 같은 `control-border`(3:1), 포커스는 전역 `:focus-visible`과 같은 2px `focus` 외곽선을 래퍼에 그린다(입력 자신의 외곽선은 끈다). 쉴 때 옅은 경계·테두리색 포커스를 시도했다가 대비 1.40:1·후광 1.2:1로 hallmark gate 39a/40에 걸려 되돌렸다(2026-11-15). 결과 수는 검색어가 있을 때만 보이고(`number`면 `N개`, 무엇을 셌는지 모호하면 문자열) `aria-live=polite`로 알린다. `shortcut`은 `/` 포커스 + `aria-keyshortcuts`. **URL(`?q=`)에 입력값을 직접 묶지 않는다**: react-router가 transition으로 반영해 한글 조합이 깨진다(`결제`→`ㄱ겨결결ㅈ제제`). 입력은 로컬 상태, URL은 사본이다 |

**클래스를 직접 쓰지 않는다.** Button과 같은 규칙이다.

셸은 `Input.tsx`가 `FIELD_SHELL`·`FIELD_HEIGHT`로 export한다 — `Select`와 텍스트영역이 같은 상수를 쓴다. **높이는 `h-11 sm:h-10`(터치 44 / 그 외 40)으로 고정**한다(Button과 같은 이유, `px/py` 조합 금지). `Select`는 보이는 trigger + portal listbox를 렌더하고, 네이티브 `<select>`는 폼 값과 기존 `onChange` 계약을 유지하는 숨김 요소다. 따라서 브라우저의 기본 option 메뉴가 노출되지 않는다. 높이가 자유로워야 하는 텍스트영역만 `FIELD_SHELL`에 자기 `py`를 덧붙인다.

**상태 표현**
- `invalid` — 검증 실패. `border-crit` 보더 + `aria-invalid`. 메시지는 필드 아래 `type-body text-crit-text` — 경고문이므로 14px(§2.2)이고, `red-500`은 흰 배경 3.8:1로 AA 미달이다
- `warn` — 제출은 막지 않는 주의(예: 원격에서 안 통할 주소). `border-attn` 보더

**폼 리듬** (2026-11-21, 전체 간격 점검) — #137의 세로 위계 6단을 폼에 그대로 쓴다. 이전에는 라벨 → 컨트롤 6, 컨트롤 → 도움말 6 / 오류 4로 오류가 뜨면 아래 글이 움직였고, 필드 사이가 대화 상자 16 / 드로어·채널 폼 20으로 갈렸으며, 체크박스·선택지의 제목과 설명이 0~2px로 붙어 있었다.

| 관계 | 값 | 단계 | 구현 |
|------|-----|------|------|
| 라벨 → 컨트롤 | 8px | V2 | `Field` 라벨 줄 `mb-2` |
| 컨트롤 → 도움말·오류 | 4px (같은 자리) | V1 | `Field` 도움말·오류 `mt-1` |
| 필드 → 필드 | 16px | V3 | 대화 상자 본문·`FormStep`·서버 필드 모두 `space-y-4` |
| 번호 단계(필드 묶음) 사이 | 32px + 선 | V6 | 규칙 드로어·채널 폼의 단계 |
| 선택지·체크박스 제목 → 설명 | 4px, 설명 12/18 | V1 | `OptionText`(`components/common`) — 업타임 모니터 추가의 `다운되면 알림`, 대상 추가·서버 합치기·대상 옮기기의 선택지, 상세 수집의 바디 수집 |
| 제목 → 설명(단계 머리, 미리보기 머리, 설정 행) | 4px | V1 | `mt-1` |
| 페이지 폼의 마지막 필드 → 버튼 | 24px | V5 | 대화 상자는 바닥 줄(구분선 + `px-6 py-4`) |

손으로 라벨과 입력을 쌓지 않는다(`space-y-1.5` + `<label>`): `Field`를 쓴다. 라벨만 있고 연결할 입력이 없는 묶음(세그먼트 선택 등)은 `type-label text-text-muted` 라벨 + `mt-1` 설명 + 조작까지 `space-y-2`다(Docker 연결의 `수집 범위`). 대화 상자의 바닥 버튼은 본문 안에 두지 않는다 — Docker 연결 모달만 구분선 없이 본문 안에 있었다.

**검증은 브라우저 말풍선이 아니라 필드 아래 문구다** (2026-11-20, UI/UX 점검 A5). 폼에 `noValidate`를 걸고 `required`·`pattern`·`min`·`max` 대신 제출할 때 직접 검사한다. 오류는 `Field`(`features/alerts/components/FormLayout.tsx`)의 `error`로 보이고, `Field`가 입력에 `aria-invalid`·`aria-describedby`를 잇는다. 첫 오류 칸으로 포커스를 옮기고, 그 칸을 고치면 오류를 지운다. 입력의 `title` 툴팁으로 규칙을 알리지 않는다. 이전에는 알림 폼만 이 방식이었고 서버·업타임·그룹·텔레메트리·로그인 폼은 브라우저 말풍선을 써서, 말풍선이 몇 초 뒤 사라지고 `title` 툴팁이 그 위에 겹쳤다. 문구는 마침표 없이 `서버 이름을 입력하세요`, `1~65535 사이의 포트를 입력하세요`처럼 할 일을 말한다.

보더는 선이라 채움 역할(§1.4)이다. 2026-11-13까지 `border-red-500`·`border-amber-400` primitive였고, `Textarea`의 기본 보더는 `border-strong`가 아니라 장식용 `border`(1.40:1)였다.

**입력의 글자는 `sm` 미만에서 16px다** (`Input`·`Textarea`·`SearchInput`·명령 팔레트, `max-sm:text-base`). 버튼인 `Select` 트리거는 확대와 무관해서 `FIELD_SHELL`에는 넣지 않는다. iOS Safari는 글자가 16px 미만인 입력에 포커스하면 화면을 확대하고, 입력을 마쳐도 원래 배율로 돌아오지 않는다. 뷰포트에 `maximum-scale=1`을 거는 우회는 사용자의 확대 자체를 막으므로 쓰지 않는다(WCAG 1.4.4).

보더 색은 컴포넌트 내부에서 결정한다. `className`으로 넘기면 base의 `border-border-strong`와 **특이도가 같아** 생성된 CSS 순서로 승패가 갈린다 — 호출부가 이길 거라 가정하면 안 된다.

**포커스 링** — `index.css`의 전역 `:focus-visible { outline: 2px solid var(--color-action) }`가 처리한다. `focus:outline-none` + 개별 `focus:ring-*`으로 덮어쓰지 않는다.

> 대비를 스크립트로 잴 때 주의: Tailwind v4의 `transition-colors`는 **`outline-color`를 포함**한다. `.focus()` 직후 `getComputedStyle`을 읽으면 트랜지션 첫 프레임(`currentColor`)이 잡혀 링이 검게 보인다. `transitionProperty='none'`으로 끄고 재야 실제 값이 나온다.

**목록 툴바 필터도 `Select`를 사용한다.** `ListToolbar`의 검색창·버튼과 같은 40px 높이로 맞추며, 시각 라벨이 없으면 `aria-label`을 지정한다. 필터 폭은 `wrapperClassName`으로 바깥 래퍼에 지정한다. 조회 제어의 위치와 폭은 §4.1을 따른다.

**텍스트영역**은 `Textarea`(`components/common/Textarea.tsx`)다. `FIELD_SHELL`에 자기 `py`만 덧붙인다.

**`Field`** (`features/alerts/components/FormLayout.tsx`) — 라벨 + 입력 + 에러/힌트 한 묶음. 도움말(`hint`)은 읽는 문장이라 `type-body text-text-muted`다 — `dim`은 메타·placeholder 전용(§1.3)이고, 2026-11-14까지 모든 폼의 도움말이 `dim`이었다. `htmlFor`를 줄 때만 `<label>`로, 없으면 `<span>` 캡션으로 렌더한다(자식이 버튼 그리드면 `<label>`이 첫 버튼을 눌러버린다). 한글 라벨·힌트에 `uppercase`·`italic`을 걸지 않는다 — 한글에는 대문자가 없어 자간만 벌어지고, 기울임 글리프가 없어 브라우저가 가짜 기울임을 만든다.

---

## 7. 오버레이

### 공통 툴팁

짧은 hover 힌트는 `Tooltip`을 쓴다. `Button`·`ButtonLink`·`CopyButton`·`Input`·`Select`·`Toggle`의 `title` prop과 `IconButton`의 `label`은 공통 툴팁으로 표시하며, DOM에 네이티브 `title`을 남기지 않는다. 일반 요소는 `<Tooltip content="설명" focusable><span>값</span></Tooltip>`으로 연결한다. 독립된 읽기 전용 정보에는 `focusable`을 주고, 버튼·링크 내부나 스파크라인의 각 막대에는 Tab 지점을 추가하지 않는다. 차트의 `ChartTooltip`은 데이터 탐색용으로 유지한다.

- 표면은 `bg-surface`·`text-text`·`border-border`, 모서리는 `rounded-md`, 그림자는 `shadow-lg`다. 짧은 힌트는 12px, 최대 폭은 320px이며 긴 문자열과 여러 줄을 허용한다.
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

이름을 찾지 못한 대상은 내부 ID만 맨 글자로 두지 않는다. `이름을 불러오지 못한 대상`(목록을 다 받지 못함) 또는 `삭제된 대상`(목록을 다 받았는데 없음) 뒤에 ID를 `text-text-faint`으로 붙인다(`RuleTargetName`). 한 줄로 말줄임하는 표 칸에서는 ID를 다음 줄에 둔다.

조회에 실패해 목록이 비었으면 오류 배너만 둔다. 빈 상태(연결 안내)나 `검색 결과가 없습니다`를 함께 보이지 않는다 — 검색하지 않았고, 비었는지도 모른다(UI/UX 점검 A1).

### 토스트 (2026-11-13)

토스트는 **방금 한 작업의 결과**를 알리는 일시 피드백이다. 저장·삭제·복사의 성공, 서버가 거절한 작업의 실패가 여기에 해당한다. 설정은 `main.tsx`의 `Toaster` 한 곳에 있다.

| 항목 | 규칙 |
|---|---|
| 위치 | 우측 상단. 넓은 화면(lg)에서는 상단 줄 아래(`top-20`)에 띄운다: 상단 바 오른쪽의 목록 복귀 링크를 덮지 않게(2026-11-22, 포인터가 올라가면 토스트가 멈춰 링크를 계속 가렸다) |
| 표면 | `surface`, 보더 `border`(§3.5, 스크림 없이 뜨는 표면) |
| 아이콘 | 성공 `ok`, 실패 `crit`. 아이콘 안 체크는 표면색으로 뚫는다 |
| 시간 | 성공 3초, 실패 5초. 마우스를 올리면 멈춘다(라이브러리 기본) |
| 문장부호 | 작업이 끝났다는 한 문장의 결과 알림은 마침표 없이 끝낸다(`서버를 삭제했습니다`, `업타임 모니터 2개를 삭제했습니다`). 두 문장인 안내는 문장 사이와 끝에 마침표를 둔다(`복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.`). 2026-11-19에 다수(마침표 없음)로 맞췄다. 오류 문구 사전(`utils/errors.ts`의 `ERROR_MESSAGES`)은 마침표로 끝나 그대로 실패 토스트에 실린다(§10) |

- **지속되는 상태는 토스트가 아니다.** 네트워크 끊김, 수집 중단, 조회 실패처럼 사용자가 떠나 있다 돌아와도 알아야 하는 것은 그 자리의 배너다(`NetworkStatusBanner`, §4.1 `다시 시도` 배너).
- **검증 실패를 토스트로만 알리지 않는다.** 필드 아래의 인라인 메시지(§6 `invalid`)가 정본이고, 토스트는 화면 밖 필드를 알리는 요약이다.
- **나중에 다시 봐야 할 정보를 담지 않는다.** API Key, 설치 명령처럼 복사해 쓸 값은 사라지면 다시 볼 수 없으므로 다이얼로그나 결과 화면에 둔다. 복사 실패 토스트는 "직접 선택해 복사"를 안내하되 값 자체는 화면에 남아 있어야 한다.

---

## 8. 접근성

- **전역 포커스 링** `:focus-visible` 2px `focus` + 2px offset. 개별 컴포넌트에서 재정의 금지. 2026-11-13까지 primary였는데, 다크 배경에서 3.38~3.62로 3:1 하한에 붙어 있었고 `surface` 위에서는 2.51로 미달이었다. `action`은 라이트 5.27~6.00, 다크 6.34~9.15다
- **잘라 내는 컨테이너 안의 포커스 링에는 여백을 둔다** (2026-11-19). 링은 요소 바깥 4px(2px + offset 2px)에 그려지므로 `overflow`가 걸린 스크롤 영역이나 화면 가장자리에 붙은 항목은 링이 잘린다. 그 안쪽에 링이 들어갈 여백을 둔다: 사이드바 nav의 `py-1`, 로고 링크를 블록 가장자리에서 띄운 `px-3` 블록 + 링크의 `px-1`, 모바일 하단 내비의 `px-1 pt-1`, 탭 목록과 앱 선택 영역의 `p-1` + `-m-1`(§4.6). 자리를 바꾸지 않으려면 같은 값의 음수 마진으로 끌어당긴다
- **네이티브 컨트롤도 테마를 따른다** — `:root`는 `color-scheme: light`, `.dark`는 `color-scheme: dark`다. 선언이 없던 때는 다크 모드에서도 체크박스(`accent-accent`)의 빈 칸, 자동완성 배경, 기본 스크롤바가 라이트로 그려졌다
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
- **대비** 작은 메타·placeholder도 일반 텍스트 기준 4.5:1을 만족해야 한다. `text-text-faint`의 다크 값 `#8b8f97`는 페이지·카드·hover 배경에서 검증했다. 더 밝은 표면에서는 `base` 또는 `secondary`를 사용한다 (§1.3).

---

## 9. 금지 사항

사용자 피드백에서 확정된 규칙이다. 근거까지 함께 적는다.

1. **카드 좌측 상태 보더 금지** — warn/crit 3px 세로 컬러 라인. *"AI 생성 디자인 같다."* 상태는 배지·아이콘·텍스트 색으로만.
2. **danger zone 스타일 금지** — 붉은 카드 보더, 붉은 섹션 제목, 앰버 경고 박스. 파괴적 액션은 **중립 카드 + `<Button variant="destructive">`**(채움 없는 `status-error` 텍스트). `text-red-600` 텍스트 링크는 다크에서 표면 대비 3.0이라 쓰지 않는다(§10 경계표). 주의문은 앰버 박스 대신 muted 본문.
3. **파스텔 틴트 박스 금지** — `bg-emerald-50` / `bg-amber-50` / `bg-red-50` 계열 공지 박스. `bg-surface-hover + border-border` + 상태색 아이콘 악센트로 대체. (배지·게이지 채움·hover·장애 행 채움(§4.5 서버 목록)은 데이터 시맨틱이라 예외)
4. **`dark:` 이중 작성 금지** (§1.1) — `text-slate-500 dark:text-text-muted-dark` → `text-text-muted`
5. **상태색 primitive 직접 사용 금지** — `text-emerald-600 dark:text-emerald-400` → `text-ok-text` (§1.4). 대비·색각 조정이 index.css 한 곳에서 끝나야 한다. 점·막대·보더처럼 글자가 아닌 표시는 `bg-status-*-fill`이다 — 글자 토큰을 단색 채움에 쓰지 않는다(`pnpm lint`가 센다)
6. **`text-[Npx]` 임의값 금지** (§2.2) — 스케일 토큰만
7. **버튼 클래스 직접 작성 금지** — `<button className="px-4 py-2 bg-accent …">` → `<Button>` (§4.1). 높이·radius·굵기가 화면마다 어긋나는 것을 막는다. 아이콘만 있는 액션은 `IconButton`이다 — `text-slate-400 hover:text-accent` 문자열을 손으로 쓰지 않는다
7a. **버튼 색을 `className`으로 덮어쓰기 금지** (§4.1) — variant로 고른다. Tailwind 유틸리티 순서 때문에 override가 조용히 무시된다
8. **`window.confirm()`·`confirm()` 금지** → `ConfirmDialog`
9. **recharts `<Legend>` 금지** → `ChartStatsLegend` / `ChartLegend`
10. **차트 시리즈 색 하드코딩 금지** → `SERIES`(`var(--chart-N)`)
11. **텍스트 위계에 5단째(더 옅은 등급) 추가 금지** — `dim`이 AA 하한선이다 (§1.3)
12. **대상의 상태를 배지로 표시 금지** (§5.1) — 정상/장애/수집 상태는 `StatusLight`(모양 + 라벨). 배지는 표 컬럼의 고정 어휘 토큰 전용이다. 배지 안에서도 보더·배경·텍스트 색 3중 적용 금지 — 강조 수단은 택1. *"초등학생 디자인 같다."* `/20` 보더는 대비 1.33~1.64라 보이지도 않으면서 스티커 테두리 느낌만 남긴다
13. **분류 축을 칩으로 만들지 않기** (§5.3) — 출처·종류 라벨은 배경 없는 `type-caption text-text-muted`. 칩은 상태 전용이다. 중립 칩도 안 되는 이유는 §5.3 참조(`status-idle`과 `text-muted`가 같은 색)
14. **카드 안에 좌측 기준선 2개 금지** (§4.1) — 부제·본문은 아이콘 거터가 아니라 카드 패딩에 정렬한다

15. **기술 용어를 한글로 번역하지 않기** — 사용자는 개발자다. 업계에서 영어로 부르는 말은 영어 그대로 쓴다(2026-09-24, *"개발자가 쓰는 용어를 쓰라고"*). `API Key`(수집 키·API 키 ✗) · `Docker Collector`·`OpenTelemetry Collector`(수집기·Agent ✗ — [ADR 0005](../../docs/adr/0005-docker-environment-and-collector-product-terminology.md). 둘 중 하나를 가리킬 때는 늘 앞말을 붙인다. 맨 `Collector`는 둘을 함께 가리킬 때만 쓴다, §9.17) · `attribute`(속성 ✗) · `Span`(스팬 ✗) · `Endpoint`(엔드포인트 ✗) · `Webhook`·`Bot Token`(웹훅·봇 토큰 ✗) · `URL`/`Host`(대상 ✗). 라벨·제목의 첫 영어 단어는 대문자(`Bot Token`), 문장 안의 일반명사는 소문자(`exporter`). **반대로, 영어로 옮겨도 어색한 OTel 개념어는 하는 일을 한국어로 말한다** — 원어도 번역어도 사용자에게 낯설기 때문이다: signal → `데이터`·`데이터 유형`(`Signals` 라벨은 `수집 데이터`), API tracing → `API 요청 수집`(메뉴명 `API 요청`과 같은 말), trace context propagation → `서비스 간 트레이스 연결`, distributed tracing → `분산 트레이싱`, 헤더·바디 instrumentation 주입 → `상세 수집`(`상세 수집 설정`·`상세 수집 적용 결과`). `계측`·`추적`·`신호`는 쓰지 않는다. 이미 한국어로 굳은 음차(로그·메트릭·트레이스·업타임)와 일반어(응답 시간·임계값·환경 변수·대상 목록)는 그대로 둔다. 외부 서비스 화면의 문구를 인용할 때(Discord의 `새 웹후크`)는 그 화면의 표기를 따른다.

16. **대문자 라벨·넓은 자간·가운뎃점 연쇄·UI 문구의 줄표·마침표 셋 금지** (§2.5) — Hallmark sloplint가 AI 생성 티로 잡는 조판 습관이다(2026-10-27, [ADR 0009](../../docs/adr/0009-hallmark-label-and-punctuation-rules.md)). `transition-all`도 금지다 — 바뀌는 속성을 `transition-colors`처럼 이름으로 고른다

17. **연결 문구를 화면마다 만들지 않기** (2026-11-22, 연결 진입점 정리) — 연결과 추가의 버튼·제목·결과 문구는 [`features/connections/connectCopy.ts`](src/features/connections/connectCopy.ts)에서만 만든다. 화면마다 이어 붙이면 같은 동작이 `로그 추가`·`로그 연결`·`데이터 추가`로 갈리고 조사도 틀린다(`트레이스을`).
    - **연결**은 밖에서 데이터가 들어오게 만드는 일이다(로그, API 요청, 메트릭, 인프라, Docker). **추가**는 EveryUp 안에서 설정만으로 만드는 대상이다(서버, 업타임 모니터, 알림 규칙). **설치**는 호스트에서 명령을 처음 실행하는 일, **적용**은 수집 설정을 바꾼 뒤 명령을 다시 실행하는 일, **발급**은 키를 만드는 일이다. 설치·적용·발급은 시작 버튼의 동사로 쓰지 않는다.
    - 시작 버튼 = 대화 상자 제목(`로그 연결`, `업타임 모니터 추가`). 키나 명령을 받는 대화 상자의 제출은 `연결`, 대상만 만드는 대화 상자의 제출은 `추가`, Docker 기능 연결의 제출은 `적용 명령 받기`다. 결과 제목은 `{대상}을/를 연결할 준비가 되었습니다`(기존 앱이면 `{앱}에 {대상}을/를 연결했습니다`), 완료 버튼은 `{대상} 보기`이고 그 데이터가 보이는 자리로 간다.
    - OTel traces의 연결 단위는 `API 요청`이다. 맨 `API`나 `API 트레이스`라고 쓰지 않는다. `트레이스`는 탭 이름으로만 쓴다(트레이스는 API 요청과 함께 들어온다).
    - Docker 수집 프로필의 `uptime` 기능은 `컨테이너 상태`다. 업타임은 응답 확인(업타임 모니터)만 뜻한다([ADR 0006](../../docs/adr/0006-uptime-shows-response-checks-not-container-liveness.md)).
    - 키는 모두 `API Key`다. 어디에 쓰는 키인지는 옆 문장이 말한다(`Collector API Key` ✗).
    - **Docker Collector 설치는 서버에서 시작한다** (2026-11-22, ADR 0012): `서버 추가`의 `연결 방식`(`나중에 연결`·`Docker Collector 설치`)에서 Docker를 고르면 서버를 만든 뒤 그 서버 화면에서 설치 창(`AddServiceModal server=`)이 이어 열린다(`state.installDocker`). Docker Collector가 없는 서버는 개요의 `연결할 수 있는 기능` 끝(빈 상태에서는 버튼 줄 끝)에 `Docker Collector 설치`가 있다. 설치 창은 이름을 묻지 않고 그 서버에 설치한다(새 서버를 만들지 않는다, `POST /agents serverId`).
    - **서버당 호스트 지표 출처는 하나다** (2026-11-22, ADR 0012, 소유자 결정 4): Docker Collector와 OpenTelemetry Collector가 같은 호스트를 함께 모으게 되는 모든 흐름이 경고만 하지 않고 하나를 고르게 한다(`InfraSourceChoice`, 백엔드 409 `INFRASTRUCTURE_SOURCE_REQUIRED`). 합치기, OpenTelemetry Collector 인프라가 있는 서버에 Docker Collector 설치(호스트 지표를 모으는 수집 범위일 때), 이 서버의 Docker Collector가 이미 모으는데 `인프라 연결`(Docker Collector 유지면 아무것도 만들지 않고 닫는다), OpenTelemetry Collector가 있는 서버의 Docker Collector에 인프라 더하기(`Docker Collector로 바꾸고 적용 명령 받기`, 그대로 두려면 닫는다). Docker Collector를 남기면 OpenTelemetry 리소스는 연결을 중지하고(기록은 남는다), OpenTelemetry Collector를 남기면 Docker 프로필에서 인프라를 뺀다.
    - **연결은 데이터가 보일 자리에서 시작한다**: 서버의 기능 탭(빈 상태의 연결 안내와 탭 줄의 버튼), 앱 페이지의 `연결 전` 탭, Docker Collector가 있는 서버 개요의 설정 가이드. 한 단계 위 화면(서버 개요, 앱 연결 줄)은 그 자리로 옮기면서 같은 대화 상자를 열기만 한다. 다른 곳에 새 시작점을 만들지 않는다.
    - **모든 연결 대화 상자는 본문 첫 줄에 적용 범위를 쓴다** (`ApplyScope`, `APPLY_SCOPE`): 무엇에 적용되는지(앱 하나, 서버, 서버의 Docker Collector 전체), 서버나 앱에서 할 일(설치·적용 명령, 앱 재시작)을 연결하기 전에 비교할 수 있게 한다. 가운뎃점으로 잇지 않고 문장으로 쓴다(§9.16).
    - 직접 연결·인프라 대화 상자는 Docker Collector로 연결하라고 안내한다(`DockerHostNote`). 2026-11-22(ADR 0012)부터 같은 서버 안의 일로 말한다. 이 서버에 Docker Collector가 있으면 `이 서버에는 Docker Collector가 있습니다. 컨테이너로 도는 앱은 그것으로 연결하세요.`(인프라는 Collector가 호스트 지표를 모으는지에 따라 두 번 수집하지 말라거나 설정 가이드에서 더하라고 한다)이고, 이름이 같은 다른 서버에 있으면 그 서버로 가는 링크와 함께 두 서버를 합치라고 한다.
    - Docker Collector의 상태는 `environmentState` 하나로 정한다(Collector가 한 번도 보고하지 않았으면 `설치 대기`, 그 뒤는 `수집 중`·`지연`). 목록·머리말·설정 가이드가 같은 말을 한다.
    - 직접 연결로 만든 대상은 `앱`, Docker Collector가 발견한 대상은 `서비스`다. 둘을 함께 가리킬 때는 `대상`이다.

1~3, 12~13은 같은 취향의 계열이다: **색은 데이터와 액션에만, 컨테이너는 중립.**

---

## 10. 알려진 부채

`pnpm lint`(`scripts/check-design-rules.mjs`)가 금지 규칙을 0건으로, 부채 규칙을 래칫(현재 건수가 상한)으로 센다. 해결한 항목의 기록은 git 이력에 있다(2026-11-29 G안 재작성 전의 이 절).

- **차트 패널 크기**: G안 시안의 차트는 축을 줄인 120px 패널이지만 지금은 모든 차트가 `ChartCard`(220px, 요약·범례 포함)다. 차트를 가볍게 바꿀 때 한꺼번에 바꾼다(§4.2).
- **서버 단위 조작**: 시안의 `테스트 알림`·`장애 기록`·`일시 중지`(서버), `재시작`·`중지`(컨테이너)는 기능이 없어 두지 않았다.
- **시안 기간 `7일`**: 차트 API가 1시간·6시간·24시간만 받는다.
- **사이드바 서버 개수**: 서버 목록의 행 수와 같은 값을 사이드바가 따로 셀 방법이 없어 달지 않았다.
