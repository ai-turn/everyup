import type { StatusTone } from '../../components/common';
import { api, type AgentServiceFlat, ConnectedAgent, InfrastructureResource, ObservedService, UptimeMonitor } from '../../services/api';
import { isCollectorFresh } from '../../utils/operationalStatus';

// 그룹 목록의 상태 요약과 그룹 상세의 구성원 목록이 같은 판정을 쓰도록 한곳에 둔다.
// 둘이 따로 계산하면 목록은 "정상"인데 상세는 "장애"인 그룹이 생긴다.

export type MemberState = StatusTone;
// 그룹에 직접 배정되는 대상. Docker 서비스와 Docker 호스트의 인프라는 Docker 환경을 따르므로 여기 없다.
export type AssignableTarget =
  | { kind: 'agent'; item: ConnectedAgent }
  | { kind: 'monitor'; item: UptimeMonitor }
  | { kind: 'direct'; item: ObservedService }
  | { kind: 'infra'; item: InfrastructureResource };

// icon·type은 대상 종류다. 종류가 섞인 목록이라 사이드바 메뉴와 같은 아이콘으로 어느 메뉴의 대상인지 보여 준다.
export type Member = { key: string; to: string; icon: string; type: string; name: string; detail: string; state: MemberState; assignment?: AssignableTarget };

export type ProjectSources = {
  agents: ConnectedAgent[];
  services: AgentServiceFlat[];
  monitors: UptimeMonitor[];
  observedServices: ObservedService[];
  infrastructure: InfrastructureResource[];
};

// 문제가 먼저 — 장애, 수집 지연, 비활성, 정상. 대상이 많아도 장애가 목록 아래에 묻히지 않게 해서
// 이 화면의 KPI 카드(장애 수·수집 확인 필요 수)를 대신한다. 같은 상태 안에서는 유형 순서를 지킨다(안정 정렬).
export const STATE_ORDER: Record<MemberState, number> = { error: 0, warn: 1, idle: 2, healthy: 3 };

// Docker 서비스는 그룹에 직접 배정되지 않고 Docker 환경의 그룹을 따른다(ADR 0003).
export function sourcesForProject(projectId: string, all: ProjectSources): ProjectSources {
  const agents = all.agents.filter((agent) => agent.projectId === projectId);
  const agentIds = new Set(agents.map((agent) => agent.id));
  return {
    agents,
    services: all.services.filter((service) => agentIds.has(service.agentId)),
    monitors: all.monitors.filter((monitor) => monitor.projectId === projectId),
    observedServices: all.observedServices.filter((service) => service.projectId === projectId),
    infrastructure: all.infrastructure.filter((resource) => resource.projectId === projectId),
  };
}

// 직접 연결 서비스는 여는 화면(로그 > 메트릭 > API 순)과 같은 메뉴의 아이콘을 쓴다.
const directKind = (service: ObservedService) => service.signals.includes('logs') ? { to: `/logs/${service.id}`, icon: 'article', type: '로그' }
  : service.signals.includes('metrics') ? { to: `/metrics/${service.id}`, icon: 'monitoring', type: '메트릭' }
  : { to: `/api/${service.id}`, icon: 'api', type: 'API 요청' };

