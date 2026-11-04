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

export function metricSeriesIdentity(attributes?: Record<string, unknown>) {
  return JSON.stringify(canonicalValue(attributes ?? {}));
}

export function metricSeriesLabel(attributes: Record<string, unknown>, streamKey = '', streamLabel = '') {
  const label = Object.entries(JSON.parse(metricSeriesIdentity(attributes))).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ') || 'attribute 없음';
  return streamKey ? `${streamLabel || 'stream'} [${streamKey.slice(0, 8)}], ${label}` : label;
}

export function pointIdentity(point: OtelMetricPoint) {
  return `${point.streamKey ?? ''}|${metricSeriesIdentity(point.attributes)}`;
}

// Cumulative sums require a previous point from the same uninterrupted stream.
// Unknown starts, resets, overlaps and legacy metadata produce a gap, never 0.
export function metricRates(points: OtelMetricPoint[]) {
  const previous = new Map<string, OtelMetricPoint>();
  return [...points].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id).map(point => {
    const id = pointIdentity(point);
    const last = previous.get(id);
    previous.set(id, point);
    const end = Date.parse(point.createdAt);
    const start = (point.startTimeUnixNano ?? 0) / 1_000_000;
    let value = Number.NaN;
    if (point.metricType === 'sum' && point.isMonotonic && start > 0 && start < end && Number.isFinite(point.value) && point.value >= 0) {
      if (point.temporality === 1 && (!last || start >= Date.parse(last.createdAt))) {
        value = point.value / ((end - start) / 1000);
      } else if (point.temporality === 2 && last?.isMonotonic && last.temporality === 2 && last.startTimeUnixNano === point.startTimeUnixNano && Number.isFinite(last.value) && last.value >= 0 && point.value >= last.value && Date.parse(last.createdAt) < end) {
        value = (point.value - last.value) / ((end - Date.parse(last.createdAt)) / 1000);
      }
    }
    return { ...point, value };
  });
}

// Display labels are never data keys: dots, quotes and separators in attributes
// must not merge different series or be interpreted as a Recharts object path.
export function buildMetricSeries(points: OtelMetricPoint[], unit = '', mode: 'raw' | 'rate' = 'raw') {
  const resolved = mode === 'rate' ? metricRates(points) : points;
  const display = metricDisplayUnit(unit, Math.max(0, ...resolved.map(point => Math.abs(point.value)).filter(Number.isFinite)));
  if (mode === 'rate') display.unit = display.unit ? `${display.unit}/s` : '/s';
  const examples = new Map(resolved.map(point => [pointIdentity(point), point]));
  const identities = [...examples.keys()].sort();
  const series = identities.slice(0, MAX_METRIC_SERIES).map((signature, index) => {
    const example = examples.get(signature)!;
    return {
      signature,
      key: `series_${index}`,
      label: metricSeriesLabel(example.attributes ?? {}, example.streamKey, example.streamLabel),
    };
  });
  const byIdentity = new Map(series.map(item => [item.signature, item.key]));
  const byTime = new Map<number, { t: number } & Record<string, number>>();
  for (const point of resolved) {
    const key = byIdentity.get(pointIdentity(point));
    if (!key) continue;
    // One export can stamp its attribute series milliseconds apart.
    const t = mode === 'rate' ? Date.parse(point.createdAt) : Math.round(Date.parse(point.createdAt) / 1000) * 1000;
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
    skippedRatePoints: mode === 'rate' ? resolved.filter(point => !Number.isFinite(point.value)).length : 0,
  };
}
