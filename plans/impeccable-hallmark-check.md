# Impeccable · Hallmark 점검 결과

> 후속 상태: 2026-11-07~08에 아래 개선 항목을 수정했다. 이 문서는 수정 전 관찰을 보존하며, 최신 상태는 [수정·재검증 결과](ux-fixes-results.md)에서 확인한다.

점검일: 2026-11-07 · 대상 커밋: `2d37ed3d`

현재 UI에는 **우선 수정할 P1 3건과 P2 개선 항목 4건**이 있다. 제품의 디자인 체계는 일관되지만, 접근성과 일부 프로젝트 규칙은 미충족이다. `pnpm lint`와 `pnpm build:demo`는 통과했다.

이 작업트리에는 점검 시작 시 UI 소스 변경이 없었다. 따라서 특정 UI 변경의 회귀 검사가 아닌 **현재 프론트엔드와 소개 페이지 전체의 점검**으로 수행했다. 제품 코드·디자인 토큰·기존 예외 설정은 수정하지 않았다.

## 1. 실행 범위

| 항목 | 내용 |
| --- | --- |
| Impeccable | 원본 저장소에 설치된 v4.0.4. `audit` 지침, 소스 detector, 번들 `detectUrl` API 사용 |
| Hallmark | 원본 저장소에 설치된 v2.0.0. `audit` 지침, static + `--render`, 장르 `modern-minimal` |
| 앱 소스 | `web/frontend/src`, Hallmark `--scope app`, 147개 TSX/CSS 파일 |
| 소개 소스 | `docs/.vitepress/theme`, Hallmark `--scope component`. VitePress 기본 스타일을 포함하지 않은 조각 검사라는 한계를 적용 |
| 로컬 앱 | `http://127.0.0.1:5187/everyup/demo/` |
| 로컬 소개 | `http://127.0.0.1:5188/everyup/` |
| 대표 화면 | 개요, payment-worker 메트릭, 채널 추가, 소개 첫 화면. 키보드 재현은 payment-worker 로그 |
| Impeccable 렌더 | 4개 화면 × 데스크톱 1440×900 / 모바일 390×844 × 라이트 / 다크 = 16회, 수집 예외 0건 |
| Hallmark 렌더 | 앱 3개 URL + 소개 URL. 320·375·414·768·1024·1280·1920px 검사와 1440×900·1920×1080 캡처 |
| 브라우저 | Chromium 151.0.7922.34, Puppeteer Core 25.16.0 |
| 증거 | [원시 결과·재현 스크립트](ui-design-check-2026-11-07), [화면 38장](ui-design-check-2026-11-07/screenshots), [집계 JSON](ui-design-check-2026-11-07/summary.json) |

설치된 스킬은 `C:/dev/mt-app/.claude/skills/impeccable`과 `hallmark`에서 읽었다. 프론트엔드의 [DESIGN.md](../web/frontend/DESIGN.md)와 [ADR 0009](../docs/adr/0009-hallmark-label-and-punctuation-rules.md)를 기준으로 외부 도구의 일반 규칙과 프로젝트 예외를 구분했다. 새 테마·폰트·화면 구조는 도입하지 않았다.

## 2. Impeccable 평가

**Implementation Integrity: PASS — 제품 고유의 디자인 체계는 유지되어 있다.** 중립 표면, 의미에 따른 상태색, 공통 Button/Input/StatusLight, 데이터 중심의 개요가 실제 소스와 화면에 나타난다. 접근성 검사의 전체 통과를 뜻하지 않는다.

| 영역 | 점수 | 근거 |
| --- | --- | --- |
| 접근성 | 2/4 | 텍스트 대비와 로그 내 키보드 실행 실패. 포커스 링·라벨·본문 바로가기는 유지 |
| 성능 | 3/4 | 데모 빌드 성공, 화면·기능별 청크 분리, self-hosted 폰트. 실제 장치의 LCP/INP·스크롤 프레임은 미측정 |
| 반응형 | 2/4 | 양 화면 크기의 메뉴·레이아웃은 동작하나 기간 버튼의 터치 영역이 작고 모바일 상세는 데이터가 첫 화면 아래로 밀림 |
| 테마 | 3/4 | 시맨틱 토큰과 양 테마 적용. 고정된 어두운 데모 배너의 라이트 전경, 소개 캐러셀의 리터럴 색이 남음 |
| 구현 일관성 | 3/4 | 공통 컴포넌트·장르 규칙이 일관됨. 메트릭 구분 문구·일부 색 선언의 규칙 이탈 |
| **합계** | **13/20** | **Acceptable: 주요 약점 수정 필요** |

