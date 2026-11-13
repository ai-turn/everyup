import { Tooltip } from '../../components/common/Tooltip';
import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, ButtonLink, ConfirmDialog, DetailActionToolbar, DetailMeta, MaterialIcon, PageHeader, SegmentedControl, StatusLight, type StatusTone } from '../../components/common';
import { alertRulesPath } from '../../features/alerts/alertTarget';
import { useAlertThresholds } from '../../features/alerts/useAlertThresholds';
import { BucketedResponseTimeChart } from '../../features/uptime/components/BucketedResponseTimeChart';
import type { ResponseFailure } from '../../features/uptime/components/ResponseTimeCard';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeOverview, UptimeStats, type UptimeOverviewStat } from '../../features/uptime/components/UptimeOverview';
import { UptimeMonitorStatusBadge } from '../../features/uptime/components/UptimeMonitorStatusBadge';
import { useUptimeMonitorDetail } from '../../features/uptime/useUptimeMonitorDetail';
import {
  api, type TimelineIncident, type UptimeMonitor, type UptimeMonitorInput, type UptimeMonitorMetric,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { formatDuration, formatIncidentTime } from '../../utils/incidentFormat';
import { listReturnTo } from '../../utils/listReturnTo';
import { useGroupTrail } from '../../hooks/useGroupTrail';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { UptimeRefreshControls } from '../../features/uptime/components/UptimeRefreshControls';
import { UptimeCheckSummary } from '../../features/uptime/components/UptimeCheckSummary';

type ResponseRange = '1h' | '6h' | '24h';
const RESPONSE_RANGES = [{ label: '1H', value: '1h' }, { label: '6H', value: '6h' }, { label: '24H', value: '24h' }] as const;
const RESPONSE_WINDOW = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 } as const;
const RESPONSE_BUCKET = { '1h': 120_000, '6h': 300_000, '24h': 1_200_000 } as const;

function ResponseTimeChart({ monitorId, incidents, failures, range, refreshKey, onRangeChange }: { monitorId: string; incidents: TimelineIncident[]; failures: ResponseFailure[]; range: ResponseRange; refreshKey: number; onRangeChange: (range: ResponseRange) => void }) {
  const thresholds = useAlertThresholds({ kind: 'direct', serviceId: monitorId }, 'response_time');
  const loadBuckets = useCallback(() => api.getUptimeMonitorBuckets(monitorId, range), [monitorId, range]);
  const controls = <SegmentedControl options={RESPONSE_RANGES} value={range} onChange={onRangeChange} ariaLabel="응답 시간 범위" />;
  return <BucketedResponseTimeChart key={range} load={loadBuckets} windowMs={RESPONSE_WINDOW[range]} bucketMs={RESPONSE_BUCKET[range]}
    caption={`${RESPONSE_BUCKET[range] / 60_000}분 평균`} incidents={incidents} failures={failures} thresholds={thresholds} refreshKey={refreshKey} controls={controls} />;
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
    <div className="mt-6 border-t border-ui-border pt-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="type-card-title text-text-base">장애 이력</h3>
        {selectedDate && (
          <Button size="sm" variant="ghost" aria-label={`${selectedDate} 선택 해제`} onClick={onClearDate}>
            {selectedDate}<MaterialIcon name="close" size={16} />
          </Button>
        )}
        <div className="ml-auto"><SegmentedControl options={HISTORY_FILTERS} value={filter} onChange={setFilter} ariaLabel="장애 이력 구분" /></div>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-text-dim">최근 90일 동안 기록된 장애가 없습니다</div>
      ) : visible.length === 0 ? (
        <div className="py-6 text-center text-sm text-text-dim">조건에 맞는 이력이 없습니다</div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-2xl table-fixed text-sm">
            <thead>
              <tr className="text-left type-caption text-text-muted">
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
                  <tr key={row.key} className="border-t border-ui-border-soft">
                    <td className="px-2 py-2.5"><StatusLight tone={tone} label={label} /></td>
                    <Tooltip content={new Date(row.at).toLocaleString()} focusable><td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-text-secondary">{formatIncidentTime(row.at)}</td></Tooltip>
                    <td className="px-2 py-2.5 tabular-nums text-text-base">{row.durationSec === undefined ? '-' : formatDuration(row.durationSec)}</td>
                    <Tooltip content={row.message} focusable><td className="truncate px-2 py-2.5 font-mono text-xs text-text-muted">{row.message || '-'}</td></Tooltip>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {visible.length > HISTORY_ROWS && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '접기' : `${visible.length - HISTORY_ROWS}개 더 보기`}
        </Button>
      )}
    </div>
  );
}

const CERT_WARN_DAYS = 14;

