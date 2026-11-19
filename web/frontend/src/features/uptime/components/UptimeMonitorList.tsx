import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import {
  Button, ConfirmDialog, EmptyState, ListToolbar, ListViewToggle, MaterialIcon, SearchInput, StatusLight,
} from '../../../components/common';
import { useListView } from '../../../hooks/useListView';
import { api, type UptimeMonitor } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { readLatest } from '../../../utils/readLatest';
import { monitorInput } from '../monitorInput';
import { UPTIME_STATE_LIGHT, uptimeState, type UptimeState } from '../uptimeState';
import { UptimeTargets } from './UptimeTargets';

const STATUS_FILTERS: UptimeState[] = ['down', 'up', 'waiting', 'paused'];
const parseStatus = (value: string | null): UptimeState | null =>
  STATUS_FILTERS.includes(value as UptimeState) ? value as UptimeState : null;

/**
 * 서버 업타임 탭의 모니터 목록: 검색, 상태 필터, 보기 전환, 카드 보기의 선택과 일괄 작업, 최근 체크.
 * 모니터는 서버 상세가 불러온 것을 받는다. 목록은 따로 불러오거나 갱신하지 않고, 변경한 뒤에는 onChanged로 서버 상세가 다시 불러온다.
 * 추가 버튼은 탭이 그린다. 탭은 모니터가 둘 이상일 때만 이 목록을 보인다.
 */
