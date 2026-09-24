import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { GlobalTimeRange } from '../../../components/common';
import {
  CHART_INITIAL_DIMENSION, ChartStatsLegend, ChartTooltip, areaProps, chartCardClass, coverRanges, formatAxisValue,
  gridProps, lineProps, medianStep, niceYAxis, rangeAreas, splitGaps, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
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
  const thresholds = useAlertThresholds({ kind: 'agent', agentId, serviceKey }, 'response_time');

  // Each point is a bucket of checks. latencyMs averages the healthy checks only,
  // so a bucket where every check failed has no latency at all.
  const buckets = points.map((p) => ({
    t: new Date(p.time).getTime(),
    latencyMs: p.uptimePct > 0 ? Math.round(p.latencyMs) : null,
    failed: Math.round(p.total * (1 - p.uptimePct / 100)),
  }));
  const step = medianStep(buckets.map((b) => b.t));
  const failedChecks = buckets.reduce((sum, b) => sum + b.failed, 0);
  const downRanges = coverRanges(buckets.filter((b) => b.failed > 0).map((b) => b.t), step);
  const latencies = buckets.flatMap((b) => (b.latencyMs === null ? [] : [b.latencyMs]));
  const { rows, gaps } = splitGaps(buckets, step);

  return (
    <div className={`mb-8 p-6 ${chartCardClass}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="type-card-title text-text-base">응답 시간</h3>
      </div>

      {loading ? (
        <div className="h-48 bg-ui-hover rounded animate-pulse" />
      ) : buckets.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-text-dim text-sm">
          데이터 없음
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={192} initialDimension={CHART_INITIAL_DIMENSION}>
            <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps(theme)} />
              <XAxis {...timeXAxisProps(theme, [loadedAt - RANGE_MS[range], loadedAt])} />
              <YAxis
                {...yAxisProps(theme, 52)}
                {...niceYAxis(Math.max(0, ...latencies, ...thresholds.map((r) => r.threshold)))}
                tickFormatter={(v) => formatAxisValue(v, 'ms')}
              />
              {rangeAreas(gaps, theme.tickColor, '체크 없음', 0.08)}
              {rangeAreas(downRanges, theme.errorColor, '다운')}
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
                    valueFormatter={(v) => String(Math.round(v))}
                  />
                )}
              />
              <Area {...areaProps(theme.primaryColor)} dataKey="latencyMs" />
              <Line {...lineProps(theme.primaryColor, theme)} dataKey="latencyMs" name="응답 시간" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2">
            <ChartStatsLegend
              series={[{
                label: '응답 시간',
                color: theme.primaryColor,
                values: latencies,
              }]}
              unit="ms"
              valueFormatter={(v) => String(Math.round(v))}
            />
          </div>
          {failedChecks > 0 && (
            <p className="mt-2 type-body text-text-muted">{`실패한 체크 ${failedChecks}회는 빨간 구간으로 표시하고 응답 시간 통계에서 뺐습니다.`}</p>
          )}
        </>
      )}
    </div>
  );
}
