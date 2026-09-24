# EveryUp 프론트엔드 디자인 시스템

React 19 · Tailwind v4 · Recharts 3. 이 문서가 **디자인 규약의 SSOT**다.
값의 실제 정의는 [`src/index.css`](src/index.css)(토큰)와 각 컴포넌트 파일에 있고, 이 문서는 **무엇을 언제 쓰는가**를 정한다.

관련 문서: [`../../CLAUDE.md`](../../CLAUDE.md)(엔지니어링 규약 — 디자인 내용은 없다) · [`src/components/charts/chartTheme.ts`](src/components/charts/chartTheme.ts)(차트 스펙 코드)

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

| 역할 | 클래스 | light | dark |
|------|--------|-------|------|
| 페이지 배경 | `bg-bg-main` | `#fbfcfe` | `#0d1117` |
| 카드 표면 | `bg-bg-surface` | `#ffffff` | `#161b22` |
| 헤어라인 | `border-ui-border` | `#e2e8f0` | `#30363d` |
| 내부 구분선 | `border-ui-border-soft` | `#f1f5f9` | `#30363d` |
| hover 채움 | `bg-ui-hover` | `#f1f5f9` | `#1f2937` |
| 옅은 내부 채움 | `bg-ui-hover-soft` | `#f8fafc` | `#1f2937` |
| 눌린 표면 | `bg-ui-active` | `#e2e8f0` | `#374151` |
| **떠오른 표면** | `bg-ui-raised` | `#ffffff` | `#374151` |

`ui-active`와 `ui-raised`는 **다크값이 같지만 역할이 반대다.** `ui-active`(라이트 `#e2e8f0`)는 스켈레톤·칩·hover처럼 트랙보다 **눌려** 보여야 하는 자리, `ui-raised`(라이트 흰색)는 세그먼티드 컨트롤의 선택된 칸처럼 `ui-hover` 트랙 **위로 솟아** 보여야 하는 자리다. 라이트에서 흰색이어야 하므로 `bg-bg-surface`로 대체할 수 없다 — 다크값(`#161b22`)이 트랙(`#1f2937`)보다 어두워 방향이 뒤집힌다.

다크에서 `soft` 계열은 상위 토큰과 동일하다 — **다크 모드의 명도 계층은 2단(main/surface)뿐**이고, 이는 의도된 설계다.

### 1.3 텍스트 4단 위계

| 역할 | 클래스 | light | 대비 | dark |
|------|--------|-------|------|------|
| 제목·강조 | `text-text-base` | `#0f172a` | 17.85 | `#ffffff` |
| 본문 | `text-text-secondary` | `#334155` | 10.35 | `#cbd5e1` |
| 보조 | `text-text-muted` | `#475569` | 7.58 | `#94a3b8` |
| 메타·placeholder | `text-text-dim` | `#64748b` | 4.76 | `#8795a9` |

한 화면에서 4단을 전부 쓰지 않는다. 카드 하나에는 보통 **base + muted 2단**이면 충분하다.

대비 열은 **라이트의 흰 카드 배경 기준**이다. 다크 `dim`은 페이지 6.22:1, 카드 5.69:1, hover 4.82:1이다. 이전 값 `#6b7280`은 카드에서 3.58:1로 AA에 미달했다. 대비는 토큰 하나가 아니라 실제 배경과의 조합으로 확인한다. 더 옅은 등급을 추가하지 말 것.

**`dim`이 허용되는 배경은 `bg-main`·`bg-surface`·`ui-hover-soft`까지다.** 그보다 진한 채움 위에서는 AA에 미달한다 — 라이트 기준 `ui-hover` 4.34, `ui-active`/`ui-raised` 3.86. `ui-hover` 이상의 채움 위에는 `muted`(같은 자리에서 6.92)나 `secondary`를 쓴다. 다크도 `ui-active`/`ui-raised`(`#374151`)에서는 `dim` 3.39·`muted` 4.02로 둘 다 미달이라 `secondary`(6.94)가 유일한 선택지다.

**읽는 산문에 `dim`을 쓰지 않는다.** `dim`은 표에 적힌 대로 **메타·placeholder 전용**이다 — `최근 3건`, 타임스탬프, 차트 축 라벨, endpoint 값처럼 훑는 자리. 문장으로 읽어야 하는 설명문·경고문은 `muted`(7.58)다. 산문은 훑는 값보다 오래 눈이 머물기 때문에 하한선인 4.76에 두면 흐리게 읽힌다.

### 1.4 브랜드 · 상태

**primary** `#3b76c9` (dark `#3F6FDB`) — 주 액션, 링크, 선택 상태, 차트 첫 시리즈

**primary-hover** `#3268b3` (dark `#355fc0`) — primary 채움의 hover. 흰 글자가 얹히므로 **더 진하게** 간다(라이트 5.58 / 다크 5.92). 이전 `hover:bg-primary/90`은 배경과 섞여 밝아지면서 4.54 → 3.80으로 AA 아래로 떨어졌다. 채움 버튼의 hover·누름은 어두워지는 쪽이 보편 규칙이다(Carbon·Primer·Polaris).

**action** `#1e5fb3` (dark `#7aa2f7`) — 채움 없는 액션(버튼 라벨·아이콘)의 색. primary를 그대로 텍스트로 쓰면 hover 배경(`ui-hover`) 위에서 라이트 4.15 / 다크 3.15로 AA 미달이라 명도만 옮긴 변주를 둔다. 표면·hover 배경 모두에서 라이트 5.7~6.3, 다크 5.8~6.9다. **채움에는 쓰지 않는다** — `bg-primary`는 그대로 primary다.

**상태색도 시맨틱 토큰이다.** `emerald-600 dark:emerald-400` 같은 primitive 직접 사용 금지 — 토큰이 `.dark`에서 자가 전환하므로 `dark:` 짝이 필요 없다.

| 상태 | 클래스 | light | dark |
|------|--------|-------|------|
| healthy · online | `text-status-healthy` | `#047857` emerald-700 | `#5eead4` teal-300 |
| warning | `text-status-warn` | `#92400e` amber-800 | `#fbbf24` amber-400 |
| error · critical · degraded | `text-status-error` | `#b91c1c` red-700 | `#f87171` red-400 |
| offline · paused · unknown | `text-status-idle` | `#475569` slate-600 | `#94a3b8` slate-400 |

두 가지가 통념과 다르니 근거를 남긴다.

- **라이트가 700~800단계다.** 600단계는 배지가 자기 `/10` 틴트 위에서 healthy 3.43 / warn 2.95 / error 4.23으로 AA(4.5) 미달이었다. 11px bold는 WCAG large text(18.66px bold)가 아니라 4.5:1이 적용된다.
- **다크 healthy만 emerald가 아니라 teal이다.** emerald-400과 red-400은 적록색각이상에서 각각 `#b2b29d`·`#aeae6a`로 **둘 다 흙빛에 수렴**해 거리 20.1까지 붙었다. 모니터링 도구에서 정상/장애를 구분 못 하는 건 기능 실패라 teal-300으로 밀어 45.5까지 벌렸다.

`info` 역할은 아직 소비처가 없어 토큰을 만들지 않았다 — Tailwind v4는 미사용 `@theme` 변수를 트리셰이킹하므로 죽은 토큰이 된다. 첫 소비처가 생길 때 추가한다.

### 1.5 로그 레벨 — 상태색과 별개 축

[`logLevelStyle.ts`](src/features/healthcheck/logLevelStyle.ts)의 `LEVEL_BASE`·`LEVEL_TEXT`(로그 행) / `LEVEL_CHIP`(필터 칩 선택 상태), `AgentServiceLogsTab`의 `LEVEL_BAR`(히스토그램)가 SSOT.

| 레벨 | 색 | 바 hex | 행 토큰 라이트 텍스트 |
|------|-----|--------|------------------|
| error | red | `#dc2626` | `text-red-700` |
| warn | amber | `#d97706` | `text-amber-700` |
| info | **sky** | `#0284c7` | `text-sky-700` |
| debug | violet | `#7c3aed` | `text-violet-700` |
| trace | slate | `#64748b` | `text-text-muted` |

