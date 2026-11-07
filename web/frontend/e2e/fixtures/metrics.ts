import { mockMetricQuery, filterMetricPoints } from '../../src/mocks/metricQuery';
import type { Page } from '@playwright/test';
import type { ObservedService, ObservedServiceMetricName, OtelMetricName, OtelMetricPoint } from '../../src/services/api';

export async function metricsFixture(page: Page) {
  const now = new Date().toISOString();
  const service: ObservedService = {
    id: 'metrics-service', name: 'billing-api', signals: ['metrics'], isActive: true,
    createdAt: now, updatedAt: now,
  };
  const names: OtelMetricName[] = [
    { metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: '2026-10-01T00:00:00Z' },
    { metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', lastAt: now },
  ];
  const catalog: ObservedServiceMetricName[] = [
    ...names.map(name => ({ ...name, serviceId: service.id })),
    { ...names[0], serviceId: service.id, unit: 'MB' },
  ];
  const state = {
    service, names, catalog,
    failures: new Set<string>(),
    requests: [] as string[],
    reads: [] as { path: string; name: string | null; from: string | null; to: string | null; attributes: string | null; series: string | null }[],
    points: new Map<string, OtelMetricPoint[]>(),
    holdNames: null as Promise<void> | null,
  };
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const name = url.searchParams.get('name');
    state.requests.push(path);
    state.reads.push({ path, name, from: url.searchParams.get('from'), to: url.searchParams.get('to'), attributes: url.searchParams.get('attributes'), series: url.searchParams.get('series') });
    const key = (path.endsWith('/points') || path.endsWith('/query')) ? `points:${name}` : path;
    if (state.failures.has(key)) {
      await route.fulfill({ status: 500, json: { success: false, error: { code: 'DATABASE_ERROR' } } });
      return;
    }
    let data: unknown = [];
    if (path === '/observed-services') data = [service, { ...service, id: 'waiting-service', name: 'waiting-worker' }];
    else if (path === '/observed-services/metric-catalog') data = catalog;
    else if (path === `/observed-services/${service.id}`) data = service;
    else if (path === `/observed-services/${service.id}/otel-metrics` || path === `/observed-services/${service.id}/otel-metrics/health`) {
      await state.holdNames;
      data = path.endsWith('/health') ? { metrics: names, checkedAt: new Date().toISOString(), freshnessSeconds: 300 } : names;
    } else if (path.endsWith('/points') || path.endsWith('/query')) {
      const points = state.points.get(name ?? '') ?? [
        { id: 1, metricName: name, metricType: names.find(item => item.metricName === name)?.metricType ?? 'gauge', unit: names.find(item => item.metricName === name)?.unit, value: 0, createdAt: new Date(Date.now() - 60_000).toISOString() },
        { id: 2, metricName: name, metricType: names.find(item => item.metricName === name)?.metricType ?? 'gauge', unit: names.find(item => item.metricName === name)?.unit, value: 42, createdAt: now },
      ];
      data = path.endsWith('/query') ? mockMetricQuery(points, url.searchParams) : points;
    } else if (path.endsWith('/quantiles')) {
      const scoped = state.points.has(name ?? '') ? filterMetricPoints(state.points.get(name ?? '')!, url.searchParams) : null;
      data = scoped?.length === 0 || url.searchParams.get('series') === '[]' ? null : { metricName: name, count: scoped?.length ?? 20, p50: 0.1, p95: 0.3, p99: 0.5 };
    }
    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}
