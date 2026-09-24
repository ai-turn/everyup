import { useId } from 'react';
import { Area, ComposedChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { StatusLight } from '../../../components/common';
import { CHART_INITIAL_DIMENSION, areaGradient, areaProps, lineProps, useChartTheme } from '../../../components/charts';
import { useMonitoringGauges } from '../../../hooks/useInfra';
import { Skeleton } from '../../../components/skeleton';
import type { GaugeData } from '../../../types/infra';

// 부하 임계값: 85% 이상이면 위험. 색은 이 선을 넘은 카드에만 싣는다 —
// 정상 카드까지 초록·주황으로 칠하면 정작 넘은 카드가 묻힌다.
const CRITICAL_PCT = 85;

interface InfraGaugesProps {
  hostId: string;
  refreshKey?: number;
}

export function InfraGauges({ hostId, refreshKey = 0 }: InfraGaugesProps) {
  const { data: gauges, loading } = useMonitoringGauges(hostId, refreshKey);

  if (loading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {(gauges || []).map((gauge) => (
        <VitalGaugeCard key={gauge.label} gauge={gauge} />
      ))}
    </div>
  );
}

function VitalGaugeCard({ gauge }: { gauge: GaugeData }) {

  const pct = clampPercent(gauge.percentage);
  const critical = pct >= CRITICAL_PCT;
  const displayValue = gauge.displayValue ?? pct;
  const displayUnit = gauge.displayUnit ?? '%';

  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-text-muted">
          {gauge.label}
        </p>
        {critical && <StatusLight tone="error" label="위험" />}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl tracking-tight text-text-base">
          {displayValue}
        </span>
        <span className="text-sm text-text-dim">{displayUnit}</span>
      </div>

      {/* Rates (CPU·Network) read best as a trend; capacities (Memory·Disk) as fill. */}
      <div className="my-3 flex h-8 items-center">
        {gauge.spark && gauge.spark.length > 1 ? (
          <Sparkline values={gauge.spark} />
        ) : (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ui-hover">
            <div className={`h-full rounded-full ${critical ? 'bg-status-error' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <p className="truncate text-xs text-text-dim">{gauge.subtitle}</p>
    </article>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const theme = useChartTheme();
  const gradientId = useId().replace(/[^\w-]/g, '');
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-8 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
        <ComposedChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          {areaGradient(gradientId, theme.primaryColor)}
          <YAxis hide domain={[0, 'dataMax']} />
          <Area {...areaProps(gradientId)} dataKey="v" />
          <Line {...lineProps(theme.primaryColor, theme)} dataKey="v" activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
