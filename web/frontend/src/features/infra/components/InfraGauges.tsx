import { MaterialIcon } from '../../../components/common';
import { useMonitoringGauges } from '../../../hooks/useInfra';
import { Skeleton } from '../../../components/skeleton';
import type { GaugeData } from '../../../types/infra';

const LOAD_STATE_LABELS: Record<'normal' | 'elevated' | 'critical', string> = {
  normal: '정상',
  elevated: '상승',
  critical: '위험',
};

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
  const tone = getGaugeTone(pct);
  const trend = getTrendTone(gauge.trendType);
  const displayValue = gauge.displayValue ?? pct;
  const displayUnit = gauge.displayUnit ?? '%';

  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-4 shadow-sm">
      {/* 상단: 레이블 + 추세 배지 */}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium uppercase tracking-wider text-text-muted">
          {gauge.label}
        </p>
        {gauge.trend && (
          <span className={`inline-flex shrink-0 items-center gap-0.5 rounded text-xs px-1.5 py-0.5 ${trend.soft} ${trend.text}`}>
            <MaterialIcon size={20} name={trend.icon} />
            {gauge.trend}
          </span>
        )}
      </div>

      {/* 값 + 단위 + 상태 pill */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl tracking-tight tabular-nums text-text-base">
          {displayValue}
        </span>
        <span className="text-sm text-text-dim">{displayUnit}</span>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs ${tone.soft} ${tone.text}`}>
          {LOAD_STATE_LABELS[getGaugeState(pct)]}
        </span>
      </div>

      {/* 가로 프로그레스 바 */}
      <div className="my-3 h-1.5 overflow-hidden rounded-full bg-ui-hover">
        <div className={`h-full rounded-full ${tone.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>

      {/* 부가 설명 */}
      <p className="truncate text-xs text-text-dim">{gauge.subtitle}</p>
    </article>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// 부하 임계값: 85%+ 위험(red), 60%+ 주의(amber), 그 외 정상(green).
function getGaugeTone(pct: number) {
  if (pct >= 85) {
    return { bar: 'bg-status-error', text: 'text-status-error', soft: 'bg-status-error/10' };
  }
  if (pct >= 60) {
    return { bar: 'bg-status-warn', text: 'text-status-warn', soft: 'bg-status-warn/10' };
  }
  return { bar: 'bg-status-healthy', text: 'text-status-healthy', soft: 'bg-status-healthy/10' };
}

function getGaugeState(pct: number) {
  if (pct >= 85) return 'critical';
  if (pct >= 60) return 'elevated';
  return 'normal';
}

// 추세 배지는 부하 수준이 아니라 변화 '방향'으로 색을 정한다 (상승=주의, 하락=양호).
function getTrendTone(trendType: GaugeData['trendType']) {
  if (trendType === 'up') {
    return { icon: 'arrow_upward', text: 'text-status-warn', soft: 'bg-status-warn/10' };
  }
  if (trendType === 'down') {
    return { icon: 'arrow_downward', text: 'text-status-healthy', soft: 'bg-status-healthy/10' };
  }
  return { icon: 'remove', text: 'text-text-muted', soft: 'bg-ui-hover' };
}
