import { expect, test } from '@playwright/test';
import { mockRouter } from '../src/services/mockRouter';
import { buildServerRows, capabilityLabel } from '../src/features/servers/serverStatus';
import type { MockScenario } from '../src/mocks/demoScenario';
import type {
  InfrastructureResource, LogPattern, LogServiceSummary, ObservedService, ObservedServiceMetricName, Project, Server, TimelineIncident, UptimeMonitor,
  UptimeMonitorMetric, UptimeMonitorSummary, UptimeMonitorHistory, AgentServiceFlat, ServiceHistoryPoint,
} from '../src/services/api';

// mockRouter는 window가 없으면 attention 시나리오이다. 다른 시나리오는 sessionStorage를 흉내 내서 고른다.
function inScenario<T>(scenario: MockScenario, read: () => T): T {
  const global = globalThis as { window?: unknown };
  const previous = global.window;
  global.window = { sessionStorage: { getItem: () => scenario }, location: { search: '' } };
  try { return read(); } finally { global.window = previous; }
}

function snapshot() {
  const servers = mockRouter<Server[]>('/servers');
  const monitors = mockRouter<UptimeMonitor[]>('/services?type=http,tcp');
  const apps = mockRouter<ObservedService[]>('/observed-services');
  const infrastructure = mockRouter<InfrastructureResource[]>('/infrastructure-resources').filter(row => row.adapter === 'otel-collector');
  return servers.map(server => ({
    server,
    monitors: monitors.filter(row => row.serverId === server.id),
    apps: apps.filter(row => row.serverId === server.id),
    infrastructure: infrastructure.filter(row => row.serverId === server.id),
  }));
}

const json = (value: unknown) => JSON.stringify(value);

test('demo servers cover every layout the server screens need', () => {
  const rows = snapshot();
  const monitors = mockRouter<UptimeMonitor[]>('/services?type=http,tcp');
  const apps = mockRouter<ObservedService[]>('/observed-services');
  const infrastructure = mockRouter<InfrastructureResource[]>('/infrastructure-resources');
  const ids = new Set(rows.map(row => row.server.id));
  // 모든 직접 대상은 서버 하나에 속하고, 그룹은 그 서버의 그룹이다. Docker 환경의 리소스는 같은 ID의 서버에 속한다(ADR 0012).
  for (const target of [...monitors, ...apps, ...infrastructure.filter(row => row.adapter === 'otel-collector')]) {
    expect(ids.has(target.serverId!)).toBe(true);
    expect(target.projectId).toBe(rows.find(row => row.server.id === target.serverId)!.server.projectId);
  }
  expect(infrastructure.filter(row => row.adapter === 'everyup-agent').every(row => row.serverId === row.id)).toBe(true);

  const signals = (row: typeof rows[number]) => new Set([
    ...(row.monitors.length ? ['uptime'] : []), ...(row.infrastructure.length ? ['infrastructure'] : []),
    ...row.apps.flatMap(app => app.signals),
  ]);
  const full = rows.filter(row => ['uptime', 'infrastructure', 'logs', 'traces', 'metrics'].every(signal => signals(row).has(signal)));
  expect(full.some(row => row.apps.filter(app => app.signals.includes('logs')).length >= 2)).toBe(true);
  expect(rows.some(row => signals(row).size > 0 && !full.includes(row) && !(row.monitors.length && signals(row).size === 1))).toBe(true);
  expect(rows.some(row => row.monitors.length > 0 && row.apps.length === 0 && row.infrastructure.length === 0)).toBe(true);
  const empty = rows.filter(row => row.monitors.length + row.apps.length + row.infrastructure.length === 0);
  expect(empty.map(row => [row.server.name, row.server.projectId])).toEqual([['staging-empty', undefined]]);
  expect(rows.some(row => row.monitors.length >= 2)).toBe(true);
  expect(rows.some(row => row.monitors.length === 1)).toBe(true);
  expect(rows.some(row => row.monitors.some(monitor => monitor.status === 'unhealthy'))).toBe(true);
  expect(inScenario('normal', snapshot).some(row => row.monitors.some(monitor => monitor.status === 'unhealthy'))).toBe(false);
  expect(new Set(rows.map(row => row.server.projectId ?? 'none')).size).toBeGreaterThanOrEqual(3);

  // empty 시나리오는 처음부터 있던 서버를 숨긴다.
  expect(inScenario('empty', () => mockRouter<Server[]>('/servers'))).toEqual([]);

  // 그룹의 개수는 서버를 거쳐 센다.
  for (const project of mockRouter<Project[]>('/projects')) {
    expect(project.serverCount).toBe(rows.filter(row => row.server.projectId === project.id).length);
    expect(project.monitorCount).toBe(rows.filter(row => row.server.projectId === project.id).reduce((sum, row) => sum + row.monitors.length, 0));
  }

  // 장애 이력의 업타임 경로는 서버 화면이다.
  const timeline = mockRouter<TimelineIncident[]>('/incidents/timeline').filter(row => row.source === 'uptime');
  expect(timeline.length).toBeGreaterThan(0);
  for (const incident of timeline) expect(incident.targetPath).toMatch(/^\/servers\/server_mock_[^/]+\/monitors\/uptime_mock_[^/]+$/);
});

