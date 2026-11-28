import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { Button, ButtonLink, ConfirmDialog, EmptyState, MaterialIcon, OverflowMenu, SegmentedControl, StatusLight, Tooltip, type GlobalTimeRange, type OverflowMenuItem, type StatusTone } from '../../../components/common';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useHeldToken } from '../../../hooks/useHeldToken';
import { api, type TimelineIncident, type UptimeMonitor, type UptimeMonitorInput, type UptimeMonitorMetric } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { readLatest, TargetGoneError } from '../../../utils/readLatest';
import { formatDuration, formatFullDateTime, formatIncidentTime } from '../../../utils/incidentFormat';
import { alertRulesPath } from '../../alerts/alertTarget';
import { TargetHeader } from '../../targets/TargetHeader';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import { monitorInput } from '../monitorInput';
import { useUptimeMonitorDetail } from '../useUptimeMonitorDetail';
import { BucketedResponseTimeChart } from './BucketedResponseTimeChart';
import type { ResponseFailure } from './ResponseTimeCard';
import { UptimeLatestCheck } from './UptimeLatestCheck';
import { UptimeMonitorDialog } from './UptimeMonitorDialog';
import { UptimeMonitorStatusBadge } from './UptimeMonitorStatusBadge';
import { UptimeOverview, UptimeStats } from './UptimeOverview';
import { uptimeKpis } from '../uptimeKpis';

type ResponseRange = GlobalTimeRange;
const RESPONSE_WINDOW = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 } as const;
const RESPONSE_BUCKET = { '1h': 120_000, '6h': 300_000, '24h': 1_200_000 } as const;

// 기간은 머리말의 기간 선택이 정한다(대상 상세의 틀, Docker 서비스와 같다). 카드 안에 기간 조작을 따로 두지 않는다.
function ResponseTimeChart({ monitorId, incidents, failures, range, refreshKey }: { monitorId: string; incidents: TimelineIncident[]; failures: ResponseFailure[]; range: ResponseRange; refreshKey: number }) {
  const thresholds = useAlertThresholds({ kind: 'direct', serviceId: monitorId }, 'response_time');
  const loadBuckets = useCallback(() => api.getUptimeMonitorBuckets(monitorId, range), [monitorId, range]);
  return <BucketedResponseTimeChart key={range} load={loadBuckets} windowMs={RESPONSE_WINDOW[range]} bucketMs={RESPONSE_BUCKET[range]}
    caption={`${RESPONSE_BUCKET[range] / 60_000}분 평균`} incidents={incidents} failures={failures} thresholds={thresholds} refreshKey={refreshKey} headingLevel="h2" />;
}

const failureMessage = (failure: UptimeMonitorMetric) => [failure.statusCode && `HTTP ${failure.statusCode}`, failure.errorMessage].filter(Boolean).join(', ');
const failureEvent = (failure: UptimeMonitorMetric): ResponseFailure => ({ at: Date.parse(failure.checkedAt), message: failureMessage(failure) });

const HISTORY_ROWS = 10;
type HistoryFilter = 'all' | 'outage' | 'failure';
const HISTORY_FILTERS = [{ label: '전체', value: 'all' }, { label: '장애', value: 'outage' }, { label: '실패', value: 'failure' }] as const;

interface HistoryRow {
  key: string;
  at: string;
  kind: 'outage' | 'failure';
  active: boolean;
  durationSec?: number;
  message: string;
}

