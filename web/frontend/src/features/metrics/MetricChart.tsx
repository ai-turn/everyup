import { useId, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Button, MaterialIcon, StatusLight } from '../../components/common';
import { Tooltip as HintTooltip } from '../../components/common/Tooltip';
import {
  CHART_HEIGHT, CHART_MARGIN, CHART_INITIAL_DIMENSION, ChartCard, ChartEmpty, ChartLegend, ChartSkeleton, ChartStats, ChartStatsLegend, ChartSummary, ChartTooltip,
  areaGradient, areaProps, formatAxisValue, formatTimeLabel, getSeriesPalette,
  getSeriesDash, gridProps, lineProps, niceYAxis, rangeAreas, thresholdLines, timeXAxisProps, tooltipCursor, useChartKeyboard, useChartTheme, yAxisProps,
} from '../../components/charts';
import type { AlertRule, OtelMetricName, OtelMetricPoint } from '../../services/api';
import { TracePanel } from '../traces/components/TracePanel';
import { buildMetricSeries, MAX_METRIC_SERIES, pointIdentity } from './metricSeries';
import { useMetricQuery, type MetricWindow } from './useMetricQuery';
import { useMetricRead, type MetricSource } from './useMetricRead';
import { metricFlags, metricIdentity, metricTitle } from './metricPresentation';
import { MetricExplorerControls } from './MetricExplorerControls';
export type { MetricSource } from './useMetricRead';

const NO_POINTS: OtelMetricPoint[] = [];
const SYNC_ID = 'otel-metrics';
const formatValue = (value: number) => String(value !== 0 && Math.abs(value) < 0.01 ? Number(value.toPrecision(2)) : Math.round(value * 100) / 100);

const hasFinite = (chartData: Record<string, number>[], series: { key: string }[]) => chartData.some(row => series.some(item => Number.isFinite(row[item.key])));
const lastFinite = (chartData: Record<string, number>[], key: string) => chartData.map(row => row[key]).filter(Number.isFinite).pop();

