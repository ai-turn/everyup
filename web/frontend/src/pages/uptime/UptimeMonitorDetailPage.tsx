import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button, ConfirmDialog, MaterialIcon } from '../../components/common';
import {
  CHART_INITIAL_DIMENSION, ChartStatsLegend, ChartTooltip, areaProps, chartCardClass, formatAxisValue, getChartTheme,
  gridProps, lineProps, tooltipCursor, xAxisProps, yAxisProps,
} from '../../components/charts';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeOverview } from '../../features/uptime/components/UptimeOverview';
import { UptimeMonitorStatusBadge } from '../../features/uptime/components/UptimeMonitorStatusBadge';
import {
  api, type UptimeMonitor, type UptimeMonitorHistory, type UptimeMonitorInput,
  type UptimeMonitorMetric, type UptimeMonitorSummary,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

const HISTORY_DAYS = 90;

function ResponseTimeChart({ metrics }: { metrics: UptimeMonitorMetric[] }) {

  const theme = getChartTheme();
  const chartData = [...metrics].reverse().map((metric) => ({
    latencyMs: metric.responseTime,
    timeLabel: new Date(metric.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));
  const maxLatency = chartData.length > 0 ? Math.max(...chartData.map((point) => point.latencyMs)) : 0;

  return (
    <div className={`p-6 ${chartCardClass}`}>
      <h2 className="mb-6 type-card-title text-text-base">응답 시간</h2>
      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-text-dim">데이터 없음</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={192} initialDimension={CHART_INITIAL_DIMENSION}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps(theme)} />
              <XAxis dataKey="timeLabel" {...xAxisProps(theme)} />
              <YAxis {...yAxisProps(theme, 52)} tickFormatter={(value) => formatAxisValue(value, 'ms')} domain={[0, Math.max(maxLatency * 1.2, 100)]} />
              <Tooltip
                cursor={tooltipCursor(theme)}
                content={({ active, label, payload }) => (
                  <ChartTooltip
                    active={active}
                    label={label}
                    payload={payload as import('../../components/charts').TooltipPayloadItem[]}
                    unit="ms"
                    theme={theme}
                    valueFormatter={(value) => String(Math.round(value))}
                  />
                )}
              />
              <Area {...areaProps(theme.primaryColor)} dataKey="latencyMs" />
              <Line {...lineProps(theme.primaryColor)} dataKey="latencyMs" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2">
            <ChartStatsLegend
              series={[{ label: '응답 시간', color: theme.primaryColor, values: chartData.map((point) => point.latencyMs) }]}
              unit="ms"
              valueFormatter={(value) => String(Math.round(value))}
            />
          </div>
        </>
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
              {metric.statusCode ? <span className="font-mono text-xs text-text-muted">HTTP {metric.statusCode}</span> : null}
              <span className="w-16 text-right font-mono text-xs tabular-nums text-text-muted">{metric.responseTime}ms</span>
            </div>
          ))}
        </div>
      )}
    </section>
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

  const load = useCallback(async () => {
    if (!monitorId) return;
    setLoading(true);
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
        <Button variant="secondary" onClick={() => navigate('/uptime')}>업타임으로 돌아가기</Button>
      </div>
    );
  }

  const target = monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url;
  const lastCheck = monitor.lastCheckAt
    ? new Date(monitor.lastCheckAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="space-y-5">
      <div>
        {/* 데스크톱은 AppHeader breadcrumb의 첫 크럼이 이 역할을 한다 (DESIGN.md §3.4) */}
        <Link to="/uptime" className="mb-3 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary lg:hidden">
          <MaterialIcon size={20} name="arrow_back" />업타임
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-2xl font-bold text-text-base">{monitor.name}</h1>
              <UptimeMonitorStatusBadge monitor={monitor} />
            </div>
            <p className="mt-1 truncate font-mono text-sm text-text-muted">{target}</p>
            <p className="mt-1 text-xs text-text-dim">{monitor.type.toUpperCase()} · {monitor.interval}{'초마다 확인'} · 직접 설정</p>
          </div>
          <div className="flex flex-wrap gap-2 md:shrink-0">
            <button
              type="button"
              aria-label="새로고침"
              title="새로고침"
              onClick={() => void load()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-ui-hover hover:text-text-base"
            >
              <MaterialIcon name="refresh" />
            </button>
            <Button variant="secondary" disabled={processing} onClick={() => void toggleActive()}>{monitor.isActive ? '일시정지' : '재개'}</Button>
            <Button variant="secondary" onClick={() => setEditing(true)}><MaterialIcon name="edit" />수정</Button>
            <Button variant="ghost" onClick={() => setDeleting(true)}><MaterialIcon name="delete" className="text-status-error" />삭제</Button>
          </div>
        </div>
      </div>

      <UptimeOverview
        stats={[
          { label: '30일 업타임', value: summary ? `${summary.uptime.toFixed(2)}%` : '—' },
          { label: '90일 업타임', value: history && history.days.length > 0 ? `${history.percentage.toFixed(2)}%` : '—' },
          { label: '30일 실패', value: summary ? `${summary.failedChecks.toLocaleString()}회` : '—' },
          { label: '마지막 확인', value: lastCheck },
        ]}
        days={(history?.days ?? []).map((day) => ({ date: day.date, uptime: day.uptime }))}
      />
      <ResponseTimeChart metrics={metrics} />
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