test('log summary and patterns narrow to one server', () => {
  const rows = snapshot();
  const server = rows.find(row => row.apps.filter(app => app.signals.includes('logs')).length >= 2)!;
  const appIds = server.apps.map(app => app.id);
  const summaries = mockRouter<LogServiceSummary[]>(`/logs/summary?serverId=${server.server.id}`);
  expect(summaries.map(row => row.serviceId).sort()).toEqual(server.apps.filter(app => app.signals.includes('logs')).map(app => app.id).sort());
  const patterns = mockRouter<LogPattern[]>(`/logs/patterns?limit=50&serverId=${server.server.id}`);
  expect(patterns.length).toBeGreaterThan(0);
  expect(patterns.every(row => appIds.includes(row.serviceId!))).toBe(true);
  expect(mockRouter<LogServiceSummary[]>('/logs/summary').length).toBeGreaterThan(summaries.length);
});

test('the demo outage stays one consistent episode', () => {
  const read = () => mockRouter<UptimeMonitor[]>('/services?type=http,tcp&include=checks').find(row => row.id === 'uptime_mock_checkout')!;
  const first = read();
  expect(first.status).toBe('unhealthy');
  expect(first.recentChecks![0].status).toBe('failure');
  expect(read().activeIncident!.startedAt).toBe(first.activeIncident!.startedAt);
  const since = Date.parse(first.activeIncident!.startedAt);
  const metrics = mockRouter<UptimeMonitorMetric[]>('/services/uptime_mock_checkout/metrics');
  expect(metrics.filter(row => Date.parse(row.checkedAt) >= since).every(row => row.status === 'failure')).toBe(true);
  expect(mockRouter<UptimeMonitorSummary>('/services/uptime_mock_checkout/metrics/summary').failedChecks).toBeGreaterThan(0);
  const normal = inScenario('normal', () => mockRouter<UptimeMonitor[]>('/services?type=http,tcp&include=checks').find(row => row.id === 'uptime_mock_checkout')!);
  expect(normal.status).toBe('healthy');
  expect(normal.activeIncident).toBeUndefined();
  expect(normal.recentChecks!.every(row => row.status === 'success')).toBe(true);
  expect(inScenario('normal', () => mockRouter<UptimeMonitorMetric[]>('/services/uptime_mock_checkout/metrics')).every(row => row.status === 'success')).toBe(true);
});

