// 트레이스 탭과 트레이스 패널이 같은 span 종류 배지를 쓴다 — 복사본이 갈라져 패널만 대비가 낮았다.
// 색은 테마 토큰이다: 상태색 글자는 자기 틴트 위에서도 4.5:1을 넘는다(tokens.css).
export function spanKindBadge(kind: string): string {
  switch (kind) {
    case 'SERVER':   return 'bg-ok-bg text-ok-text';
    case 'CLIENT':   return 'bg-accent-bg text-accent';
    case 'PRODUCER':
    case 'CONSUMER': return 'bg-attn-bg text-attn-text';
    default:         return 'bg-surface-hover text-text-muted';
  }
}
