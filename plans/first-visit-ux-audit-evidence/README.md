# 첫 방문 UX 점검 증거

[결과 보고서](../first-visit-ux-audit-results.md)의 배포 화면 관찰을 재현하는 자료다. 제품 소스와 저장소 의존성은 수정하지 않는다. Docker 연결 폼의 예시 등록을 제외하면 읽기와 화면 이동만 수행한다. 예시 등록도 mock 응답으로 처리되며 생성된 설치 명령을 실행하지 않는다.

`captures/<ID>.png`는 화면이고, 동명 JSON은 URL·시각·브라우저·화면 크기·테마·상태·본문·컨트롤 위치 기록이다. `<phase>.json`은 단계별 캡처 목록과 행동 확인값을 담는다. `errors: []`는 수집 스크립트의 예외가 없었다는 뜻이다. `keyboard-trace-enter.opened: false` 같은 제품 동작 실패를 통과로 바꾸지 않았다.

## 재현

프로젝트 루트에서 PowerShell로 실행한다. 기록 당시 도구는 Playwright 1.62.1과 Chromium 151.0.7922.34였다.

```powershell
$auditTools = Join-Path $env:TEMP 'everyup-ux-audit-tools'
npm install --prefix $auditTools --no-save --package-lock=false --ignore-scripts playwright@1.62.1
$auditModule = Join-Path $auditTools 'node_modules/playwright/index.mjs'
# 브라우저가 없다면 설치한다.
node (Join-Path $auditTools 'node_modules/playwright/cli.js') install chromium

foreach ($phase in @('matrix', 'journey', 'narrow', 'aging', 'interaction', 'supplement', 'accessibility')) {
  node plans/first-visit-ux-audit-evidence/capture.mjs "--playwright=$auditModule" "--phase=$phase"
  if ($LASTEXITCODE -ne 0) { throw "Capture failed: $phase" }
}
```

재실행하면 해당 단계의 파일을 덮어쓴다. 새 기록을 원본과 비교하려면 이 증거 폴더를 먼저 별도 경로에 복사한다. `aging`은 실제로 약 110초 기다린다. 브라우저 시계나 서버 응답을 강제로 바꾸지 않는다. 라이브 배포가 바뀌면 결과도 달라질 수 있다.

`manifest.json`은 제출 시점 캡처의 SHA-256 목록이다. 재실행 후에는 기존 manifest와 파일이 일치하지 않으므로 이전 기록의 검증값으로만 사용한다.
