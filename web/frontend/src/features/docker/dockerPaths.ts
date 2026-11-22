import type { AgentServiceFlat } from '../../services/api';

/** 컨테이너(Docker 서비스) 하나의 페이지. 서버·Docker 통합 2-2에서 서버 아래 주소로 옮긴다. */
export const containerPath = (service: Pick<AgentServiceFlat, 'agentId' | 'key'>) => `/services/${service.agentId}/${encodeURIComponent(service.key)}`;
