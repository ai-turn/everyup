import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../common';
import { SCRIM_PANEL, useOverlay } from '../../hooks/useOverlay';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';

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
      Promise.all([api.getAgents(), api.getAllAgentServicesFlat()])
        .then(([agts, svcs]) => {
          setAgents(agts ?? []);
          setServices(svcs ?? []);
          setDataStatus('idle');
        })
        .catch(() => setDataStatus('error'));
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [open]);

  const items: PaletteItem[] = useMemo(() => [
    { id: 'page-uptime', icon: 'monitor_heart', label: '업타임', to: '/uptime' },
    { id: 'page-logs', icon: 'article', label: '로그', to: '/logs' },
    { id: 'page-infrastructure', icon: 'memory', label: '인프라', to: '/infrastructure' },
    { id: 'page-api', icon: 'api', label: 'API 요청', to: '/api' },
    { id: 'page-metrics', icon: 'monitoring', label: '메트릭', to: '/metrics' },
    { id: 'page-home', icon: 'dashboard', label: '개요', meta: '홈', to: '/' },
    { id: 'page-projects', icon: 'folder_open', label: 'Projects', to: '/projects' },
    { id: 'page-alerts', icon: 'notifications', label: '알림', to: '/alerts' },
    { id: 'page-settings', icon: 'settings', label: '환경설정', to: '/settings' },
    ...agents.map((a) => ({
      id: `agent-${a.id}`, icon: 'folder_open', label: a.name, meta: 'Docker 환경', to: `/agents/${a.id}`,
    })),
    ...services.map((s) => ({
      id: `svc-${s.agentId}-${s.key}`, icon: '', label: s.name, meta: s.agentName,
      to: `/services/${s.agentId}/${encodeURIComponent(s.key)}`, healthy: s.healthy,
    })),
  ], [agents, services]);

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
        className="w-full max-w-lg overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 border-b border-ui-border">
          <MaterialIcon size={20} name="search" className="text-text-dim shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onInputKeyDown}
            aria-label="검색"
            aria-controls="command-palette-results"
            aria-activedescendant={filtered[index] ? `command-palette-option-${filtered[index].id}` : undefined}
            placeholder="Docker 환경, 서비스, 페이지 검색..."
            className="flex-1 bg-transparent py-3.5 text-sm text-text-base outline-none placeholder:text-text-dim"
          />
          <kbd className="shrink-0 font-sans px-1.5 py-0.5 rounded border border-ui-border text-xs font-medium text-text-dim">
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
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                  i === index
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary'
                }`}
              >
                {item.icon ? (
                  <MaterialIcon size={20} name={item.icon} className="shrink-0 text-text-dim" />
                ) : (
                  <span
                    role="img"
                    aria-label={item.healthy ? '정상' : '장애'}
                    className={`ml-1 mr-1 h-1.5 w-1.5 rounded-full shrink-0 ${item.healthy ? 'bg-status-healthy' : 'bg-status-error'}`}
                  />
                )}
                <span className="text-sm truncate">{item.label}</span>
                {item.meta && (
                  <span className="ml-auto text-xs text-text-dim shrink-0">{item.meta}</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-ui-border text-xs text-text-dim">
          <span>↑↓ 이동</span>
          <span>Enter 열기</span>
          {dataStatus === 'loading' && <span className="ml-auto" role="status">대상 불러오는 중</span>}
          {dataStatus === 'error' && <span className="ml-auto text-status-error" role="status">일부 대상을 불러오지 못했습니다</span>}
        </div>
      </div>
    </div>
  );
}
