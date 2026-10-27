import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  Button, ConfirmDialog, EmptyState, ListToolbar, MaterialIcon, PageHeader, SearchInput,
  ListViewToggle, StatusLight,
} from '../../components/common';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UPTIME_STATE_LIGHT, uptimeState, type UptimeState } from '../../features/uptime/uptimeState';
import { UptimeTargets } from '../../features/uptime/components/UptimeTargets';
import { api, type UptimeMonitor, type UptimeMonitorInput } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { useListView } from '../../hooks/useListView';

const UptimeListPrototype = import.meta.env.DEV ? lazy(() => import('./UptimeList.prototype').then((module) => ({ default: module.UptimeListPrototype }))) : null;

const STATUS_FILTERS: UptimeState[] = ['up', 'down', 'waiting', 'paused'];
const parseStatus = (value: string | null): UptimeState | null =>
  STATUS_FILTERS.includes(value as UptimeState) ? value as UptimeState : null;

// 일시정지·재개는 상태만 바꾸지만 PUT은 전체 설정을 받는다.
const withActive = (monitor: UptimeMonitor, isActive: boolean): UptimeMonitorInput => ({
  name: monitor.name, type: monitor.type, url: monitor.type === 'http' ? monitor.url : undefined,
  host: monitor.type === 'tcp' ? monitor.url : undefined, port: monitor.port, method: monitor.method,
  expectedStatus: monitor.expectedStatus, timeout: monitor.timeout, interval: monitor.interval, isActive,
});

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
  const status = parseStatus(searchParams.get('status'));
  const { view, setView } = useListView();
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const setQuery = (value: string) => setParam('q', value);
  const setStatus = (value: UptimeState | null) => setParam('status', value);
  const returnTo = `/uptime${searchParams.size ? `?${searchParams}` : ''}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [changingMonitor, setChangingMonitor] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
  const filteredMonitors = useMemo(() => monitors.filter((monitor) => (!status || uptimeState(monitor) === status) && (!normalizedQuery
    || monitor.name.toLowerCase().includes(normalizedQuery)
    || (monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url).toLowerCase().includes(normalizedQuery))), [monitors, normalizedQuery, status]);
  // 검색·필터로 가려진 대상은 일괄 작업에서 빠진다 — 보이지 않는 것을 지우지 않게.
  const selectedMonitors = filteredMonitors.filter((monitor) => selected.has(monitor.id));
  const visibleSelection = new Set(selectedMonitors.map((monitor) => monitor.id));
  const select = (ids: string[], checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    ids.forEach((id) => { if (checked) next.add(id); else next.delete(id); });
    return next;
  });

  const saveMonitor = async (input: UptimeMonitorInput) => {
    await api.createUptimeMonitor(input);
    await load();
  };

  const setActive = async (monitor: UptimeMonitor) => {
    if (changingMonitor) return;
    setChangingMonitor(monitor.id);
    try {
      await api.updateUptimeMonitor(monitor.id, withActive(monitor, !monitor.isActive));
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setChangingMonitor(null);
    }
  };

  // ponytail: 대상마다 기존 API를 한꺼번에 부른다 — 수십 개 단위가 흔해지면 일괄 엔드포인트로.
  const runBulk = async (targets: UptimeMonitor[], run: (monitor: UptimeMonitor) => Promise<unknown>, verb: string) => {
    setBulkWorking(true);
    const results = await Promise.allSettled(targets.map(run));
    const failed = targets.filter((_, index) => results[index].status === 'rejected').map((monitor) => monitor.id);
    const firstError = results.find((result) => result.status === 'rejected')?.reason;
    // 실패한 것만 선택에 남겨 다시 시도할 수 있게 한다.
    setSelected(new Set(failed));
    setBulkWorking(false);
    if (failed.length > 0) toast.error(`${failed.length}개를 ${verb}하지 못했습니다. ${getErrorMessage(firstError)}`);
    await load();
  };
  const toPause = selectedMonitors.filter((monitor) => monitor.isActive);
  const toResume = selectedMonitors.filter((monitor) => !monitor.isActive);
  const bulkDisabled = bulkWorking || loading || Boolean(error) || changingMonitor !== null;

  const empty = filteredMonitors.length === 0;
  const hasTargets = monitors.length > 0;
  const searchingTargets = Boolean(normalizedQuery) && hasTargets;

  const counts = Object.fromEntries(STATUS_FILTERS.map((key) => [key, monitors.filter((monitor) => uptimeState(monitor) === key).length])) as Record<UptimeState, number>;

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
          {/* 숫자를 누르면 그 상태만 본다(다시 누르면 해제). Uptime Kuma의 상태 필터를 요약에 겹쳤다. */}
          <div role="group" aria-label="상태로 거르기" className="-ml-2 flex flex-wrap items-center gap-x-2 gap-y-2">
            {STATUS_FILTERS.map((key) => {
              const [tone, label] = UPTIME_STATE_LIGHT[key];
              return (
                <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(status === key ? null : key)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-ui-hover-soft aria-pressed:bg-ui-hover">
                  <StatusLight label={label} tone={key === 'down' && counts.down === 0 ? 'idle' : tone} />
                  <span className="text-xl font-medium tabular-nums">{counts[key]}</span>
                </button>
              );
            })}
          </div>
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

      {selectedMonitors.length > 0 && (
        <div role="region" aria-label="선택한 대상 작업" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ui-border bg-bg-surface px-4 py-2">
          <p className="mr-auto text-sm text-text-base"><span className="font-medium tabular-nums">{selectedMonitors.length}</span>개 선택</p>
          <Button size="sm" variant="secondary" disabled={bulkDisabled || toPause.length === 0} loading={bulkWorking}
            onClick={() => void runBulk(toPause, (monitor) => api.updateUptimeMonitor(monitor.id, withActive(monitor, false)), '일시정지')}>
            <MaterialIcon name="pause" />일시정지
          </Button>
          <Button size="sm" variant="secondary" disabled={bulkDisabled || toResume.length === 0}
            onClick={() => void runBulk(toResume, (monitor) => api.updateUptimeMonitor(monitor.id, withActive(monitor, true)), '재개')}>
            <MaterialIcon name="play_arrow" />재개
          </Button>
          <Button size="sm" variant="destructive" disabled={bulkDisabled} onClick={() => setConfirmingDelete(true)}>
            <MaterialIcon name="delete_outline" />삭제
          </Button>
          <Button size="sm" variant="ghost" disabled={bulkWorking} onClick={() => setSelected(new Set())}>선택 해제</Button>
        </div>
      )}

      {loading && !hasTargets ? <ServiceListSkeleton /> : empty ? (
        !error && (status && hasTargets
          ? <EmptyState icon="monitor_heart" title={`${UPTIME_STATE_LIGHT[status][1]} 상태인 대상이 없습니다`} description="다른 상태를 고르거나 필터를 해제해 보세요.">
            <Button variant="secondary" onClick={() => setStatus(null)}>필터 해제</Button>
          </EmptyState>
          : searchingTargets
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
            returnTo={returnTo} loading={loading || bulkWorking} changingMonitor={changingMonitor} onSetActive={(monitor) => void setActive(monitor)}
            selected={visibleSelection} onSelect={select} />
        </section>
      )}

      {adding && <UptimeMonitorDialog monitor={null} onClose={() => setAdding(false)} onSave={saveMonitor} />}
      <ConfirmDialog
        isOpen={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => { setConfirmingDelete(false); void runBulk(selectedMonitors, (monitor) => api.deleteUptimeMonitor(monitor.id), '삭제'); }}
        title={`업타임 ${selectedMonitors.length}개를 삭제할까요?`}
        message={<>
          <strong className="break-all font-medium text-text-base">{selectedMonitors.slice(0, 3).map((monitor) => monitor.name).join(', ')}</strong>
          {selectedMonitors.length > 3 && ` 외 ${selectedMonitors.length - 3}개`}를 삭제하면 수집된 상태와 체크 기록도 함께 삭제됩니다.
        </>}
        confirmLabel="삭제"
        isProcessing={bulkWorking}
      />
    </div>
  );
}
