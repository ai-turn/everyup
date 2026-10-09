import { env } from '../../config/env'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { DemoScenarioSwitcher } from './DemoScenarioSwitcher'

const bannerText = (
  <>
    <span className="text-white">모든 데이터는 예시용 데이터이며, 실제 서버와 연결되어 있지 않습니다.</span>
    <span className="text-slate-400 mx-1.5">|</span>
    <span>All data is for demonstration purposes only and is not connected to a real server.</span>
  </>
);

export function DemoBanner() {
  const isMobile = useIsMobile();

  if (!env.isDemoMode) return null

  return (
    // lg+ 데스크톱은 Sidebar 상단 카드가 대체 — 배너는 모바일/태블릿 전용
    <div data-demo-chrome className="lg:hidden w-full shrink-0 bg-slate-900 dark:bg-slate-950 border-b border-slate-700">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-sm tracking-wider bg-primary/20 text-action border border-primary/30 uppercase">
            Live Demo
          </span>
          {isMobile ? (
            // 흐르는 텍스트는 멈출 수 없어(WCAG 2.2.2) 모바일은 한국어 문장만 줄바꿈해 보여준다.
            <p className="min-w-0 text-sm text-slate-300 break-keep">
              모든 데이터는 예시용 데이터이며, 실제 서버와 연결되어 있지 않습니다.
            </p>
          ) : (
            <p className="text-sm text-slate-300 truncate">
              {bannerText}
            </p>
          )}
        </div>
        <DemoScenarioSwitcher tone="dark" />
        <a
          href="https://github.com/ai-turn/everyup"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 hidden sm:flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          GitHub
        </a>
      </div>
    </div>
  )
}
