import type { CollectionStatus } from '../../components/common';
import type { ObservedService, SignalReceipt, TelemetrySignal } from '../../services/api';

/** 화면에 쓰는 데이터 유형 이름 (DESIGN.md §9: signal → 데이터 유형). 메뉴 이름과 맞춘다. */
const SIGNAL_LABELS: Record<string, string> = { logs: '로그', traces: 'API', metrics: '메트릭' };

export const signalLabel = (signal: string) => SIGNAL_LABELS[signal] ?? signal;
export const signalList = (signals: string[]) => signals.map(signalLabel).join(', ');

/**
 * 메뉴 상세의 제거 액션. 다른 데이터 유형도 받는 서비스라면 이 메뉴의 연결만 끊는다 —
 * 서비스 삭제는 로그·API·메트릭과 알림 규칙을 모두 지우므로, 한 메뉴에서 실수로 전부 잃지 않게 한다.
 */
export function serviceRemoval(service: ObservedService, signal: TelemetrySignal) {
  const label = signalLabel(signal);
  const others = service.signals.filter((s) => s !== signal);
  if (others.length > 0) {
    return {
      kind: 'detach' as const,
      button: `${label} 연결 해제`,
      title: `${label} 연결을 해제할까요?`,
      message: `이 서비스의 ${label} 데이터 수집을 멈추고 ${label} 메뉴에서 뺍니다. ${signalList(others)} 수집은 그대로 유지되고, 이미 저장된 ${label} 데이터는 보관 기간이 지나면 삭제됩니다.`,
      signals: others,
      done: `${label} 연결을 해제했습니다.`,
    };
  }
  return {
    kind: 'delete' as const,
    button: '삭제',
    title: '이 서비스를 삭제할까요?',
    message: `${label} 데이터, 직접 수집 연결, 이 서비스의 알림 규칙을 모두 삭제합니다. 되돌릴 수 없습니다.`,
    signals: [] as TelemetrySignal[],
    done: '서비스를 삭제했습니다.',
  };
}

// 앱 SDK가 언제 보내는지는 데이터 유형마다 다르다. 로그·트레이스는 일이 생겨야 나가고, 메트릭은 주기적으로 나간다.
const WAIT_HINT: Record<string, string> = {
  logs: '설정을 적용한 뒤 앱에서 로그를 남겨 주세요.',
  traces: 'HTTP 요청을 한 번 보내 주세요. API 요청 목록에는 method와 상태 코드가 있는 SERVER span만 표시됩니다.',
  metrics: '앱을 다시 시작하면 1분 안에 첫 메트릭이 들어옵니다(내보내기 주기 기본 60초).',
};

export function appReceiptNote(signals: string[], attached = false) {
  return [
    ...signals.map(signal => WAIT_HINT[signal]).filter(Boolean),
    '5초마다 수신 기록을 확인합니다.',
    ...(attached ? ['권한 추가만으로 앱의 전송 설정이 변경되지는 않습니다.'] : []),
  ].join(' ');
}

// Anything older than a collection interval plus slack is stale, not proof of
// a working pipeline — a receipt from last week must not read like success.
const DELAYED_AFTER_MS = 10 * 60 * 1000;

export function receiptState(last?: string): CollectionStatus {
  if (!last) return 'waiting';
  return Date.now() - new Date(last).getTime() > DELAYED_AFTER_MS ? 'delayed' : 'collecting';
}

/** 한 데이터 유형의 마지막 수신 시각. 서비스의 lastSeenAt은 다른 유형(로그 등)으로도 갱신되므로 쓰지 않는다. */
export function lastReceipt(receipts: SignalReceipt[], signal: string) {
  return receipts.filter(item => item.signal === signal).map(item => item.lastReceivedAt).sort().pop();
}

export const receiptCollection = (receipts: SignalReceipt[], signal: string) => receiptState(lastReceipt(receipts, signal));
