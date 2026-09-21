/**
 * Mock router for demo mode.
 * Maps API endpoint patterns to mock data so ALL api.* calls (including direct
 * calls that bypass useDataFetch) return plausible data in demo/mock mode.
 */

import { mockLogEntries as allMockLogs, mockTraceIds } from '../mocks/logs/logs.mock';
import { mockGauges } from '../mocks/infra/resources.mock';
import { mockChannels } from '../mocks/alerts/channels.mock';
import { getDemoScenario, type MockScenario } from '../mocks/demoScenario';

import type {
  LogEntry,
  SystemInfo,
  SystemMetricsHistory,
  AlertRule,
  NotificationHistoryResponse,
  NotificationStats,
  AppSettings,
  ApiRequest,
  TraceDetail,
  TraceSummary,
  ConnectedAgent,
  AgentServiceFlat,
  AgentEvent,
  ServiceHistoryPoint,
  ServiceUptimeDay,
  AgentIncident,
  AgentOverview,
  AgentProfile,
  AgentCollectionCapability,
  OtelServiceMetric,
  UptimeMonitor,
  UptimeMonitorInput,
  UptimeMonitorMetric,
  UptimeMonitorSummary,
  UptimeMonitorHistory,
  Project,
  ObservedService,
  ObservedServiceInput,
  ObservedServiceSetup,
  InfrastructureResource,
  InfrastructureResourceInput,
  InfrastructureResourceSetup,
  TimelineIncident,
} from './api';

// ?? Notifications ?????????????????????????????????????????????????????????????

// ?? System Resource Monitoring ????????????????????????????????????????????????

const mockSystemInfo: SystemInfo = {
  hostname: 'prod-server-01',
  os: 'Ubuntu 22.04 LTS',
  platform: 'linux',
  kernel: '5.15.0-92-generic',
  uptime: 1_234_567,
  ip: '192.168.1.50',
  cpu: { cores: 8, usage: mockGauges[0]?.percentage ?? 42 },
  memory: { total: 16, used: 9.6, usage: mockGauges[1]?.percentage ?? 60 },
  disk: { total: 500, used: 210, usage: mockGauges[2]?.percentage ?? 42, readSpeed: 120, writeSpeed: 80 },
  network: { in: 3.2, out: 1.4 },
};

const mockSystemMetrics: SystemMetricsHistory = {
  range: '6h',
  points: Array.from({ length: 72 }, (_, i) => ({
    timestamp: new Date(Date.now() - (71 - i) * 5 * 60_000).toISOString(),
    cpu: 30 + Math.sin(i / 8) * 20 + Math.random() * 5,
    memUsed: 55 + Math.cos(i / 10) * 10 + Math.random() * 3,
    memCached: 10 + Math.random() * 5,
    diskRead: 50 + Math.random() * 100,
    diskWrite: 30 + Math.random() * 80,
    netIn: 8 + Math.random() * 20,
    netOut: 4 + Math.random() * 16,
  })),
};

// ?? Alert Rules ???????????????????????????????????????????????????????????????

