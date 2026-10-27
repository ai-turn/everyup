import type { StatusTone } from '../../components/common';
import type { UptimeMonitor } from '../../services/api';

export type UptimeState = 'up' | 'down' | 'waiting' | 'paused';

/** 목록 요약·필터·배지가 같은 판정을 쓴다. */
export function uptimeState(monitor: UptimeMonitor): UptimeState {
  if (!monitor.isActive) return 'paused';
  if (monitor.status === 'healthy') return 'up';
  if (monitor.status === 'unhealthy') return 'down';
  return 'waiting';
}

export const UPTIME_STATE_LIGHT: Record<UptimeState, [StatusTone, string]> = {
  up: ['healthy', '정상'],
  down: ['error', '장애'],
  waiting: ['idle', '확인 대기'],
  paused: ['idle', '일시정지'],
};
