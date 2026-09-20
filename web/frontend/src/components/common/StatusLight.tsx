// 대상의 상태를 나타내는 시각 프리미티브 — 점 + 라벨. DESIGN.md §5.1.
//
// 틴트 배경을 가진 배지가 아니다. Adobe Spectrum이 두 컴포넌트를 가르는 기준을 따랐다:
// status light = "condition of an entity"(점 + 라벨), badge = "color-categorized
// metadata"(단색 채움). 대상의 정상/장애는 전자다.
//
// 라벨은 상태색으로 칠하지 않는다 — Spectrum의 "Do not change the text color to
// match the dot." 색을 지닌 요소를 점 하나로 줄여야 모니터링 목록에서 색이 흩어지지
// 않고, 라벨은 본문 대비를 그대로 유지한다.
//
// 점은 인접 라벨이 이미 상태를 말하므로 장식이다(aria-hidden). 라벨 없이 점만 쓰는
// 자리는 §5.2를 따라 role="img" + aria-label이 필요하다.

export type StatusTone = 'healthy' | 'warn' | 'error' | 'idle';

const DOT: Record<StatusTone, string> = {
  healthy: 'bg-status-healthy',
  warn: 'bg-status-warn',
  error: 'bg-status-error',
  idle: 'bg-status-idle',
};

interface StatusLightProps {
  tone: StatusTone;
  label: string;
  /** 진행 중인 장애만. prefers-reduced-motion에서 전역 규칙이 정지시킨다 (§5.2) */
  pulse?: boolean;
}

export function StatusLight({ tone, label, pulse }: StatusLightProps) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 type-caption text-text-secondary">
      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]} ${pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
      {label}
    </span>
  );
}