const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** HTTPS만 네 번째 지표가 된다. 14일 이하는 주의, 지나면 오류 색. */
function certStat(iso: string): UptimeOverviewStat {
  const days = daysUntil(iso);
  return { label: '인증서 만료', value: days < 0 ? '만료됨' : `D-${days}`, tone: days < 0 ? 'error' : days <= CERT_WARN_DAYS ? 'warn' : undefined };
}

function metaFields(monitor: UptimeMonitor, target: string, lastCheck: string) {
  return [
    { label: monitor.type === 'tcp' ? 'Host' : 'URL', value: <span className="truncate font-mono">{target}</span> },
    { label: 'Protocol', value: monitor.type.toUpperCase() },
    { label: 'Interval', value: `${monitor.interval}초` },
    ...(monitor.type === 'http' ? [{ label: '기대 상태 코드', value: <span className="tabular-nums">{monitor.expectedStatus}</span> }] : []),
    { label: '마지막 확인', value: <span className="tabular-nums">{lastCheck}</span> },
  ];
}

// 일시정지/재개 — 상태에 따라 아이콘·라벨이 바뀐다. 페이지 함수에 삼항을 더하면
// 복잡도 한도를 넘어서 따로 뺐다.
function ActiveToggleButton({ active, disabled, loading, onClick }: { active: boolean; disabled: boolean; loading: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" disabled={disabled} loading={loading} onClick={onClick}>
      <MaterialIcon name={active ? 'pause' : 'play_arrow'} />
      {active ? '일시정지' : '재개'}
    </Button>
  );
}

export function UptimeMonitorDetailPage() {
  const { monitorId } = useParams<{ monitorId: string }>();
  return <UptimeMonitorDetail key={monitorId} monitorId={monitorId ?? ''} />;
}

