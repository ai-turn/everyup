import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// 테마 목록의 단일 출처. 값은 tokens.css의 [data-theme] 블록과 public/theme-init.js의 목록과 같아야 한다.
export const THEMES = [
  { value: 'dark', label: '다크' },
  { value: 'light', label: '라이트' },
  { value: 'latte', label: 'Latte' },
  { value: 'mocha', label: 'Mocha' },
] as const;

export type Theme = (typeof THEMES)[number]['value'];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isTheme = (value: unknown): value is Theme => THEMES.some((t) => t.value === value);
const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem('theme');
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => storedTheme() ?? systemTheme());

  // 첫 페인트 전 적용은 public/theme-init.js가 한다. 여기서는 이후 변경만 반영한다.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // 사용자가 직접 고르기 전까지는 OS 설정 변경을 따라간다.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = () => {
      if (!storedTheme()) setThemeState(media.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', followSystem);
    return () => media.removeEventListener('change', followSystem);
  }, []);

  // 저장은 명시적 선택일 때만 — 시스템 기본값까지 저장하면 OS 테마를 바꿔도 따라가지 않는다.
  const setTheme = (next: Theme) => {
    try {
      localStorage.setItem('theme', next);
    } catch { /* 저장 못 해도 이번 세션에는 적용한다 */ }
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
