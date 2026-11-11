import type { CollectionStatus } from '../../components/common';
import type { InfrastructureResource } from '../../services/api';
import { isCollectorFresh } from '../../utils/operationalStatus';

// 사용률 표시 기준. 알림 임계값(사용자가 규칙에서 정함)과는 별개인 화면용 선이다.
// 85% 이상은 위험, 70% 이상은 주의 — 정상까지 칠하면 정작 넘은 값이 묻히므로 70% 미만은 칠하지 않는다.
export const CRITICAL_PCT = 85;
export const WARNING_PCT = 70;

export type UsageLevel = 'critical' | 'warning' | 'normal';

export function usageLevel(value: number): UsageLevel {
  return value >= CRITICAL_PCT ? 'critical' : value >= WARNING_PCT ? 'warning' : 'normal';
}

/** 목록 정렬 키 — 가장 높은 사용률. 값이 하나도 없으면 맨 뒤로. */
export function peakUsage(resource: Pick<InfrastructureResource, 'cpuUsage' | 'memoryUsage' | 'diskUsage'>) {
  const values = [resource.cpuUsage, resource.memoryUsage, resource.diskUsage].filter((value): value is number => value != null);
  return values.length ? Math.max(...values) : -1;
}

// 목록과 상세가 같은 말로 수집 상태를 부르게 한다 — 상세가 "연결 활성"이라 쓰면 수신 전 호스트도 정상처럼 보였다.
export function infraCollection(resource: Pick<InfrastructureResource, 'lastSeenAt'>): CollectionStatus {
  if (!resource.lastSeenAt) return 'waiting';
  return isCollectorFresh(resource.lastSeenAt) ? 'collecting' : 'delayed';
}
