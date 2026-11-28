import type { ServiceHistoryPoint } from '../../../services/api';
import { mergeBuckets, type Slot } from '../uptimeBuckets';

const slotClass = (slot: Slot) => slot.total === 0 ? 'bg-uptime-no-data'
  : slot.pct >= 100 ? 'bg-uptime-ok'
  : slot.pct <= 0 ? 'bg-uptime-fail'
  : 'bg-attn';

/**
 * 업타임 체크 띠(G안, Hyperping 체크 막대). 칸마다 그 구간의 체크가 모두 성공이면 초록, 모두 실패면 빨강, 일부 실패면 노랑,
 * 체크가 없으면 회색이다. 접근성 이름은 실패·일부 실패 구간의 수다.
 */
export function UptimeStrip({ buckets, className = 'w-45' }: { buckets: ServiceHistoryPoint[]; className?: string }) {
  const slots = mergeBuckets(buckets);
  const failed = slots.filter((s) => s.total > 0 && s.pct <= 0).length;
  const partial = slots.filter((s) => s.total > 0 && s.pct > 0 && s.pct < 100).length;
  const label = failed + partial === 0 ? '24시간 체크 모두 성공' : `24시간 중 실패 구간 ${failed}, 일부 실패 구간 ${partial}`;
  return (
    <div role="img" aria-label={label} className={`flex h-3.5 shrink-0 gap-px ${className}`}>
      {slots.map((slot, i) => <span key={i} className={`min-w-0 flex-1 rounded-xs ${slotClass(slot)}`} />)}
    </div>
  );
}
