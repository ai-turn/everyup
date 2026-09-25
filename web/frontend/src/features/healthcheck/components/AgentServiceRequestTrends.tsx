import { useState, useEffect, useId, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  CHART_HEIGHT, CHART_INITIAL_DIMENSION, ChartCard, ChartLegend, ChartSkeleton, ChartTooltip, SERIES_HEX, areaGradient, areaProps, fillBuckets,
  formatAxisValue, gridProps, lineProps, niceYAxis, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
  type ChartTheme, type TooltipPayloadItem,
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
  t: number;
  count: number;
  success: number;
  errors: number;
  errorRate: number | null; // percent; null when the bucket had no requests
  p50: number | null;
  p95: number | null;
}

type Metric = 'count' | 'error' | 'latency';

function ServiceRequestTrends({
  source,
  refreshKey,
  range: controlledRange,
}: SharedProps & { source: RequestTrendSource }) {
  const [localRange, setLocalRange] = useState<TimeRange>('6h');
  const range = controlledRange ?? localRange;
  const [buckets, setBuckets] = useState<ApiRequestStatBucket[]>([]);
  const [timeWindow, setTimeWindow] = useState<[number, number]>([0, 1]);
  const [summary, setSummary] = useState<ApiRequestStatusSummary | null>(null);
  // First load only — a refresh keeps the previous chart instead of flashing the skeleton.
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('count');
  const gradientId = useId().replace(/[^\w-]/g, '');
  const sourceKind = source.kind;
  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : undefined;
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    const load = async () => {
      const r = RANGES.find((x) => x.value === range)!;
      const to = Date.now();
      const from = new Date(to - r.hours * 3600 * 1000).toISOString();
      const params = { from, bucketMins: r.bucketMins };
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
        setTimeWindow([Date.parse(from), to]);
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

  const theme = useChartTheme();
  const bucketMs = (RANGES.find((x) => x.value === range) ?? RANGES[0]).bucketMins * 60_000;

  // The server only returns buckets that had requests; an absent bucket is zero
  // requests, not missing data, so the volume bars must show it as such.
  const data: ChartPoint[] = useMemo(() => fillBuckets(
    buckets.map((b) => ({
      t: Date.parse(b.time),
      count: b.count,
      success: b.count - b.errorCount,
      errors: b.errorCount,
      errorRate: b.count > 0 ? Math.round((b.errorCount / b.count) * 1000) / 10 : null,
      p50: b.timed > 0 ? b.p50 : null,
      p95: b.timed > 0 ? b.p95 : null,
    })),
    timeWindow,
    bucketMs,
    (t) => ({ t, count: 0, success: 0, errors: 0, errorRate: null, p50: null, p95: null }),
  ), [buckets, timeWindow, bucketMs]);

  if (loading) {
    return <ChartCard title="요청 추이"><ChartSkeleton /></ChartCard>;
  }
  if (buckets.length === 0) {
    return null; // empty state is handled by the request list below
  }

  // Latency only exists when some bucket has timed requests — access-log-only
  // services (no duration) get the count and error-rate views alone.
  const anyLatency = buckets.some((b) => b.timed > 0);
  const shown: Metric = metric === 'latency' && !anyLatency ? 'count' : metric;
  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
  const totalErrors = buckets.reduce((sum, b) => sum + b.errorCount, 0);
  const latestP95 = [...data].reverse().find((d) => d.p95 !== null)?.p95 ?? 0;
  const values = (key: 'p50' | 'p95' | 'count' | 'errorRate') =>
    data.flatMap((d) => (d[key] === null ? [] : [d[key]]));

  const tiles: { id: Metric; label: string; value: string; unit: string }[] = [
    { id: 'count', label: '요청 수', value: totalCount.toLocaleString(), unit: '건' },
    { id: 'error', label: '에러율', value: (totalCount > 0 ? (totalErrors / totalCount) * 100 : 0).toFixed(1), unit: '%' },
    ...(anyLatency ? [{ id: 'latency' as const, label: '지연 시간 p95 · 최근', value: String(Math.round(latestP95)), unit: 'ms' }] : []),
  ];
  const view = {
    count: {
      caption: `건 / ${bucketMs / 60_000}분`,
      legend: [{ label: '성공', color: theme.primaryColor }, { label: '에러', color: SERIES_HEX.red }],
      max: Math.max(0, ...values('count')),
    },
    error: { caption: '%', legend: [], max: Math.max(0, ...values('errorRate')) },
    latency: {
      caption: 'ms',
      legend: [{ label: 'p50', color: theme.primaryColor }, { label: 'p95', color: SERIES_HEX.amber }],
      max: Math.max(0, ...values('p95'), ...values('p50')),
    },
  }[shown];

  return (
    <ChartCard title="요청 추이" right={!controlledRange && <TimeRangePicker value={range} onChange={setLocalRange} />}>

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

      {/* One chart, one measure at a time: ms, counts and % can't share an axis
          (a fixed 0–100% second axis once flattened a 5% error spike). The tiles
          keep all three numbers in view and the tooltip shows every measure. */}
      <div role="group" aria-label="표시할 지표" className={`grid gap-2 ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tiles.map((tile) => {
          const active = tile.id === shown;
          return (
            <button
              key={tile.id}
              type="button"
              aria-pressed={active}
              onClick={() => setMetric(tile.id)}
              className={`flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                active ? 'border-primary ring-1 ring-inset ring-primary' : 'border-ui-border hover:bg-ui-hover-soft'
              }`}
            >
              <span className={`truncate type-caption ${active ? 'text-text-secondary' : 'text-text-muted'}`}>{tile.label}</span>
              <span className="text-xl tabular-nums text-text-base">
                {tile.value}
                <span className="ml-0.5 type-caption text-text-dim">{tile.unit}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 mb-1.5 flex min-h-6 items-center justify-between gap-3">
        <span className="type-caption text-text-dim">{view.caption}</span>
        {view.legend.length > 0 && <ChartLegend items={view.legend} />}
      </div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          {shown === 'error' && areaGradient(gradientId, SERIES_HEX.red)}
          <CartesianGrid {...gridProps(theme)} />
          <XAxis {...timeXAxisProps(theme, timeWindow)} />
          <YAxis {...yAxisProps(theme, 52)} {...niceYAxis(view.max)} tickFormatter={(v) => formatAxisValue(v)} />
          <Tooltip
            cursor={tooltipCursor(theme)}
            content={({ active, label, payload }) => (
              <ChartTooltip
                active={active}
                label={label}
                payload={bucketRows((payload?.[0] as { payload?: ChartPoint } | undefined)?.payload, theme)}
                unit=""
                theme={theme}
                valueFormatter={(v) => String(Math.round(v * 10) / 10)}
              />
            )}
          />
          {shown === 'count' && [
            // A surface-coloured stroke leaves a hairline between the stacked segments.
            <Bar key="success" dataKey="success" stackId="requests" name="성공" fill={theme.primaryColor} fillOpacity={0.5} stroke={theme.tooltipBg} strokeWidth={1} isAnimationActive={false} />,
            <Bar key="errors" dataKey="errors" stackId="requests" name="에러" fill={SERIES_HEX.red} stroke={theme.tooltipBg} strokeWidth={1} isAnimationActive={false} />,
          ]}
          {shown === 'error' && [
            <Area key="fill" {...areaProps(gradientId)} dataKey="errorRate" />,
            <Line key="line" {...lineProps(SERIES_HEX.red, theme)} dataKey="errorRate" name="에러율" />,
          ]}
          {shown === 'latency' && [
            <Line key="p50" {...lineProps(theme.primaryColor, theme)} dataKey="p50" name="p50" />,
            <Line key="p95" {...lineProps(SERIES_HEX.amber, theme)} dataKey="p95" name="p95" />,
          ]}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Every measure of the hovered bucket, whichever one the chart is drawing. */
function bucketRows(row: ChartPoint | undefined, theme: ChartTheme): TooltipPayloadItem[] {
  if (!row) return [];
  const rows: TooltipPayloadItem[] = [
    { name: '요청', value: row.count, unit: '건', color: theme.primaryColor },
    { name: '에러', value: row.errors, unit: row.errorRate === null ? '건' : `건 · ${row.errorRate}%`, color: SERIES_HEX.red },
  ];
  if (row.p50 !== null) rows.push({ name: 'p50', value: row.p50, unit: 'ms', color: theme.primaryColor });
  if (row.p95 !== null) rows.push({ name: 'p95', value: row.p95, unit: 'ms', color: SERIES_HEX.amber });
  return rows.map((item) => ({ ...item, dataKey: item.name }));
}

export function AgentServiceRequestTrends({ agentId, serviceKey, ...props }: AgentProps) {
  return <ServiceRequestTrends {...props} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceRequestTrends({ observedServiceId, ...props }: DirectProps) {
  return <ServiceRequestTrends {...props} source={{ kind: 'direct', observedServiceId }} />;
}
