import type { AgentServiceFlat } from '../services/api';

export const COLLECTOR_FRESH_FOR_MS = 2 * 60 * 1000;

export function isCollectorFresh(timestamp?: string, now = Date.now()) {
  if (!timestamp) return false;
  const observedAt = new Date(timestamp).getTime();
  return Number.isFinite(observedAt) && now - observedAt < COLLECTOR_FRESH_FOR_MS;
}
export type DockerUptimeState = 'paused' | 'waiting' | 'stale' | 'up' | 'down';

export function dockerUptimeState(service: AgentServiceFlat): DockerUptimeState {
  if (service.silenced) return 'paused';
  if (!service.seen) return 'waiting';
  if (!isCollectorFresh(service.observedAt)) return 'stale';
  return service.healthy ? 'up' : 'down';
}
