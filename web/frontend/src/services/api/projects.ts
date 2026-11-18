import { request } from './base';

export interface Project {
  id: string;
  name: string;
  description?: string;
  agentCount: number;
  monitorCount: number;
  observedServiceCount: number;
  infrastructureResourceCount: number;
  serverCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description?: string;
}

export const projectsApi = {
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: ProjectInput) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: ProjectInput) => request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  assignAgent: (projectId: string, agentId: string) => request<void>(`/projects/${projectId}/agents/${agentId}`, { method: 'PUT' }),
  unassignAgent: (projectId: string, agentId: string) => request<void>(`/projects/${projectId}/agents/${agentId}`, { method: 'DELETE' }),
  assignMonitor: (projectId: string, monitorId: string) => request<void>(`/projects/${projectId}/monitors/${monitorId}`, { method: 'PUT' }),
  unassignMonitor: (projectId: string, monitorId: string) => request<void>(`/projects/${projectId}/monitors/${monitorId}`, { method: 'DELETE' }),
};
