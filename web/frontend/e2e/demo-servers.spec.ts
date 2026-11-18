import { expect, test } from '@playwright/test';
import { mockRouter } from '../src/services/mockRouter';
import type { MockScenario } from '../src/mocks/demoScenario';
import type {
  InfrastructureResource, LogPattern, LogServiceSummary, ObservedService, Project, Server, TimelineIncident, UptimeMonitor,
  UptimeMonitorMetric, UptimeMonitorSummary,
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
  // 모든 직접 대상은 서버 하나에 속하고, 그룹은 그 서버의 그룹이다. Docker 환경의 리소스에는 서버가 없다.
  for (const target of [...monitors, ...apps, ...infrastructure.filter(row => row.adapter === 'otel-collector')]) {
    expect(ids.has(target.serverId!)).toBe(true);
    expect(target.projectId).toBe(rows.find(row => row.server.id === target.serverId)!.server.projectId);
  }
  expect(infrastructure.filter(row => row.adapter === 'everyup-agent').every(row => row.serverId === undefined)).toBe(true);

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
  for (const incident of timeline) expect(incident.targetPath).toMatch(/^\/servers\/server_mock_[^/]+\/uptime\/uptime_mock_[^/]+$/);
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
  mockRouter(`/projects/project_mock_backoffice/monitors/${monitor.id}`, 'DELETE');
  expect(mockRouter<Server>(`/servers/${created.id}`).projectId).toBeUndefined();
  mockRouter(`/projects/project_mock_production/monitors/${monitor.id}`, 'PUT');
  expect(mockRouter<Server>(`/servers/${created.id}`).projectId).toBe('project_mock_production');

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