const mockAlertRules: AlertRule[] = [
  {
    id: 'direct-infra-cpu',
    name: 'Edge Collector CPU',
    type: 'resource',
    agentId: 'infra_mock_edge_01',
    metric: 'cpu',
    operator: 'gt',
    threshold: 80,
    duration: 5,
    severity: 'warning',
    isEnabled: true,
    isSystem: false,
    cooldown: 600,
    channelIds: ['1'],
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
  },
  {
    id: '1',
    name: 'High CPU Usage',
    type: 'resource',
    agentId: 'agent_prod-db-01',
    metric: 'cpu',
    operator: 'gt',
    threshold: 85,
    duration: 5,
    severity: 'warning',
    isEnabled: true,
    isSystem: false,
    cooldown: 600,
    channelIds: ['1'],
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: '2',
    name: 'Service Down',
    type: 'service',
    agentId: 'agent_123',
    serviceKey: 'api',
    metric: 'status_change',
    operator: 'eq',
    threshold: 0,
    duration: 60,
    severity: 'critical',
    isEnabled: true,
    isSystem: true,
    cooldown: 300,
    channelIds: ['1', '2', '3'],
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: '3',
    name: 'Memory Pressure',
    type: 'resource',
    agentId: 'agent_worker-node-01',
    metric: 'memory',
    operator: 'gt',
    threshold: 90,
    duration: 3,
    severity: 'critical',
    isEnabled: true,
    isSystem: false,
    cooldown: 600,
    channelIds: ['2'],
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
];

// ?? Notification History ??????????????????????????????????????????????????????

const mockNotificationHistory: NotificationHistoryResponse = {
  items: [
    {
      id: 1,
      channelId: '1',
      channelName: 'Ops Telegram',
      channelType: 'telegram',
      alertType: 'resource',
      severity: 'warning',
      hostId: 'prod-db-01',
      hostName: 'Production-DB-01',
      message: 'CPU usage exceeded 85% for 5 minutes',
      status: 'sent',
      retryCount: 0,
      createdAt: new Date(Date.now() - 1 * 3600_000).toISOString(),
      sentAt: new Date(Date.now() - 1 * 3600_000 + 500).toISOString(),
    },
    {
      id: 2,
      channelId: '2',
      channelName: '#alerts Discord',
      channelType: 'discord',
      alertType: 'healthcheck',
      severity: 'critical',
      serviceId: '2',
      serviceName: 'Auth Service',
      message: 'Auth Service transitioned to Degraded',
      status: 'sent',
      retryCount: 0,
      createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
      sentAt: new Date(Date.now() - 3 * 3600_000 + 800).toISOString(),
    },
    {
      id: 3,
      channelId: '1',
      channelName: 'Ops Telegram',
      channelType: 'telegram',
      alertType: 'resource',
      severity: 'critical',
      hostId: 'worker-node-01',
      hostName: 'Worker-Node-01',
      message: 'Memory usage exceeded 90%',
      status: 'failed',
      errorMessage: 'Telegram API timeout',
      retryCount: 3,
      createdAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
    },
    {
      id: 4,
      channelId: '3',
      channelName: '#incidents Slack',
      channelType: 'slack',
      alertType: 'endpoint',
      severity: 'warning',
      serviceId: '1',
      serviceName: 'API Gateway',
      message: 'Response time exceeded 2000ms threshold',
      status: 'sent',
      retryCount: 0,
      createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      sentAt: new Date(Date.now() - 2 * 3600_000 + 600).toISOString(),
    },
  ],
  total: 4,
  limit: 50,
  offset: 0,
};

const mockNotificationStats: NotificationStats = {
  totalSent: 178,
  totalFailed: 9,
  successRate: 95.2,
  byChannel: { 'Ops Telegram': 89, '#alerts Discord': 53, '#incidents Slack': 36 },
  byAlertType: { resource: 76, healthcheck: 54, endpoint: 36, log: 12 },
};

// ?? API Requests ??????????????????????????????????????????????????????????????

const now2 = Date.now();
const s = (secondsAgo: number) => new Date(now2 - secondsAgo * 1000).toISOString();

const mockApiRequests: ApiRequest[] = [
  { id: 1, serviceId: '1', requestId: '01HV8QZXKAB1', method: 'POST',   path: '/api/v1/auth/login',        pathTemplate: '/api/v1/auth/login',        statusCode: 200, durationMs: 42,   clientIp: '10.0.0.5',  isError: false, traceId: mockTraceIds.apiGatewayAuth, spanId: '00f067aa0ba902b7', createdAt: s(30) },
  { id: 2, serviceId: '1', requestId: '01HV8QZXKAC2', method: 'GET',    path: '/api/v1/users/42',          pathTemplate: '/api/v1/users/:id',         statusCode: 200, durationMs: 18,   clientIp: '10.0.0.12', isError: false, createdAt: s(90) },
  { id: 3, serviceId: '1', requestId: '01HV8QZXKAD3', method: 'PUT',    path: '/api/v1/users/7/profile',   pathTemplate: '/api/v1/users/:id/profile', statusCode: 422, durationMs: 35,   clientIp: '10.0.0.7',  isError: false, createdAt: s(200) },
  { id: 4, serviceId: '1', requestId: '01HV8QZXKAE4', method: 'DELETE', path: '/api/v1/orders/1a2b3c4d',  pathTemplate: '/api/v1/orders/:id',        statusCode: 500, durationMs: 312,  clientIp: '10.0.0.3',  isError: true,  error: 'deadlock detected', createdAt: s(400) },
  { id: 5, serviceId: '1', requestId: '01HV8QZXKAF5', method: 'GET',    path: '/api/v1/products',         pathTemplate: '/api/v1/products',          statusCode: 200, durationMs: 67,   clientIp: '10.0.0.9',  isError: false, createdAt: s(600) },
  { id: 6, serviceId: '5', requestId: '01HV8QZXKAG6', method: 'POST',   path: '/api/v1/payments',         pathTemplate: '/api/v1/payments',          statusCode: 503, durationMs: 5001, clientIp: '10.0.0.15', isError: true,  error: 'payment gateway timeout', traceId: mockTraceIds.paymentWebhook, spanId: '7ad6b7169203331b', createdAt: s(900) },
];

const ns = (secondsAgo: number, offsetMs = 0) => (now2 - secondsAgo * 1000 + offsetMs) * 1_000_000;

const consumerTraceId = 'c0f5ea71b2d34e8fa91c7d3b5e604a2f';

// The consumer trace carries no HTTP method or status, so the api_requests
// projection drops it; the trace list is the only place it shows up.
const mockTraceSummaries: TraceSummary[] = [
  { traceId: consumerTraceId, name: 'orders.process', kind: 'CONSUMER', serviceName: 'api', startTime: s(45), durationMs: 2480, spanCount: 4, errorCount: 1 },
  { traceId: mockTraceIds.paymentWebhook, name: 'POST /api/v1/payments', kind: 'SERVER', serviceName: 'api', startTime: s(900), durationMs: 5001, spanCount: 3, errorCount: 1 },
  { traceId: mockTraceIds.apiGatewayAuth, name: 'POST /api/v1/auth/login', kind: 'SERVER', serviceName: 'api', startTime: s(30), durationMs: 42, spanCount: 2, errorCount: 1 },
];

function mockTraceList(endpoint: string): TraceSummary[] {
  const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
  let rows = [...mockTraceSummaries];
  if (query.get('errorsOnly') === 'true') rows = rows.filter(row => row.errorCount > 0);
  const minDuration = Number(query.get('minDurationMs') ?? 0);
  if (minDuration > 0) rows = rows.filter(row => row.durationMs >= minDuration);
  rows.sort(query.get('sort') === 'slowest'
    ? (a, b) => b.durationMs - a.durationMs
    : (a, b) => b.startTime.localeCompare(a.startTime));
  return rows;
}

const mockTraceDetails: Record<string, TraceDetail> = {
  [mockTraceIds.apiGatewayAuth]: {
    traceId: mockTraceIds.apiGatewayAuth,
    spans: [
      {
        id: 1,
        serviceId: '1',
        serviceName: 'API Gateway',
        traceId: mockTraceIds.apiGatewayAuth,
        spanId: '00f067aa0ba902b7',
        name: 'POST /api/v1/auth/login',
        kind: 'SERVER',
        startUnixNano: ns(30),
        endUnixNano: ns(30, 42),
        durationMs: 42,
        statusCode: 'OK',
        attributes: {
          'http.request.method': 'POST',
          'url.path': '/api/v1/auth/login',
          'http.response.status_code': 200,
          'http.request.header.content-type': ['application/json'],
          'http.request.header.user-agent': ['Mozilla/5.0 (demo)'],
          'http.request.header.authorization': '***',
          'http.response.header.content-type': ['application/json; charset=utf-8'],
          'http.response.header.set-cookie': '***',
        },
        events: [
          {
            name: 'request_body_masked',
            timeUnixNano: ns(30),
            attributes: { body: '{"username":"alice@example.com","password":"***"}', body_size: 49, body_truncated: false, mask_applied: true },
          },
          {
            name: 'response_body_masked',
            timeUnixNano: ns(30, 42),
            attributes: { body: '{"token":"***","expiresIn":3600,"role":"admin"}', body_size: 47, body_truncated: false, mask_applied: true },
          },
        ],
        resource: { 'service.name': 'api-gateway', 'deployment.environment': 'demo' },
        createdAt: s(30),
      },
      {
        id: 2,
        serviceId: '2',
        serviceName: 'Auth Service',
        traceId: mockTraceIds.apiGatewayAuth,
        spanId: 'b7ad6b7169203331',
        parentSpanId: '00f067aa0ba902b7',
        name: 'POST auth.internal:8080/session',
        kind: 'CLIENT',
        startUnixNano: ns(30, 8),
        endUnixNano: ns(30, 40),
        durationMs: 32,
        statusCode: 'ERROR',
        statusMessage: 'upstream timeout',
        attributes: {
          'server.address': 'auth.internal',
          'server.port': 8080,
          'error.type': 'timeout',
        },
        resource: { 'service.name': 'api-gateway', 'service.version': '1.8.0' },
        createdAt: s(30),
      },
    ],
    logs: allMockLogs.filter((log) => log.traceId === mockTraceIds.apiGatewayAuth),
    apiRequests: mockApiRequests.filter((request) => request.traceId === mockTraceIds.apiGatewayAuth),
  },
  // A Kafka consumer trace: no HTTP method or status anywhere, so nothing here
  // becomes an api_request. It is reachable only through the trace list.
  [consumerTraceId]: {
    traceId: consumerTraceId,
    spans: [
      {
        id: 90, serviceId: '1', serviceName: 'api',
        traceId: consumerTraceId, spanId: 'a1b2c3d4e5f60718',
        name: 'orders.process', kind: 'CONSUMER',
        startUnixNano: ns(45), endUnixNano: ns(45, 2480), durationMs: 2480,
        statusCode: 'OK',
        attributes: { 'messaging.system': 'kafka', 'messaging.destination.name': 'orders', 'messaging.message.body.size': 412 },
        resource: { 'service.name': 'api', 'deployment.environment': 'demo' },
        createdAt: s(45),
      },
      {
        id: 91, serviceId: '1', serviceName: 'api',
        traceId: consumerTraceId, spanId: 'b2c3d4e5f6071829', parentSpanId: 'a1b2c3d4e5f60718',
        name: 'SELECT orders', kind: 'CLIENT',
        startUnixNano: ns(45, 60), endUnixNano: ns(45, 210), durationMs: 150,
        statusCode: 'OK',
        attributes: { 'db.system': 'postgresql', 'db.operation': 'SELECT' },
        createdAt: s(45),
      },
      {
        id: 92, serviceId: '1', serviceName: 'api',
        traceId: consumerTraceId, spanId: 'c3d4e5f607182930', parentSpanId: 'a1b2c3d4e5f60718',
        name: 'inventory.reserve', kind: 'CLIENT',
        startUnixNano: ns(45, 220), endUnixNano: ns(45, 2400), durationMs: 2180,
        statusCode: 'ERROR', statusMessage: 'inventory service deadline exceeded',
        attributes: { 'rpc.system': 'grpc', 'rpc.service': 'Inventory' },
        createdAt: s(45),
      },
      {
        id: 93, serviceId: '1', serviceName: 'api',
        traceId: consumerTraceId, spanId: 'd4e5f60718293041', parentSpanId: 'a1b2c3d4e5f60718',
        name: 'orders.retry.enqueue', kind: 'PRODUCER',
        startUnixNano: ns(45, 2410), endUnixNano: ns(45, 2470), durationMs: 60,
        statusCode: 'OK',
        attributes: { 'messaging.system': 'kafka', 'messaging.destination.name': 'orders.retry' },
        createdAt: s(45),
      },
    ],
    logs: [],
    apiRequests: [],
  },
  [mockTraceIds.paymentWebhook]: {
    traceId: mockTraceIds.paymentWebhook,
    spans: [
      {
        id: 3,
        serviceId: '5',
        serviceName: 'Payment Worker',
        traceId: mockTraceIds.paymentWebhook,
        spanId: '7ad6b7169203331b',
        name: 'POST /api/v1/payments',
        kind: 'SERVER',
        startUnixNano: ns(900),
        endUnixNano: ns(900, 5001),
        durationMs: 5001,
        statusCode: 'ERROR',
        statusMessage: 'payment gateway timeout',
        attributes: {
          'http.request.method': 'POST',
          'url.path': '/api/v1/payments',
          'http.response.status_code': 503,
        },
        events: [
          {
            name: 'request_body_masked',
            timeUnixNano: ns(900),
            attributes: { body: '{"orderId":"ord_1a2b3c","amount":48000,"currency":"KRW","card":"***"}', body_size: 69, body_truncated: false, mask_applied: true },
          },
          {
            name: 'response_body_masked',
            timeUnixNano: ns(900, 5001),
            attributes: { body: '{"error":"upstream_timeout","gateway":"payments.partner.io"}', body_size: 60, body_truncated: false, mask_applied: true },
          },
        ],
        resource: { 'service.name': 'payment-worker', 'deployment.environment': 'demo' },
        createdAt: s(900),
      },
      {
        id: 4,
        serviceId: '5',
        serviceName: 'Payment Worker',
        traceId: mockTraceIds.paymentWebhook,
        spanId: 'c4da95f66b729f70',
        parentSpanId: '7ad6b7169203331b',
        name: 'POST payments.partner.io/charge',
        kind: 'CLIENT',
        startUnixNano: ns(900, 15),
        endUnixNano: ns(900, 4990),
        durationMs: 4975,
        statusCode: 'ERROR',
        statusMessage: 'certificate validation failed',
        attributes: {
          'server.address': 'payments.partner.io',
          'error.type': 'tls_certificate',
        },
        resource: { 'service.name': 'payment-worker', 'service.version': '2.4.1' },
        createdAt: s(900),
      },
    ],
    logs: allMockLogs.filter((log) => log.traceId === mockTraceIds.paymentWebhook),
    apiRequests: mockApiRequests.filter((request) => request.traceId === mockTraceIds.paymentWebhook),
  },
};


// ?? Settings ??????????????????????????????????????????????????????????????????

// ?? Agents ???????????????????????????????????????????????????????????????????

const mockAgents: ConnectedAgent[] = [
  {
    id: 'agent_demo_01', name: 'prod-server', version: '0.3.0',
    projectId: 'project_mock_production',
    lastSeenAt: new Date(Date.now() - 15_000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 15_000).toISOString(),
    profile: { kind: 'all-in-one', capabilities: ['uptime', 'logs', 'infrastructure', 'api', 'metrics'] },
    capabilities: {
      checkedAt: new Date(Date.now() - 20_000).toISOString(),
      host: { os: 'linux', arch: 'amd64', kernelVersion: '6.8.0', btf: true, lockdown: 'none' },
      containerMonitoring: { state: 'available' },
      hostMetrics: { state: 'available' },
      automaticTracing: { state: 'available' },
      contextPropagation: { state: 'degraded', reason: 'not_enabled' },
    },
  },
  {
    // Created but never connected — renders as a pending card in the main grid.
    id: 'agent_demo_02', name: 'staging-api',
    lastSeenAt: new Date(Date.now() - 90_000).toISOString(),
    createdAt: new Date(Date.now() - 90_000).toISOString(),
    updatedAt: new Date(Date.now() - 90_000).toISOString(),
    profile: { kind: 'basic', capabilities: ['uptime', 'logs'] },
  },
];

// Home card KPI rollup — mirrors the demo dashboard numbers (99.87% / 2.6K / 121ms).
const mockAgentOverview: AgentOverview[] = [
  { agentId: 'agent_demo_01', uptimePct: 99.87, activeIncidents: 1, requests24h: 2600, p95Ms: 121 },
];

const mockAgentServicesFlat: AgentServiceFlat[] = [
  {
    agentId: 'agent_demo_01', agentName: 'prod-server',
    key: 'shop:api', name: 'api', checkType: 'http', runtime: 'node',
    image: 'ghcr.io/shop/api:2.4.1', restartCount: 0,
    startedAt: new Date(Date.now() - 4 * 86400_000 - 3 * 3600_000).toISOString(),
    endpoint: 'http://api:8080/health', healthy: true, seen: true, silenced: false,
    lastStatus: 200, lastLatency: '42ms',
    updatedAt: new Date(Date.now() - 30_000).toISOString(),
    observedAt: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    agentId: 'agent_demo_01', agentName: 'prod-server',
    key: 'postgres', name: 'postgres', checkType: 'tcp',
    image: 'postgres:16-alpine', restartCount: 0,
    startedAt: new Date(Date.now() - 4 * 86400_000 - 3 * 3600_000).toISOString(),
    endpoint: 'postgres:5432', healthy: true, seen: true, silenced: false,
    lastStatus: 0, lastLatency: '5ms',
    updatedAt: new Date(Date.now() - 30_000).toISOString(),
    observedAt: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    agentId: 'agent_demo_01', agentName: 'prod-server',
    key: 'shop:payment-worker', name: 'payment-worker', checkType: 'http', runtime: 'java',
    image: 'ghcr.io/shop/payment-worker:1.8.3', restartCount: 4,
    startedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    endpoint: 'http://payment-worker:8090/health', healthy: false, seen: true, silenced: false,
    lastStatus: 503, lastLatency: '5001ms', lastError: 'payment gateway timeout',
    updatedAt: new Date(Date.now() - 90_000).toISOString(),
    observedAt: new Date(Date.now() - 90_000).toISOString(),
  },
];

// Representative OTel metric per service (project cards). Keyed by service name.
const mockServiceMetrics: OtelServiceMetric[] = [
  { serviceName: 'postgres', metricName: 'container.memory.usage', metricType: 'gauge', unit: 'By', value: 268_435_456 },
  { serviceName: 'api', metricName: 'container.cpu.utilization', metricType: 'gauge', unit: '1', value: 0.12 },
  { serviceName: 'payment-worker', metricName: 'queue.messages.pending', metricType: 'gauge', unit: '', value: 1843 },
];

const nowAgent = Date.now();

const mockAgentHistory: ServiceHistoryPoint[] = Array.from({ length: 24 }, (_, i) => ({
  time: new Date(nowAgent - (23 - i) * 3_600_000).toISOString(),
  latencyMs: 30 + Math.sin(i / 4) * 15 + Math.random() * 10,
  uptimePct: i === 10 || i === 17 ? 0 : 100,
  total: 12,
}));

const mockAgentUptime: ServiceUptimeDay[] = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(nowAgent - (89 - i) * 86_400_000).toISOString().slice(0, 10),
  uptimePct: i === 42 || i === 77 ? 94 : 100,
  healthyChecks: i === 42 || i === 77 ? 282 : 300,
  totalChecks: 300,
}));