export function MetricChart({ source, meta, window, refreshKey, rules, expanded = false, onExpand, showTooltip, onHover, pinned, onPin, pinDisabled }: {
  window: MetricWindow;
  refreshKey?: number;
  source: MetricSource;
  meta: OtelMetricName;
  rules: AlertRule[];
  expanded?: boolean;
  onExpand?: () => void;
  pinned?: boolean;
  onPin?: () => void;
  pinDisabled?: boolean;
  showTooltip: boolean;
  onHover?: (name: string | null) => void;
}) {
  const name = meta.metricName;
  const query = useMetricQuery();
  // A cumulative counter only ever climbs, so sums open as a rate unless the URL picked raw.
  const autoMode = !expanded || query.mode === null;
  const preferredMode = meta.metricType !== 'sum' ? 'raw' : expanded ? query.mode ?? 'rate' : 'rate';
  const attributes = expanded ? query.attributes : '';
  const selected = expanded ? query.series : '';
  const read = useMetricRead(source, meta, window, attributes, selected, expanded, refreshKey);
  const points = read.data?.points ?? NO_POINTS;
  const { error: pointsError, quantiles, quantilesError, quantilesLoading, displayedWindow } = read;
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const histogram = meta.metricType === 'histogram';
  // Sums with no computable rate (UpDownCounter, rows without a start time) fall back
  // to raw, unless the user asked for the rate explicitly.
  const { chartData, series, truncatedSeries, gaps, display, skippedRatePoints, mode } = useMemo(() => {
    const built = buildMetricSeries(points, meta.unit, preferredMode);
    return autoMode && preferredMode === 'rate' && points.length > 0 && !hasFinite(built.chartData, built.series)
      ? { ...buildMetricSeries(points, meta.unit, 'raw'), mode: 'raw' as const }
      : { ...built, mode: preferredMode };
  }, [points, meta.unit, preferredMode, autoMode]);

  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const seriesColors = getSeriesPalette(theme);
  // Rules are written in the raw OTel unit; the chart is drawn in the display unit.
  const thresholds = (mode === 'rate' ? [] : rules).map(rule => ({ ...rule, threshold: Number((rule.threshold * display.factor).toPrecision(12)) }));
  const maxValue = Math.max(0, ...thresholds.map(rule => rule.threshold), ...chartData.flatMap(row => series.map(item => row[item.key]).filter(Number.isFinite)));
  const { unit, factor } = display;
  const single = series.length === 1;
  const hasData = hasFinite(chartData, series);
  const title = metricTitle(meta);
  const nameId = useId();
  // 격자 패널은 크로스헤어를 공유하지만 툴팁은 마우스가 있는 패널에만 뜬다 — 키보드로 고른 값은 이 패널 아래 줄로 읽는다.
  const kbd = useChartKeyboard(chartData.length);
  const kbdRow = kbd.index === null ? undefined : chartData[kbd.index];

  // The line may be a rate but rules are raw, so a breach is judged on each series' latest raw point.
  const latest = new Map<string, OtelMetricPoint>();
  for (const point of points) {
    const id = pointIdentity(point);
    const previous = latest.get(id);
    if (!previous || Date.parse(point.createdAt) >= Date.parse(previous.createdAt)) latest.set(id, point);
  }
  const flags = metricFlags(meta);
  const summary = !hasData || pointsError || !read.data ? null
    : single ? <ChartSummary values={chartData.map(row => row[series[0].key])} unit={unit} currentLabel={mode === 'rate' ? '최근 계산값' : undefined} valueFormatter={formatValue} />
    : <span className="type-caption text-text-muted">{series.length}개 시리즈 · 최신 값은 범례에서 확인</span>;
  const legend = !single && hasData && <ChartLegend items={series.map((item, index) => {
    const value = lastFinite(chartData, item.key);
    return { label: item.label, color: seriesColors[index % seriesColors.length], value: value === undefined ? undefined : `${formatValue(value)}${unit}` };
  })} />;

  return (
    <div className="min-w-0 space-y-3">
      <ChartCard
        // 격자와 단독 보기 모두 표시 이름이 제목이고 원본 이름은 아래 줄이다 — 패널을 눌러도 제목이 바뀌지 않는다.
        title={expanded ? title : (
          <HintTooltip content="크게 보기"><button type="button" onClick={onExpand} aria-describedby={nameId} className="block h-11 max-w-full truncate text-left underline-offset-4 hover:text-action hover:underline sm:h-10">
            {title}
          </button></HintTooltip>
        )}
        // A metric name is an identifier, so it reads in mono like other code.
        titleClassName={title === name ? "font-mono text-sm" : undefined}
        wrapTitle={expanded}
        className="min-w-0"
        // 격자를 훑을 때 어느 패널이 확인 필요인지 보이게 상태를 제목 줄에 둔다(단독 보기는 아래 줄).
        right={<div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {!expanded && flags.map(flag => <StatusLight key={flag.label} {...flag} />)}
          <Button variant={pinned ? 'secondary' : 'ghost'} size="sm" aria-label={`${title} ${pinned ? '고정 해제' : '고정'}`} aria-pressed={pinned} disabled={pinDisabled} onClick={onPin}><MaterialIcon name="push_pin" /></Button>
        </div>}
      >
        {expanded && title !== name && <p className="-mt-2 mb-3 break-all font-mono text-xs text-text-muted">{name}</p>}
        {expanded && <MetricExplorerControls data={read.options} pending={read.pending} sum={meta.metricType === 'sum'} mode={mode} />}
        <div className="mb-3 space-y-2">
          {/* 원본 이름은 이미 보이는 글자라 따로 Tab 지점을 두지 않는다. 격자는 잘리므로 마우스 힌트만 남긴다. */}
          {/* 격자는 원본 이름과 종류·단위를 왼쪽 두 줄로 묶고 요약을 같은 행에 둔다 — 세 줄이 따로 쌓여 차트가 밀렸다. */}
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              {!expanded && <p id={nameId} className="truncate font-mono text-xs text-text-muted"><HintTooltip content={name}><span>{name}</span></HintTooltip></p>}
              <p className="type-caption text-text-muted">{[meta.metricType, histogram && '수신 평균', mode === 'rate' && '초당 증가량', unit].filter(Boolean).join(', ')}</p>
            </div>
            {summary}
          </div>
          {expanded && meta.description && <p className="type-body text-text-muted">{meta.description}</p>}
          {expanded && flags.length > 0 && <div className="flex flex-wrap gap-3">{flags.map(flag => <StatusLight key={flag.label} {...flag} />)}</div>}
        </div>
        {expanded && <dl aria-label="메트릭 정보" className="mb-3 flex flex-wrap gap-x-5 gap-y-2 type-caption text-text-muted">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <dt>마지막 측정</dt>
            <dd><time dateTime={meta.lastAt}>{new Date(meta.lastAt).toLocaleString('ko-KR', { hour12: false })}</time></dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <dt>마지막 수신</dt><dd>{meta.lastReceivedAt ? <time dateTime={meta.lastReceivedAt}>{new Date(meta.lastReceivedAt).toLocaleString('ko-KR', { hour12: false })}</time> : '기록 없음'}</dd>
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
            <div
              tabIndex={0}
              role="group"
              aria-label={`${title} 추이. 좌우 방향키로 시점별 값을 읽습니다.`}
              className="rounded-lg"
              onKeyDown={kbd.onKeyDown}
              onBlur={kbd.onBlur}
              onMouseEnter={() => onHover?.(metricIdentity(meta))}
              onMouseLeave={() => onHover?.(null)}
            >
              <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
                <ComposedChart data={chartData} syncId={expanded ? undefined : SYNC_ID} syncMethod="value" margin={CHART_MARGIN} accessibilityLayer={false}>
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
                  {kbdRow && <ReferenceLine x={kbdRow.t} stroke={theme.tickColor} strokeDasharray="3 3" />}
                </ComposedChart>
              </ResponsiveContainer>
              {/* 마우스 사용자에게 빈 줄을 남기지 않게, 고르기 전에는 화면에서만 숨긴다(라이브 영역은 유지). */}
              <p aria-live="polite" className={kbdRow ? 'mt-2 px-2 pb-1 type-caption text-text-muted' : 'sr-only'}>
                {kbdRow && `${formatTimeLabel(kbdRow.t)} · ${series.map(item => `${single ? title : item.label} ${Number.isFinite(kbdRow[item.key]) ? `${formatValue(kbdRow[item.key])}${unit}` : '-'}`).join(' · ')}`}
              </p>
            </div>
            {/* 시리즈는 최대 6개라 범례를 줄바꿈으로 모두 보인다(높이를 제한하면 키보드로 스크롤할 수 없다). */}
            {!expanded && legend && <div className="mt-3">{legend}</div>}
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

        {/* A cumulative stream's first point never has a rate; only skips beyond that are worth a note. */}
        {expanded && skippedRatePoints > latest.size && hasData && <p className="mt-3 type-body text-text-muted">{`시작 정보 누락·재시작·겹친 구간 등 ${skippedRatePoints}개 포인트는 증가량을 계산하지 않았습니다.`}</p>}
        {read.data?.pointsTruncated && <p role="status" className="mt-3 type-body text-text-muted">{`선택한 시리즈의 최근 ${read.data.pointLimit.toLocaleString()}개 포인트만 표시합니다. 기간이나 Attribute 필터를 좁혀 주세요.${histogram ? ' 분포는 선택한 시리즈의 전체 조회 기간을 기준으로 합니다.' : ''}`}</p>}
        {!expanded && read.data && (read.data.series.length > MAX_METRIC_SERIES || read.data.seriesTruncated) && <Button variant="ghost" size="sm" onClick={onExpand}>시리즈 선택하기 ({read.data.series.length}{read.data.seriesTruncated ? '+' : ''}개)</Button>}
        {expanded && selected === '[]' && <p className="mt-3 type-body text-text-muted">선택한 시리즈가 없습니다. 시리즈를 선택하거나 기본 선택으로 돌아가세요.</p>}
        {expanded && points.length > 0 && <details className="mt-4 border-t border-ui-border-soft pt-3">
          <summary className="min-h-11 cursor-pointer type-label text-text-base">수집 정보</summary>
          <p className="mb-3 type-caption text-text-muted">표시한 최신 포인트의 Resource와 Scope입니다.</p>
          <dl className="space-y-2 type-caption text-text-muted">{Object.entries(points[points.length - 1]?.resource ?? {}).map(([key, value]) => <div key={key} className="grid gap-1 sm:grid-cols-2"><dt className="break-all font-mono">{key}</dt><dd className="break-all">{value}</dd></div>)}</dl>
          <p className="mt-3 break-all type-caption text-text-muted">Scope: {points[points.length - 1]?.scope?.name || '기록 없음'} {points[points.length - 1]?.scope?.version}</p>
        </details>}
        {activeTraceId && <TracePanel traceId={activeTraceId} target={source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey }} onClose={() => setActiveTraceId(null)} />}
      </ChartCard>
    </div>
  );
}
