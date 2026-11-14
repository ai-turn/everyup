// 심각도 라벨의 단일 출처. 규칙 표·편집 폼·필터·발송 이력이 각자 다른 문구를
// 쓰고 있었다 (긴급 / 심각 / 'Critical' / 원시 'critical').
export const SEVERITY_LABELS: Record<string, string> = {
  critical: '심각',
  warning: '경고',
  info: '정보',
};

export function severityLabel(severity: string): string {
  return SEVERITY_LABELS[severity] ?? severity;
}

// 심각도 색의 단일 출처(A-16). severity는 상태와 별개 축이지만 색은 §1.5 로그 레벨과 같은 규칙을 따른다.
// critical·warning은 뜻이 장애·주의와 같으므로 상태 토큰(글자 status-*, /10 틴트, 점 -fill)을 쓴다.
// 같은 행에 놓이는 발송 실패와 다른 빨강이면 뜻이 둘로 읽힌다. 상태에 없는 info만 §1.5 info의 sky다.
export const SEVERITY_TONE: Record<string, { badge: string; text: string; dot: string }> = {
  critical: { badge: 'bg-status-error/10 text-status-error', text: 'text-status-error', dot: 'bg-status-error-fill' },
  warning: { badge: 'bg-status-warn/10 text-status-warn', text: 'text-status-warn', dot: 'bg-status-warn-fill' },
  info: { badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-400', text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-600' },
};

export function severityTone(severity: string) {
  return SEVERITY_TONE[severity] ?? SEVERITY_TONE.info;
}
