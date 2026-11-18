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

export const serversApi = {
  getServers: () => request<Server[]>('/servers'),
  getServer: (id: string) => request<Server>(`/servers/${id}`),
  createServer: (data: ServerInput) => request<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  updateServer: (id: string, data: ServerInput) => request<Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServer: (id: string) => request<void>(`/servers/${id}`, { method: 'DELETE' }),
  mergeServer: (id: string, targetServerId: string) => request<Server>(`/servers/${id}/merge`, { method: 'POST', body: JSON.stringify({ targetServerId }) }),
};
