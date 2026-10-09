// 첫 페인트 전에 테마 클래스를 붙인다 — React가 뜬 뒤에 붙이면 다크 사용자에게 라이트 화면이 번쩍인다.
// CSP(script-src 'self')가 인라인 스크립트를 막아서 별도 파일이다. ThemeContext와 같은 규칙을 따른다.
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) { /* storage 차단 시 라이트로 시작 */ }
