import { expect, test } from '@playwright/test';
import { buildMetricSeries, metricRates } from '../src/features/metrics/metricSeries';
import type { OtelMetricPoint } from '../src/services/api';

function point(value: number, attributes: Record<string, unknown>, second = 0): OtelMetricPoint {
  return { id: second + 1, metricName: 'test.metric', metricType: 'gauge', value, attributes, createdAt: new Date(1_700_000_000_000 + second * 1000).toISOString() };
}

test('different full attribute keys remain separate and retain their own values', () => {
  const data = buildMetricSeries([point(0, { 'http.method': 'GET' }), point(42, { 'rpc.method': 'GET' })]);
  expect(data.series).toHaveLength(2);
  const http = data.series.find(item => item.label === 'http.method="GET"');
  const rpc = data.series.find(item => item.label === 'rpc.method="GET"');
  expect(http).toBeDefined();
  expect(rpc).toBeDefined();
  expect(data.chartData[0][http!.key]).toBe(0);
  expect(data.chartData[0][rpc!.key]).toBe(42);
});

test('attribute order does not split a series and labels cannot collide with data keys', () => {
  const attributes = { 'http.route': '/v1/orders[0]', 'http.method': 'GET' };
  const data = buildMetricSeries([
    point(1, attributes), point(2, { 'http.method': 'GET', 'http.route': '/v1/orders[0]' }, 1),
  ]);
  expect(data.series).toHaveLength(1);
  expect(data.chartData.map(row => row[data.series[0].key])).toEqual([1, 2]);
  expect(data.series[0].label).toBe('http.method="GET", http.route="/v1/orders[0]"');
  expect(attributes).toEqual({ 'http.route': '/v1/orders[0]', 'http.method': 'GET' });
});

test('separators and attribute value types do not merge identities', () => {
  const data = buildMetricSeries([
    point(1, { a: 'x, b=y' }), point(2, { a: 'x', b: 'y' }),
    point(3, { value: 1 }), point(4, { value: '1' }),
  ]);
  expect(data.series).toHaveLength(4);
  expect(new Set(data.series.map(item => item.label)).size).toBe(4);
  expect(data.series.map(item => data.chartData[0][item.key]).sort()).toEqual([1, 2, 3, 4]);
});

test('series limiting is stable across input order and reports omitted series', () => {
  const points = Array.from({ length: 8 }, (_, index) => point(index, { instance: `host-${index}` }));
  const forward = buildMetricSeries(points);
  const reverse = buildMetricSeries([...points].reverse());
  expect(forward.series).toHaveLength(6);
  expect(forward.truncatedSeries).toBe(2);
  expect(forward.series).toEqual(reverse.series);
  expect(forward.chartData).toEqual(reverse.chartData);
});

test('counter rates respect delta intervals, cumulative starts, resets and typed series', () => {
  const start = 1_699_999_900_000 * 1_000_000;
  const counter = (value: number, second: number, extra: Partial<OtelMetricPoint> = {}): OtelMetricPoint => ({ ...point(value, { worker: 'a' }, second), metricType: 'sum', temporality: 2, isMonotonic: true, startTimeUnixNano: start, ...extra });
  const cumulative = metricRates([
    counter(100, 0), counter(120, 10), counter(10, 20, { startTimeUnixNano: start + 110_000_000_000 }), counter(40, 30, { startTimeUnixNano: start + 110_000_000_000 }),
  ]);
  expect(cumulative.map(item => Number.isNaN(item.value) ? null : item.value)).toEqual([null, 2, null, 3]);
  const unsupported = metricRates([counter(1, 0, { isMonotonic: false }), counter(2, 10, { startTimeUnixNano: 0 }), counter(3, 20, { temporality: 0 })]);
  expect(unsupported.every(item => Number.isNaN(item.value))).toBe(true);
  const delta = metricRates([
    counter(20, 10, { temporality: 1, startTimeUnixNano: Date.parse(point(0, {}, 0).createdAt) * 1_000_000 }),
    counter(40, 20, { temporality: 1, startTimeUnixNano: Date.parse(point(0, {}, 10).createdAt) * 1_000_000 }),
    counter(90, 30, { temporality: 1, startTimeUnixNano: Date.parse(point(0, {}, 10).createdAt) * 1_000_000 }),
  ]);
  expect(delta.slice(0, 2).map(item => item.value)).toEqual([2, 4]);
  expect(Number.isNaN(delta[2].value)).toBe(true);
  expect(buildMetricSeries([counter(100, 0), counter(120, 10)], '1', 'rate').display.unit).toBe('/s');
  const replicas = buildMetricSeries([
    counter(100, 0, { streamKey: 'a' }), counter(1000, 0, { streamKey: 'b' }),
    counter(120, 10, { streamKey: 'a' }), counter(1040, 10, { streamKey: 'b' }),
  ], '1', 'rate');
  expect(replicas.series).toHaveLength(2);
  expect(replicas.series.map(item => replicas.chartData[1][item.key])).toEqual([2, 4]);
});