스킬의 0~4 루브릭으로 에이전트가 부여한 잠정 평가다. 자동 성능 점수나 WCAG 인증 결과가 아니다. P0 0건 / P1 3건 / P2 4건 / P3 0건으로 정리했다.

## 3. 실제 개선 항목

### [P1] C-01. Telegram 라벨의 글자 대비 2.70:1

- **위치·영역:** [ChannelForm.tsx:460](../web/frontend/src/features/alerts/components/ChannelForm.tsx), 접근성·테마.
- **관찰:** 채널 추가의 오른쪽 미리보기 상단에 있는 일반 텍스트 `Telegram`이 `#26A5E4`로 표시된다. 실제 배경은 약 `#fcfcfd`, 대비는 2.70:1이다. Impeccable과 Hallmark gate 40이 모두 검출했다.
- **영향:** 라이트 테마에서 채널 종류 라벨을 읽기 어렵다. 서드파티 메시지 내부의 재현 색을 보존하는 예외와, EveryUp 자체 UI 라벨의 대비 문제는 구분해야 한다.
- **개선:** 브랜드 아이콘의 색은 유지하고 자체 UI의 텍스트는 `text-text-base` 또는 `text-text-muted`로 표시한다. 라이트·다크에서 다시 계산한다.
- **검증:** 같은 14px 텍스트와 실제 배경 조합이 4.5:1 이상인지 확인한다.
- **증거:** [라이트 화면](ui-design-check-2026-11-07/screenshots/channel-form-desktop-light.png), [양쪽 도구의 렌더 결과](ui-design-check-2026-11-07/hallmark-render-app.json).
- **다음 명령:** `/impeccable harden`.

### [P1] C-02. 로그의 트레이스 버튼이 Enter로 실행되지 않음