// 장애(연속 실패가 기준을 넘은 구간)와 장애로 이어지지 않은 실패 체크를 한 목록에 시간순으로.
function historyRows(incidents: TimelineIncident[], failures: UptimeMonitorMetric[]): HistoryRow[] {
  return [
    ...incidents.map((incident): HistoryRow => ({
      key: `outage-${incident.startedAt}`, at: incident.startedAt, kind: 'outage', active: incident.active,
      durationSec: incident.durationSec, message: incident.message ?? '',
    })),
    ...failures.map((failure): HistoryRow => ({
      key: `failure-${failure.id}`, at: failure.checkedAt, kind: 'failure', active: false,
      message: failureMessage(failure),
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

const ROW_LIGHT = (row: HistoryRow): [StatusTone, string] =>
  row.kind === 'failure' ? ['warn', '실패'] : row.active ? ['error', '장애 진행 중'] : ['healthy', '장애 복구'];

// 90일 띠 아래, 같은 카드에 붙는다. 띠에서 날짜를 고르면 그날 이력만 남는다.
function OutageHistory({ rows, selectedDate, onClearDate }: { rows: HistoryRow[]; selectedDate: string | null; onClearDate: () => void }) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const visible = rows.filter((row) => (filter === 'all' || row.kind === filter)
    && (!selectedDate || new Date(row.at).toLocaleDateString('sv-SE') === selectedDate));
  const shown = expanded ? visible : visible.slice(0, HISTORY_ROWS);
  return (
    // 이력 → 더 보기 8px. 위 90일 막대와의 구분선은 UptimeOverview가 둔다.
    <div className="space-y-label">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="type-card-title text-text">장애 이력</h3>
        {selectedDate && (
          <Button size="sm" variant="ghost" aria-label={`${selectedDate} 선택 해제`} onClick={onClearDate}>
            {selectedDate}<MaterialIcon name="close" />
          </Button>
        )}
        <div className="ml-auto"><SegmentedControl options={HISTORY_FILTERS} value={filter} onChange={setFilter} ariaLabel="장애 이력 구분" /></div>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center type-control text-text-faint">최근 90일 동안 기록된 장애가 없습니다</div>
      ) : visible.length === 0 ? (
        <div className="py-6 text-center type-control text-text-faint">조건에 맞는 이력이 없습니다</div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-2xl table-fixed type-control">
            <thead>
              <tr className="border-b border-border text-left type-caption text-text-muted">
                <th className="w-32 px-2 py-2 font-normal">상태</th>
                <th className="w-32 px-2 py-2 font-normal">시각</th>
                <th className="w-32 px-2 py-2 font-normal">지속 시간</th>
                <th className="px-2 py-2 font-normal">메시지</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const [tone, label] = ROW_LIGHT(row);
                return (
                  <tr key={row.key} className="transition-colors hover:bg-surface-hover">
                    <td className="px-2 cell"><StatusLight tone={tone} label={label} /></td>
                    <Tooltip content={formatFullDateTime(row.at)} focusable><td className="whitespace-nowrap px-2 cell tabular-nums text-text">{formatIncidentTime(row.at)}</td></Tooltip>
                    <td className="px-2 cell tabular-nums text-text">{row.durationSec === undefined ? '-' : formatDuration(row.durationSec)}</td>
                    <Tooltip content={row.message} focusable><td className="truncate px-2 cell font-mono text-xs text-text-muted">{row.message || '-'}</td></Tooltip>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {visible.length > HISTORY_ROWS && (
        <Button size="sm" variant="ghost" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '접기' : `${visible.length - HISTORY_ROWS}개 더 보기`}
        </Button>
      )}
    </div>
  );
}

// 확인 대상은 제목 아래에 따로 보이므로 접힌 속성에는 넣지 않는다.
function metaFields(monitor: UptimeMonitor) {
  return [
    { label: 'Protocol', value: monitor.type.toUpperCase() },
    { label: 'Interval', value: `${monitor.interval}초` },
    ...(monitor.type === 'http' ? [{ label: '기대 상태 코드', value: <span className="tabular-nums">{monitor.expectedStatus}</span> }] : []),
  ];
}

// 일시정지/재개 — 상태에 따라 아이콘·라벨이 바뀐다. 상태 바로 옆에 둔다(DESIGN.md §4.1, 상태 전환은 meta 줄).
function ActiveToggleButton({ active, disabled, loading, onClick }: { active: boolean; disabled: boolean; loading: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" disabled={disabled} loading={loading} onClick={onClick}>
      <MaterialIcon name={active ? 'pause' : 'play_arrow'} />
      {active ? '일시정지' : '재개'}
    </Button>
  );
}

/** 업타임 모니터 하나의 페이지 본문(DESIGN.md §4.7 대상 상세). 머리말은 다른 대상과 같은 TargetHeader다. */
export function UptimeMonitorDetail({ monitorId, crumbs, back, refresh: pageRefresh, range, onRangeChange, notice, onDeleted, menuItems = [], onChanged, refreshToken = 0, autoRefresh = true }: {
  monitorId: string;
  /** 위 단계(서버). 모니터 이름이 이 뒤에 붙는다. */
  crumbs: { label: string; to: string }[];
  /** 좁은 화면의 복귀 링크. 목록에서 열었으면 그 목록이다. */
  back?: { label: string; to: string };
  /** 머리말의 갱신 상태(서버 데이터와 이 모니터의 데이터를 함께 다시 불러온다) */
  refresh: Parameters<typeof TargetHeader>[0]['refresh'];
  range: ResponseRange;
  onRangeChange: (range: ResponseRange) => void;
  /** 머리말 바로 아래의 안내(서버 데이터를 불러오지 못했을 때의 배너) */
  notice?: ReactNode;
  /** 삭제가 끝난 뒤 */
  onDeleted: () => void;
  /** 알림 규칙 옆 더보기에서 삭제 앞에 놓을 조작(예: 다른 서버로 옮기기) */
  menuItems?: OverflowMenuItem[];
  /** 일시정지나 수정으로 모니터가 바뀐 뒤. 서버 데이터를 다시 불러온다. */
  onChanged?: () => void | Promise<void>;
  /** 머리말의 새로고침을 누를 때마다 바뀐다. 바뀌면(마운트 때는 제외) 이 모니터의 데이터를 다시 불러온다. */
  refreshToken?: number;
  /** 머리말의 자동 갱신 스위치. 체크 이력 갱신도 이 값을 따른다. */
  autoRefresh?: boolean;
}) {
  const { monitor, metrics, summary, history, incidents, failures, loading, refreshing, errors, notFound, load } = useUptimeMonitorDetail(monitorId);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // 버킷 차트는 자기 데이터를 따로 불러오므로 새로고침 신호만 받는다.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => { setRefreshKey((key) => key + 1); void load(); };
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);
  // 수정 저장 중. 일시정지·삭제(processing)와 달리 버튼을 막지 않지만 새로고침 신호는 미룬다.
  const [saving, setSaving] = useState(false);
  // 체크 이력은 이 패널만 가진 데이터라 패널이 갱신한다.
  useAutoRefresh(refresh, 30_000, autoRefresh && !editing && !deleting && !processing);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => { void load(); }, [load]);
  // 화면의 새로고침이 패널의 새로고침을 겸한다. 마운트 때의 값은 건너뛴다(위의 첫 조회와 겹친다).
  // 변경 요청이 진행 중일 때의 신호는 버린다. 변경이 끝나면 다시 불러온다.
  const token = useHeldToken(refreshToken, processing || saving);
  const seenToken = useRef(token);
  useEffect(() => {
    if (seenToken.current === token) return;
    seenToken.current = token;
    void load();
  }, [token, load]);

  // 이미 지워졌으면 서버 데이터를 다시 불러와 화면에서 뺀다. 안내는 호출한 쪽(토스트)이 한다.
  const goneThenRethrow = (cause: unknown): never => {
    if (cause instanceof TargetGoneError) void onChanged?.();
    throw cause;
  };

  const updateMonitor = async (input: UptimeMonitorInput) => {
    if (!monitor) return;
    setSaving(true);
    try {
      // 패널의 모니터가 아니라 지금의 모니터 위에 입력한 값을 덮는다. 그 사이의 이동이나 일시정지를 되돌리지 않게.
      const latest = await readLatest(() => api.getUptimeMonitor(monitor.id), '수정').catch(goneThenRethrow);
      await api.updateUptimeMonitor(latest.id, { ...monitorInput(latest), ...input, expectedStatus: input.expectedStatus ?? latest.expectedStatus });
      await load();
      await onChanged?.();
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!monitor || processing || refreshing || errors.monitor) return;
    setProcessing(true);
    try {
      const latest = await readLatest(() => api.getUptimeMonitor(monitor.id), monitor.isActive ? '일시정지' : '재개').catch(goneThenRethrow);
      await api.updateUptimeMonitor(latest.id, monitorInput(latest, { isActive: !monitor.isActive }));
      await load();
      await onChanged?.();
    } catch (actionError) {
      toast.error(getErrorMessage(actionError));
    } finally {
      if (alive.current) setProcessing(false);
    }
  };

  const deleteMonitor = async () => {
    if (!monitor || processing || refreshing || errors.monitor) return;
    setProcessing(true);
    try {
      await api.deleteUptimeMonitor(monitor.id);
      toast.success('업타임 모니터를 삭제했습니다');
      // 화면이 바뀔 때까지 조작을 막아 둔다(processing을 풀지 않는다).
      onDeleted();
    } catch (actionError) {
      toast.error(getErrorMessage(actionError));
      // 성공하면 화면이 바뀔 때까지 풀지 않으므로 finally가 아니라 실패에서만 푼다.
      // react-doctor-disable-next-line no-loading-flag-reset-outside-finally
      if (alive.current) setProcessing(false);
    }
  };

  if (loading) {
    return <div role="status" className="flex h-64 items-center justify-center gap-3 text-text-muted"><MaterialIcon size={24} name="sync" className="animate-spin" />불러오는 중</div>;
  }

  if (!monitor) {
    return (
      <EmptyState icon="error_outline" title={notFound ? '업타임 모니터를 찾을 수 없습니다' : '업타임 모니터를 불러오지 못했습니다'} description={errors.monitor ?? undefined} headingLevel="h1">
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" loading={refreshing} onClick={() => void load()}>다시 시도</Button>
          <ButtonLink variant="secondary" to={crumbs[crumbs.length - 1].to}>{`${crumbs[crumbs.length - 1].label} 서버로`}</ButtonLink>
        </div>
      </EmptyState>
    );
  }

  const target = monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url;
  const failedSources = [errors.monitor && '모니터', errors.metrics && '최근 체크', errors.summary && '30일 요약', errors.history && '90일 이력', (errors.incidents || errors.failures) && '장애 이력'].filter(Boolean);
  const actionsDisabled = processing || refreshing || Boolean(errors.monitor);

  return (
    <div className="page-stack">
      <TargetHeader
        title={monitor.name}
        crumbs={crumbs}
        back={back}
        status={<>
          {errors.monitor ? <StatusLight tone="idle" label="확인 불가" /> : <UptimeMonitorStatusBadge monitor={monitor} />}
          <UptimeLatestCheck monitor={monitor} metrics={metrics} incidents={incidents}
            incidentsError={errors.monitor ? '모니터 상태를 갱신한 뒤 다시 확인하세요.' : errors.incidents} />
          {/* 상태와 그 상태를 바꾸는 액션을 붙여 둔다. */}
          <ActiveToggleButton active={monitor.isActive} disabled={actionsDisabled} loading={processing} onClick={() => void toggleActive()} />
        </>}
        // 업타임 모니터는 EveryUp이 직접 확인한다: 연결 방식은 확인 대상과 간격이고, 그것을 바꾸는 곳은 수정이다.
        connection={{
          kind: 'uptime',
          detail: <><span className="font-mono">{target}</span> {monitor.interval}초마다</>,
          action: { label: '수정', onClick: () => setEditing(true), disabled: actionsDisabled },
        }}
        fieldsLabel="모니터 정보"
        fields={metaFields(monitor)}
        // 주 조작은 다른 대상과 같은 알림 규칙이다. 옮기기와 삭제는 더보기다(DESIGN.md §4.1 상세 헤더).
        actions={<>
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: monitor.id })}>
            <MaterialIcon name="notifications" />알림 규칙
          </ButtonLink>
          <OverflowMenu items={[
            ...menuItems,
            { label: '삭제', icon: 'delete_outline', danger: true, disabled: actionsDisabled, onSelect: () => setDeleting(true) },
          ]} />
        </>}
        range={range}
        onRangeChange={onRangeChange}
        refresh={pageRefresh}
      />
      {notice}

      {failedSources.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 type-control text-text">
          <p>{failedSources.join(', ')} 조회에 실패했습니다. 이전에 불러온 데이터가 있으면 유지합니다.</p>
          <Button size="sm" variant="secondary" loading={refreshing} disabled={processing} onClick={() => void load()}>다시 시도</Button>
        </div>
      )}

      {/* 현재 실패 → 기간별 수치 → 응답 추이 → 장기 이력 순서. */}
      <div className="space-y-section">
        <section>
          {/* 모니터 이름이 h1이고, 구역 제목은 그 아래 h2다(Docker 서비스 상세와 같다). */}
          <h2 className="sr-only">주요 지표</h2>
          <UptimeStats stats={uptimeKpis({
            uptime24h: monitor.uptime, uptime30d: summary && summary.totalChecks > 0 ? summary.uptime : undefined,
            avgResponse24h: monitor.responseTime, certExpiresAt: monitor.certExpiresAt,
          })} />
        </section>
        <ResponseTimeChart monitorId={monitor.id} incidents={incidents ?? []} failures={(failures ?? []).map(failureEvent)} range={range} refreshKey={refreshKey + token} />
        <UptimeOverview
          stats={[]}
          historyUptime={history && history.days.length > 0 ? history.percentage : undefined}
          days={(history?.days ?? []).map((day) => ({ date: day.date, uptime: day.uptime }))}
          error={!history ? errors.history : undefined}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          headingLevel="h2"
        >
          {incidents && failures && (
            <OutageHistory rows={historyRows(incidents, failures)} selectedDate={selectedDate} onClearDate={() => setSelectedDate(null)} />
          )}
        </UptimeOverview>
      </div>

      {editing && <UptimeMonitorDialog monitor={monitor} onClose={() => setEditing(false)} onSave={updateMonitor} />}
      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => void deleteMonitor()}
        title="업타임을 삭제할까요?"
        message={<><strong className="break-all font-medium text-text">{monitor.name}</strong>을 삭제하면 수집된 상태와 체크 기록, 이 모니터만 대상으로 하는 알림 규칙도 함께 삭제됩니다.</>}
        confirmLabel="삭제"
        isProcessing={processing}
      />
    </div>
  );
}
