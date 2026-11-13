import { Tooltip } from '../../../components/common/Tooltip';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MaterialIcon, StatusLight } from '../../../components/common';
import type { NotificationChannelHealth } from '../../../services/api';

/** 저장된 채널의 `테스트` 결과. 테스트는 이력에 남지 않으므로 이 화면에 있는 동안 채널 행에 남긴다(A-12). */
export interface ChannelTestOutcome { ok: boolean; at: string; message?: string }

export function ChannelTestResult({ result }: { result?: ChannelTestOutcome }) {
  if (!result) return null;
  const when = formatDistanceToNow(new Date(result.at), { addSuffix: true, locale: ko });
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5">
      <StatusLight tone={result.ok ? 'healthy' : 'error'} label={result.ok ? `테스트 성공 · ${when}` : `테스트 실패 · ${when}`} />
      {!result.ok && result.message && <span className="break-words type-caption text-text-muted">{result.message}</span>}
    </span>
  );
}

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
      <Tooltip content="마지막 발송" focusable><span className="inline-flex items-center gap-1.5">
        <MaterialIcon size={20} name="schedule" />
        {lastSentAt
          ? formatDistanceToNow(lastSentAt, { addSuffix: true, locale: ko })
          : '발송 이력 없음'}
      </span></Tooltip>

      {total > 0 ? (
        <Tooltip content="7일 성공률" focusable><span className={`inline-flex items-center gap-1.5 ${rateColor}`}>
          <MaterialIcon size={20} name="check_circle" />
          {successRate}% <span className="font-normal text-text-dim">({sent}/{total})</span>
        </span></Tooltip>
      ) : (
        <Tooltip content="최근 7일 활동 없음" focusable><span className="inline-flex items-center gap-1.5">
          <MaterialIcon size={20} name="check_circle" className="text-text-dim" />
          활동 없음
        </span></Tooltip>
      )}

      <Tooltip content="연결된 활성 규칙" focusable><span className="inline-flex items-center gap-1.5">
        <MaterialIcon size={20} name="rule" />
        {`규칙 ${ruleCount}개`}
      </span></Tooltip>
    </div>
  );
}
