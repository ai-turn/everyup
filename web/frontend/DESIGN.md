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

대비 열은 **라이트의 흰 카드 배경 기준**이다. 다크 `dim`은 페이지 6.22:1, 카드 5.69:1, hover 4.82:1이다. 이전 값 `#6b7280`은 카드에서 3.58:1로 AA에 미달했다. 대비는 토큰 하나가 아니라 실제 배경과의 조합으로 확인한다. `ui-active`·`ui-raised`의 텍스트는 `base` 또는 `secondary`를 사용하고, 그 위에 `dim`을 올리지 않는다. 더 옅은 등급을 추가하지 말 것.

**읽는 산문에 `dim`을 쓰지 않는다.** `dim`은 표에 적힌 대로 **메타·placeholder 전용**이다 — `최근 3건`, 타임스탬프, 차트 축 라벨, endpoint 값처럼 훑는 자리. 문장으로 읽어야 하는 설명문·경고문은 `muted`(7.58)다. 산문은 훑는 값보다 오래 눈이 머물기 때문에 하한선인 4.76에 두면 흐리게 읽힌다.

### 1.4 브랜드 · 상태

**primary** `#3b76c9` (dark `#3F6FDB`) — 주 액션, 링크, 선택 상태, 차트 첫 시리즈

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

`AgentServiceLogsTab`의 `LEVEL_STYLE`(배지) / `LEVEL_BAR`(히스토그램)가 SSOT.

| 레벨 | 색 | 바 hex | 배지 라이트 텍스트 |
|------|-----|--------|------------------|
| error | red | `#dc2626` | `text-red-700` |
| warn | amber | `#d97706` | `text-amber-700` |
| info | **sky** | `#0284c7` | `text-sky-700` |
| debug | violet | `#7c3aed` | `text-violet-700` |
| trace | slate | `#64748b` | `text-text-muted` |

