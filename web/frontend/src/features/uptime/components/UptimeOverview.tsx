import { useMemo, useState } from 'react';
import { chartCardClass } from '../../../components/charts/chartTheme';

const HISTORY_DAYS = 90;

export interface UptimeOverviewStat {
  label: string;
  value: string;
}

export interface UptimeOverviewDay {
  date: string;
  uptime: number;
  detail?: string;
}

interface UptimeOverviewProps {
  stats: UptimeOverviewStat[];
  days: UptimeOverviewDay[];
  loading?: boolean;
  className?: string;
}

export function UptimeOverview({ stats, days, loading = false, className = '' }: UptimeOverviewProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const slots = useMemo(() => {
    const result: (UptimeOverviewDay | null)[] = Array(HISTORY_DAYS).fill(null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    days.forEach((day) => {
      const diff = Math.floor((today.getTime() - new Date(`${day.date}T00:00:00`).getTime()) / 86_400_000);
      const index = HISTORY_DAYS - 1 - diff;
      if (index >= 0 && index < HISTORY_DAYS) result[index] = day;
    });
    return result;
  }, [days]);
  const hovered = hoveredIndex === null ? null : slots[hoveredIndex];
  const statsGridClass = stats.length <= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-4';

  return (
    <section className={`p-6 ${chartCardClass} ${className}`}>
      <div className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="type-card-title text-text-base">업타임 현황</h2>
          <p className="mt-1 text-sm text-text-muted">요약 지표와 90일 상태 변화</p>
        </div>
        <dl className={`grid grid-cols-2 gap-x-8 gap-y-4 ${statsGridClass}`}>
          {stats.map((stat, index) => (
            <div key={stat.label}>
              <dt className="text-xs text-text-muted">{stat.label}</dt>
              <dd className={`mt-1 tabular-nums text-text-base ${index === 0 ? 'text-2xl' : 'text-base'}`}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {loading ? (
        <div className="h-8 animate-pulse rounded bg-ui-hover" />
      ) : (
        <div className="flex gap-px" role="img" aria-label="최근 90일 일별 업타임 상태">
          {slots.map((day, index) => (
            <div
              key={index}
              className={`h-8 flex-1 cursor-default rounded-sm transition-opacity hover:opacity-75 ${
                day === null
                  ? 'bg-ui-hover'
                  : day.uptime >= 99.5
                    ? 'bg-status-healthy'
                    : day.uptime >= 50
                      ? 'bg-status-warn'
                      : 'bg-status-error'
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </div>
      )}

      <div className="mt-2 flex justify-between gap-3 text-xs text-text-dim">
        <span className="shrink-0">90일 전</span>
        {hovered && (
          <span className="truncate text-text-secondary">
            <span className="font-medium">{hovered.date}</span>
            {' — '}{hovered.uptime.toFixed(1)}% {'업타임'}
            {hovered.detail && <> ({hovered.detail})</>}
          </span>
        )}
        <span className="shrink-0">오늘</span>
      </div>
    </section>
  );
}