function UptimeMonitorDetail({ monitorId }: { monitorId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // 그룹에서 열었으면 삭제 후에도 그 그룹으로 돌아간다. 모바일 돌아가기는 레이아웃의 GroupBackLink가 맡는다.
  const trail = useGroupTrail();
  const returnTo = trail ? `/projects/${trail.id}` : listReturnTo(location.state, '/uptime');

  const { monitor, metrics, summary, history, incidents, failures, loading, refreshing, errors, notFound, updatedAt, load } = useUptimeMonitorDetail(monitorId);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [range, setRange] = useState<ResponseRange>('6h');
  // 버킷 차트는 자기 데이터를 따로 불러오므로 새로고침 신호만 받는다.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => { setRefreshKey((key) => key + 1); void load(); };
  useBreadcrumb(monitor ? [{ label: monitor.name }] : []);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);
  useAutoRefresh(refresh, 30_000, autoRefresh && !editing && !deleting && !processing);

  useEffect(() => { void load(); }, [load]);

  const updateMonitor = async (input: UptimeMonitorInput) => {
    if (!monitor) return;
    await api.updateUptimeMonitor(monitor.id, { ...input, method: monitor.method, expectedStatus: input.expectedStatus ?? monitor.expectedStatus, isActive: monitor.isActive });
    await load();
  };

  const toggleActive = async () => {
    if (!monitor || processing || refreshing || errors.monitor) return;
    setProcessing(true);
    try {
      await api.updateUptimeMonitor(monitor.id, {
        name: monitor.name, type: monitor.type, url: monitor.type === 'http' ? monitor.url : undefined,
        host: monitor.type === 'tcp' ? monitor.url : undefined, port: monitor.port, method: monitor.method,
        expectedStatus: monitor.expectedStatus, timeout: monitor.timeout, interval: monitor.interval,
        isActive: !monitor.isActive,
      });
      await load();
    } catch (actionError) {
      toast.error(getErrorMessage(actionError));
    } finally {
      setProcessing(false);
    }
  };

  const deleteMonitor = async () => {
    if (!monitor || processing || refreshing || errors.monitor) return;
    setProcessing(true);
    try {
      await api.deleteUptimeMonitor(monitor.id);
      navigate(returnTo);
    } catch (actionError) {
      toast.error(getErrorMessage(actionError));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center gap-3 text-text-muted"><MaterialIcon size={24} name="sync" className="animate-spin" />불러오는 중</div>;
  }

  if (!monitor) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <MaterialIcon size={32} name="error_outline" className="text-status-error" />
        <div><p className="font-medium text-text-base">{notFound ? '업타임 모니터를 찾을 수 없습니다' : '업타임 모니터를 불러오지 못했습니다'}</p>{errors.monitor && <p className="mt-1 text-sm text-text-muted">{errors.monitor}</p>}</div>
        <Button variant="secondary" loading={refreshing} onClick={() => void load()}>다시 시도</Button>
        <ButtonLink variant="secondary" to={returnTo}>업타임으로 돌아가기</ButtonLink>
      </div>
    );
  }

  const target = monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url;
  const lastCheck = monitor.lastCheckAt
    ? new Date(monitor.lastCheckAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';
  const failedSources = [errors.monitor && '모니터', errors.metrics && '최근 체크', errors.summary && '30일 요약', errors.history && '90일 이력', (errors.incidents || errors.failures) && '장애 이력'].filter(Boolean);
  const actionsDisabled = processing || refreshing || Boolean(errors.monitor);

  return (
    <div className="space-y-5">
      {/* 데스크톱은 AppHeader breadcrumb의 첫 크럼이 이 역할을 한다 (DESIGN.md §3.4) */}
      {!trail && <Link to={returnTo} className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-action lg:hidden">
        <MaterialIcon size={20} name="arrow_back" />업타임
      </Link>}
      <PageHeader
        title={monitor.name}
        meta={
          <DetailMeta
            status={
              <>
                {/* 상태와 그 상태를 바꾸는 액션을 붙여 둔다 — 수집 키 옆 키 재발급과 같은 자리 (§4.1) */}
                {errors.monitor ? <StatusLight tone="warn" label="확인 불가" /> : <UptimeMonitorStatusBadge monitor={monitor} />}
                <ActiveToggleButton active={monitor.isActive} disabled={actionsDisabled} loading={processing} onClick={() => void toggleActive()} />
              </>
            }
            fields={metaFields(monitor, target, lastCheck)}
          />
        }
      />
      <DetailActionToolbar
        controls={<UptimeRefreshControls updatedAt={updatedAt} refreshing={refreshing} autoRefresh={autoRefresh} onAutoRefreshChange={(enabled) => { setAutoRefresh(enabled); if (enabled) refresh(); }} onRefresh={refresh} disabled={processing} />}
        actions={
          <>
            <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: monitor.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
            <Button collapseLabel variant="secondary" disabled={actionsDisabled} onClick={() => setEditing(true)}><MaterialIcon name="edit" />수정</Button>
            <Button collapseLabel variant="destructive" disabled={actionsDisabled} onClick={() => setDeleting(true)}><MaterialIcon name="delete_outline" />삭제</Button>
          </>
        }
      />

      {failedSources.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ui-border bg-bg-surface px-4 py-3 text-sm text-text-secondary">
          <p>{failedSources.join(', ')} 조회에 실패했습니다. 이전에 불러온 데이터가 있으면 유지합니다.</p>
          <Button size="sm" variant="secondary" loading={refreshing} disabled={processing} onClick={() => void load()}>다시 시도</Button>
        </div>
      )}

      <section aria-label="현재 체크 상태" className="rounded-xl border border-ui-border bg-bg-surface p-6">
        <h2 className="mb-4 type-card-title text-text-base">현재 상태</h2>
        <UptimeCheckSummary monitor={monitor} metrics={metrics} incidents={incidents} metricsError={errors.metrics}
          incidentsError={errors.monitor ? '모니터 상태를 갱신한 뒤 다시 확인하세요.' : errors.incidents} />
      </section>

      {/* 현재 실패 → 기간별 수치 → 응답 추이 → 장기 이력 순서. */}
      <section className="rounded-xl border border-ui-border bg-bg-surface p-6">
        <h2 className="sr-only">주요 지표</h2>
        <UptimeStats stats={[
          { label: '24시간 업타임', value: monitor.uptime === undefined ? '-' : `${monitor.uptime.toFixed(2)}%` },
          { label: '30일 업타임', value: summary && summary.totalChecks > 0 ? `${summary.uptime.toFixed(2)}%` : '-' },
          { label: '평균 응답 (24시간)', value: monitor.responseTime === undefined ? '-' : `${monitor.responseTime.toLocaleString()}ms` },
          ...(monitor.certExpiresAt ? [certStat(monitor.certExpiresAt)] : []),
        ]} />
      </section>
      <ResponseTimeChart monitorId={monitor.id} incidents={incidents ?? []} failures={(failures ?? []).map(failureEvent)} range={range} refreshKey={refreshKey} onRangeChange={setRange} />
      <UptimeOverview
        stats={[]}
        historyUptime={history && history.days.length > 0 ? history.percentage : undefined}
        days={(history?.days ?? []).map((day) => ({ date: day.date, uptime: day.uptime }))}
        error={!history ? errors.history : undefined}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      >
        {incidents && failures && (
          <OutageHistory rows={historyRows(incidents, failures)} selectedDate={selectedDate} onClearDate={() => setSelectedDate(null)} />
        )}
      </UptimeOverview>

      {editing && <UptimeMonitorDialog monitor={monitor} onClose={() => setEditing(false)} onSave={updateMonitor} />}
      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => void deleteMonitor()}
        title="업타임을 삭제할까요?"
        message={<><strong className="break-all font-medium text-text-base">{monitor.name}</strong>을 삭제하면 수집된 상태와 체크 기록, 이 모니터만 대상으로 하는 알림 규칙도 함께 삭제됩니다.</>}
        confirmLabel="삭제"
        isProcessing={processing}
      />
    </div>
  );
}
