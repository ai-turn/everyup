export const COLLECTOR_FRESH_FOR_MS = 2 * 60 * 1000;

export function isCollectorFresh(timestamp?: string, now = Date.now()) {
  if (!timestamp) return false;
  const observedAt = new Date(timestamp).getTime();
  return Number.isFinite(observedAt) && now - observedAt < COLLECTOR_FRESH_FOR_MS;
}
