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

/** 같은 호스트를 합칠 때 남길 호스트 지표 출처: Docker Collector 또는 OpenTelemetry Collector. */
export type MergeInfrastructure = 'docker' | 'otel';

export interface SameHostDismissal { dockerServerId: string; serverId: string }

export const serversApi = {
  /** includeDocker adds the servers that are Docker environments (ADR 0012). Their Docker Collector comes from `getAgents` by `serverId`. */
  getServers: (options?: { includeDocker?: boolean }) => request<Server[]>(options?.includeDocker ? '/servers?include=docker' : '/servers'),
  getServer: (id: string) => request<Server>(`/servers/${id}`),
  /** `같은 호스트인가요?`에서 `아님`으로 답한 서버 쌍(ADR 0012). 모든 사용자에게 같다. */
  getSameHostDismissals: () => request<SameHostDismissal[]>('/same-host-dismissals'),
  dismissSameHost: (pair: SameHostDismissal) => request<SameHostDismissal>('/same-host-dismissals', { method: 'POST', body: JSON.stringify(pair) }),
  createServer: (data: ServerInput) => request<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  updateServer: (id: string, data: ServerUpdate) => request<Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServer: (id: string) => request<void>(`/servers/${id}`, { method: 'DELETE' }),
  /**
   * 서버 `id`의 대상을 모두 `targetServerId`로 옮기고 `id`를 지운다. Docker 서버도 합친다(같은 호스트, ADR 0012).
   * 합친 서버의 Docker Collector와 OpenTelemetry Collector가 둘 다 호스트 지표를 모으면 `infrastructure`로 하나를 고른다.
   */
  mergeServer: (id: string, targetServerId: string, infrastructure?: MergeInfrastructure) =>
    request<Server>(`/servers/${id}/merge`, { method: 'POST', body: JSON.stringify({ targetServerId, ...(infrastructure ? { infrastructure } : {}) }) }),
};
