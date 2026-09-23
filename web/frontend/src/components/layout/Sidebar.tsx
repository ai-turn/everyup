import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { MaterialIcon } from '../common';
import { api, type AgentServiceFlat } from '../../services/api';
import { env } from '../../config/env';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';
import { DemoScenarioSwitcher } from './DemoScenarioSwitcher';

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
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-ui-hover hover:text-text-base'
      }`}
    >
      <MaterialIcon size={20} name={icon} className="shrink-0" />
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && <span className="ml-auto shrink-0 rounded bg-status-error/10 px-1.5 py-px text-xs text-status-error">{badge}</span>}
    </Link>
  );
}

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();


  const location = useLocation();
  const [services, setServices] = useState<AgentServiceFlat[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await api.getAllAgentServicesFlat();
        if (alive) setServices(data ?? []);
      } catch {
        // Navigation remains available even when its alert badge cannot load.
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const path = location.pathname;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ui-border bg-bg-surface lg:flex">
      <Link to="/" className="group flex h-16 shrink-0 items-center gap-2 px-4">
        <img src={theme === 'dark' ? logoDark : logo} alt="EveryUp" className="h-9 w-9 object-contain" />
        <span className="text-lg font-bold tracking-tight text-text-base transition-colors group-hover:text-primary">EveryUp</span>
      </Link>

      {env.isDemoMode && (
        <div data-demo-chrome className="mx-3 mb-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Live Demo</p>
          <div className="mt-2"><DemoScenarioSwitcher tone="light" /></div>
        </div>
      )}

      <button
        onClick={() => window.dispatchEvent(new Event('everyup:command-palette'))}
        className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-ui-border bg-bg-main px-3 py-1.5 text-text-dim transition-colors hover:border-primary/40 hover:text-text-base"
      >
        <MaterialIcon size={20} name="search" className="shrink-0" />
        <span className="flex-1 text-left text-xs">검색</span>
        <kbd className="font-sans rounded border border-ui-border px-1 py-0.5 text-xs font-medium">{navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl K'}</kbd>
      </button>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="주 메뉴">
        <NavItem to="/#attention" icon="dashboard" label="개요" active={path === '/'} badge={services.filter((service) => !service.healthy).length} />
        <NavItem to="/projects" icon="folder_open" label="Projects" active={path.startsWith('/projects')} />
        <NavItem to="/environments" icon="dns" label="Docker 환경" active={path.startsWith('/environments') || path.startsWith('/agents/') || path.startsWith('/services/')} />
        <p className="px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wider text-text-dim">관측</p>
        <NavItem to="/uptime" icon="monitor_heart" label="업타임" active={path.startsWith('/uptime')} />
        <NavItem to="/logs" icon="article" label="로그" active={path.startsWith('/logs')} />
        <NavItem to="/infrastructure" icon="memory" label="인프라" active={path.startsWith('/infrastructure')} />
        <NavItem to="/api" icon="api" label="API 요청" active={path.startsWith('/api')} />
        <NavItem to="/metrics" icon="monitoring" label="메트릭" active={path.startsWith('/metrics')} />
        <p className="px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wider text-text-dim">대응 및 관리</p>
        <NavItem to="/alerts" icon="notifications" label="알림" active={path.startsWith('/alerts')} />
        <NavItem to="/settings" icon="settings" label="환경 설정" active={path.startsWith('/settings')} />
      </nav>

      <div className="flex shrink-0 flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <button onClick={toggleTheme} aria-label="테마 전환" title="테마 전환" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-ui-hover hover:text-text-base">
            <MaterialIcon size={20} name={theme === 'light' ? 'dark_mode' : 'light_mode'} />
          </button>
        </div>
      </div>
    </aside>
  );
}
