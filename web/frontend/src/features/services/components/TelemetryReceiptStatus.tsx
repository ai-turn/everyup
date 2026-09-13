import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CollectionStatusBadge, type CollectionStatus } from '../../../components/common';
import type { SignalReceipt } from '../../../services/api/agents';
import { useSetupStatus } from '../useSetupStatus';

const labels: Record<string, string> = { logs: '로그', metrics: '메트릭', traces: 'API 트레이스', infrastructure: '인프라', uptime: '컨테이너 상태' };

// Anything older than a collection interval plus slack is stale, not proof of
// a working pipeline — a receipt from last week must not read like success.
const DELAYED_AFTER_MS = 10 * 60 * 1000;

function receiptState(last?: string): CollectionStatus {
  if (!last) return 'waiting';
  return Date.now() - new Date(last).getTime() > DELAYED_AFTER_MS ? 'delayed' : 'collecting';
}

export function ReceiptList({ signals, expected }: { signals: SignalReceipt[]; expected: string[] }) {
  return <ul className="space-y-1.5" aria-live="polite">
    {expected.map(signal => {
      const times = signals.filter(item => item.signal === signal).map(item => item.lastReceivedAt).sort();
      const last = times[times.length - 1];
      return <li key={signal} className="flex flex-wrap items-center gap-2 type-body text-text-secondary">
        <CollectionStatusBadge status={receiptState(last)} />
        {labels[signal] ?? signal}
        <span className="text-text-muted" title={last ? new Date(last).toLocaleString() : undefined}>
          {last ? `마지막 수신 ${formatDistanceToNow(new Date(last), { addSuffix: true, locale: ko })}` : '아직 수신 기록 없음'}
        </span>
      </li>;
    })}
  </ul>;
}

/** One shape for every "did the data arrive?" block, wherever it is shown. */
export function ReceiptPanel({ signals, expected, error, note }: { signals: SignalReceipt[]; expected: string[]; error?: string; note?: string }) {
  return <section aria-label="데이터 수신 확인" className="space-y-2 rounded-xl border border-ui-border bg-ui-hover-soft p-4">
    <h4 className="type-label text-text-base">데이터 수신 확인</h4>
    {error ? <p role="alert" className="type-body text-status-warn">{error}</p> : <ReceiptList signals={signals} expected={expected} />}
    {note && <p className="type-body text-text-muted">{note}</p>}
  </section>;
}

export function TelemetryReceiptStatus({ path, expected }: { path: string; expected: string[] }) {
  const { data, error } = useSetupStatus<SignalReceipt[]>(path);
  return <ReceiptPanel
    signals={data ?? []}
    expected={expected}
    error={error}
    note="설정을 적용한 뒤 로그 또는 요청을 발생시켜 주세요. 5초마다 수신 기록을 확인합니다. 권한 추가만으로 앱의 전송 설정이 변경되지는 않습니다."
  />;
}