export function UptimeMonitorList({ monitors, hrefFor, renderControls, onChanged, stale = false, onDeleted, searchLabel }: {
  monitors: UptimeMonitor[];
  hrefFor: (monitor: UptimeMonitor) => string;
  /** 보기 전환을 그릴 자리 */
  renderControls: (controls: { viewToggle: ReactNode }) => ReactNode;
  /** 변경한 뒤. 약속을 돌려주면 끝날 때까지 조작을 막아 둔다(옛 값으로 다시 누르지 않게). */
  onChanged: () => void | Promise<void>;
  /**
   * 받은 모니터가 이전에 불러온 것이다(다시 불러오지 못했다). 행을 확인 불가로 두고 조작을 막는다.
   * 이전 정보라는 안내와 다시 시도는 서버 머리말 아래의 안내 하나가 맡는다.
   */
  stale?: boolean;
  /** 일괄 삭제에 성공한 모니터. 부모가 다시 불러오기 전에 이전 목록에서 뺀다(다시 불러오기가 실패해도 다시 보이지 않게). */
  onDeleted?: (ids: string[]) => void;
  /** 검색창의 안내 문구이자 접근 가능한 이름 */
  searchLabel: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  // 입력값은 로컬 상태가 쥔다. URL(?q=)은 react-router가 transition 안에서 반영해 값이 한 박자 늦게 돌아오므로,
  // URL에 직접 묶으면 한글 조합 중 글자가 덮여 '결제'가 'ㄱ겨결결ㅈ제제'가 됐다. URL은 공유·복귀용 사본이다.
  const [query, setQueryInput] = useState(() => searchParams.get('q') ?? '');
  // 이 목록이 쓰는 주소 변경은 모두 replace다. 그 밖의 이동(선택된 탭을 다시 눌러 첫 화면으로, 뒤로 가기)이면 검색창이 주소의 q를 따른다.
  // ServersPage와 같은 방식. 첫 기록의 key는 항상 default라 주소도 함께 본다.
  const navigationType = useNavigationType();
  const seen = `${location.key}${location.search}`;
  const [seenLocation, setSeenLocation] = useState(seen);
  if (seen !== seenLocation) {
    setSeenLocation(seen);
    if (navigationType !== 'REPLACE') setQueryInput(searchParams.get('q') ?? '');
  }
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
  const [changingMonitor, setChangingMonitor] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const afterChange = async () => { await onChanged(); };
  // 서버 상세에서 화살표 키로 탭을 지나가면 언마운트될 수 있다. 그 뒤에 끝난 작업은 상태를 건드리지 않는다.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

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

  // 목록의 모니터는 최대 한 주기 전의 것이다. 요청은 다시 읽은 모니터로 만들어 그 사이의 수정이나 이동을 되돌리지 않는다.
  const updateActive = async (monitor: UptimeMonitor, isActive: boolean) => {
    const latest = await readLatest(() => api.getUptimeMonitor(monitor.id), isActive ? '재개' : '일시정지');
    return api.updateUptimeMonitor(monitor.id, monitorInput(latest, { isActive }));
  };

  const setActive = async (monitor: UptimeMonitor) => {
    if (changingMonitor) return;
    setChangingMonitor(monitor.id);
    try {
      await updateActive(monitor, !monitor.isActive);
      await afterChange();
    } catch (cause) {
      toast.error(getErrorMessage(cause));
    } finally {
      if (alive.current) setChangingMonitor(null);
    }
  };

  // ponytail: 대상마다 기존 API를 한꺼번에 부른다 — 수십 개 단위가 흔해지면 일괄 엔드포인트로.
  const runBulk = async (targets: UptimeMonitor[], run: (monitor: UptimeMonitor) => Promise<unknown>, verb: string, done?: (ids: string[]) => void) => {
    setBulkWorking(true);
    const results = await Promise.allSettled(targets.map(run));
    const failed = targets.filter((_, index) => results[index].status === 'rejected').map((monitor) => monitor.id);
    const firstError = results.find((result) => result.status === 'rejected')?.reason;
    if (failed.length > 0) toast.error(`${failed.length}개를 ${verb}하지 못했습니다. ${getErrorMessage(firstError)}`);
    const succeeded = targets.filter((_, index) => results[index].status === 'fulfilled').map((monitor) => monitor.id);
    // 인프라와 앱의 삭제처럼 삭제는 결과를 알린다.
    if (verb === '삭제' && succeeded.length > 0) toast.success(`업타임 모니터 ${succeeded.length}개를 삭제했습니다`);
    done?.(succeeded);
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
  const bulkDisabled = bulkWorking || stale || changingMonitor !== null;

  const empty = filteredMonitors.length === 0;
  const hasTargets = monitors.length > 0;

  const counts = Object.fromEntries(STATUS_FILTERS.map((key) => [key, monitors.filter((monitor) => uptimeState(monitor) === key).length])) as Record<UptimeState, number>;

  return (
    <>
      {renderControls({ viewToggle: hasTargets ? <ListViewToggle view={view} onChange={(next) => { setSelected(new Set()); setView(next); }} /> : null })}

      {/* 상태 요약은 필터라 검색 옆에 둔다(DESIGN.md §4.5 규칙 2). 따로 한 줄이면 두 줄 모두 오른쪽 60%가 비었다. */}
      <ListToolbar search={
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} onClear={() => setQuery('')} resultCount={filteredMonitors.length} shortcut placeholder={searchLabel} aria-label={searchLabel} />
      }>
        {!stale && hasTargets && (
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

      {selectedMonitors.length > 0 && (
        <div role="region" aria-label="선택한 대상 작업" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ui-border-soft bg-bg-surface px-4 py-2">
          <p className="mr-auto type-body text-text-base"><span className="font-medium tabular-nums">{selectedMonitors.length}</span>개 선택</p>
          <Button size="sm" variant="secondary" disabled={bulkDisabled || toPause.length === 0} loading={bulkWorking}
            onClick={() => void runBulk(toPause, (monitor) => updateActive(monitor, false), '일시정지')}>
            <MaterialIcon name="pause" />일시정지
          </Button>
          <Button size="sm" variant="secondary" disabled={bulkDisabled || toResume.length === 0}
            onClick={() => void runBulk(toResume, (monitor) => updateActive(monitor, true), '재개')}>
            <MaterialIcon name="play_arrow" />재개
          </Button>
          <Button size="sm" variant="destructive" disabled={bulkDisabled} onClick={() => setConfirmingDelete(true)}>
            <MaterialIcon name="delete_outline" />삭제
          </Button>
          <Button size="sm" variant="ghost" disabled={bulkWorking} onClick={() => setSelected(new Set())}>선택 해제</Button>
        </div>
      )}

      {/* 대상이 있으면 검색·필터로 비어도 목록 제목 줄(보기 전환)은 남는다 — 빈 결과에서도 보기를 바꿀 수 있게. */}
      {hasTargets && (
        <section aria-label="업타임 대상">
          <h2 className="sr-only">모니터링 대상</h2>
          {empty ? (!stale && (status
            ? <EmptyState icon="monitor_heart" title={`${UPTIME_STATE_LIGHT[status][1]} 상태인 대상이 없습니다`} description="다른 상태를 고르거나 필터를 해제해 보세요.">
              <Button variant="secondary" onClick={() => setStatus(null)}>필터 해제</Button>
            </EmptyState>
            : <EmptyState icon="monitor_heart" title="검색 결과가 없습니다" description="검색어를 바꿔 다시 시도해 보세요." />)
          ) : <UptimeTargets view={view} monitors={filteredMonitors} error={stale} hrefFor={hrefFor}
            returnTo={returnTo} loading={bulkWorking} changingMonitor={changingMonitor} onSetActive={(monitor) => void setActive(monitor)}
            selected={visibleSelection} onSelect={select} />}
        </section>
      )}

      <ConfirmDialog
        isOpen={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => { setConfirmingDelete(false); void runBulk(selectedMonitors, (monitor) => api.deleteUptimeMonitor(monitor.id), '삭제', onDeleted); }}
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
