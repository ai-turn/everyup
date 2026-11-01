import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 현재 모드(development)에 맞는 .env 파일을 로드
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // GitHub Pages 배포 시 VITE_BASE_PATH=/everyup/ 로 설정
    base: process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      tailwindcss()
    ],
    server: {
      port: 5174,
      proxy: {
        '/api/v1': {
          // .env에서 타겟 주소를 가져옴 (기본값: localhost:3001)
          target: env.VITE_API_TARGET || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
