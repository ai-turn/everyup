import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';

const HISTORY_DAYS = 90;

export interface UptimeOverviewStat {
  label: string;
  value: string;
  /** 색은 기준을 넘은 값에만 싣는다(인증서 만료 임박 등). */
  tone?: 'warn' | 'error';
}

export interface UptimeOverviewDay {
  date: string;
  uptime: number;
  detail?: string;
}

interface UptimeOverviewProps {
  stats: UptimeOverviewStat[];
  days: UptimeOverviewDay[];
  /** 90일 전체 업타임. 주면 띠 머리글에 붙인다 — 타일로 두면 바로 아래 띠와 같은 것을 두 번 말한다. */
  historyUptime?: number;
  loading?: boolean;
  error?: string;
  className?: string;
  /** 주면 띠의 날짜를 눌러(Enter) 고를 수 있다. 같은 날을 다시 누르면 해제. */
  selectedDate?: string | null;
  onSelectDate?: (date: string | null) => void;
  /** 띠 아래 같은 카드에 붙는 내용 — 모니터 상세의 장애 이력. */
  children?: ReactNode;
}

/** 큰 수치 한 줄. 모니터 상세는 이것만 따로 맨 위 카드에 두고, 띠는 아래로 내린다. */
export function UptimeStats({ stats }: { stats: UptimeOverviewStat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-y-4 sm:flex">
      {stats.map((stat, index) => (
        <div key={stat.label} className={`pr-7 ${index > 0 ? 'sm:border-l sm:border-ui-border sm:pl-7' : ''}`}>
          <dt className="type-caption text-text-muted">{stat.label}</dt>
          <dd className={`mt-1 text-2xl font-medium tabular-nums ${stat.tone === 'error' ? 'text-status-error' : stat.tone === 'warn' ? 'text-status-warn' : 'text-text-base'}`}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function UptimeOverview({ stats, days, historyUptime, loading = false, error, className = '', selectedDate = null, onSelectDate, children }: UptimeOverviewProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const slots = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byDate = new Map(days.map((day) => [day.date, day]));
    // Every slot knows its date, so a day with no record can still say so.
    const result: { date: string; day: UptimeOverviewDay | null }[] = Array.from({ length: HISTORY_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (HISTORY_DAYS - 1 - index));
      const key = date.toLocaleDateString('sv-SE');
      return { date: key, day: byDate.get(key) ?? null };
    });
    return result;
  }, [days]);
  const hovered = hoveredIndex === null ? null : slots[hoveredIndex];

  // One tab stop for the whole strip; arrow keys walk the days (90 stops would bury the page).
  const select = (index: number) => onSelectDate?.(slots[index].date === selectedDate ? null : slots[index].date);
  const moveFocus = (event: KeyboardEvent) => {
    const last = HISTORY_DAYS - 1;
    const current = hoveredIndex ?? last;
    if (onSelectDate && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      select(current);
      return;
    }
    const next = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setHoveredIndex(Math.max(0, Math.min(last, next)));
  };

  // Same cut-offs as the bar colours below.
  const partialDays = slots.filter(({ day }) => day !== null && day.uptime < 99.5 && day.uptime >= 50).length;
  const downDays = slots.filter(({ day }) => day !== null && day.uptime < 50).length;
  const recordedDays = slots.filter(({ day }) => day !== null).length;

  // Datadog-style header: the numbers read first, large, with no title above them.
  return (
    <section className={`rounded-xl border border-ui-border bg-bg-surface p-6 ${className}`}>
      <h2 className="sr-only">업타임 현황</h2>
      {stats.length > 0 && <UptimeStats stats={stats} />}

      <div className={`${stats.length > 0 ? 'mt-6' : ''} mb-2 flex flex-wrap justify-between gap-3 type-caption text-text-muted`}>
        <span>지난 90일{historyUptime !== undefined && !loading && !error && <> · <span className="font-medium tabular-nums text-text-base">{historyUptime.toFixed(2)}%</span></>}</span>
        {!loading && !error && <><span>기록 {recordedDays}/90일</span><span>일부 실패 {partialDays}일, 전체 실패 {downDays}일</span></>}
      </div>
      {error ? <p className="py-3 text-sm text-text-muted">90일 이력을 불러오지 못했습니다. {error}</p> : loading ? (
        <div className="h-7 animate-pulse rounded bg-ui-hover" />
      ) : (
        <div
          className="flex gap-0.5"
          role="group"
          tabIndex={0}
          aria-label={onSelectDate ? '최근 90일 일별 업타임 상태. 방향키로 날짜를 옮기고 Enter로 그날 이력만 봅니다' : '최근 90일 일별 업타임 상태. 방향키로 날짜를 옮깁니다'}
          onKeyDown={moveFocus}
          onFocus={() => setHoveredIndex((index) => index ?? HISTORY_DAYS - 1)}
          onBlur={() => setHoveredIndex(null)}
        >
          {slots.map(({ date, day }, index) => (
            <div
              key={date}
              aria-current={date === selectedDate ? 'date' : undefined}
              onClick={onSelectDate ? () => select(index) : undefined}
              className={`h-7 flex-1 rounded-sm transition-opacity hover:opacity-75 ${onSelectDate ? 'cursor-pointer' : 'cursor-default'} ${
                index === hoveredIndex ? 'opacity-75' : ''
              } ${date === selectedDate ? 'ring-2 ring-text-base ring-offset-1 ring-offset-bg-surface' : ''} ${
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

      <div className="mt-2 flex flex-wrap justify-between gap-3 text-xs text-text-dim" aria-live="polite">
        <span className="shrink-0">90일 전</span>
        {hovered && (
          <span className="order-last basis-full break-words text-center text-text-secondary sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto">
            <span className="font-medium">{hovered.date}</span>
            {' '}
            {hovered.day === null ? '기록 없음' : <>{hovered.day.uptime.toFixed(1)}% {'업타임'}</>}
            {hovered.day?.detail && <> ({hovered.day.detail})</>}
          </span>
        )}
        <span className="shrink-0">오늘</span>
      </div>
      {children}
    </section>
  );
}
