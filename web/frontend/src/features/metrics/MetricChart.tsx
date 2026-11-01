import { useEffect, useId, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button, MaterialIcon } from '../../components/common';
import { Tooltip as HintTooltip } from '../../components/common/Tooltip';
import {
  CHART_HEIGHT, CHART_MARGIN, CHART_INITIAL_DIMENSION, ChartCard, ChartEmpty, ChartLegend, ChartSkeleton, ChartStats, ChartStatsLegend, ChartSummary, ChartTooltip,
  areaGradient, areaProps, formatAxisValue, formatTimeLabel, getSeriesPalette,
  getSeriesDash, gridProps, lineProps, niceYAxis, rangeAreas, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
} from '../../components/charts';
import { api, type AlertRule, type OtelHistogramQuantiles, type OtelMetricName, type OtelMetricPoint } from '../../services/api';
import { TracePanel } from '../traces/components/TracePanel';
import { getErrorMessage } from '../../utils/errors';
import { buildMetricSeries, MAX_METRIC_SERIES } from './metricSeries';
import type { MetricWindow } from './useMetricQuery';

export type MetricSource =
  | { kind: 'agent'; agentId: string; serviceKey: string }
  | { kind: 'direct'; observedServiceId: string };

const POINT_LIMIT = 5000;
const SYNC_ID = 'otel-metrics';
const formatValue = (value: number) => String(Math.round(value * 100) / 100);