// key에 유형을 붙인다 — Docker 호스트의 인프라 리소스는 환경과 같은 id를 쓴다.
// 직접 연결 서비스는 lastSeenAt이 오래돼도 정상으로 둔다 — 로그·트레이스는 사건이 있을 때만 오므로
// 조용한 것이 장애가 아니다. 개요 화면도 "한 번도 수신하지 않음"만 확인 대상으로 센다.
export function projectMembers({ agents, services, monitors, observedServices, infrastructure }: ProjectSources): Member[] {
  return [
    ...agents.map((agent): Member => ({ assignment: { kind: 'agent', item: agent }, key: `agent-${agent.id}`, to: `/agents/${agent.id}`, icon: 'dns', type: 'Docker 환경', name: agent.name, detail: isCollectorFresh(agent.lastSeenAt) ? '데이터 유입 중' : '데이터 지연', state: isCollectorFresh(agent.lastSeenAt) ? 'healthy' : 'warn' })),
    ...services.filter((service) => !service.healthy).map((service): Member => ({ key: `service-${service.agentId}-${service.key}`, to: `/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=uptime`, icon: 'deployed_code', type: 'Docker 서비스', name: service.name, detail: '장애', state: 'error' })),
    ...monitors.map((monitor): Member => ({ assignment: { kind: 'monitor', item: monitor }, key: `monitor-${monitor.id}`, to: `/uptime/${monitor.id}`, icon: 'monitor_heart', type: '업타임', name: monitor.name, detail: monitor.status === 'unhealthy' ? '장애' : monitor.status === 'healthy' ? '정상' : '상태 확인 중', state: monitor.status === 'unhealthy' ? 'error' : monitor.status === 'healthy' ? 'healthy' : 'idle' })),
    ...observedServices.map((service): Member => ({ assignment: { kind: 'direct', item: service }, key: `direct-${service.id}`, ...directKind(service), name: service.name, detail: service.isActive ? (service.lastSeenAt ? `마지막 수신 ${new Date(service.lastSeenAt).toLocaleString()}` : '데이터 대기 중') : '연결 비활성화됨', state: service.isActive ? (service.lastSeenAt ? 'healthy' : 'warn') : 'idle' })),
    ...infrastructure.map((resource): Member => ({ assignment: isDirectInfrastructure(resource) ? { kind: 'infra', item: resource } : undefined, key: `infra-${resource.id}`, to: `/infrastructure/${resource.id}`, icon: 'memory', type: '인프라', name: resource.name, detail: resource.isActive ? (isCollectorFresh(resource.lastSeenAt) ? '데이터 유입 중' : '데이터 확인 필요') : 'Collector 비활성화됨', state: resource.isActive ? (isCollectorFresh(resource.lastSeenAt) ? 'healthy' : 'warn') : 'idle' })),
  ].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
}

const isDirectInfrastructure = (resource: InfrastructureResource) => resource.adapter === 'otel-collector';

export const TARGET_KINDS: { kind: AssignableTarget['kind']; label: string }[] = [
  { kind: 'agent', label: 'Docker 환경' },
  { kind: 'monitor', label: '업타임 모니터' },
  { kind: 'direct', label: '직접 연결 서비스' },
  { kind: 'infra', label: 'Collector' },
];

export const targetKey = (target: AssignableTarget) => `${target.kind}-${target.item.id}`;

export function assignableTargets(all: ProjectSources): AssignableTarget[] {
  return [
    ...all.agents.map((item): AssignableTarget => ({ kind: 'agent', item })),
    ...all.monitors.map((item): AssignableTarget => ({ kind: 'monitor', item })),
    ...all.observedServices.map((item): AssignableTarget => ({ kind: 'direct', item })),
    ...all.infrastructure.filter(isDirectInfrastructure).map((item): AssignableTarget => ({ kind: 'infra', item })),
  ];
}

// projectId가 없으면 지금 그룹에서 뺀다. 배정은 덮어쓰기라 다른 그룹에 있던 대상은 그대로 옮겨진다.
export function setTargetGroup(target: AssignableTarget, projectId?: string): Promise<unknown> {
  switch (target.kind) {
    case 'agent': return projectId ? api.assignAgent(projectId, target.item.id) : api.unassignAgent(target.item.projectId ?? '', target.item.id);
    case 'monitor': return projectId ? api.assignMonitor(projectId, target.item.id) : api.unassignMonitor(target.item.projectId ?? '', target.item.id);
    case 'direct': return api.updateObservedService(target.item.id, { name: target.item.name, projectId, signals: target.item.signals });
    case 'infra': return api.updateInfrastructureResource(target.item.id, { name: target.item.name, projectId });
  }
}

const STATE_LABEL: Record<MemberState, string> = { error: '장애', warn: '확인 필요', idle: '대기', healthy: '정상' };

// 그룹 목록용 한 줄 요약. 가장 나쁜 상태가 점 색을 정한다.
export function summarizeMembers(members: Member[]): { tone: MemberState; label: string } {
  if (members.length === 0) return { tone: 'idle', label: '대상 없음' };
  const counts = { error: 0, warn: 0, idle: 0, healthy: 0 };
  for (const member of members) counts[member.state] += 1;
  const states = (Object.keys(STATE_ORDER) as MemberState[]).filter((state) => counts[state] > 0);
  return { tone: states[0], label: states.map((state) => `${STATE_LABEL[state]} ${counts[state]}`).join(', ') };
}
