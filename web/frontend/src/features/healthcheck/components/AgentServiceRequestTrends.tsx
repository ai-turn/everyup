import { useState, useEffect, useId, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import {
  CHART_HEIGHT, CHART_MARGIN, CHART_INITIAL_DIMENSION, ChartCard, ChartLegend, ChartSkeleton, ChartTooltip, SERIES_HEX, areaGradient, areaProps, fillBuckets,
  formatAxisValue, formatTimeLabel, gridProps, lineProps, niceYAxis, timeXAxisProps, tooltipCursor, useChartKeyboard, useChartTheme, yAxisProps,
  type ChartTheme, type TooltipPayloadItem,
} from '../../../components/charts';
import { api, type AgentEvent, type ApiRequestStatBucket, type ApiRequestStatusSummary } from '../../../services/api';
import { TimeRangePicker } from '../../../components/common/TimeRangePicker';
import { Button } from '../../../components/common';
import { getErrorMessage } from '../../../utils/errors';
import { useRequestWindow, type RequestWindow, type StatusClass } from '../../api-requests/useRequestQuery';

type TimeRange = '1h' | '6h' | '24h';
// Bucket width per range keeps ~30-60 points on the chart.
const RANGES: { value: TimeRange; hours: number; bucketMins: number }[] = [
  { value: '1h', hours: 1, bucketMins: 2 },
  { value: '6h', hours: 6, bucketMins: 10 },
  { value: '24h', hours: 24, bucketMins: 30 },
];
// Week-over-week overlay: a slow regression never trips an alert, but it stands out
// against the same hours last week. A week is a whole number of buckets for every
// range, so shifted buckets land on the same slots.
const WEEK_MS = 7 * 24 * 3600_000;

interface SharedProps {
  refreshKey?: number;
  /** Controlled range from the page-header picker; when set, own buttons hide. */
  range?: TimeRange;
  window?: RequestWindow;
  /** 분포 띠의 2xx~5xx를 아래 요청 목록의 필터로 쓴다. 없으면 띠는 읽기 전용. */
  status?: StatusClass;
  onStatusChange?: (status?: StatusClass) => void;
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
  p99: number | null;
  // Same slot one week earlier.
  prevCount: number | null;
  prevErrorRate: number | null;
  prevP99: number | null;
}

type Metric = 'count' | 'error' | 'latency';

function ServiceRequestTrends({
  source,
  refreshKey,
  range: controlledRange,
  window: controlledWindow,
  status: statusFilter,
  onStatusChange,
}: SharedProps & { source: RequestTrendSource }) {
  const [localRange, setLocalRange] = useState<TimeRange>('6h');
  const range = controlledRange ?? localRange;
  const [buckets, setBuckets] = useState<ApiRequestStatBucket[]>([]);
  const [prevBuckets, setPrevBuckets] = useState<ApiRequestStatBucket[]>([]);
  const [deploys, setDeploys] = useState<AgentEvent[]>([]);
  const [summary, setSummary] = useState<ApiRequestStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const fallbackWindow = useRequestWindow(range, refreshKey);
  const window = controlledWindow ?? fallbackWindow;
  const timeWindow = useMemo<[number, number]>(() => [Date.parse(window.from), Date.parse(window.to)], [window]);
  const [metric, setMetric] = useState<Metric>('count');
  const gradientId = useId().replace(/[^\w-]/g, '');
  const sourceKind = source.kind;
  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : undefined;
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    let active = true;
    const load = async () => {
      // A refresh keeps the previous chart until the new data lands instead of flashing the skeleton.
      setError(null);
      setSummaryError(false);
      const r = RANGES.find((x) => x.value === range)!;
      const { from, to } = window;
      const fetchStats = (params: { from: string; to?: string; bucketMins: number }) => (sourceKind === 'direct'
        ? api.getObservedServiceRequestStats(observedServiceId, params)
        : serviceKey
          ? api.getAgentServiceRequestStats(agentId, serviceKey, params)
          : api.getAgentRequestStats(agentId, params));
      const current = fetchStats({ from, to, bucketMins: r.bucketMins });
      // Non-critical — no overlay when last week is missing or fails.
      fetchStats({
        from: new Date(Date.parse(from) - WEEK_MS).toISOString(),
        to: new Date(Date.parse(to) - WEEK_MS).toISOString(),
        bucketMins: r.bucketMins,
      }).then(result => { if (active) setPrevBuckets(result.truncated ? [] : result.buckets); }, () => { if (active) setPrevBuckets([]); });
      // Deploy markers: "did this start before or after the rollout?" Agent sources only.
      if (sourceKind === 'agent') {
        api.getAgentDeploys(agentId, { from, key: serviceKey }).then(d => { if (active) setDeploys(d ?? []); }, () => { if (active) setDeploys([]); });
      }
      const summaryRequest = sourceKind === 'direct'
        ? api.getObservedServiceRequestStatusSummary(observedServiceId, { from, to })
        : api.getRequestStatusSummary(agentId, serviceKey, { from, to });
      void summaryRequest.then(value => { if (active) setSummary(value); }, () => { if (active) { setSummary(null); setSummaryError(true); } });
      try {
        const result = await current;
        if (active) {
          setBuckets(result.buckets);
          setTruncated(result.truncated);
        }
      } catch (error) {
        if (active) setError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [agentId, observedServiceId, range, refreshKey, serviceKey, sourceKind, window, retryKey]);

  const theme = useChartTheme();
  const bucketMs = (RANGES.find((x) => x.value === range) ?? RANGES[0]).bucketMins * 60_000;

  // The server only returns buckets that had requests; an absent bucket is zero
  // requests, not missing data, so the volume bars must show it as such.
  const data: ChartPoint[] = useMemo(() => {
    const prevBySlot = new Map(prevBuckets.map((b) => [Math.floor((Date.parse(b.time) + WEEK_MS) / bucketMs) * bucketMs, b]));
    return fillBuckets(
      buckets.map((b) => ({
        t: Date.parse(b.time),
        count: b.count,
        success: b.count - b.errorCount,
        errors: b.errorCount,
        errorRate: b.count > 0 ? errorRatePct(b) : null,
        p50: b.timed > 0 ? b.p50 : null,
        p95: b.timed > 0 ? b.p95 : null,
        p99: b.timed > 0 ? b.p99 : null,
      })),
      timeWindow,
      bucketMs,
      (t) => ({ t, count: 0, success: 0, errors: 0, errorRate: null, p50: null, p95: null, p99: null }),
    ).map((row) => {
      const prev = prevBySlot.get(row.t);
      return {
        ...row,
        // An empty slot last week had zero requests — same rule as the current bars.
        prevCount: prevBuckets.length > 0 ? prev?.count ?? 0 : null,
        prevErrorRate: prev && prev.count > 0 ? errorRatePct(prev) : null,
        prevP99: prev && prev.timed > 0 ? prev.p99 : null,
      };
    });
  }, [buckets, prevBuckets, timeWindow, bucketMs]);
  const kbd = useChartKeyboard(data.length);
  const kbdPoint = kbd.index === null ? undefined : data[kbd.index];

  if (loading) {
    return <ChartCard title="서비스 전체 추이"><ChartSkeleton /></ChartCard>;
  }
  if (error) {
    return <ChartCard title="서비스 전체 추이"><div role="alert" className="space-y-3">
      <p className="type-body text-status-warn">요청 추이를 불러오지 못했습니다</p>
      <p className="type-body text-text-muted">{error}</p>
      <Button variant="secondary" size="sm" onClick={() => { setLoading(true); setRetryKey(key => key + 1); }}>다시 시도</Button>
    </div></ChartCard>;
  }
  if (truncated) {
    return <ChartCard title="서비스 전체 추이"><div role="status" className="space-y-2">
      <p className="type-body text-status-warn">조회 범위의 요청이 많아 추이를 표시하지 못했습니다</p>
      <p className="type-body text-text-muted">기간을 줄여 다시 확인해 주세요. 일부 요청만으로 전체 기간의 통계를 표시하지 않습니다.</p>
      {!controlledRange && <TimeRangePicker value={range} onChange={setLocalRange} />}
    </div></ChartCard>;
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
  const latestPoint = [...data].reverse().find(d => d.p95 !== null);
  const latestP95 = latestPoint?.p95 ?? 0;
  const values = (key: Exclude<keyof ChartPoint, 't'>) =>
    data.flatMap((d) => (d[key] === null ? [] : [d[key]]));

  const tiles: { id: Metric; label: string; value: string; unit: string }[] = [
    { id: 'count', label: '요청 수', value: totalCount.toLocaleString(), unit: '건' },
    { id: 'error', label: '에러율', value: (totalCount > 0 ? (totalErrors / totalCount) * 100 : 0).toFixed(1), unit: '%' },
    ...(anyLatency ? [{ id: 'latency' as const, label: '마지막 측정 구간 p95', value: String(Math.round(latestP95)), unit: 'ms' }] : []),
  ];
  const view = {
    count: {
      caption: `건 / ${bucketMs / 60_000}분`,
      legend: [{ label: '성공', color: theme.primaryColor }, { label: '에러', color: SERIES_HEX.red }],
      prevKey: 'prevCount' as const,
      prevLabel: '지난주',
      max: Math.max(0, ...values('count')),
    },
    error: { caption: '%', legend: [], prevKey: 'prevErrorRate' as const, prevLabel: '지난주', max: Math.max(0, ...values('errorRate')) },
    latency: {
      caption: 'ms',
      legend: [
        { label: 'p50', color: theme.primaryColor },
        { label: 'p95', color: SERIES_HEX.emerald },
        { label: 'p99', color: SERIES_HEX.amber },
      ],
      prevKey: 'prevP99' as const,
      prevLabel: 'p99 · 지난주',
      max: Math.max(0, ...values('p99'), ...values('p95'), ...values('p50')),
    },
  }[shown];
  const prevValues = values(view.prevKey);
  const legend = [
    ...view.legend,
    ...(prevValues.length > 0 ? [{ label: view.prevLabel, color: theme.tickColor }] : []),
    ...(deploys.length > 0 ? [{ label: '배포', color: SERIES_HEX.violet }] : []),
  ];

  return (
    <ChartCard title="서비스 전체 추이" right={!controlledRange && <TimeRangePicker value={range} onChange={setLocalRange} />}>

      <p className="mb-3 type-caption text-text-muted">선택한 기간의 서비스 전체 요청입니다. 아래 목록의 검색·오류·trace 필터는 적용하지 않습니다.</p>
      {summaryError && <div role="status" className="mb-3 flex flex-wrap items-center gap-2"><p className="type-caption text-status-warn">상태코드 분포를 불러오지 못했습니다</p><Button variant="ghost" size="sm" onClick={() => setRetryKey(key => key + 1)}>다시 시도</Button></div>}

      {/* Status-class distribution + top 5xx endpoint (1a 콘솔 prototype) */}
      {summary && (summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther) > 0 && (() => {
        const total = summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther;
        const classes: { label: string; status?: StatusClass; count: number; bar: string; text: string }[] = [
          { label: '2xx', status: '2xx' as const, count: summary.count2xx, bar: 'bg-status-healthy', text: 'text-status-healthy' },
          { label: '3xx', status: '3xx' as const, count: summary.count3xx, bar: 'bg-slate-400', text: 'text-text-muted' },
          { label: '4xx', status: '4xx' as const, count: summary.count4xx, bar: 'bg-status-warn', text: 'text-status-warn' },
          { label: '5xx', status: '5xx' as const, count: summary.count5xx, bar: 'bg-status-error', text: 'text-status-error' },
          { label: '기타', count: summary.countOther, bar: 'bg-status-idle', text: 'text-text-muted' },
        ].filter((c) => c.count > 0);
        // 서비스 상세에서는 아래 Endpoint 표가 "5xx 최다" 한 줄을 대신한다. 표가 없는 Docker 환경 전체 추이에만 남긴다.
        const rollup = sourceKind === 'agent' && !serviceKey;
        return (
          <div className="mb-4">
            <div className="flex h-2 rounded-full overflow-hidden bg-ui-hover">
              {classes.map((c) => (
                <div key={c.label} className={c.bar} style={{ width: `${(c.count / total) * 100}%` }} />
              ))}
            </div>
            <div role={onStatusChange ? 'group' : undefined} aria-label={onStatusChange ? '상태코드로 요청 목록 거르기' : undefined} className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
              {classes.map((c) => {
                const text = `${c.label} ${((c.count / total) * 100).toFixed(1)}%`;
                if (!onStatusChange || !c.status) return <span key={c.label} className={c.text}>{text}</span>;
                const pressed = statusFilter === c.status;
                return (
                  <button key={c.label} type="button" aria-pressed={pressed} onClick={() => onStatusChange(pressed ? undefined : c.status)}
                    className={`-mx-1.5 rounded px-1.5 py-0.5 tabular-nums underline-offset-2 transition-colors hover:underline aria-pressed:bg-ui-hover aria-pressed:underline ${c.text}`}>
                    {text}
                  </button>
                );
              })}
              {rollup && summary.top5xxPath && (
                <span className="text-text-muted truncate">
                  {'5xx 최다'}: <span className="font-mono text-status-error">{summary.top5xxMethod} {summary.top5xxPath}</span> ×{summary.top5xxCount}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* One chart, one measure at a time: ms, counts and % can't share an axis
          (a fixed 0–100% second axis once flattened a 5% error spike). The tiles
          keep all three numbers in view and the tooltip shows every measure. */}
      <div role="group" aria-label="표시할 지표" className={`grid grid-cols-2 gap-2 ${tiles.length === 3 ? 'sm:grid-cols-3' : ''}`}>
        {tiles.map((tile) => {
          const active = tile.id === shown;
          return (
            <button
              key={tile.id}
              type="button"
              aria-pressed={active}
              onClick={() => setMetric(tile.id)}
              className={`flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${tile.id === 'latency' ? 'max-sm:col-span-2' : ''} ${
                active ? 'border-primary ring-1 ring-inset ring-primary' : 'border-ui-border hover:bg-ui-hover-soft'
              }`}
            >
              <span className={`truncate type-caption ${active ? 'text-text-secondary' : 'text-text-muted'}`}>{tile.label}</span>
              <span className="text-xl tabular-nums text-text-base">
                {tile.value}
                <span className="ml-0.5 type-caption text-text-dim">{tile.unit}</span>
              </span>
              {tile.id === 'latency' && latestPoint && <span className="type-caption text-text-muted">{new Date(latestPoint.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}~{new Date(Math.min(latestPoint.t + bucketMs, timeWindow[1])).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4 mb-1.5 flex min-h-6 items-center justify-between gap-3">
        <span className="type-caption text-text-dim">{view.caption}</span>
        {legend.length > 0 && <ChartLegend items={legend} />}
      </div>
      <div tabIndex={0} role="group" aria-label="요청 추이. 좌우 방향키로 시점별 값을 읽습니다." className="rounded-lg" onKeyDown={kbd.onKeyDown} onBlur={kbd.onBlur}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
        <ComposedChart data={data} margin={CHART_MARGIN} accessibilityLayer={false}>
          {shown === 'error' && areaGradient(gradientId, SERIES_HEX.red)}
          <CartesianGrid {...gridProps(theme)} />
          <XAxis {...timeXAxisProps(theme, timeWindow)} />
          <YAxis {...yAxisProps(theme, 52)} {...niceYAxis(Math.max(view.max, ...prevValues))} tickFormatter={(v) => formatAxisValue(v)} />
          <Tooltip
            cursor={tooltipCursor(theme)}
            content={({ active, label, payload }) => (
              <ChartTooltip
                active={active}
                label={label}
                payload={bucketRows((payload?.[0] as { payload?: ChartPoint } | undefined)?.payload, theme, shown)}
                unit=""
                theme={theme}
                valueFormatter={(v) => String(Math.round(v * 10) / 10)}
                footer={deployFooter((payload?.[0] as { payload?: ChartPoint } | undefined)?.payload, deploys, bucketMs, !serviceKey)}
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
            <Line key="p95" {...lineProps(SERIES_HEX.emerald, theme)} dataKey="p95" name="p95" />,
            <Line key="p99" {...lineProps(SERIES_HEX.amber, theme)} dataKey="p99" name="p99" />,
          ]}
          {deploys.map((d) => (
            <ReferenceLine key={d.id} x={Date.parse(d.time)} stroke={SERIES_HEX.violet} strokeWidth={1.5} ifOverflow="hidden" />
          ))}
          {prevValues.length > 0 && (
            <Line {...lineProps(theme.tickColor, theme)} dataKey={view.prevKey} name={view.prevLabel} strokeDasharray="4 3" />
          )}
          {kbdPoint && <ReferenceLine x={kbdPoint.t} stroke={theme.tickColor} strokeDasharray="3 3" />}
        </ComposedChart>
      </ResponsiveContainer>
      {/* 마우스 사용자에게 빈 줄을 남기지 않게, 고르기 전에는 화면에서만 숨긴다(라이브 영역은 유지). */}
      <p aria-live="polite" className={kbdPoint ? 'mt-2 px-2 pb-1 type-caption tabular-nums text-text-muted' : 'sr-only'}>
        {kbdPoint && pointText(kbdPoint)}
      </p>
      </div>
    </ChartCard>
  );
}

/** Rollouts inside the hovered bucket — the marker line is too thin to hover on its own. */
function deployFooter(row: ChartPoint | undefined, deploys: AgentEvent[], bucketMs: number, withService: boolean) {
  if (!row) return null;
  const hits = deploys.filter((d) => {
    const t = Date.parse(d.time);
    return t >= row.t && t < row.t + bucketMs;
  });
  if (hits.length === 0) return null;
  return hits.map((d) => {
    const at = new Date(d.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    const previous = typeof d.metadata?.previousImage === 'string' ? d.metadata.previousImage : '';
    // Same image ref = recreated on the same tag or restarted by hand.
    const what = previous && previous !== d.message ? `배포 ${previous} → ${d.message}` : `재시작 ${d.message ?? ''}`;
    return <span key={d.id} className="block">{at} {withService && d.serviceName ? `${d.serviceName} · ` : ''}{what}</span>;
  });
}

/** 키보드로 고른 구간의 값. 가운뎃점 대신 쉼표로 잇는다(ADR 0009). */
function pointText(p: ChartPoint) {
  const latency = (['p50', 'p95', 'p99'] as const).flatMap((key) => (p[key] === null ? [] : [`${key} ${p[key]}ms`]));
  return [`${formatTimeLabel(p.t)}: 요청 ${p.count}건`, `에러 ${p.errors}건${p.errorRate === null ? '' : ` (${p.errorRate}%)`}`, ...latency].join(', ');
}

function errorRatePct(b: ApiRequestStatBucket): number {
  return Math.round((b.errorCount / b.count) * 1000) / 10;
}

/** Every measure of the hovered bucket, whichever one the chart is drawing, plus last week's value of the drawn one. */
function bucketRows(row: ChartPoint | undefined, theme: ChartTheme, shown: Metric): TooltipPayloadItem[] {
  if (!row) return [];
  const rows: TooltipPayloadItem[] = [
    { name: '요청', value: row.count, unit: '건', color: theme.primaryColor },
    { name: '에러', value: row.errors, unit: row.errorRate === null ? '건' : `건 · ${row.errorRate}%`, color: SERIES_HEX.red },
  ];
  if (row.p50 !== null) rows.push({ name: 'p50', value: row.p50, unit: 'ms', color: theme.primaryColor });
  if (row.p95 !== null) rows.push({ name: 'p95', value: row.p95, unit: 'ms', color: SERIES_HEX.emerald });
  if (row.p99 !== null) rows.push({ name: 'p99', value: row.p99, unit: 'ms', color: SERIES_HEX.amber });
  const prev = {
    count: { name: '요청 · 지난주', value: row.prevCount, unit: '건' },
    error: { name: '에러율 · 지난주', value: row.prevErrorRate, unit: '%' },
    latency: { name: 'p99 · 지난주', value: row.prevP99, unit: 'ms' },
  }[shown];
  if (prev.value !== null) rows.push({ ...prev, value: prev.value, color: theme.tickColor });
  return rows.map((item) => ({ ...item, dataKey: item.name }));
}

export function AgentServiceRequestTrends({ agentId, serviceKey, ...props }: AgentProps) {
  return <ServiceRequestTrends {...props} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceRequestTrends({ observedServiceId, ...props }: DirectProps) {
  return <ServiceRequestTrends {...props} source={{ kind: 'direct', observedServiceId }} />;
}
