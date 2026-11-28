import { environmentState } from '../services/environmentState';
import { SERVER_CAPABILITIES } from './serverPaths';
import type { ServerRow } from './serverStatus';

/** 이름 아래 줄: 연결 방식과 대상 수(G안 `Docker Collector · 컨테이너 6`, `직접 연결 · 업타임 모니터 2`). */
export function connectionText(row: ServerRow): string {
  const { docker, containers, monitors, apps, infrastructure } = row.targets;
  if (docker) return environmentState(docker) !== 'install' ? `Docker Collector${containers.length ? ` · 컨테이너 ${containers.length}개` : ''}` : 'Docker Collector 설치 대기';
  const direct = apps.length > 0 || Boolean(infrastructure);
  const parts = [direct ? '직접 연결' : null, monitors.length ? `업타임 모니터 ${monitors.length}개` : null].filter(Boolean);
  return parts.join(' · ') || '연결한 대상 없음';
}

/** 수집 중인 기능(G안 마지막 열). 컨테이너가 먼저, 나머지는 기능 탭 순서다. */
export function collectedText(row: ServerRow): string {
  const labels = [
    ...(row.containers !== null ? ['컨테이너'] : []),
    ...SERVER_CAPABILITIES.filter(({ key }) => row.capabilities[key] !== null).map(({ label }) => label),
  ];
  return labels.join(', ');
}
