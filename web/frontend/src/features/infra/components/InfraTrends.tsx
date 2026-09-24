import { useState } from 'react';
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
import { MaterialIcon, type GlobalTimeRange } from '../../../components/common';
import {
  CHART_INITIAL_DIMENSION, ChartStatsLegend, ChartTooltip, areaProps, chartCardClass, formatAxisValue,
  gridProps, lineProps, niceYAxis, rangeAreas, splitGaps, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
  type ChartTheme,
} from '../../../components/charts';
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
            <ChartCard
              key={chart.title}
              chart={chart}
              domain={domain}
              rangeLabel={rangeLabel[range]}
              theme={theme}
              showTooltip={hovered === chart.title}
              onHover={setHovered}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ChartCard({
  chart,
  domain,
  rangeLabel,
  theme,
  showTooltip,
  onHover,
}: {
  chart: ChartData;
  domain: [number, number];
  rangeLabel: string;
  theme: ChartTheme;
  showTooltip: boolean;
  onHover: (title: string | null) => void;
}) {

  const allValues = chart.series.flatMap((s) =>
    chart.data.map((p) => Number(p[s.key])).filter(Number.isFinite)
  );
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const isEmpty = chart.data.length === 0 || maxVal < 0.001;
  const { rows, gaps } = splitGaps(chart.data);

  return (
    <section className={`overflow-hidden ${chartCardClass}`} aria-label={chart.title}>
      <div className="flex items-baseline gap-2 px-5 pb-1 pt-5">
        <p className="truncate text-base text-text-base">{chart.title}</p>
        <span className="shrink-0 text-xs text-text-dim">{chart.unit}</span>
      </div>

      {isEmpty ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-text-dim">
          <MaterialIcon size={36} name="show_chart" className="opacity-30" />
          <p className="text-sm">
            {`${rangeLabel} 동안 활동 없음`}
          </p>
        </div>
      ) : (
        <div className="px-2 pb-4 pt-1" onMouseEnter={() => onHover(chart.title)} onMouseLeave={() => onHover(null)}>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
              <ComposedChart data={rows} syncId="infra-trends" margin={{ top: 16, right: 20, left: 0, bottom: 2 }}>
                <CartesianGrid {...gridProps(theme)} />

                <XAxis {...timeXAxisProps(theme, domain)} />

                <YAxis
                  {...yAxisProps(theme, 42)}
                  {...niceYAxis(chart.yMax ?? maxVal)}
                  tickFormatter={(value) => formatAxisValue(Number(value), chart.unit)}
                />

                {rangeAreas(gaps, theme.tickColor, '수집 없음', 0.08)}

                <Tooltip
                  cursor={tooltipCursor(theme)}
                  content={({ active, label, payload }) => showTooltip && (
                    <ChartTooltip active={active} label={label} payload={payload as import('../../../components/charts').TooltipPayloadItem[]} unit={chart.unit} theme={theme} />
                  )}
                />

                {chart.series.length === 1 && (
                  <Area {...areaProps(chart.series[0].color)} dataKey={chart.series[0].key} />
                )}

                {chart.series.map((s) => (
                  <Line key={`${s.key}-line`} {...lineProps(s.color, theme)} dataKey={s.key} name={s.label} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 px-3">
            <ChartStatsLegend
              series={chart.series.map((s) => ({
                label: s.label,
                color: s.color,
                values: chart.data.map((p) => Number(p[s.key])),
              }))}
              unit={chart.unit}
            />
          </div>
        </div>
      )}
    </section>
  );
}
