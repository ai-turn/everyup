import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AppHeader } from './AppHeader';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { DemoBanner } from './DemoBanner';
import { BottomNavMobile } from './BottomNav.mobile';
import { BreadcrumbProvider } from '../../contexts/BreadcrumbContext';

export function MainLayout() {
  // AppHeader와 Outlet이 같은 트리에 있으므로 Provider도 여기서 닫는다 — 상세 페이지가
  // useBreadcrumb으로 올린 trail을 헤더가 읽는다.
  return (
    <BreadcrumbProvider>
    <div className="flex flex-col h-dvh overflow-hidden bg-bg-main">
      {/* 본문 바로가기 (accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus: focus:text-sm focus:shadow-lg"
      >
        본문 바로가기
      </a>

      <DemoBanner />

      {/* ⌘K / Ctrl+K project·service·page jumper */}
      <CommandPalette />

      {/* Content area: 좌측 Sidebar(lg+) + 우측 본문 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: lg 이상 데스크톱 전용 내비게이션 */}
        <Sidebar />

        {/* Right column: 모바일 Header + 본문 */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Header: 모바일 전용 (lg 미만). 데스크톱은 Sidebar가 내비를 맡는다 */}
          <div className="lg:hidden">
            <Header />
          </div>

          {/* AppHeader: 데스크톱 전용 위치 표시(breadcrumb). 높이는 Sidebar 로고와 같은 64px */}
          <AppHeader />

          <div className="flex flex-1 overflow-hidden relative">
            {/* full-bleed content on the bg-main canvas (white cards pop), 24px/20px padding */}
            <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-bg-main">
              <div className="flex-1 overflow-y-auto motion-safe:scroll-smooth [scrollbar-gutter:stable]">
                <div className="flex flex-col min-h-full pb-safe-bottom lg:pb-0">
                  <div className="p-4 sm:px-6 sm:py-5 space-y-5 flex-1 w-full max-w-320 mx-auto">
                    <Outlet />
                  </div>
                  <Footer />
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Bottom Navigation: 모바일 전용 (lg 미만) */}
      <BottomNavMobile />
    </div>
    </BreadcrumbProvider>
  );
}
