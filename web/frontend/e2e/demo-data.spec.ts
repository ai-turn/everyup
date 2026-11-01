import { expect, test } from '@playwright/test';
import { mockRouter } from '../src/services/mockRouter';
import type {
  ApiRequest, ApiRequestStats, ApiRequestStatusSummary, InfrastructureResource, LogEntry, LogPattern,
  LogServiceSummary, NotificationHistoryResponse, ObservedService, OtelHistogramQuantiles,
  OtelMetricName, Project, TraceDetail, TraceSummary, UptimeMonitor, UptimeMonitorMetric,
} from '../src/services/api';

test('demo telemetry stays inside its service and summaries match the rows', () => {
  const services = mockRouter<ObservedService[]>('/observed-services');
  const summaries = mockRouter<LogServiceSummary[]>('/logs/summary');
  const patterns = mockRouter<LogPattern[]>('/logs/patterns');
  const allTraceIds = new Set<string>();
  for (const service of services) {
    const base = `/observed-services/${service.id}`;
    const logs = mockRouter<{ data: LogEntry[]; total: number }>(`${base}/logs?limit=1000`).data;
    expect(logs.every(log => log.serviceId === service.id && log.serviceName === service.name)).toBe(true);
    expect(new Set(logs.map(log => log.id)).size).toBe(logs.length);
    if (service.signals.includes('logs')) {
      const summary = summaries.find(row => row.serviceId === service.id)!;
      expect(summary.error).toBe(logs.filter(log => log.level === 'error').length);
      for (const pattern of patterns.filter(row => row.serviceId === service.id)) {
        const matched = mockRouter<{ total: number }>(`${base}/logs?fingerprint=${encodeURIComponent(pattern.fingerprint)}`);
        expect(matched.total).toBe(pattern.count);
      }
    }
    const requests = mockRouter<{ data: ApiRequest[]; total: number }>(`${base}/requests?limit=1000`);
    const status = mockRouter<ApiRequestStatusSummary>(`${base}/request-status-summary`);
    expect(status.count2xx + status.count3xx + status.count4xx + status.count5xx + status.countOther).toBe(requests.total);
    const stats = mockRouter<ApiRequestStats>(`${base}/request-stats`);
    expect(stats.truncated).toBe(false);
    expect(stats.buckets.reduce((count, bucket) => count + bucket.count, 0)).toBe(requests.total);
    expect(stats.buckets.reduce((count, bucket) => count + bucket.errorCount, 0)).toBe(requests.data.filter(row => row.isError).length);
    const traces = mockRouter<TraceSummary[]>(`${base}/traces`);
    for (const row of traces) {
      expect(allTraceIds.has(row.traceId)).toBe(false);
      allTraceIds.add(row.traceId);
      const trace = mockRouter<TraceDetail>(`/traces/${row.traceId}`);
      expect(trace.spans).toHaveLength(row.spanCount);
      expect(trace.spans.every(span => span.serviceId === service.id && span.serviceName === service.name)).toBe(true);
      expect(trace.logs.every(log => log.serviceId === service.id)).toBe(true);
      expect(trace.apiRequests.every(request => request.serviceId === service.id)).toBe(true);
      for (const log of trace.logs) expect(trace.spans.some(span => span.spanId === log.spanId)).toBe(true);
    }
    for (const metric of mockRouter<OtelMetricName[]>(`${base}/otel-metrics`)) {
      const quantiles = mockRouter<OtelHistogramQuantiles | null>(`${base}/otel-metrics/quantiles?name=${metric.metricName}`);
      if (metric.metricType !== 'histogram') expect(quantiles).toBeNull();
      else {
        expect(quantiles!.p99).toBeGreaterThanOrEqual(quantiles!.p95);
        for (const exemplar of quantiles!.exemplars ?? []) expect(traces.some(trace => trace.traceId === exemplar.traceId)).toBe(true);
      }
    }
  }
  const orders = '/observed-services/observed_mock_orders/requests';
  const first = mockRouter<{ data: ApiRequest[] }>(`${orders}?limit=25`);
  const next = mockRouter<{ data: ApiRequest[] }>(`${orders}?limit=25&offset=25`);
  expect(next.data).toHaveLength(25);
  expect(next.data.every(row => !first.data.some(other => other.id === row.id))).toBe(true);
  const errors = mockRouter<{ data: ApiRequest[] }>(`${orders}?errorsOnly=true`);
  expect(errors.data.length).toBeGreaterThan(0);
  expect(errors.data.every(row => row.isError)).toBe(true);
  expect(mockRouter<{ total: number }>(`${orders}?search=checkout`).total).toBe(0);
});

test('demo group membership, monitor details and infrastructure values agree', () => {
  const projects = mockRouter<Project[]>('/projects');
  const monitors = mockRouter<UptimeMonitor[]>('/services?type=http,tcp');
  const services = mockRouter<ObservedService[]>('/observed-services');
  const infrastructure = mockRouter<InfrastructureResource[]>('/infrastructure-resources').filter(row => row.adapter === 'otel-collector');
  for (const project of projects) {
    expect(project.monitorCount).toBe(monitors.filter(row => row.projectId === project.id).length);
    expect(project.observedServiceCount).toBe(services.filter(row => row.projectId === project.id).length);
    expect(project.infrastructureResourceCount).toBe(infrastructure.filter(row => row.projectId === project.id).length);
  }
  for (const monitor of monitors.filter(row => row.isActive)) {
    const metrics = mockRouter<UptimeMonitorMetric[]>(`/services/${monitor.id}/metrics`);
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every(row => row.serviceId === monitor.id)).toBe(true);
    const history = mockRouter<{ time: string; total: number }[]>(`/services/${monitor.id}/metrics/history?range=6h`);
    expect(history.length).toBeGreaterThan(0);
    expect(history.every(row => row.time && row.total > 0)).toBe(true);
  }
  for (const resource of infrastructure) {
    const info = mockRouter<{ cpu: { usage: number }; memory: { usage: number }; disk: { usage: number } }>(`/hosts/${resource.id}/system/info`);
    expect(info.cpu.usage).toBe(resource.cpuUsage);
    expect(info.memory.usage).toBe(resource.memoryUsage);
    expect(info.disk.usage).toBe(resource.diskUsage);
  }
  const first = mockRouter<NotificationHistoryResponse>('/notification-history?limit=25');
  const second = mockRouter<NotificationHistoryResponse>('/notification-history?limit=25&offset=25');
  expect(first.items.length + second.items.length).toBe(first.total);
  expect(second.items.every(row => !first.items.some(other => other.id === row.id))).toBe(true);
});

test('visitor can explore the added groups and service-specific telemetry', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./projects/project_mock_backoffice');
  await expect(page.getByRole('heading', { level: 1, name: 'Backoffice' })).toBeVisible();
  await expect(page.getByRole('link', { name: /notification-worker/ })).toBeVisible();
  await page.goto('./logs/observed_mock_orders');
  await expect(page.getByRole('heading', { level: 1, name: 'orders-api' })).toBeVisible();
  await expect(page.getByText('orders-api: inventory.internal deadline exceeded after 1032ms', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Checkout session created', { exact: false })).toHaveCount(0);
  await page.goto('./api/observed_mock_inventory');
  await expect(page.getByRole('heading', { level: 1, name: 'inventory-api' })).toBeVisible();
  await expect(page.getByRole('button', { name: /POST 200 \/v1\/inventory\/4200/ })).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByText('72건 중 26~50', { exact: true })).toBeVisible();
  await page.goto('./uptime/uptime_mock_docs');
  await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible();
  expect(errors).toEqual([]);
});
