import type { Page } from '@playwright/test';
import type { AgentServiceFlat, UptimeMonitor, UptimeMonitorHistory, UptimeMonitorInput, UptimeMonitorMetric, UptimeMonitorSummary } from '../../src/services/api';

export function monitor(id = 'http-monitor', changes: Partial<UptimeMonitor> = {}): UptimeMonitor {
  return { id, name: 'Public API', type: 'http', isActive: true, url: 'https://api.example.com/health', method: 'GET', expectedStatus: 200, timeout: 5000, interval: 30, status: 'healthy', lastCheckAt: new Date().toISOString(), ...changes };
}

export function dockerService(changes: Partial<AgentServiceFlat> = {}): AgentServiceFlat {
  return { agentId: 'docker-host', agentName: 'Production Docker', key: 'shop:api', name: 'Docker API', checkType: 'http', endpoint: 'http://docker-api:8080/health', healthy: true, seen: true, silenced: false, observedAt: new Date().toISOString(), ...changes };
}

export function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

export async function uptimeFixture(page: Page) {
  const now = Date.now();
  const state = {
    monitors: [monitor(), monitor('tcp-monitor', { name: 'Database', type: 'tcp', url: 'db.example.com', port: 5432 })],
    services: [dockerService()],
    metrics: [
      { id: 2, serviceId: 'http-monitor', status: 'failure', responseTime: 5000, errorMessage: 'Connection timed out', checkedAt: new Date(now - 60_000).toISOString() },
      { id: 1, serviceId: 'http-monitor', status: 'success', responseTime: 120, statusCode: 200, checkedAt: new Date(now - 120_000).toISOString() },
    ] satisfies UptimeMonitorMetric[],
    summary: { serviceId: 'http-monitor', totalChecks: 2, successfulChecks: 1, failedChecks: 1, uptime: 50, avgResponseTime: 120, minResponseTime: 120, maxResponseTime: 120 } as UptimeMonitorSummary | null,
    history: { percentage: 99.5, days: [{ date: new Date(now).toLocaleDateString('sv-SE'), status: 'up', uptime: 100 }, { date: new Date(now - 86_400_000).toLocaleDateString('sv-SE'), status: 'partial', uptime: 99 }] } satisfies UptimeMonitorHistory,
    failures: new Map<string, number>(),
    holds: new Map<string, Promise<void>>(),
    responses: new Map<string, unknown>(),
    requests: [] as { method: string; path: string; query: string; body: UptimeMonitorInput | null }[],
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = request.method();
    const key = `${method} ${path}`;
    const body = request.postData() ? request.postDataJSON() as UptimeMonitorInput : null;
    state.requests.push({ method, path, query: url.search, body });
    await state.holds.get(key);
    const status = state.failures.get(key);
    if (status) {
      await route.fulfill({ status, json: { success: false, error: { code: status === 404 ? 'SERVICE_NOT_FOUND' : 'DATABASE_ERROR', message: 'Fixture request failed' } } });
      return;
    }
    if (state.responses.has(key)) {
      await route.fulfill({ json: { success: true, data: state.responses.get(key) } });
      return;
    }
    let data: unknown = [];
    if (method === 'POST' && path === '/services' && body) {
      const created = monitor(`created-${state.monitors.length}`, { ...body, url: body.url ?? body.host ?? '', status: 'unknown' });
      state.monitors.push(created);
      data = created;
    } else if (method === 'PUT' && body) {
      state.monitors = state.monitors.map((item) => path === `/services/${item.id}` ? { ...item, ...body, url: body.url ?? body.host ?? item.url, status: body.isActive === false ? 'unknown' : item.status } : item);
      data = state.monitors.find((item) => path === `/services/${item.id}`);
    } else if (method === 'DELETE') {
      state.monitors = state.monitors.filter((item) => path !== `/services/${item.id}`);
      await route.fulfill({ status: 204 });
      return;
    } else if (path === '/agents/services/all') data = state.services;
    else if (path === '/services') data = state.monitors;
    else if (/^\/services\/[^/]+\/metrics\/summary$/.test(path)) data = state.summary;
    else if (/^\/services\/[^/]+\/metrics$/.test(path)) data = state.metrics;
    else if (/^\/services\/[^/]+\/uptime$/.test(path)) data = state.history;
    else if (/^\/services\/[^/]+$/.test(path)) {
      data = state.monitors.find((item) => path === `/services/${item.id}`);
      if (!data) {
        await route.fulfill({ status: 404, json: { success: false, error: { code: 'SERVICE_NOT_FOUND' } } });
        return;
      }
    } else if (path === '/agents') data = [{ id: 'docker-host', name: 'Production Docker', lastSeenAt: new Date().toISOString() }];
    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}
