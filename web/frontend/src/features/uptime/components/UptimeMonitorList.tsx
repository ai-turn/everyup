import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Button, ConfirmDialog, EmptyState, ListToolbar, ListViewToggle, MaterialIcon, SearchInput, StatusLight,
} from '../../../components/common';
import { useListView } from '../../../hooks/useListView';
import { api, type UptimeMonitor, type UptimeMonitorInput } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { monitorInput } from '../monitorInput';
import { UPTIME_STATE_LIGHT, uptimeState, type UptimeState } from '../uptimeState';
import { useUptimeMonitorList } from '../useUptimeMonitorList';
import { UptimeMonitorDialog } from './UptimeMonitorDialog';
import { UptimeRefreshControls } from './UptimeRefreshControls';
import { UptimeTargets } from './UptimeTargets';

const STATUS_FILTERS: UptimeState[] = ['down', 'up', 'waiting', 'paused'];
const parseStatus = (value: string | null): UptimeState | null =>
  STATUS_FILTERS.includes(value as UptimeState) ? value as UptimeState : null;

function ServiceListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-xl border border-ui-border-soft bg-bg-surface" />
      ))}
    </div>
  );
}

/** 업타임 모니터 목록의 본문: 검색, 상태 필터, 보기 전환, 카드 보기의 선택과 일괄 작업, 최근 체크. */
export function UptimeMonitorList({ filter, hrefFor, createDefaults, renderControls, onChanged, monitors: given, searchLabel = '서비스 또는 대상 검색' }: {
  /** 이 목록이 다루는 모니터만 고른다 */
  filter: (monitor: UptimeMonitor) => boolean;
  hrefFor: (monitor: UptimeMonitor) => string;
  /** 새 모니터를 만들 때 입력에 덧붙일 값(예: { serverId }) */
  createDefaults?: Partial<UptimeMonitorInput>;
  /** 목록 화면의 조작(보기 전환, 추가 버튼)을 그릴 자리. 없으면 목록 위에 그린다 */
  renderControls?: (controls: { viewToggle: ReactNode; addButton: ReactNode; refresh: ReactNode }) => ReactNode;
  /** 변경한 뒤. 약속을 돌려주면 끝날 때까지 조작을 막아 둔다(옛 값으로 다시 누르지 않게). */
  onChanged?: () => void | Promise<void>;
  /**
   * 부모가 이미 불러온 모니터. 주면 목록은 따로 불러오거나 주기적으로 갱신하지 않고(갱신의 주체는 부모 하나),
   * 변경한 뒤에는 onChanged로 부모가 다시 불러온다.
   */
  monitors?: UptimeMonitor[];
  /** 검색창의 안내 문구이자 접근 가능한 이름. 서버 탭은 "모니터 검색"이다. */
  searchLabel?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  // 입력값은 로컬 상태가 쥔다. URL(?q=)은 react-router가 transition 안에서 반영해 값이 한 박자 늦게 돌아오므로,
  // URL에 직접 묶으면 한글 조합 중 글자가 덮여 '결제'가 'ㄱ겨결결ㅈ제제'가 됐다. URL은 공유·복귀용 사본이다.
  // ponytail: URL→입력은 마운트 때만 읽는다. 같은 화면에서 ?q=만 바뀌는 이동이 생기면 그때 동기화를 더한다.
  const [query, setQueryInput] = useState(() => searchParams.get('q') ?? '');
  const status = parseStatus(searchParams.get('status'));
  const { view, setView } = useListView();
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('inspect');
    setSearchParams(next, { replace: true });
  };
  const setQuery = (value: string) => { setQueryInput(value); setParam('q', value); };
  const setStatus = (value: UptimeState | null) => setParam('status', value);
  const returnTo = `${location.pathname}${searchParams.size ? `?${searchParams}` : ''}`;
  const [adding, setAdding] = useState(false);
  const [changingMonitor, setChangingMonitor] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const own = useUptimeMonitorList(adding || bulkWorking || changingMonitor !== null || confirmingDelete, !given);
  const { loading, refreshing, error } = given ? { loading: false, refreshing: false, error: null } : own;
  const afterChange = async () => {
    if (!given) await own.reloadAfterChange();
    await onChanged?.();
  };
  // 서버 상세에서 화살표 키로 탭을 지나가면 언마운트될 수 있다. 그 뒤에 끝난 작업은 상태를 건드리지 않는다.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const monitors = useMemo(() => (given ?? own.monitors).filter(filter), [given, own.monitors, filter]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredMonitors = useMemo(() => monitors.filter((monitor) => (!status || uptimeState(monitor) === status) && (!normalizedQuery
    || monitor.name.toLowerCase().includes(normalizedQuery)
    || (monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url).toLowerCase().includes(normalizedQuery))), [monitors, normalizedQuery, status]);
  // 검색·필터로 가려진 대상은 일괄 작업에서 빠진다 — 보이지 않는 것을 지우지 않게.
  const selectedMonitors = view === 'card' ? filteredMonitors.filter((monitor) => selected.has(monitor.id)) : [];
  const visibleSelection = new Set(selectedMonitors.map((monitor) => monitor.id));
  const select = (ids: string[], checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    ids.forEach((id) => { if (checked) next.add(id); else next.delete(id); });
    return next;
  });

  const saveMonitor = async (input: UptimeMonitorInput) => {
    await api.createUptimeMonitor({ ...input, ...createDefaults });
    await afterChange();
  };

  const setActive = async (monitor: UptimeMonitor) => {
    if (changingMonitor) return;
    setChangingMonitor(monitor.id);
    try {
      await api.updateUptimeMonitor(monitor.id, monitorInput(monitor, { isActive: !monitor.isActive }));
      await afterChange();
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    } finally {
      if (alive.current) setChangingMonitor(null);
    }
  };

  // ponytail: 대상마다 기존 API를 한꺼번에 부른다 — 수십 개 단위가 흔해지면 일괄 엔드포인트로.
  const runBulk = async (targets: UptimeMonitor[], run: (monitor: UptimeMonitor) => Promise<unknown>, verb: string) => {
    setBulkWorking(true);
    const results = await Promise.allSettled(targets.map(run));
    const failed = targets.filter((_, index) => results[index].status === 'rejected').map((monitor) => monitor.id);
    const firstError = results.find((result) => result.status === 'rejected')?.reason;
    if (failed.length > 0) toast.error(`${failed.length}개를 ${verb}하지 못했습니다. ${getErrorMessage(firstError)}`);
    // 다시 불러온 결과가 반영된 뒤에 조작을 풀어 옛 상태로 다시 누르지 않게 한다.
    try {
      await afterChange();
      // 실패한 것만 선택에 남겨 다시 시도할 수 있게 한다.
      if (alive.current) setSelected(new Set(failed));
    } finally {
      if (alive.current) setBulkWorking(false);
    }
  };
  const toPause = selectedMonitors.filter((monitor) => monitor.isActive);
  const toResume = selectedMonitors.filter((monitor) => !monitor.isActive);
  const bulkDisabled = bulkWorking || loading || Boolean(error) || changingMonitor !== null;

  const empty = filteredMonitors.length === 0;
  const hasTargets = monitors.length > 0;

  const counts = Object.fromEntries(STATUS_FILTERS.map((key) => [key, monitors.filter((monitor) => uptimeState(monitor) === key).length])) as Record<UptimeState, number>;

  const controls = {
    viewToggle: hasTargets ? <ListViewToggle view={view} onChange={(next) => { setSelected(new Set()); setView(next); }} /> : null,
    addButton: <Button onClick={() => setAdding(true)}><MaterialIcon name="add" />추가</Button>,
    refresh: given ? null : (
      <UptimeRefreshControls updatedAt={own.updatedAt} refreshing={refreshing} autoRefresh={own.autoRefresh} onAutoRefreshChange={own.changeAutoRefresh}
        onRefresh={() => void own.load()} disabled={bulkWorking || changingMonitor !== null} />
    ),
  };

  return (
    <>
      {renderControls ? renderControls(controls) : (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{controls.refresh}{controls.viewToggle}{controls.addButton}</div>
      )}

      {/* 상태 요약은 필터라 검색 옆에 둔다(DESIGN.md §4.5 규칙 2). 따로 한 줄이면 두 줄 모두 오른쪽 60%가 비었다. */}
      <ListToolbar search={
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} resultCount={filteredMonitors.length} shortcut placeholder={searchLabel} aria-label={searchLabel} />
      }>
        {!loading && !error && hasTargets && (
          <section aria-label="업타임 상태 요약">
            {/* 숫자를 누르면 그 상태만 본다(다시 누르면 해제). Uptime Kuma의 상태 필터를 요약에 겹쳤다. */}
            <div role="group" aria-label="상태로 거르기" className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
              {STATUS_FILTERS.map((key) => {
                const [tone, label] = UPTIME_STATE_LIGHT[key];
                return (
                  <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(status === key ? null : key)}
                    className="flex min-h-11 flex-col items-start gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-ui-hover-soft aria-pressed:bg-ui-hover sm:min-h-10 sm:flex-row sm:items-center sm:gap-2">
                    <StatusLight label={label} tone={key === 'down' && counts.down === 0 ? 'idle' : tone} />
                    <span className="type-kpi">{counts[key]}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </ListToolbar>

      {error && (
        <section role="status" className="mb-6 flex flex-col gap-3 rounded-xl border border-ui-border-soft bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
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
          <Button variant="secondary" size="sm" className="min-w-28" loading={loading} onClick={() => void own.load()}>다시 시도</Button>
        </section>
      )}

      {selectedMonitors.length > 0 && (
        <div role="region" aria-label="선택한 대상 작업" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ui-border-soft bg-bg-surface px-4 py-2">
          <p className="mr-auto type-body text-text-base"><span className="font-medium tabular-nums">{selectedMonitors.length}</span>개 선택</p>
          <Button size="sm" variant="secondary" disabled={bulkDisabled || toPause.length === 0} loading={bulkWorking}
            onClick={() => void runBulk(toPause, (monitor) => api.updateUptimeMonitor(monitor.id, monitorInput(monitor, { isActive: false })), '일시정지')}>
            <MaterialIcon name="pause" />일시정지
          </Button>
          <Button size="sm" variant="secondary" disabled={bulkDisabled || toResume.length === 0}
            onClick={() => void runBulk(toResume, (monitor) => api.updateUptimeMonitor(monitor.id, monitorInput(monitor, { isActive: true })), '재개')}>
            <MaterialIcon name="play_arrow" />재개
          </Button>
          <Button size="sm" variant="destructive" disabled={bulkDisabled} onClick={() => setConfirmingDelete(true)}>
            <MaterialIcon name="delete_outline" />삭제
          </Button>
          <Button size="sm" variant="ghost" disabled={bulkWorking} onClick={() => setSelected(new Set())}>선택 해제</Button>
        </div>
      )}

      {/* 대상이 있으면 검색·필터로 비어도 목록 제목 줄(보기 전환)은 남는다 — 빈 결과에서도 보기를 바꿀 수 있게. */}
      {loading && !hasTargets ? <ServiceListSkeleton /> : !hasTargets ? (
        !error && <EmptyState icon="monitor_heart" title="표시할 업타임 대상이 없습니다" description="확인할 주소를 업타임 모니터로 추가해 보세요.">
          <Button onClick={() => setAdding(true)}>추가</Button>
        </EmptyState>
      ) : (
        <section aria-label="업타임 대상" aria-busy={loading || undefined}>
          <h2 className="sr-only">모니터링 대상</h2>
          {empty ? (!error && (status
            ? <EmptyState icon="monitor_heart" title={`${UPTIME_STATE_LIGHT[status][1]} 상태인 대상이 없습니다`} description="다른 상태를 고르거나 필터를 해제해 보세요.">
              <Button variant="secondary" onClick={() => setStatus(null)}>필터 해제</Button>
            </EmptyState>
            : <EmptyState icon="monitor_heart" title="검색 결과가 없습니다" description="검색어를 바꿔 다시 시도해 보세요." />)
          ) : <UptimeTargets view={view} monitors={filteredMonitors} error={Boolean(error)} hrefFor={hrefFor}
            returnTo={returnTo} loading={loading || bulkWorking} changingMonitor={changingMonitor} onSetActive={(monitor) => void setActive(monitor)}
            selected={visibleSelection} onSelect={select} />}
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
          {selectedMonitors.length > 3 && ` 외 ${selectedMonitors.length - 3}개`}를 삭제하면 수집된 상태와 체크 기록, 각 모니터만 대상으로 하는 알림 규칙도 함께 삭제됩니다.
        </>}
        confirmLabel="삭제"
        isProcessing={bulkWorking}
      />
    </>
  );
}
