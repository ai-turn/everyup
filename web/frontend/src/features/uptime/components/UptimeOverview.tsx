import { useMemo, useState, type KeyboardEvent } from 'react';
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Every slot knows its date, so a day with no record can still say so.
    const result: { date: string; day: UptimeOverviewDay | null }[] = Array.from({ length: HISTORY_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (HISTORY_DAYS - 1 - index));
      return { date: date.toLocaleDateString('sv-SE'), day: null };
    });
    days.forEach((day) => {
      const diff = Math.floor((today.getTime() - new Date(`${day.date}T00:00:00`).getTime()) / 86_400_000);
      const index = HISTORY_DAYS - 1 - diff;
      if (index >= 0 && index < HISTORY_DAYS) result[index] = { date: day.date, day };
    });
    return result;
  }, [days]);
  const hovered = hoveredIndex === null ? null : slots[hoveredIndex];

  // One tab stop for the whole strip; arrow keys walk the days (90 stops would bury the page).
  const moveFocus = (event: KeyboardEvent) => {
    const last = HISTORY_DAYS - 1;
    const current = hoveredIndex ?? last;
    const next = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setHoveredIndex(Math.max(0, Math.min(last, next)));
  };
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
        <div
          className="flex gap-px"
          role="group"
          tabIndex={0}
          aria-label="최근 90일 일별 업타임 상태 — 방향키로 날짜를 옮깁니다"
          onKeyDown={moveFocus}
          onFocus={() => setHoveredIndex((index) => index ?? HISTORY_DAYS - 1)}
          onBlur={() => setHoveredIndex(null)}
        >
          {slots.map(({ date, day }, index) => (
            <div
              key={date}
              className={`h-8 flex-1 cursor-default rounded-sm transition-opacity hover:opacity-75 ${
                index === hoveredIndex ? 'opacity-75' : ''
              } ${
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

      <div className="mt-2 flex justify-between gap-3 text-xs text-text-dim" aria-live="polite">
        <span className="shrink-0">90일 전</span>
        {hovered && (
          <span className="truncate text-text-secondary">
            <span className="font-medium">{hovered.date}</span>
            {' — '}
            {hovered.day === null ? '기록 없음' : <>{hovered.day.uptime.toFixed(1)}% {'업타임'}</>}
            {hovered.day?.detail && <> ({hovered.day.detail})</>}
          </span>
        )}
        <span className="shrink-0">오늘</span>
      </div>
    </section>
  );
}
