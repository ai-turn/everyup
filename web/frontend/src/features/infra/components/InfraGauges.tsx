import { StatusLight } from '../../../components/common';
import { Sparkline } from '../../../components/charts';
import { Skeleton } from '../../../components/skeleton';
import type { GaugeData } from '../../../types/infra';
import { CRITICAL_PCT } from '../usage';


interface InfraGaugesProps {
  /** useInfraMetrics().gauges */
  gauges?: GaugeData[];
  loading: boolean;
}

export function InfraGauges({ gauges, loading }: InfraGaugesProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {(gauges || []).map((gauge) => (
        <VitalGaugeCard key={gauge.label} gauge={gauge} />
      ))}
    </div>
  );
}

function VitalGaugeCard({ gauge }: { gauge: GaugeData }) {

  const pct = clampPercent(gauge.percentage);
  const critical = pct >= CRITICAL_PCT;
  // 목록·차트와 같은 소수 한 자리 — 67.4%를 여기서만 67로 보여 주면 다른 값처럼 읽힌다.
  const displayValue = gauge.displayValue ?? pct.toFixed(1);
  const displayUnit = gauge.displayUnit ?? '%';

  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-text-muted">
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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}
