import { request } from './base';

export interface Server {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerInput {
  name: string;
  description?: string;
  projectId?: string;
}

/**
 * 서버 수정(PUT)은 전체 교체다. 세 값을 모두 적어야 한다. 빼면 그 값이 지워진다(설명 없음, 그룹 해제).
 * 값이 없음은 undefined로 나타낸다.
 */
export interface ServerUpdate {
  name: string;
  description: string | undefined;
  projectId: string | undefined;
}

export const serversApi = {
  /** includeDocker adds the servers that are Docker environments (ADR 0012). Their Docker Collector comes from `getAgents` by `serverId`. */
  getServers: (options?: { includeDocker?: boolean }) => request<Server[]>(options?.includeDocker ? '/servers?include=docker' : '/servers'),
  getServer: (id: string) => request<Server>(`/servers/${id}`),
  createServer: (data: ServerInput) => request<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  updateServer: (id: string, data: ServerUpdate) => request<Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServer: (id: string) => request<void>(`/servers/${id}`, { method: 'DELETE' }),
  mergeServer: (id: string, targetServerId: string) => request<Server>(`/servers/${id}/merge`, { method: 'POST', body: JSON.stringify({ targetServerId }) }),
};