info가 sky인 이유: primary(#3b76c9)와 붙어 있으면 "선택된 항목"으로 오독된다.

**로그 행의 레벨은 채움 없는 mono 텍스트다** (`LEVEL_BASE` = `inline-block shrink-0 w-12 font-mono text-xs font-medium uppercase`). 2026-09-20까지는 `bg-red-100` 계열 불투명 파스텔 틴트를 깐 배지였는데, 사용자 피드백은 *"색상이 너무 AI스럽다"*였다. 두 가지가 겹쳐 있었다:

1. **`-100` 틴트는 부트스트랩 alert 팔레트 그대로다.** §9.3이 다른 자리에서는 이미 금지하던 패턴인데 배지만 예외였고, 로그 표는 행마다 색 블록이 찍혀 그 예외가 가장 크게 드러나는 자리였다.
2. **기계 토큰에 가변폭 sans를 썼다.** 같은 표의 메시지 컬럼이 `font-mono`인데 레벨만 Spoqa였다(시간 컬럼은 2026-09-23부터 Spoqa — §2.1). `ERROR`/`WARN`/`INFO`는 글자폭이 제각각이라 컬럼이 들쭉날쭉했고, **틴트가 그 들쭉날쭉함을 덮는 역할도 하고 있었다.** mono 고정폭 + `w-12`로 컬럼 모양을 잡으면 채움이 필요 없어진다.

틴트를 빼서 대비가 같이 올랐다 — 실측 라이트 error 6.42 / warn 5.03 / info 5.86 (행 hover 위에서도 4.81 이상), 다크 error 5.99 / warn 10.04 / info 7.94.

**필터 칩의 선택 상태(`LEVEL_CHIP`)는 틴트를 유지한다.** 거기 채움은 장식이 아니라 토글이 켜졌음을 말한다 — 읽기 전용 토큰과 달리 선택/비선택을 구분할 수단이 필요하다. 같은 색을 쓰지만 역할이 다르므로 상수를 나눠 뒀다.

바 색이 600단계인 이유: 500단계는 흰 배경에서 warn 2.15 / info 2.77 / trace 2.56으로 WCAG 1.4.11(3:1) 미달이었다. 배지 텍스트가 700단계인 이유: 600은 자기 `-100` 배경 위에서 red 3.95 / sky 3.57로 AA 미달이었다.

### 1.6 차트 시리즈 팔레트

`chartTheme.ts`의 `SERIES_HEX` + `getSeriesPalette(theme)`. **첫 슬롯은 항상 브랜드 primary.**

```
primary #3b76c9 → emerald #059669 → amber #d97706 → violet #7c3aed → red #dc2626 → teal #0d9488
```

시리즈 색 하드코딩 금지. mock 데이터도 `SERIES_HEX`를 import한다.

**600단계인 이유** — 500단계일 때 라이트 배경에서 emerald 2.54 / teal 2.49 / amber 2.15로 WCAG 1.4.11(3:1)에 미달했다. 팔레트가 Grafana를 참고하면서 다크 배경만 보고 튜닝된 결과였다. 600으로 내려 양쪽 테마 모두 3:1을 넘긴다.

**⚠ 4개를 넘는 시리즈는 색만으로 구분되지 않는다.** 적록색각이상에서 앞 3슬롯(primary/emerald/amber)은 안전하지만 4슬롯째부터는 어떤 순서로 배열해도 충돌한다(primary/violet 16.0, emerald/teal 11.8, amber/red 12.8). 6색이 (a)색각 구분 (b)라이트 3:1 (c)다크 3:1을 동시에 만족하는 조합은 존재하지 않는다 — Okabe-Ito 정통 8색조차 라이트에서 orange 2.25, skyblue 2.31로 떨어진다. 시리즈가 4개를 넘으면 **선 스타일을 병행**한다 — `getSeriesDash(i)`가 4슬롯째부터 `strokeDasharray`를 돌려준다(앞 3슬롯은 `undefined`라 실선 유지). 시리즈 개수가 데이터에 달린 차트에서 쓴다:

```tsx
<Line {...lineProps(colors[i % colors.length])} strokeDasharray={getSeriesDash(i)} />
```

시리즈가 1~3개로 고정된 차트는 넣지 않아도 된다 — 어차피 `undefined`를 받으므로 모습이 같다.

### 1.7 하드코딩이 허용되는 유일한 경우

`ChannelForm`의 텔레그램/디스코드/슬랙 **미리보기 UI**. 서드파티 브랜드 색(`#26A5E4`, `#5865F2`, `#E01E5A`, `#313338` …)을 재현하는 목적이므로 토큰화 대상이 아니다. 그 외 hex 리터럴은 전부 부채다.

---

## 2. 타이포그래피

### 2.1 폰트

- **본문** Spoqa Han Sans Neo (self-hosted, `spoqa-han-sans` 패키지) → `--font-sans`. body와 `font-sans` 유틸리티가 같은 토큰을 본다 — 토큰 없이 두면 `font-sans`가 Tailwind 기본 스택으로 떨어져 한글이 Spoqa를 못 만난다
- **정적 폰트다.** 굵기는 100/300/400/500/700 다섯 개뿐이고 가변 축이 없다 — 중간 굵기를 만들 수 없다
- **본문과 숫자는 Spoqa, 코드·로그만 JetBrains Mono다** (2026-09-23). **숫자·시간·개수도 Spoqa다** — Spoqa는 숫자 글리프가 원래 고정폭이다(실측 20px에서 `0000`·`1111`·`8888` 모두 47.69px). KPI·표·차트 범례·타임스탬프에 mono를 쓸 이유가 없다. 자리 이동이 없어야 하는 곳은 의도를 드러내려 `tabular-nums`를 그대로 건다
- **`font-mono`는 기계 문자열에만** — 코드·설정 블록(`<pre>`, YAML·명령어), 로그 메시지 본문·스택 트레이스, API Key·trace ID·span 이름, URL·경로·HTTP method+path, 이미지명·메트릭명, `key=value` 속성 칩, 로그 레벨 토큰(§1.5). 기준은 **"들여쓰기·줄 맞춤이 의미이거나, `l`/`I`/`1`·`O`/`0`을 가려 읽어야 하는가"**다. 폰트는 JetBrains Mono Variable(latin subset, self-hosted)이다 — 로그·트레이스처럼 오래 읽는 화면이 OS와 무관하게 같은 모양이어야 해서 OS 고정폭 대신 웹폰트를 쓴다. 브라우저는 `font-mono` 글자가 화면에 있을 때만 파일을 받으므로 숫자를 뺀 뒤로는 개요·목록에서 내려받지 않는다. `<kbd>`·`<code>`·`<pre>`는 브라우저 기본값이 mono라는 점에 주의 — 단축키 표시(`Ctrl K`)는 UI 라벨이므로 `font-sans`를 건다(사이드바 `<kbd>` 하나 때문에 모든 페이지가 이 폰트를 받고 있었다). 한글 글리프가 없어 폴백 2순위가 Spoqa다 — 한글이 섞인 줄은 폭이 정확히 맞지 않는다(한글 줄 맞춤이 필요해지면 D2Coding 서브셋을 검토)
- **mono는 값에만 건다 — 라벨·분류명·제품명은 본문 폰트다.** `Docker 환경`·`Collector`·`OpenTelemetry Collector`·`Bot Token`·`TELEGRAM`처럼 우리가 UI에 써 넣은 말은 mono가 아니다. 컨테이너(`<table>`, 메타 줄)에 `font-mono`를 걸면 라벨까지 같이 딸려오니, 해당 값 셀에 직접 건다. 값 하나를 여러 성격이 공유하는 prop(`detail={{label, value}}`)은 특히 주의 — 한쪽이 코드면 다른 쪽은 아닐 확률이 높다

### 2.2 역할별 타이포그래피

크기·행간·굵기는 `index.css`의 역할 유틸리티를 쓴다. 색·여백·정렬은 호출부가 정한다.

| 역할 | 클래스 | 크기 / 행간 | 굵기 |
|---|---|---|---|
| 페이지 제목 | `type-page-title` | 24 / 32px | 700 |
| 카드 밖 섹션 제목 | `type-section-title` | 20 / 28px | 500 |
| 카드·차트·모달 제목 | `type-card-title` | 16 / 24px | 500 |
| 본문·설명·도움말 | `type-body` | 14 / 21px | 400 |
| 버튼·폼 라벨·조밀한 항목 제목 | `type-label` | 14 / 20px | 500 |
| 메타·시간·짧은 보조 값 | `type-caption` | 12 / 16px | 400 |

페이지 헤더는 [PageHeader](src/components/common/PageHeader.tsx)를 쓴다. 모바일 전용 화면의 h1은 기존 `text-xl font-bold`(20px)을 허용한다. KPI 수치는 24~30px, `tabular-nums`를 사용한다(본문 폰트 — §2.1). 404 같은 디스플레이 숫자는 별도 크기를 허용한다.

크기 토큰은 `text-xs`(12), `text-sm`(14), `text-base`(16), `text-lg`(18), `text-xl`(20), `text-2xl`(24), `text-3xl`(30)이다. `text-[Npx]`로 임의 크기를 추가하지 않는다. 역할 유틸리티 위에 다른 크기·굵기·행간을 중복 지정하지 않는다.

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

---

## 3. 레이아웃

### 3.1 카드 (정본)

```
bg-bg-surface border border-ui-border rounded-xl
```

내부 패딩은 `p-4`(조밀) 또는 `p-6`(여유). 카드 안 서브블록은 `bg-ui-hover-soft border border-ui-border rounded-md` — **부모와 같은 `rounded-xl`을 쓰지 않는다**(§3.2 동심 규칙).

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

`MainLayout` 본문 래퍼: `p-4 sm:px-6 sm:py-5 space-y-5 max-w-320 mx-auto` — 최대 폭 **1280px** 중앙 정렬. `Header`와 같은 값을 쓴다. 이전의 풀블리드(max-width 없음)는 폐기했다 — 1920px 화면에서 3열 카드 한 장이 500px를 넘어가면서 내용은 그대로인데 화면만 비어 보였다. 카드 간 간격은 래퍼의 `space-y-5`가 담당하므로 개별 카드에 `mb-*`를 붙이지 않는다.

설정 화면은 최대 폭 `max-w-4xl`의 단일 컬럼이다. 카드 안에서는 라벨 아래에 14px 설명을 놓고, 컨트롤은 오른쪽에 배치한다. 모바일에서는 컨트롤을 설명 아래로 내려 읽는 순서를 유지한다. 항목이 하나뿐인 보조 내비게이션은 만들지 않는다.

### 3.4 내비게이션 셸

- `lg` 이상: 좌측 `Sidebar`(로고 → nav → Docker Collector 상태 푸터) + 상단 `AppHeader`(위치 표시). `Header`는 `lg:hidden`으로 모바일 전용
- `lg` 미만: `Header` + `BottomNavMobile`. 하단바 겹침은 `pb-safe-bottom` 유틸리티가 처리
- 뒤로가기 버튼은 **데스크톱에 두지 않는다** — 사이드바가 상시 내비이고, `AppHeader`의 첫 크럼이 목록 링크다
- **사이드바 활성 항목은 브레드크럼의 첫 크럼과 같다** — 담김 관계를 따른다. 서비스 상세(`/services/…`)는 어떤 탭을 보고 있든 `Docker 환경`이 활성이다. 탭은 위치가 아니다(아래 "탭은 크럼이 아니다")

#### `AppHeader` — 현재 위치 (데스크톱 전용, 2026-09-20)

```
업타임  ›  Storefront
Docker 환경  ›  prod-server  ›  payment-worker
```

높이 **`h-16`(64px)** — `Sidebar` 로고 블록과 같은 값이라 크롬 상단이 사이드바 경계 너머로 한 줄로 이어진다. 배경은 `bg-bg-surface`, 아래 `border-ui-border` 한 줄. 내용 폭은 본문 래퍼와 같은 `max-w-320 mx-auto px-4 sm:px-6`에 맞춘다.

**첫 크럼(섹션)은 경로에서 자동으로 나온다** — [`navSections.ts`](src/components/layout/navSections.ts)의 prefix 표, 가장 긴 것이 이긴다. 목록 페이지는 아무 코드도 추가하지 않아도 된다.

**상세 페이지는 그 뒤쪽만 선언한다** — [`useBreadcrumb`](src/contexts/BreadcrumbContext.tsx). 훅은 조건부로 호출할 수 없으므로 데이터 로딩 전에는 배열을 비운다:

```tsx
useBreadcrumb(monitor ? [{ label: monitor.name }] : []);
```

**"목록으로" 버튼을 따로 두지 않는다.** 첫 크럼이 목록 링크라 목적지가 같다. 모바일은 `AppHeader`가 없으므로 기존 `← 목록으로` 버튼을 `lg:hidden`으로 유지한다.

**탭은 크럼이 아니다.** 서비스 상세의 `?tab=logs` 같은 하위 뷰는 위치가 아니라 같은 위치의 다른 단면이므로 trail에 넣지 않는다.

페이지 h1은 그대로 둔다 — 헤더는 "어디에 있나", 본문 h1은 "이 페이지가 무엇인가"로 역할이 갈리고, h1은 부제·CTA를 함께 이고 있다.

전체 화면 높이를 계산하는 페이지는 **`lg`에서 빼는 값이 다르다** — 모바일 `Header` 3.5rem 대신 `AppHeader` 4rem이 추가로 붙어 `lg:h-[calc(100dvh-8rem)]`이다. 모바일은 높이를 계산하지 않고 자연 높이로 두며, 하단 제출 바를 `sticky`로 하단 내비(4rem + safe-area) 위에 붙인다 — 데모 배너처럼 위쪽 크롬이 늘면 높이 계산이 틀려 제출 바가 `BottomNavMobile` 뒤로 숨었다 (`ChannelFormPage`).

**헤더는 본문과 같은 스크롤바 거터를 예약해야 좌변이 맞는다.** 본문 스크롤 컨테이너가 `[scrollbar-gutter:stable]`로 15px(플랫폼마다 다름)을 예약하는데 `AppHeader`는 그 바깥이다. 안쪽 `max-w-320` 박스를 `mx-auto`로 가운데 두면 그 15px이 양쪽 7.5px씩 갈려 **헤더 크럼이 본문 제목보다 7.5px 오른쪽**으로 밀린다. 그래서 헤더에도 `overflow-y-hidden [scrollbar-gutter:stable]`을 건다 — 장식이 아니라 정렬 장치다. 오버레이 스크롤바 환경(macOS 기본)에서는 양쪽 다 0을 예약하므로 자동으로 맞는다. 헤더에 드롭다운처럼 넘치는 요소를 넣으려면 이 클립을 먼저 풀고 거터를 다른 방법으로 맞춰야 한다.

**풀블리드로 빠져나가는 페이지의 음수 마진은 본문 래퍼 패딩과 정확히 같아야 한다.** 래퍼는 `p-4 sm:px-6 sm:py-5`이므로 탈출값은 `-m-4 sm:-mx-6 sm:-my-5`다. `ChannelFormPage`가 쓰던 `md:-m-8`은 존재하지 않는 32px 패딩을 가정해 8px 더 당겼고, 헤더가 기준선을 주기 전까지 드러나지 않았다.

### 3.5 그림자

`shadow-sm`(선택된 세그먼트) / `shadow-lg`(오버레이·툴팁)만. 카드에는 그림자를 쓰지 않는다 — 경계는 보더가 담당한다.

### 3.6 클릭 가능한 카드 hover

`.card-interactive` **하나만** 쓴다 (`index.css` 정의). 2px 들어올림 + 보더 `primary/40` + 배경 `ui-hover-soft`, 150ms. 터치 기기 제외(`hover: hover`), `:active`에서 원위치, 모션 최소화 설정에서는 들어올림 생략.

카드마다 `hover:-translate-y-*`·`hover:shadow-md`·`transition-all`을 직접 조합하지 않는다 — 메뉴별로 hover가 제각각이 된 원인이었다. 클릭 가능한 **행**(테이블·로그)은 카드가 아니므로 `hover:bg-ui-hover-soft` 채움만 쓴다.

---

## 4. 컴포넌트 카탈로그

### 4.1 `components/common/` — 공용 프리미티브

| 컴포넌트 | props | 규약 |
|----------|-------|------|
| **`Button`** | `variant` `size` + 네이티브 button | 라벨 있는 액션 버튼의 **유일한** 진입점 |
| **`Input`** | `invalid?` `warn?` `mono?` | 폼 입력 (§6) |
| **`Textarea`** | `invalid?` `mono?` + 네이티브 textarea | 여러 줄 입력. `Input`과 같은 셸 (§6) |
| **`Select`** | 네이티브 `option` children + 기존 select props | 앱 스타일 listbox (§6) |
| **`SearchInput`** | `wrapperClassName?` | 아이콘 붙은 검색창 (§6) |
| **`StatusLight`** | `tone` `label` `pulse?` | 대상 상태의 정본 — 점 + 라벨 (§5.1) |
| **`StatusBadge`** | `healthy: boolean` | 정상/장애 `StatusLight` 래퍼 (§5.1) |
| **`CollectionStatusBadge`** | `collecting` \| `partial` \| `delayed` \| `waiting` \| `not-configured` | 수집 신선도·설정 상태. 서비스 상태와 별도 축 (§5.1) |
| **`Toggle`** | `checked` `onChange` `disabled` `title` | w-9 h-5, `role="switch"` |
| **`SegmentedControl<T>`** | `options` `value` `onChange` `size` `ariaLabel` | 2~4지 배타 선택 |
| **`TimeRangePicker`** | `value: GlobalTimeRange` `onChange` | `1h`\|`6h`\|`24h`. SegmentedControl 래퍼 |
| **`ConfirmDialog`** | `isOpen` `title` `message` `variant` `icon` … | `window.confirm()` 금지 — 항상 이것 |
| **`EmptyState`** | `icon` `title` `description?` `action?` `children?` | 빈 목록의 정본. 라벨+핸들러면 `action`, 자체 상태를 가진 트리거(연결 다이얼로그 등)는 children |
| **`PageHeader`** | `title` `subtitle?` `meta?` `children` | h1 등급 고정. `meta`는 대상 메타데이터 — 상세는 `DetailMeta` |
| **`DetailMeta`** | `status` `fields?` | 상세 헤더 `meta`의 정본. 상태 줄 + 속성 목록(라벨 좌 / 값 우, `sm` 이상 2열) |
| **`ListToolbar`** | `search` `children?` | 목록 검색은 왼쪽, 필터는 그다음 |
| **`ResourceCardHeader`** | `title` `badge?` `subtitle?` `status?` | 대상 이름·출처·상태의 고정 배치 (종류 아이콘 없음) |
| **`SummaryCard`** | `label` `value` `detail` `tone?` | KPI 카드. 라벨 좌 / 숫자 우 1행 + 설명 1행 |
| **`DetailActionToolbar`** | `controls` `actions` | 상세의 조회 제어(좌)·변경 액션(우). 모든 상세 화면의 정본 (§4.1 액션 앵커) |
| **`Pagination`** | `page` `totalPages` `onChange` … | 목록 페이지 이동 |
| **`MaterialIcon`** | `name` `size` `className` `style` | 로컬 정적 SVG |
| **`IconButton`** | `icon` `label` `tone?` `size?` `iconClassName?` | 라벨 없는 아이콘 액션. `tone`은 `action`(기본)·`danger`·`quiet`. className을 받는 자리(CopyButton)는 같은 파일의 `ICON_ACTION`/`ICON_ACTION_SM` |
| **`CopyButton`** | `onCopy` `title` `className` … | 3초 완료 피드백. 클래스는 같은 파일이 export하는 `COPY_ACTION_PRIMARY`/`COPY_ACTION_SUBTLE`을 쓴다 |

**Button 스펙**

| variant | 용도 | 클래스 |
|---------|------|--------|
| `primary` | 주 액션 (화면당 1개) | `bg-primary text-white hover:bg-primary-hover` |
| `secondary` | 보더 있는 보조 액션 | `border border-ui-border text-text-base` + 아이콘 `action` |
| `ghost` | 배경 없는 3순위 | `text-action hover:bg-action/10` |
| `destructive` | 삭제·비활성화 — secondary와 **같은 모양**에 글자만 빨강 | `border border-ui-border text-status-error hover:bg-status-error/10` |
| `quiet` | 정보만 보여주는 다이얼로그의 `닫기` — 눈에 띄지 않아야 하는 이탈 | `text-text-muted hover:bg-ui-hover` |
| `danger` | 확인 다이얼로그의 파괴 확정 | `bg-red-600 text-white` |

**액션에는 색을 싣는다 (§5.3).** 채움도 보더도 없는 버튼이 본문과 같은 회색이면 hover 전까지 버튼으로 읽히지 않는다 — *"기본값으로 색상이 달라야 한다."* 그래서 `ghost`는 라벨·아이콘 전부 `action`, `secondary`는 라벨을 `text-base`로 올리고 아이콘만 `action`을 싣는다(보더가 이미 버튼임을 말하므로 라벨까지 칠할 이유가 없다). **예외는 이탈 액션뿐이다** — 닫기를 색으로 강조하면 정작 그 화면의 주 액션보다 먼저 눈에 들어온다. `quiet`가 그 자리다. 폼 푸터의 `취소`는 주 액션과 짝을 이루므로 `secondary`다(§7 푸터 규칙).

**버튼 색을 `className`으로 덮어쓰지 않는다.** `variant="ghost" className="text-status-error"`로 쓰던 삭제 버튼 5곳이 전부 회색으로 렌더되고 있었다 — Tailwind가 같은 속성의 유틸리티를 **알파벳 순**으로 내보내기 때문에 `text-status-error`가 `text-text-muted`보다 앞서 나가 매번 졌다. 색은 variant로 고른다.

| size | 높이 | 용도 |
|------|------|------|
| `sm` | `h-8` (32) | 테이블 행, 조밀한 툴바, 인라인 액션 |
| `md` | `h-11 sm:h-10` (터치 44 / 그 외 40) | **기본** — 입력·검색창과 같은 높이 |

**`md`는 `sm`(640px) 미만에서 44px다.** Apple 44pt·Material 48dp의 터치 영역 권장을 따른다. 입력(`FIELD_HEIGHT`)·`SearchInput`·`IconButton md`·`SegmentedControl md`가 같은 규칙이라 모바일에서도 나란히 놓인 밑변이 맞는다. `lg`(44px 고정)는 로그인 1곳에서만 쓰이다가 이 규칙에 흡수돼 제거했다.

`SegmentedControl`은 트랙을 포함해 `sm` 32px, `md` 40px(터치 44)다. 기본 검색·폼 입력·버튼은 모두 같은 높이로 맞춘다.

**상태**
- **진행 중** — `loading` prop. 라벨은 그대로 두고 스피너가 앞에 붙는다(호출부의 아이콘은 숨김), `aria-busy`, 클릭 불가. `저장 중…`처럼 라벨을 바꾸지 않는다 — 버튼 폭이 흔들리고 화면마다 문구가 갈렸다.
- **비활성** — `disabled`. 단 **이유를 보여 줘야 하면 `aria-disabled`** 를 쓰고 핸들러에서 막는다. `disabled`는 hover·포커스를 막아 title 툴팁이 뜨지 않고 스크린리더도 건너뛴다(시스템 알림 규칙 삭제 버튼의 "시스템 규칙은 삭제할 수 없습니다"가 한 번도 보인 적이 없었다).
- **누름** — 색 변화만. `active:scale-95` 같은 축소 애니메이션은 쓰지 않는다(주요 디자인 시스템 공통, `transition-colors`로 충분).

**이동은 링크다.** 다른 화면으로 가는 버튼은 `<ButtonLink to>`(같은 모양의 `<a href>`)를 쓴다. `<Button onClick={() => navigate(…)}>`은 새 탭 열기·주소 미리보기가 안 되고 스크린리더가 "링크"로 읽지 않는다. `EmptyState`의 `action`도 `{ label, to }`를 받는다. 같은 화면 안에서 상태만 바꾸는 것(탭 전환 등)은 버튼이다.

크기는 **높이로 고정**한다. `px/py` 조합으로 높이를 만들지 않는다 — 나란히 놓았을 때 밑변이 어긋난다.
`p-2 rounded-lg` + 아이콘 하나짜리 **아이콘 전용 토글 버튼은 이 컴포넌트 대상이 아니다**.

**액션 앵커**

- 페이지의 주 액션은 `PageHeader`의 `children`에 둔다. `md` 이상에서는 **설명과 같은 행의 우측 끝**, 그 미만에서는 설명 아래가 고정 위치다. 제목은 자기 행을 독차지한다 — 제목 행에 버튼을 같이 두면 세 글자짜리 제목과 버튼 사이가 1000px 넘게 비어 서로 무관한 요소로 읽혔다.
- 액션은 **보조 → 주 액션** 순서로 전달해 주 액션을 우측 끝에 둔다. 헤더 내부에 별도 flex 래퍼를 만들지 않는다. 40px 버튼의 중심을 설명 행의 중심에 맞춘다(`md:items-center`). `sm` 미만에서는 버튼을 전체 폭으로 쌓고, 그 이상에서는 같은 순서로 줄바꿈한다. 버튼 아이콘은 20px, 버튼 간격은 8px, 헤더 아래 간격은 24px다.
- **버튼 라벨은 명사형이다** — `추가`·`저장`·`삭제`·`수정`·`취소`·`닫기`. 대상을 새로 만드는 액션의 라벨은 **`추가` 하나다.** 편집 제출은 `저장`. `생성`·`규칙 생성`처럼 동사를 바꾸지 않고, `추가하기`처럼 어미를 붙이지 않는다(2026-09-24 — 같은 푸터에 `[취소][추가하기]`와 `[취소][저장]`이 섞여 있었다). 진행 중에도 라벨은 바꾸지 않는다(`loading`). 페이지 헤더 CTA, 빈 상태의 액션, 다이얼로그 제출 버튼 전부 같은 문구를 쓴다. `업타임 추가`·`Logs 직접 추가`·`Collector 추가`처럼 대상을 앞에 붙이지 않는다 — 대상은 페이지 제목이나 모달 제목이 이미 말하고, 명사를 각자 고르게 두면 한글·영어가 섞이고 화면마다 어긋난다. 라벨에 영어 리소스명(`Logs`·`Metrics`·`Collector`)을 넣지 않는다.
- **제목은 이 규칙 밖이다** — 다이얼로그·페이지 제목은 `업타임 추가`·`채널 추가`처럼 대상을 밝힌다. 라벨에서 명사를 뺄 수 있는 근거가 제목이므로, 제목까지 비우면 맥락이 사라진다.
- Docker·로그·API·메트릭·인프라의 연결 진입점은 `Docker 연결`·`로그 연결`·`API 연결`·`메트릭 연결`·`인프라 연결` 하나로 통합한다. 기존 대상 재사용과 새 대상 등록을 모두 포함하므로 위의 생성 전용 `추가` 규칙과 구분한다. 연결 화면 안에서 Docker와 직접 OpenTelemetry 경로를 선택한다.
- 헤더 블록은 `border-b border-ui-border pb-5`로 띠를 이룬다. 제목과 우측 CTA 사이가 1000px 넘게 벌어지는 넓은 화면에서, 이 선이 없으면 버튼이 헤더에 속하지 않고 구석에 떠 있는 요소로 읽혔다.
- 검색·필터는 페이지 헤더에 섞지 않고 그 아래의 보조 툴바에 둔다. 모바일에서는 툴바가 CTA보다 앞서지 않는다.
- 목록의 보조 툴바는 `ListToolbar`를 쓴다. 검색창은 왼쪽 320px(`sm` 미만 전체 폭), 필터는 오른쪽부터 이어지며 공간이 부족하면 다음 줄로 흐른다. 검색·필터·버튼 높이는 모두 40px다. 탭 안의 검색은 해당 탭의 목록 위에 둔다. 검색 기능이 없는 화면에 정렬만을 위한 빈 검색창을 만들지 않는다.
- **상세 화면의 헤더는 하나다 — `PageHeader`(제목·설명·`meta`) + `DetailActionToolbar`.** 제목 행에 버튼을 두지 않는 목록 규칙이 상세에도 그대로 적용된다. 대상의 상태(`StatusLight`)는 제목 옆이 아니라 `meta` 줄의 첫 항목이다. 2026-09-23까지 상세 9곳 중 5곳이 `h1`을 직접 쓰고 버튼을 제목 행에 붙여서, 새로고침이 좌측 라벨 버튼·우측 첫 아이콘·우측 끝 아이콘으로 화면마다 달랐고 삭제는 라벨 버튼과 라벨 없는 빨간 아이콘이 섞여 있었다.
  - **좌측 `controls` = 조회 제어**: 기간 선택 → `새로고침`. 새로고침은 라벨 있는 `secondary` 버튼이다(아이콘 전용 아님).
  - **우측 `actions` = 대상 자체에 대한 액션, 순서 고정**: 이동(`알림 규칙`) → 편집(`수정`·설정 다이얼로그) → 파괴(`삭제`·`비활성화`)가 **항상 맨 끝**. `수정 | 삭제`는 붙어 있는 짝이다.
  - **상태 전환은 툴바가 아니라 `meta` 줄의 상태 바로 옆**이다 — `● 정상 [일시정지]`, `● 수집 가능 [연결 중지]`. 대상을 고치거나 지우는 것과 운영 상태를 켜고 끄는 것은 성격이 달라서, 툴바에 섞어 두면 `수정 | 일시정지 | 삭제`처럼 짝이 끊겼다(2026-09-24). `API Key ••• [키 재발급]`처럼 **속성 옆에 그 속성을 바꾸는 액션**을 두는 meta 줄 규칙과 같은 원리다. 버튼은 meta 줄의 다른 액션처럼 `ghost` md, 상태 표시(`StatusLight`)와는 별개 요소다(§5.1 — 상태 표시는 읽기 전용).
  - **툴바 안 버튼은 모두 같은 모양이다** — 테두리 있는 `secondary`, 파괴만 `destructive`(같은 테두리에 빨간 글자), 전부 아이콘 + 라벨. 역할을 `secondary`/`ghost`/`destructive` 모양으로 가르면 한 줄에 놓였을 때 위계가 아니라 들쭉날쭉으로 읽혔다(2026-09-24, *"왜 뭐는 border를 넣고 뭐는 안 넣었어?"*). 위계는 순서와 색으로 말한다 — Primer·Polaris의 danger 버튼도 기본 버튼과 모양이 같다. 테두리 없는 `ghost`는 카드·문장 안의 인라인 액션 전용이다.
  - **좁은 화면(sm 미만)에서는 아이콘만** — 툴바 버튼에 `collapseLabel`을 건다. 라벨은 sr-only로 남아 접근 가능한 이름이 되고 title 툴팁으로도 나온다. 그래서 툴바의 모든 버튼에는 아이콘이 있어야 한다.
  - 상세의 액션은 **라벨 버튼**이다(sm 이상). 데스크톱에서 아이콘 전용 버튼을 나란히 두지 않는다 — 라벨 없는 아이콘 다섯 개(설치·API Key·상세 수집 설정·비활성화)는 hover 전까지 무엇인지 읽히지 않았다. 모바일의 아이콘만 표시는 공간 때문에 허용한 예외이고, title·sr-only 라벨로 보완한다.
  - 두 그룹은 양 끝에 둔다. 넘치면 줄이 바뀌어도 액션 그룹은 오른쪽에 붙는다.
- **대상의 속성은 본문이 아니라 헤더 띠 안에 둔다.** API Key·키 재발급·마지막 수집·Project 배정처럼 제목이 가리키는 대상을 설명하는 값은 `PageHeader`의 `meta`에 `DetailMeta`로 싣는다. **상태 줄**(`status`, `type-caption`)은 상태 → 수시로 바뀌는 값(마지막 수집·서비스 수) → 상태 전환 버튼 순이고, **속성 목록**(`fields`)은 라벨 좌(`type-body` `dim`, 96px 고정) / 값 우(`type-body` `base`) 행을 `sm` 이상 2열로 둔다. 값을 바꾸는 액션(`키 재발급`·Project `Select`)은 그 값의 행 안에 둔다. 2026-09-24까지는 모든 항목을 12px 한 줄에 흘려서 라벨·값·버튼이 한 문장처럼 읽혔고, 라벨 위/값 아래 그리드도 시안에서 검토했으나 시선이 칸마다 위아래로 오르내려 기각했다 — 속성 몇 개를 확인하는 자리는 좌→우로 읽히는 키-값 행이 맞다. **상세 헤더에는 `subtitle`을 두지 않는다** — `직접 연결한 OpenTelemetry traces 서비스입니다.` 같은 설명은 `허용 신호`·`어댑터` 행을 문장으로 한 번 더 말할 뿐이었다(2026-09-24). 대상의 종류는 `meta`가 말한다. **`fields` 라벨은 개발자가 쓰는 용어 그대로다** — `API Key`·`URL`/`Host`·`Protocol`·`Interval`·`Signals`·`Image`·`Uptime`·`Restarts`·`Version`. `수집 키`·`대상`·`허용 신호`·`어댑터`처럼 기술 용어를 한글로 풀어 쓰지 않는다(2026-09-24 — 모니터링 사용자는 개발자다). 한글이 더 정확한 곳만 한글(`연결 방식`)이고, 값이 늘 같은 행(`출처: 직접 설정`)은 두지 않는다. 직접 연결 상세 4종이 이 값들을 본문 최상단에 카드 두 장(`lg:col-span-2` + Project)으로 펼치고 있어서, 정작 그 페이지가 보여줘야 할 로그·차트가 첫 화면 밖으로 밀려났다 — 메타데이터는 읽는 대상이 아니라 확인하는 값이다. 메타 줄 안의 버튼·입력은 다른 줄과 마찬가지로 40px로 맞춘다.
- 아이콘 전용 액션은 `IconButton md`(`h-11 w-11 sm:h-10 sm:w-10`)다. `sm`(32px)은 테이블 행·다이얼로그 헤더·입력 안의 지우기처럼 조밀한 맥락에서만 쓴다.
- **인라인 액션**(문장 속 `필터 초기화`, 카드 안 `트레이스`·`로그 보기` 이동, `새 코드`)은 `Button variant="ghost" size="sm"`이다. 파란 밑줄 텍스트 링크 버튼이나 `primary/5` 틴트 칩(배경·보더·글자 3중)을 손으로 만들지 않는다. 외부 문서로 가는 진짜 `<a>`는 링크 모양을 유지한다.
- **행·카드 액션은 우측 끝**, 순서는 상태 토글 → 보조(`테스트` 등) → 수정 → 삭제다. 표 행은 `IconButton size="sm"`, 카드는 `ResourceCardHeader`의 `status` 슬롯(우측 상단)에 둔다.
- **다시 시도**: 화면 일부가 실패하면 그 자리의 중립 배너(`bg-bg-surface border-ui-border` + `status-warn` 아이콘) 안에 `Button variant="secondary" size="sm"`, 화면 전체가 실패하면 `EmptyState`의 `action`.

**아이콘 크기** — `MaterialIcon`은 `size`로 SVG 크기를 정한다. 기본이자 본문 크기는 20px다 — 인라인·버튼·내비게이션·섹션이 전부 같은 20px를 쓴다(2026-09-22, 16px 층 폐지). 24px는 주요 상태용이다. 스피너·빈 상태에는 32/36/48px를 허용한다. `text-*`는 색에만 사용하고 폰트 크기를 아이콘 크기로 사용하지 않는다. 아이콘 획은 SVG 도형이 결정하므로 `font-*`로 두께를 조절하지 않는다. 같은 영역에서는 같은 아이콘 계열을 사용한다. 삭제는 `delete_outline` 하나다(`delete` 채움형과 섞지 않는다). 제출 버튼 아이콘은 생성(`add`)에만 붙인다.

**MaterialIcon 함정** — `iconMarkup` 맵에 없는 `name`은 `help_outline`(`?`)로 폴백한다. 신규 아이콘은 반드시 [`materialIconPaths.ts`](src/components/common/materialIconPaths.ts)에 path를 추가한다.

**KPI 카드(`SummaryCard`)는 2행이다** — 라벨(좌)과 숫자(우)가 베이스라인을 맞춘 한 행, 그 아래 설명 한 행. 이전에는 라벨/숫자/설명이 3행으로 쌓이고 아이콘만 우측 상단에 혼자 떠 있어서, 카드 폭 ~300px 중 오른쪽 절반이 비고 내용은 좌측에 쏠렸다. 숫자를 오른쪽 끝으로 보내 그 여백을 쓴다. 숫자는 `tabular-nums`(Spoqa는 숫자가 원래 고정폭)라 카드마다 우측 정렬 위치가 같다.

**KPI 설명문의 색은 `warn`·`error`일 때만 싣는다.** `healthy`·`idle`은 `text-text-muted`다. 카드 4장이 전부 색 문장을 달고 있으면 정작 문제인 카드가 묻힌다 — §5.1 `StatusLight`와 같은 논리다. 이 규칙이 기존 오용도 함께 걷어냈다: 업타임 `정상` 카드의 `전체 5개 대상 중`(분모)과 개요 `Projects` 카드의 `대상을 운영 단위로 묶고 있습니다`(설명)가 `tone="healthy"`를 타고 초록으로 칠해지고 있었는데, 둘 다 상태가 아니다.

**대상 목록의 카드 헤더** — 업타임·API·로그·메트릭·인프라·Docker 환경·Project의 대상 카드는 `ResourceCardHeader`를 쓴다. 출처는 이름 옆, 상태 또는 대상별 작업은 우측이다.

**대상 카드에 종류 아이콘을 달지 않는다** (2026-09-20). 한 목록의 카드가 전부 같은 아이콘을 달고 있어서(업타임=`monitor_heart`, API=`api`, 로그=`article`, …) 카드끼리 구분되는 정보가 **0**이었다. 대상의 종류는 페이지 제목과 사이드바의 활성 항목이 이미 말한다. 직접 연결/Docker 연결 여부로 아이콘을 달리하는 것도 마찬가지다 — 그건 출처 라벨이 말한다.

아이콘이 의미를 지니는 자리는 남는다: 사이드바 내비, 알림 채널의 브랜드 아이콘, 상태 아이콘, `EmptyState`의 안내 아이콘. 이들은 **선택지마다 아이콘이 다르거나 하나뿐이라** 반복 장식이 아니다.

**카드의 좌측 기준선은 하나다.** 제목·부제·본문(endpoint·통계 그리드·푸터)이 전부 카드 패딩에 정렬한다. 아이콘을 없애면서 자동으로 성립하지만, 무엇이든 제목 줄에 거터를 도입하면 그 아래 본문과 좌변이 어긋난다는 규칙 자체는 유효하다 — `ResourceCardHeader`를 쓰는 8개 카드 전부가 그 증상이었다(2026-09-20 해소).

배치 판단 참고: [PatternFly Page header](https://www.patternfly.org/component-groups/content-containers/page-header/)의 제목 우측 액션, [Carbon Data table](https://carbondesignsystem.com/components/data-table/usage/)의 검색·필터 툴바. 이 프로젝트에서는 기존 페이지 CTA 앵커를 유지하고 목록 조회 제어를 별도 줄로 통일한다.

### 4.2 `components/charts/` — 차트 스펙

**팩토리를 스프레드해서 쓴다. 개별 차트에서 선 굵기·그리드·축을 다시 정의하지 않는다.**

```tsx
const theme = getChartTheme();
<CartesianGrid {...gridProps(theme)} />
<XAxis {...xAxisProps(theme)} />
<YAxis {...yAxisProps(theme)} />
<Area {...areaProps(color)} />
<Line {...lineProps(color)} />
```

| export | 역할 |
|--------|------|
| `getChartTheme()` | CSS var를 읽어 `{gridColor, tickColor, tooltipBg, tooltipBorder, primaryColor}` |
| `gridProps` `xAxisProps` `yAxisProps` `tooltipCursor` | 축·그리드 |
| `lineProps(color)` `areaProps(color)` | 시리즈 |
| `SERIES_HEX` `getSeriesPalette` | 색 |
| `chartCardClass` | 차트 카드 컨테이너 |
| `getYAxisMax` `formatAxisValue` `formatMetricValue` | 스케일·포맷 |
| `ChartTooltip` `ChartStatsLegend` `ChartLegend` | 툴팁·범례 |

**룩 (Grafana풍, 2026-07-10 확정)**
- 1.5px `monotoneX` 라인, 둥근 캡, dot 없음
- 라인 아래 **평면 10% 채움** — 그라디언트 아님
- 수평 실선 그리드만 (`vertical: false`, opacity 0.55)
- medium 12px 눈금, 축선·틱선 없음
- **애니메이션 없음** (`isAnimationActive: false`)
- activeDot = r4 + 흰 테두리 2px

**범례**
- 트렌드 차트 → `ChartStatsLegend` (시리즈별 Last/Min/Max/Avg 테이블)
- 바 차트 헤더 → `ChartLegend` (칩)
- recharts `<Legend>` **사용 금지**

### 4.3 `components/layout/`

`MainLayout`(셸) · `Sidebar`(lg+) · `Header`(모바일) · `BottomNavMobile` · `Footer` · `SidePanel`(컨텍스트 기반 우측 슬라이드) · `CommandPalette`(⌘K/Ctrl+K) · `DemoBanner`

### 4.4 기타

`components/error/`(ErrorBoundary·ErrorFallback) · `components/feedback/NetworkStatusBanner` · `components/skeleton/Skeleton` · `components/icons/`(ChannelIcons·SidebarIcons)

---

## 5. 상태 표현 문법

### 5.1 대상의 상태 — `StatusLight` (점 + 라벨)

```tsx
<StatusBadge healthy={service.healthy} />   {/* → StatusLight */}
<StatusLight tone="warn" label="수집 지연" />
```

```
inline-flex items-center gap-1.5  type-caption  text-text-secondary
└ 점: h-2 w-2 rounded-full bg-status-{tone}   (aria-hidden)
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

**남은 소비처는 둘뿐이고 전부 "표 컬럼에 반복되는 고정 어휘"다** — 알림 severity(`SeverityBadge`), span kind(`AgentServiceTracesTab`). 로그 레벨은 2026-09-20에 배지를 떠나 mono 텍스트 토큰이 됐다(§1.5). 여기서는 박스가 제 값을 한다: 좁은 컬럼에서 severity·span kind 값이 같은 폭의 덩어리로 보여야 세로 스캔이 된다. 대상 상태처럼 카드마다 하나씩 흩어지는 자리와 다르다.

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
h-2.5 w-2.5 rounded-full bg-status-{role}
```
목록 안의 조밀한 자리는 `h-1.5 w-1.5`. `StatusLight`의 점은 `h-2 w-2`다. 진행 중인 장애는 `animate-pulse`를 더한다(`prefers-reduced-motion`에서 전역 규칙이 정지시킨다) — `StatusLight`는 `pulse` prop으로 같은 동작을 낸다.

**점이 유일한 정보원이면 이름을 준다** — 점 옆에 같은 뜻의 텍스트(배지·라벨)가 없으면 색만으로 상태를 전달하는 것이라 WCAG 1.4.1 위반이다:
```tsx
<span role="img" aria-label={healthy ? '정상' : '장애'} className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
```
인접 텍스트가 이미 상태를 말하고 있으면(장애 배너, 온라인/오프라인 라벨) 점은 장식이므로 그대로 둔다.

### 5.3 색을 싣는 곳

**데이터와 액션에만 색을 싣는다. 컨테이너는 중립으로 둔다.**
배지 · 아이콘 · 텍스트 · 게이지 채움 · 차트 시리즈 = 색 OK.
카드 배경 · 카드 보더 · 섹션 헤더 = 항상 중립.

**칩은 상태 전용이다.** 분류·출처처럼 "정상/장애를 말하지 않는" 라벨은 배경 없는 맨 텍스트(`type-caption text-text-muted`)로 둔다 — `ConnectionSourceBadge`. 한 카드에 칩이 둘이면 어느 쪽이 상태인지 읽히지 않고, 대상 이름보다 라벨이 먼저 눈에 들어온다.

**중립 칩으로는 부족하다 — 형태로 갈라야 한다.** 출처를 `bg-ui-hover text-text-muted` 칩으로 만들어 봤더니 `일시정지`(status-idle) 배지와 구분이 되지 않았다. `status-idle` 라이트와 `text-muted`가 **둘 다 slate-600(`#475569`)로 값이 같고**, 틴트 배경(`status-idle/10`)과 `ui-hover`도 브라우저 실측에서 거의 겹쳤다. 회색 상태가 존재하는 한 중립 색으로는 상태와 분류를 못 가른다.

**분류 축에 `primary`를 쓰지 않는다.** primary는 선택 상태·주 액션·링크의 색이라 라벨에 쓰면 "선택됨"으로 오독된다 — §1.5에서 로그 `info`를 sky로 밀어낸 것과 같은 이유다. `ConnectionSourceBadge`의 `direct`가 primary 틴트였는데 `docker`는 회색이어서, **같은 축이 두 색으로 갈라져 있었다**(2026-09-20 둘 다 중립으로 통일).

---

## 6. 폼

| 컴포넌트 | props | 용도 |
|----------|-------|------|
| **`Input`** | `invalid?` `warn?` `mono?` + 네이티브 | 폼 입력 전부 |
| **`Select`** | 네이티브 `option` children + 기존 select props | 폼 셀렉트 (Input과 같은 셸) |
| **`SearchInput`** | `wrapperClassName?` + 네이티브 | 아이콘 붙은 검색창 |

**클래스를 직접 쓰지 않는다.** Button과 같은 규칙이다.

셸은 `Input.tsx`가 `FIELD_SHELL`·`FIELD_HEIGHT`로 export한다 — `Select`와 텍스트영역이 같은 상수를 쓴다. **높이는 `h-11 sm:h-10`(터치 44 / 그 외 40)으로 고정**한다(Button과 같은 이유, `px/py` 조합 금지). `Select`는 보이는 trigger + portal listbox를 렌더하고, 네이티브 `<select>`는 폼 값과 기존 `onChange` 계약을 유지하는 숨김 요소다. 따라서 브라우저의 기본 option 메뉴가 노출되지 않는다. 높이가 자유로워야 하는 텍스트영역만 `FIELD_SHELL`에 자기 `py`를 덧붙인다.

**상태 표현**
- `invalid` — 검증 실패. 붉은 보더 + `aria-invalid`. 메시지는 필드 아래 `type-body text-status-error` — 경고문이므로 14px(§2.2)이고, `red-500`은 흰 배경 3.8:1로 AA 미달이다
- `warn` — 제출은 막지 않는 주의(예: 원격에서 안 통할 주소). 앰버 보더

보더 색은 컴포넌트 내부에서 결정한다. `className`으로 넘기면 base의 `border-ui-border`와 **특이도가 같아** 생성된 CSS 순서로 승패가 갈린다 — 호출부가 이길 거라 가정하면 안 된다.

**포커스 링** — `index.css`의 전역 `:focus-visible { outline: 2px solid var(--color-primary) }`가 처리한다. `focus:outline-none` + 개별 `focus:ring-*`으로 덮어쓰지 않는다.

> 대비를 스크립트로 잴 때 주의: Tailwind v4의 `transition-colors`는 **`outline-color`를 포함**한다. `.focus()` 직후 `getComputedStyle`을 읽으면 트랜지션 첫 프레임(`currentColor`)이 잡혀 링이 검게 보인다. `transitionProperty='none'`으로 끄고 재야 실제 값이 나온다.

**목록 툴바 필터도 `Select`를 사용한다.** `ListToolbar`의 검색창·버튼과 같은 40px 높이로 맞추며, 시각 라벨이 없으면 `aria-label`을 지정한다. 필터 폭은 `wrapperClassName`으로 바깥 래퍼에 지정한다. 조회 제어의 위치와 폭은 §4.1을 따른다.

**텍스트영역**은 `Textarea`(`components/common/Textarea.tsx`)다. `FIELD_SHELL`에 자기 `py`만 덧붙인다.

**`Field`** (`features/alerts/components/FormLayout.tsx`) — 라벨 + 입력 + 에러/힌트 한 묶음. `htmlFor`를 줄 때만 `<label>`로, 없으면 `<span>` 캡션으로 렌더한다(자식이 버튼 그리드면 `<label>`이 첫 버튼을 눌러버린다). 한글 라벨·힌트에 `uppercase`·`italic`을 걸지 않는다 — 한글에는 대문자가 없어 자간만 벌어지고, 기울임 글리프가 없어 브라우저가 가짜 기울임을 만든다.

---

## 7. 오버레이

| 종류 | 용도 | 구현 |
|------|------|------|
| **ConfirmDialog** | 파괴적 확인 | `components/common/ConfirmDialog` |
| **모달** | 짧은 단일 작업 (API Key, 서비스 추가) | `features/services/*Modal` |
| **사이드 패널** | 긴 폼·상세 (알림 규칙, 트레이스) | `FormSidePanel` / `SidePanel` / `TracePanel` |

**공통 규약** — z-index `z-50`(SidePanel만 `z-40`), 배경 클릭 닫기.

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

`bg-black`이 아니라 `slate-900`인 것도 의도다. 다크 배경(`#0d1117`) 위에서 순수 검정은 대비가 생기지 않아 구멍처럼 보이고, 앱 팔레트가 slate 계열이라 정합도 맞다.

`SCRIM_MODAL_DIALOG`가 따로 있는 이유는 `backdrop:` 접두가 유틸리티마다 필요한데 Tailwind JIT가 런타임 조합을 못 읽기 때문이다. **값을 바꿀 때 둘을 함께 고칠 것.**

스크롤 잠금은 넣지 않았다. 이 앱은 `body`가 아니라 `MainLayout` 내부 컨테이너가 스크롤하는 구조라 `body` overflow를 잠가도 효과가 없고, 브라우저에서 실제 스크롤 누출이 재현되지 않았다. 누출이 확인되면 그때 잠글 대상을 정한다.

---

## 8. 접근성

- **전역 포커스 링** `:focus-visible` 2px primary + 2px offset. 개별 컴포넌트에서 재정의 금지
- **Skip link** `MainLayout`의 `#main-content` 스킵 링크
- **아이콘 전용 버튼**은 `aria-label` 필수 — `MaterialIcon`이 `aria-hidden="true"`라 아이콘만으로는 스크린리더에 아무것도 읽히지 않는다. `title`은 툴팁일 뿐 대체 텍스트가 아니므로 **둘 다** 준다. `<span className="sr-only">`로 라벨을 넣는 것도 동등하게 유효하다
- **색만으로 정보를 전달하지 않는다** (WCAG 1.4.1) — 상태 점은 §5.2, 4개 초과 차트 시리즈는 §1.6 참조
- **클릭되는 것은 키보드로도 되어야 한다** — `<div onClick>`은 탭으로 도달할 수 없다. 네이티브 `<button>`/`<a>`로 바꿀 수 없는 자리(카드 안에 버튼이 중첩)는 [`activatable()`](src/utils/a11y.ts). **`<tr>`·`<th>`에는 쓰지 말 것** — `role="button"`이 테이블 시맨틱을 덮어써 행·열 관계를 잃는다. 정렬 헤더는 `<th>` 안에 `<button>` + `aria-sort`, 선택 가능한 행은 `tabIndex` + 키핸들러만.
- **폼 컨트롤에는 접근 가능한 이름을 준다** — 라벨이 붙는 자리는 `<label htmlFor>`, 툴바 필터 셀렉트처럼 시각 라벨이 없는 자리는 `aria-label`. `Field`는 `htmlFor`를 줄 때만 `<label>`로 렌더한다(§6) — 자식이 버튼 그리드면 `<label>`이 첫 버튼을 눌러버리므로 `<span>` 캡션 + 그룹에 `role="group"`이 맞다.
- **렌더 중 부작용 금지** — 렌더 본문에서 `navigate()`를 부르거나 ref를 갱신하지 않는다. React가 렌더를 버릴 수 있어 커밋되지 않은 상태가 샌다. 리다이렉트는 `<Navigate>`, ref 갱신은 effect에서.
- **Toggle** `role="switch"` + `aria-checked`
- **`prefers-reduced-motion`** 전역 처리됨 (모든 애니메이션 0.01ms)
- **대비** 작은 메타·placeholder도 일반 텍스트 기준 4.5:1을 만족해야 한다. `text-text-dim`의 다크 값 `#8795a9`는 페이지·카드·hover 배경에서 검증했다. 더 밝은 표면에서는 `base` 또는 `secondary`를 사용한다 (§1.3).

---

## 9. 금지 사항

사용자 피드백에서 확정된 규칙이다. 근거까지 함께 적는다.

1. **카드 좌측 상태 보더 금지** — warn/crit 3px 세로 컬러 라인. *"AI 생성 디자인 같다."* 상태는 배지·아이콘·텍스트 색으로만.
2. **danger zone 스타일 금지** — 붉은 카드 보더, 붉은 섹션 제목, 앰버 경고 박스. 파괴적 액션은 **중립 카드 + `<Button variant="destructive">`**(채움 없는 `status-error` 텍스트). `text-red-600` 텍스트 링크는 다크에서 표면 대비 3.0이라 쓰지 않는다(§10 경계표). 주의문은 앰버 박스 대신 muted 본문.
3. **파스텔 틴트 박스 금지** — `bg-emerald-50` / `bg-amber-50` / `bg-red-50` 계열 공지 박스. `bg-ui-hover-soft + border-ui-border` + 상태색 아이콘 악센트로 대체. (배지·게이지 채움·hover는 데이터 시맨틱이라 예외)
4. **`dark:` 이중 작성 금지** (§1.1) — `text-slate-500 dark:text-text-muted-dark` → `text-text-muted`
5. **상태색 primitive 직접 사용 금지** — `text-emerald-600 dark:text-emerald-400` → `text-status-healthy` (§1.4). 대비·색각 조정이 index.css 한 곳에서 끝나야 한다
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

1~3, 12~13은 같은 취향의 계열이다: **색은 데이터와 액션에만, 컨테이너는 중립.**

---

## 10. 알려진 부채

2026-07-26 전수 스캔(`src/**/*.tsx` 76개). 규약 대비 이탈 목록. 2026-09-23 재집계: `dark:` 변형 82건/22파일(대부분 primitive 축 — 아래 B), `slate-*` 하드코딩 117건/18파일.

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

`ChartElements.tsx:77`은 **공용 컴포넌트인데도** `dark:` 이탈 상태라 우선순위가 높다.

### B. 상태색 primitive — 대부분 정상

**상태색 primitive 214건은 일괄 치환 대상이 아니다.** 2026-07-26에 374건을 전수 분류해 상태에 해당하는 160건만 `status-*` 토큰으로 옮겼고, 남은 214건은 의도적으로 primitive다. 경계:

| 축 | 예 | 토큰 |
|----|-----|------|
| **대상의 정상/장애 여부** | 서비스 정상/장애, 체크 결과, HTTP 2xx/4xx/5xx, 게이지 임계, 알림 전송 성공/실패, 진단 ok/issue | **`status-*` ✓** |
| 액션 의미 | 채움 `danger` 버튼, 복사 완료 피드백 | primitive |
| 채움 없는 파괴 액션 | `destructive` 버튼·`IconButton tone="danger"` | **`status-error` ✓** — 다크에서 red-600은 표면 대비 3.0이라 primitive로는 AA를 못 맞춘다 |
| 카테고리 분류 | HTTP 메서드, span kind(SERVER/CLIENT), 이벤트 타입 | primitive |
| 별도 축 | 로그 레벨(§1.5), 알림 severity(critical/warning/info) | primitive |
| 폼 | 필수 표시 `*`, 검증 경고, 로그인 에러 | primitive |
| 3rd-party 재현 | `ChannelForm`의 Slack/Discord/Telegram 미리보기 | 리터럴 hex |

새 코드에서 판단이 서지 않으면 **"이 색이 사라지면 사용자가 대상의 정상/장애를 오판하는가?"** 로 가른다. 그렇다면 `status-*`다.

### C. `Field` htmlFor 배선 — 완료 (2026-08-05)

`AlertRuleForm`의 단일 입력 Field들(규칙명·연산자·임계값·지속시간·쿨다운 등)까지 `htmlFor` + `id` 배선을 마쳤다. raw Field 라벨 잔여 0건.

버튼 그리드 Field(카테고리·프리셋·심각도)는 `<label>` 대상이 아니다. 그룹 자체에 `role="group"` + `aria-label`을 다는 것이 맞고, 이건 `Field`가 아니라 호출부 마크업 변경이라 별도 판단이 필요하다.

### ~~배지 크기 — 정리하지 않기로 함~~ → 11px 폐지로 해소

~~읽기 전용 배지가 `text-2xs`(상태칩·테이블)와 `text-xs`(로그 레벨·span kind) 두 계열이다.~~ **11px 등급을 폐지하면서 배지가 `text-xs` 한 계열로 통일됐다.** 아래는 당시 판단 기록이다. 크기 차이가 밀도(테이블 셀 vs 목록 스캔) 때문이라 강제로 맞추면 로그 레벨 배지가 작아지는 손해만 확실하다.

> 이전에 "같은 severity 배지가 폼과 테이블에서 등급이 다르다"고 적었던 것은 **오진이었다.** 폼 쪽은 배지가 아니라 알림이 어떻게 보일지 보여주는 미리보기 카드(틴트 배경 + 점 + 보더)로, 목적과 형태가 다른 물건이다. 실제 중복이던 `SEVERITY_BADGE` 상수는 `SeverityBadge` 컴포넌트로 통합했다.

### D. 카드 서브블록 radius 미전환 — 27건 (2026-09-20)

§3.2에 동심 규칙을 세우면서 §3.1의 서브블록 정본이 `rounded-xl` → `rounded-md`로 바뀌었다. 기존 호출부 **27건**(`bg-ui-hover-soft` + `rounded-xl` 조합)은 전환하지 않았다 — 각 사이트가 실제로 카드 **안**에 중첩된 것인지, 아니면 그 자체가 최상위 패널인지 열어 봐야 갈리기 때문이다. 최상위 패널은 `rounded-xl`이 맞다.

밀집 파일: `AlertRuleForm`(5) · `InfrastructureCollectorSetupResult`(3) · `ChannelForm`(3) · `ApiKeyModal`(2) · `AddServiceModal`(2) · `InstrumentationOverrideModal`(2) · `DirectTelemetrySetupResult`(2). 해당 파일을 다른 일로 열 때 함께 판단한다.

### ~~E. 사이드바 활성 항목과 breadcrumb 섹션이 어긋난다 (2026-09-20)~~ → 담김 관계로 통일 (2026-09-23)

서비스 상세(`/services/:agentId/:key`)에서 사이드바는 **활성 탭**을 따라간다(`?tab=logs`면 `로그` 하이라이트). `AppHeader`는 **담김 관계**를 따라 `Docker 환경 › 에이전트 › 서비스`를 보여준다. 그래서 탭을 바꾸면 사이드바 하이라이트만 움직이고 breadcrumb은 그대로다.

둘 다 각자의 논리는 맞다 — 탭은 "무엇을 보고 있나"이고 breadcrumb은 "어디에 있나"다. 다만 화면에 동시에 보이면 어긋나 보인다. **결정: 사이드바를 breadcrumb에 맞췄다** — 서비스 상세는 어떤 탭이든 `Docker 환경`이 활성이다(§3.4). "탭은 위치가 아니다"라는 §3.4 원칙과 같은 방향이고, 사이드바의 탭별 active 판정(`detailActive`)은 제거했다.

### 경로 → 라벨 목록이 세 벌 (2026-09-20)

`Sidebar`의 `NavItem`, `CommandPalette`의 `page-*` 항목, 새 `navSections.ts`가 각자 경로→라벨을 갖고 있고 이미 어긋나 있다(`환경설정` vs `환경 설정`, CommandPalette에는 `Docker 환경`이 없음). 하나로 합치려면 사이드바의 그룹 헤더·알림 badge를 함께 옮겨야 해서 단순 치환이 안 된다. `navSections.ts`는 사이드바 표기를 정본으로 삼았다.

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
- 남은 결정: 툴바 높이 혼재(조회 제어 sm 32), 토글 켜짐 표현 5종, 장애 배너 `로그 확인`의 danger, 설정 세그먼트 9곳

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