// 점검 A6: 같은 모니터의 24시간·30일·90일 수치가 목록, 상세 KPI, 막대 이력에서 서로 맞아야 한다.
test('uptime figures agree across the list, the detail KPIs and the daily bars', () => {
  for (const scenario of ['attention', 'normal'] as const) inScenario(scenario, () => {
    for (const monitor of mockRouter<UptimeMonitor[]>('/services?type=http,tcp').filter(row => row.isActive)) {
      const checks = mockRouter<UptimeMonitorMetric[]>(`/services/${monitor.id}/metrics?limit=100000`);
      const day = checks.filter(row => Date.parse(row.checkedAt) >= Date.now() - 86_400_000);
      const failed = day.filter(row => row.status === 'failure').length;
      expect(monitor.uptime, `${scenario} ${monitor.name} 24h`).toBeCloseTo((day.length - failed) / day.length * 100, 2);
      const history = mockRouter<UptimeMonitorHistory>(`/services/${monitor.id}/uptime`);
      expect(history.days[0].uptime, `${scenario} ${monitor.name} today bar`).toBeCloseTo(monitor.uptime!, 2);
      expect(history.percentage, `${scenario} ${monitor.name} 90d`).toBeCloseTo(history.days.reduce((sum, row) => sum + row.uptime, 0) / history.days.length, 4);
      const month = history.days.slice(0, 30).reduce((sum, row) => sum + row.uptime, 0) / 30;
      expect(mockRouter<UptimeMonitorSummary>(`/services/${monitor.id}/metrics/summary`).uptime, `${scenario} ${monitor.name} 30d`).toBeCloseTo(month, 1);
    }
  });
});

// 실제 API처럼 2·5·20분 버킷이 빈틈없이 이어져야 응답 시간 차트가 떨어진 점이 아니라 선으로 그려진다.
test('Docker service response buckets match the chart bucket size', () => {
  const service = mockRouter<AgentServiceFlat[]>('/agents/services/all')[0];
  for (const [range, bucketMs] of [['1h', 120_000], ['6h', 300_000], ['24h', 1_200_000]] as const) {
    const points = mockRouter<ServiceHistoryPoint[]>(`/agents/${service.agentId}/services/${encodeURIComponent(service.key)}/history?range=${range}`);
    const times = points.map(row => Date.parse(row.time));
    expect(times.every(t => t % bucketMs === 0), range).toBe(true);
    expect(times.slice(1).every((t, i) => t - times[i] === bucketMs), range).toBe(true);
    expect(points.length, range).toBeGreaterThanOrEqual({ '1h': 30, '6h': 72, '24h': 72 }[range]);
  }
});

test('server responses are copies and groups must exist', () => {
  const before = mockRouter<Server[]>('/servers');
  const created = mockRouter<Server>('/servers', 'POST', json({ name: 'e2e-copy' }));
  expect(mockRouter<Server>(`/servers/${created.id}`)).not.toBe(mockRouter<Server>(`/servers/${created.id}`));
  mockRouter(`/servers/${created.id}`, 'PUT', json({ name: 'e2e-copy-renamed' }));
  const after = mockRouter<Server[]>('/servers');
  expect(after).not.toBe(before);
  expect(after.find(row => row.id === created.id)!.name).toBe('e2e-copy-renamed');
  expect(created.name).toBe('e2e-copy');
  expect(() => mockRouter('/servers', 'POST', json({ name: 'e2e-orphan', projectId: 'project_missing' }))).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'group not found' }));
  expect(() => mockRouter(`/servers/${created.id}`, 'PUT', json({ name: 'e2e-copy', projectId: 'project_missing' }))).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  mockRouter(`/servers/${created.id}`, 'DELETE');
});

