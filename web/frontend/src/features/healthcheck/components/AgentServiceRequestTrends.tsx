import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  CHART_INITIAL_DIMENSION, ChartLegend, ChartStatsLegend, ChartTooltip, SERIES_HEX, chartCardClass, formatAxisValue,
  getChartTheme, gridProps, lineProps, tooltipCursor, xAxisProps, yAxisProps,
} from '../../../components/charts';
import { api, type ApiRequestStatBucket, type ApiRequestStatusSummary } from '../../../services/api';
import { TimeRangePicker } from '../../../components/common/TimeRangePicker';

type TimeRange = '1h' | '6h' | '24h';
// Bucket width per range keeps ~30-60 points on the chart.
const RANGES: { value: TimeRange; hours: number; bucketMins: number }[] = [
  { value: '1h', hours: 1, bucketMins: 2 },
  { value: '6h', hours: 6, bucketMins: 10 },
  { value: '24h', hours: 24, bucketMins: 30 },
];

interface SharedProps {
  refreshKey?: number;
  /** Controlled range from the page-header picker; when set, own buttons hide. */
  range?: TimeRange;
}

interface AgentProps extends SharedProps {
  agentId: string;
  /** Omit for a project-level rollup across all of the agent's services. */
  serviceKey?: string;
}

interface DirectProps extends SharedProps {
  observedServiceId: string;
}

type RequestTrendSource =
  | { kind: 'agent'; agentId: string; serviceKey?: string }
  | { kind: 'direct'; observedServiceId: string };

interface ChartPoint {
  timeLabel: string;
  count: number;
  errorRate: number; // percent
  p50: number;
  p95: number;
  hasLatency: boolean;
}

