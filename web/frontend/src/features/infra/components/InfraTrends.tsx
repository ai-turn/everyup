import { useId, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { GlobalTimeRange } from '../../../components/common';
import {
  CHART_HEIGHT, CHART_MARGIN, CHART_INITIAL_DIMENSION, ChartCard, ChartEmpty, ChartLegend, ChartSummary, ChartTooltip, areaGradient, areaProps, formatAxisValue,
  gridProps, lineProps, niceYAxis, rangeAreas, splitGaps, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
  type ChartTheme,
} from '../../../components/charts';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import type { AlertRule } from '../../../services/api';
import { useMonitoringTrends } from '../../../hooks/useInfra';
import { Skeleton } from '../../../components/skeleton';
import type { ChartData } from '../../../types/infra';

interface InfraTrendsProps {
  hostId: string;
  refreshKey?: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

const RANGE_MS: Record<GlobalTimeRange, number> = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 };

export function InfraTrends({ hostId, refreshKey = 0, range }: InfraTrendsProps) {

  const { data: charts, loading } = useMonitoringTrends(hostId, range, refreshKey);
  // Charts share a crosshair (syncId); only the hovered one shows its tooltip box.
  const [hovered, setHovered] = useState<string | null>(null);

  const theme = useChartTheme();
  // Memory/disk rules are usage %, while those charts plot GB and MB/s — only CPU lines up.
  const cpuRules = useAlertThresholds({ kind: 'infrastructure', resourceId: hostId }, 'cpu');

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
          <p className="mt-1 text-sm text-text-muted">
            {rangeLabel[range]}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(charts || []).map((chart) => (
            <TrendCard
              key={chart.title}
              chart={chart}
              domain={domain}
              theme={theme}
              showTooltip={hovered === chart.title}
              onHover={setHovered}
              thresholds={chart.series.some((s) => s.key === 'cpu') ? cpuRules : []}
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

  // One series: its numbers sit in the title row. Several: their names do, as chips.
  const right = isEmpty
    ? null
    : single
      ? <ChartSummary values={chart.data.map((p) => Number(p[single.key]))} unit={chart.unit} />
      : <ChartLegend items={chart.series.map((s) => ({ label: s.label, color: s.color }))} />;

  return (
    <ChartCard title={chart.title} unit={chart.unit} right={right}>
      {isEmpty ? (
        <ChartEmpty />
      ) : (
        <div onMouseEnter={() => onHover(chart.title)} onMouseLeave={() => onHover(null)}>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
            <ComposedChart data={rows} syncId="infra-trends" margin={CHART_MARGIN}>
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
