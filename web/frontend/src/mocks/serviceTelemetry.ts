import { filterMetricPoints } from './metricQuery';
import type {
  ApiRequest, LogEntry, OtelHistogramQuantiles, OtelMetricName, OtelMetricPoint,
  TraceDetail, TraceSummary,
} from '../services/api';

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

// Each service has its own operations, log vocabulary and metric series.
const profiles: Record<string, { routes: string[]; operation: string; dependency: string; latency: number }> = {
  api: { routes: ['/api/v1/auth/login', '/api/v1/users/:id', '/api/v1/products'], operation: 'HTTP request completed', dependency: 'auth.internal', latency: 42 },
  postgres: { routes: [], operation: 'Checkpoint completed', dependency: 'replica-02', latency: 5 },
  'payment-worker': { routes: [], operation: 'Payment processed successfully', dependency: 'payments.partner.io', latency: 480 },
  'checkout-api': { routes: ['/checkout/sessions', '/checkout/cart/:id', '/checkout/confirm'], operation: 'Checkout session created', dependency: 'auth.internal', latency: 128 },
  'payments-api': { routes: ['/v1/payments', '/v1/refunds', '/v1/payments/:id'], operation: 'Payment authorization completed', dependency: 'payments.partner.io', latency: 214 },
  'orders-api': { routes: ['/v1/orders', '/v1/orders/:id', '/v1/orders/:id/cancel'], operation: 'Order reservation completed', dependency: 'inventory.internal', latency: 86 },
  'inventory-api': { routes: ['/v1/inventory/:id', '/v1/reservations', '/v1/stock/reconcile'], operation: 'Stock reservation committed', dependency: 'inventory-db', latency: 32 },
  'search-api': { routes: ['/v1/search', '/v1/suggestions', '/v1/indexes/:id'], operation: 'Search query served', dependency: 'opensearch:9200', latency: 67 },
  'catalog-worker': { routes: [], operation: 'Product catalog batch indexed', dependency: 'catalog-db', latency: 320 },
  'notification-worker': { routes: [], operation: 'Notification delivered', dependency: 'smtp.example.com', latency: 75 },
  'billing-worker': { routes: [], operation: 'Invoice reconciliation completed', dependency: 'billing-db', latency: 640 },
  redis: { routes: [], operation: 'Cache snapshot saved', dependency: 'redis-replica', latency: 3 },
  nginx: { routes: ['/health', '/assets/app.js', '/'], operation: 'Edge request forwarded', dependency: 'upstream-api', latency: 12 },
};

export interface DemoTelemetry {
  logs: LogEntry[];
  requests: ApiRequest[];
  traces: TraceDetail[];
  metricNames: OtelMetricName[];
  metricPoints: Record<string, OtelMetricPoint[]>;
}

