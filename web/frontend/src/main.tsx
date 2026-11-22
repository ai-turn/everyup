import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/error/index.ts'
import { AppProviders } from './components/AppProviders.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
        <Toaster
          position="top-right"
          // 넓은 화면에서는 상단 바(h-16) 아래에 띄운다. 상단 바 오른쪽의 목록 복귀 링크와 조작을 덮으면, 누르려고 올린 포인터가
          // 토스트를 멈춰(hover 동안 사라지지 않는다) 링크를 계속 가렸다.
          containerClassName="lg:!top-20"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--toast-bg, #fff)',
              color: 'var(--toast-color, #1e293b)',
              border: '1px solid var(--toast-border, #d9d9e0)',
            },
            success: {
              iconTheme: {
                primary: 'var(--color-status-healthy-fill)',
                // 다크의 밝은 상태색 위 흰 체크는 1.5:1 — 표면색으로 뚫어야 두 테마 모두 보인다.
                secondary: 'var(--color-bg-surface)',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: 'var(--color-status-error-fill)',
                secondary: 'var(--color-bg-surface)',
              },
            },
          }}
        />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
