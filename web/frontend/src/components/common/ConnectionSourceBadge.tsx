interface ConnectionSourceBadgeProps {
  source: 'direct' | 'docker';
  directLabel?: string;
}

export function ConnectionSourceBadge({
  source,
  directLabel = '직접 연결',
}: ConnectionSourceBadgeProps) {
  // 출처는 분류 축이라 색을 싣지 않는다 (DESIGN.md §5.3). 이전에는 direct만
  // primary 틴트였는데, primary는 "선택됨"의 색이라 출처 라벨로 오독됐다.
  //
  // 칩이 아니라 맨 텍스트인 이유: status-idle 라이트가 slate-600이고 text-muted도
  // slate-600이라, 중립 칩으로 만들면 '일시정지' 상태 배지와 텍스트·배경이 거의
  // 같아진다. 색으로 못 가르니 형태로 가른다 — 칩은 상태 전용.
  return (
    <span className="shrink-0 type-caption text-text-muted">
      {source === 'direct' ? directLabel : 'Docker'}
    </span>
  );
}
