// 테마 목록의 단일 출처. 값은 tokens.css의 [data-theme] 블록과 public/theme-init.js의 목록과 같아야 한다.
export const THEMES = [
  { value: 'dark', label: '다크' },
  { value: 'light', label: '라이트' },
  { value: 'latte', label: 'Latte' },
  { value: 'mocha', label: 'Mocha' },
] as const;

export type Theme = (typeof THEMES)[number]['value'];
