import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Button, MaterialIcon, type GlobalTimeRange } from '../../../components/common';
import {
  CHART_HEIGHT, CHART_INITIAL_DIMENSION, ChartCard, ChartEmpty, ChartSkeleton, ChartStats, ChartStatsLegend, ChartTooltip,
  formatAxisValue, getSeriesPalette,
  getSeriesDash, gridProps, lineProps, niceYAxis, rangeAreas, splitGaps, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
} from '../../../components/charts';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import { api, type OtelHistogramQuantiles, type OtelMetricName, type OtelMetricPoint } from '../../../services/api';
import { TracePanel } from '../../traces/components/TracePanel';

const MAX_SERIES = 6;
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

function formatMetricValue(value: number, unit: string): string {
  if (unit === 'By') {
    const absolute = Math.abs(value);
    if (absolute >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)}GB`;
    if (absolute >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)}MB`;
    if (absolute >= 1024) return `${(value / 1024).toFixed(1)}KB`;
    return `${Math.round(value)}B`;
  }
  return formatAxisValue(value, unit);
}

function seriesLabel(attributes?: Record<string, unknown>): string {
  const entries = Object.entries(attributes ?? {});
  if (entries.length === 0) return '';
  return entries.map(([key, value]) => `${key.split('.').pop()}=${String(value)}`).join(', ');
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
    const loadNames = async () => {
      setNamesLoading(true);
      try {
        const list = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricNames(agentId, serviceKey)
          : await api.getObservedServiceOtelMetricNames(observedServiceId);
        setNames(list);
        setSelected(previous => list.some(item => item.metricName === previous) ? previous : (list[0]?.metricName ?? ''));
      } catch {
        setNames([]);
        setSelected('');
      } finally {
        setNamesLoading(false);
      }
    };
    void loadNames();
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
  const { chartData, seriesKeys, truncatedSeries, gaps } = useMemo(() => {
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
      row[label || 'value'] = point.value;
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
    };
  }, [points]);

  const theme = useChartTheme();
  const seriesColors = getSeriesPalette(theme);
  const thresholds = useAlertThresholds(
    source.kind === 'direct' ? { kind: 'direct', serviceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey },
    'otel_metric',
    selected,
  );
  const maxValue = Math.max(0, ...thresholds.map(rule => rule.threshold), ...chartData.flatMap(row => seriesKeys.map(key => row[key]).filter(Number.isFinite)));
  const unit = selectedMeta?.unit ?? '';

  if (namesLoading) return <div className="h-64 animate-pulse rounded-xl bg-ui-hover" />;
  if (names.length === 0) {
    return (
      <div className="rounded-xl border border-ui-border bg-bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">수신한 메트릭이 없습니다. OpenTelemetry SDK가 메트릭을 보내면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChartCard
        title={selected}
        // A metric name is an identifier, so it reads in mono like other code.
        titleClassName="font-mono text-sm"
        unit={selectedMeta ? `${selectedMeta.metricType}${unit ? ` · ${unit}` : ''}` : undefined}
        right={quantiles && (
          <ChartStats items={[
            { label: 'p50', value: formatMetricValue(quantiles.p50, unit) },
            { label: 'p95', value: formatMetricValue(quantiles.p95, unit) },
            { label: 'p99', value: formatMetricValue(quantiles.p99, unit) },
            { label: '표본', value: quantiles.count.toLocaleString(), unit: '건' },
          ]} />
        )}
      >
          {quantiles?.exemplars && quantiles.exemplars.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 type-caption">
              <span className="text-text-muted">느린 예시</span>
              {quantiles.exemplars.map(exemplar => (
                <Button
                  key={exemplar.traceId}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTraceId(exemplar.traceId)}
                  title={`${exemplar.traceId} 트레이스 열기`}
                >
                  <MaterialIcon name="timeline" />
                  {formatMetricValue(exemplar.value, unit)}
                </Button>
              ))}
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
                <CartesianGrid {...gridProps(theme)} />
                <XAxis {...timeXAxisProps(theme, [shown.at - RANGE_HOURS[range] * 3_600_000, shown.at])} />
                <YAxis {...yAxisProps(theme, 64)} {...niceYAxis(maxValue)} tickFormatter={value => formatMetricValue(value, unit)} />
                {rangeAreas(gaps, theme.tickColor, 0.06)}
                {thresholdLines(thresholds, theme.errorColor, unit === 'By' ? '' : unit)}
                <Tooltip
                  cursor={tooltipCursor(theme)}
                  content={({ active, label, payload }) => (
                    <ChartTooltip
                      active={active}
                      label={label}
                      payload={payload as import('../../../components/charts').TooltipPayloadItem[]}
                      unit={unit === 'By' ? '' : unit}
                      theme={theme}
                      valueFormatter={value => unit === 'By' ? formatMetricValue(value, unit) : String(Math.round(value * 100) / 100)}
                    />
                  )}
                />
                {seriesKeys.map((key, index) => (
                  <Line key={key} {...lineProps(seriesColors[index % seriesColors.length], theme)} connectNulls strokeDasharray={getSeriesDash(index)} dataKey={key} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-2">
              <ChartStatsLegend
                series={seriesKeys.map((key, index) => ({
                  label: key,
                  color: seriesColors[index % seriesColors.length],
                  values: chartData.map(row => Number(row[key])),
                }))}
                unit={unit === 'By' ? '' : unit}
                valueFormatter={value => unit === 'By' ? formatMetricValue(value, unit) : String(Math.round(value * 100) / 100)}
              />
            </div>
            {truncatedSeries > 0 && <p className="mt-2 type-body text-text-muted">{`Attribute 조합이 많아 상위 ${MAX_SERIES}개 시리즈만 표시합니다. (+${truncatedSeries}개 생략)`}</p>}
            {points.length >= POINT_LIMIT && <p className="mt-2 type-body text-text-muted">{`데이터 포인트가 상한(${POINT_LIMIT.toLocaleString()}개)에 도달해 최근 구간만 표시합니다. 시간 범위를 좁히면 전체가 보입니다.`}</p>}
          </>
        )}
      </ChartCard>

      {activeTraceId && <TracePanel traceId={activeTraceId} target={source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey }} onClose={() => setActiveTraceId(null)} />}

      <div className="rounded-xl border border-ui-border bg-bg-surface p-6">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="type-card-title text-text-base">전체 시리즈</h3>
          <span className="text-xs text-text-dim">행을 선택해 차트에 표시</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-ui-border-soft text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              <th className="py-1.5 pr-3 font-medium">시리즈</th>
              <th className="py-1.5 pr-3 font-medium">유형</th>
              <th className="py-1.5 pr-3 font-medium">단위</th>
              <th className="py-1.5 text-right font-medium">마지막 수신</th>
            </tr></thead>
            <tbody>
              {names.map(name => {
                const active = name.metricName === selected;
                return (
                  <tr
                    key={`${name.metricName}:${name.metricType}`}
                    tabIndex={0}
                    aria-current={active || undefined}
                    onClick={() => setSelected(name.metricName)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelected(name.metricName);
                      }
                    }}
                    className={`cursor-pointer border-b border-ui-border-soft/50 transition-colors last:border-0 ${active ? 'bg-primary/5' : 'hover:bg-ui-hover-soft'}`}
                  >
                    <td className={`py-2 pr-3 font-mono text-xs ${active ? 'font-medium text-primary' : 'text-text-secondary'}`}>{name.metricName}</td>
                    <td className="py-2 pr-3 text-xs text-text-muted">{name.metricType}</td>
                    <td className="py-2 pr-3 text-xs text-text-muted">{name.unit || '—'}</td>
                    <td className="whitespace-nowrap py-2 text-right text-xs text-text-dim">{new Date(name.lastAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AgentServiceMetricsTab({ agentId, serviceKey, ...common }: AgentProps) {
  return <ServiceMetricsPanel {...common} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceMetricsTab({ observedServiceId, ...common }: DirectProps) {
  return <ServiceMetricsPanel {...common} source={{ kind: 'direct', observedServiceId }} />;
}
