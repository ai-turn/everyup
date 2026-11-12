import type { ObservedService, TelemetrySignal } from '../../services/api';

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
