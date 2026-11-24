import { mockMetricQuery, filterMetricPoints } from '../../src/mocks/metricQuery';
import type { Page } from '@playwright/test';
import type { ObservedService, ObservedServiceMetricName, OtelMetricName, OtelMetricPoint, Server } from '../../src/services/api';

export async function metricsFixture(page: Page) {
  const now = new Date().toISOString();
  const service: ObservedService = {
    id: 'metrics-service', name: 'billing-api', serverId: 'server-1', signals: ['metrics'], isActive: true,
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
    // 서버 화면은 이 서버의 메트릭 탭(/servers/server-1/metrics)에서 앱을 보여 준다.
    server: { id: 'server-1', name: 'web-01', createdAt: now, updatedAt: now } as Server,
    service, names, catalog,
    /** 서버 화면의 메트릭 탭에 함께 있는 두 번째 앱 */
    waiting: { ...service, id: 'waiting-service', name: 'waiting-worker' } as ObservedService,
    failures: new Set<string>(),
    requests: [] as string[],
    reads: [] as { path: string; name: string | null; from: string | null; to: string | null; attributes: string | null; series: string | null }[],
    points: new Map<string, OtelMetricPoint[]>(),
    holdNames: null as Promise<void> | null,
    /** 아래 분기 어디에도 걸리지 않아 기본값([])으로 응답한 요청. 서버 화면이 부르는 API를 빠짐없이 처리하는지 확인할 때 본다. */
    unhandled: [] as string[],
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
    if (path === '/servers') data = [state.server];
    else if (path === `/servers/${state.server.id}`) data = state.server;
    // 서버 화면이 서버 데이터와 함께 불러오는 다른 대상들. 이 fixture의 서버에는 모니터, 인프라, 로그가 없다.
    else if (['/services', '/infrastructure-resources', '/logs/summary', '/alert-rules', '/agents/services/all', '/agents'].includes(path)) data = [];
    else if (path === '/observed-services') data = [state.service, state.waiting];
    else if (path === '/observed-services/metric-catalog') data = catalog;
    else if (path === `/observed-services/${service.id}`) data = state.service;
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
    } else state.unhandled.push(`${route.request().method()} ${path}`);
    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}
