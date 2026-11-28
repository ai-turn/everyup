import type { StatusTone } from './statusTone';

// G안의 상태 표시: 색만이 아니라 모양으로도 갈린다(장애 네모, 확인 필요 세모, 정상 동그라미, 대기 점선 동그라미).
// 색각이상이나 흑백 인쇄에서도 장애와 정상을 가린다. 색은 채움 토큰(crit·attn·ok·wait)이다.
export function StatusShape({ tone, label, size = 10 }: { tone: StatusTone; label?: string; size?: 8 | 10 }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" className="shrink-0" {...a11y}>
      {tone === 'error' && <rect x="0.5" y="0.5" width="9" height="9" rx="2" fill="var(--crit)" />}
      {tone === 'warn' && <path d="M5 .8 9.6 9.2H.4Z" fill="var(--attn)" />}
      {tone === 'healthy' && <circle cx="5" cy="5" r="4.5" fill="var(--ok)" />}
      {tone === 'idle' && <circle cx="5" cy="5" r="3.8" fill="none" stroke="var(--wait)" strokeWidth="1.4" strokeDasharray="2 1.5" />}
    </svg>
  );
}
