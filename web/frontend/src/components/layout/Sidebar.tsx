import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { THEMES } from '../../contexts/themes';
import { MaterialIcon, SegmentedControl } from '../common';
import { env } from '../../config/env';
import logo from '../../assets/logo.webp';
import { DemoScenarioSwitcher } from './DemoScenarioSwitcher';
import { DemoHelpLinks } from './DemoHelpLinks';
import { OPEN_PALETTE_EVENT } from './CommandPalette';
import { NAV_SECTIONS, sectionFor } from './navSections';

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}

// G안 사이드바 항목: 34px 줄, 16px 아이콘, 현재 위치는 강조색 글자 + 옅은 강조 바탕.
function NavItem({ to, icon, label, active, badge }: NavItemProps) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`flex h-8.5 items-center gap-2 rounded-md px-2.5 type-label transition-colors ${
        active ? 'bg-accent-bg text-accent' : 'text-text-muted hover:bg-surface-hover hover:text-text'
      }`}
    >
      <MaterialIcon size={16} name={icon} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {/* 링크 이름은 "개요 장애 1건". */}
      {badge != null && badge > 0 && (
        <span className="shrink-0 rounded-full bg-crit-bg px-1.5 type-label-sm tabular-nums text-crit-text">
          <span className="sr-only">장애 </span>{badge}<span className="sr-only">건</span>
        </span>
      )}
    </Link>
  );
}

/** failureCount: 개요 항목의 장애 배지. MainLayout이 탭 제목과 같은 값을 넘긴다(useFailureCount). */
export function Sidebar({ failureCount }: { failureCount: number }) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  // 활성 항목 = 첫 크럼과 같은 섹션(담김 관계, DESIGN.md §3.4) — 컨테이너·앱 상세는 서버다.
  const current = sectionFor(useLocation().pathname);
  const mac = navigator.platform.toLowerCase().includes('mac');

  return (
    <aside className="hidden w-58 shrink-0 flex-col border-r border-border bg-bg-subtle px-3 pt-3.5 pb-4 lg:flex">
      <Link to="/" className="mb-3 flex h-9 items-center gap-2 rounded-md px-2.5 text-text">
        <img src={logo} alt="" className="h-6 w-6 rounded object-contain" />
        <span className="type-card-title">EveryUp</span>
      </Link>

      {env.isDemoMode && (
        <div data-demo-chrome className="mb-3 space-y-intra rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="type-label-sm text-text">Live Demo</p>
            <DemoHelpLinks compact />
          </div>
          <DemoScenarioSwitcher bare size="sm" />
        </div>
      )}

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        aria-label={`검색 또는 이동 (${mac ? '⌘K' : 'Ctrl K'})`}
        className="mb-3 flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-text-faint transition-colors hover:border-border-strong hover:text-text-muted"
      >
        <MaterialIcon size={16} name="search" className="shrink-0" />
        <span className="flex-1 text-left type-caption">검색 또는 이동</span>
        <kbd className="rounded border border-border-strong px-1 font-sans type-caption">{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      {/* 스크롤 영역은 포커스 링도 자른다. 위아래 여백에 첫·마지막 항목의 링이 들어간다. */}
      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto p-1" aria-label="주 메뉴">
        {NAV_SECTIONS.map((section) => (
          <NavItem
            key={section.to}
            // 개요는 장애 목록으로 바로 내린다 — 배지가 가리키는 곳이다.
            to={section.to === '/' ? '/#attention' : section.to}
            icon={section.icon}
            label={section.label}
            active={current?.to === section.to}
            badge={section.to === '/' ? failureCount : undefined}
          />
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-label pt-2">
        <SegmentedControl ariaLabel="테마" size="sm" fill options={THEMES} value={theme} onChange={setTheme} />
        {user && (
          <div className="flex h-10 items-center gap-2 border-t border-border px-2.5 pt-2">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-bg type-label-sm text-accent">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate type-label-sm text-text">{user.username}</span>
              <span className="block type-caption text-text-faint">관리자</span>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
