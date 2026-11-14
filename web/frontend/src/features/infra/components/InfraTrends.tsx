import { useId, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { EmptyState, StatusLight, type GlobalTimeRange } from '../../../components/common';
import {
  CHART_HEIGHT, CHART_MARGIN, CHART_INITIAL_DIMENSION, ChartCard, formatMetricValue, formatTimeLabel, ChartEmpty, ChartLegend, ChartSummary, ChartTooltip, areaGradient, areaProps, formatAxisValue,
  gridProps, lineProps, niceYAxis, rangeAreas, splitGaps, thresholdLines, timeXAxisProps, tooltipCursor, useChartKeyboard, useChartTheme, yAxisProps,
  type ChartTheme,
} from '../../../components/charts';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import type { AlertRule } from '../../../services/api';
import { Skeleton } from '../../../components/skeleton';
import type { ChartData } from '../../../types/infra';
import { usageLevel } from '../usage';

interface InfraTrendsProps {
  /** For the alert rules drawn as threshold lines. */
  hostId: string;
  /** useInfraMetrics().charts */
  charts?: ChartData[];
  loading: boolean;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
  /** 조회 실패 — 빈 차트로 그리면 "데이터 없음"과 구분되지 않는다. */
  error?: string | null;
  onRetry?: () => void;
  /** 한 번도 수신하지 않은 호스트처럼 보여 줄 차트가 없을 때. 없으면 기본 문구. */
  empty?: ReactNode;
}

const RANGE_MS: Record<GlobalTimeRange, number> = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 };

