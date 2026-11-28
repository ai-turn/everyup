import type { ServiceHistoryPoint } from '../../services/api';

/** 24시간 20분 버킷(72개)을 둘씩 묶어 36칸으로 그린다 — 180px 폭에서 칸이 4px쯤 된다. */
const PER_SLOT = 2;

export interface Slot { total: number; pct: number }

export function mergeBuckets(buckets: ServiceHistoryPoint[], perSlot = PER_SLOT): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < buckets.length; i += perSlot) {
    const part = buckets.slice(i, i + perSlot);
    const total = part.reduce((sum, b) => sum + b.total, 0);
    const pct = total > 0 ? part.reduce((sum, b) => sum + b.uptimePct * b.total, 0) / total : 0;
    slots.push({ total, pct });
  }
  return slots;
}

/** 여러 모니터의 같은 시각 버킷을 하나로 합친다(서버의 업타임 띠). 체크 수로 가중한다. */
export function combineBuckets(series: ServiceHistoryPoint[][]): ServiceHistoryPoint[] {
  const byTime = new Map<string, ServiceHistoryPoint>();
  for (const buckets of series) for (const b of buckets) {
    const prev = byTime.get(b.time);
    if (!prev) { byTime.set(b.time, { ...b }); continue; }
    const total = prev.total + b.total;
    byTime.set(b.time, { ...prev, total, uptimePct: total > 0 ? (prev.uptimePct * prev.total + b.uptimePct * b.total) / total : 0 });
  }
  return [...byTime.values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}
