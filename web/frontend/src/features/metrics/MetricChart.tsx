import { useId, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button, MaterialIcon } from '../../components/common';
import { Tooltip as HintTooltip } from '../../components/common/Tooltip';
import {
  CHART_HEIGHT, CHART_MARGIN, CHART_INITIAL_DIMENSION, ChartCard, ChartEmpty, ChartLegend, ChartSkeleton, ChartStats, ChartStatsLegend, ChartSummary, ChartTooltip,
  areaGradient, areaProps, formatAxisValue, formatTimeLabel, getSeriesPalette,
  getSeriesDash, gridProps, lineProps, niceYAxis, rangeAreas, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
} from '../../components/charts';
import type { AlertRule, OtelMetricName, OtelMetricPoint } from '../../services/api';
import { TracePanel } from '../traces/components/TracePanel';
import { buildMetricSeries, MAX_METRIC_SERIES } from './metricSeries';
import { useMetricQuery, type MetricWindow } from './useMetricQuery';
import { useMetricRead, type MetricSource } from './useMetricRead';
import { MetricExplorerControls } from './MetricExplorerControls';
export type { MetricSource } from './useMetricRead';

const NO_POINTS: OtelMetricPoint[] = [];
const SYNC_ID = 'otel-metrics';
const formatValue = (value: number) => String(value !== 0 && Math.abs(value) < 0.01 ? Number(value.toPrecision(2)) : Math.round(value * 100) / 100);

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
  const query = useMetricQuery();
  const mode = expanded && meta.metricType === 'sum' ? query.mode : 'raw';
  const attributes = expanded ? query.attributes : '';
  const selected = expanded ? query.series : '';
  const read = useMetricRead(source, meta, window, attributes, selected, expanded, refreshKey);
  const points = read.data?.points ?? NO_POINTS;
  const { error: pointsError, quantiles, quantilesError, quantilesLoading, displayedWindow } = read;
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const histogram = meta.metricType === 'histogram';
  const { chartData, series, truncatedSeries, gaps, display, skippedRatePoints } = useMemo(() => buildMetricSeries(points, meta.unit, mode), [points, meta.unit, mode]);

  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const seriesColors = getSeriesPalette(theme);
  // Rules are written in the raw OTel unit; the chart is drawn in the display unit.
  const thresholds = (mode === 'rate' ? [] : rules).map(rule => ({ ...rule, threshold: Number((rule.threshold * display.factor).toPrecision(12)) }));
  const maxValue = Math.max(0, ...thresholds.map(rule => rule.threshold), ...chartData.flatMap(row => series.map(item => row[item.key]).filter(Number.isFinite)));
  const { unit, factor } = display;
  const single = series.length === 1;
  const hasData = chartData.some(row => series.some(item => Number.isFinite(row[item.key])));

  // One series: its numbers sit in the title row. Several: their names, as chips —
  // the opened view has room for a per-series stats table instead.
  const right = !hasData || pointsError || !read.data ? null
    : single ? <ChartSummary values={chartData.map(row => row[series[0].key])} unit={unit} currentLabel={mode === 'rate' ? '최근 계산값' : undefined} valueFormatter={formatValue} />
    : expanded ? null
    : <ChartLegend items={series.map((item, index) => ({ label: item.label, color: seriesColors[index % seriesColors.length] }))} />;

  return (
    <div className="min-w-0 space-y-3">
      {expanded && <MetricExplorerControls data={read.options} pending={read.pending} sum={meta.metricType === 'sum'} />}
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
        unit={[meta.metricType, histogram && '수신 평균', mode === 'rate' && '초당 증가량', unit].filter(Boolean).join(', ')}
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
        {read.pending && read.data && <p role="status" className="mb-3 type-body text-text-muted">메트릭을 새로고침하고 있습니다…</p>}
        {quantiles?.truncated && <p role="status" className="mb-3 type-body text-text-muted">분포 조회가 50,000개 포인트를 초과했습니다. 기간이나 Attribute 필터를 좁혀 주세요.</p>}
        {expanded && histogram && !pointsError && read.data !== null && (quantilesLoading || quantilesError) && (
          <div role={quantilesError ? 'alert' : 'status'} className="mb-4 flex flex-wrap items-center gap-3">
            <p className="type-body text-text-muted">{quantilesError ? '선택한 시리즈의 기간 분포를 불러오지 못했습니다' : '선택한 시리즈의 기간 분포를 확인하고 있습니다…'}</p>
            {quantilesError && <Button variant="secondary" size="sm" onClick={read.retry}>분포 다시 시도</Button>}
          </div>
        )}
        {expanded && !pointsError && read.data !== null && quantiles && !quantiles.truncated && (
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-ui-border bg-ui-hover-soft px-3 py-1.5">
            <span className="type-caption text-text-muted">선택한 시리즈의 기간 분포</span>
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
            <Button variant="secondary" size="sm" onClick={read.retry}>다시 시도</Button>
          </div>
        ) : !read.data ? (
          <ChartSkeleton />
        ) : !hasData ? (
          mode === 'rate' && points.length > 0 ? <div className="flex items-center justify-center text-center type-body text-text-muted" style={{ height: CHART_HEIGHT }}>초당 증가량을 계산할 수 없습니다. 단조 증가하는 sum의 누적 시작 정보와 연속된 포인트가 필요합니다.</div> : <ChartEmpty />
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
                  {single && <Area {...areaProps(gradientId)} connectNulls={mode !== 'rate'} dataKey={series[0].key} />}
                  {series.map((item, index) => (
                    <Line key={item.key} {...lineProps(seriesColors[index % seriesColors.length], theme)} connectNulls={mode !== 'rate'} strokeDasharray={getSeriesDash(index)} dataKey={item.key} name={item.label} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {expanded && !single && (
              <div className="mt-2 overflow-x-auto">
                <ChartStatsLegend
                  currentLabel={mode === 'rate' ? '최근 계산값' : undefined}
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
          </>
        )}

        {skippedRatePoints > 0 && hasData && <p className="mt-3 type-body text-text-muted">{`시작 정보 누락·재시작·겹친 구간 등 ${skippedRatePoints}개 포인트는 증가량을 계산하지 않았습니다.`}</p>}
        {read.data?.pointsTruncated && <p role="status" className="mt-3 type-body text-text-muted">{`선택한 시리즈의 최근 ${read.data.pointLimit.toLocaleString()}개 포인트만 표시합니다. 기간이나 Attribute 필터를 좁혀 주세요.${histogram ? ' 분포는 선택한 시리즈의 전체 조회 기간을 기준으로 합니다.' : ''}`}</p>}
        {!expanded && read.data && (read.data.series.length > MAX_METRIC_SERIES || read.data.seriesTruncated) && <Button variant="ghost" size="sm" onClick={onExpand}>시리즈 선택하기 ({read.data.series.length}{read.data.seriesTruncated ? '+' : ''}개)</Button>}
        {expanded && selected === '[]' && <p className="mt-3 type-body text-text-muted">선택한 시리즈가 없습니다. 시리즈를 선택하거나 기본 선택으로 돌아가세요.</p>}
        {activeTraceId && <TracePanel traceId={activeTraceId} target={source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey }} onClose={() => setActiveTraceId(null)} />}
      </ChartCard>
    </div>
  );
}