const mockAgentIncidents: AgentIncident[] = [
  {
    key: 'shop:payment-worker', serviceName: 'payment-worker',
    startedAt: new Date(nowAgent - 12 * 60_000).toISOString(),
    durationSec: 12 * 60, active: true,
  },
  {
    key: 'api', serviceName: 'api',
    startedAt: new Date(nowAgent - 3 * 86_400_000).toISOString(),
    endedAt: new Date(nowAgent - 3 * 86_400_000 + 24 * 60_000).toISOString(),
    durationSec: 24 * 60, active: false,
  },
  {
    key: 'postgres', serviceName: 'postgres',
    startedAt: new Date(nowAgent - 8 * 86_400_000).toISOString(),
    endedAt: new Date(nowAgent - 8 * 86_400_000 + 8 * 60_000).toISOString(),
    durationSec: 8 * 60, active: false,
  },
];

const mockAgentEvents: AgentEvent[] = [
  {
    id: 1, agentId: 'agent_demo_01', time: new Date(nowAgent - 2 * 3_600_000).toISOString(),
    type: 'status_change', targetKey: 'payment-worker', serviceName: 'payment-worker',
    message: 'payment-worker became unhealthy: 503 Service Unavailable',
    createdAt: new Date(nowAgent - 2 * 3_600_000).toISOString(),
  },
  {
    id: 2, agentId: 'agent_demo_01', time: new Date(nowAgent - 5 * 3_600_000).toISOString(),
    type: 'status_change', targetKey: 'api', serviceName: 'api',
    message: 'api recovered: 200 OK (42ms)',
    createdAt: new Date(nowAgent - 5 * 3_600_000).toISOString(),
  },
];

// The real handler applies level/search/from server-side; mirror it so demo mode
// responds to the filter bar and the header time range.
function filterMockLogs(rows: LogEntry[], endpoint: string): LogEntry[] {
  const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const level = query.get('level');
  const search = query.get('search')?.toLowerCase();
  const from = query.get('from');
  const attrKey = query.get('attrKey');
  const attrValue = query.get('attrValue') ?? '';
  const traceId = query.get('traceId');
  // A log with no such attribute must drop out, not match on a coerced blank.
  const matchesAttribute = (log: LogEntry) => {
    if (!attrKey) return true;
    const attributes = (log.metadata as { attributes?: Record<string, unknown> } | undefined)?.attributes;
    if (!attributes || !(attrKey in attributes)) return false;
    return String(attributes[attrKey]) === attrValue;
  };
  return rows.filter(log =>
    (!level || log.level === level)
    && (!search || log.message.toLowerCase().includes(search))
    && (!traceId || log.traceId === traceId)
    && matchesAttribute(log)
    && (!from || log.createdAt >= from));
}

const mockAgentServiceLogs: LogEntry[] = [
  { id: 101, serviceId: '', serviceName: 'api', level: 'error', message: 'Connection timeout to upstream: auth.internal:8080 after 5000ms', source: 'otlp', traceId: mockTraceIds.apiGatewayAuth, metadata: { attributes: { 'http.route': '/orders', 'http.status_code': 504, 'deployment.environment': 'prod' } }, createdAt: new Date(nowAgent - 60_000).toISOString() },
  { id: 102, serviceId: '', serviceName: 'api', level: 'warn',  message: 'Rate limit exceeded for client IP 203.0.113.42 — throttling to 10 req/s', source: 'otlp', metadata: { attributes: { 'http.route': '/users/:id', 'http.status_code': 429, 'deployment.environment': 'prod' } }, createdAt: new Date(nowAgent - 180_000).toISOString() },
  { id: 103, serviceId: '', serviceName: 'api', level: 'info',  message: 'Server listening on :8080', source: 'otlp', metadata: { attributes: { 'deployment.environment': 'prod' } }, createdAt: new Date(nowAgent - 600_000).toISOString() },
  { id: 104, serviceId: '', serviceName: 'api', level: 'error', message: 'Payment gateway timeout after 5000ms', source: 'otlp', traceId: mockTraceIds.paymentWebhook, metadata: { attributes: { 'http.route': '/orders', 'http.status_code': 504, 'deployment.environment': 'prod' } }, createdAt: new Date(nowAgent - 720_000).toISOString() },
];

// limit/offset window the real handlers apply; total stays the unpaged count.
function pageMockRows<R>(rows: R[], endpoint: string): { data: R[]; total: number } {
  const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const offset = Number(query.get('offset') ?? 0);
  const limit = Number(query.get('limit') ?? 100);
  return { data: rows.slice(offset, offset + limit), total: rows.length };
}

