import type { ReactNode } from 'react';
import { Skeleton } from '../skeleton';
import {
  CHART_HEIGHT, ChartTheme, TooltipPayloadItem, chartCardClass, formatMetricValue, formatTimeLabel,
} from './chartTheme';

/**
 * 차트 카드 표준 틀 (DESIGN.md §4.2) — 왼쪽 제목 + 단위, 오른쪽 칸 하나(요약 · 상태 · 범례 칩 ·
 * 기간 선택 중 하나), 그 아래 본문. 메뉴마다 제목 크기 · 여백 · 헤더 배치가 달랐던 것을 여기서 고정한다.
 */
export function ChartCard({
  title,
  unit,
  right,
  titleClassName = '',
  as: Heading = 'h3',
  className = '',
  children,
}: {
  title: ReactNode;
  unit?: string;
  right?: ReactNode;
  /** 메트릭 이름처럼 식별자인 제목만 — `font-mono text-sm`. */
  titleClassName?: string;
  as?: 'h2' | 'h3';
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`p-6 ${chartCardClass} ${className}`}>
      <div className="flex min-h-6 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <Heading className={`truncate type-card-title text-text-base ${titleClassName}`}>{title}</Heading>
          {unit && <span className="shrink-0 type-caption text-text-dim">{unit}</span>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** 빈 상태 — 차트와 같은 높이, 문구 하나. */
export function ChartEmpty({ height = CHART_HEIGHT }: { height?: number }) {
  return (
    <div className="flex items-center justify-center rounded-lg bg-ui-hover-soft type-body text-text-dim" style={{ height }}>
      이 기간에 데이터 없음
    </div>
  );
}

/** 첫 로드 — 차트와 같은 높이라 데이터가 들어와도 카드가 움직이지 않는다. */
export function ChartSkeleton({ height = CHART_HEIGHT }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" height={`${height}px`} />;
}

/** 제목 줄 오른쪽 수치 목록 — `30일 99.98% · 90일 99.98%`처럼 이미 계산된 값. */
export function ChartStats({ items }: { items: { label: string; value: string; unit?: string }[] }) {
  return (
    <dl className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dt className="type-caption text-text-muted">{item.label}</dt>
          <dd className="type-label tabular-nums text-text-base">
            {item.value}
            {item.unit && <span className="ml-0.5 type-caption text-text-dim">{item.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  unit: string;
  theme: ChartTheme;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label?: string | number) => ReactNode;
  /** 상자 맨 아래 안내 한 줄 — 예: 막대를 누르면 무엇이 되는지. */
  footer?: ReactNode;
}

const finite = (values: number[]) => values.filter(Number.isFinite);
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * 단일 시리즈 차트의 요약 — 카드 제목 줄 오른쪽에 `현재 105 · 평균 116 · 최대 149 ms`.
 * 시리즈가 하나면 제목이 곧 범례라, 차트 아래에 범례 표를 따로 두지 않는다.
 */
export function ChartSummary({
  values,
  unit,
  valueFormatter = formatMetricValue,
}: {
  values: number[];
  unit: string;
  valueFormatter?: (value: number) => string;
}) {
  const v = finite(values);
  if (v.length === 0) return null;
  const items: [string, number][] = [['현재', v[v.length - 1]], ['평균', average(v)], ['최대', Math.max(...v)]];
  return <ChartStats items={items.map(([label, value]) => ({ label, value: valueFormatter(value), unit }))} />;
}

/**
 * 다중 시리즈 범례 겸 통계 — 차트 아래 왼쪽에 붙는 좁은 표. 카드 폭 전체로 펼치면 숫자가
 * 시리즈 이름에서 멀어져 눈이 행을 따라가지 못했다.
 */
export function ChartStatsLegend({
  series,
  unit,
  valueFormatter = formatMetricValue,
}: {
  series: { label: string; color: string; values: number[] }[];
  unit: string;
  valueFormatter?: (value: number) => string;
}) {
  const rows = series
    .map((s) => ({ ...s, values: finite(s.values) }))
    .filter((s) => s.values.length > 0);
  if (rows.length === 0) return null;

  return (
    <table className="text-xs">
      <thead>
        <tr className="text-text-dim">
          <th className="py-0.5 pr-4 text-left font-normal"><span className="sr-only">시리즈</span></th>
          {['현재', '최소', '최대', '평균'].map((label) => (
            <th key={label} className="pl-5 text-right font-normal">{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const stats: [string, number][] = [
            ['last', s.values[s.values.length - 1]],
            ['min', Math.min(...s.values)],
            ['max', Math.max(...s.values)],
            ['avg', average(s.values)],
          ];
          return (
            <tr key={s.label} className="text-text-secondary">
              <td className="py-0.5 pr-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              </td>
              {stats.map(([key, v]) => (
                <td key={key} className="pl-5 text-right tabular-nums text-text-base">
                  {valueFormatter(v)}
                  <span className="ml-0.5 text-text-dim">{unit}</span>
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 공용 칩 범례 — recharts <Legend> 대신 차트 위/카드 헤더에 렌더. */
export function ChartLegend({ items, className = '' }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-hover-soft px-2 py-0.5 text-xs font-medium text-text-muted"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function ChartTooltip({
  active,
  label,
  payload,
  unit,
  theme,
  valueFormatter = formatMetricValue,
  labelFormatter,
  footer,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const seen = new Set<string>();
  const rows = payload.filter((item) => {
    const key = String(item.dataKey ?? item.name ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div
      className="min-w-36 rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background: theme.tooltipBg,
        border: `1px solid ${theme.tooltipBorder}`,
      }}
    >
      <p className="mb-2 text-xs" style={{ color: theme.tickColor }}>
        {labelFormatter ? labelFormatter(label) : typeof label === 'number' ? formatTimeLabel(label) : label}
      </p>
      <div className="space-y-1.5">
        {rows.map((item) => (
          <div key={String(item.dataKey ?? item.name)} className="flex items-center justify-between gap-5">
            <span className="inline-flex items-center gap-2 text-text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="tabular-nums text-text-base">
              {valueFormatter(Number(item.value) || 0)}
              <span className="ml-0.5 text-xs font-medium text-text-dim">{item.unit ?? unit}</span>
            </span>
          </div>
        ))}
      </div>
      {footer && <p className="mt-2 border-t border-ui-border pt-1.5 text-xs text-text-dim">{footer}</p>}
    </div>
  );
}
