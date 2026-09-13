import type { SignalReceipt } from '../../../services/api/agents';
import { useSetupStatus } from '../useSetupStatus';

const labels: Record<string, string> = { logs: '로그', metrics: '메트릭', traces: 'API 트레이스', infrastructure: '인프라', uptime: '컨테이너 상태' };

export function ReceiptList({ signals, expected }: { signals: SignalReceipt[]; expected: string[] }) {
  return <ul className="space-y-2 text-sm" aria-live="polite">
    {expected.map(signal => {
      const rows = signals.filter(item => item.signal === signal);
      const times = rows.map(item => item.lastReceivedAt).sort();
      const last = times[times.length - 1];
      return <li key={signal} className="text-text-secondary">
        {labels[signal] ?? signal} · {last ? `수신 기록 있음 — ${new Date(last).toLocaleString()}` : '첫 데이터 대기'}
      </li>;
    })}
  </ul>;
}

export function TelemetryReceiptStatus({ path, expected }: { path: string; expected: string[] }) {
  const { data, error } = useSetupStatus<SignalReceipt[]>(path);
  return <div className="space-y-2 rounded-xl border border-ui-border bg-ui-hover-soft p-4">
    <p className="text-sm font-medium text-text-base">데이터 수신 확인</p>
    {error ? <p role="alert" className="text-sm text-status-warn">{error}</p> : <ReceiptList signals={data ?? []} expected={expected} />}
    <p className="type-body text-text-muted">설정을 적용한 뒤 로그 또는 요청을 발생시켜 주세요. 5초마다 수신 기록을 확인합니다. 권한 추가만으로 앱의 전송 설정이 변경되지는 않습니다.</p>
  </div>;
}