export function createServiceTelemetry(
  serviceId: string,
  serviceName: string,
  index: number,
  agentId?: string,
  seedLogs: LogEntry[] = [],
  seedRequests: ApiRequest[] = [],
  seedTraces: TraceDetail[] = [],
): DemoTelemetry {
  const profile = profiles[serviceName];
  const baseId = (index + 1) * 10_000;
  const scope = { serviceId, serviceName, agentId };
  const requests: ApiRequest[] = seedRequests.map(row => ({ ...row, ...scope }));
  const traces: TraceDetail[] = seedTraces.map(trace => ({
    ...trace,
    spans: trace.spans.map(span => ({ ...span, serviceId, serviceName })),
    logs: [], apiRequests: [],
  }));
  for (let i = 0; i < 8; i += 1) {
    const traceId = (baseId + i).toString(16).padStart(32, '0');
    const spanId = (baseId + i).toString(16).padStart(16, '0');
    const failed = i === 2 || i === 6;
    const duration = failed ? profile.latency * 12 : profile.latency + i * 7;
    const route = profile.routes[i % profile.routes.length];
    const createdAt = ago(2 + i * 3);
    const start = new Date(createdAt).getTime() * 1_000_000;
    const name = route ? `POST ${route}` : `${serviceName}.process`;
    const request: ApiRequest | undefined = route ? {
      ...scope, id: baseId + i, requestId: `${serviceId}-${i}`, method: 'POST',
      path: route.replace(':id', String(4200 + i)), pathTemplate: route,
      statusCode: failed ? 503 : 200, durationMs: duration, isError: failed,
      error: failed ? `${profile.dependency} deadline exceeded` : undefined,
      traceId, spanId, clientIp: `10.42.${index}.${10 + i}`, createdAt,
    } : undefined;
    if (request) requests.push(request);
    traces.push({
      traceId, logs: [], apiRequests: request ? [request] : [],
      spans: [
        {
          id: baseId + i * 4, serviceId, serviceName, traceId, spanId,
          name, kind: route ? 'SERVER' : 'CONSUMER',
          startUnixNano: start, endUnixNano: start + duration * 1_000_000, durationMs: duration,
          statusCode: failed ? 'ERROR' : 'OK', createdAt,
          attributes: route ? { 'http.request.method': 'POST', 'http.route': route, 'http.response.status_code': failed ? 503 : 200 } : { 'messaging.system': 'kafka', 'messaging.destination.name': serviceName },
          resource: { 'service.name': serviceName, 'deployment.environment': 'demo' },
        },
        ...['SELECT records', 'cache.lookup', profile.dependency].map((operation, child) => ({
          id: baseId + i * 4 + child + 1, serviceId, serviceName, traceId,
          spanId: (baseId + i * 4 + child + 100).toString(16).padStart(16, '0'), parentSpanId: spanId,
          name: operation, kind: 'CLIENT', startUnixNano: start + (child + 1) * 1_000_000,
          endUnixNano: start + Math.round(duration * (child + 1) / 4) * 1_000_000,
          durationMs: Math.max(1, Math.round(duration * (child + 1) / 4) - child - 1),
          statusCode: failed && child === 2 ? 'ERROR' : 'OK',
          statusMessage: failed && child === 2 ? 'upstream deadline exceeded' : undefined,
          attributes: child === 0 ? { 'db.system': 'postgresql', 'db.operation': 'SELECT' } : { 'server.address': child === 1 ? 'redis' : profile.dependency },
          createdAt,
        })),
      ],
    });
  }
  for (let i = 0; profile.routes.length && i < 64; i += 1) {
    const route = profile.routes[i % profile.routes.length];
    const statusCode = i % 17 === 0 ? 500 : i % 11 === 0 ? 422 : 200;
    requests.push({
      ...scope, id: baseId + 100 + i, requestId: `${serviceId}-request-${i}`, method: i % 3 ? 'GET' : 'POST',
      path: route.replace(':id', String(8000 + i)), pathTemplate: route, statusCode,
      durationMs: statusCode === 500 ? profile.latency * 8 : profile.latency + (i % 9) * 6,
      isError: statusCode >= 500, error: statusCode === 500 ? `${profile.dependency} unavailable` : undefined,
      createdAt: ago(30 + i * 4),
    });
  }
  const logs: LogEntry[] = seedLogs.map(log => ({ ...log, ...scope }));
  for (let i = 0; i < 144; i += 1) {
    const trace = traces[seedTraces.length + i % 8];
    const level = i % 19 === 0 ? 'error' : i % 13 === 0 ? 'warn' : 'info';
    const message = level === 'error' ? `${serviceName}: ${profile.dependency} deadline exceeded after ${profile.latency * 12}ms`
      : level === 'warn' ? `${serviceName}: retry queue above threshold — ${20 + i} pending jobs`
        : `${profile.operation} — batch ${1000 + i}`;
    logs.push({
      ...scope, id: baseId + 1000 + i, level, message, source: 'otlp',
      traceId: i < 8 ? trace.traceId : undefined, spanId: i < 8 ? trace.spans[0].spanId : undefined,
      metadata: { attributes: { 'service.name': serviceName, 'deployment.environment': 'demo', 'server.address': profile.dependency, 'batch.id': 1000 + i } },
      createdAt: i < 8 ? trace.spans[0].createdAt : ago(1 + i * 9),
    });
  }
  logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const trace of traces) {
    trace.logs = logs.filter(log => log.traceId === trace.traceId);
    trace.apiRequests = requests.filter(request => request.traceId === trace.traceId);
  }
  const metricNames: OtelMetricName[] = serviceName === 'catalog-worker' ? [
    { metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', lastAt: ago(0.3) },
    { metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: ago(0.3) },
    { metricName: 'http.server.active_requests', metricType: 'sum', unit: '1', lastAt: ago(0.3) },
  ] : [
    { metricName: profile.routes.length ? 'http.server.request.duration' : 'messaging.process.duration', metricType: 'histogram', unit: 's', lastAt: ago(0.3) },
    { metricName: profile.routes.length ? 'process.memory.usage' : 'queue.messages.pending', metricType: 'gauge', unit: profile.routes.length ? 'By' : '1', lastAt: ago(0.3) },
  ];
  if (serviceName === 'billing-worker') metricNames.push({ metricName: 'billing.jobs.completed', metricType: 'sum', unit: '{job}', lastAt: ago(0.3) });
  const metricPoints = Object.fromEntries(metricNames.map(metric => [metric.metricName,
    Array.from({ length: 61 }, (_, i) => {
      const value = metric.unit === 'By' ? (180 + index * 24 + 18 * Math.sin(i / 8)) * 1_048_576
        : metric.metricType === 'histogram' ? profile.latency / 1000 * (1 + Math.sin(i / 7) * 0.3)
          : metric.metricName === 'billing.jobs.completed' ? 1000 + i * 20
            : Math.max(1, Math.round(12 + index * 3 + Math.sin(i / 6) * 8));
      const operations = metric.metricType === 'histogram' ? (profile.routes.length ? profile.routes.slice(0, 2) : ['batch.process', 'batch.commit']) : metric.metricName === 'billing.jobs.completed' ? Array.from({ length: 8 }, (_, host) => `worker-${host + 1}`) : [''];
      return operations.map((operation, series) => ({ id: baseId + i * 2 + series, metricName: metric.metricName, metricType: metric.metricType, unit: metric.unit, ...(metric.metricName === 'billing.jobs.completed' ? { temporality: 2, isMonotonic: true, startTimeUnixNano: (now - 120 * 60_000) * 1_000_000 } : {}), attributes: operation ? { 'operation.name': operation } : {}, value: value * (1 + series * 0.4), count: metric.metricType === 'histogram' ? 20 : undefined, total: metric.metricType === 'histogram' ? value * (1 + series * 0.4) * 20 : undefined, createdAt: ago(60 - i) }));
    }).flat(),
  ]));
  return { logs, requests, traces, metricNames, metricPoints };
}

export function telemetryTraces(data: DemoTelemetry): TraceSummary[] {
  return data.traces.map(trace => {
    const root = trace.spans[0];
    return { traceId: trace.traceId, name: root.name, kind: root.kind, serviceName: root.serviceName, startTime: root.createdAt, durationMs: root.durationMs, spanCount: trace.spans.length, errorCount: trace.spans.filter(span => span.statusCode === 'ERROR').length };
  });
}

export function telemetryQuantiles(data: DemoTelemetry, name: string, query = new URLSearchParams()): OtelHistogramQuantiles | null {
  const metric = data.metricNames.find(row => row.metricName === name);
  if (metric?.metricType !== 'histogram') return null;
  // Demo histograms represent 20 known observations per point, with a mean
  // equal to the displayed point. Filtering must also filter the distribution.
  const points = filterMetricPoints(data.metricPoints[name] ?? [], query);
  const values = points.flatMap(point => [point.value * 0.5, ...Array<number>(18).fill(point.value), point.value * 1.5]).sort((a, b) => a - b);
  if (!values.length) return null;
  const percentile = (p: number) => values[Math.max(0, Math.ceil(values.length * p) - 1)];
  return {
    metricName: name, unit: metric.unit, count: values.length,
    p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99),
  };
}