- **위치·영역:** [AgentServiceLogsTab.tsx:180](../web/frontend/src/features/healthcheck/components/AgentServiceLogsTab.tsx), [a11y.ts:27](../web/frontend/src/utils/a11y.ts), 키보드 조작성.
- **재현:** payment-worker 로그 → 로그 행 안의 트레이스 버튼에 포커스 → Enter.
- **관찰:** `dialogOpened: false`, `rowExpanded: "true"`, `focused: true`. 패널 대신 부모 로그 행이 펼쳐진다. 트레이스 **탭**이 아닌 로그 안의 버튼으로 확인했다.
- **영향:** 키보드 사용자가 현재 로그에서 관련 트레이스로 들어가는 주 경로를 끝내지 못한다. 다른 경로가 있는지에 따라 전체 WCAG 판정은 달라지므로 이 결과를 앱 전체의 적합성 판정으로 확대하지 않는다. [W3C 키보드 접근 지침](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
- **개선:** 부모 `activatable`의 keydown을 부모 자체가 이벤트 대상일 때만 처리하거나 내부 컨트롤의 이벤트를 제외한다.
- **검증:** 부모 행의 Enter는 펼침, 자식 버튼의 Enter·Space는 패널 열기, 닫은 후 원래 버튼으로 포커스 복귀.
- **증거:** [Enter 후 화면](ui-design-check-2026-11-07/screenshots/keyboard-trace-enter.png), [DOM 관찰값](ui-design-check-2026-11-07/verified-observations.json). 기존 UX 점검의 UX-04와 같은 문제다.
- **다음 명령:** `/impeccable harden`.

### [P1] C-03. 모바일 라이트의 Live Demo 배지 대비 부족

- **위치·영역:** [DemoBanner.tsx:23](../web/frontend/src/components/layout/DemoBanner.tsx), 접근성·테마.
- **관찰:** 배너는 테마와 무관하게 어둡지만 글자는 라이트의 `text-action`을 따른다. 같은 커밋에서 앞서 측정한 대비는 2.44:1이다. 이번 로컬 화면에서도 같은 색 조합을 확인했다. 이 수치는 앞선 측정 기록을 재사용한 것으로, 이번 Impeccable 자동 렌더가 검출한 값은 아니다.
- **영향:** 체험 상태를 식별하는 작은 라벨이 라이트에서 흐리다. 옆의 설명 문장 전체가 저대비라는 뜻은 아니다.
- **개선·검증:** 어두운 배너에 맞는 전경 토큰을 적용하고 실제 배경 합성을 포함해 4.5:1 이상인지 양 테마에서 재확인한다.
- **증거:** [이번 로컬 라이트 화면](ui-design-check-2026-11-07/screenshots/overview-mobile-light.png), [앞선 색 계산 기록](first-visit-ux-audit-evidence/interaction.json)의 `mobile-demo-contrast-light`.
- **다음 명령:** `/impeccable harden`.

### [P2] C-04. 입력창 경계 대비가 Hallmark 기준에 못 미침

- **위치·영역:** [Input.tsx:19](../web/frontend/src/components/common/Input.tsx), [index.css](../web/frontend/src/index.css), 폼 식별성.
- **관찰:** 채널 폼과 메트릭 검색창에서 Hallmark gate 40이 경계 대비 1.40:1·1.34:1을 보고했다. 채널 입력의 실제 경계는 RGB(217,217,224), 내부 배경은 RGB(249,249,251)이다.
- **영향:** 빈 입력 영역의 범위를 찾는 시각적 단서가 약하다. 입력 전경·라벨의 텍스트 대비와는 별개다.
- **판정 범위:** Hallmark의 입력창 경계 3:1 기준에 미달한다. 모든 옅은 테두리가 곧 WCAG 위반인 것은 아니다. 해당 경계가 컨트롤 식별에 필요한지와 다른 충분한 단서가 있는지를 함께 판단해야 한다. [W3C 비텍스트 대비의 경계 설명](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **개선:** 카드 구분선과 입력창 경계를 다른 역할의 토큰으로 분리해, 입력창에만 더 뚜렷한 경계를 적용한다.
- **검증:** 비어 있는 필드·값이 있는 필드·포커스·오류 상태를 실제 인접 배경에서 확인한다.
- **증거:** [필드 색 관찰](ui-design-check-2026-11-07/verified-observations.json), [채널 추가 화면](ui-design-check-2026-11-07/screenshots/channel-form-desktop-light.png).
- **다음 명령:** `/impeccable harden`.

### [P2] C-05. 모바일 기간 선택 버튼도 높이가 28px

- **위치·영역:** [TimeRangePicker.tsx:21](../web/frontend/src/components/common/TimeRangePicker.tsx), [SegmentedControl.tsx:22](../web/frontend/src/components/common/SegmentedControl.tsx), 반응형·터치 조작.
- **관찰:** 1H·6H·24H가 데스크톱과 모바일 모두 높이 28px다. 측정한 의사 요소에는 추가 터치 영역이 없었다. `TimeRangePicker`가 `size`를 지정하지 않아 기본 `sm`을 사용한다.
- **영향:** 손가락으로 인접 옵션을 선택하기 어렵다. 프로젝트 [DESIGN.md](../web/frontend/DESIGN.md)의 모바일 44px 컨트롤 정책과 다르다. 44px 권장을 WCAG AA의 일괄 필수값으로 주장한 것은 아니다.
- **개선:** 좁은 화면에서는 더 큰 크기를 적용하거나 시각 크기를 유지하면서 실제 hit area를 넓힌다. 영역이 이웃 옵션과 겹치지 않게 한다.
- **검증:** 모바일에서 실제 각 버튼의 hit area 높이를 다시 측정하고 인접 항목을 터치한다.
- **증거:** [모바일 메트릭 화면](ui-design-check-2026-11-07/screenshots/metrics-mobile-light.png), [크기 측정](ui-design-check-2026-11-07/verified-observations.json)의 `smallMetricControls390`.
- **다음 명령:** `/impeccable adapt`.

### [P2] C-06. 메트릭 설명에 가운뎃점 구분이 반복됨

- **위치·영역:** [AgentServiceMetricsTab.tsx:93](../web/frontend/src/features/healthcheck/components/AgentServiceMetricsTab.tsx), 구현 일관성·문구.
- **소스 확인:** `전체 지표 기준 · 최근 5분 측정값의 원값 임계값과 수신 상태 · … 확인`은 세 사실을 한 줄의 구분자로 연결한다. Hallmark gate 63의 기존 예외 목록 밖에서 검출된 1건이다. 확인 필요 지표가 있는 조건에서 노출되는 문구이며, 기본 정상 데이터의 캡처에서 노출됐다고 보고하지 않는다.
- **영향:** 범위·판정 기준·확인 시각이 하나의 긴 메타 문장으로 묶이고 프로젝트 §2.5와 어긋난다.
- **개선:** 세 항목을 별도 span으로 나눠 `flex-wrap`과 gap으로 구분한다. 같은 파일 88행의 `지표명 · 타입 · 단위` 버튼도 같은 기준으로 검토한다.
- **검증:** 조건부 확인 필요 요약과 동일 이름 지표 선택 화면에서 긴 지표명·320px 폭을 확인하고 sloplint를 다시 실행한다.
- **증거:** [정적 결과](ui-design-check-2026-11-07/hallmark-static.json), [ADR 0009](../docs/adr/0009-hallmark-label-and-punctuation-rules.md).
- **다음 명령:** `/impeccable clarify`.

### [P2] C-07. 소개 캐러셀의 색·그림자·포커스 색 10개가 토큰 밖에 있음

- **위치·영역:** [custom.css:179](../docs/.vitepress/theme/custom.css), 테마·디자인 시스템.
- **관찰:** 캐러셀 화살표의 배경·hover·그림자, 점의 배경·선택색·포커스 링 등 10개 선언이 리터럴 값이다. `.dark`의 토큰 선언을 오탐한 15건과 분리한 실제 Hallmark gate 48 대상이다.
- **영향:** 캐러셀의 라이트·다크 조합을 바꿀 때 한 역할의 값을 여러 선언에서 따로 관리해야 한다. 현재 모든 색이 시각적으로 깨졌다는 뜻은 아니다.
- **개선:** 소개 테마의 `:root`·`.dark` 토큰으로 역할별 값을 옮긴다. 색 자체를 일괄 변경할 필요는 없다.
- **검증:** 화살표 기본/hover, 점 선택/포커스 상태를 두 테마에서 비교한다.
- **증거:** [소개 정적 결과](ui-design-check-2026-11-07/hallmark-docs-static.json), [소개 화면](ui-design-check-2026-11-07/screenshots/home-desktop-light.png).
- **다음 명령:** `/impeccable extract`.

## 4. 도구의 원시 결과와 오탐 분류

| 검사 | 원시 결과 | 해석 |
| --- | --- | --- |
| Impeccable 앱 소스 | warning 2, advisory 1 | 경고 2건은 ChannelForm의 실제 외부 메시지 미리보기 테두리로 기존 예외. advisory는 `main.tsx`의 토스트 fallback 색이며 실제 토스트는 CSS 변수를 사용 |
| Impeccable 소개 소스 | 0건 | 검사 범위 내 정적 패턴 없음. 전체 접근성 통과라는 뜻은 아님 |
| Impeccable 렌더 16회 | warning 47, advisory 82 | 화면·테마 반복이 포함된 건수. 129개 독립 결함으로 세지 않음 |
| Hallmark 앱 소스 | FAIL 41, WARN 4 | 기존 ADR 범주의 40건 + 메트릭 설명 1건. raw FAIL을 지우거나 억제 설정을 추가하지 않음 |
| Hallmark 소개 소스 | FAIL 26, REFLEX 15, WARN 3 | stamp 1 + `.dark` 토큰 오탐 15 + 캐러셀 리터럴 10. REFLEX는 간격 13 + 조각 CSS의 active/disabled 부재 2 |
| Hallmark 앱 렌더 | FAIL 4, REFLEX 1 | 라벨 대비 1, 필드 경계 2, 가림 1. 가림은 스크롤 검사 후 제외. REFLEX는 작은 기간 버튼 |
| Hallmark 소개 렌더 | FAIL 0, REFLEX 4, WARN 2 | 히어로·이미지 계산 오탐과 구성/타이포 검토 사항. 아래 설명 참고 |

Hallmark의 앱 렌더는 audit 기록용 `--before`를 사용했다. 이 모드는 발견이 있어도 종료 코드 0을 반환하므로 **종료 코드 대신 JSON의 실제 FAIL 4 / REFLEX 1을 보고**했다.

확인한 오탐·예외는 다음과 같다.

- **앱 정적 40건:** ChannelForm의 서드파티 재현 35, `.dark` 토큰 2, Hallmark가 만들지 않은 CSS의 stamp 1, spread로 전달한 `aria-hidden` 1, 접근성 이름이 있는 페이지 이동 아이콘 1. 기존 ADR의 분류와 일치한다.
- **채널 안내 가림:** 최초 위치는 내부 스크롤 영역 밖이다. 스크롤 후 y=647~667px에서 안내 문구가 실제 hit-test 대상으로 확인됐다. 하단 바 때문에 안내를 영구히 읽지 못하는 결함으로 채택하지 않았다. [스크롤 후 화면](ui-design-check-2026-11-07/screenshots/channel-guide-after-scroll.png)
- **소개 히어로 끝 64px / 빈 공간 486px:** 실제 스크린샷에는 헤드라인·설명·CTA가 있다. VitePress의 nav/래퍼를 히어로로 잘못 집계한 결과다.
- **소개 이미지 점유율 143%:** 한 번에 하나씩 보이는 캐러셀 이미지 7개를 합산한 값이다. 실제로 페이지 143%를 사진이 덮는 것은 아니다.
- **작은 상태 점의 pulse:** 현재 진행 중인 장애와 연결된 상태 표시다. 장식용 가짜 실시간 표시로 일괄 판정하지 않았다. 모션 최소화 설정은 별도 CSS로 존재한다.
- **중첩 카드:** 개요의 사이드바 안 선택기, 폼의 구역, 외부 메시지 재현이 포함된다. 도구의 컨테이너 판정만으로 전부 평탄화하지 않는다.
- **소개 모바일 `span.container` 잘림:** 16×14px 내비 아이콘의 내부 요소다. 메뉴/툴팁이 잘리는 사용자 문제로 확인된 것은 아니다.
- **소개 glow:** 표시된 그림자 목록은 중립색의 메뉴·토글·캐러셀 버튼 elevation이다. 화면에서 강조 halo를 확인하지 못해 `dark-glow`를 실제 결함으로 채택하지 않았다.
- **소개 긴 줄:** 구성도 `figcaption`의 640px·2줄 설명이다. 본문 전체에 91자 줄이 반복된다는 뜻은 아니다. 한국어 캡션의 읽기 선호는 사용자 확인 대상으로 남긴다.
- **소개의 균등 기능 카드·서체 굵기 4종·off-scale 간격:** 숫자상 경고는 보존한다. 기능 비교, VitePress 기본 타이포, 기존 간격 정책의 맥락이 있어 전면 재배치를 권하지 않는다. 6px 같은 값은 프로젝트의 간격 체계에도 존재한다.
- **소개의 active/disabled 부재:** 사용자 CSS 파일만 본 결과다. VitePress 기본 CSS가 포함된 실제 화면의 상태 부재로 일반화하지 않는다.

## 5. Hallmark 화면 판독과 유지할 요소

- **목적:** 개발자가 현재 장애를 발견하고 관련 데이터를 조사하는 앱. 소개는 용도를 이해하고 데모 또는 설치 문서로 이동시키는 페이지다.
- **유지:** 중립 표면과 절제된 강조색, 대상 이름이 먼저 나오는 개요, 실제 제품 스크린샷, 조건을 설명하는 구성도, 기존 메뉴·라우트·컴포넌트 체계.
- **규칙 이탈:** 메트릭의 구분 문구와 소개 캐러셀의 토큰 밖 색은 기존 시스템 안에서 고칠 수 있다.
- **실제 조작·판독 문제:** 채널/데모 라벨 대비, 로그의 키보드 실행, 모바일의 작은 기간 선택 영역.

가장 가벼운 해결 범위는 **polish와 개별 접근성 수정**이다. 새 테마나 전체 redesign을 할 근거는 확인하지 못했다. 모바일 상세의 정보 순서까지 바꾸려면 [앞선 UX 보고서의 UX-07](first-visit-ux-audit-results.md)을 별도 배치 개선으로 다룬다.

## 6. 후속 작업과 한계

권장 순서는 다음과 같다. 아래 명령은 제안이며 이번 점검에서 실행해 제품을 바꾸지는 않았다.

1. `/impeccable harden`: 트레이스 키보드 동작, 두 라벨 대비, 필드 식별성.
2. `/impeccable adapt`: 기간 선택기의 모바일 hit area.
3. `/impeccable clarify`: 메트릭 요약의 항목 분리.
4. `/impeccable extract`: 소개 캐러셀의 역할별 토큰.
5. `/impeccable polish`: 위 수정 후 원래 화면과 비교하는 최종 확인.

하나씩 또는 한 번에 수정할 수 있으며, 수정 후 `/impeccable audit`와 Hallmark의 같은 범위 검사를 재실행하면 된다.

이번 점검은 새 UI 구현이나 기존 FAIL 전체의 자동 수정이 아니다. 실제 사용자 테스트, 실기기의 터치 오조작률, 전체 화면의 스크린리더 검증, 실제 브라우저 200% 확대, Web Vitals는 미검증이다. 성능 점수는 소스·빌드에 근거한 잠정치이며 사용자 장치의 성능을 측정하지 않았다. 기존 `pnpm-lock.yaml` 변경은 보존했다.

원시 JSON·스크린샷을 보존했고, 코드·문서 링크와 재현 스크립트 문법을 확인했다. 검사에 사용한 로컬 서버는 종료했다.
