import { request } from './base';

// --- Types ---

export interface SystemInfo {
  hostname: string;
  os: string;
  platform: string;
  kernel?: string;
  uptime: number;
  ip: string;
  cpu: { cores: number; usage: number };
  memory: { total: number; used: number; usage: number };
  disk: { total: number; used: number; usage: number; readSpeed: number; writeSpeed: number };
  network: { in: number; out: number }; // MB/s
}

export interface SystemMetricPoint {
  timestamp: string;
  cpu: number;
  memUsage: number;
  diskUsage: number;
  netIn: number;
  netOut: number;
}

export interface SystemMetricsHistory {
  range: string;
  points: SystemMetricPoint[];
}

export type InfrastructureAdapter = 'everyup-agent' | 'otel-collector';

export interface InfrastructureResource {
  id: string;
  name: string;
  /** Docker 환경에서 온 리소스(everyup-agent)에는 없다. */
  serverId?: string;
  adapter: InfrastructureAdapter;
  isActive: boolean;
  apiKeyMasked?: string;
  lastSeenAt?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InfrastructureResourceInput {
  name: string;
  /** 수정 요청에서도 필수다(ObservedServiceInput과 같은 이유). */
  serverId: string;
  /** `otel`: 서버의 Docker Collector가 호스트 지표를 모으면 그 수집을 빼고 이 리소스를 출처로 남긴다(ADR 0012). */
  infrastructure?: 'otel';
}

export interface InfrastructureResourceSetup extends InfrastructureResource {
  apiKey: string;
}

// --- API ---

export const hostsApi = {
  // System Resource Monitoring (host-scoped)
  getSystemInfo: (hostId: string) =>
    request<SystemInfo>(`/hosts/${hostId}/system/info`),

  getSystemMetricsHistory: (hostId: string, range?: string) => {
    const query = range ? `?range=${range}` : '';
    return request<SystemMetricsHistory>(`/hosts/${hostId}/system/metrics${query}`);
  },

  getInfrastructureResources: () =>
    request<InfrastructureResource[]>('/infrastructure-resources'),

  getInfrastructureResource: (id: string) =>
    request<InfrastructureResource>(`/infrastructure-resources/${id}`),

  createInfrastructureResource: (data: InfrastructureResourceInput) =>
    request<InfrastructureResourceSetup>('/infrastructure-resources', { method: 'POST', body: JSON.stringify(data) }),

  updateInfrastructureResource: (id: string, data: InfrastructureResourceInput) =>
    request<InfrastructureResource>(`/infrastructure-resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  rotateInfrastructureResourceKey: (id: string) =>
    request<InfrastructureResourceSetup>(`/infrastructure-resources/${id}/rotate-key`, { method: 'POST' }),

  revokeInfrastructureResourceKey: (id: string) =>
    request<InfrastructureResource>(`/infrastructure-resources/${id}/revoke-key`, { method: 'POST' }),

  deleteInfrastructureResource: (id: string) =>
    request<void>(`/infrastructure-resources/${id}`, { method: 'DELETE' }),
};
