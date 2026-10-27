import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, ButtonLink, ConfirmDialog, DetailActionToolbar, DetailMeta, MaterialIcon, PageHeader, SegmentedControl, StatusLight } from '../../components/common';
import { formatTimeLabel } from '../../components/charts';
import { alertRulesPath } from '../../features/alerts/alertTarget';
import { useAlertThresholds } from '../../features/alerts/useAlertThresholds';
import { BucketedResponseTimeChart } from '../../features/uptime/components/BucketedResponseTimeChart';
import { ResponseTimeCard } from '../../features/uptime/components/ResponseTimeCard';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeOverview } from '../../features/uptime/components/UptimeOverview';
import { UptimeMonitorStatusBadge } from '../../features/uptime/components/UptimeMonitorStatusBadge';
import { useUptimeMonitorDetail } from '../../features/uptime/useUptimeMonitorDetail';
import {
  api, type TimelineIncident, type UptimeMonitor, type UptimeMonitorInput, type UptimeMonitorMetric,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { formatDuration, formatIncidentTime } from '../../utils/incidentFormat';
import { listReturnTo } from '../../utils/listReturnTo';

// 최근 = 체크별 막대(체크마다 상태 코드·메시지가 있다), 6H·24H = 버킷. Uptime Kuma의 recent/6h/24h와 같다.
type ResponseRange = 'recent' | '6h' | '24h';
const RESPONSE_RANGES = [{ label: '최근', value: 'recent' }, { label: '6H', value: '6h' }, { label: '24H', value: '24h' }] as const;
const BUCKET_CAPTION = { '6h': '최근 6시간, 5분 단위, ms', '24h': '최근 24시간, 20분 단위, ms' } as const;

function ResponseTimeChart({ monitorId, metrics, range, refreshKey }: { monitorId: string; metrics: UptimeMonitorMetric[]; range: ResponseRange; refreshKey: number }) {
  const thresholds = useAlertThresholds({ kind: 'direct', serviceId: monitorId }, 'response_time');
  const bucketRange = range === 'recent' ? '6h' : range;
  const loadBuckets = useCallback(() => api.getUptimeMonitorBuckets(monitorId, bucketRange), [monitorId, bucketRange]);
  if (range !== 'recent') {
    return <BucketedResponseTimeChart load={loadBuckets} windowMs={(range === '6h' ? 6 : 24) * 3_600_000} caption={BUCKET_CAPTION[range]} thresholds={thresholds} refreshKey={refreshKey} />;
  }
  // A failed check's responseTime is how long it waited before giving up (the
  // timeout), not a response — as a bar it would read as "slow" and stretch the axis.
  const slots = [...metrics].reverse().map((metric) => {
    const ok = metric.status === 'success';
    const code = metric.statusCode ? `HTTP ${metric.statusCode}` : ok ? '정상 응답' : '';
    return {
      t: new Date(metric.checkedAt).getTime(),
      latencyMs: ok ? metric.responseTime : null,
      state: ok ? 'up' as const : 'down' as const,
      detail: [code, ok ? '' : metric.errorMessage].filter(Boolean).join(', ') || '체크 실패',
    };
  });
  const hours = slots.length > 1 ? Math.round((slots[slots.length - 1].t - slots[0].t) / 3_600_000) : 0;

  return (
    <ResponseTimeCard
      slots={slots}
      failedChecks={slots.filter((slot) => slot.latencyMs === null).length}
      caption={[`체크 ${slots.length}회`, hours > 0 && `최근 ${hours}시간`, 'ms'].filter(Boolean).join(', ')}
      thresholds={thresholds}
    />
  );
}

const CHECK_LOG_ROWS = 10;

// 연속 실패가 기준(환경설정)을 넘은 구간 — 체크 기록 한 줄보다 "언제부터 얼마나"가 먼저 궁금하다.
function OutageHistory({ incidents }: { incidents: TimelineIncident[] }) {
  return (
    <section className="rounded-xl border border-ui-border bg-bg-surface p-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="type-card-title text-text-base">장애 이력</h2>
        <span className="type-caption text-text-dim">최근 90일</span>
      </div>
      {incidents.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-dim">최근 90일 동안 기록된 장애가 없습니다</div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-2xl table-fixed text-sm">
            <thead>
              <tr className="text-left type-caption text-text-muted">
                <th className="w-24 px-2 py-2 font-normal">상태</th>
                <th className="w-32 px-2 py-2 font-normal">시작</th>
                <th className="w-32 px-2 py-2 font-normal">지속 시간</th>
                <th className="px-2 py-2 font-normal">메시지</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.startedAt} className="border-t border-ui-border-soft">
                  <td className="px-2 py-2.5"><StatusLight tone={incident.active ? 'error' : 'healthy'} label={incident.active ? '진행 중' : '복구'} /></td>
                  <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-text-secondary" title={new Date(incident.startedAt).toLocaleString()}>{formatIncidentTime(incident.startedAt)}</td>
                  <td className="px-2 py-2.5 tabular-nums text-text-base">{formatDuration(incident.durationSec)}</td>
                  <td className="truncate px-2 py-2.5 font-mono text-xs text-text-muted" title={incident.message}>{incident.message || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const CERT_WARN_DAYS = 14;

const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/** 남은 일수가 먼저 읽히게 `D-80 · 2027. 1. 15.`. 14일 이하는 주의, 지나면 오류 색. */
function CertExpiry({ iso }: { iso: string }) {
  const expires = new Date(iso);
  const days = daysUntil(iso);
  const tone = days < 0 ? 'text-status-error' : days <= CERT_WARN_DAYS ? 'text-status-warn' : '';
  return <span className={`tabular-nums ${tone}`}>{days < 0 ? '만료됨' : `D-${days}`} · {expires.toLocaleDateString()}</span>;
}

function metaFields(monitor: UptimeMonitor, target: string) {
  return [
    { label: monitor.type === 'tcp' ? 'Host' : 'URL', value: <span className="truncate font-mono">{target}</span> },
    { label: 'Protocol', value: monitor.type.toUpperCase() },
    { label: 'Interval', value: `${monitor.interval}초` },
    ...(monitor.type === 'http' ? [{ label: '기대 상태 코드', value: <span className="tabular-nums">{monitor.expectedStatus}</span> }] : []),
    ...(monitor.certExpiresAt ? [{ label: '인증서', value: <CertExpiry iso={monitor.certExpiresAt} /> }] : []),
  ];
}

// TCP 체크에는 HTTP 상태 코드가 없다 — 열을 두면 모든 행이 `-`다.
function CheckLog({ metrics, showStatusCode }: { metrics: UptimeMonitorMetric[]; showStatusCode: boolean }) {
  const rows = metrics.slice(0, CHECK_LOG_ROWS);
  // Bars share one scale across the table; failed checks have no response time to draw.
  const longest = Math.max(1, ...rows.filter((metric) => metric.status === 'success').map((metric) => metric.responseTime));
  return (
    <section className="rounded-xl border border-ui-border bg-bg-surface p-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="type-card-title text-text-base">체크 기록</h2>
        {rows.length > 0 && <span className="type-caption text-text-dim">최근 {rows.length}회</span>}
      </div>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-dim">아직 체크 기록이 없습니다</div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-2xl table-fixed text-sm">
            <thead>
              <tr className="text-left type-caption text-text-muted">
                <th className="w-20 px-2 py-2 font-normal">결과</th>
                <th className="w-44 px-2 py-2 font-normal">시각</th>
                {showStatusCode && <th className="w-16 px-2 py-2 font-normal">HTTP</th>}
                <th className="w-28 px-2 py-2 font-normal sm:w-64">응답 시간</th>
                <th className="px-2 py-2 font-normal">메시지</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((metric) => {
                const ok = metric.status === 'success';
                return (
                  <tr key={metric.id} className="border-t border-ui-border-soft">
                    <td className="px-2 py-2.5"><StatusLight tone={ok ? 'healthy' : 'error'} label={ok ? '성공' : '실패'} /></td>
                    <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-text-secondary">{formatTimeLabel(new Date(metric.checkedAt).getTime())}</td>
                    {showStatusCode && <td className="px-2 py-2.5 tabular-nums text-text-muted">{metric.statusCode ?? '-'}</td>}
                    <td className="px-2 py-2.5">
                      {ok ? (
                        <div className="flex items-center gap-2">
                          <span className="hidden h-1.5 w-40 rounded-full bg-ui-hover sm:block">
                            <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${(metric.responseTime / longest) * 100}%` }} />
                          </span>
                          <span className="tabular-nums text-text-base">{metric.responseTime.toLocaleString()}ms</span>
                        </div>
                      ) : (
                        <span className="text-text-dim">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-xs text-text-muted">{ok ? '' : metric.errorMessage}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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
  const returnTo = listReturnTo(location.state, '/uptime');

  const { monitor, metrics, summary, history, incidents, loading, refreshing, errors, notFound, load } = useUptimeMonitorDetail(monitorId);
  const [range, setRange] = useState<ResponseRange>('recent');
  // 버킷 차트는 자기 데이터를 따로 불러오므로 새로고침 신호만 받는다.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => { setRefreshKey((key) => key + 1); void load(); };
  useBreadcrumb(monitor ? [{ label: monitor.name }] : []);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);

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
  const failedSources = [errors.monitor && '모니터', errors.metrics && '체크 기록', errors.summary && '30일 요약', errors.history && '90일 이력', errors.incidents && '장애 이력'].filter(Boolean);
  const actionsDisabled = processing || refreshing || Boolean(errors.monitor);

  return (
    <div className="space-y-5">
      {/* 데스크톱은 AppHeader breadcrumb의 첫 크럼이 이 역할을 한다 (DESIGN.md §3.4) */}
      <Link to={returnTo} className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-action lg:hidden">
        <MaterialIcon size={20} name="arrow_back" />업타임
      </Link>
      <PageHeader
        title={monitor.name}
        meta={
          <DetailMeta
            status={
              <>
                {/* 상태와 그 상태를 바꾸는 액션을 붙여 둔다 — 수집 키 옆 키 재발급과 같은 자리 (§4.1) */}
                <UptimeMonitorStatusBadge monitor={monitor} />
                <ActiveToggleButton active={monitor.isActive} disabled={actionsDisabled} loading={processing} onClick={() => void toggleActive()} />
              </>
            }
            fields={metaFields(monitor, target)}
          />
        }
      />
      <DetailActionToolbar
        controls={<>
          <SegmentedControl options={RESPONSE_RANGES} value={range} onChange={setRange} ariaLabel="응답 시간 범위" />
          <Button collapseLabel variant="secondary" loading={refreshing} disabled={processing} onClick={refresh}><MaterialIcon name="refresh" />새로고침</Button>
        </>}
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

      <UptimeOverview
        stats={[
          { label: '24시간 업타임', value: monitor.uptime === undefined ? '-' : `${monitor.uptime.toFixed(2)}%` },
          { label: '30일 업타임', value: summary && summary.totalChecks > 0 ? `${summary.uptime.toFixed(2)}%` : '-' },
          { label: '평균 응답 (24시간)', value: monitor.responseTime === undefined ? '-' : `${monitor.responseTime.toLocaleString()}ms` },
          { label: '마지막 확인', value: lastCheck },
        ]}
        historyUptime={history && history.days.length > 0 ? history.percentage : undefined}
        days={(history?.days ?? []).map((day) => ({ date: day.date, uptime: day.uptime }))}
        error={!history ? errors.history : undefined}
      />
      {metrics ? <ResponseTimeChart monitorId={monitor.id} metrics={metrics} range={range} refreshKey={refreshKey} /> : (
        <section className="rounded-xl border border-ui-border bg-bg-surface p-6 text-sm text-text-muted">응답 시간과 체크 기록을 불러오지 못했습니다.</section>
      )}
      {incidents && <OutageHistory incidents={incidents} />}
      {metrics && <CheckLog metrics={metrics} showStatusCode={monitor.type === 'http'} />}

      {editing && <UptimeMonitorDialog monitor={monitor} onClose={() => setEditing(false)} onSave={updateMonitor} />}
      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => void deleteMonitor()}
        title="업타임을 삭제할까요?"
        message={<><strong className="break-all font-medium text-text-base">{monitor.name}</strong>을 삭제하면 수집된 상태와 체크 기록도 함께 삭제됩니다.</>}
        confirmLabel="삭제"
        isProcessing={processing}
      />
    </div>
  );
}
