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
    service, names,
    failures: new Set<string>(),
    requests: [] as string[],
    reads: [] as { path: string; name: string | null; from: string | null; to: string | null }[],
    points: new Map<string, OtelMetricPoint[]>(),
    holdNames: null as Promise<void> | null,
  };
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const name = url.searchParams.get('name');
    state.requests.push(path);
    state.reads.push({ path, name, from: url.searchParams.get('from'), to: url.searchParams.get('to') });
    const key = path.endsWith('/points') ? `points:${name}` : path;
    if (state.failures.has(key)) {
      await route.fulfill({ status: 500, json: { success: false, error: { code: 'DATABASE_ERROR' } } });
      return;
    }
    let data: unknown = [];
    if (path === '/observed-services') data = [service, { ...service, id: 'waiting-service', name: 'waiting-worker' }];
    else if (path === '/observed-services/metric-catalog') data = catalog;
    else if (path === `/observed-services/${service.id}`) data = service;
    else if (path === `/observed-services/${service.id}/otel-metrics`) {
      await state.holdNames;
      data = names;
    } else if (path.endsWith('/points')) data = state.points.get(name ?? '') ?? [
      { id: 1, metricName: name, metricType: 'gauge', value: 0, createdAt: new Date(Date.now() - 60_000).toISOString() },
      { id: 2, metricName: name, metricType: 'gauge', value: 42, createdAt: now },
    ];
    else if (path.endsWith('/quantiles')) data = { metricName: name, count: 20, p50: 0.1, p95: 0.3, p99: 0.5 };
    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}