test('server writes follow the backend rules', () => {
  expect(() => mockRouter('/servers/missing')).toThrow('server not found');
  const created = mockRouter<Server>('/servers', 'POST', json({ name: 'e2e-host' }));
  expect(created.id).toBeTruthy();
  expect(() => mockRouter('/servers', 'POST', json({ name: '  E2E-HOST ' }))).toThrow(expect.objectContaining({ code: 'SERVER_NAME_TAKEN', status: 409 }));
  const grouped = mockRouter<Server>('/servers', 'POST', json({ name: 'e2e-host', projectId: 'project_mock_staging' }));
  expect(() => mockRouter(`/servers/${grouped.id}`, 'PUT', json({ name: 'E2E-host' }))).toThrow(expect.objectContaining({ code: 'SERVER_NAME_TAKEN' }));

  // serverId 없는 생성은 이름과 그룹으로 서버를 찾는다. 인프라 리소스가 이미 있으면 (2)를 붙인 서버를 만든다.
  const monitor = mockRouter<UptimeMonitor>('/services', 'POST', json({ name: 'e2e-host', type: 'http', url: 'https://e2e.example.com' }));
  expect(monitor.serverId).toBe(created.id);
  const infra = mockRouter<InfrastructureResource>('/infrastructure-resources', 'POST', json({ name: 'E2E-host' }));
  expect(infra.serverId).toBe(created.id);
  const second = mockRouter<InfrastructureResource>('/infrastructure-resources', 'POST', json({ name: 'e2e-host' }));
  expect(mockRouter<Server>(`/servers/${second.serverId}`).name).toBe('e2e-host (2)');
  expect(() => mockRouter('/infrastructure-resources', 'POST', json({ name: 'x', serverId: created.id }))).toThrow(expect.objectContaining({ code: 'SERVER_HAS_INFRASTRUCTURE' }));
  expect(() => mockRouter(`/servers/${second.serverId}/merge`, 'POST', json({ targetServerId: created.id }))).toThrow(expect.objectContaining({ code: 'SERVER_HAS_INFRASTRUCTURE' }));
  expect(() => mockRouter(`/infrastructure-resources/${second.id}`, 'PUT', json({ name: 'e2e-host', serverId: created.id }))).toThrow(expect.objectContaining({ code: 'SERVER_HAS_INFRASTRUCTURE' }));

  // 수정의 serverId는 이동이고, serverId 없는 수정의 projectId는 서버의 그룹이 된다.
  const app = mockRouter<ObservedService>('/observed-services', 'POST', json({ name: 'e2e-app', signals: ['logs'], serverId: grouped.id }));
  expect(app.projectId).toBe('project_mock_staging');
  expect(mockRouter<ObservedService>(`/observed-services/${app.id}`, 'PUT', json({ name: 'e2e-app', signals: ['logs'], serverId: created.id })).serverId).toBe(created.id);
  mockRouter(`/observed-services/${app.id}`, 'PUT', json({ name: 'e2e-app', signals: ['logs'], projectId: 'project_mock_backoffice' }));
  expect(mockRouter<Server>(`/servers/${created.id}`).projectId).toBe('project_mock_backoffice');
  expect(mockRouter<UptimeMonitor>(`/services/${monitor.id}`).projectId).toBe('project_mock_backoffice');
  // 옛 화면의 요청(serverId도 projectId도 없음)은 서버의 그룹을 해제한다. 화면의 타입은 serverId를 강제한다.
  mockRouter(`/observed-services/${app.id}`, 'PUT', json({ name: 'e2e-app', signals: ['logs'] }));
  expect(mockRouter<Server>(`/servers/${created.id}`).projectId).toBeUndefined();

  // 합치기는 대상을 옮기고 원래 서버를 지운다. 삭제는 소속 대상을 함께 지운다.
  const merged = mockRouter<Server>(`/servers/${grouped.id}/merge`, 'POST', json({ targetServerId: created.id }));
  expect(merged.id).toBe(created.id);
  expect(() => mockRouter(`/servers/${grouped.id}`)).toThrow('server not found');
  mockRouter(`/servers/${created.id}`, 'DELETE');
  mockRouter(`/servers/${second.serverId}`, 'DELETE');
  expect(mockRouter<UptimeMonitor[]>('/services?type=http,tcp').some(row => row.id === monitor.id)).toBe(false);
  expect(mockRouter<ObservedService[]>('/observed-services').some(row => row.id === app.id)).toBe(false);
  expect(mockRouter<InfrastructureResource[]>('/infrastructure-resources').some(row => row.id === infra.id || row.id === second.id)).toBe(false);
  expect(mockRouter<Server[]>('/servers').some(row => row.name.startsWith('e2e-host'))).toBe(false);
});

