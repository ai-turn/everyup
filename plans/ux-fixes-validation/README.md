# 수정 후 검증 증거

2026-11-07~08의 첫 방문 UX·Impeccable·Hallmark 후속 수정 검증이다. 결론과 항목별 소스는 [수정 결과](../ux-fixes-results.md)에 있다. `../ui-design-check-2026-11-07`은 수정 전 결과로 보존했다.

- `impeccable-*.json`: 소스 검사와 16개 화면 조합의 렌더 결과. 마지막 메트릭 제목 변경은 해당 화면 4개 조합만 갱신했다.
- `hallmark-*.json`: 앱·소개 페이지의 소스/반응형 렌더 원시 결과. 기존 예외·오탐도 그대로 포함한다.
- `verified-observations.json`: 실제 색상·대비, 44px 기간 버튼, 업타임 라벨 위치, 접힘/펼침 가시성, 키보드 포커스, 예시 환경 등록 상태.
- `screenshots/`: Impeccable 16장, Hallmark 20장, 동작 확인 7장. 총 43장.
- `playwright.log`: 관련 68개 테스트 통과. `playwright-metrics-confirm.log`: 마지막 제목 버튼 보강 후 관련 10개 통과. 로그는 PowerShell 출력 형식을 사용한다.
- `build-demo.log`, `lint.log`: 최종 앱 빌드와 린트 출력.
- `summary.json`, `manifest.json`: 검사 집계와 파일별 SHA-256.

## 화면 검사 재현

프로젝트 의존성을 설치한 상태에서 `web/frontend`에서 `pnpm exec vite --mode demo --host 127.0.0.1 --port 5187 --strictPort`를 실행한다. 문서는 `docs`에서 `pnpm build` 후 `pnpm exec vitepress preview --host 127.0.0.1 --port 5188`로 연다.

저장소 루트에서 `node plans/ux-fixes-validation/run-impeccable.mjs`와 `node plans/ux-fixes-validation/verify-fixes.mjs`를 실행한다. 첫 스크립트에 `metrics`를 전달하면 해당 화면만 갱신한다. 스크립트의 브라우저·스킬·임시 Puppeteer 설치 경로는 이 Windows 환경의 경로이므로 다른 환경에서는 바꿔야 한다.

회귀 테스트는 `web/frontend/e2e/first-visit-fixes.spec.ts`에 있다. `web/frontend`에서 `pnpm build:demo` 후 `pnpm exec playwright test e2e/first-visit-fixes.spec.ts`로 실행한다.