// Same idea as filterMockLogs — the real handler filters server-side.
function filterMockRequests(rows: ApiRequest[], endpoint: string): ApiRequest[] {
  const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const search = query.get('search')?.toLowerCase();
  const from = query.get('from');
  const errorsOnly = query.get('errorsOnly') === 'true';
  const traceId = query.get('traceId');
  return rows.filter(request =>
    (!errorsOnly || request.statusCode >= 400)
    && (!traceId || request.traceId === traceId)
    && (!search || request.path.toLowerCase().includes(search))
    && (!from || request.createdAt >= from));
}

const mockAgentServiceRequests: ApiRequest[] = [
  { id: 201, serviceId: '', serviceName: 'api', requestId: 'r01', method: 'POST',   path: '/api/v1/auth/login',      pathTemplate: '/api/v1/auth/login',  statusCode: 200, durationMs: 42,  isError: false, traceId: mockTraceIds.apiGatewayAuth, createdAt: new Date(nowAgent - 30_000).toISOString() },
  { id: 202, serviceId: '', serviceName: 'api', requestId: 'r02', method: 'GET',    path: '/api/v1/users/42',        pathTemplate: '/api/v1/users/:id',   statusCode: 200, durationMs: 18,  isError: false, createdAt: new Date(nowAgent - 90_000).toISOString() },
  { id: 203, serviceId: '', serviceName: 'api', requestId: 'r03', method: 'POST',   path: '/api/v1/payments',        pathTemplate: '/api/v1/payments',    statusCode: 503, durationMs: 5001, isError: true,  error: 'payment gateway timeout', traceId: mockTraceIds.paymentWebhook, createdAt: new Date(nowAgent - 400_000).toISOString() },
  { id: 204, serviceId: '', serviceName: 'api', requestId: 'r04', method: 'GET',    path: '/api/v1/products',        pathTemplate: '/api/v1/products',    statusCode: 200, durationMs: 67,  isError: false, createdAt: new Date(nowAgent - 600_000).toISOString() },
];

// 5-minute buckets over the last 6h: rising volume with a latency spike +
// error burst in the middle so the trends chart shows movement.
function mockRequestStats() {
  const buckets = [];
  for (let i = 72; i >= 0; i -= 1) {
    const time = new Date(nowAgent - i * 5 * 60_000).toISOString();
    const spike = i > 30 && i < 40; // a rough patch mid-window
    const count = Math.round(20 + 30 * Math.sin(i / 8) + Math.random() * 10 + (spike ? 25 : 0));
    const errorCount = spike ? Math.round(count * 0.18) : Math.round(count * 0.01 + Math.random());
    const p50 = Math.round(35 + 10 * Math.sin(i / 5) + (spike ? 120 : 0));
    const p95 = Math.round(p50 * 2.3 + (spike ? 300 : 40));
    buckets.push({ time, count, errorCount, p50, p95, timed: count });
  }
  return buckets;
}

// 10-minute buckets over the last 6h: mostly info with a warn/error burst
// mid-window so the logs-tab volume histogram shows movement.
function mockLogHistogram() {
  const buckets = [];
  for (let i = 36; i >= 0; i -= 1) {
    const time = new Date(nowAgent - i * 10 * 60_000).toISOString();
    const burst = i > 14 && i < 20;
    buckets.push({
      time,
      error: burst ? Math.round(4 + Math.random() * 4) : Math.random() < 0.15 ? 1 : 0,
      warn: burst ? Math.round(2 + Math.random() * 3) : Math.random() < 0.3 ? 1 : 0,
      info: Math.round(8 + 6 * Math.sin(i / 6) + Math.random() * 4),
      debug: 0,
      trace: 0,
    });
  }
  return buckets;
}

const mockOtelMetricNames = [
  { metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's',  lastAt: new Date(nowAgent - 30_000).toISOString() },
  { metricName: 'jvm.memory.used',              metricType: 'gauge',     unit: 'By', lastAt: new Date(nowAgent - 30_000).toISOString() },
  { metricName: 'http.server.active_requests',  metricType: 'sum',       unit: '1',  lastAt: new Date(nowAgent - 30_000).toISOString() },
];

// Only the explicit histogram has a recoverable distribution; the gauge and sum
// return null, matching the backend's average-only shapes.
function mockOtelMetricQuantiles(endpoint: string) {
  const name = new URLSearchParams(endpoint.split('?')[1] ?? '').get('name') ?? '';
  if (name !== 'http.server.request.duration') return null;
  // Tail exemplars carry the trace IDs the demo can actually open.
  return {
    metricName: name, unit: 's', count: 2_480, p50: 0.041, p95: 0.312, p99: 0.485,
    exemplars: [
      { traceId: mockTraceIds.paymentWebhook, spanId: '7ad6b7169203331b', value: 0.482, time: s(900) },
      { traceId: consumerTraceId, spanId: 'a1b2c3d4e5f60718', value: 0.331, time: s(45) },
    ],
  };
}

// One point per minute over the last hour, two attribute series for the
// histogram metric so the multi-series pivot renders in mock mode.
function mockOtelMetricPoints(endpoint: string) {
  const name = new URLSearchParams(endpoint.split('?')[1] ?? '').get('name') ?? 'jvm.memory.used';
  const points = [];
  let id = 1;
  for (let i = 60; i >= 0; i -= 1) {
    const createdAt = new Date(nowAgent - i * 60_000).toISOString();
    if (name === 'http.server.request.duration') {
      points.push(
        { id: id++, metricName: name, metricType: 'histogram', unit: 's', attributes: { 'http.route': '/orders' },   value: 0.05 + 0.02 * Math.sin(i / 5) + Math.random() * 0.01, count: 12, total: 0.7, createdAt },
        { id: id++, metricName: name, metricType: 'histogram', unit: 's', attributes: { 'http.route': '/users/:id' }, value: 0.02 + 0.01 * Math.cos(i / 7) + Math.random() * 0.005, count: 30, total: 0.66, createdAt },
      );
    } else if (name === 'jvm.memory.used') {
      points.push({ id: id++, metricName: name, metricType: 'gauge', unit: 'By', attributes: {}, value: 256 * 1048576 + 64 * 1048576 * Math.sin(i / 10) + Math.random() * 10 * 1048576, createdAt });
    } else {
      points.push({ id: id++, metricName: name, metricType: 'sum', unit: '1', attributes: {}, value: Math.max(0, Math.round(4 + 3 * Math.sin(i / 4) + Math.random() * 2)), createdAt });
    }
  }
  return points;
}

const mockAppSettings: AppSettings = {
  alerts: { consecutiveFailures: 3 },
  retention: { metrics: '30d', logs: '90d' },
  system: { collectInterval: 30 },
};

const mockUptimeMonitors: UptimeMonitor[] = [
  {
    id: 'uptime_mock_store', name: 'Storefront', type: 'http', isActive: true,
    url: 'https://store.example.com/health', method: 'GET', expectedStatus: 200,
    timeout: 5000, interval: 30, status: 'healthy', responseTime: 128,
    uptime: 99.98, lastCheckAt: new Date(nowAgent - 18_000).toISOString(),
  },
  {
    id: 'uptime_mock_redis', name: 'Redis TCP', type: 'tcp', isActive: false,
    url: 'cache.example.com', port: 6379, method: 'GET', expectedStatus: 200,
    timeout: 3000, interval: 60, status: 'unknown',
  },
];

const mockUptimeMetrics: UptimeMonitorMetric[] = Array.from({ length: 72 }, (_, index) => {
  const failed = index === 17 || index === 18;
  return {
    id: 10_000 + index,
    serviceId: 'uptime_mock_store',
    status: failed ? 'failure' : 'success',
    responseTime: failed ? 5000 : Math.round(105 + 28 * Math.sin(index / 5) + (index % 7) * 3),
    statusCode: failed ? 503 : 200,
    errorMessage: failed ? 'upstream timeout' : undefined,
    checkedAt: new Date(nowAgent - index * 30 * 60_000).toISOString(),
  };
});

const mockUptimeSummary: UptimeMonitorSummary = {
  serviceId: 'uptime_mock_store',
  totalChecks: 86_400,
  successfulChecks: 86_383,
  failedChecks: 17,
  uptime: 99.98,
  avgResponseTime: 128,
  minResponseTime: 82,
  maxResponseTime: 5000,
};

const mockUptimeHistory: UptimeMonitorHistory = {
  percentage: 99.98,
  days: Array.from({ length: 90 }, (_, index) => {
    const date = new Date(nowAgent - index * 86_400_000).toISOString().slice(0, 10);
    const uptime = index === 12 ? 96.4 : index === 37 ? 99.2 : 100;
    return { date, uptime, status: uptime === 100 ? 'up' as const : uptime >= 50 ? 'partial' as const : 'down' as const };
  }),
};

const mockProjects: Project[] = [
  {
    id: 'project_mock_production', name: 'Production', description: '고객 서비스',
    agentCount: 0, monitorCount: 0, observedServiceCount: 0,
    infrastructureResourceCount: 0,
    createdAt: new Date(nowAgent - 7 * 86_400_000).toISOString(), updatedAt: new Date(nowAgent).toISOString(),
  },
];

