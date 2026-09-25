import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Button, MaterialIcon, SearchInput, type GlobalTimeRange } from '../../../components/common';
import {
  CHART_HEIGHT, CHART_INITIAL_DIMENSION, ChartCard, ChartEmpty, ChartLegend, ChartSkeleton, ChartStats, ChartStatsLegend, ChartSummary, ChartTooltip,
  areaGradient, areaProps, formatAxisValue, getSeriesPalette, metricDisplayUnit,
  getSeriesDash, gridProps, lineProps, niceYAxis, rangeAreas, splitGaps, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
} from '../../../components/charts';
import { Skeleton } from '../../../components/skeleton';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import { api, type AlertRule, type OtelHistogramQuantiles, type OtelMetricName, type OtelMetricPoint } from '../../../services/api';
import { TracePanel } from '../../traces/components/TracePanel';

const MAX_SERIES = 6;
// Below this the whole grid fits at a glance and a search box is noise.
const SEARCH_MIN_METRICS = 8;
// The server caps a point read at 5000 and applies the cap before grouping by
// attribute series, so a metric with many series silently returns a shorter
// window than asked for. Asking explicitly lets us say so instead.
const POINT_LIMIT = 5000;
const RANGE_HOURS: Record<GlobalTimeRange, number> = { '1h': 1, '6h': 6, '24h': 24 };
// Metrics don't share row arrays, so the grid's crosshair syncs by time, not index.
const SYNC_ID = 'otel-metrics';

type MetricSource =
  | { kind: 'agent'; agentId: string; serviceKey: string }
  | { kind: 'direct'; observedServiceId: string };

interface CommonProps {
  refreshKey?: number;
  range: GlobalTimeRange;
}

interface AgentProps extends CommonProps {
  agentId: string;
  serviceKey: string;
}

interface DirectProps extends CommonProps {
  observedServiceId: string;
}

// Values are already in the display unit (metricDisplayUnit), so the tooltip,
// stats and exemplars share one plain formatter.
const formatValue = (value: number) => String(Math.round(value * 100) / 100);

function seriesLabel(attributes?: Record<string, unknown>): string {
  const entries = Object.entries(attributes ?? {});
  if (entries.length === 0) return '';
  return entries.map(([key, value]) => `${key.split('.').pop()}=${String(value)}`).join(', ');
}

/**
 * One metric's chart. In the grid it is a compact panel whose title opens it;
 * opened, it adds the distribution line, slow examples and per-series stats.
 */
