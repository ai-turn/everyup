import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  Button, EmptyState, ListToolbar, MaterialIcon, PageHeader, SearchInput,
  ListViewToggle, StatusLight,
} from '../../components/common';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeTargets } from '../../features/uptime/components/UptimeTargets';
import { api, type UptimeMonitor, type UptimeMonitorInput } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { useListView } from '../../hooks/useListView';

const UptimeListPrototype = import.meta.env.DEV ? lazy(() => import('./UptimeList.prototype').then((module) => ({ default: module.UptimeListPrototype }))) : null;

function ServiceListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      ))}
    </div>
  );
}

export function AgentServiceCapabilityPage() {
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const { view, setView } = useListView();
  const setQuery = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value); else next.delete('q');
    setSearchParams(next, { replace: true });
  };
  const returnTo = `/uptime${searchParams.size ? `?${searchParams}` : ''}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [changingMonitor, setChangingMonitor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMonitors(await api.getUptimeMonitors() ?? []);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  // 업타임은 직접 등록한 모니터만 담는다(ADR 0007). Docker Collector의 검사는 Docker 환경에서 본다.
  const normalizedQuery = query.trim().toLowerCase();
  const filteredMonitors = useMemo(() => monitors.filter((monitor) => !normalizedQuery
    || monitor.name.toLowerCase().includes(normalizedQuery)
    || (monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url).toLowerCase().includes(normalizedQuery)), [monitors, normalizedQuery]);

  const saveMonitor = async (input: UptimeMonitorInput) => {
    await api.createUptimeMonitor(input);
    await load();
  };

  const setActive = async (monitor: UptimeMonitor) => {
    if (changingMonitor) return;
    setChangingMonitor(monitor.id);
    try {
      await api.updateUptimeMonitor(monitor.id, {
        name: monitor.name, type: monitor.type, url: monitor.type === 'http' ? monitor.url : undefined,
        host: monitor.type === 'tcp' ? monitor.url : undefined, port: monitor.port, method: monitor.method,
        expectedStatus: monitor.expectedStatus, timeout: monitor.timeout, interval: monitor.interval,
        isActive: !monitor.isActive,
      });
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setChangingMonitor(null);
    }
  };

  const empty = filteredMonitors.length === 0;
  const hasTargets = monitors.length > 0;
  const searchingTargets = Boolean(normalizedQuery) && hasTargets;

  const paused = monitors.filter((monitor) => !monitor.isActive).length;
  const waiting = monitors.filter((monitor) => monitor.isActive && monitor.status === 'unknown').length;
  const down = monitors.filter((monitor) => monitor.isActive && monitor.status === 'unhealthy').length;
  const up = monitors.filter((monitor) => monitor.isActive && monitor.status === 'healthy').length;

  const prototypeVariant = import.meta.env.DEV ? searchParams.get('variant') : null;
  if (UptimeListPrototype && prototypeVariant && ['B', 'C'].includes(prototypeVariant) && !loading) {
    return <Suspense fallback={<p className="p-6 text-text-muted">설계안을 불러오는 중</p>}><UptimeListPrototype variant={prototypeVariant} services={[]} monitors={monitors} errors={{ monitors: error ?? undefined }} query={query} onQueryChange={setQuery} /></Suspense>;
  }

  return (
    <div className={prototypeVariant ? 'pb-36' : ''}>
      <PageHeader title="업타임" subtitle="서비스가 정상적으로 응답하는지 확인하고, 장애가 발생한 대상을 빠르게 찾습니다.">
        <Button onClick={() => setAdding(true)}><MaterialIcon name="add" />추가</Button>
      </PageHeader>

      {!loading && !error && hasTargets && (
        <section aria-label="업타임 상태 요약" className="mb-5 border-b border-ui-border pb-4">
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2"><dt><StatusLight label="정상" tone="healthy" /></dt><dd className="text-xl font-medium tabular-nums">{up}</dd></div>
            <div className="flex items-center gap-2"><dt><StatusLight label="장애" tone={down ? 'error' : 'idle'} /></dt><dd className="text-xl font-medium tabular-nums">{down}</dd></div>
            <div className="flex items-center gap-2"><dt><StatusLight label="확인 대기" tone="idle" /></dt><dd className="text-xl font-medium tabular-nums">{waiting}</dd></div>
            <div className="flex items-center gap-2"><dt><StatusLight label="일시정지" tone="idle" /></dt><dd className="text-xl font-medium tabular-nums">{paused}</dd></div>
          </dl>
        </section>
      )}

      <ListToolbar search={
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="서비스 또는 대상 검색" aria-label="서비스 또는 대상 검색" />
      }>
        <ListViewToggle view={view} onChange={setView} />
      </ListToolbar>

      {error && (
        <section role="status" className="mb-6 flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MaterialIcon name="sync_problem" className="mt-0.5 shrink-0 text-status-warn" />
            <div>
              <p className="type-label text-text-base">업타임 정보를 불러오지 못했습니다</p>
              <p className="mt-0.5 type-body text-text-muted">업타임 모니터: {error}</p>
              <p className="mt-1 type-body text-text-muted">
                {hasTargets ? '목록은 이전에 불러온 정보입니다. 최신 상태는 확인할 수 없습니다.' : '모니터 상태를 확인할 수 없습니다.'}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="min-w-28" loading={loading} onClick={() => void load()}>다시 시도</Button>
        </section>
      )}

      {loading && !hasTargets ? <ServiceListSkeleton /> : empty ? (
        !error && (searchingTargets
          ? <EmptyState icon="monitor_heart" title="검색 결과가 없습니다" description="검색어를 바꿔 다시 시도해 보세요." />
          : <EmptyState icon="monitor_heart" title="표시할 업타임 대상이 없습니다" description="확인할 주소를 업타임 모니터로 추가해 보세요.">
            <div className="flex flex-col items-center gap-4">
              <Button onClick={() => setAdding(true)}>추가</Button>
              <DockerEnvironmentHint />
            </div>
          </EmptyState>)
      ) : (
        <section aria-label="업타임 대상" aria-busy={loading || undefined}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">모니터링 대상</h2>
            <span className="text-xs text-text-dim">{filteredMonitors.length}</span>
          </div>
          <UptimeTargets view={view} monitors={filteredMonitors} error={Boolean(error)}
            returnTo={returnTo} loading={loading} changingMonitor={changingMonitor} onSetActive={(monitor) => void setActive(monitor)} />
        </section>
      )}

      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={saveMonitor} />}
    </div>
  );
}
