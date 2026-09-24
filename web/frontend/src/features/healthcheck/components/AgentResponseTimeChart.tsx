import { useEffect, useId, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { StatusLight, type GlobalTimeRange } from '../../../components/common';
import {
  CHART_INITIAL_DIMENSION, ChartSummary, ChartTooltip, areaGradient, areaProps, chartCardClass, formatAxisValue,
  gridProps, lineProps, niceYAxis, rangeAreas, runRanges, splitGaps, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
} from '../../../components/charts';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import { api, type ServiceHistoryPoint } from '../../../services/api';

interface AgentResponseTimeChartProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

const RANGE_MS: Record<GlobalTimeRange, number> = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 };

export function AgentResponseTimeChart({ agentId, serviceKey, refreshKey, range }: AgentResponseTimeChartProps) {

  const [points, setPoints] = useState<ServiceHistoryPoint[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  // First load only — a refresh keeps the previous chart instead of flashing the skeleton.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setPoints(await api.getAgentServiceHistory(agentId, serviceKey, range));
      } catch {
        setPoints([]);
      } finally {
        setLoadedAt(Date.now());
        setLoading(false);
      }
    };
    void load();
  }, [agentId, serviceKey, range, refreshKey]);

  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const thresholds = useAlertThresholds({ kind: 'agent', agentId, serviceKey }, 'response_time');

  // Each point is a bucket of checks. latencyMs averages the healthy checks only,
  // so a bucket where every check failed has no latency at all.
  const windowStart = loadedAt - RANGE_MS[range];
  const buckets = points
    .map((p) => ({
      t: new Date(p.time).getTime(),
      latencyMs: p.uptimePct > 0 ? Math.round(p.latencyMs) : null,
      failed: Math.round(p.total * (1 - p.uptimePct / 100)),
    }))
    // Summary, scale and bands describe the chart's window only.
    .filter((b) => b.t >= windowStart);
  const failedChecks = buckets.reduce((sum, b) => sum + b.failed, 0);
  const latencies = buckets.flatMap((b) => (b.latencyMs === null ? [] : [b.latencyMs]));
  const { rows, gaps } = splitGaps(buckets);
  const round = (v: number) => String(Math.round(v));

  return (
    <div className={`mb-8 p-6 ${chartCardClass}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="type-card-title text-text-base">응답 시간</h3>
        {!loading && (
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {failedChecks > 0 && <StatusLight tone="error" label={`실패 ${failedChecks}회`} />}
            <ChartSummary values={latencies} unit="ms" valueFormatter={round} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-48 bg-ui-hover rounded animate-pulse" />
      ) : buckets.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-text-dim text-sm">
          데이터 없음
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192} initialDimension={CHART_INITIAL_DIMENSION}>
          <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            {areaGradient(gradientId, theme.primaryColor)}
            <CartesianGrid {...gridProps(theme)} />
            <XAxis {...timeXAxisProps(theme, [windowStart, loadedAt])} />
            <YAxis
              {...yAxisProps(theme, 52)}
              {...niceYAxis(Math.max(0, ...latencies, ...thresholds.map((r) => r.threshold)))}
              tickFormatter={(v) => formatAxisValue(v, 'ms')}
            />
            {rangeAreas(gaps, theme.tickColor, 0.06)}
            {rangeAreas(runRanges(buckets, (b) => b.failed > 0, (b) => b.latencyMs === null), theme.errorColor)}
            {thresholdLines(thresholds, theme.errorColor, 'ms')}
            <Tooltip
              cursor={tooltipCursor(theme)}
              content={({ active, label, payload }) => (
                <ChartTooltip
                  active={active}
                  label={label}
                  payload={payload as import('../../../components/charts').TooltipPayloadItem[]}
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