function ServiceRequestTrends({
  source,
  refreshKey,
  range: controlledRange,
}: SharedProps & { source: RequestTrendSource }) {
  const [localRange, setLocalRange] = useState<TimeRange>('6h');
  const range = controlledRange ?? localRange;
  const [buckets, setBuckets] = useState<ApiRequestStatBucket[]>([]);
  const [summary, setSummary] = useState<ApiRequestStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const sourceKind = source.kind;
  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : undefined;
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    const load = async () => {
      const r = RANGES.find((x) => x.value === range)!;
      const from = new Date(Date.now() - r.hours * 3600 * 1000).toISOString();
      const params = { from, bucketMins: r.bucketMins };
      setLoading(true);
      const fetchStats = sourceKind === 'direct'
        ? api.getObservedServiceRequestStats(observedServiceId, params)
        : serviceKey
          ? api.getAgentServiceRequestStats(agentId, serviceKey, params)
          : api.getAgentRequestStats(agentId, params);
      try {
        setBuckets((await fetchStats) ?? []);
      } catch {
        setBuckets([]);
      } finally {
        setLoading(false);
      }
      // Non-critical — the strip hides itself when the summary is missing.
      try {
        setSummary(sourceKind === 'direct'
          ? await api.getObservedServiceRequestStatusSummary(observedServiceId, { from })
          : await api.getRequestStatusSummary(agentId, serviceKey, { from }));
      } catch {
        setSummary(null);
      }
    };
    void load();
  }, [agentId, observedServiceId, range, refreshKey, serviceKey, sourceKind]);

  const theme = getChartTheme();

  const data: ChartPoint[] = useMemo(() => buckets.map((b) => ({
    timeLabel: new Date(b.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    count: b.count,
    errorRate: b.count > 0 ? Math.round((b.errorCount / b.count) * 1000) / 10 : 0,
    p50: b.p50,
    p95: b.p95,
    hasLatency: b.timed > 0,
  })), [buckets]);

  // Latency series only render when at least one bucket has timed requests —
  // access-log-only services (no duration) show volume + error rate alone.
  const anyLatency = data.some((d) => d.hasLatency);

  if (loading) {
    return <div className="h-56 bg-ui-hover rounded-xl animate-pulse" />;
  }
  if (data.length === 0) {
    return null; // empty state is handled by the request list below
  }

  return (
    <div className={`p-6 ${chartCardClass}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="type-card-title text-text-base">요청 추이</h3>
          <ChartLegend
            items={[
              { label: '요청 수', color: theme.primaryColor },
              { label: '에러율(%)', color: SERIES_HEX.red },
            ]}
          />
        </div>
        {!controlledRange && (
          <TimeRangePicker value={range} onChange={setLocalRange} />
        )}
      </div>

      {/* Status-class distribution + top 5xx endpoint (1a 콘솔 prototype) */}
      {summary && (summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther) > 0 && (() => {
        const total = summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther;
        const classes = [
          { label: '2xx', count: summary.count2xx, bar: 'bg-status-healthy', text: 'text-status-healthy' },
          { label: '3xx', count: summary.count3xx, bar: 'bg-slate-400', text: 'text-text-muted' },
          { label: '4xx', count: summary.count4xx, bar: 'bg-status-warn', text: 'text-status-warn' },
          { label: '5xx', count: summary.count5xx, bar: 'bg-status-error', text: 'text-status-error' },
        ].filter((c) => c.count > 0);
        return (
          <div className="mb-4">
            <div className="flex h-2 rounded-full overflow-hidden bg-ui-hover">
              {classes.map((c) => (
                <div key={c.label} className={c.bar} style={{ width: `${(c.count / total) * 100}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
              {classes.map((c) => (
                <span key={c.label} className={`${c.text}`}>
                  {c.label} {((c.count / total) * 100).toFixed(1)}%
                </span>
              ))}
              {summary.top5xxPath && (
                <span className="text-text-muted truncate">
                  · {'5xx 최다'}: <span className="font-mono text-status-error">{summary.top5xxMethod} {summary.top5xxPath}</span> ×{summary.top5xxCount}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Latency percentiles (only when we have timed requests) */}
      {anyLatency && (
        <>
          <ResponsiveContainer width="100%" height={160} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps(theme)} />
              <XAxis dataKey="timeLabel" {...xAxisProps(theme)} />
              <YAxis {...yAxisProps(theme, 52)} tickFormatter={(v) => formatAxisValue(v, 'ms')} />
              <Tooltip cursor={tooltipCursor(theme)} content={({ active, label, payload }) => (
                <ChartTooltip active={active} label={label} payload={payload as import('../../../components/charts').TooltipPayloadItem[]} unit="ms" theme={theme} valueFormatter={(v) => String(Math.round(v))} />
              )} />
              <Line {...lineProps(theme.primaryColor)} dataKey="p50" name="p50" />
              <Line {...lineProps(SERIES_HEX.amber)} dataKey="p95" name="p95" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mb-3 mt-2">
            <ChartStatsLegend
              series={[
                { label: 'p50', color: theme.primaryColor, values: data.filter((d) => d.hasLatency).map((d) => d.p50) },
                { label: 'p95', color: SERIES_HEX.amber, values: data.filter((d) => d.hasLatency).map((d) => d.p95) },
              ]}
              unit="ms"
              valueFormatter={(v) => String(Math.round(v))}
            />
          </div>
        </>
      )}

      {/* Volume + error rate */}
      <ResponsiveContainer width="100%" height={140} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps(theme)} />
          <XAxis dataKey="timeLabel" {...xAxisProps(theme)} />
          <YAxis yAxisId="count" {...yAxisProps(theme, 40)} domain={[0, 'dataMax']} allowDataOverflow allowDecimals={false} />
          <YAxis yAxisId="err" {...yAxisProps(theme, 40)} orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
          <Tooltip cursor={tooltipCursor(theme)} content={({ active, label, payload }) => (
            <ChartTooltip active={active} label={label} payload={payload as import('../../../components/charts').TooltipPayloadItem[]} unit="" theme={theme} valueFormatter={(v) => String(v)} />
          )} />
          <Bar yAxisId="count" dataKey="count" name="요청 수" fill={theme.primaryColor} fillOpacity={0.35} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Line {...lineProps(SERIES_HEX.red)} yAxisId="err" dataKey="errorRate" name="에러율(%)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgentServiceRequestTrends({ agentId, serviceKey, ...props }: AgentProps) {
  return <ServiceRequestTrends {...props} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceRequestTrends({ observedServiceId, ...props }: DirectProps) {
  return <ServiceRequestTrends {...props} source={{ kind: 'direct', observedServiceId }} />;
}
