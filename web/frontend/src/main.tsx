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
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--toast-bg, #fff)',
              color: 'var(--toast-color, #1e293b)',
              border: '1px solid var(--toast-border, #e2e8f0)',
            },
            success: {
              iconTheme: {
                primary: 'var(--color-status-healthy)',
                // 다크의 밝은 상태색 위 흰 체크는 1.5:1 — 표면색으로 뚫어야 두 테마 모두 보인다.
                secondary: 'var(--color-bg-surface)',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: 'var(--color-status-error)',
                secondary: 'var(--color-bg-surface)',
              },
            },
          }}
        />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
