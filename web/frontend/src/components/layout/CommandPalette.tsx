import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../common';
import { SCRIM_PANEL, useOverlay } from '../../hooks/useOverlay';
import { api, type AgentServiceFlat, type ConnectedAgent, type ObservedService, type Server, type UptimeMonitor } from '../../services/api';
import { NAV_SECTIONS } from './navSections';
import { ALL_LOGS_PATH, appPath, monitorPath, serverPath } from '../../features/servers/serverPaths';
import { containerPath } from '../../features/docker/dockerPaths';

// Fired by the sidebar search button; ⌘K/Ctrl+K toggles directly.
export const OPEN_PALETTE_EVENT = 'everyup:command-palette';

interface PaletteItem {
  id: string;
  icon: string; // must be registered in MaterialIcon's iconMap
  label: string;
  meta?: string;
  to: string;
  healthy?: boolean; // service items show a status dot instead of an icon
}

export function CommandPalette() {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [apps, setApps] = useState<ObservedService[]>([]);
  const [dataStatus, setDataStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closePalette = useCallback(() => setOpen(false), []);

  useOverlay(open, closePalette, dialogRef);

  const showPalette = () => {
    setQuery('');
    setIndex(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          showPalette();
        }
      }
    };
    const onOpen = () => showPalette();
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [closePalette, open]);

  // Fresh data on every open; palette renders fine with none (pages only).
  useEffect(() => {
    if (!open) return;
    const loadTimer = window.setTimeout(() => {
      setDataStatus('loading');
      // 하나가 실패해도 불러온 대상은 검색할 수 있게 한다.
      // Docker 호스트도 서버다(ADR 0012): 서버 목록은 Docker 서버를 함께 받는다. Docker Collector 목록은 컨테이너의 서버를 찾는 데 쓴다.
      const lists = [api.getAgents(), api.getAllAgentServicesFlat(), api.getServers({ includeDocker: true }), api.getUptimeMonitors(), api.getObservedServices()] as const;
      void Promise.allSettled(lists)
        .then((results) => {
          const [agts, svcs, srvs, mons, obs] = results;
          if (agts.status === 'fulfilled') setAgents(agts.value ?? []);
          if (svcs.status === 'fulfilled') setServices(svcs.value ?? []);
          if (srvs.status === 'fulfilled') setServers(srvs.value ?? []);
          if (mons.status === 'fulfilled') setMonitors(mons.value ?? []);
          if (obs.status === 'fulfilled') setApps(obs.value ?? []);
          setDataStatus(results.every((result) => result.status === 'fulfilled') ? 'idle' : 'error');
        });
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [open]);

  const items: PaletteItem[] = useMemo(() => {
    const serverNames = new Map(servers.map((server) => [server.id, server.name]));
    // 모니터와 앱은 서버의 대상이다. 서버 이름을 몰라도(서버 목록 조회 실패) 대상은 찾을 수 있다.
    const ownerOf = (serverId: string, noun: string) => (serverNames.has(serverId) ? `${serverNames.get(serverId)}의 ${noun}` : noun);
    // 컨테이너의 서버는 그것을 발견한 Docker Collector의 서버다. Collector 목록을 모르면 Collector ID가 곧 서버 ID다(migrateV59).
    const serverOfCollector = (agentId: string) => agents.find((agent) => agent.id === agentId)?.serverId || agentId;
    return [
    ...NAV_SECTIONS.map((section) => ({
      id: `page-${section.to.slice(1) || 'home'}`, icon: section.icon, label: section.label, to: section.to,
      ...(section.to === '/' ? { meta: '홈' } : {}),
    })),
    // 사이드바에 없는 서버 섹션의 화면(설계 6.6)
    { id: 'page-logs', icon: 'article', label: '전체 로그', meta: '서버', to: ALL_LOGS_PATH },
    ...servers.map((server) => ({
      id: `server-${server.id}`, icon: 'dns', label: server.name, meta: '서버', to: serverPath(server.id),
    })),
    ...monitors.flatMap((monitor) => monitor.serverId ? [{
      id: `monitor-${monitor.id}`, icon: 'monitor_heart', label: monitor.name, meta: ownerOf(monitor.serverId, '모니터'),
      to: monitorPath(monitor.serverId, monitor.id),
    }] : []),
    ...apps.flatMap((app) => app.serverId ? [{
      id: `app-${app.id}`, icon: 'hub', label: app.name, meta: ownerOf(app.serverId, '앱'), to: appPath(app.serverId, app.id),
    }] : []),
    ...services.map((s) => {
      // 컨테이너도 서버의 대상이다(모니터, 앱과 같은 `<서버>의 …`).
      const serverId = serverOfCollector(s.agentId);
      return { id: `svc-${s.agentId}-${s.key}`, icon: '', label: s.name, meta: ownerOf(serverId, '컨테이너'), to: containerPath(serverId, s.key), healthy: s.healthy };
    }),
    ];
  }, [agents, apps, monitors, servers, services]);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.meta?.toLowerCase().includes(q));
  }, [items, query]);

  const go = (item: PaletteItem) => {
    closePalette();
    navigate(item.to);
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[index]) go(filtered[index]);
    }
  };

  // Keep the active row visible while arrowing through a long list.
  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4 ${SCRIM_PANEL}`}
      role="presentation"
      onClick={closePalette}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="검색"
        tabIndex={-1}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 border-b border-border focus-within:outline-2 focus-within:outline-focus focus-within:-outline-offset-2">
          <MaterialIcon size={20} name="search" className="text-text-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onInputKeyDown}
            aria-label="검색"
            aria-controls="command-palette-results"
            aria-activedescendant={filtered[index] ? `command-palette-option-${filtered[index].id}` : undefined}
            placeholder="서버, 대상, 페이지 검색…"
            className="flex-1 bg-transparent py-3.5 type-control max-sm:text-base text-text outline-none placeholder:text-text-faint"
          />
          <kbd className="shrink-0 font-sans px-1.5 py-0.5 rounded border border-border type-label-sm text-text-faint">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div id="command-palette-results" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="py-8 text-center type-body text-text-muted">검색 결과가 없습니다</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                id={`command-palette-option-${item.id}`}
                role="option"
                aria-selected={i === index}
                onClick={() => go(item)}
                onMouseMove={() => setIndex(i)}
                className={`w-full flex min-h-11 items-center gap-2 px-4 py-2 text-left transition-colors sm:min-h-0 ${
                  i === index
                    ? 'bg-accent-bg text-text'
                    : 'text-text'
                }`}
              >
                {item.icon ? (
                  <MaterialIcon size={20} name={item.icon} className="shrink-0 text-text-faint" />
                ) : (
                  <span
                    role="img"
                    aria-label={item.healthy ? '정상' : '장애'}
                    className={`ml-1 mr-1 h-1.5 w-1.5 rounded-full shrink-0 ${item.healthy ? 'bg-ok' : 'bg-crit'}`}
                  />
                )}
                <span className="type-control truncate">{item.label}</span>
                {item.meta && (
                  <span className="ml-auto type-caption text-text-faint shrink-0">{item.meta}</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border type-caption text-text-faint">
          <span>↑↓ 이동</span>
          <span>Enter 열기</span>
          {dataStatus === 'loading' && <span className="ml-auto" role="status">대상 불러오는 중</span>}
          {dataStatus === 'error' && <span className="ml-auto text-crit-text" role="status">일부 대상을 불러오지 못했습니다</span>}
        </div>
      </div>
    </div>
  );
}
