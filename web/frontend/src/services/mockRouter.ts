/**
 * Mock router for demo mode.
 * Maps API endpoint patterns to mock data so ALL api.* calls (including direct
 * calls that bypass useDataFetch) return plausible data in demo/mock mode.
 */

import { mockLogEntries as allMockLogs, mockTraceIds } from '../mocks/logs/logs.mock';
import { mockSystemInfo, mockSystemMetrics } from '../mocks/infra/resources.mock';
import { mockChannels } from '../mocks/alerts/channels.mock';
import { getDemoScenario, type MockScenario } from '../mocks/demoScenario';
import { additionalProjects, additionalAgents, additionalDockerServices, additionalObservedServices, additionalInfrastructure, additionalMonitors } from '../mocks/demoTargets';
import { createServiceTelemetry, telemetryTraces, telemetryQuantiles, type DemoTelemetry } from '../mocks/serviceTelemetry';

import type {
  LogEntry,
  LogPattern,
  LogServiceSummary,
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

// mockSystemInfo·mockSystemMetrics는 mocks/infra에 있다 — 게이지·추세 목업이 같은 값에서 나온다.

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
    id: 'api-p99',
    name: 'API p99 latency',
    type: 'request',
    agentId: 'agent_demo_01',
    serviceKey: 'shop:api',
    metric: 'latency_p99',
    operator: 'gt',
    threshold: 800,
    duration: 5,
    severity: 'critical',
    isEnabled: true,
    isSystem: false,
    cooldown: 900,
    channelIds: ['1'],
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: '1',
    name: 'High CPU Usage',
    type: 'resource',
    agentId: 'infra_mock_db_01',
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
    agentId: 'agent_demo_01',
    serviceKey: 'shop:api',
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
    agentId: 'agent_demo_03',
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
  { id: 'orders-errors', name: 'Order API error rate', type: 'request', serviceId: 'observed_mock_orders', metric: 'error_rate', operator: 'gt', threshold: 5, duration: 5, severity: 'critical', isEnabled: true, isSystem: false, cooldown: 600, channelIds: ['3'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'billing-queue', name: 'Billing queue backlog', type: 'request', serviceId: 'observed_mock_billing', metric: 'otel_metric', metricName: 'queue.messages.pending', operator: 'gt', threshold: 100, duration: 10, severity: 'warning', isEnabled: true, isSystem: false, cooldown: 900, channelIds: ['4'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'search-logs', name: 'Search indexing errors', type: 'log', serviceId: 'observed_mock_search', metric: 'log_level', operator: 'gte', threshold: 1, duration: 5, severity: 'warning', isEnabled: false, isSystem: false, cooldown: 300, channelIds: ['2'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// ?? Notification History ??????????????????????????????????????????????????????

const mockNotificationHistory: NotificationHistoryResponse = {
  items: Array.from({ length: 32 }, (_, i) => {
    const channel = mockChannels[i % mockChannels.length];
    const rule = mockAlertRules[i % mockAlertRules.length];
    const failed = i % 11 === 0;
    const createdAt = new Date(Date.now() - (i + 1) * 45 * 60_000).toISOString();
    return {
      id: i + 1, ruleId: rule.id, channelId: channel.id, channelName: channel.name, channelType: channel.type,
      alertType: rule.type === 'request' ? 'endpoint' : rule.type === 'resource' ? 'resource' : rule.type === 'log' ? 'log' : 'healthcheck',
      severity: rule.severity, serviceId: rule.serviceId ?? undefined,
      message: `${rule.name}: ${rule.metric} ${rule.operator} ${rule.threshold} — ${rule.duration}분 지속`,
      status: failed ? 'failed' : 'sent', retryCount: failed ? 3 : 0,
      errorMessage: failed ? 'Webhook delivery timeout' : undefined, createdAt, sentAt: failed ? undefined : createdAt,
    };
  }),
  total: 32, limit: 25, offset: 0,
};

const mockNotificationStats: NotificationStats = {
  totalSent: mockNotificationHistory.items.filter(row => row.status === 'sent').length,
  totalFailed: mockNotificationHistory.items.filter(row => row.status === 'failed').length,
  successRate: mockNotificationHistory.items.filter(row => row.status === 'sent').length / mockNotificationHistory.total * 100,
  byChannel: Object.fromEntries(mockChannels.map(channel => [channel.name, mockNotificationHistory.items.filter(row => row.channelId === channel.id && row.status === 'sent').length])),
  byAlertType: Object.fromEntries(['resource', 'healthcheck', 'endpoint', 'log'].map(type => [type, mockNotificationHistory.items.filter(row => row.alertType === type && row.status === 'sent').length])),
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
    projectId: 'project_mock_staging',
    lastSeenAt: new Date(Date.now() - 90_000).toISOString(),
    createdAt: new Date(Date.now() - 90_000).toISOString(),
    updatedAt: new Date(Date.now() - 90_000).toISOString(),
    profile: { kind: 'basic', capabilities: ['uptime', 'logs'] },
  },
  ...additionalAgents,
];

// Home card KPI rollup — mirrors the demo dashboard numbers (99.87% / 2.6K / 121ms).
const mockAgentOverview: AgentOverview[] = [
  { agentId: 'agent_demo_01', uptimePct: 99.87, activeIncidents: 1, requests24h: 2600, p95Ms: 121 },
  { agentId: 'agent_demo_03', uptimePct: 99.99, activeIncidents: 0, requests24h: 0, p95Ms: null },
  { agentId: 'agent_demo_04', uptimePct: 99.95, activeIncidents: 0, requests24h: 4800, p95Ms: 86 },
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
  ...additionalDockerServices,
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
    agentId: 'agent_demo_01', key: 'shop:payment-worker', serviceName: 'payment-worker',
    startedAt: new Date(nowAgent - 12 * 60_000).toISOString(),
    durationSec: 12 * 60, active: true,
  },
  {
    agentId: 'agent_demo_01', key: 'shop:api', serviceName: 'api',
    startedAt: new Date(nowAgent - 3 * 86_400_000).toISOString(),
    endedAt: new Date(nowAgent - 3 * 86_400_000 + 24 * 60_000).toISOString(),
    durationSec: 24 * 60, active: false,
  },
  {
    agentId: 'agent_demo_01', key: 'postgres', serviceName: 'postgres',
    startedAt: new Date(nowAgent - 8 * 86_400_000).toISOString(),
    endedAt: new Date(nowAgent - 8 * 86_400_000 + 8 * 60_000).toISOString(),
    durationSec: 8 * 60, active: false,
  },
  { agentId: 'agent_demo_03', key: 'jobs:catalog-worker', serviceName: 'catalog-worker', startedAt: new Date(nowAgent - 2 * 86_400_000).toISOString(), endedAt: new Date(nowAgent - 2 * 86_400_000 + 6 * 60_000).toISOString(), durationSec: 360, active: false },
  { agentId: 'agent_demo_04', key: 'edge:search-api', serviceName: 'search-api', startedAt: new Date(nowAgent - 4 * 86_400_000).toISOString(), endedAt: new Date(nowAgent - 4 * 86_400_000 + 3 * 60_000).toISOString(), durationSec: 180, active: false },
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
  { id: 4, agentId: 'agent_demo_03', time: new Date(nowAgent - 2 * 86_400_000).toISOString(), type: 'status_change', targetKey: 'jobs:catalog-worker', serviceName: 'catalog-worker', message: 'catalog-worker recovered after a database failover', createdAt: new Date(nowAgent - 2 * 86_400_000).toISOString() },
  { id: 5, agentId: 'agent_demo_04', time: new Date(nowAgent - 4 * 86_400_000).toISOString(), type: 'status_change', targetKey: 'edge:search-api', serviceName: 'search-api', message: 'search-api recovered after index refresh', createdAt: new Date(nowAgent - 4 * 86_400_000).toISOString() },
];

// Rollouts give each Docker environment a deployment marker in its history.
const mockDeploys: AgentEvent[] = [
  {
    id: 3, agentId: 'agent_demo_01', time: new Date(nowAgent - 3.4 * 3_600_000).toISOString(),
    type: 'deploy', targetKey: 'api', serviceName: 'api', message: 'registry.local/api:1.4.2',
    metadata: { image: 'registry.local/api:1.4.2', previousImage: 'registry.local/api:1.4.1' },
    createdAt: new Date(nowAgent - 3.4 * 3_600_000).toISOString(),
  },
  { id: 6, agentId: 'agent_demo_03', time: new Date(nowAgent - 2 * 86_400_000 - 120_000).toISOString(), type: 'deploy', targetKey: 'jobs:catalog-worker', serviceName: 'catalog-worker', message: 'ghcr.io/shop/catalog:3.2.0', createdAt: new Date(nowAgent - 2 * 86_400_000 - 120_000).toISOString() },
  { id: 7, agentId: 'agent_demo_04', time: new Date(nowAgent - 4 * 86_400_000 - 120_000).toISOString(), type: 'deploy', targetKey: 'edge:search-api', serviceName: 'search-api', message: 'ghcr.io/shop/search:2.1.0', createdAt: new Date(nowAgent - 4 * 86_400_000 - 120_000).toISOString() },
];

// Level + message with the digits masked, like the server's pattern grouping.
// The per-service log endpoints are already scoped, so no service part.
function mockFingerprint(log: Pick<LogEntry, 'level' | 'message'>) {
  return `${log.level}:${log.message.replace(/\d+/g, '#')}`;
}

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
  const fingerprint = query.get('fingerprint');
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
    && (!fingerprint || mockFingerprint(log) === fingerprint)
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
  const to = query.get('to');
  const minStatus = Number(query.get('minStatus') ?? 0);
  const maxStatus = Number(query.get('maxStatus') ?? 0);
  return rows.filter(request =>
    (!errorsOnly || request.isError)
    && (!traceId || request.traceId === traceId)
    && (!search || request.path.toLowerCase().includes(search))
    && (!from || request.createdAt >= from)
    && (!to || request.createdAt <= to)
    && (!minStatus || request.statusCode >= minStatus)
    && (!maxStatus || request.statusCode <= maxStatus));
}

const mockAgentServiceRequests: ApiRequest[] = [
  { id: 201, serviceId: '', serviceName: 'api', requestId: 'r01', method: 'POST',   path: '/api/v1/auth/login',      pathTemplate: '/api/v1/auth/login',  statusCode: 200, durationMs: 42,  isError: false, traceId: mockTraceIds.apiGatewayAuth, createdAt: new Date(nowAgent - 30_000).toISOString() },
  { id: 202, serviceId: '', serviceName: 'api', requestId: 'r02', method: 'GET',    path: '/api/v1/users/42',        pathTemplate: '/api/v1/users/:id',   statusCode: 200, durationMs: 18,  isError: false, createdAt: new Date(nowAgent - 90_000).toISOString() },
  { id: 203, serviceId: '', serviceName: 'api', requestId: 'r03', method: 'POST',   path: '/api/v1/payments',        pathTemplate: '/api/v1/payments',    statusCode: 503, durationMs: 5001, isError: true,  error: 'payment gateway timeout', traceId: mockTraceIds.paymentWebhook, createdAt: new Date(nowAgent - 400_000).toISOString() },
  { id: 204, serviceId: '', serviceName: 'api', requestId: 'r04', method: 'GET',    path: '/api/v1/products',        pathTemplate: '/api/v1/products',    statusCode: 200, durationMs: 67,  isError: false, createdAt: new Date(nowAgent - 600_000).toISOString() },
];

// Like the server: `bucketMins`-wide buckets aligned to multiples of the width.
function mockBucketStart(endpoint: string, fallbackMins: number) {
  const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const mins = Number(query.get('bucketMins')) || fallbackMins;
  const width = mins * 60_000;
  const to = Date.parse(query.get('to') ?? '') || nowAgent;
  return { width, last: Math.floor(to / width) * width, count: Math.round((6 * 60) / mins) };
}

// Derive chart buckets from the same requests shown in the detail list.
function mockRequestStats(endpoint: string) {
  const rows = endpointRequests(endpoint);
  if (rows.length > 100000) return { buckets: [], truncated: true };
  const { width } = mockBucketStart(endpoint, 5);
  const grouped = new Map<number, ApiRequest[]>();
  for (const row of rows) {
    const start = Math.floor(Date.parse(row.createdAt) / width) * width;
    const group = grouped.get(start);
    if (group) group.push(row); else grouped.set(start, [row]);
  }
  const buckets = [...grouped.entries()].sort(([a], [b]) => a - b).map(([start, batch]) => {
    const values = batch.map(row => row.durationMs).filter(value => value > 0).sort((a, b) => a - b);
    const percentile = (p: number) => values[Math.max(0, Math.ceil(values.length * p) - 1)] ?? 0;
    const count = batch.length;
    const errorCount = batch.filter(row => row.isError).length;
    const [p50, p95, p99] = [percentile(0.5), percentile(0.95), percentile(0.99)];
    return { time: new Date(start).toISOString(), count, errorCount, p50, p95, p99, timed: values.length };
  });
  return { buckets, truncated: false };
}

// Use the service's own logs for its volume histogram.
function mockLogHistogram(endpoint: string) {
  const buckets = [];
  const { width, last, count: n } = mockBucketStart(endpoint, 10);
  const rows = endpointTelemetry(endpoint)?.logs ?? [];
  for (let i = n; i >= 0; i -= 1) {
    const time = new Date(last - i * width).toISOString();
    const bucket = { time, error: 0, warn: 0, info: 0, debug: 0, trace: 0 };
    rows.forEach(log => { const at = new Date(log.createdAt).getTime(); if (at >= last - i * width && at < last - (i - 1) * width) bucket[log.level] += 1; });
    buckets.push(bucket);
  }
  return buckets;
}

// Hourly error/warn buckets for the logs page cards, newest last: errors keyed by
// hours ago, plus a warn every `warnEvery` hours.
function mockLogScopes(scenario: MockScenario) {
  return [
    ...scenarioServices(scenario).map(service => ({
      agentId: service.agentId, serviceName: service.name,
      data: serviceTelemetry.get(`${service.agentId}/${service.key}`),
    })),
    ...scenarioObservedServices(scenario).filter(service => service.signals.includes('logs')).map(service => ({
      serviceId: service.id, serviceName: service.name, data: serviceTelemetry.get(service.id),
    })),
  ];
}

function mockLogSummary(scenario: MockScenario): LogServiceSummary[] {
  return mockLogScopes(scenario).map(({ data, ...scope }) => {
    const rows = data?.logs ?? [];
    const recent = rows.filter(log => new Date(log.createdAt).getTime() >= nowAgent - 86_400_000);
    const buckets = new Map<string, LogServiceSummary['buckets'][number]>();
    for (const log of recent) {
      const time = new Date(Math.floor(new Date(log.createdAt).getTime() / 3_600_000) * 3_600_000).toISOString();
      const bucket = buckets.get(time) ?? { time, error: 0, warn: 0, info: 0, debug: 0, trace: 0 };
      bucket[log.level] += 1;
      buckets.set(time, bucket);
    }
    return {
      ...scope,
      error: recent.filter(log => log.level === 'error').length,
      warn: recent.filter(log => log.level === 'warn').length,
      latest: recent.find(log => log.level === 'error') ?? recent.find(log => log.level === 'warn'),
      lastReceivedAt: rows[0]?.createdAt,
      buckets: [...buckets.values()].sort((a, b) => a.time.localeCompare(b.time)),
    };
  });
}

function mockLogPatterns(scenario: MockScenario, agentId: string): LogPattern[] {
  return mockLogScopes(scenario).filter(scope => ('agentId' in scope ? scope.agentId : '') === agentId)
    .flatMap(({ data, ...scope }) => {
      const groups = new Map<string, LogPattern>();
      for (const log of data?.logs ?? []) {
        if (log.level !== 'error' && log.level !== 'warn') continue;
        if (new Date(log.createdAt).getTime() < nowAgent - 86_400_000) continue;
        const fingerprint = mockFingerprint(log);
        const existing = groups.get(fingerprint);
        if (existing) { existing.count += 1; existing.firstSeen = log.createdAt; }
        else groups.set(fingerprint, { ...scope, fingerprint, level: log.level, message: log.message, count: 1, firstSeen: log.createdAt, lastSeen: log.createdAt });
      }
      return [...groups.values()];
    }).sort((a, b) => Number(b.level === 'error') - Number(a.level === 'error') || b.count - a.count);
}

const mockAppSettings: AppSettings = {
  alerts: { consecutiveFailures: 3 },
  retention: { metrics: '30d', logs: '90d' },
  system: { collectInterval: 30 },
};

const mockLatencyHistory = (base: number, swing: number) =>
  Array.from({ length: 24 }, (_, index) => Math.round(base + swing * Math.sin(index / 3) + (index % 5) * 2));

const mockUptimeMonitors: UptimeMonitor[] = [
  {
    id: 'uptime_mock_store', name: 'Storefront', projectId: 'project_mock_production', type: 'http', isActive: true,
    url: 'https://store.example.com/health', method: 'GET', expectedStatus: 200,
    timeout: 5000, interval: 30, status: 'healthy', responseTime: 128,
    uptime: 99.98, latencyHistory: mockLatencyHistory(128, 24), certExpiresAt: new Date(nowAgent + 83 * 86_400_000).toISOString(), lastCheckAt: new Date(nowAgent - 18_000).toISOString(),
  },
  // 업타임 메뉴는 직접 등록한 모니터만 보여 준다(ADR 0007) — 데모 목록이 비어 보이지 않게 둘을 더 둔다.
  {
    id: 'uptime_mock_checkout', name: 'Checkout API', projectId: 'project_mock_production', type: 'http', isActive: true,
    url: 'https://checkout.example.com/healthz', method: 'GET', expectedStatus: 200,
    timeout: 5000, interval: 30, status: 'healthy', responseTime: 214,
    uptime: 99.91, latencyHistory: mockLatencyHistory(214, 40), certExpiresAt: new Date(nowAgent + 9 * 86_400_000).toISOString(), lastCheckAt: new Date(nowAgent - 9_000).toISOString(),
  },
  {
    id: 'uptime_mock_smtp', name: 'Mail relay', projectId: 'project_mock_backoffice', type: 'tcp', isActive: true,
    url: 'smtp.example.com', port: 587, method: 'GET', expectedStatus: 200,
    timeout: 3000, interval: 60, status: 'healthy', responseTime: 41,
    uptime: 100, latencyHistory: mockLatencyHistory(41, 6), lastCheckAt: new Date(nowAgent - 32_000).toISOString(),
  },
  {
    id: 'uptime_mock_redis', name: 'Redis TCP', projectId: 'project_mock_staging', type: 'tcp', isActive: false,
    url: 'cache.example.com', port: 6379, method: 'GET', expectedStatus: 200,
    timeout: 3000, interval: 60, status: 'unknown',
  },
  ...additionalMonitors,
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

// 응답 시간 6H·24H 버킷 — 실제 API처럼 성공한 체크만 평균한다.
function mockUptimeBuckets(range: string, metrics = mockUptimeMetrics): ServiceHistoryPoint[] {
  const [hours, bucketMs] = range === '1h' ? [1, 120_000] : range === '6h' ? [6, 300_000] : [24, 1_200_000];
  const buckets = new Map<number, ServiceHistoryPoint & { sum: number; ok: number }>();
  for (const metric of [...metrics].reverse()) {
    const at = new Date(metric.checkedAt).getTime();
    if (at < nowAgent - hours * 3_600_000) continue;
    const t = at - (at % bucketMs);
    const bucket = buckets.get(t) ?? { time: new Date(t).toISOString(), latencyMs: 0, uptimePct: 0, total: 0, sum: 0, ok: 0 };
    bucket.total += 1;
    if (metric.status === 'success') { bucket.ok += 1; bucket.sum += metric.responseTime; }
    buckets.set(t, bucket);
  }
  return [...buckets.values()].map(({ sum, ok, ...point }) => ({ ...point, latencyMs: ok ? sum / ok : 0, uptimePct: (ok / point.total) * 100 }));
}

// mockUptimeMetrics의 두 실패(9시간·8.5시간 전)가 연속 실패 기준을 넘긴 한 번의 장애다.
const mockUptimeIncidents: TimelineIncident[] = [{
  source: 'uptime', targetName: 'Storefront', targetPath: '/uptime/uptime_mock_store',
  startedAt: new Date(nowAgent - 9 * 3_600_000).toISOString(), endedAt: new Date(nowAgent - 8.5 * 3_600_000).toISOString(),
  durationSec: 1_800, active: false, message: 'HTTP 503 from origin',
}];

// 장애로 이어지지 않은 실패 — 연속 실패 기준에 못 미쳐 장애 이력에는 없던 신호다.
const mockUptimeFailures: UptimeMonitorMetric[] = [
  { id: 20_001, serviceId: 'uptime_mock_store', status: 'failure', responseTime: 612, statusCode: 503, errorMessage: 'upstream connect error', checkedAt: new Date(nowAgent - 150 * 60_000).toISOString() },
  { id: 20_002, serviceId: 'uptime_mock_store', status: 'failure', responseTime: 5000, errorMessage: 'context deadline exceeded', checkedAt: new Date(nowAgent - 37 * 86_400_000).toISOString() },
];

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
  ...additionalProjects,
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
    signals: ['traces', 'logs'],
    isActive: true,
    apiKeyMasked: 'evup_****a741',
    lastSeenAt: new Date(nowAgent - 15_000).toISOString(),
    createdAt: new Date(nowAgent - 5 * 86_400_000).toISOString(),
    updatedAt: new Date(nowAgent - 15_000).toISOString(),
  },
  ...additionalObservedServices,
];

const mockDirectLogFilters = new Map<string, string[]>([
  ...mockObservedServices.filter(service => service.signals.includes('logs'))
    .map((service): [string, string[]] => [service.id, service.logLevelFilter ?? ['error', 'warn', 'info']]),
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
  ...additionalInfrastructure,
];

const serviceTelemetry = new Map<string, DemoTelemetry>();
mockAgentServicesFlat.forEach((service, index) => {
  const api = service.agentId === 'agent_demo_01' && service.name === 'api';
  const worker = service.agentId === 'agent_demo_01' && service.name === 'payment-worker';
  serviceTelemetry.set(`${service.agentId}/${service.key}`, createServiceTelemetry(
    service.key, service.name, index, service.agentId,
    (api ? mockAgentServiceLogs.filter(log => log.id !== 104) : worker ? [mockAgentServiceLogs[3]] : []).flatMap(log =>
      Array.from({ length: log.id === 101 ? 5 : log.id === 102 ? 8 : log.id === 104 ? 24 : 1 }, (_, i) => ({ ...log, id: log.id * 1000 + i }))),
    api ? mockAgentServiceRequests.filter(request => request.id !== 203) : [],
    api ? [mockTraceDetails[mockTraceIds.apiGatewayAuth], mockTraceDetails[consumerTraceId]] : worker ? [mockTraceDetails[mockTraceIds.paymentWebhook]] : [],
  ));
});
mockObservedServices.forEach((service, index) => {
  // Keep the recognizable checkout error while giving every direct service its own data.
  const seeds = service.id === 'observed_mock_checkout'
    ? allMockLogs.filter(log => log.serviceId === '1').flatMap(log => Array.from({ length: log.id === 1 ? 3 : 1 }, (_, i) => ({ ...log, id: log.id * 1000 + i, traceId: undefined, spanId: undefined })))
    : [];
  serviceTelemetry.set(service.id, createServiceTelemetry(service.id, service.name, index + 20, undefined, seeds));
});

function endpointTelemetry(endpoint: string): DemoTelemetry | undefined {
  const direct = endpoint.match(/^\/observed-services\/([^/?]+)/);
  if (direct) return serviceTelemetry.get(direct[1]);
  const docker = endpoint.match(/^\/agents\/([^/]+)\/services\/([^/?]+)/);
  return docker ? serviceTelemetry.get(`${docker[1]}/${decodeURIComponent(docker[2])}`) : undefined;
}

function endpointRequests(endpoint: string): ApiRequest[] {
  const scoped = endpointTelemetry(endpoint);
  if (scoped) return filterMockRequests(scoped.requests, endpoint);
  if (endpoint.includes('/services/')) return [];
  const agent = endpoint.match(/^\/agents\/([^/]+)\//)?.[1];
  return filterMockRequests(mockAgentServicesFlat.filter(service => service.agentId === agent)
    .flatMap(service => serviceTelemetry.get(`${agent}/${service.key}`)?.requests ?? []), endpoint);
}

function mockRequestStatusSummary(endpoint: string) {
  const rows = endpointRequests(endpoint);
  const errors = rows.filter(row => row.statusCode >= 500);
  const paths = new Map<string, typeof errors>();
  errors.forEach(row => { const key = `${row.method} ${row.pathTemplate}`; paths.set(key, [...(paths.get(key) ?? []), row]); });
  const top = [...paths.values()].sort((a, b) => b.length - a.length)[0];
  return {
    count2xx: rows.filter(row => row.statusCode >= 200 && row.statusCode < 300).length,
    count3xx: rows.filter(row => row.statusCode >= 300 && row.statusCode < 400).length,
    count4xx: rows.filter(row => row.statusCode >= 400 && row.statusCode < 500).length,
    count5xx: errors.length, countOther: rows.filter(row => row.statusCode < 200).length,
    top5xxMethod: top?.[0].method, top5xxPath: top?.[0].pathTemplate, top5xxCount: top?.length,
  };
}

function mockHostInfo(id: string) {
  const resource = mockInfrastructureResources.find(row => row.id === id);
  const agent = mockAgents.find(row => row.id === id);
  const index = resource ? mockInfrastructureResources.indexOf(resource) : Math.max(0, mockAgents.findIndex(row => row.id === id));
  const cpu = resource?.cpuUsage ?? [67.4, 18.5, 76.1, 28.4][index] ?? 25;
  const memory = resource?.memoryUsage ?? [72.8, 31.8, 62.4, 42.1][index] ?? 40;
  const disk = resource?.diskUsage ?? [41.2, 22.1, 35.7, 28.3][index] ?? 30;
  const totalMemory = index === 1 ? 32 : 16;
  return {
    ...mockSystemInfo, hostname: resource?.name ?? agent?.name ?? mockSystemInfo.hostname,
    ip: `10.42.${resource ? 1 : 2}.${10 + index}`, cpu: { cores: index === 1 ? 16 : 8, usage: cpu },
    memory: { total: totalMemory, used: Number((totalMemory * memory / 100).toFixed(2)), usage: memory },
    disk: { ...mockSystemInfo.disk, used: 500 * disk / 100, usage: disk },
  };
}

function mockHostMetrics(id: string, endpoint: string) {
  const info = mockHostInfo(id);
  const range = new URLSearchParams(endpoint.split('?')[1]).get('range') ?? '6h';
  const hours = range === '1h' ? 1 : range === '24h' ? 24 : 6;
  return { range, points: mockSystemMetrics.points.map((point, i) => ({
    ...point, timestamp: new Date(nowAgent - (71 - i) * hours * 3_600_000 / 71).toISOString(),
    cpu: Math.max(0, Math.min(100, info.cpu.usage + Math.sin((i - 71) / 8) * 12)),
    memUsage: Math.max(0, Math.min(100, info.memory.usage + Math.sin((i - 71) / 10) * 4)),
    diskUsage: info.disk.usage - (71 - i) * 0.008,
    netIn: 1.8 + Math.sin(i / 7), netOut: 0.8 + Math.cos(i / 9) * 0.4,
  })) };
}

const monitorData = new Map(mockUptimeMonitors.map((monitor, index) => {
  if (monitor.id === 'uptime_mock_store') return [monitor.id, {
    metrics: mockUptimeMetrics, summary: mockUptimeSummary, history: mockUptimeHistory, incidents: mockUptimeIncidents, failures: mockUptimeFailures,
  }] as const;
  const metrics: UptimeMonitorMetric[] = !monitor.isActive ? [] : Array.from({ length: 72 }, (_, i) => {
    const failed = monitor.id === 'uptime_mock_payments' && (i === 10 || i === 11);
    return { id: 30_000 + index * 100 + i, serviceId: monitor.id, status: failed ? 'failure' : 'success', responseTime: failed ? 5000 : Math.max(1, Math.round((monitor.responseTime ?? 50) * (1 + Math.sin(i / 5 + index) * 0.2))), statusCode: monitor.type === 'tcp' ? undefined : failed ? 503 : 200, errorMessage: failed ? 'upstream deadline exceeded' : undefined, checkedAt: new Date(nowAgent - i * 20 * 60_000).toISOString() };
  });
  const successful = metrics.filter(row => row.status === 'success');
  const values = successful.map(row => row.responseTime);
  const summary: UptimeMonitorSummary = { serviceId: monitor.id, totalChecks: metrics.length, successfulChecks: successful.length, failedChecks: metrics.length - successful.length, uptime: metrics.length ? successful.length / metrics.length * 100 : 0, avgResponseTime: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0, minResponseTime: values.length ? Math.min(...values) : 0, maxResponseTime: metrics.length ? Math.max(...metrics.map(row => row.responseTime)) : 0 };
  const history: UptimeMonitorHistory = { percentage: summary.uptime, days: !metrics.length ? [] : Array.from({ length: 90 }, (_, i) => ({ date: new Date(nowAgent - i * 86_400_000).toISOString().slice(0, 10), uptime: i === 0 ? summary.uptime : 100, status: i === 0 && summary.failedChecks ? 'partial' : 'up' })) };
  const incidents: TimelineIncident[] = summary.failedChecks ? [{ source: 'uptime', targetName: monitor.name, targetPath: `/uptime/${monitor.id}`, startedAt: metrics[11].checkedAt, endedAt: metrics[9].checkedAt, durationSec: 40 * 60, active: false, message: 'upstream deadline exceeded' }] : [];
  return [monitor.id, { metrics, summary, history, incidents, failures: [] as UptimeMonitorMetric[] }] as const;
}));

mockUptimeMonitors.forEach(monitor => {
  const metrics = (monitorData.get(monitor.id)?.metrics ?? []).filter(row => new Date(row.checkedAt).getTime() >= nowAgent - 86_400_000);
  if (!metrics.length) return;
  const successful = metrics.filter(row => row.status === 'success');
  monitor.uptime = successful.length / metrics.length * 100;
  monitor.responseTime = successful.reduce((sum, row) => sum + row.responseTime, 0) / successful.length;
  monitor.latencyHistory = successful.slice(0, 24).reverse().map(row => row.responseTime);
});

function scopedTraceList(endpoint: string): TraceSummary[] {
  const data = endpointTelemetry(endpoint);
  const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
  return (data ? telemetryTraces(data) : []).filter(row =>
    (query.get('errorsOnly') !== 'true' || row.errorCount > 0)
    && row.durationMs >= Number(query.get('minDurationMs') ?? 0)
    && (!query.get('from') || row.startTime >= query.get('from')!)
    && (!query.get('to') || row.startTime <= query.get('to')!))
    .sort(query.get('sort') === 'slowest' ? (a, b) => b.durationMs - a.durationMs : (a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, Number(query.get('limit') ?? 100));
}

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
  const uptime = scenarioMonitors(scenario).flatMap(monitor => monitorData.get(monitor.id)?.incidents ?? []);
  const docker: TimelineIncident[] = mockAgentIncidents.filter(incident => scenario !== 'normal' || !incident.active).map(incident => ({
    source: 'docker', targetName: incident.serviceName,
    targetPath: `/services/${incident.agentId}/${encodeURIComponent(incident.key)}`,
    startedAt: incident.startedAt, endedAt: incident.endedAt, durationSec: incident.durationSec, active: incident.active,
  }));
  return [...uptime, ...docker].filter(incident => new Date(incident.startedAt).getTime() >= nowAgent - 7 * 86_400_000)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
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
        cpuUsage: mockHostInfo(agent.id).cpu.usage,
        memoryUsage: mockHostInfo(agent.id).memory.usage,
        diskUsage: mockHostInfo(agent.id).disk.usage,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      }));
    return [...scenarioInfrastructureResources(scenario), ...agentResources] as T;
  }
  const infrastructureDetailMatch = endpoint.match(/^\/infrastructure-resources\/([^/?]+)$/);
  if (infrastructureDetailMatch) return (scenarioInfrastructureResources(scenario).find(resource => resource.id === infrastructureDetailMatch[1]) ?? null) as T;
  if (endpoint === '/observed-services/metric-catalog') {
    return scenarioObservedServices(scenario)
      .filter(service => service.signals.includes('metrics'))
      .flatMap(service => (serviceTelemetry.get(service.id)?.metricNames ?? []).map(metric => ({
        ...metric, serviceId: service.id,
      }))) as T;
  }
  if (endpoint === '/observed-services/service-metrics') {
    return scenarioObservedServices(scenario)
      .filter(service => service.signals.includes('metrics'))
      .flatMap(service => (serviceTelemetry.get(service.id)?.metricNames ?? []).map(metric => ({
        serviceId: service.id,
        serviceName: service.name,
        metricName: metric.metricName,
        metricType: metric.metricType,
        unit: metric.unit,
        value: serviceTelemetry.get(service.id)?.metricPoints[metric.metricName].slice(-1)[0]?.value ?? 0,
      }))) as T;
  }
  const observedLogsMatch = endpoint.match(/^\/observed-services\/([^/]+)\/logs(?:\?|$)/);
  if (observedLogsMatch) {
    const rows = endpointTelemetry(endpoint)?.logs ?? [];
    return pageMockRows(filterMockLogs(rows, endpoint), endpoint) as T;
  }
  if (/^\/observed-services\/[^/]+\/log-histogram/.test(endpoint)) return mockLogHistogram(endpoint) as T;
  const observedFilterMatch = endpoint.match(/^\/observed-services\/([^/]+)\/log-filter$/);
  if (observedFilterMatch) return { levels: mockDirectLogFilters.get(observedFilterMatch[1]) ?? [] } as T;
  if (/^\/observed-services\/[^/]+\/traces/.test(endpoint)) return scopedTraceList(endpoint) as T;
  if (/^\/observed-services\/[^/]+\/otel-metrics\/quantiles/.test(endpoint)) return (endpointTelemetry(endpoint) ? telemetryQuantiles(endpointTelemetry(endpoint)!, new URLSearchParams(endpoint.split('?')[1]).get('name') ?? '') : null) as T;
  if (/^\/observed-services\/[^/]+\/otel-metrics\/points/.test(endpoint)) return (endpointTelemetry(endpoint)?.metricPoints[new URLSearchParams(endpoint.split('?')[1]).get('name') ?? ''] ?? []) as T;
  if (/^\/observed-services\/[^/]+\/otel-metrics/.test(endpoint)) return (endpointTelemetry(endpoint)?.metricNames ?? []) as T;
  const observedRequestsMatch = endpoint.match(/^\/observed-services\/([^/]+)\/requests(?:\?|$)/);
  if (observedRequestsMatch) {
    return pageMockRows(endpointRequests(endpoint), endpoint) as T;
  }
  if (/^\/observed-services\/[^/]+\/request-stats/.test(endpoint)) return mockRequestStats(endpoint) as T;
  if (/^\/observed-services\/[^/]+\/request-status-summary/.test(endpoint)) return mockRequestStatusSummary(endpoint) as T;

  const observedApiExclusionsMatch = endpoint.match(/^\/observed-services\/([^/]+)\/api-exclusions$/);
  if (observedApiExclusionsMatch) return { paths: mockDirectApiExclusions.get(observedApiExclusionsMatch[1]) ?? [] } as T;
  const observedDetailMatch = endpoint.match(/^\/observed-services\/([^/?]+)$/);
  if (observedDetailMatch) return (scenarioObservedServices(scenario).find(service => service.id === observedDetailMatch[1]) ?? null) as T;
  if (endpoint.startsWith('/observed-services')) {
    const signal = new URLSearchParams(endpoint.split('?')[1] ?? '').get('signal');
    return scenarioObservedServices(scenario).filter(service => !signal || service.signals.includes(signal as 'logs' | 'metrics' | 'traces')) as T;
  }
  if (endpoint === '/services?type=http,tcp') return scenarioMonitors(scenario) as T;
  if (endpoint === '/logs/summary') return mockLogSummary(scenario) as T;
  if (endpoint.startsWith('/logs/patterns')) return mockLogPatterns(scenario, new URLSearchParams(endpoint.split('?')[1]).get('agentId') ?? '') as T;
  const uptimeDataMatch = endpoint.match(/^\/services\/([^/]+)\/(metrics\/summary|metrics\/history|metrics|uptime|failures|incidents)(?:\?|$)/);
  if (uptimeDataMatch) {
    const data = monitorData.get(uptimeDataMatch[1]);
    const part = uptimeDataMatch[2];
    if (part === 'metrics/summary') return (data?.metrics.length ? data.summary : null) as T;
    if (part === 'metrics/history') return mockUptimeBuckets(new URLSearchParams(endpoint.split('?')[1]).get('range') ?? '24h', data?.metrics ?? []) as T;
    if (part === 'metrics') return (data?.metrics ?? []) as T;
    if (part === 'uptime') return (data?.history ?? { percentage: 100, days: [] }) as T;
    if (part === 'failures') return (data?.failures ?? []) as T;
    return (data?.incidents ?? []) as T;
  }
  const uptimeDetailMatch = endpoint.match(/^\/services\/([^/?]+)$/);
  if (uptimeDetailMatch) return (mockUptimeMonitors.find(({ id }) => id === uptimeDetailMatch[1]) ?? null) as T;
  const traceMatch = endpoint.match(/^\/traces\/([^/?]+)/);
  if (traceMatch) {
    const traceId = decodeURIComponent(traceMatch[1]);
    return ([...serviceTelemetry.values()].flatMap(data => data.traces).find(trace => trace.traceId === traceId) ?? {
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
  if (endpoint === '/agents/overview') return (scenario === 'empty' ? [] : mockAgentOverview.map(row => ({ ...row, activeIncidents: scenario === 'normal' ? 0 : row.activeIncidents }))) as T;
  // /agents/:agentId/key
  if (/^\/agents\/[^/]+\/key$/.test(endpoint))
    return { apiKey: 'evup_svc_3f9c4a1b8e3d6f0a5c7b9d2e4f6a8c0b1d3e5f7a9c2b4d6e', available: true } as T;
  // /agents/:agentId/services/:key/log-filter
  if (/^\/agents\/[^/]+\/services\/[^/]+\/log-filter$/.test(endpoint))
    return { levels: ['error', 'warn', 'info'] } as T;
  // /agents/:agentId/services/:key/log-histogram
  if (/^\/agents\/[^/]+\/services\/[^/]+\/log-histogram/.test(endpoint))
    return mockLogHistogram(endpoint) as T;
  // /agents/:agentId/services/:key/logs
  if (/^\/agents\/[^/]+\/services\/[^/]+\/logs/.test(endpoint))
  {
    return pageMockRows(filterMockLogs(endpointTelemetry(endpoint)?.logs ?? [], endpoint), endpoint) as unknown as T;
  }
  // /agents/:agentId/services/:key/request-stats
  if (/^\/agents\/[^/]+\/services\/[^/]+\/request-stats/.test(endpoint))
    return mockRequestStats(endpoint) as T;
  // /agents/:agentId/request-stats — project-level rollup (all services)
  if (/^\/agents\/[^/]+\/request-stats/.test(endpoint))
    return mockRequestStats(endpoint) as T;
  // status-class distribution + top 5xx (service + agent level)
  if (/^\/agents\/[^/]+(\/services\/[^/]+)?\/request-status-summary/.test(endpoint))
    return mockRequestStatusSummary(endpoint) as T;
  if (/^\/agents\/[^/]+\/services\/[^/]+\/requests/.test(endpoint))
    return pageMockRows(endpointRequests(endpoint), endpoint) as unknown as T;
  // /agents/:agentId/services/:key/traces
  if (/^\/agents\/[^/]+\/services\/[^/]+\/traces/.test(endpoint))
    return scopedTraceList(endpoint) as T;
  // /agents/:agentId/services/:key/otel-metrics/quantiles?name=...
  if (/^\/agents\/[^/]+\/services\/[^/]+\/otel-metrics\/quantiles/.test(endpoint))
    return (endpointTelemetry(endpoint) ? telemetryQuantiles(endpointTelemetry(endpoint)!, new URLSearchParams(endpoint.split('?')[1]).get('name') ?? '') : null) as T;
  // /agents/:agentId/services/:key/otel-metrics/points?name=...
  if (/^\/agents\/[^/]+\/services\/[^/]+\/otel-metrics\/points/.test(endpoint))
    return (endpointTelemetry(endpoint)?.metricPoints[new URLSearchParams(endpoint.split('?')[1]).get('name') ?? ''] ?? []) as T;
  // /agents/:agentId/services/:key/otel-metrics
  if (/^\/agents\/[^/]+\/services\/[^/]+\/otel-metrics/.test(endpoint))
    return (endpointTelemetry(endpoint)?.metricNames ?? []) as T;
  // /agents/:agentId/services/:key/history
  if (/^\/agents\/[^/]+\/services\/[^/]+\/history/.test(endpoint)) return mockAgentHistory as T;
  // /agents/:agentId/services/:key/uptime
  if (/^\/agents\/[^/]+\/services\/[^/]+\/uptime/.test(endpoint)) return mockAgentUptime as T;
  // /agents/:agentId/services/:key/events
  if (/^\/agents\/[^/]+\/services\/[^/]+\/events/.test(endpoint)) return mockAgentEvents.filter(row => row.agentId === endpoint.split('/')[2] && row.serviceName === endpointTelemetry(endpoint)?.logs[0]?.serviceName) as T;
  // /agents/:agentId/services
  const agentServicesMatch = endpoint.match(/^\/agents\/([^/]+)\/services(?:\?|$)/);
  if (agentServicesMatch) {
    const requestedAgentId = decodeURIComponent(agentServicesMatch[1]);
    return scenarioServices(scenario).filter((service) => service.agentId === requestedAgentId) as T;
  }
  // /agents/:agentId/events
  if (/^\/agents\/[^/]+\/events/.test(endpoint)) return mockAgentEvents.filter(row => row.agentId === endpoint.split('/')[2]) as T;
  // /agents/:agentId/deploys
  if (/^\/agents\/[^/]+\/deploys/.test(endpoint)) return mockDeploys.filter(row => row.agentId === endpoint.split('/')[2]) as T;
  // /agents/:agentId/uptime — project-level rollup
  if (/^\/agents\/[^/]+\/uptime/.test(endpoint)) return mockAgentUptime as T;
  // /agents/:agentId/incidents
  if (/^\/agents\/[^/]+\/incidents/.test(endpoint)) return mockAgentIncidents.filter(row => row.agentId === endpoint.split('/')[2] && (scenario !== 'normal' || !row.active)) as T;
  // /agents/:agentId/service-metrics — representative metric per service
  if (/^\/agents\/[^/]+\/service-metrics/.test(endpoint)) return scenarioServices(scenario).filter(service => service.agentId === endpoint.split('/')[2])
    .flatMap(service => {
      const data = serviceTelemetry.get(`${service.agentId}/${service.key}`);
      return (data?.metricNames ?? []).map(metric => ({ serviceName: service.name, metricName: metric.metricName, metricType: metric.metricType, unit: metric.unit, value: data?.metricPoints[metric.metricName].slice(-1)[0]?.value ?? 0 }));
    }) as T;
  // /agents
  if (endpoint.startsWith('/agents')) return scenarioAgents(scenario) as T;

  if (endpoint.startsWith('/notifications')) return mockChannels as T;

  // /hosts/:id/system/info
  if (/^\/hosts\/[^/]+\/system\/info$/.test(endpoint)) return mockHostInfo(endpoint.split('/')[2]) as T;
  // /hosts/:id/system/metrics
  if (/^\/hosts\/[^/]+\/system\/metrics/.test(endpoint)) return mockHostMetrics(endpoint.split('/')[2], endpoint) as T;

  const alertRuleMatch = endpoint.match(/^\/alert-rules\/([^/?]+)$/);
  if (alertRuleMatch) {
    const id = decodeURIComponent(alertRuleMatch[1]);
    return (mockAlertRules.find(rule => rule.id === id) ?? null) as T;
  }
  if (endpoint === '/alert-rules') return mockAlertRules as T;

  if (endpoint.startsWith('/notification-history/stats')) return mockNotificationStats as T;
  if (endpoint.startsWith('/notification-history')) {
    const query = new URLSearchParams(endpoint.split('?')[1]);
    const rows = mockNotificationHistory.items.filter(row =>
      (!query.get('channel_id') || row.channelId === query.get('channel_id'))
      && (!query.get('alert_type') || row.alertType === query.get('alert_type'))
      && (!query.get('status') || row.status === query.get('status'))
      && (!query.get('q') || row.message.toLowerCase().includes(query.get('q')!.toLowerCase()))
      && (!query.get('from') || row.createdAt >= query.get('from')!)
      && (!query.get('to') || row.createdAt <= query.get('to')!));
    const { data: items, total } = pageMockRows(rows, endpoint);
    return { items, total, limit: Number(query.get('limit') ?? 100), offset: Number(query.get('offset') ?? 0) } as T;
  }

  if (endpoint.startsWith('/settings')) return mockAppSettings as T;

  return null as T;
}
