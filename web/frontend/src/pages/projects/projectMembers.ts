import type { StatusTone } from '../../components/common';
import { api, type Server } from '../../services/api';
import { serverPath } from '../../features/servers/serverPaths';
import { STATE_LABEL, STATE_ORDER, worst, type ServerRow } from '../../features/servers/serverStatus';
import { readLatest } from '../../utils/readLatest';
import { ApiError, getErrorMessage } from '../../utils/errors';

// 그룹 목록의 상태 요약과 그룹 상세의 구성원 목록이 같은 판정을 쓰도록 한곳에 둔다.
// 둘이 따로 계산하면 목록은 "정상"인데 상세는 "장애"인 그룹이 생긴다.

export type MemberState = StatusTone;
// 그룹에 직접 배정되는 대상은 서버다. 서버의 대상(모니터, 앱, 인프라)과 Docker Collector의 컨테이너는 서버를 따른다.
// Docker 환경도 같은 ID의 서버라(ADR 0012) 따로 배정하지 않는다: 서버의 그룹을 바꾸면 Docker Collector의 그룹도 바뀐다.
export type AssignableTarget = { kind: 'server'; item: Server };

// icon·type은 대상 종류다. 종류가 섞인 목록이라 사이드바 메뉴와 같은 아이콘으로 어느 메뉴의 대상인지 보여 준다.
// cause는 서버 목록의 상태 아래 줄과 같은 원인 문구다(서버만).
export type Member = { key: string; to: string; icon: string; type: string; name: string; detail: string; cause?: string; state: MemberState; assignment?: AssignableTarget };


// 문제가 먼저(STATE_ORDER) — 대상이 많아도 장애가 목록 아래에 묻히지 않게 해서
// 이 화면의 KPI 카드(장애 수·수집 확인 필요 수)를 대신한다. 같은 상태 안에서는 유형 순서를 지킨다(안정 정렬).

// 그룹의 서버. 서버 행은 Docker 서버를 포함해야 한다(`useServers({ includeDocker: true })`).
export const serversOfProject = (projectId: string, rows: ServerRow[]) => rows.filter((row) => row.server.projectId === projectId);

// 서버의 상태와 원인은 서버 목록과 같은 행(ServerRow)을 쓴다. 서버의 대상(모니터, 앱, 컨테이너)은 서버 행의 상태와 원인이
// 말하므로 따로 나오지 않는다. 예전에는 장애 중인 Docker 서비스가 Docker 환경 옆에 한 줄 더 나와 같은 장애를 두 번 셌다.
export function projectMembers(servers: ServerRow[]): Member[] {
  return servers.map((row): Member => ({
    assignment: { kind: 'server', item: row.server }, key: `server-${row.server.id}`, to: serverPath(row.server.id), icon: 'dns',
    type: row.targets.docker ? '서버 · Docker Collector' : '서버', name: row.server.name, detail: STATE_LABEL[row.state], cause: row.cause?.text, state: row.state,
  })).sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
}

export const targetKey = (target: AssignableTarget) => `${target.kind}-${target.item.id}`;

export const assignableTargets = (rows: ServerRow[]): AssignableTarget[] => rows.map((row) => ({ kind: 'server', item: row.server }));

// projectId가 없으면 지금 그룹에서 뺀다. 배정은 덮어쓰기라 다른 그룹에 있던 대상은 그대로 옮겨진다.
// 서버의 수정은 전체 교체라 화면의 객체가 아니라 지금의 서버로 요청을 만든다(그 사이의 이름·설명 변경을 되돌리지 않게).
export async function setTargetGroup(target: AssignableTarget, projectId?: string): Promise<unknown> {
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
