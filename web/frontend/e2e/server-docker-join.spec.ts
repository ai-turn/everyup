import { expect, test } from '@playwright/test';
import type { ConnectedAgent, Server } from '../src/services/api';
import { buildServerRows, hasTargets } from '../src/features/servers/serverStatus';

// 서버·Docker 통합 1단계(ADR 0012): Docker 환경은 같은 ID의 서버다. 화면은 2단계에서 바뀌고, 여기서는 데이터를 묶는 규칙만 본다.
const at = '2026-11-22T00:00:00Z';
const server = (id: string, name: string, projectId?: string): Server => ({ id, name, projectId, createdAt: at, updatedAt: at });
const agent = (id: string, name: string, projectId?: string): ConnectedAgent => ({ id, name, projectId, serverId: id, version: '0.3.0', lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at });

const direct = server('srv-1', 'web-01', 'P');
const dockerServer = server('agent_1', 'prod-server', 'P');
const environment = agent('agent_1', 'prod-server', 'P');

test('a Docker server carries its Docker Collector, matched by serverId', () => {
  const rows = buildServerRows({ servers: [direct, dockerServer], monitors: [], apps: [], infrastructure: [], agents: [environment] });
  const docker = rows.find((row) => row.server.id === 'agent_1')!;
  expect(docker.targets.docker?.id).toBe('agent_1');
  // 대상이 Docker Collector뿐이어도 "연결한 대상 없음"이 아니다.
  expect(hasTargets(docker.targets)).toBe(true);
  expect(rows.find((row) => row.server.id === 'srv-1')!.targets.docker).toBeUndefined();
});

test('without the Docker list the rows are the direct servers as before', () => {
  const rows = buildServerRows({ servers: [direct], monitors: [], apps: [], infrastructure: [] });
  expect(rows).toHaveLength(1);
  expect(rows[0].targets.docker).toBeUndefined();
  expect(hasTargets(rows[0].targets)).toBe(false);
});

// 그룹 화면이 Docker 서버를 서버 행으로 한 번만 세는 규칙은 servers-cross.spec.ts의 그룹 테스트가 확인한다.