export function MetricChart({ source, meta, window, refreshKey, rules, expanded = false, onExpand, showTooltip, onHover }: {
  window: MetricWindow;
  refreshKey?: number;
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
  const [shownWindow, setShownWindow] = useState<MetricWindow | null>(null);
  const [quantiles, setQuantiles] = useState<OtelHistogramQuantiles | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [quantilesError, setQuantilesError] = useState<string | null>(null);
  const [quantilesLoading, setQuantilesLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
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
      setPointsError(null);

      try {
        const loaded = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricPoints(agentId, serviceKey, { name, from: window.from, to: window.to, limit: POINT_LIMIT })
          : await api.getObservedServiceOtelMetricPoints(observedServiceId, { name, from: window.from, to: window.to, limit: POINT_LIMIT });
        if (!cancelled) {
          setPoints(loaded);
          setShownWindow(window);
        }
      } catch (error) {
        if (!cancelled) setPointsError(getErrorMessage(error));
      }
    };
    void loadPoints();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, name, window, refreshKey, retryKey]);

  // Histograms are stored as an average plus their bucket vector; the buckets
  // are what makes the tail visible, so the opened view fetches the distribution.
  useEffect(() => {
    if (!expanded || !histogram) return;
    let cancelled = false;
    const loadQuantiles = async () => {
      setQuantiles(null);
      setQuantilesError(null);
      setQuantilesLoading(true);

      try {
        const loaded = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricQuantiles(agentId, serviceKey, { name, from: window.from, to: window.to })
          : await api.getObservedServiceOtelMetricQuantiles(observedServiceId, { name, from: window.from, to: window.to });
        if (!cancelled) setQuantiles(loaded);
      } catch (error) {
        if (!cancelled) setQuantilesError(getErrorMessage(error));
      } finally {
        if (!cancelled) setQuantilesLoading(false);
      }
    };
    void loadQuantiles();
    return () => { cancelled = true; };
  }, [source.kind, agentId, serviceKey, observedServiceId, name, window, refreshKey, expanded, histogram, retryKey]);

  const { chartData, series, truncatedSeries, gaps, display } = useMemo(() => buildMetricSeries(points, meta.unit), [points, meta.unit]);
  const displayedWindow = shownWindow?.range === window.range ? shownWindow : window;

  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const seriesColors = getSeriesPalette(theme);
  // Rules are written in the raw OTel unit; the chart is drawn in the display unit.
  const thresholds = rules.map(rule => ({ ...rule, threshold: Number((rule.threshold * display.factor).toPrecision(12)) }));
  const maxValue = Math.max(0, ...thresholds.map(rule => rule.threshold), ...chartData.flatMap(row => series.map(item => row[item.key]).filter(Number.isFinite)));
  const { unit, factor } = display;
  const single = series.length === 1;
  const hasData = chartData.length > 0;

  // One series: its numbers sit in the title row. Several: their names, as chips —
  // the opened view has room for a per-series stats table instead.
  const right = !hasData || pointsError || shownWindow?.range !== window.range ? null
    : single ? <ChartSummary values={chartData.map(row => row[series[0].key])} unit={unit} valueFormatter={formatValue} />
    : expanded ? null
    : <ChartLegend items={series.map((item, index) => ({ label: item.label, color: seriesColors[index % seriesColors.length] }))} />;

  return (
    <ChartCard
      title={expanded ? name : (
        <HintTooltip content="크게 보기"><button type="button" onClick={onExpand} className="block max-w-full truncate text-left underline-offset-4 hover:text-action hover:underline">
          {name}
        </button></HintTooltip>
      )}
      // A metric name is an identifier, so it reads in mono like other code.
      titleClassName="font-mono text-sm"
      wrapTitle={expanded}
      className="min-w-0"
      // A histogram is stored as each export's average, so that is what the line is.
      unit={[meta.metricType, histogram && '구간 평균', unit].filter(Boolean).join(', ')}
      right={right}
    >
      {expanded && <dl aria-label="메트릭 정보" className="mb-3 flex flex-wrap gap-x-5 gap-y-2 type-caption text-text-muted">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <dt>마지막 수신</dt>
          <dd><time dateTime={meta.lastAt}>{new Date(meta.lastAt).toLocaleString('ko-KR', { hour12: false })}</time></dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-1.5">
          <dt>조회 구간</dt>
          <dd>{formatTimeLabel(Date.parse(displayedWindow.from))} ~ {formatTimeLabel(Date.parse(displayedWindow.to))}</dd>
        </div>
      </dl>}
      {/* Quantiles cover the whole window and every series, so they get their own
          labelled line instead of sitting beside the averages in the title row. */}
      {expanded && histogram && !pointsError && shownWindow === window && (quantilesLoading || quantilesError) && (
        <div role={quantilesError ? 'alert' : 'status'} className="mb-4 flex flex-wrap items-center gap-3">
          <p className="type-body text-text-muted">{quantilesError ? '전체 기간 분포를 불러오지 못했습니다' : '전체 기간 분포를 확인하고 있습니다…'}</p>
          {quantilesError && <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>분포 다시 시도</Button>}
        </div>
      )}
      {expanded && !pointsError && shownWindow === window && quantiles && (
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

      {pointsError ? (
        <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-lg bg-ui-hover-soft px-4 text-center" style={{ height: CHART_HEIGHT }}>
          <p className="type-label text-text-base">메트릭을 불러오지 못했습니다</p>
          <p className="type-body text-text-muted">{pointsError}</p>
          <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>다시 시도</Button>
        </div>
      ) : shownWindow?.range !== window.range ? (
        <ChartSkeleton />
      ) : !hasData ? (
        <ChartEmpty />
      ) : (
        <>
          <div onMouseEnter={() => onHover?.(name)} onMouseLeave={() => onHover?.(null)}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
              <ComposedChart data={chartData} syncId={expanded ? undefined : SYNC_ID} syncMethod="value" margin={CHART_MARGIN}>
                {single && areaGradient(gradientId, seriesColors[0])}
                <CartesianGrid {...gridProps(theme)} />
                <XAxis {...timeXAxisProps(theme, [Date.parse(displayedWindow.from), Date.parse(displayedWindow.to)])} />
                <YAxis {...yAxisProps(theme)} {...niceYAxis(maxValue)} tickFormatter={value => formatAxisValue(value, unit)} />
                {rangeAreas(gaps, theme.tickColor, 0.06)}
                {thresholdLines(thresholds, theme.errorColor, unit)}
                <Tooltip
                  cursor={tooltipCursor(theme)}
                  content={({ active, label, payload }) => showTooltip && (
                    <ChartTooltip
                      active={active}
                      label={label}
                      payload={payload as import('../../components/charts').TooltipPayloadItem[]}
                      unit={unit}
                      theme={theme}
                      valueFormatter={formatValue}
                    />
                  )}
                />
                {single && <Area {...areaProps(gradientId)} connectNulls dataKey={series[0].key} />}
                {series.map((item, index) => (
                  <Line key={item.key} {...lineProps(seriesColors[index % seriesColors.length], theme)} connectNulls strokeDasharray={getSeriesDash(index)} dataKey={item.key} name={item.label} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {expanded && !single && (
            <div className="mt-2 overflow-x-auto">
              <ChartStatsLegend
                series={series.map((item, index) => ({
                  label: item.label,
                  color: seriesColors[index % seriesColors.length],
                  values: chartData.map(row => Number(row[item.key])),
                }))}
                unit={unit}
                valueFormatter={formatValue}
              />
            </div>
          )}
          {truncatedSeries > 0 && <p className="mt-2 type-body text-text-muted">{`Attribute 조합이 많아 ${MAX_METRIC_SERIES}개 시리즈만 표시합니다. (+${truncatedSeries}개 생략)`}</p>}
          {points.length >= POINT_LIMIT && <p className="mt-2 type-body text-text-muted">{`데이터 포인트가 상한(${POINT_LIMIT.toLocaleString()}개)에 도달해 최근 구간만 표시합니다. 시간 범위를 좁히면 전체가 보입니다.`}</p>}
        </>
      )}

      {activeTraceId && <TracePanel traceId={activeTraceId} target={source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey }} onClose={() => setActiveTraceId(null)} />}
    </ChartCard>
  );
}
