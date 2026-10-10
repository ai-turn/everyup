import { Link, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../common';
import { MORE_TARGET, NAV_SECTIONS, sectionFor } from './navSections';

const navItems = [...NAV_SECTIONS.filter((section) => section.mobile === 'bottom'), MORE_TARGET];
// 더보기 탭은 더보기 화면과, 더보기에서 들어가는 섹션(상세 화면 포함) 전부에서 활성이다.
const moreTargets = new Set([MORE_TARGET.to, ...NAV_SECTIONS.filter((section) => section.mobile === 'more').map((section) => section.to)]);

export function BottomNavMobile() {
  const location = useLocation();
  const current = sectionFor(location.pathname)?.to;

  function isActive(href: string) {
    return href === MORE_TARGET.to ? moreTargets.has(current ?? '') : current === href;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch border-t border-ui-border bg-bg-surface lg:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {navItems.map((item) => (
        <Link key={item.to} to={item.to} aria-current={isActive(item.to) ? 'page' : undefined} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${isActive(item.to) ? 'text-action' : 'text-text-dim'}`}>
          <MaterialIcon size={24} name={item.icon} />
          <span className="whitespace-nowrap text-sm">{item.label}</span>
          {isActive(item.to) && <span className="absolute top-1.5 h-1 w-1 rounded-full bg-primary" />}
        </Link>
      ))}
    </nav>
  );
}
