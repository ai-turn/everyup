import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AppHeader } from './AppHeader';
import { GroupBackLink } from './GroupBackLink';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { DemoBanner } from './DemoBanner';
import { BottomNavMobile } from './BottomNav.mobile';
import { BreadcrumbProvider } from '../../contexts/BreadcrumbContext';
import { useFailureCount } from '../../hooks/useFailureCount';
import { useLocationCrumbs } from './useLocationCrumbs';

// 브라우저 탭 제목 = 현재 위치(크럼의 마지막) · EveryUp. 장애가 있으면 어느 화면에서든 앞에 "(N) 장애"를 붙인다 —
// 탭을 뒤에 두고 쓰는 도구라 다른 메뉴로 옮겨도 보여야 한다(UI/UX 점검 A3, 이전에는 개요에서만 붙었다).
function DocumentTitle({ failureCount }: { failureCount: number }) {
  const crumbs = useLocationCrumbs();
  const location = crumbs[crumbs.length - 1]?.label;
  useEffect(() => {
    const previous = document.title;
    document.title = [failureCount > 0 ? `(${failureCount}) 장애` : null, location, 'EveryUp'].filter(Boolean).join(' · ');
    return () => { document.title = previous; };
  }, [failureCount, location]);
  return null;
}

export function MainLayout() {
  const failureCount = useFailureCount();
  // AppHeader와 Outlet이 같은 트리에 있으므로 Provider도 여기서 닫는다 — 상세 페이지가
  // useBreadcrumb으로 올린 trail을 헤더가 읽는다.
  return (
    <BreadcrumbProvider>
    <DocumentTitle failureCount={failureCount} />
    <div className="flex flex-col h-dvh overflow-hidden bg-bg-main">
      {/* 본문 바로가기 (accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-lg focus: focus:text-sm focus:shadow-lg"
      >
        본문 바로가기
      </a>

      <DemoBanner />

      {/* ⌘K / Ctrl+K project·service·page jumper */}
      <CommandPalette />

      {/* Content area: 좌측 Sidebar(lg+) + 우측 본문 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: lg 이상 데스크톱 전용 내비게이션 */}
        <Sidebar failureCount={failureCount} />

        {/* Right column: 모바일 Header + 본문 */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Header: 모바일 전용 (lg 미만). 데스크톱은 Sidebar가 내비를 맡는다 */}
          <div className="lg:hidden">
            <Header />
          </div>

          {/* AppHeader: 데스크톱 전용 위치 표시(breadcrumb). 높이는 Sidebar 로고와 같은 64px */}
          <AppHeader />

          <div className="flex flex-1 overflow-hidden relative">
            {/* full-bleed content on the bg-main canvas, 24px padding (16px mobile) */}
            <main id="main-content" className="flex-1 flex flex-col overflow-hidden relative min-w-0 bg-bg-main">
              {/* 하단 내비·safe area는 pb-safe-bottom과 맞추고, 역방향 탐색의 상단 포커스 링도 보호한다. */}
              <div className="flex-1 overflow-y-auto scroll-pt-1 scroll-pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:scroll-p-1 motion-safe:scroll-smooth [scrollbar-gutter:stable]">
                <div className="flex flex-col min-h-full pb-safe-bottom lg:pb-0">
                  <div className="p-4 sm:px-6 sm:py-6 page-stack flex-1 w-full max-w-320 mx-auto">
                    <GroupBackLink />
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
