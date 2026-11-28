// 상태 점의 색은 여기 한 곳에서만 정한다. 컴포넌트 파일에서 상수를 export하면 fast refresh 규칙에 걸려 따로 둔다.
export type StatusTone = 'healthy' | 'warn' | 'error' | 'idle';

// Tailwind가 찾을 수 있도록 클래스 이름은 완전한 리터럴로 둔다.
export const STATUS_DOT: Record<StatusTone, string> = {
  healthy: 'bg-ok',
  warn: 'bg-attn',
  error: 'bg-crit',
  idle: 'bg-wait',
};
