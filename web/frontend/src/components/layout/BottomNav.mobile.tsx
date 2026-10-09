import { Link, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../common';

const navItems = [
  { icon: 'dashboard', label: '개요', href: '/' },
  { icon: 'folder_open', label: 'Projects', href: '/projects' },
  { icon: 'notifications', label: '알림', href: '/alerts' },
  { icon: 'apps', label: '더보기', href: '/more' },
];

export function BottomNavMobile() {
  const location = useLocation();


  function isActive(href: string) {
    if (href === '/') return location.pathname === '/';
    if (href === '/more') return ['/environments', '/uptime', '/logs', '/infrastructure', '/api', '/metrics', '/settings'].some((prefix) => location.pathname.startsWith(prefix));
    return location.pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch border-t border-ui-border bg-bg-surface lg:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {navItems.map((item) => (
        <Link key={item.href} to={item.href} aria-current={isActive(item.href) ? 'page' : undefined} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${isActive(item.href) ? 'text-action' : 'text-text-dim'}`}>
          <MaterialIcon size={24} name={item.icon} />
          <span className="whitespace-nowrap text-sm">{item.label}</span>
          {isActive(item.href) && <span className="absolute top-1.5 h-1 w-1 rounded-full bg-primary" />}
        </Link>
      ))}
    </nav>
  );
}
