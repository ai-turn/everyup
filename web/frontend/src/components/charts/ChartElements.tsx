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

/** Grafana풍 스탯 범례 — 트렌드 차트 아래에 시리즈별 Last/Min/Max/Avg를 렌더. */
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
    .map((s) => ({ ...s, values: s.values.filter(Number.isFinite) }))
    .filter((s) => s.values.length > 0);
  if (rows.length === 0) return null;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-text-dim">
          <th className="py-0.5 text-left font-medium" />
          <th className="text-right font-medium">Last</th>
          <th className="text-right font-medium">Min</th>
          <th className="text-right font-medium">Max</th>
          <th className="text-right font-medium">Avg</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const stats: [string, number][] = [
            ['last', s.values[s.values.length - 1]],
            ['min', Math.min(...s.values)],
            ['max', Math.max(...s.values)],
            ['avg', s.values.reduce((sum, v) => sum + v, 0) / s.values.length],
          ];
          return (
            <tr key={s.label} className="text-text-secondary">
              <td className="py-0.5">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              </td>
              {stats.map(([key, v]) => (
                <td key={key} className="text-right tabular-nums">
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
