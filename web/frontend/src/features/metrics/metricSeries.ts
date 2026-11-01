import { metricDisplayUnit, splitGaps } from '../../components/charts/chartTheme';
import type { OtelMetricPoint } from '../../services/api';

export const MAX_METRIC_SERIES = 6;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonicalValue(item)]));
  }
  return value;
}

function identity(attributes?: Record<string, unknown>) {
  return JSON.stringify(canonicalValue(attributes ?? {}));
}

// Display labels are never data keys: dots, quotes and separators in attributes
// must not merge different series or be interpreted as a Recharts object path.
export function buildMetricSeries(points: OtelMetricPoint[], unit = '') {
  const display = metricDisplayUnit(unit, Math.max(0, ...points.map(point => Math.abs(point.value))));
  const identities = [...new Set(points.map(point => identity(point.attributes)))].sort();
  const series = identities.slice(0, MAX_METRIC_SERIES).map((signature, index) => {
    const attributes: Record<string, unknown> = JSON.parse(signature);
    return {
      signature,
      key: `series_${index}`,
      label: Object.entries(attributes).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ') || 'attribute 없음',
    };
  });
  const byIdentity = new Map(series.map(item => [item.signature, item.key]));
  const byTime = new Map<number, { t: number } & Record<string, number>>();
  for (const point of points) {
    const key = byIdentity.get(identity(point.attributes));
    if (!key) continue;
    // One export can stamp its attribute series milliseconds apart.
    const t = Math.round(Date.parse(point.createdAt) / 1000) * 1000;
    const row = byTime.get(t) ?? { t };
    row[key] = point.value * display.factor;
    byTime.set(t, row);
  }
  const chartData = [...byTime.values()].sort((a, b) => a.t - b.t);
  return {
    chartData,
    series,
    truncatedSeries: identities.length - series.length,
    gaps: splitGaps(chartData).gaps,
    display,
  };
}
