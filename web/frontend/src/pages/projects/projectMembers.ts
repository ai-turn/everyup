import type { StatusTone } from '../../components/common';
import { api, type AgentServiceFlat, type ConnectedAgent, type Server } from '../../services/api';
import { isCollectorFresh } from '../../utils/operationalStatus';
import { serverPath } from '../../features/servers/serverPaths';
import { STATE_LABEL, STATE_ORDER, worst, type ServerRow } from '../../features/servers/serverStatus';
import { readLatest } from '../../utils/readLatest';
import { ApiError, getErrorMessage } from '../../utils/errors';

// 그룹 목록의 상태 요약과 그룹 상세의 구성원 목록이 같은 판정을 쓰도록 한곳에 둔다.
// 둘이 따로 계산하면 목록은 "정상"인데 상세는 "장애"인 그룹이 생긴다.

export type MemberState = StatusTone;
// 그룹에 직접 배정되는 대상. Docker 서비스와 Docker 호스트의 인프라는 Docker 환경을, 서버의 대상은 서버를 따른다.
export type AssignableTarget =
  | { kind: 'agent'; item: ConnectedAgent }
  | { kind: 'server'; item: Server };

// icon·type은 대상 종류다. 종류가 섞인 목록이라 사이드바 메뉴와 같은 아이콘으로 어느 메뉴의 대상인지 보여 준다.
// cause는 서버 목록의 상태 아래 줄과 같은 원인 문구다(서버만).
export type Member = { key: string; to: string; icon: string; type: string; name: string; detail: string; cause?: string; state: MemberState; assignment?: AssignableTarget };

export type ProjectSources = { agents: ConnectedAgent[]; services: AgentServiceFlat[]; servers: ServerRow[] };

// 문제가 먼저(STATE_ORDER) — 대상이 많아도 장애가 목록 아래에 묻히지 않게 해서
// 이 화면의 KPI 카드(장애 수·수집 확인 필요 수)를 대신한다. 같은 상태 안에서는 유형 순서를 지킨다(안정 정렬).

// Docker 서비스는 그룹에 직접 배정되지 않고 Docker 환경의 그룹을 따른다(ADR 0003).
export function sourcesForProject(projectId: string, all: ProjectSources): ProjectSources {
  const agents = all.agents.filter((agent) => agent.projectId === projectId);
  const agentIds = new Set(agents.map((agent) => agent.id));
  return {
    agents,
    services: all.services.filter((service) => agentIds.has(service.agentId)),
    servers: all.servers.filter((row) => row.server.projectId === projectId),
  };
}

// 서버의 상태와 원인은 서버 목록과 같은 행(ServerRow)을 쓴다.
export function projectMembers({ agents, services, servers }: ProjectSources): Member[] {
  return [
    ...agents.map((agent): Member => ({ assignment: { kind: 'agent', item: agent }, key: `agent-${agent.id}`, to: `/agents/${agent.id}`, icon: 'deployed_code', type: 'Docker 환경', name: agent.name, detail: isCollectorFresh(agent.lastSeenAt) ? '데이터 유입 중' : '데이터 지연', state: isCollectorFresh(agent.lastSeenAt) ? 'healthy' : 'warn' })),
    ...services.filter((service) => !service.healthy).map((service): Member => ({ key: `service-${service.agentId}-${service.key}`, to: `/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=uptime`, icon: 'deployed_code', type: 'Docker 서비스', name: service.name, detail: '장애', state: 'error' })),
    ...servers.map((row): Member => ({ assignment: { kind: 'server', item: row.server }, key: `server-${row.server.id}`, to: serverPath(row.server.id), icon: 'dns', type: '서버', name: row.server.name, detail: STATE_LABEL[row.state], cause: row.cause?.text, state: row.state })),
  ].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
}

export const TARGET_KINDS: { kind: AssignableTarget['kind']; label: string }[] = [
  { kind: 'agent', label: 'Docker 환경' },
  { kind: 'server', label: '서버' },
];

export const targetKey = (target: AssignableTarget) => `${target.kind}-${target.item.id}`;

export function assignableTargets(all: ProjectSources): AssignableTarget[] {
  return [
    ...all.agents.map((item): AssignableTarget => ({ kind: 'agent', item })),
    ...all.servers.map((row): AssignableTarget => ({ kind: 'server', item: row.server })),
  ];
}

// projectId가 없으면 지금 그룹에서 뺀다. 배정은 덮어쓰기라 다른 그룹에 있던 대상은 그대로 옮겨진다.
// 서버의 수정은 전체 교체라 화면의 객체가 아니라 지금의 서버로 요청을 만든다(그 사이의 이름·설명 변경을 되돌리지 않게).
export async function setTargetGroup(target: AssignableTarget, projectId?: string): Promise<unknown> {
  if (target.kind === 'agent') return projectId ? api.assignAgent(projectId, target.item.id) : api.unassignAgent(target.item.projectId ?? '', target.item.id);
  const latest = await readLatest(() => api.getServer(target.item.id), '그룹 지정');
  return api.updateServer(latest.id, { name: latest.name, description: latest.description, projectId });
}

/** 그룹 지정(projectId)이나 해제(없음)가 실패한 까닭. 이름 충돌은 옮겨 갈 곳을 밝힌다. */
export function groupChangeFailure(cause: unknown, projectId?: string): string {
  if (cause instanceof ApiError && cause.code === 'SERVER_NAME_TAKEN') {
    return projectId ? '이 그룹에 같은 이름의 서버가 있습니다' : '미분류에 같은 이름의 서버가 있습니다';
  }
  return getErrorMessage(cause);
}

// 그룹 목록용 한 줄 요약. 가장 나쁜 상태가 점 색을 정한다.
export function summarizeMembers(members: Member[]): { tone: MemberState; label: string } {
  if (members.length === 0) return { tone: 'idle', label: '대상 없음' };
  const counts = { error: 0, warn: 0, idle: 0, healthy: 0 };
  for (const member of members) counts[member.state] += 1;
  const states = (Object.keys(STATE_ORDER) as MemberState[]).filter((state) => counts[state] > 0);
  // 점의 색은 서버와 같은 심각도 합산이다. 정상 여럿과 일시정지 하나는 정상이다. 문구의 나열은 정렬 순서 그대로다.
  return { tone: worst(states) ?? 'idle', label: states.map((state) => `${STATE_LABEL[state]} ${counts[state]}`).join(', ') };
}
