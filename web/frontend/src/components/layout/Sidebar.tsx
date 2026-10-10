import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { IconButton, MaterialIcon } from '../common';
import { api, type AgentServiceFlat, type UptimeMonitor } from '../../services/api';
import { env } from '../../config/env';
import logo from '../../assets/logo.webp';
import { DemoScenarioSwitcher } from './DemoScenarioSwitcher';
import { NAV_SECTIONS, sectionFor } from './navSections';

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}

function NavItem({ to, icon, label, active, badge }: NavItemProps) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-primary/10 text-action' : 'text-text-muted hover:bg-ui-hover hover:text-text-base'
      }`}
    >
      <MaterialIcon size={20} name={icon} className="shrink-0" />
      <span className="truncate">{label}</span>
      {/* 배지 박스는 표 컬럼 전용(DESIGN §5.1b) — 여기서는 색 있는 숫자로 충분하다. 링크 이름은 "개요 장애 1건". */}
      {badge != null && badge > 0 && (
        <span className="ml-auto shrink-0 text-xs font-medium tabular-nums text-status-error">
          <span className="sr-only">장애 </span>{badge}<span className="sr-only">건</span>
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();


  const location = useLocation();
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);

  const loadStatus = useCallback(async () => {
    // Navigation remains available even when its alert badge cannot load.
    const [servicesResult, monitorsResult] = await Promise.allSettled([api.getAllAgentServicesFlat(), api.getUptimeMonitors()]);
    if (servicesResult.status === 'fulfilled') setServices(servicesResult.value ?? []);
    if (monitorsResult.status === 'fulfilled') setMonitors(monitorsResult.value ?? []);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadStatus]);
  useAutoRefresh(() => void loadStatus(), 30_000);

  // 개요의 "(N) 장애"(탭 제목)와 같은 기준 — Docker 서비스만 세면 업타임 모니터 장애가 빠져 두 숫자가 갈렸다.
  const failureCount = services.filter((service) => !service.healthy).length
    + monitors.filter((monitor) => monitor.status === 'unhealthy').length;

  // 활성 항목 = 첫 크럼과 같은 섹션(담김 관계, DESIGN.md §3.4) — 서비스 상세는 Docker 환경이다.
  const current = sectionFor(location.pathname);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ui-border bg-bg-surface lg:flex">
      <Link to="/" className="group flex h-16 shrink-0 items-center gap-2 px-4">
        <img src={logo} alt="" className="h-9 w-9 object-contain" />
        <span className="text-lg font-bold tracking-tight text-text-base transition-colors group-hover:text-action">EveryUp</span>
      </Link>

      {env.isDemoMode && (
        <div data-demo-chrome className="mx-3 mb-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wider text-action">Live Demo</p>
          <div className="mt-2"><DemoScenarioSwitcher tone="light" /></div>
        </div>
      )}

      <button
        onClick={() => window.dispatchEvent(new Event('everyup:command-palette'))}
        className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-ui-border bg-bg-main px-3 py-1.5 text-text-dim transition-colors hover:border-primary/40 hover:text-text-base"
      >
        <MaterialIcon size={20} name="search" className="shrink-0" />
        <span className="flex-1 text-left text-xs">검색</span>
        <kbd className="font-sans rounded border border-ui-border px-1 py-0.5 text-xs font-medium">{navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="주 메뉴">
        {NAV_SECTIONS.map((section, i) => (
          <Fragment key={section.to}>
            {section.group && section.group !== NAV_SECTIONS[i - 1]?.group && (
              <p className="px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wider text-text-dim">{section.group}</p>
            )}
            <NavItem
              // 개요는 장애 목록으로 바로 내린다 — 배지가 가리키는 곳이다.
              to={section.to === '/' ? '/#attention' : section.to}
              icon={section.icon}
              label={section.label}
              active={current?.to === section.to}
              badge={section.to === '/' ? failureCount : undefined}
            />
          </Fragment>
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <IconButton icon={theme === 'light' ? 'dark_mode' : 'light_mode'} label="테마 전환" tone="quiet" size="sm" onClick={toggleTheme} />
        </div>
      </div>
    </aside>
  );
}