test('the attention scenario flags the metric over its threshold on its server', () => {
  const rows = () => buildServerRows({
    servers: mockRouter<Server[]>('/servers'),
    monitors: mockRouter<UptimeMonitor[]>('/services?type=http,tcp'),
    apps: mockRouter<ObservedService[]>('/observed-services'),
    infrastructure: mockRouter<InfrastructureResource[]>('/infrastructure-resources'),
    logSummaries: mockRouter<LogServiceSummary[]>('/logs/summary'),
    metricCatalog: mockRouter<ObservedServiceMetricName[]>('/observed-services/metric-catalog'),
  });
  const db = rows().find(row => row.server.id === 'server_mock_db_primary_01')!;
  // 첫 메트릭 앱(catalog-worker)의 첫 지표가 임계값을 넘는다. 메트릭 기능이 확인 필요이고 까닭이 임계값 초과다.
  expect(db.breachedApps).toEqual(['observed_mock_catalog']);
  expect(db.state).toBe('warn');
  expect(db.capabilities.metrics).toBe('warn');
  expect(capabilityLabel(db, 'metrics', 'warn')).toBe('임계값 초과');
  // 서버의 원인은 같은 확인 필요 가운데 앞선 인프라(메모리)다. 대상의 순서는 모니터, 인프라, 앱이다.
  expect(db.cause?.text).toBe('메모리 84.6%');
  // normal 시나리오에는 임계값 초과가 없다.
  expect(inScenario('normal', () => rows().every(row => row.breachedApps.length === 0))).toBe(true);
});

test('the normal scenario has no server in trouble, and its host charts stay below the warning line', () => {
  const rows = inScenario('normal', () => buildServerRows({
    servers: mockRouter<Server[]>('/servers'),
    monitors: mockRouter<UptimeMonitor[]>('/services?type=http,tcp'),
    apps: mockRouter<ObservedService[]>('/observed-services'),
    infrastructure: mockRouter<InfrastructureResource[]>('/infrastructure-resources'),
    logSummaries: mockRouter<LogServiceSummary[]>('/logs/summary'),
    metricCatalog: mockRouter<ObservedServiceMetricName[]>('/observed-services/metric-catalog'),
  }));
  expect(rows.filter(row => row.state === 'error' || row.state === 'warn').map(row => row.server.name)).toEqual([]);
  // 현재 값과 차트가 같은 수준이다. 차트의 어느 점도 경고선(70%)에 닿지 않는다.
  for (const resource of inScenario('normal', () => mockRouter<InfrastructureResource[]>('/infrastructure-resources')).filter(row => row.adapter === 'otel-collector')) {
    const info = inScenario('normal', () => mockRouter<{ cpu: { usage: number }; memory: { usage: number } }>(`/hosts/${resource.id}/system/info`));
    expect([info.cpu.usage, info.memory.usage]).toEqual([resource.cpuUsage, resource.memoryUsage]);
    const { points } = inScenario('normal', () => mockRouter<{ points: { cpu: number; memUsage: number; diskUsage: number }[] }>(`/hosts/${resource.id}/system/metrics?range=24h`));
    expect(Math.max(...points.flatMap(point => [point.cpu, point.memUsage, point.diskUsage]))).toBeLessThan(70);
  }
  // 확인 필요 시나리오의 높은 사용률은 그대로다.
  expect(mockRouter<InfrastructureResource[]>('/infrastructure-resources').find(row => row.id === 'infra_mock_db_01')!.memoryUsage).toBe(84.6);
});
