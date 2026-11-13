// 규칙 목록(데스크톱 표·카드, 모바일 카드)이 같이 쓰는 표시 규칙.
import { useEffect, useState } from 'react';
import type { AlertTarget } from './alertTarget';
import { api, type AlertRule, type AgentServiceFlat, type ConnectedAgent, type InfrastructureResource, type ObservedService, type UptimeMonitor } from '../../services/api';

/** 규칙 대상의 이름을 찾는 목록들. 헬스체크 규칙의 serviceId는 업타임 모니터일 수 있다. */
export interface TargetNames {
  agentServices: AgentServiceFlat[];
  agents: ConnectedAgent[];
  directServices: ObservedService[];
  infrastructureResources: InfrastructureResource[];
  uptimeMonitors: UptimeMonitor[];
  /** 모든 목록을 받았는가. 하나라도 실패하면 이름이 없어도 지워졌다고 단정하지 않는다. */
  complete: boolean;
}

const EMPTY_NAMES: TargetNames = { agentServices: [], agents: [], directServices: [], infrastructureResources: [], uptimeMonitors: [], complete: false };

/** 대상 이름 목록을 규칙 조회와 따로 받는다. 이름 하나가 실패해도 규칙 목록은 그대로 보인다(A-05). */
export function useTargetNames(): TargetNames {
  const [names, setNames] = useState<TargetNames>(EMPTY_NAMES);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      api.getAllAgentServicesFlat(),
      api.getAgents(),
      api.getObservedServices(),
      api.getInfrastructureResources(),
      api.getUptimeMonitors(),
    ]).then(([agentServices, agents, directServices, infrastructureResources, uptimeMonitors]) => {
      if (!active) return;
      const rows = <T,>(result: PromiseSettledResult<T[] | null | undefined>): T[] => result.status === 'fulfilled' ? result.value ?? [] : [];
      setNames({
        agentServices: rows(agentServices),
        agents: rows(agents),
        directServices: rows(directServices),
        infrastructureResources: rows(infrastructureResources),
        uptimeMonitors: rows(uptimeMonitors),
        complete: [agentServices, agents, directServices, infrastructureResources, uptimeMonitors].every(result => result.status === 'fulfilled'),
      });
    });
    return () => { active = false; };
  }, []);
  return names;
}

// 이름을 찾지 못하면 지워진 대상이다. 이름 목록을 다 받지 못했을 때는 id만 보인다(지워졌는지 모름).
function missingTarget(id: string, names: TargetNames): string {
  return names.complete ? `삭제된 대상 (${id})` : id;
}

export function targetLabel(rule: AlertRule, names: TargetNames): string {
  const { agentServices, agents, directServices, infrastructureResources, uptimeMonitors } = names;
  if (rule.type === 'service' || rule.type === 'log' || rule.type === 'request') {
    if (rule.serviceId) return directServices.find(service => service.id === rule.serviceId)?.name
      ?? uptimeMonitors.find(monitor => monitor.id === rule.serviceId)?.name
      ?? missingTarget(rule.serviceId, names);
    if (rule.agentId && rule.serviceKey) {
      const svc = agentServices.find(s => s.agentId === rule.agentId && s.key === rule.serviceKey);
      return svc ? `${svc.agentName} / ${svc.name}` : missingTarget(rule.serviceKey, names);
    }
    // Request rules can also watch a whole Docker environment (API-created).
    if (rule.type === 'request' && rule.agentId) return agents.find(a => a.id === rule.agentId)?.name ?? missingTarget(rule.agentId, names);
    return rule.type === 'log' ? '전체 로그 서비스' : rule.metric === 'otel_metric' ? '모든 서비스' : '전체 헬스체크';
  }
  if (rule.agentId) return infrastructureResources.find(resource => resource.id === rule.agentId)?.name ?? agents.find(a => a.id === rule.agentId)?.name ?? missingTarget(rule.agentId, names);
  return '전체 인프라';
}

/** 대상 필터 줄의 이름. */
export function alertTargetName(target: AlertTarget, names: TargetNames): string {
  if (target.kind === 'direct') {
    return names.directServices.find(service => service.id === target.serviceId)?.name
      ?? names.uptimeMonitors.find(monitor => monitor.id === target.serviceId)?.name
      ?? missingTarget(target.serviceId, names);
  }
  if (target.kind === 'infrastructure') {
    return names.infrastructureResources.find(resource => resource.id === target.resourceId)?.name ?? missingTarget(target.resourceId, names);
  }
  const service = names.agentServices.find(item => item.agentId === target.agentId && item.key === target.serviceKey);
  return service ? `${service.agentName} / ${service.name}` : missingTarget(target.serviceKey, names);
}
