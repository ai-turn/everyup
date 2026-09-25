import { useEffect, useId, useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Button, MaterialIcon, SearchInput, type GlobalTimeRange } from '../../../components/common';
import {
  CHART_HEIGHT, CHART_INITIAL_DIMENSION, ChartCard, ChartEmpty, ChartSkeleton, ChartStats, ChartStatsLegend, ChartSummary, ChartTooltip,
  areaGradient, areaProps, formatAxisValue, formatTimeTick, getSeriesPalette, metricDisplayUnit,
  getSeriesDash, gridProps, lineProps, niceYAxis, rangeAreas, splitGaps, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
} from '../../../components/charts';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import { api, type OtelHistogramQuantiles, type OtelMetricName, type OtelMetricPoint } from '../../../services/api';
import { TracePanel } from '../../traces/components/TracePanel';

const MAX_SERIES = 6;
// Below this the whole list fits at a glance and a search box is noise.
const SEARCH_MIN_METRICS = 8;
// The server caps a point read at 5000 and applies the cap before grouping by
// attribute series, so a metric with many series silently returns a shorter
// window than asked for. Asking explicitly lets us say so instead.
const POINT_LIMIT = 5000;
const RANGE_HOURS: Record<GlobalTimeRange, number> = { '1h': 1, '6h': 6, '24h': 24 };

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

