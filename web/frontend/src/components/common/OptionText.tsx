import type { ReactNode } from 'react';

/**
 * 체크박스·라디오·선택지 카드의 글자(제목 + 설명). 제목 → 설명 4px, 설명은 쌓이는 12px 줄이라 12/18이다
 * (DESIGN.md §6 폼 리듬). 이전에는 화면마다 손으로 만들어 제목과 설명이 0~2px로 붙어 있었다.
 */
export function OptionText({ title, description, descriptionId, truncate = false, tone = 'base', descriptionSize = 'caption' }: {
  title: ReactNode;
  description?: ReactNode;
  descriptionId?: string;
  truncate?: boolean;
  /** 선택지 목록은 base, 폼 안의 보조 체크박스(다운되면 알림 등)는 secondary. */
  tone?: 'base' | 'secondary';
  /** 설명이 문장으로 길면 body(14/21). */
  descriptionSize?: 'caption' | 'body';
}) {
  const wrap = truncate ? 'truncate' : 'break-words';
  return (
    <span className="min-w-0 flex-1">
      <span className={`block ${wrap} type-label ${tone === 'base' ? 'text-text-base' : 'text-text-secondary'}`}>{title}</span>
      {description != null && description !== false && (
        <span id={descriptionId} data-gap="intra" className={`mt-intra block ${wrap} ${descriptionSize === 'caption' ? 'type-caption-stack' : 'type-body'} text-text-muted`}>{description}</span>
      )}
    </span>
  );
}
