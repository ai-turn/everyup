import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  Button, EmptyState, ListToolbar, MaterialIcon, PageHeader, SearchInput,
  ListViewToggle, StatusLight,
} from '../../components/common';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeTargets } from '../../features/uptime/components/UptimeTargets';
import { api, type AgentServiceFlat, type UptimeMonitor, type UptimeMonitorInput } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { dockerUptimeState } from '../../utils/operationalStatus';
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

interface LoadErrors {
  services?: string;
  monitors?: string;
}

export function AgentServiceCapabilityPage() {

  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
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
  const [errors, setErrors] = useState<LoadErrors>({});
  const [adding, setAdding] = useState(false);
  const [changingMonitor, setChangingMonitor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [servicesResult, monitorsResult] = await Promise.allSettled([
        api.getAllAgentServicesFlat(),
        api.getUptimeMonitors(),
      ]);
      const nextErrors: LoadErrors = {};
      if (servicesResult.status === 'fulfilled') setAgentServices(servicesResult.value ?? []);
      else nextErrors.services = getErrorMessage(servicesResult.reason);
      if (monitorsResult.status === 'fulfilled') setMonitors(monitorsResult.value ?? []);
      else nextErrors.monitors = getErrorMessage(monitorsResult.reason);
      setErrors(nextErrors);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredAgentServices = useMemo(() => agentServices.filter((service) => !normalizedQuery
    || service.name.toLowerCase().includes(normalizedQuery)
    || service.agentName.toLowerCase().includes(normalizedQuery)
    || (service.endpoint || service.key).toLowerCase().includes(normalizedQuery)), [agentServices, normalizedQuery]);
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

  const empty = filteredAgentServices.length === 0 && filteredMonitors.length === 0;
  const hasTargets = agentServices.length + monitors.length > 0;
  const searchingTargets = Boolean(normalizedQuery) && hasTargets;
  const hasErrors = Boolean(errors.services || errors.monitors);
  const hasPreviousData = Boolean((errors.services && agentServices.length > 0) || (errors.monitors && monitors.length > 0));

  const dockerStates = agentServices.map(dockerUptimeState);
  const paused = monitors.filter((monitor) => !monitor.isActive).length + dockerStates.filter((state) => state === 'paused').length;
  const waiting = monitors.filter((monitor) => monitor.isActive && monitor.status === 'unknown').length + dockerStates.filter((state) => state === 'waiting').length;
  const stale = dockerStates.filter((state) => state === 'stale').length;
  const down = monitors.filter((monitor) => monitor.isActive && monitor.status === 'unhealthy').length
    + dockerStates.filter((state) => state === 'down').length;
  const up = monitors.filter((monitor) => monitor.isActive && monitor.status === 'healthy').length
    + dockerStates.filter((state) => state === 'up').length;

  const prototypeVariant = import.meta.env.DEV ? searchParams.get('variant') : null;
  if (UptimeListPrototype && prototypeVariant && ['B', 'C'].includes(prototypeVariant) && !loading) {
    return <Suspense fallback={<p className="p-6 text-text-muted">설계안을 불러오는 중</p>}><UptimeListPrototype variant={prototypeVariant} services={agentServices} monitors={monitors} errors={errors} query={query} onQueryChange={setQuery} /></Suspense>;
  }

  return (
    <div className={prototypeVariant ? 'pb-36' : ''}>
      <PageHeader title="업타임" subtitle="서비스가 정상적으로 응답하는지 확인하고, 장애가 발생한 대상을 빠르게 찾습니다.">
        <Button onClick={() => setAdding(true)}><MaterialIcon name="add" />추가</Button>
      </PageHeader>

      {!loading && !hasErrors && hasTargets && (
        <section aria-label="업타임 상태 요약" className="mb-5 border-b border-ui-border pb-4">
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2"><dt><StatusLight label="정상" tone="healthy" /></dt><dd className="text-xl font-medium tabular-nums">{up}</dd></div>
            <div className="flex items-center gap-2"><dt><StatusLight label="장애" tone={down ? 'error' : 'idle'} /></dt><dd className="text-xl font-medium tabular-nums">{down}</dd></div>
            <div className="flex items-center gap-2"><dt><StatusLight label="정지·대기·지연" tone="idle" /></dt><dd className="text-xl font-medium tabular-nums">{paused + waiting + stale}</dd></div>
          </dl>
          <p className="mt-2 type-caption text-text-muted">전체 {monitors.length + agentServices.length}개 대상 · 일시정지 {paused}개 · 확인 대기 {waiting}개{stale ? ` · 수집 지연 ${stale}개` : ''}</p>
        </section>
      )}

      <ListToolbar search={
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="서비스 또는 대상 검색" aria-label="서비스 또는 대상 검색" />
      }>
        <ListViewToggle view={view} onChange={setView} />
      </ListToolbar>

      {hasErrors && (
        <section role="status" className="mb-6 flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MaterialIcon name="sync_problem" className="mt-0.5 shrink-0 text-status-warn" />
            <div>
              <p className="type-label text-text-base">업타임 정보를 불러오지 못했습니다</p>
              {errors.services && <p className="mt-0.5 type-body text-text-muted">Docker 서비스: {errors.services}</p>}
              {errors.monitors && <p className="mt-0.5 type-body text-text-muted">업타임 모니터: {errors.monitors}</p>}
              <p className="mt-1 type-body text-text-muted">
                {hasPreviousData ? '실패한 영역은 이전에 불러온 정보입니다. 최신 상태는 확인할 수 없습니다.' : '실패한 영역의 상태는 확인할 수 없습니다.'}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="min-w-28" loading={loading} onClick={() => void load()}>다시 시도</Button>
        </section>
      )}

      {loading && !hasTargets ? <ServiceListSkeleton /> : empty ? (
        !hasErrors && (
          <EmptyState icon="monitor_heart" title={searchingTargets ? '검색 결과가 없습니다' : '표시할 업타임 대상이 없습니다'} description={searchingTargets ? '검색어를 바꿔 다시 시도해 보세요.' : 'Docker 환경을 연결하거나 업타임 모니터를 직접 추가해 보세요.'} action={searchingTargets ? undefined : { label: '추가', onClick: () => setAdding(true) }} />
        )
      ) : (
        <section aria-label="업타임 대상" aria-busy={loading || undefined}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">모니터링 대상</h2>
            <span className="text-xs text-text-dim">{filteredMonitors.length + filteredAgentServices.length}</span>
          </div>
          <UptimeTargets view={view} services={filteredAgentServices} monitors={filteredMonitors} errors={errors}
            returnTo={returnTo} loading={loading} changingMonitor={changingMonitor} onSetActive={(monitor) => void setActive(monitor)} />
        </section>
      )}

      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={saveMonitor} />}
    </div>
  );
}
