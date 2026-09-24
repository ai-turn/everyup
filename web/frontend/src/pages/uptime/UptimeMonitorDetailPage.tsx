import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button, ButtonLink, ConfirmDialog, DetailActionToolbar, DetailMeta, MaterialIcon, PageHeader, StatusLight } from '../../components/common';
import {
  CHART_INITIAL_DIMENSION, ChartSummary, ChartTooltip, areaGradient, areaProps, chartCardClass, formatAxisValue,
  gridProps, lineProps, niceYAxis, rangeAreas, runRanges, splitGaps, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
} from '../../components/charts';
import { useAlertThresholds } from '../../features/alerts/useAlertThresholds';
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

  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const thresholds = useAlertThresholds({ kind: 'direct', serviceId: monitorId }, 'response_time');
  // A failed check's responseTime is how long it waited before giving up (the
  // timeout), not a response — plotting it reads as "slow" and stretches the axis.
  const checks = [...metrics].reverse().map((metric) => ({
    t: new Date(metric.checkedAt).getTime(),
    latencyMs: metric.status === 'success' ? metric.responseTime : null,
  }));
  const failedCount = checks.filter((check) => check.latencyMs === null).length;
  const latencies = checks.flatMap((check) => (check.latencyMs === null ? [] : [check.latencyMs]));
  // Gaps use the observed spacing, not the configured interval — history recorded
  // under an older interval would otherwise read as missed checks.
  const { rows, gaps } = splitGaps(checks);
  const domain: [number, number] = checks.length > 0 ? [checks[0].t, checks[checks.length - 1].t] : [0, 1];
  const round = (value: number) => String(Math.round(value));

  return (
    <div className={`p-6 ${chartCardClass}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="type-card-title text-text-base">응답 시간</h2>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {failedCount > 0 && <StatusLight tone="error" label={`실패 ${failedCount}회`} />}
          <ChartSummary values={latencies} unit="ms" valueFormatter={round} />
        </div>
      </div>
      {checks.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-text-dim">데이터 없음</div>
      ) : (
        <ResponsiveContainer width="100%" height={192} initialDimension={CHART_INITIAL_DIMENSION}>
          <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            {areaGradient(gradientId, theme.primaryColor)}
            <CartesianGrid {...gridProps(theme)} />
            <XAxis {...timeXAxisProps(theme, domain)} />
            <YAxis {...yAxisProps(theme, 52)} {...niceYAxis(Math.max(0, ...latencies, ...thresholds.map((r) => r.threshold)))} tickFormatter={(value) => formatAxisValue(value, 'ms')} />
            {rangeAreas(gaps, theme.tickColor, 0.06)}
            {rangeAreas(runRanges(checks, (check) => check.latencyMs === null), theme.errorColor)}
            {thresholdLines(thresholds, theme.errorColor, 'ms')}
            <Tooltip
              cursor={tooltipCursor(theme)}
              content={({ active, label, payload }) => (
                <ChartTooltip
                  active={active}
                  label={label}
                  payload={payload as import('../../components/charts').TooltipPayloadItem[]}
                  unit="ms"
                  theme={theme}
                  valueFormatter={round}
                />
              )}
            />
            <Area {...areaProps(gradientId)} dataKey="latencyMs" />
            <Line {...lineProps(theme.primaryColor, theme)} dataKey="latencyMs" name="응답 시간" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function RecentChecks({ metrics }: { metrics: UptimeMonitorMetric[] }) {
  return (
    <section className="rounded-xl border border-ui-border bg-bg-surface p-6">
      <h2 className="mb-4 type-card-title text-text-base">최근 체크 기록</h2>
      {metrics.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-dim">아직 체크 기록이 없습니다</div>
      ) : (
        <div className="divide-y divide-ui-border-soft">
          {metrics.slice(0, 10).map((metric) => (
            <div key={metric.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span role="img" aria-label={metric.status === 'success' ? '정상' : '장애'} className={`h-2.5 w-2.5 shrink-0 rounded-full ${metric.status === 'success' ? 'bg-status-healthy' : 'bg-status-error'}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-secondary">{metric.errorMessage || metric.status === 'success' ? '정상 응답' : '체크 실패'}</p>
                <p className="mt-0.5 text-xs text-text-dim">{new Date(metric.checkedAt).toLocaleString()}</p>
              </div>
              {metric.statusCode ? <span className="text-xs text-text-muted">HTTP {metric.statusCode}</span> : null}
              <span className="w-16 text-right text-xs tabular-nums text-text-muted">{metric.responseTime}ms</span>
            </div>
          ))}
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
      <RecentChecks metrics={metrics} />

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
