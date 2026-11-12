import { Tooltip } from '../../../components/common/Tooltip';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CollectionStatusBadge, type CollectionStatus } from '../../../components/common';
import type { SignalReceipt } from '../../../services/api/agents';
import { useSetupStatus } from '../useSetupStatus';
import { appReceiptNote } from '../../telemetry/signals';

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
        <Tooltip content={last ? new Date(last).toLocaleString() : undefined} focusable><span className="text-text-muted">
          {last ? `마지막 수신 ${formatDistanceToNow(new Date(last), { addSuffix: true, locale: ko })}` : '아직 수신 기록 없음'}
        </span></Tooltip>
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

// note: Collector는 스스로 주기 전송하므로 인프라는 note를 따로 준다.
export function TelemetryReceiptStatus({ path, expected, note = appReceiptNote(expected) }: { path: string; expected: string[]; note?: string }) {
  const { data, error } = useSetupStatus<SignalReceipt[]>(path);
  return <ReceiptPanel
    signals={data ?? []}
    expected={expected}
    error={error}
    note={note}
  />;
}
