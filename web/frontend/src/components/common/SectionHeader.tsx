import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: ReactNode;
  /** 제목 바로 뒤의 짧은 보조 정보(개수, 기간). 제목과 같은 기준선에 놓인다. */
  meta?: ReactNode;
  /** 제목 아래 한 줄 설명. */
  description?: ReactNode;
  /** 오른쪽 조작(보기 전환, 버튼). 제목 줄의 세로 가운데에 맞는다. */
  actions?: ReactNode;
  id?: string;
  /** 덧붙일 클래스. 제목 아래 16px(mb-4)은 덮어쓰지 않는다 — 개요가 `min-h-8`을 넘겨 간격이 0이 된 적이 있다. */
  className?: string;
}

// 본문 1단계 섹션의 머리(DESIGN.md §2.2). 제목은 type-section-title(20px) 하나다.
// 제목·메타는 items-baseline으로 한 기준선에, 조작은 제목 줄과 같은 grid 행에서 items-center로 가운데를 맞춘다.
// 설명은 둘째 행이라 조작의 세로 위치를 끌어내리지 않는다(이전에는 제목+설명 두 줄의 가운데에 맞아 12px 내려갔다).
// 제목 → 첫 내용은 16px(mb-4)로 고정한다(DESIGN.md §3.7 세로 위계). 두 줄 목록은 list-bleed로 행 패딩을 거둬 그대로 16px로 보인다.
export function SectionHeader({ title, meta, description, actions, id, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 id={id} className="min-w-0 wrap-anywhere type-section-title text-text-base">{title}</h2>
        {meta && <span className="type-caption tabular-nums text-text-muted">{meta}</span>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      {description && <p className="col-span-2 mt-1 type-body text-text-muted">{description}</p>}
    </div>
  );
}
