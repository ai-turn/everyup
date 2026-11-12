// 트레이스 탭과 트레이스 패널이 같은 span 종류 배지를 쓴다 — 복사본이 갈라져 패널만 대비가 낮았다.
// 600단계는 자기 /10 틴트 위에서 2.84~3.70으로 AA 미달이었다(DESIGN.md §1.4와 같은 측정).
// 상태 토큰과 같은 단계로 올린다 — amber-700은 행 hover 위에서 4.47이라 800.
export function spanKindBadge(kind: string): string {
  switch (kind) {
    case 'SERVER':   return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'CLIENT':   return 'bg-sky-500/10 text-sky-700 dark:text-sky-400';
    case 'PRODUCER':
    case 'CONSUMER': return 'bg-amber-500/10 text-amber-800 dark:text-amber-400';
    default:         return 'bg-slate-500/10 text-text-muted';
  }
}
