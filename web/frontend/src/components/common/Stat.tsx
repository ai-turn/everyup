import type { ReactNode } from 'react';

/**
 * 수치 타일의 글자(라벨 → 값 → 보조). 라벨 → 값 4px(DESIGN.md §3.7 V1), 값은 type-kpi다. 타일 자체의 안쪽은
 * 호출부가 p-4(16px)로 둔다. 이전에는 알림 발송 요약·API 요청 타일이 각자 gap-0.5(2px)로 만들어 라벨과 값이 붙어 있었다.
 */
export function Stat({ label, value, detail, labelTone = 'muted' }: {
  label: ReactNode;
  /** 값. 상태색이나 옆에 붙는 조작이 필요하면 노드로 넘긴다(크기·굵기는 type-kpi를 물려받는다). */
  value: ReactNode;
  detail?: ReactNode;
  labelTone?: 'muted' | 'secondary';
}) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-intra">
      <span className={`max-w-full truncate type-caption ${labelTone === 'secondary' ? 'text-text-secondary' : 'text-text-muted'}`}>{label}</span>
      <span data-gap="intra" className="flex items-baseline gap-2 type-kpi text-text-base">{value}</span>
      {detail != null && <span className="type-caption text-text-muted">{detail}</span>}
    </span>
  );
}
