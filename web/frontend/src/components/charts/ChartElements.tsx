import type { ReactNode } from 'react';
import { ChartTheme, TooltipPayloadItem, formatMetricValue, formatTimeLabel } from './chartTheme';

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  unit: string;
  theme: ChartTheme;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label?: string | number) => ReactNode;
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

  return (
    <dl className="flex items-baseline gap-4">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <dt className="type-caption text-text-muted">{label}</dt>
          <dd className="type-label tabular-nums text-text-base">
            {valueFormatter(value)}
            <span className="ml-0.5 type-caption text-text-dim">{unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
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
              <span className="ml-0.5 text-xs font-medium text-text-dim">{unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