const mockObservedServices: ObservedService[] = [
  {
    id: 'observed_mock_checkout',
    name: 'checkout-api',
    projectId: 'project_mock_production',
    signals: ['logs'],
    logLevelFilter: ['error', 'warn', 'info'],
    isActive: true,
    apiKeyMasked: 'evup_****9f2a',
    lastSeenAt: new Date(nowAgent - 25_000).toISOString(),
    createdAt: new Date(nowAgent - 3 * 86_400_000).toISOString(),
    updatedAt: new Date(nowAgent - 25_000).toISOString(),
  },
  {
    id: 'observed_mock_catalog',
    name: 'catalog-worker',
    projectId: 'project_mock_production',
    signals: ['metrics'],
    isActive: true,
    apiKeyMasked: 'evup_****c8d1',
    lastSeenAt: new Date(nowAgent - 40_000).toISOString(),
    createdAt: new Date(nowAgent - 2 * 86_400_000).toISOString(),
    updatedAt: new Date(nowAgent - 40_000).toISOString(),
  },
  {
    id: 'observed_mock_payments',
    name: 'payments-api',
    projectId: 'project_mock_production',
    signals: ['traces'],
    isActive: true,
    apiKeyMasked: 'evup_****a741',
    lastSeenAt: new Date(nowAgent - 15_000).toISOString(),
    createdAt: new Date(nowAgent - 5 * 86_400_000).toISOString(),
    updatedAt: new Date(nowAgent - 15_000).toISOString(),
  },
];

const mockDirectLogFilters = new Map<string, string[]>([
  ['observed_mock_checkout', ['error', 'warn', 'info']],
]);

const mockDirectApiExclusions = new Map<string, string[]>([
  ['observed_mock_checkout', ['/health*']],
  ['observed_mock_payments', ['/health*', '/metrics*']],
]);

const mockInfrastructureResources: InfrastructureResource[] = [
  {
    id: 'infra_mock_edge_01',
    name: 'edge-host-01',
    projectId: 'project_mock_production',
    adapter: 'otel-collector',
    isActive: true,
    apiKeyMasked: 'evup_****4e91',
    lastSeenAt: new Date(nowAgent - 18_000).toISOString(),
    cpuUsage: 67.4,
    memoryUsage: 72.8,
    diskUsage: 41.2,
    createdAt: new Date(nowAgent - 4 * 86_400_000).toISOString(),
    updatedAt: new Date(nowAgent - 18_000).toISOString(),
  },
];

// ?? Router ????????????????????????????????????????????????????????????????????

function randomHex(bytes: number): string {
  let s = '';
  for (let i = 0; i < bytes; i++) s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return s;
}

function scenarioAgents(scenario: MockScenario): ConnectedAgent[] {
  if (scenario === 'empty') return [];
  if (scenario !== 'normal') return mockAgents;
  const fresh = new Date(nowAgent - 20_000).toISOString();
  return mockAgents.map((agent) => ({ ...agent, lastSeenAt: fresh, updatedAt: fresh }));
}

function scenarioServices(scenario: MockScenario): AgentServiceFlat[] {
  if (scenario === 'empty') return [];
  if (scenario !== 'normal') return mockAgentServicesFlat;
  const fresh = new Date(nowAgent - 20_000).toISOString();
  return mockAgentServicesFlat.map((service) => ({
    ...service,
    healthy: true,
    lastStatus: service.checkType === 'http' ? 200 : 0,
    lastLatency: service.checkType === 'http' ? '42ms' : '5ms',
    lastError: undefined,
    updatedAt: fresh,
    observedAt: fresh,
  }));
}

function scenarioMonitors(scenario: MockScenario): UptimeMonitor[] {
  if (scenario === 'empty') return [];
  return mockUptimeMonitors;
}

// Outage history for the overview timeline. `normal` keeps the resolved
// episodes: a timeline whose only value is "nothing is wrong right now"
// duplicates the attention panel — the point is showing that it has been quiet.
function scenarioTimeline(scenario: MockScenario): TimelineIncident[] {
  if (scenario === 'empty') return [];
  const at = (minutesAgo: number) => new Date(nowAgent - minutesAgo * 60_000).toISOString();
  const resolved: TimelineIncident[] = [
    {
      source: 'uptime',
      targetName: 'Storefront',
      targetPath: '/uptime/uptime_mock_store',
      startedAt: at(310),
      endedAt: at(268),
      durationSec: 42 * 60,
      active: false,
      message: 'HTTP 503 from origin',
    },
    {
      source: 'docker',
      targetName: 'api',
      targetPath: '/services/agent_demo_01/shop%3Aapi',
      startedAt: at(1450),
      endedAt: at(1441),
      durationSec: 9 * 60,
      active: false,
    },
  ];
  if (scenario === 'normal') return resolved;
  return [
    {
      source: 'docker',
      targetName: 'payment-worker',
      targetPath: '/services/agent_demo_01/shop%3Apayment-worker',
      startedAt: at(124),
      durationSec: 124 * 60,
      active: true,
    },
    ...resolved,
  ];
}

function scenarioObservedServices(scenario: MockScenario): ObservedService[] {
  if (scenario === 'empty') return [];
  if (scenario !== 'normal') return mockObservedServices;
  const fresh = new Date(nowAgent - 20_000).toISOString();
  return mockObservedServices.map((service) => ({ ...service, lastSeenAt: fresh, updatedAt: fresh }));
}

function scenarioInfrastructureResources(scenario: MockScenario): InfrastructureResource[] {
  if (scenario === 'empty') return [];
  if (scenario !== 'normal') return mockInfrastructureResources;
  const fresh = new Date(nowAgent - 20_000).toISOString();
  return mockInfrastructureResources.map((resource) => ({ ...resource, lastSeenAt: fresh, updatedAt: fresh }));
}

function normalizeMockAgentProfile(profile?: Partial<AgentProfile>): AgentProfile {
  const allCapabilities: AgentCollectionCapability[] = ['uptime', 'logs', 'infrastructure', 'api', 'metrics'];
  if (profile?.kind === 'basic') {
    return { kind: 'basic', capabilities: ['uptime', 'logs'] };
  }
  if (profile?.kind !== 'custom') {
    return { kind: 'all-in-one', capabilities: allCapabilities };
  }

  const selected = new Set(profile.capabilities ?? []);
  if (selected.has('logs') || selected.has('api')) selected.add('uptime');
  return {
    kind: 'custom',
    capabilities: allCapabilities.filter((capability) => selected.has(capability)),
  };
}

const pendingCollectorProfiles = new Set<string>();
const instrumentationRuns = new Map<string, import('../features/services/instrumentationApi').InstrumentationRun>();

