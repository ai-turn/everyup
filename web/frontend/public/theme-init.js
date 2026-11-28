// 첫 페인트 전에 테마를 붙인다 — React가 뜬 뒤에 붙이면 다크 사용자에게 라이트 화면이 번쩍인다.
// CSP(script-src 'self')가 인라인 스크립트를 막아서 별도 파일이다. ThemeContext와 같은 규칙을 따른다:
// 저장된 선택이 있으면 그것, 없으면 OS의 라이트/다크.
var theme = null;
try {
  theme = localStorage.getItem('theme');
} catch { /* storage 차단 시 OS 설정을 따른다 */ }
if (['dark', 'light', 'latte', 'mocha'].indexOf(theme) < 0) {
  theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
document.documentElement.dataset.theme = theme;