function MetricChart({ source, meta, range, refreshKey, rules, expanded = false, onExpand, showTooltip, onHover }: CommonProps & {
  source: MetricSource;
  meta: OtelMetricName;
  rules: AlertRule[];
  expanded?: boolean;
  onExpand?: () => void;
  showTooltip: boolean;
  onHover?: (name: string | null) => void;
}) {
  const name = meta.metricName;
  const [points, setPoints] = useState<OtelMetricPoint[]>([]);
  // Which range the current points belong to, and when they were read. A refresh
  // keeps the chart; only the first load or a new range shows the skeleton.
  const [shown, setShown] = useState<{ range: GlobalTimeRange | null; at: number }>({ range: null, at: 0 });
  const [quantiles, setQuantiles] = useState<OtelHistogramQuantiles | null>(null);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';
  const histogram = meta.metricType === 'histogram';

  // ponytail: one points read per panel. Dozens of metrics mean dozens of reads;
  // load panels as they scroll into view, or add a batch endpoint, if that bites.
  useEffect(() => {
    // A refresh can overlap the previous read; only the newest may land.
    let cancelled = false;
    const loadPoints = async () => {
      const from = new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
      try {
        const loaded = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricPoints(agentId, serviceKey, { name, from, limit: POINT_LIMIT })
          : await api.getObservedServiceOtelMetricPoints(observedServiceId, { name, from, limit: POINT_LIMIT });
        if (!cancelled) setPoints(loaded);
      } catch {
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setShown({ range, at: Date.now() });
      }
    };
    void loadPoints();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, name, range, refreshKey]);

  // Histograms are stored as an average plus their bucket vector; the buckets
  // are what makes the tail visible, so the opened view fetches the distribution.
  useEffect(() => {
    if (!expanded || !histogram) return;
    let cancelled = false;
    const loadQuantiles = async () => {
      const from = new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
      try {
        const loaded = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricQuantiles(agentId, serviceKey, { name, from })
          : await api.getObservedServiceOtelMetricQuantiles(observedServiceId, { name, from });
        if (!cancelled) setQuantiles(loaded);
      } catch {
        if (!cancelled) setQuantiles(null);
      }
    };
    void loadQuantiles();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, name, range, refreshKey, expanded, histogram]);

  const { chartData, seriesKeys, truncatedSeries, gaps, display } = useMemo(() => {
    const display = metricDisplayUnit(meta.unit ?? '', Math.max(0, ...points.map(point => Math.abs(point.value))));
    const keys: string[] = [];
    for (const point of points) {
      const label = seriesLabel(point.attributes);
      if (!keys.includes(label)) keys.push(label);
    }
    const kept = keys.slice(0, MAX_SERIES);
    const rows = new Map<number, { t: number } & Record<string, number>>();
    for (const point of points) {
      const label = seriesLabel(point.attributes);
      if (!kept.includes(label)) continue;
      // One collection stamps its points microseconds apart — merge them per second.
      const t = Math.round(Date.parse(point.createdAt) / 1000) * 1000;
      const row = rows.get(t) ?? { t };
      row[label || 'value'] = point.value * display.factor;
      rows.set(t, row);
    }
    // Series from one export share a timestamp only roughly, so a row often
    // lacks some series — the lines connect across those (connectNulls below)
    // and a real silence is shown as a shaded band instead of a break.
    const sorted = [...rows.values()].sort((a, b) => a.t - b.t);
    const split = splitGaps(sorted);
    return {
      chartData: sorted,
      seriesKeys: kept.map(key => key || 'value'),
      truncatedSeries: keys.length - kept.length,
      gaps: split.gaps,
      display,
    };
  }, [points, meta.unit]);

  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const seriesColors = getSeriesPalette(theme);
  // Rules are written in the raw OTel unit; the chart is drawn in the display unit.
  const thresholds = rules.map(rule => ({ ...rule, threshold: Number((rule.threshold * display.factor).toPrecision(12)) }));
  const maxValue = Math.max(0, ...thresholds.map(rule => rule.threshold), ...chartData.flatMap(row => seriesKeys.map(key => row[key]).filter(Number.isFinite)));
  const { unit, factor } = display;
  const single = seriesKeys.length === 1;
  const hasData = chartData.length > 0;

  // One series: its numbers sit in the title row. Several: their names, as chips —
  // the opened view has room for a per-series stats table instead.
  const right = !hasData ? null
    : single ? <ChartSummary values={chartData.map(row => row[seriesKeys[0]])} unit={unit} valueFormatter={formatValue} />
    : expanded ? null
    : <ChartLegend items={seriesKeys.map((key, index) => ({ label: key, color: seriesColors[index % seriesColors.length] }))} />;

  return (
    <ChartCard
      title={expanded ? name : (
        <button type="button" onClick={onExpand} title="크게 보기" className="block max-w-full truncate text-left underline-offset-4 hover:text-primary hover:underline">
          {name}
        </button>
      )}
      // A metric name is an identifier, so it reads in mono like other code.
      titleClassName="font-mono text-sm"
      // A histogram is stored as each export's average, so that is what the line is.
      unit={[meta.metricType, histogram && '구간 평균', unit].filter(Boolean).join(' · ')}
      right={right}
    >
      {/* Quantiles cover the whole window and every series, so they get their own
          labelled line instead of sitting beside the averages in the title row. */}
      {expanded && quantiles && (
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-ui-border bg-ui-hover-soft px-3 py-1.5">
          <span className="type-caption text-text-muted">전체 기간 분포</span>
          <ChartStats items={[
            { label: 'p50', value: formatValue(quantiles.p50 * factor), unit },
            { label: 'p95', value: formatValue(quantiles.p95 * factor), unit },
            { label: 'p99', value: formatValue(quantiles.p99 * factor), unit },
            { label: '표본', value: quantiles.count.toLocaleString(), unit: '건' },
          ]} />
          {quantiles.exemplars && quantiles.exemplars.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="type-caption text-text-muted">느린 예시</span>
              {quantiles.exemplars.map(exemplar => (
                <Button
                  key={exemplar.traceId}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTraceId(exemplar.traceId)}
                  title={`${exemplar.traceId} 트레이스 열기`}
                >
                  <MaterialIcon name="timeline" />
                  {formatValue(exemplar.value * factor)}{unit}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.range !== range ? (
        <ChartSkeleton />
      ) : !hasData ? (
        <ChartEmpty />
      ) : (
        <>
          <div onMouseEnter={() => onHover?.(name)} onMouseLeave={() => onHover?.(null)}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
              <ComposedChart data={chartData} syncId={expanded ? undefined : SYNC_ID} syncMethod="value" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                {single && areaGradient(gradientId, seriesColors[0])}
                <CartesianGrid {...gridProps(theme)} />
                <XAxis {...timeXAxisProps(theme, [shown.at - RANGE_HOURS[range] * 3_600_000, shown.at])} />
                <YAxis {...yAxisProps(theme)} {...niceYAxis(maxValue)} tickFormatter={value => formatAxisValue(value, unit)} />
                {rangeAreas(gaps, theme.tickColor, 0.06)}
                {thresholdLines(thresholds, theme.errorColor, unit)}
                <Tooltip
                  cursor={tooltipCursor(theme)}
                  content={({ active, label, payload }) => showTooltip && (
                    <ChartTooltip
                      active={active}
                      label={label}
                      payload={payload as import('../../../components/charts').TooltipPayloadItem[]}
                      unit={unit}
                      theme={theme}
                      valueFormatter={formatValue}
                    />
                  )}
                />
                {single && <Area {...areaProps(gradientId)} connectNulls dataKey={seriesKeys[0]} />}
                {seriesKeys.map((key, index) => (
                  <Line key={key} {...lineProps(seriesColors[index % seriesColors.length], theme)} connectNulls strokeDasharray={getSeriesDash(index)} dataKey={key} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {expanded && !single && (
            <div className="mt-2">
              <ChartStatsLegend
                series={seriesKeys.map((key, index) => ({
                  label: key,
                  color: seriesColors[index % seriesColors.length],
                  values: chartData.map(row => Number(row[key])),
                }))}
                unit={unit}
                valueFormatter={formatValue}
              />
            </div>
          )}
          {truncatedSeries > 0 && <p className="mt-2 type-body text-text-muted">{`Attribute 조합이 많아 상위 ${MAX_SERIES}개 시리즈만 표시합니다. (+${truncatedSeries}개 생략)`}</p>}
          {points.length >= POINT_LIMIT && <p className="mt-2 type-body text-text-muted">{`데이터 포인트가 상한(${POINT_LIMIT.toLocaleString()}개)에 도달해 최근 구간만 표시합니다. 시간 범위를 좁히면 전체가 보입니다.`}</p>}
        </>
      )}

      {activeTraceId && <TracePanel traceId={activeTraceId} target={source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey }} onClose={() => setActiveTraceId(null)} />}
    </ChartCard>
  );
}

/**
 * Every metric at once, as a grid of panels sharing a crosshair — like a
 * Grafana dashboard. A panel's title opens that metric alone (`?metric=`), so
 * the browser's back button returns to the grid.
 */
function ServiceMetricsPanel({ source, refreshKey, range }: CommonProps & { source: MetricSource }) {
  const [names, setNames] = useState<OtelMetricName[]>([]);
  const [namesLoading, setNamesLoading] = useState(true);
  const [query, setQuery] = useState('');
  // Panels share a crosshair (syncId); only the hovered one shows its tooltip box.
  const [hovered, setHovered] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    // A refresh can overlap the previous read; only the newest may land.
    let cancelled = false;
    const loadNames = async () => {
      setNamesLoading(true);
      try {
        const loaded = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricNames(agentId, serviceKey)
          : await api.getObservedServiceOtelMetricNames(observedServiceId);
        // The API orders by last received, which reshuffles the grid on every
        // refresh. By name it stays put and prefixes (http.*, jvm.*) group.
        if (!cancelled) setNames([...loaded].sort((a, b) => a.metricName.localeCompare(b.metricName)));
      } catch {
        if (!cancelled) setNames([]);
      } finally {
        if (!cancelled) setNamesLoading(false);
      }
    };
    void loadNames();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, refreshKey]);

  // One rules read for every panel; each panel takes the rules for its metric.
  const rules = useAlertThresholds(
    source.kind === 'direct' ? { kind: 'direct', serviceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey },
    'otel_metric',
  );
  const rulesFor = (name: string) => rules.filter(rule => rule.metricName === name);

  const openMetric = (name: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.set('metric', name);
    return next;
  });
  // Replace rather than push, so the browser's back button doesn't reopen the metric.
  const closeMetric = () => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.delete('metric');
    return next;
  }, { replace: true });

  if (namesLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-80 w-full rounded-xl" />)}
      </div>
    );
  }
  if (names.length === 0) {
    return (
      <div className="rounded-xl border border-ui-border bg-bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">수신한 메트릭이 없습니다. OpenTelemetry SDK가 메트릭을 보내면 여기에 표시됩니다.</p>
      </div>
    );
  }

  const opened = names.find(item => item.metricName === params.get('metric'));
  if (opened) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={closeMetric}><MaterialIcon name="arrow_back" />전체 메트릭</Button>
        <MetricChart
          source={source}
          meta={opened}
          range={range}
          refreshKey={refreshKey}
          rules={rulesFor(opened.metricName)}
          expanded
          showTooltip
        />
      </div>
    );
  }

  const visible = names.filter(item => item.metricName.includes(query.trim()));
  return (
    <div>
      {names.length > SEARCH_MIN_METRICS && (
        <SearchInput
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="메트릭 이름으로 찾기"
          aria-label="메트릭 이름으로 찾기"
          wrapperClassName="mb-4 sm:w-72"
        />
      )}
      {visible.length === 0 ? (
        <p className="type-body text-text-muted">{`'${query.trim()}'와 일치하는 메트릭이 없습니다.`}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map(meta => (
            <MetricChart
              key={`${meta.metricName}:${meta.metricType}`}
              source={source}
              meta={meta}
              range={range}
              refreshKey={refreshKey}
              rules={rulesFor(meta.metricName)}
              onExpand={() => openMetric(meta.metricName)}
              showTooltip={hovered === meta.metricName}
              onHover={setHovered}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentServiceMetricsTab({ agentId, serviceKey, ...common }: AgentProps) {
  return <ServiceMetricsPanel {...common} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceMetricsTab({ observedServiceId, ...common }: DirectProps) {
  return <ServiceMetricsPanel {...common} source={{ kind: 'direct', observedServiceId }} />;
}