export function mockRouter<T>(endpoint: string, method = 'GET', body?: BodyInit | null): T {
  const scenario = getDemoScenario();
  const instrumentationCreate = endpoint.match(/^\/agents\/([^/]+)\/instrumentation-runs$/);
  if (method === 'POST' && instrumentationCreate) {
    const input = JSON.parse(typeof body === 'string' ? body : '{}') as { project: string; keys: string[]; captureBodies: boolean };
    const now = new Date().toISOString();
    const run: import('../features/services/instrumentationApi').InstrumentationRun = {
      id: `run-${Date.now()}`, agentId: instrumentationCreate[1], project: input.project, captureBodies: input.captureBodies,
      targets: input.keys.map(key => { const service = mockAgentServicesFlat.find(row => row.agentId === instrumentationCreate[1] && row.key === key); return { key, name: service?.name ?? key, runtime: service?.runtime ?? 'node' }; }),
      status: 'planned', reason: '', createdAt: now, updatedAt: now, signals: [],
    };
    instrumentationRuns.set(run.id, run);
    return run as T;
  }
  const instrumentationGet = endpoint.match(/^\/agents\/([^/]+)\/instrumentation-runs\/([^/]+)$/);
  if (method === 'GET' && instrumentationGet) {
    return (instrumentationGet[2] === 'latest' ? [...instrumentationRuns.values()].reverse().find(run => run.agentId === instrumentationGet[1]) ?? null : instrumentationRuns.get(instrumentationGet[2]) ?? null) as T;
  }

  if (method === 'GET' && endpoint === '/settings/connection') return { publicUrl: 'https://monitor.example.com' } as T;
  const collectorSetup = endpoint.match(/^\/agents\/([^/]+)\/setup-status$/);
  if (method === 'GET' && collectorSetup) {
    const agent = scenarioAgents(scenario).find(row => row.id === collectorSetup[1]);
    if (!agent) throw new Error('Docker 환경을 찾을 수 없습니다');
    const profile = normalizeMockAgentProfile(agent.profile);
    const connected = Boolean(agent.version && Date.now() - new Date(agent.lastSeenAt).getTime() < 120_000);
    const desiredHash = [...profile.capabilities].sort().join(',');
    const appliedHash = agent.version && !pendingCollectorProfiles.has(agent.id) ? desiredHash : '';
    return {
      profile, connected, desiredHash, appliedHash, configApplied: connected && desiredHash === appliedHash,
      lastContactAt: agent.version ? agent.lastSeenAt : undefined,
      signals: agent.version ? profile.capabilities.map(capability => ({ serviceName: 'api', signal: capability === 'api' ? 'traces' : capability, firstReceivedAt: agent.createdAt, lastReceivedAt: agent.lastSeenAt })) : [],
    } as T;
  }
  const directSetup = endpoint.match(/^\/(observed-services|infrastructure-resources)\/([^/]+)\/setup-status$/);
  if (method === 'GET' && directSetup) {
    const infrastructure = directSetup[1] === 'infrastructure-resources';
    const resource = infrastructure ? mockInfrastructureResources.find(row => row.id === directSetup[2]) : mockObservedServices.find(row => row.id === directSetup[2]);
    const signals = infrastructure ? ['infrastructure'] : mockObservedServices.find(row => row.id === directSetup[2])?.signals ?? [];
    return (resource?.lastSeenAt ? signals.map(signal => ({ serviceName: resource.name, signal, firstReceivedAt: resource.createdAt, lastReceivedAt: resource.lastSeenAt })) : []) as T;
  }
  const collectorProfile = endpoint.match(/^\/agents\/([^/]+)\/profile$/);
  if (method === 'PUT' && collectorProfile) {
    const agent = mockAgents.find(row => row.id === collectorProfile[1]);
    if (!agent) throw new Error('Docker 환경을 찾을 수 없습니다');
    agent.profile = normalizeMockAgentProfile(JSON.parse(typeof body === 'string' ? body : '{}'));
    pendingCollectorProfiles.add(agent.id);
    return agent.profile as T;
  }

  // Keep successful regions visible while exercising the overview's per-source
  // failure handling. Other detail endpoints continue to work for inspection.
  if (method === 'GET' && scenario === 'partial-failure' && (
    endpoint === '/agents/services/all' || endpoint === '/observed-services'
  )) {
    throw new Error('Demo scenario: telemetry source is temporarily unavailable');
  }

  // Mutations in mock mode: mutate the in-memory fixtures so flows feel real.
  if (method !== 'GET') {
    const projectMatch = endpoint.match(/^\/projects\/([^/]+)$/);
    const projectMemberMatch = endpoint.match(/^\/projects\/([^/]+)\/(agents|monitors)\/([^/]+)$/);
    const observedMatch = endpoint.match(/^\/observed-services\/([^/]+)$/);
    const observedLogFilterMatch = endpoint.match(/^\/observed-services\/([^/]+)\/log-filter$/);
    const observedApiExclusionsMatch = endpoint.match(/^\/observed-services\/([^/]+)\/api-exclusions$/);
    const observedRotateMatch = endpoint.match(/^\/observed-services\/([^/]+)\/rotate-key$/);
    const observedRevokeMatch = endpoint.match(/^\/observed-services\/([^/]+)\/revoke-key$/);
    const infrastructureMatch = endpoint.match(/^\/infrastructure-resources\/([^/]+)$/);
    const infrastructureRotateMatch = endpoint.match(/^\/infrastructure-resources\/([^/]+)\/rotate-key$/);
    const infrastructureRevokeMatch = endpoint.match(/^\/infrastructure-resources\/([^/]+)\/revoke-key$/);
    if (method === 'POST' && endpoint === '/infrastructure-resources') {
      const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as InfrastructureResourceInput;
      const now = new Date().toISOString();
      const resource: InfrastructureResourceSetup = {
        id: `infra_mock_${Date.now()}`,
        name: parsed.name,
        projectId: parsed.projectId,
        adapter: 'otel-collector',
        isActive: true,
        apiKeyMasked: 'everyup_ab.....demo',
        apiKey: `everyup_${randomHex(32)}`,
        createdAt: now,
        updatedAt: now,
      };
      mockInfrastructureResources.push(resource);
      return resource as T;
    }
    if (method === 'POST' && infrastructureRotateMatch) {
      const resource = mockInfrastructureResources.find(row => row.id === infrastructureRotateMatch[1]);
      if (!resource) return null as T;
      resource.isActive = true;
      resource.apiKeyMasked = 'everyup_ab.....new1';
      return { ...resource, apiKey: `everyup_${randomHex(32)}` } as T;
    }
    if (method === 'POST' && infrastructureRevokeMatch) {
      const resource = mockInfrastructureResources.find(row => row.id === infrastructureRevokeMatch[1]);
      if (resource) resource.isActive = false;
      return resource as T;
    }
    if (method === 'PUT' && infrastructureMatch) {
      const resource = mockInfrastructureResources.find(row => row.id === infrastructureMatch[1]);
      const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as InfrastructureResourceInput;
      if (resource) Object.assign(resource, parsed, { projectId: parsed.projectId || undefined, updatedAt: new Date().toISOString() });
      return resource as T;
    }
    if (method === 'DELETE' && infrastructureMatch) {
      const index = mockInfrastructureResources.findIndex(row => row.id === infrastructureMatch[1]);
      if (index !== -1) mockInfrastructureResources.splice(index, 1);
      return undefined as T;
    }
    if (method === 'POST' && endpoint === '/observed-services') {
      const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as ObservedServiceInput;
      const now = new Date().toISOString();
      const service: ObservedServiceSetup = {
        id: `observed_mock_${Date.now()}`,
        name: parsed.name,
        projectId: parsed.projectId,
        signals: parsed.signals,
        logLevelFilter: ['error', 'warn', 'info'],
        isActive: true,
        apiKeyMasked: 'evup_****demo',
        apiKey: `evup_direct_${randomHex(24)}`,
        createdAt: now,
        updatedAt: now,
      };
      mockObservedServices.push(service);
      mockDirectLogFilters.set(service.id, ['error', 'warn', 'info']);
      mockDirectApiExclusions.set(service.id, []);
      return service as T;
    }
    if (method === 'POST' && observedRotateMatch) {
      const service = mockObservedServices.find(row => row.id === observedRotateMatch[1]);
      if (!service) return null as T;
      service.isActive = true;
      service.apiKeyMasked = 'evup_****new1';
      return { ...service, apiKey: `evup_direct_${randomHex(24)}` } as T;
    }
    if (method === 'POST' && observedRevokeMatch) {
      const service = mockObservedServices.find(row => row.id === observedRevokeMatch[1]);
      if (service) service.isActive = false;
      return service as T;
    }
    if (method === 'PUT' && observedLogFilterMatch) {
      const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as { levels?: string[] };
      const levels = parsed.levels?.map(String) ?? [];
      mockDirectLogFilters.set(observedLogFilterMatch[1], levels);
      return { levels } as T;
    }
    if (method === 'PUT' && observedApiExclusionsMatch) {
      const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as { paths?: string[] };
      const paths = parsed.paths?.map(String).filter(Boolean) ?? [];
      mockDirectApiExclusions.set(observedApiExclusionsMatch[1], paths);
      const service = mockObservedServices.find(row => row.id === observedApiExclusionsMatch[1]);
      if (service) service.apiExcludePaths = paths;
      return { paths } as T;
    }
    if (method === 'PUT' && observedMatch) {
      const service = mockObservedServices.find(row => row.id === observedMatch[1]);
      const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as ObservedServiceInput;
      if (service) Object.assign(service, parsed, { projectId: parsed.projectId || undefined, updatedAt: new Date().toISOString() });
      return service as T;
    }
    if (method === 'DELETE' && observedMatch) {
      const index = mockObservedServices.findIndex(row => row.id === observedMatch[1]);
      if (index !== -1) mockObservedServices.splice(index, 1);
      mockDirectLogFilters.delete(observedMatch[1]);
      mockDirectApiExclusions.delete(observedMatch[1]);
      return undefined as T;
    }
    if (method === 'POST' && endpoint === '/projects') {
      const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as Partial<Project>;
      const now = new Date().toISOString();
      const project: Project = { id: `project_mock_${Date.now()}`, name: String(parsed.name ?? '새 Project'), description: parsed.description, agentCount: 0, monitorCount: 0, observedServiceCount: 0, infrastructureResourceCount: 0, createdAt: now, updatedAt: now };
      mockProjects.push(project);
      return project as T;
    }
    if (method === 'PUT' && projectMemberMatch) {
      const [, projectId, kind, memberId] = projectMemberMatch;
      if (kind === 'agents') {
        const agent = mockAgents.find(({ id }) => id === memberId);
        if (agent) agent.projectId = projectId;
      } else {
        const monitor = mockUptimeMonitors.find(({ id }) => id === memberId);
        if (monitor) monitor.projectId = projectId;
      }
      return undefined as T;
    }
    if (method === 'DELETE' && projectMemberMatch) {
      const [, , kind, memberId] = projectMemberMatch;
      if (kind === 'agents') {
        const agent = mockAgents.find(({ id }) => id === memberId);
        if (agent) delete agent.projectId;
      } else {
        const monitor = mockUptimeMonitors.find(({ id }) => id === memberId);
        if (monitor) delete monitor.projectId;
      }
      return undefined as T;
    }
    if (method === 'PUT' && projectMatch) {
      const project = mockProjects.find(({ id }) => id === projectMatch[1]);
      if (project) Object.assign(project, JSON.parse(typeof body === 'string' ? body : '{}'), { updatedAt: new Date().toISOString() });
      return project as T;
    }
    if (method === 'DELETE' && projectMatch) {
      const index = mockProjects.findIndex(({ id }) => id === projectMatch[1]);
      if (index !== -1) mockProjects.splice(index, 1);
      mockAgents.forEach((agent) => { if (agent.projectId === projectMatch[1]) delete agent.projectId; });
      mockUptimeMonitors.forEach((monitor) => { if (monitor.projectId === projectMatch[1]) delete monitor.projectId; });
      mockObservedServices.forEach((service) => { if (service.projectId === projectMatch[1]) delete service.projectId; });
      mockInfrastructureResources.forEach((resource) => { if (resource.projectId === projectMatch[1]) delete resource.projectId; });
      return undefined as T;
    }
    const uptimeMatch = endpoint.match(/^\/services\/([^/]+)$/);
    if (method === 'POST' && endpoint === '/services') {
      const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as Partial<UptimeMonitorInput>;
      const monitor: UptimeMonitor = {
        id: `uptime_mock_${Date.now()}`,
        name: String(parsed.name ?? '새 업타임'),
        type: parsed.type === 'tcp' ? 'tcp' : 'http',
        isActive: parsed.isActive ?? true,
        url: String(parsed.url ?? parsed.host ?? ''),
        port: parsed.port,
        method: String(parsed.method ?? 'GET'),
        expectedStatus: Number(parsed.expectedStatus ?? 200),
        timeout: Number(parsed.timeout ?? 5000),
        interval: Number(parsed.interval ?? 30),
        status: 'unknown',
      };
      mockUptimeMonitors.push(monitor);
      return monitor as T;
    }
    if (method === 'PUT' && uptimeMatch) {
      const monitor = mockUptimeMonitors.find(({ id }) => id === uptimeMatch[1]);
      if (monitor) Object.assign(monitor, JSON.parse(typeof body === 'string' ? body : '{}'));
      return monitor as T;
    }
    if (method === 'DELETE' && uptimeMatch) {
      const index = mockUptimeMonitors.findIndex(({ id }) => id === uptimeMatch[1]);
      if (index !== -1) mockUptimeMonitors.splice(index, 1);
      return undefined as T;
    }
    // POST /agents — create a pending agent (no services yet → pending card)
    if (method === 'POST' && endpoint === '/agents') {
      let name = 'new-service';
      let profile: AgentProfile;
      try {
        const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as { name?: unknown; profile?: AgentProfile };
        if (parsed?.name) name = String(parsed.name);
        profile = normalizeMockAgentProfile(parsed.profile);
      } catch { /* keep default */ }
      profile ??= normalizeMockAgentProfile();
      const id = `agent_mock_${Date.now()}`;
      const now = new Date().toISOString();
      mockAgents.push({ id, name, profile, lastSeenAt: now, createdAt: now, updatedAt: now });
      return {
        id,
        name,
        profile,
        joinCode: `evup_join_${randomHex(16)}`,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      } as T;
    }
    // POST /agents/:id/join-code — replace the short-lived installer code
    if (method === 'POST' && /^\/agents\/[^/]+\/join-code$/.test(endpoint)) {
      return {
        joinCode: `evup_join_${randomHex(16)}`,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      } as T;
    }
    // POST /agents/:id/rotate-key — issue a fresh key
    if (method === 'POST' && /^\/agents\/[^/]+\/rotate-key$/.test(endpoint)) {
      return { apiKey: `evup_svc_${randomHex(24)}` } as T;
    }
    // DELETE /agents/:id — remove the agent so its card disappears
    const delMatch = endpoint.match(/^\/agents\/([^/]+)$/);
    if (method === 'DELETE' && delMatch) {
      const idx = mockAgents.findIndex(a => a.id === delMatch[1]);
      if (idx !== -1) mockAgents.splice(idx, 1);
      return null as T;
    }
    // DELETE /agents/:id/services/:key — remove one service card
    const svcDelMatch = endpoint.match(/^\/agents\/([^/]+)\/services\/([^/]+)$/);
    if (method === 'DELETE' && svcDelMatch) {
      const key = decodeURIComponent(svcDelMatch[2]);
      const idx = mockAgentServicesFlat.findIndex(s => s.agentId === svcDelMatch[1] && s.key === key);
      if (idx !== -1) mockAgentServicesFlat.splice(idx, 1);
      return null as T;
    }
    // PUT /agents/:id/services/:key/log-filter — echo the saved levels
    if (method === 'PUT' && /^\/agents\/[^/]+\/services\/[^/]+\/log-filter$/.test(endpoint)) {
      let levels: string[] = [];
      try {
        const parsed = JSON.parse(typeof body === 'string' ? body : '{}');
        if (Array.isArray(parsed?.levels)) levels = parsed.levels.map(String);
      } catch { /* keep empty */ }
      return { levels } as T;
    }
    return null as T;
  }

  // /traces/:traceId
  if (endpoint === '/projects') {
    if (scenario === 'empty') return [] as T;
    const agents = scenarioAgents(scenario);
    const monitors = scenarioMonitors(scenario);
    const observedServices = scenarioObservedServices(scenario);
    const infrastructureResources = scenarioInfrastructureResources(scenario);
    return mockProjects.map((project) => ({
    ...project,
      agentCount: agents.filter((agent) => agent.projectId === project.id).length,
      monitorCount: monitors.filter((monitor) => monitor.projectId === project.id).length,
      observedServiceCount: observedServices.filter((service) => service.projectId === project.id).length,
      infrastructureResourceCount: infrastructureResources.filter((resource) => resource.projectId === project.id).length,
    })) as T;
  }
  if (endpoint === '/infrastructure-resources') {
    if (scenario === 'empty') return [] as T;
    const agentResources: InfrastructureResource[] = scenarioAgents(scenario)
      .filter(agent => agent.profile?.capabilities.includes('infrastructure'))
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        projectId: agent.projectId,
        adapter: 'everyup-agent',
        isActive: true,
        lastSeenAt: agent.lastSeenAt,
        cpuUsage: mockSystemInfo.cpu.usage,
        memoryUsage: mockSystemInfo.memory.usage,
        diskUsage: mockSystemInfo.disk.usage,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      }));
    return [...scenarioInfrastructureResources(scenario), ...agentResources] as T;
  }
  const infrastructureDetailMatch = endpoint.match(/^\/infrastructure-resources\/([^/?]+)$/);
  if (infrastructureDetailMatch) return (scenarioInfrastructureResources(scenario).find(resource => resource.id === infrastructureDetailMatch[1]) ?? null) as T;
  if (endpoint === '/observed-services/service-metrics') {
    return scenarioObservedServices(scenario)
      .filter(service => service.signals.includes('metrics'))
      .map(service => ({
        serviceId: service.id,
        serviceName: service.name,
        metricName: 'jvm.memory.used',
        metricType: 'gauge',
        unit: 'By',
        value: 312 * 1024 * 1024,
      })) as T;
  }
  const observedLogsMatch = endpoint.match(/^\/observed-services\/([^/]+)\/logs(?:\?|$)/);
  if (observedLogsMatch) {
    const service = scenarioObservedServices(scenario).find(row => row.id === observedLogsMatch[1]);
    const rows = allMockLogs.map(log => ({ ...log, serviceId: service?.id ?? observedLogsMatch[1], serviceName: service?.name ?? 'direct-service', agentId: undefined }));
    return pageMockRows(filterMockLogs(rows, endpoint), endpoint) as T;
  }
  if (/^\/observed-services\/[^/]+\/log-histogram/.test(endpoint)) return mockLogHistogram() as T;
  const observedFilterMatch = endpoint.match(/^\/observed-services\/([^/]+)\/log-filter$/);
  if (observedFilterMatch) return { levels: mockDirectLogFilters.get(observedFilterMatch[1]) ?? [] } as T;
  if (/^\/observed-services\/[^/]+\/traces/.test(endpoint)) return mockTraceList(endpoint) as T;
  if (/^\/observed-services\/[^/]+\/otel-metrics\/quantiles/.test(endpoint)) return mockOtelMetricQuantiles(endpoint) as T;
  if (/^\/observed-services\/[^/]+\/otel-metrics\/points/.test(endpoint)) return mockOtelMetricPoints(endpoint) as T;
  if (/^\/observed-services\/[^/]+\/otel-metrics/.test(endpoint)) return mockOtelMetricNames as T;
  const observedRequestsMatch = endpoint.match(/^\/observed-services\/([^/]+)\/requests(?:\?|$)/);
  if (observedRequestsMatch) {
    const service = scenarioObservedServices(scenario).find(row => row.id === observedRequestsMatch[1]);
    const rows = mockAgentServiceRequests.map(requestRow => ({
      ...requestRow,
      serviceId: service?.id ?? observedRequestsMatch[1],
      serviceName: service?.name ?? 'direct-service',
      agentId: undefined,
    }));
    return pageMockRows(filterMockRequests(rows, endpoint), endpoint) as T;
  }
  if (/^\/observed-services\/[^/]+\/request-stats/.test(endpoint)) return mockRequestStats() as T;
  if (/^\/observed-services\/[^/]+\/request-status-summary/.test(endpoint)) {
    return {
      count2xx: 2394, count3xx: 96, count4xx: 89, count5xx: 21, countOther: 0,
      top5xxMethod: 'POST', top5xxPath: '/api/v1/payments', top5xxCount: 14,
    } as T;
  }
  const observedApiExclusionsMatch = endpoint.match(/^\/observed-services\/([^/]+)\/api-exclusions$/);
  if (observedApiExclusionsMatch) return { paths: mockDirectApiExclusions.get(observedApiExclusionsMatch[1]) ?? [] } as T;
  const observedDetailMatch = endpoint.match(/^\/observed-services\/([^/?]+)$/);
  if (observedDetailMatch) return (scenarioObservedServices(scenario).find(service => service.id === observedDetailMatch[1]) ?? null) as T;
  if (endpoint.startsWith('/observed-services')) {
    const signal = new URLSearchParams(endpoint.split('?')[1] ?? '').get('signal');
    return scenarioObservedServices(scenario).filter(service => !signal || service.signals.includes(signal as 'logs' | 'metrics' | 'traces')) as T;
  }
  if (endpoint === '/services?type=http,tcp') return scenarioMonitors(scenario) as T;
  // The fixture is authored grouped by service; the real handler is
  // ORDER BY created_at DESC and filters serviceName/search/level server-side.
  if (endpoint.startsWith('/logs?')) {
    const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
    const serviceName = query.get('serviceName');
    const matched = filterMockLogs(allMockLogs, endpoint)
      .filter(log => !serviceName || log.serviceName === serviceName)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return pageMockRows(matched, endpoint) as T;
  }
  const uptimeSummaryMatch = endpoint.match(/^\/services\/([^/]+)\/metrics\/summary(?:\?|$)/);
  if (uptimeSummaryMatch) return (uptimeSummaryMatch[1] === 'uptime_mock_store' ? mockUptimeSummary : null) as T;
  const uptimeMetricsMatch = endpoint.match(/^\/services\/([^/]+)\/metrics(?:\?|$)/);
  if (uptimeMetricsMatch) return (uptimeMetricsMatch[1] === 'uptime_mock_store' ? mockUptimeMetrics : []) as T;
  const uptimeHistoryMatch = endpoint.match(/^\/services\/([^/]+)\/uptime(?:\?|$)/);
  if (uptimeHistoryMatch) return (uptimeHistoryMatch[1] === 'uptime_mock_store' ? mockUptimeHistory : { percentage: 100, days: [] }) as T;
  const uptimeDetailMatch = endpoint.match(/^\/services\/([^/?]+)$/);
  if (uptimeDetailMatch) return (mockUptimeMonitors.find(({ id }) => id === uptimeDetailMatch[1]) ?? null) as T;
  const traceMatch = endpoint.match(/^\/traces\/([^/?]+)/);
  if (traceMatch) {
    const traceId = decodeURIComponent(traceMatch[1]);
    return (mockTraceDetails[traceId] ?? {
      traceId,
      spans: [],
      logs: [],
      apiRequests: [],
    }) as T;
  }

  // /incidents/timeline — cross-target outage history for the overview.
  // Mirrors the real merge: uptime episodes carry a message, Docker ones do not,
  // and direct-connection services are absent because they keep no history.
  if (endpoint.startsWith('/incidents/timeline')) return scenarioTimeline(scenario) as T;
  // /agents/services/all — must come before /agents/:id/services
  if (endpoint === '/agents/services/all') return scenarioServices(scenario) as T;
  // /agents/overview — home card KPI rollup
  if (endpoint === '/agents/overview') return mockAgentOverview as T;
  // /agents/:agentId/key
  if (/^\/agents\/[^/]+\/key$/.test(endpoint))
    return { apiKey: 'evup_svc_3f9c4a1b8e3d6f0a5c7b9d2e4f6a8c0b1d3e5f7a9c2b4d6e', available: true } as T;
  // /agents/:agentId/services/:key/log-filter
  if (/^\/agents\/[^/]+\/services\/[^/]+\/log-filter$/.test(endpoint))
    return { levels: ['error', 'warn', 'info'] } as T;
  // /agents/:agentId/services/:key/log-histogram
  if (/^\/agents\/[^/]+\/services\/[^/]+\/log-histogram/.test(endpoint))
    return mockLogHistogram() as T;
  // /agents/:agentId/services/:key/logs
  if (/^\/agents\/[^/]+\/services\/[^/]+\/logs/.test(endpoint))
  {
    return pageMockRows(filterMockLogs(mockAgentServiceLogs, endpoint), endpoint) as unknown as T;
  }
  // /agents/:agentId/services/:key/request-stats
  if (/^\/agents\/[^/]+\/services\/[^/]+\/request-stats/.test(endpoint))
    return mockRequestStats() as T;
  // /agents/:agentId/request-stats — project-level rollup (all services)
  if (/^\/agents\/[^/]+\/request-stats/.test(endpoint))
    return mockRequestStats() as T;
  // status-class distribution + top 5xx (service + agent level)
  if (/^\/agents\/[^/]+(\/services\/[^/]+)?\/request-status-summary/.test(endpoint))
    return {
      count2xx: 2394, count3xx: 96, count4xx: 89, count5xx: 21, countOther: 0,
      top5xxMethod: 'POST', top5xxPath: '/v1/payments', top5xxCount: 14,
    } as T;
  // /agents/:agentId/services/:key/requests — payment-worker has no HTTP
  // traffic, so its API tab exercises the empty state + setup guidance.
  if (/^\/agents\/[^/]+\/services\/shop%3Apayment-worker\/requests/.test(endpoint))
    return { data: [], total: 0 } as unknown as T;
  if (/^\/agents\/[^/]+\/services\/[^/]+\/requests/.test(endpoint)) {
    return pageMockRows(filterMockRequests(mockAgentServiceRequests, endpoint), endpoint) as unknown as T;
  }
  // /agents/:agentId/services/:key/traces
  if (/^\/agents\/[^/]+\/services\/[^/]+\/traces/.test(endpoint))
    return mockTraceList(endpoint) as T;
  // /agents/:agentId/services/:key/otel-metrics/quantiles?name=...
  if (/^\/agents\/[^/]+\/services\/[^/]+\/otel-metrics\/quantiles/.test(endpoint))
    return mockOtelMetricQuantiles(endpoint) as T;
  // /agents/:agentId/services/:key/otel-metrics/points?name=...
  if (/^\/agents\/[^/]+\/services\/[^/]+\/otel-metrics\/points/.test(endpoint))
    return mockOtelMetricPoints(endpoint) as T;
  // /agents/:agentId/services/:key/otel-metrics
  if (/^\/agents\/[^/]+\/services\/[^/]+\/otel-metrics/.test(endpoint))
    return mockOtelMetricNames as T;
  // /agents/:agentId/services/:key/history
  if (/^\/agents\/[^/]+\/services\/[^/]+\/history/.test(endpoint)) return mockAgentHistory as T;
  // /agents/:agentId/services/:key/uptime
  if (/^\/agents\/[^/]+\/services\/[^/]+\/uptime/.test(endpoint)) return mockAgentUptime as T;
  // /agents/:agentId/services/:key/events
  if (/^\/agents\/[^/]+\/services\/[^/]+\/events/.test(endpoint)) return mockAgentEvents as T;
  // /agents/:agentId/services
  const agentServicesMatch = endpoint.match(/^\/agents\/([^/]+)\/services(?:\?|$)/);
  if (agentServicesMatch) {
    const requestedAgentId = decodeURIComponent(agentServicesMatch[1]);
    return scenarioServices(scenario).filter((service) => service.agentId === requestedAgentId) as T;
  }
  // /agents/:agentId/events
  if (/^\/agents\/[^/]+\/events/.test(endpoint)) return mockAgentEvents as T;
  // /agents/:agentId/uptime — project-level rollup
  if (/^\/agents\/[^/]+\/uptime/.test(endpoint)) return mockAgentUptime as T;
  // /agents/:agentId/incidents
  if (/^\/agents\/[^/]+\/incidents/.test(endpoint)) return mockAgentIncidents as T;
  // /agents/:agentId/service-metrics — representative metric per service
  if (/^\/agents\/[^/]+\/service-metrics/.test(endpoint)) return mockServiceMetrics as T;
  // /agents
  if (endpoint.startsWith('/agents')) return scenarioAgents(scenario) as T;

  if (endpoint.startsWith('/notifications')) return mockChannels as T;

  // /hosts/:id/system/info
  if (/^\/hosts\/[^/]+\/system\/info$/.test(endpoint)) return mockSystemInfo as T;
  // /hosts/:id/system/metrics
  if (/^\/hosts\/[^/]+\/system\/metrics/.test(endpoint)) return mockSystemMetrics as T;

  const alertRuleMatch = endpoint.match(/^\/alert-rules\/([^/?]+)$/);
  if (alertRuleMatch) {
    const id = decodeURIComponent(alertRuleMatch[1]);
    return (mockAlertRules.find(rule => rule.id === id) ?? null) as T;
  }
  if (endpoint === '/alert-rules') return mockAlertRules as T;

  if (endpoint.startsWith('/notification-history/stats')) return mockNotificationStats as T;
  if (endpoint.startsWith('/notification-history')) return mockNotificationHistory as T;

  if (endpoint.startsWith('/settings')) return mockAppSettings as T;

  return null as T;
}
