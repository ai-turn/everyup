import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import type { NotificationChannelHealth } from '../../../services/api';

interface Props {
  health?: NotificationChannelHealth;
  compact?: boolean;
}

export function ChannelHealthMeta({ health, compact = false }: Props) {



  const sent = health?.successCount ?? 0;
  const failed = health?.failedCount ?? 0;
  const total = sent + failed;
  const ruleCount = health?.ruleCount ?? 0;
  const lastSentAt = health?.lastSentAt ? new Date(health.lastSentAt) : null;

  const successRate = total > 0 ? Math.round((sent / total) * 100) : null;
  const rateColor =
    successRate === null
      ? 'text-text-dim'
      : successRate >= 95
      ? 'text-status-healthy'
      : successRate >= 80
      ? 'text-status-warn'
      : 'text-status-error';

  const gap = compact ? 'gap-3' : 'gap-4';
  const text = 'text-sm';

  return (
    <div className={`flex items-center flex-wrap ${gap} ${text} text-text-muted`}>
      <span className="inline-flex items-center gap-1" title="마지막 발송">
        <MaterialIcon size={20} name="schedule" />
        {lastSentAt
          ? formatDistanceToNow(lastSentAt, { addSuffix: true, locale: ko })
          : '발송 이력 없음'}
      </span>

      {total > 0 ? (
        <span className={`inline-flex items-center gap-1 ${rateColor}`} title="7일 성공률">
          <MaterialIcon size={20} name="check_circle" />
          {successRate}% <span className="font-normal text-text-dim">({sent}/{total})</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1" title="최근 7일 활동 없음">
          <MaterialIcon size={20} name="check_circle" className="text-text-dim" />
          활동 없음
        </span>
      )}

      <span className="inline-flex items-center gap-1" title="연결된 활성 규칙">
        <MaterialIcon size={20} name="rule" />
        {`규칙 ${ruleCount}개`}
      </span>
    </div>
  );
}
