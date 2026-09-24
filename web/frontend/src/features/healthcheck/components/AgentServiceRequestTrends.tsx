import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  CHART_INITIAL_DIMENSION, ChartStatsLegend, ChartTooltip, SERIES_HEX, chartCardClass, fillBuckets, formatAxisValue,
  gridProps, lineProps, niceYAxis, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
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
  errorRate: number | null; // percent; null when the bucket had no requests
  p50: number | null;
  p95: number | null;
}

type Panel = 'latency' | 'count' | 'error';

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
  // The three panels share a crosshair (syncId); only the hovered one shows its tooltip box.
  const [hovered, setHovered] = useState<Panel | null>(null);
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
      errorRate: b.count > 0 ? Math.round((b.errorCount / b.count) * 1000) / 10 : null,
      p50: b.timed > 0 ? b.p50 : null,
      p95: b.timed > 0 ? b.p95 : null,
    })),
    timeWindow,
    bucketMs,
    (t) => ({ t, count: 0, errorRate: null, p50: null, p95: null }),
  ), [buckets, timeWindow, bucketMs]);

  // Latency series only render when at least one bucket has timed requests —
  // access-log-only services (no duration) show volume + error rate alone.
  const anyLatency = buckets.some((b) => b.timed > 0);
  const values = (key: 'p50' | 'p95' | 'count' | 'errorRate') =>
    data.flatMap((d) => (d[key] === null ? [] : [d[key]]));

  if (loading) {
    return <div className="h-56 bg-ui-hover rounded-xl animate-pulse" />;
  }
  if (buckets.length === 0) {
    return null; // empty state is handled by the request list below
  }

  const panelProps = { data, timeWindow, theme, hovered, onHover: setHovered };

  return (
    <div className={`p-6 ${chartCardClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="type-card-title text-text-base">요청 추이</h3>
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

      {/* One measure per panel. The error rate used to share a fixed 0–100%
          right axis with request volume, which flattened a 5% spike onto the floor. */}
      <div className="space-y-4">
        {anyLatency && (
          <TrendPanel
            {...panelProps}
            id="latency"
            title="지연 시간"
            unit="ms"
            height={150}
            max={Math.max(0, ...values('p95'), ...values('p50'))}
            valueFormatter={(v) => String(Math.round(v))}
            legend={(
              <ChartStatsLegend
                series={[
                  { label: 'p50', color: theme.primaryColor, values: values('p50') },
                  { label: 'p95', color: SERIES_HEX.amber, values: values('p95') },
                ]}
                unit="ms"
                valueFormatter={(v) => String(Math.round(v))}
              />
            )}
          >
            <Line {...lineProps(theme.primaryColor, theme)} dataKey="p50" name="p50" />
            <Line {...lineProps(SERIES_HEX.amber, theme)} dataKey="p95" name="p95" />
          </TrendPanel>
        )}
        <TrendPanel {...panelProps} id="count" title="요청 수" unit="건" height={100} max={Math.max(0, ...values('count'))} valueFormatter={(v) => String(v)}>
          <Bar dataKey="count" name="요청 수" fill={theme.primaryColor} fillOpacity={0.45} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </TrendPanel>
        <TrendPanel {...panelProps} id="error" title="에러율" unit="%" height={120} max={Math.max(0, ...values('errorRate'))} valueFormatter={(v) => String(v)} showTimeAxis>
          <Line {...lineProps(SERIES_HEX.red, theme)} dataKey="errorRate" name="에러율" />
        </TrendPanel>
      </div>
    </div>
  );
}

function TrendPanel({
  id, title, unit, height, max, valueFormatter, legend, showTimeAxis = false, children,
  data, timeWindow, theme, hovered, onHover,
}: {
  id: Panel;
  title: string;
  unit: string;
  height: number;
  max: number;
  valueFormatter: (value: number) => string;
  legend?: ReactNode;
  /** Only the bottom panel labels the shared time axis. */
  showTimeAxis?: boolean;
  children: ReactNode;
  data: ChartPoint[];
  timeWindow: [number, number];
  theme: ChartTheme;
  hovered: Panel | null;
  onHover: (panel: Panel | null) => void;
}) {
  return (
    <section aria-label={title} onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)}>
      <div className="mb-1.5 flex items-baseline gap-2">
        <h4 className="type-label text-text-base">{title}</h4>
        <span className="type-caption text-text-dim">{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={height + (showTimeAxis ? 24 : 0)} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
        <ComposedChart data={data} syncId="request-trends" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps(theme)} />
          <XAxis {...timeXAxisProps(theme, timeWindow)} hide={!showTimeAxis} />
          <YAxis {...yAxisProps(theme, 52)} {...niceYAxis(max)} tickFormatter={(v) => formatAxisValue(v)} />
          <Tooltip cursor={tooltipCursor(theme)} content={({ active, label, payload }) => hovered === id && (
            <ChartTooltip active={active} label={label} payload={payload as TooltipPayloadItem[]} unit={unit} theme={theme} valueFormatter={valueFormatter} />
          )} />
          {children}
        </ComposedChart>
      </ResponsiveContainer>
      {legend && <div className="mt-2">{legend}</div>}
    </section>
  );
}

export function AgentServiceRequestTrends({ agentId, serviceKey, ...props }: AgentProps) {
  return <ServiceRequestTrends {...props} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceRequestTrends({ observedServiceId, ...props }: DirectProps) {
  return <ServiceRequestTrends {...props} source={{ kind: 'direct', observedServiceId }} />;
}
