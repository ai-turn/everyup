import type { MetricQueryResult, OtelMetricPoint } from '../services/api';

function seriesID(point: OtelMetricPoint) {
  return point.streamKey ? JSON.stringify({ stream: point.streamKey, attributes: point.attributes ?? {} }) : JSON.stringify(point.attributes ?? {});
}

export function filterMetricPoints(points: OtelMetricPoint[], query: URLSearchParams, applySeries = true) {
  const attributes = JSON.parse(query.get('attributes') || '{}') as Record<string, unknown>;
  const selected = query.has('series') ? JSON.parse(query.get('series')!) as string[] : null;
  return points.filter(point =>
    (!query.get('from') || Date.parse(point.createdAt) >= Date.parse(query.get('from')!)) &&
    (!query.get('to') || Date.parse(point.createdAt) <= Date.parse(query.get('to')!)) &&
    (!query.get('type') || point.metricType === query.get('type') && (point.unit ?? '') === (query.get('unit') ?? '')) &&
    Object.entries(attributes).every(([key, value]) => Object.prototype.hasOwnProperty.call(point.attributes ?? {}, key) && point.attributes?.[key] === value) &&
    (!applySeries || selected === null || selected.includes(seriesID(point))),
  );
}

export function mockMetricQuery(points: OtelMetricPoint[], query: URLSearchParams): MetricQueryResult {
  const scoped = filterMetricPoints(points, query, false);
  const ids = [...new Set(scoped.map(point => seriesID(point)))].sort();
  const selectedSeries = query.has('series') ? JSON.parse(query.get('series')!) as string[] : ids.slice(0, 6);
  const selected = scoped.filter(point => selectedSeries.includes(seriesID(point))).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
  return {
    series: ids.slice(0, 200).map(id => {
      const point = scoped.find(item => seriesID(item) === id)!;
      return { id, attributes: point.attributes ?? {}, streamKey: point.streamKey, streamLabel: point.streamLabel };
    }),
    selectedSeries,
    seriesTruncated: ids.length > 200,
    points: selected.slice(-5000),
    pointsTruncated: selected.length > 5000,
    pointLimit: 5000,
  };
}