info가 sky인 이유: primary(#3b76c9)와 붙어 있으면 "선택된 항목"으로 오독된다.

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

- **본문** Spoqa Han Sans Neo (self-hosted, `spoqa-han-sans` 패키지)
- **정적 폰트다.** 굵기는 100/300/400/500/700 다섯 개뿐이고 가변 축이 없다 — 중간 굵기를 만들 수 없다
- **숫자·코드·타임스탬프** JetBrains Mono Variable → `font-mono`
- 숫자가 자리 이동하면 안 되는 곳(KPI, 차트 범례, 테이블)은 `tabular-nums`를 함께 건다

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

페이지 헤더는 [PageHeader](src/components/common/PageHeader.tsx)를 쓴다. 모바일 전용 화면의 h1은 기존 `text-xl font-bold`(20px)을 허용한다. KPI 수치는 24~30px, `font-mono tabular-nums`를 사용한다. 404 같은 디스플레이 숫자는 별도 크기를 허용한다.

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

내부 패딩은 `p-4`(조밀) 또는 `p-6`(여유). 카드 안 서브블록은 `bg-ui-hover-soft border border-ui-border rounded-xl`.

### 3.2 radius

| 값 | 용도 |
|----|------|
| `rounded-xl` | 카드, 패널, 모달, 큰 입력 |
| `rounded-lg` | 버튼, 입력, 아이콘 버튼, 드롭다운 |
| `rounded-md` | 조밀한 칩, 인라인 코드 |
| `rounded` | 배지 |
| `rounded-full` | 상태 점, pill, 아바타 |

`rounded-2xl` 이상은 쓰지 않는다.

### 3.3 본문 그리드

`MainLayout` 본문 래퍼: `p-4 sm:px-6 sm:py-5 space-y-5 max-w-320 mx-auto` — 최대 폭 **1280px** 중앙 정렬. `Header`와 같은 값을 쓴다. 이전의 풀블리드(max-width 없음)는 폐기했다 — 1920px 화면에서 3열 카드 한 장이 500px를 넘어가면서 내용은 그대로인데 화면만 비어 보였다. 카드 간 간격은 래퍼의 `space-y-5`가 담당하므로 개별 카드에 `mb-*`를 붙이지 않는다.

설정 화면은 최대 폭 `max-w-4xl`의 단일 컬럼이다. 카드 안에서는 라벨 아래에 14px 설명을 놓고, 컨트롤은 오른쪽에 배치한다. 모바일에서는 컨트롤을 설명 아래로 내려 읽는 순서를 유지한다. 항목이 하나뿐인 보조 내비게이션은 만들지 않는다.

### 3.4 내비게이션 셸

- `lg` 이상: 좌측 `Sidebar`(로고 → nav → Docker 수집기 상태 푸터). `Header`는 `lg:hidden`으로 모바일 전용
- `lg` 미만: `Header` + `BottomNavMobile`. 하단바 겹침은 `pb-safe-bottom` 유틸리티가 처리
- 뒤로가기 버튼은 **데스크톱에 두지 않는다** — 사이드바가 상시 내비다

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
| **`Select`** | 네이티브 `option` children + 기존 select props | 앱 스타일 listbox (§6) |
| **`SearchInput`** | `wrapperClassName?` | 아이콘 붙은 검색창 (§6) |
| **`StatusBadge`** | `healthy: boolean` | 정상/장애 보더칩 (§5.1) |
| **`CollectionStatusBadge`** | `collecting` \| `partial` \| `delayed` \| `not-configured` | 수집 신선도·설정 상태. 서비스 상태와 별도 축 (§5.1) |
| **`Toggle`** | `checked` `onChange` `disabled` `title` | w-9 h-5, `role="switch"` |
| **`SegmentedControl<T>`** | `options` `value` `onChange` `size` `ariaLabel` | 2~4지 배타 선택 |
| **`TimeRangePicker`** | `value: GlobalTimeRange` `onChange` | `1h`\|`6h`\|`24h`. SegmentedControl 래퍼 |
| **`ConfirmDialog`** | `isOpen` `title` `message` `variant` `icon` … | `window.confirm()` 금지 — 항상 이것 |
| **`EmptyState`** | `icon` `title` `description?` `action?` | 빈 목록의 정본 |
| **`PageHeader`** | `title` `subtitle?` `children` | h1 등급 고정 |
| **`ListToolbar`** | `search` `children?` | 목록 검색은 왼쪽, 필터는 그다음 |
| **`ResourceCardHeader`** | `icon` `title` `subtitle?` `status?` | 대상 아이콘·이름·출처·상태의 고정 배치 |
| **`DetailActionToolbar`** | `controls` `actions` | 상세의 조회 제어·변경 액션을 반응형으로 분리 |
| **`MaterialIcon`** | `name` `size` `className` `style` | 로컬 정적 SVG |
| **`CopyButton`** | `onCopy` `title` `className` … | 3초 완료 피드백 |

**Button 스펙**

| variant | 용도 | 클래스 |
|---------|------|--------|
| `primary` | 주 액션 (화면당 1개) | `bg-primary text-white` |
| `secondary` | 취소·보조 | `bg-bg-surface border border-ui-border` |
| `ghost` | 배경 없는 3순위 | `text-text-muted hover:bg-ui-hover` |
| `danger` | 삭제·파괴 | `bg-red-600 text-white` |

| size | 높이 | 용도 |
|------|------|------|
| `sm` | `h-8` | 테이블 행, 조밀한 툴바 |
| `md` | `h-10` | **기본** — 입력·검색창과 같은 40px |
| `lg` | `h-11` | 폼 제출, 모달 CTA |

`SegmentedControl`은 트랙을 포함해 `sm` 32px, `md` 40px다. 기본 검색·폼 입력·버튼은 모두 40px로 맞춘다.

크기는 **높이로 고정**한다. `px/py` 조합으로 높이를 만들지 않는다 — 나란히 놓았을 때 밑변이 어긋난다.
`p-2 rounded-lg` + 아이콘 하나짜리 **아이콘 전용 토글 버튼은 이 컴포넌트 대상이 아니다**.

**액션 앵커**

- 페이지의 주 액션은 `PageHeader`의 `children`에 둔다. `md` 이상에서는 **설명과 같은 행의 우측 끝**, 그 미만에서는 설명 아래가 고정 위치다. 제목은 자기 행을 독차지한다 — 제목 행에 버튼을 같이 두면 세 글자짜리 제목과 버튼 사이가 1000px 넘게 비어 서로 무관한 요소로 읽혔다.
- 액션은 **보조 → 주 액션** 순서로 전달해 주 액션을 우측 끝에 둔다. 헤더 내부에 별도 flex 래퍼를 만들지 않는다. 40px 버튼의 중심을 설명 행의 중심에 맞춘다(`md:items-center`). `sm` 미만에서는 버튼을 전체 폭으로 쌓고, 그 이상에서는 같은 순서로 줄바꿈한다. 버튼 아이콘은 16px, 버튼 간격은 8px, 헤더 아래 간격은 24px다.
- 대상을 새로 만드는 액션의 라벨은 **`추가하기` 하나다.** 페이지 헤더 CTA, 빈 상태의 액션, 다이얼로그 제출 버튼 전부 같은 문구를 쓴다. `업타임 추가`·`Logs 직접 추가`·`Collector 추가`처럼 대상을 앞에 붙이지 않는다 — 대상은 페이지 제목이나 모달 제목이 이미 말하고, 명사를 각자 고르게 두면 한글·영어가 섞이고 화면마다 어긋난다. 라벨에 영어 리소스명(`Logs`·`Metrics`·`Collector`)을 넣지 않는다.
- **제목은 이 규칙 밖이다** — 다이얼로그·페이지 제목은 `업타임 추가`·`채널 추가`처럼 대상을 밝힌다. 라벨에서 명사를 뺄 수 있는 근거가 제목이므로, 제목까지 비우면 맥락이 사라진다.
- 로그·API·메트릭·인프라의 연결 진입점은 `로그 연결`·`API 연결`·`메트릭 연결`·`인프라 연결` 하나로 통합한다. 기존 대상 재사용과 새 대상 등록을 모두 포함하므로 위의 생성 전용 `추가하기` 규칙과 구분한다. 연결 화면 안에서 Docker와 직접 OpenTelemetry 경로를 선택한다.
- 헤더 블록은 `border-b border-ui-border pb-5`로 띠를 이룬다. 제목과 우측 CTA 사이가 1000px 넘게 벌어지는 넓은 화면에서, 이 선이 없으면 버튼이 헤더에 속하지 않고 구석에 떠 있는 요소로 읽혔다.
- 검색·필터는 페이지 헤더에 섞지 않고 그 아래의 보조 툴바에 둔다. 모바일에서는 툴바가 CTA보다 앞서지 않는다.
- 목록의 보조 툴바는 `ListToolbar`를 쓴다. 검색창은 왼쪽 320px(`sm` 미만 전체 폭), 필터는 오른쪽부터 이어지며 공간이 부족하면 다음 줄로 흐른다. 검색·필터·버튼 높이는 모두 40px다. 탭 안의 검색은 해당 탭의 목록 위에 둔다. 검색 기능이 없는 화면에 정렬만을 위한 빈 검색창을 만들지 않는다.
- 상세 화면은 `DetailActionToolbar`로 조회 제어와 변경 액션을 분리한다. 모바일에서는 두 그룹이 제목 아래에서 차례로 쌓이고, `md` 이상에서는 양 끝에 둔다.
- 페이지·상세 헤더의 아이콘 전용 액션은 `h-10 w-10`이다. `h-8 w-8`은 테이블 행처럼 조밀한 맥락에서만 쓴다.

**아이콘 크기** — `MaterialIcon`은 `size`로 SVG 크기를 정한다. 기본 16px는 인라인·버튼, 20px는 내비게이션·섹션, 24px는 주요 상태용이다. 스피너·빈 상태에는 32/36/48px를 허용한다. `text-*`는 색에만 사용하고 폰트 크기를 아이콘 크기로 사용하지 않는다. 아이콘 획은 SVG 도형이 결정하므로 `font-*`로 두께를 조절하지 않는다. 같은 영역에서는 같은 아이콘 계열을 사용한다.

**MaterialIcon 함정** — `iconMarkup` 맵에 없는 `name`은 `help_outline`(`?`)로 폴백한다. 신규 아이콘은 반드시 [`materialIconPaths.ts`](src/components/common/materialIconPaths.ts)에 path를 추가한다.

**대상 목록의 아이콘 배치** — 업타임·API·로그·메트릭·인프라·Docker 환경·Project의 대상 카드는 `ResourceCardHeader`를 쓴다. 아이콘은 이름 왼쪽 20px·`text-text-muted`로 고정하고, 첫 제목 줄과 정렬한다. 직접 연결/Docker 연결 여부로 아이콘 위치나 색을 달리하지 않는다. 출처는 이름 아래, 상태 또는 대상별 작업은 우측이다. 페이지 제목과 연결 방식별 섹션 제목에는 같은 아이콘을 반복하지 않는다. 알림 채널의 브랜드 아이콘, 상태 아이콘, 빈 상태 안내는 각 의미를 유지한다.

| 대상 | 아이콘 |
|---|---|
| 업타임 | `monitor_heart` |
| API | `api` |
| 로그 | `article` |
| 메트릭 | `monitoring` |
| 인프라 | `memory` |
| Docker 환경 | `dns` |
| Project | `folder_open` |

배치 판단 참고: [PatternFly Page header](https://www.patternfly.org/component-groups/content-containers/page-header/)의 제목 우측 액션, [Carbon Data table](https://carbondesignsystem.com/components/data-table/usage/)의 검색·필터 툴바. 이 프로젝트에서는 기존 페이지 CTA 앵커를 유지하고 목록 조회 제어를 별도 줄로 통일한다. 카드 아이콘의 정확한 크기·색·배치는 이 프로젝트의 규약이다.

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

### 5.1 배지 — `StatusBadge`

```tsx
<StatusBadge healthy={service.healthy} />
```

```
badge
text-status-{role}  bg-status-{role}/10  border-status-{role}/20
```

`healthy` boolean 하나만 받는다. 실제로 렌더되는 상태가 정상/장애 둘뿐이라 그 이상은 지원하지 않는다 — 3단계 이상이 필요해지면 그때 union으로 넓힌다.

`badge`는 `index.css`의 공통 형태다: **12px / 16px, 500, 최소 높이 24px, 좌우 6px 패딩, 4px radius**. 서비스 상태·수집 상태·알림 severity·로그 레벨 배지가 공유한다. 상태색은 `/10` 틴트 배경과 `/20` 보더를 사용하고, 별도 분류 축인 severity·로그 레벨은 자기 팔레트를 유지한다.

배지는 읽기 전용이다. 업타임의 일시정지·재개는 별도 `Button`으로 표시해 상태와 액션을 구분한다. 길이가 변하는 상태 문자열은 줄바꿈하지 않는다.

Tailwind v4는 `/10` 같은 투명도 수식자를 `oklab()` `color-mix`로 컴파일한다. 대비를 직접 잴 때 `getComputedStyle().backgroundColor`를 rgb로 가정하면 값이 어긋나니, 소스 hex와 알파로 합성해 계산할 것.

### 5.1a 수집 상태 — `CollectionStatusBadge`

**서비스 상태**(정상·장애)와 **수집 상태**(수집 중·부분 수집·지연·미설정)는 섞지 않는다. 전자는 대상의 동작 결과이고 후자는 관측 가능성이다. 환경·프로젝트 목록과 개요의 범위/연결 정보에는 `CollectionStatusBadge`를 쓴다. 장애 lifecycle이 실제로 없다면 “Incident” 같은 단계명으로 바꾸지 않는다.

### 5.2 상태 점

```
h-2.5 w-2.5 rounded-full bg-status-{role}
```
목록 안의 조밀한 자리는 `h-1.5 w-1.5`. 진행 중인 장애는 `animate-pulse`를 더한다(`prefers-reduced-motion`에서 전역 규칙이 정지시킨다).

**점이 유일한 정보원이면 이름을 준다** — 점 옆에 같은 뜻의 텍스트(배지·라벨)가 없으면 색만으로 상태를 전달하는 것이라 WCAG 1.4.1 위반이다:
```tsx
<span role="img" aria-label={healthy ? t('정상') : t('장애')} className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
```
인접 텍스트가 이미 상태를 말하고 있으면(장애 배너, 온라인/오프라인 라벨) 점은 장식이므로 그대로 둔다.

### 5.3 색을 싣는 곳

**데이터와 액션에만 색을 싣는다. 컨테이너는 중립으로 둔다.**
배지 · 아이콘 · 텍스트 · 게이지 채움 · 차트 시리즈 = 색 OK.
카드 배경 · 카드 보더 · 섹션 헤더 = 항상 중립.

---

## 6. 폼

| 컴포넌트 | props | 용도 |
|----------|-------|------|
| **`Input`** | `invalid?` `warn?` `mono?` + 네이티브 | 폼 입력 전부 |
| **`Select`** | 네이티브 `option` children + 기존 select props | 폼 셀렉트 (Input과 같은 셸) |
| **`SearchInput`** | `wrapperClassName?` + 네이티브 | 아이콘 붙은 검색창 |

**클래스를 직접 쓰지 않는다.** Button과 같은 규칙이다.

셸은 `Input.tsx`가 `FIELD_SHELL`·`FIELD_HEIGHT`로 export한다 — `Select`와 텍스트영역이 같은 상수를 쓴다. **높이는 `h-10`으로 고정**한다(Button과 같은 이유, `px/py` 조합 금지). `Select`는 보이는 trigger + portal listbox를 렌더하고, 네이티브 `<select>`는 폼 값과 기존 `onChange` 계약을 유지하는 숨김 요소다. 따라서 브라우저의 기본 option 메뉴가 노출되지 않는다. 높이가 자유로워야 하는 텍스트영역만 `FIELD_SHELL`에 자기 `py`를 덧붙인다.

**상태 표현**
- `invalid` — 검증 실패. 붉은 보더 + `aria-invalid`. 메시지는 필드 아래 `text-xs text-red-500`
- `warn` — 제출은 막지 않는 주의(예: 원격에서 안 통할 주소). 앰버 보더

보더 색은 컴포넌트 내부에서 결정한다. `className`으로 넘기면 base의 `border-ui-border`와 **특이도가 같아** 생성된 CSS 순서로 승패가 갈린다 — 호출부가 이길 거라 가정하면 안 된다.

**포커스 링** — `index.css`의 전역 `:focus-visible { outline: 2px solid var(--color-primary) }`가 처리한다. `focus:outline-none` + 개별 `focus:ring-*`으로 덮어쓰지 않는다.

> 대비를 스크립트로 잴 때 주의: Tailwind v4의 `transition-colors`는 **`outline-color`를 포함**한다. `.focus()` 직후 `getComputedStyle`을 읽으면 트랜지션 첫 프레임(`currentColor`)이 잡혀 링이 검게 보인다. `transitionProperty='none'`으로 끄고 재야 실제 값이 나온다.

**목록 툴바 필터도 `Select`를 사용한다.** `ListToolbar`의 검색창·버튼과 같은 40px 높이로 맞추며, 시각 라벨이 없으면 `aria-label`을 지정한다. 필터 폭은 `wrapperClassName`으로 바깥 래퍼에 지정한다. 조회 제어의 위치와 폭은 §4.1을 따른다.

**텍스트영역**은 아직 공용 컴포넌트가 없다 — `AlertRuleForm`의 `textareaCls` 하나를 2곳이 공유한다. 세 번째 사용처가 생기면 `Textarea`로 뽑는다.

---

## 7. 오버레이

| 종류 | 용도 | 구현 |
|------|------|------|
| **ConfirmDialog** | 파괴적 확인 | `components/common/ConfirmDialog` |
| **모달** | 짧은 단일 작업 (API 키, 서비스 추가) | `features/services/*Modal` |
| **사이드 패널** | 긴 폼·상세 (알림 규칙, 트레이스) | `FormSidePanel` / `SidePanel` / `TracePanel` |

**공통 규약** — z-index `z-50`(SidePanel만 `z-40`), 배경 클릭 닫기.

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
2. **danger zone 스타일 금지** — 붉은 카드 보더, 붉은 섹션 제목, 앰버 경고 박스. 파괴적 액션은 **중립 카드 + `text-xs font-medium text-red-600` 텍스트 링크**. 주의문은 앰버 박스 대신 muted 본문.
3. **파스텔 틴트 박스 금지** — `bg-emerald-50` / `bg-amber-50` / `bg-red-50` 계열 공지 박스. `bg-ui-hover-soft + border-ui-border` + 상태색 아이콘 악센트로 대체. (배지·게이지 채움·hover는 데이터 시맨틱이라 예외)
4. **`dark:` 이중 작성 금지** (§1.1) — `text-slate-500 dark:text-text-muted-dark` → `text-text-muted`
5. **상태색 primitive 직접 사용 금지** — `text-emerald-600 dark:text-emerald-400` → `text-status-healthy` (§1.4). 대비·색각 조정이 index.css 한 곳에서 끝나야 한다
6. **`text-[Npx]` 임의값 금지** (§2.2) — 스케일 토큰만
7. **버튼 클래스 직접 작성 금지** — `<button className="px-4 py-2 bg-primary …">` → `<Button>` (§4.1). 높이·radius·굵기가 화면마다 어긋나는 것을 막는다
8. **`window.confirm()` 금지** → `ConfirmDialog`
9. **recharts `<Legend>` 금지** → `ChartStatsLegend` / `ChartLegend`
10. **차트 시리즈 색 하드코딩 금지** → `SERIES_HEX`
11. **텍스트 위계에 5단째(더 옅은 등급) 추가 금지** — `dim`이 AA 하한선이다 (§1.3)

1~3은 같은 취향의 계열이다: **색은 데이터와 액션에만, 컨테이너는 중립.**

---

## 10. 알려진 부채

2026-07-26 전수 스캔(`src/**/*.tsx` 76개). 규약 대비 이탈 목록.

### A. 토큰 규약 이탈

| 항목 | 건수 | 조치 |
|------|------|------|
| 시맨틱 토큰 + `dark:` 짝 | 10 | `dark:` 제거 |
| `*-dark` 접미 토큰 직접 사용 | 37 | 사이트별 확인 후 치환 |
| `bg-white` / `slate-*` 하드코딩 | 109 | 상태색 목적이 아니면 토큰으로 |

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
| emerald/amber/red/sky primitive | 214 | **대부분 정상** — 아래 경계 참조 |

**기계적 일괄 치환이 안 되는 이유** — 라이트/다크 클래스가 문자열 안에서 인접해 있지 않고(`bg-white … dark:bg-ui-active-dark`), 값이 토큰과 정확히 같지도 않다. 예를 들어 `bg-white dark:bg-ui-active-dark`는 라이트 `#fff`·다크 `#374151`인데 이런 토큰 쌍은 없다. 토큰과 값이 정확히 일치하는 쌍(6파일)은 2026-07-26에 이미 치환했고, 남은 것은 **사이트별로 의도를 확인해야** 한다.

`ChartElements.tsx:77`은 **공용 컴포넌트인데도** `dark:` 이탈 상태라 우선순위가 높다.

**상태색 primitive 214건은 일괄 치환 대상이 아니다.** 2026-07-26에 374건을 전수 분류해 상태에 해당하는 160건만 `status-*` 토큰으로 옮겼고, 남은 214건은 의도적으로 primitive다. 경계:

| 축 | 예 | 토큰 |
|----|-----|------|
| **대상의 정상/장애 여부** | 서비스 정상/장애, 체크 결과, HTTP 2xx/4xx/5xx, 게이지 임계, 알림 전송 성공/실패, 진단 ok/issue | **`status-*` ✓** |
| 액션 의미 | `danger` 버튼, 삭제 링크, 복사 완료 피드백 | primitive |
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