export function InfraTrends({ hostId, charts, loading, range, error, onRetry, empty }: InfraTrendsProps) {
  // Charts share a crosshair (syncId); only the hovered one shows its tooltip box.
  const [hovered, setHovered] = useState<string | null>(null);

  const theme = useChartTheme();
  // Usage rules are %, like the three usage charts. Network (MB/s) has no rule.
  const rules = useAlertThresholds({ kind: 'infrastructure', resourceId: hostId }, ['cpu', 'memory', 'disk']);
  const metricBySeries: Record<string, AlertRule['metric']> = { cpu: 'cpu', memUsage: 'memory', diskUsage: 'disk' };

  const rangeLabel: Record<GlobalTimeRange, string> = {
    '1h': '최근 1시간',
    '6h': '최근 6시간',
    '24h': '최근 24시간',
  };

  // The newest row is the "now" sample appended at fetch time, so the window ends there.
  const lastT = Math.max(0, ...(charts ?? []).flatMap((chart) => chart.data.map((row) => row.t)));
  const domain: [number, number] = [lastT - RANGE_MS[range], lastT];

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="type-section-title tracking-tight text-text-base">
            인프라 추세
          </h2>
          <p className="mt-0.5 type-body text-text-muted">
            {rangeLabel[range]}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="메트릭을 불러오지 못했습니다" description={error} action={onRetry && { label: '다시 시도', onClick: onRetry }} />
      ) : !charts?.length ? (
        empty ?? <EmptyState icon="monitoring" title="아직 수집된 메트릭이 없습니다" description="호스트 메트릭이 들어오면 여기에 사용률 추이가 표시됩니다." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(charts || []).map((chart) => (
            <TrendCard
              key={chart.title}
              chart={chart}
              domain={domain}
              theme={theme}
              showTooltip={hovered === chart.title}
              onHover={setHovered}
              thresholds={rules.filter((rule) => rule.metric === metricBySeries[chart.series[0]?.key])}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TrendCard({
  chart,
  domain,
  theme,
  showTooltip,
  onHover,
  thresholds,
}: {
  chart: ChartData;
  domain: [number, number];
  theme: ChartTheme;
  showTooltip: boolean;
  onHover: (title: string | null) => void;
  thresholds: AlertRule[];
}) {

  const allValues = chart.series.flatMap((s) =>
    chart.data.map((p) => Number(p[s.key])).filter(Number.isFinite)
  );
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const isEmpty = chart.data.length === 0 || maxVal < 0.001;
  const { rows, gaps } = splitGaps(chart.data);
  const single = chart.series.length === 1 ? chart.series[0] : null;
  const gradientId = useId().replace(/[^\w-]/g, '');
  const kbd = useChartKeyboard(chart.data.length);
  const kbdPoint = kbd.index === null ? undefined : chart.data[kbd.index];

  // One series: its numbers sit in the title row. Several: their names do, as chips.
  // 상세의 게이지 줄을 없앤 대신, 주의·위험은 차트 머리에서 읽는다(사용률 차트만, 목록과 같은 선).
  const current = single ? Number(chart.data[chart.data.length - 1]?.[single.key]) : NaN;
  const level = chart.unit === '%' && Number.isFinite(current) ? usageLevel(current) : 'normal';
  const right = isEmpty
    ? null
    : single
      ? <div className="flex items-center gap-3">{level !== 'normal' && <StatusLight tone={level === 'critical' ? 'error' : 'warn'} label={level === 'critical' ? '위험' : '주의'} />}<ChartSummary values={chart.data.map((p) => Number(p[single.key]))} unit={chart.unit} /></div>
      : <ChartLegend items={chart.series.map((s) => ({ label: s.label, color: s.color }))} />;

  return (
    <ChartCard title={chart.title} unit={chart.unit} right={right}>
      {chart.caption && <p className="-mt-2 mb-3 type-caption text-text-muted">{chart.caption}</p>}
      {isEmpty ? (
        <ChartEmpty />
      ) : (
        <div
          tabIndex={0}
          role="group"
          aria-label={`${chart.title} 추이. 좌우 방향키로 시점별 값을 읽습니다.`}
          className="rounded-lg"
          onKeyDown={kbd.onKeyDown}
          onBlur={kbd.onBlur}
          onMouseEnter={() => onHover(chart.title)}
          onMouseLeave={() => onHover(null)}
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
            <ComposedChart data={rows} syncId="infra-trends" margin={CHART_MARGIN} accessibilityLayer={false}>
              <CartesianGrid {...gridProps(theme)} />
              <XAxis {...timeXAxisProps(theme, domain)} />
              <YAxis
                {...yAxisProps(theme, 42)}
                {...niceYAxis(Math.max(chart.yMax ?? maxVal, ...thresholds.map((r) => r.threshold)))}
                tickFormatter={(value) => formatAxisValue(Number(value), chart.unit)}
              />
              {single && areaGradient(gradientId, single.color)}
              {rangeAreas(gaps, theme.tickColor, 0.06)}
              {thresholdLines(thresholds, theme.errorColor, chart.unit)}
              <Tooltip
                cursor={tooltipCursor(theme)}
                content={({ active, label, payload }) => showTooltip && (
                  <ChartTooltip active={active} label={label} payload={payload as import('../../../components/charts').TooltipPayloadItem[]} unit={chart.unit} theme={theme} />
                )}
              />
              {single && <Area {...areaProps(gradientId)} dataKey={single.key} />}
              {chart.series.map((s) => (
                <Line key={`${s.key}-line`} {...lineProps(s.color, theme)} dataKey={s.key} name={s.label} />
              ))}
              {kbdPoint && <ReferenceLine x={kbdPoint.t} stroke={theme.tickColor} strokeDasharray="3 3" />}
            </ComposedChart>
          </ResponsiveContainer>
          {/* 마우스 사용자에게 빈 줄을 남기지 않게, 고르기 전에는 화면에서만 숨긴다(라이브 영역은 유지). */}
          <p aria-live="polite" className={kbdPoint ? 'mt-2 px-2 pb-1 type-caption text-text-muted' : 'sr-only'}>
            {kbdPoint && `${formatTimeLabel(kbdPoint.t)} · ${chart.series.map((s) => `${s.label} ${formatMetricValue(Number(kbdPoint[s.key]))} ${chart.unit}`).join(' · ')}`}
          </p>
        </div>
      )}
    </ChartCard>
  );
}
