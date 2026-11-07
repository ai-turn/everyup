# Impeccable · Hallmark 점검 증거

판정과 개선 우선순위는 [점검 보고서](../impeccable-hallmark-check.md)에 있다. JSON의 원시 발견 수는 화면·테마별 반복과 오탐을 포함한다. `summary.json`의 개선 항목 수와 동일한 숫자가 아니다.

| 파일 | 내용 |
| --- | --- |
| `impeccable-static.json` | DESIGN.md가 있는 프론트엔드 cwd에서 `detect src --json` |
| `impeccable-docs-static.json` | docs cwd에서 `detect .vitepress/theme --json` |
| `impeccable-render.json` | 번들 `detectUrl`로 실제 DOM 검사 16회. 화면·테마·뷰포트 기록 포함 |
| `hallmark-static.json` | 앱 TSX/CSS, `--scope app --genre modern-minimal` |
| `hallmark-docs-static.json` | 소개 사용자 테마, `--scope component --genre modern-minimal` |
| `hallmark-render-app.json` | 로컬 개요·메트릭·채널 추가를 `--render --before --scope app`로 검사 |
| `hallmark-render-home.json` | 로컬 소개를 `--render --scope page`로 검사 |
| `verified-observations.json` | 필드 색, 작은 버튼, 스크롤 가림 확인, 로그 버튼 키보드 재현, 소개 경고의 DOM 문맥 |
| `build-demo.log` | `pnpm build:demo` 출력 |
| `screenshots/` | Impeccable 실행 시 16장, Hallmark 제공 20장, 확인용 2장 |
| `manifest.json` | 제출 시점 원시 결과와 화면의 SHA-256 |

Hallmark `--before`는 FAIL이 있어도 종료 코드 0을 반환한다. 통과 여부는 종료 코드 대신 JSON `summary`로 판단한다.

## 재실행

사용한 스킬 위치는 `C:/dev/mt-app/.claude/skills/impeccable`, `hallmark`다. Puppeteer Core 25.16.0은 저장소 밖 `%TEMP%/everyup-design-check-tools`에 pnpm으로 설치했다. 브라우저는 기존 Playwright Chromium 151을 사용했다. 다른 머신에서는 두 재현 스크립트의 도구·브라우저 경로를 바꿔야 한다.

프론트엔드와 docs 각각에서 `pnpm install --frozen-lockfile` 후, 별도 터미널에서 로컬 서버를 실행한다.

```powershell
pnpm --dir web/frontend exec vite --mode demo --host 127.0.0.1 --port 5187 --strictPort
pnpm --dir docs dev --host 127.0.0.1 --port 5188 --strictPort
```

프로젝트 루트에서 두 스크립트를 실행한다.

```powershell
node plans/ui-design-check-2026-11-07/run-impeccable.mjs
node plans/ui-design-check-2026-11-07/verify-findings.mjs
```

Hallmark는 `HALLMARK_PUPPETEER`에 임시 도구 디렉터리, `CHROME_PATH`에 Chromium 실행 파일을 지정하고 각 JSON에 대응하는 scope·URL로 실행한다. `.hallmark`의 자동 생성 스크린샷은 `.gitignore`에 걸리므로 공유용 화면은 `screenshots/`에 복사했다. 재실행 시 기존 파일과 manifest가 달라진다.

외부 알림·서버 설치는 실행하지 않는다. 검사 스크립트가 주입하는 DOM 진단과 스크롤·키보드 조작은 임시 브라우저에만 적용된다.