// The picker sits beside the chart it drives — below it, a pick changed a chart
// scrolled out of view.
function MetricPicker({ names, selected, onSelect }: { names: OtelMetricName[]; selected: string; onSelect: (name: string) => void }) {
  const [query, setQuery] = useState('');
  const visibleNames = names.filter(item => item.metricName.includes(query.trim()));
  return (
    <aside className="rounded-xl border border-ui-border bg-bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="type-card-title text-text-base">메트릭</h3>
        <span className="type-caption text-text-dim">{names.length}</span>
      </div>
      {names.length > SEARCH_MIN_METRICS && (
        <SearchInput
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="이름으로 찾기"
          aria-label="메트릭 이름으로 찾기"
          wrapperClassName="mb-2"
        />
      )}
      <div role="group" aria-label="메트릭" className="max-h-64 space-y-0.5 overflow-y-auto lg:max-h-[32rem]">
        {visibleNames.map(name => {
          const active = name.metricName === selected;
          return (
            <button
              key={`${name.metricName}:${name.metricType}`}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(name.metricName)}
              className={`block w-full rounded-md px-2.5 py-2 text-left transition-colors ${active ? 'bg-primary/5' : 'hover:bg-ui-hover-soft'}`}
            >
              <span className={`block break-all font-mono text-xs ${active ? 'font-medium text-primary' : 'text-text-secondary'}`}>{name.metricName}</span>
              <span className="mt-0.5 flex justify-between gap-2 type-caption text-text-dim">
                <span>{name.metricType}</span>
                <span>{formatTimeTick(Date.parse(name.lastAt))}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ServiceMetricsPanel({ source, refreshKey, range }: CommonProps & { source: MetricSource }) {
  const [names, setNames] = useState<OtelMetricName[]>([]);
  const [namesLoading, setNamesLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [points, setPoints] = useState<OtelMetricPoint[]>([]);
  // Which metric/range the current points belong to, and when they were read.
  // A refresh of the same view keeps the chart; only a different view shows the skeleton.
  const [shown, setShown] = useState({ view: '', at: 0 });
  const [pointsLoading, setPointsLoading] = useState(false);
  const [quantiles, setQuantiles] = useState<OtelHistogramQuantiles | null>(null);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

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
        if (cancelled) return;
        // The API orders by last received, which reshuffles the list on every
        // refresh. By name it stays put and prefixes (http.*, jvm.*) group.
        const list = [...loaded].sort((a, b) => a.metricName.localeCompare(b.metricName));
        setNames(list);
        setSelected(previous => list.some(item => item.metricName === previous) ? previous : (list[0]?.metricName ?? ''));
      } catch {
        if (cancelled) return;
        setNames([]);
        setSelected('');
      } finally {
        if (!cancelled) setNamesLoading(false);
      }
    };
    void loadNames();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    // Switching metrics starts a second read while the first is in flight; a
    // late response for the old metric must not land on the new one.
    let cancelled = false;
    const loadPoints = async () => {
      setPointsLoading(true);
      const from = new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
      try {
        const loaded = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricPoints(agentId, serviceKey, { name: selected, from, limit: POINT_LIMIT })
          : await api.getObservedServiceOtelMetricPoints(observedServiceId, { name: selected, from, limit: POINT_LIMIT });
        if (!cancelled) setPoints(loaded);
      } catch {
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setShown({ view: `${selected}|${range}`, at: Date.now() });
        // Guarded on purpose: a cancelled read clearing the flag would hide the
        // skeleton while its replacement is still in flight. The replacement
        // owns the flag, and `selected` is only empty when no metric exists at
        // all, where the empty state renders instead of the chart.
        if (!cancelled) setPointsLoading(false);
      }
    };
    void loadPoints();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, selected, range, refreshKey]);

  // Histograms are stored as an average plus their bucket vector; the buckets
  // are what makes the tail visible, so fetch the recovered distribution.
  useEffect(() => {
    const meta = names.find(item => item.metricName === selected);
    if (!selected || meta?.metricType !== 'histogram') {
      setQuantiles(null);
      return;
    }
    let cancelled = false;
    const loadQuantiles = async () => {
      const from = new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
      try {
        const loaded = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricQuantiles(agentId, serviceKey, { name: selected, from })
          : await api.getObservedServiceOtelMetricQuantiles(observedServiceId, { name: selected, from });
        if (!cancelled) setQuantiles(loaded);
      } catch {
        if (!cancelled) setQuantiles(null);
      }
    };
    void loadQuantiles();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, selected, range, refreshKey, names]);

  const selectedMeta = names.find(item => item.metricName === selected);
  const rawUnit = selectedMeta?.unit ?? '';
  const { chartData, seriesKeys, truncatedSeries, gaps, display } = useMemo(() => {
    const display = metricDisplayUnit(rawUnit, Math.max(0, ...points.map(point => Math.abs(point.value))));
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
  }, [points, rawUnit]);

  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const seriesColors = getSeriesPalette(theme);
  const rules = useAlertThresholds(
    source.kind === 'direct' ? { kind: 'direct', serviceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey },
    'otel_metric',
    selected,
  );
  // Rules are written in the raw OTel unit; the chart is drawn in the display unit.
  const thresholds = rules.map(rule => ({ ...rule, threshold: Number((rule.threshold * display.factor).toPrecision(12)) }));
  const maxValue = Math.max(0, ...thresholds.map(rule => rule.threshold), ...chartData.flatMap(row => seriesKeys.map(key => row[key]).filter(Number.isFinite)));
  const { unit, factor } = display;
  const single = seriesKeys.length === 1;

  if (namesLoading) return <div className="h-64 animate-pulse rounded-xl bg-ui-hover" />;
  if (names.length === 0) {
    return (
      <div className="rounded-xl border border-ui-border bg-bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">수신한 메트릭이 없습니다. OpenTelemetry SDK가 메트릭을 보내면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <MetricPicker names={names} selected={selected} onSelect={setSelected} />

      <ChartCard
        title={selected}
        // A metric name is an identifier, so it reads in mono like other code.
        titleClassName="font-mono text-sm"
        // A histogram is stored as each export's average, so that is what the line is.
        unit={selectedMeta ? [selectedMeta.metricType, selectedMeta.metricType === 'histogram' && '구간 평균', unit].filter(Boolean).join(' · ') : undefined}
        right={single && <ChartSummary values={chartData.map(row => row[seriesKeys[0]])} unit={unit} valueFormatter={formatValue} />}
      >
        {/* Quantiles cover the whole window and every series, so they get their own
            labelled line instead of sitting beside the averages in the title row. */}
        {quantiles && (
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

        {pointsLoading && shown.view !== `${selected}|${range}` ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <ChartEmpty />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} initialDimension={CHART_INITIAL_DIMENSION}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                {single && areaGradient(gradientId, seriesColors[0])}
                <CartesianGrid {...gridProps(theme)} />
                <XAxis {...timeXAxisProps(theme, [shown.at - RANGE_HOURS[range] * 3_600_000, shown.at])} />
                <YAxis {...yAxisProps(theme)} {...niceYAxis(maxValue)} tickFormatter={value => formatAxisValue(value, unit)} />
                {rangeAreas(gaps, theme.tickColor, 0.06)}
                {thresholdLines(thresholds, theme.errorColor, unit)}
                <Tooltip
                  cursor={tooltipCursor(theme)}
                  content={({ active, label, payload }) => (
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
            {/* One series: the title row already carries its summary (ChartSummary). */}
            {!single && (
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
      </ChartCard>

      {activeTraceId && <TracePanel traceId={activeTraceId} target={source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey }} onClose={() => setActiveTraceId(null)} />}
    </div>
  );
}

export function AgentServiceMetricsTab({ agentId, serviceKey, ...common }: AgentProps) {
  return <ServiceMetricsPanel {...common} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceMetricsTab({ observedServiceId, ...common }: DirectProps) {
  return <ServiceMetricsPanel {...common} source={{ kind: 'direct', observedServiceId }} />;
}
