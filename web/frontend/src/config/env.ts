// Environment configuration
// Vite exposes env variables on import.meta.env

export const env = {
  // Mock 데이터 사용 여부
  useMock: import.meta.env.VITE_USE_MOCK === 'true',

  // 라이브 데모 모드 (GitHub Pages)
  isDemoMode: import.meta.env.VITE_DEMO_MODE === 'true',

  // API Base URL. 상대 경로라 개발 중에는 vite 프록시(/api → :3001)를, 배포 이미지에서는 같은 origin을 탄다.
  // 절대 주소(:3001)였을 때는 .env.local 없이 pnpm dev를 띄우면 CORS로 모든 요청이 막혔다.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
} as const;

// 타입 안전성을 위한 환경 변수 타입 선언
declare global {
  interface ImportMetaEnv {
    VITE_USE_MOCK: string;
    VITE_DEMO_MODE: string;
    VITE_API_BASE_URL: string;
    VITE_API_TARGET: string;
  }
}
