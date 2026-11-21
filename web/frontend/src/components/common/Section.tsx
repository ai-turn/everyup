import { useId, type ReactNode } from 'react';

interface SectionProps {
  title: ReactNode;
  /** 제목 바로 뒤의 짧은 보조 정보(개수, 기간). 제목과 같은 기준선에 놓인다. */
  meta?: ReactNode;
  /** 제목 아래 한 줄 설명. */
  description?: ReactNode;
  /** 오른쪽 조작(보기 전환, 버튼). 제목 줄의 세로 가운데에 맞는다. */
  actions?: ReactNode;
  /** 섹션 요소의 id(스크롤 앵커). */
  id?: string;
  /** 영역 이름. 주지 않으면 제목이 이름이다. */
  label?: string;
  /** 섹션 요소에 덧붙일 클래스. 제목 → 내용 16px은 덮어쓰지 않는다 — 개요가 `min-h-8`을 넘겨 간격이 0이 된 적이 있다. */
  className?: string;
  children: ReactNode;
}

// 본문 1단계 섹션(DESIGN.md §2.2, §3.7). 제목은 type-section-title(20px) 하나이고, 제목 → 내용 16px(heading)은 이 컴포넌트가
// 갖는다: 머리와 본문 두 자식의 flex gap이다. 이전에는 머리(SectionHeader)가 루트에 mb-4를 가져, 놓이는 자리마다 앞뒤 간격을
// 자식이 정했다(부모가 간격을 정한다는 §3.7 원칙의 예외였다).
// 제목·메타는 items-baseline으로 한 기준선에, 조작은 제목 줄과 같은 grid 행에서 items-center로 가운데를 맞춘다.
// 설명은 둘째 행이라 조작의 세로 위치를 끌어내리지 않는다(이전에는 제목+설명 두 줄의 가운데에 맞아 12px 내려갔다).
// 본문은 블록 하나로 감싸므로 그 안의 쌓기는 호출부가 정한다. 두 줄 목록은 list-bleed로 행 패딩을 거둬 그대로 16px로 보인다.
export function Section({ title, meta, description, actions, id, label, className = '', children }: SectionProps) {
  const headingId = useId();
  return (
    <section id={id} aria-label={label} aria-labelledby={label ? undefined : headingId} className={`flex flex-col gap-heading ${className}`}>
      <div data-gap-after="heading" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 id={headingId} className="min-w-0 wrap-anywhere type-section-title text-text-base">{title}</h2>
          {meta && <span className="type-caption tabular-nums text-text-muted">{meta}</span>}
        </div>
        {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
        {description && <p data-gap="intra" className="col-span-2 mt-intra type-body text-text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
