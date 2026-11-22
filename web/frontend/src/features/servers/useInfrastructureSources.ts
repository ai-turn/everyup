import { useEffect, useState } from 'react';
import { api, type ConnectedAgent } from '../../services/api';

/**
 * 서버의 호스트 지표 출처(서버당 하나, ADR 0012). 연결 대화 상자가 다른 출처가 이미 있는지 보고 하나를 고르게 할 때 쓴다.
 * 불러오는 중이거나 실패하면 undefined다: 그때는 묻지 않고 백엔드의 거절(409 INFRASTRUCTURE_SOURCE_REQUIRED)에 맡긴다.
 */

/** 서버에 연결 중인 OpenTelemetry Collector 인프라 리소스가 있는가. */
export function useActiveOtelInfrastructure(serverId?: string): boolean | undefined {
  const [active, setActive] = useState<{ serverId?: string; value: boolean }>();
  useEffect(() => {
    if (!serverId) return;
    let alive = true;
    api.getInfrastructureResources().then((resources) => {
      if (alive) setActive({ serverId, value: (resources ?? []).some((resource) => resource.serverId === serverId && resource.adapter === 'otel-collector' && resource.isActive) });
    }, () => {});
    return () => { alive = false; };
  }, [serverId]);
  return active && active.serverId === serverId ? active.value : undefined;
}

/** 서버의 Docker Collector. 없으면 null이다. */
export function useServerDockerCollector(serverId: string): ConnectedAgent | null | undefined {
  const [found, setFound] = useState<{ serverId: string; agent: ConnectedAgent | null }>();
  useEffect(() => {
    let alive = true;
    api.getAgents().then((agents) => {
      if (alive) setFound({ serverId, agent: (agents ?? []).find((agent) => agent.serverId === serverId) ?? null });
    }, () => {});
    return () => { alive = false; };
  }, [serverId]);
  return found?.serverId === serverId ? found.agent : undefined;
}

/** Docker Collector가 호스트 지표를 모으는가(프로필이 비어 있으면 모두 모은다). */
export const collectsHostMetrics = (agent: Pick<ConnectedAgent, 'profile'>) =>
  !agent.profile?.capabilities.length || agent.profile.capabilities.includes('infrastructure');
