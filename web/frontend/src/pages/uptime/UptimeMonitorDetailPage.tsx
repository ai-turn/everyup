import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, ButtonLink, ConfirmDialog, DetailActionToolbar, DetailMeta, MaterialIcon, PageHeader, StatusLight } from '../../components/common';
import { formatTimeLabel } from '../../components/charts';
import { useAlertThresholds } from '../../features/alerts/useAlertThresholds';
import { ResponseTimeCard } from '../../features/uptime/components/ResponseTimeCard';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeOverview } from '../../features/uptime/components/UptimeOverview';
import { UptimeMonitorStatusBadge } from '../../features/uptime/components/UptimeMonitorStatusBadge';
import {
  api, type UptimeMonitor, type UptimeMonitorHistory, type UptimeMonitorInput,
  type UptimeMonitorMetric, type UptimeMonitorSummary,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

const HISTORY_DAYS = 90;

function ResponseTimeChart({ monitorId, metrics }: { monitorId: string; metrics: UptimeMonitorMetric[] }) {
  const thresholds = useAlertThresholds({ kind: 'direct', serviceId: monitorId }, 'response_time');
  // A failed check's responseTime is how long it waited before giving up (the
  // timeout), not a response — as a bar it would read as "slow" and stretch the axis.
  const slots = [...metrics].reverse().map((metric) => {
    const ok = metric.status === 'success';
    const code = metric.statusCode ? `HTTP ${metric.statusCode}` : ok ? '정상 응답' : '';
    return {
      t: new Date(metric.checkedAt).getTime(),
      latencyMs: ok ? metric.responseTime : null,
      state: ok ? 'up' as const : 'down' as const,
      detail: [code, ok ? '' : metric.errorMessage].filter(Boolean).join(' · ') || '체크 실패',
    };
  });
  const hours = slots.length > 1 ? Math.round((slots[slots.length - 1].t - slots[0].t) / 3_600_000) : 0;

  return (
    <ResponseTimeCard
      slots={slots}
      failedChecks={slots.filter((slot) => slot.latencyMs === null).length}
      caption={[`체크 ${slots.length}회`, hours > 0 && `최근 ${hours}시간`, 'ms'].filter(Boolean).join(' · ')}
      thresholds={thresholds}
    />
  );
}

const CHECK_LOG_ROWS = 10;

function CheckLog({ metrics }: { metrics: UptimeMonitorMetric[] }) {
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left type-caption text-text-muted">
                <th className="px-2 py-2 font-normal">결과</th>
                <th className="px-2 py-2 font-normal">시각</th>
                <th className="px-2 py-2 font-normal">HTTP</th>
                <th className="px-2 py-2 font-normal">응답 시간</th>
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
                    <td className="px-2 py-2.5 tabular-nums text-text-muted">{metric.statusCode ?? '—'}</td>
                    <td className="px-2 py-2.5">
                      {ok ? (
                        <div className="flex items-center gap-2.5">
                          <span className="hidden h-1.5 w-40 rounded-full bg-ui-hover sm:block">
                            <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${(metric.responseTime / longest) * 100}%` }} />
                          </span>
                          <span className="tabular-nums text-text-base">{metric.responseTime.toLocaleString()}ms</span>
                        </div>
                      ) : (
                        <span className="text-text-dim">—</span>
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
function ActiveToggleButton({ active, disabled, onClick }: { active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" disabled={disabled} onClick={onClick}>
      <MaterialIcon name={active ? 'pause' : 'play_arrow'} />
      {active ? '일시정지' : '재개'}
    </Button>
  );
}

export function UptimeMonitorDetailPage() {
  const { monitorId } = useParams<{ monitorId: string }>();
  const navigate = useNavigate();

  const [monitor, setMonitor] = useState<UptimeMonitor | null>(null);
  const [metrics, setMetrics] = useState<UptimeMonitorMetric[]>([]);
  const [summary, setSummary] = useState<UptimeMonitorSummary | null>(null);
  const [history, setHistory] = useState<UptimeMonitorHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useBreadcrumb(monitor ? [{ label: monitor.name }] : []);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);

  // `loading` covers the first load only — a refresh keeps the page on screen
  // instead of swapping it for the spinner.
  const load = useCallback(async () => {
    if (!monitorId) return;
    setError(null);
    try {
      const [monitorData, metricData, summaryData, historyData] = await Promise.all([
        api.getUptimeMonitor(monitorId),
        api.getUptimeMonitorMetrics(monitorId, 100),
        api.getUptimeMonitorSummary(monitorId, '30d'),
        api.getUptimeMonitorHistory(monitorId, HISTORY_DAYS),
      ]);
      setMonitor(monitorData);
      setMetrics(metricData ?? []);
      setSummary(summaryData);
      setHistory(historyData);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [monitorId]);

  useEffect(() => { void load(); }, [load]);

  const updateMonitor = async (input: UptimeMonitorInput) => {
    if (!monitor) return;
    await api.updateUptimeMonitor(monitor.id, { ...input, isActive: monitor.isActive });
    await load();
  };

  const toggleActive = async () => {
    if (!monitor) return;
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
    if (!monitor) return;
    setProcessing(true);
    try {
      await api.deleteUptimeMonitor(monitor.id);
      navigate('/uptime');
    } catch (actionError) {
      toast.error(getErrorMessage(actionError));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center gap-3 text-text-muted"><MaterialIcon size={24} name="sync" className="animate-spin" />불러오는 중</div>;
  }

  if (error || !monitor) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <MaterialIcon size={32} name="error_outline" className="text-status-error" />
        <div><p className="font-medium text-text-base">업타임 모니터를 찾을 수 없습니다</p>{error && <p className="mt-1 text-sm text-text-muted">{error}</p>}</div>
        <ButtonLink variant="secondary" to="/uptime">업타임으로 돌아가기</ButtonLink>
      </div>
    );
  }

  const target = monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url;
  const lastCheck = monitor.lastCheckAt
    ? new Date(monitor.lastCheckAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="space-y-5">
      {/* 데스크톱은 AppHeader breadcrumb의 첫 크럼이 이 역할을 한다 (DESIGN.md §3.4) */}
      <Link to="/uptime" className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary lg:hidden">
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
                <ActiveToggleButton active={monitor.isActive} disabled={processing} onClick={() => void toggleActive()} />
              </>
            }
            fields={[
              { label: monitor.type === 'tcp' ? 'Host' : 'URL', value: <span className="truncate font-mono">{target}</span> },
              { label: 'Protocol', value: monitor.type.toUpperCase() },
              { label: 'Interval', value: `${monitor.interval}초` },
            ]}
          />
        }
      />
      <DetailActionToolbar
        controls={<Button collapseLabel variant="secondary" onClick={() => void load()}><MaterialIcon name="refresh" />새로고침</Button>}
        actions={
          <>
            <Button collapseLabel variant="secondary" onClick={() => setEditing(true)}><MaterialIcon name="edit" />수정</Button>
            <Button collapseLabel variant="destructive" onClick={() => setDeleting(true)}><MaterialIcon name="delete_outline" />삭제</Button>
          </>
        }
      />

      <UptimeOverview
        stats={[
          { label: '30일 업타임', value: summary ? `${summary.uptime.toFixed(2)}%` : '—' },
          { label: '90일 업타임', value: history && history.days.length > 0 ? `${history.percentage.toFixed(2)}%` : '—' },
          { label: '30일 실패', value: summary ? `${summary.failedChecks.toLocaleString()}회` : '—' },
          { label: '마지막 확인', value: lastCheck },
        ]}
        days={(history?.days ?? []).map((day) => ({ date: day.date, uptime: day.uptime }))}
      />
      <ResponseTimeChart monitorId={monitor.id} metrics={metrics} />
      <CheckLog metrics={metrics} />

      {editing && <UptimeMonitorDialog monitor={monitor} onClose={() => setEditing(false)} onSave={updateMonitor} />}
      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => void deleteMonitor()}
        title="업타임을 삭제할까요?"
        message="삭제하면 수집된 상태와 체크 기록도 함께 삭제됩니다."
        confirmLabel="삭제"
        isProcessing={processing}
      />
    </div>
  );
}
