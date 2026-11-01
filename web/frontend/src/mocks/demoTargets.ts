import type { ConnectedAgent, AgentServiceFlat, Project, ObservedService, InfrastructureResource, UptimeMonitor } from '../services/api';

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

export const additionalProjects: Project[] = [
  { id: 'project_mock_staging', name: 'Staging', description: '배포 전 검증 환경', agentCount: 0, monitorCount: 0, observedServiceCount: 0, infrastructureResourceCount: 0, createdAt: ago(14_400), updatedAt: ago(30) },
  { id: 'project_mock_backoffice', name: 'Backoffice', description: '주문·알림·정산 작업', agentCount: 0, monitorCount: 0, observedServiceCount: 0, infrastructureResourceCount: 0, createdAt: ago(10_080), updatedAt: ago(45) },
];

export const additionalAgents: ConnectedAgent[] = [
  { id: 'agent_demo_03', name: 'worker-cluster', projectId: 'project_mock_backoffice', version: '0.3.0', lastSeenAt: ago(0.2), createdAt: ago(20_160), updatedAt: ago(0.2), profile: { kind: 'all-in-one', capabilities: ['uptime', 'logs', 'infrastructure', 'api', 'metrics'] } },
  { id: 'agent_demo_04', name: 'edge-node', projectId: 'project_mock_staging', version: '0.3.0', lastSeenAt: ago(0.4), createdAt: ago(8640), updatedAt: ago(0.4), profile: { kind: 'all-in-one', capabilities: ['uptime', 'logs', 'infrastructure', 'api', 'metrics'] } },
];

export const additionalDockerServices: AgentServiceFlat[] = [
  { agentId: 'agent_demo_03', agentName: 'worker-cluster', key: 'jobs:catalog-worker', name: 'catalog-worker', runtime: 'java', checkType: 'http', endpoint: 'http://catalog-worker:8081/health', image: 'ghcr.io/shop/catalog:3.2.0', lastLatency: '320ms' },
  { agentId: 'agent_demo_03', agentName: 'worker-cluster', key: 'jobs:notification-worker', name: 'notification-worker', runtime: 'node', checkType: 'http', endpoint: 'http://notification-worker:8082/health', image: 'ghcr.io/shop/notifications:1.12.0', lastLatency: '75ms' },
  { agentId: 'agent_demo_03', agentName: 'worker-cluster', key: 'redis', name: 'redis', checkType: 'tcp', endpoint: 'redis:6379', image: 'redis:7-alpine', lastLatency: '3ms' },
  { agentId: 'agent_demo_04', agentName: 'edge-node', key: 'edge:nginx', name: 'nginx', checkType: 'http', endpoint: 'http://nginx/health', image: 'nginx:1.27-alpine', lastLatency: '12ms' },
  { agentId: 'agent_demo_04', agentName: 'edge-node', key: 'edge:search-api', name: 'search-api', runtime: 'go', checkType: 'http', endpoint: 'http://search-api:8080/health', image: 'ghcr.io/shop/search:2.1.0', lastLatency: '67ms' },
  { agentId: 'agent_demo_04', agentName: 'edge-node', key: 'edge:inventory-api', name: 'inventory-api', runtime: 'python', checkType: 'http', endpoint: 'http://inventory-api:8000/health', image: 'ghcr.io/shop/inventory:0.9.4', lastLatency: '32ms' },
].map(service => ({ ...service, healthy: true, seen: true, silenced: false, restartCount: 0, startedAt: ago(4320), lastStatus: service.checkType === 'http' ? 200 : 0, observedAt: ago(0.3), updatedAt: ago(0.3) }));

export const additionalObservedServices: ObservedService[] = ([
  { id: 'observed_mock_orders', name: 'orders-api', projectId: 'project_mock_production', signals: ['logs', 'traces', 'metrics'] },
  { id: 'observed_mock_inventory', name: 'inventory-api', projectId: 'project_mock_production', signals: ['logs', 'traces', 'metrics'] },
  { id: 'observed_mock_notifications', name: 'notification-worker', projectId: 'project_mock_backoffice', signals: ['logs', 'metrics'] },
  { id: 'observed_mock_search', name: 'search-api', projectId: 'project_mock_staging', signals: ['logs', 'traces'] },
  { id: 'observed_mock_billing', name: 'billing-worker', projectId: 'project_mock_backoffice', signals: ['logs', 'metrics'] },
] satisfies Pick<ObservedService, 'id' | 'name' | 'projectId' | 'signals'>[])
  .map((service, i) => ({ ...service, isActive: true, logLevelFilter: ['error', 'warn', 'info'], apiKeyMasked: `evup_****${4010 + i}`, lastSeenAt: ago(0.3 + i * 0.1), createdAt: ago(7200 + i * 1440), updatedAt: ago(0.3) }));

export const additionalInfrastructure: InfrastructureResource[] = [
  { id: 'infra_mock_db_01', name: 'db-primary-01', projectId: 'project_mock_production', cpuUsage: 48.2, memoryUsage: 84.6, diskUsage: 68.3 },
  { id: 'infra_mock_worker_01', name: 'batch-host-01', projectId: 'project_mock_backoffice', cpuUsage: 76.1, memoryUsage: 62.4, diskUsage: 35.7 },
  { id: 'infra_mock_staging_01', name: 'staging-host-01', projectId: 'project_mock_staging', cpuUsage: 18.5, memoryUsage: 31.8, diskUsage: 22.1 },
].map((resource, i) => ({ ...resource, adapter: 'otel-collector', isActive: true, apiKeyMasked: `evup_****${5200 + i}`, lastSeenAt: ago(0.3), createdAt: ago(8640), updatedAt: ago(0.3) }));

export const additionalMonitors: UptimeMonitor[] = ([
  { id: 'uptime_mock_payments', name: 'Payment endpoint', projectId: 'project_mock_production', type: 'http', url: 'https://payments.example.com/health', responseTime: 320, uptime: 99.72 },
  { id: 'uptime_mock_docs', name: 'Documentation', projectId: 'project_mock_staging', type: 'http', url: 'https://docs.example.com', responseTime: 86, uptime: 100 },
  { id: 'uptime_mock_database', name: 'Orders PostgreSQL', projectId: 'project_mock_backoffice', type: 'tcp', url: 'orders-db.example.com', port: 5432, responseTime: 8, uptime: 99.99 },
  { id: 'uptime_mock_status', name: 'Public status', projectId: 'project_mock_production', type: 'http', url: 'https://status.example.com', responseTime: 54, uptime: 100 },
] satisfies Pick<UptimeMonitor, 'id' | 'name' | 'projectId' | 'type' | 'url' | 'port' | 'responseTime' | 'uptime'>[])
  .map((monitor, index) => ({ ...monitor, isActive: true, method: 'GET', expectedStatus: 200, timeout: 5000, interval: 30, status: 'healthy', lastCheckAt: ago(0.2), latencyHistory: Array.from({ length: 24 }, (_, i) => Math.round(monitor.responseTime! * (1 + Math.sin((i + index) / 4) * 0.2))), certExpiresAt: monitor.type === 'http' ? new Date(now + (45 + index * 12) * 86_400_000).toISOString() : undefined }));
