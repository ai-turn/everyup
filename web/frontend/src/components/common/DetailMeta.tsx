import type { ReactNode } from 'react';

// 상세 화면 PageHeader의 `meta` 정본 (DESIGN.md §4.1 상세 헤더).
// 상태 줄(상태 + 상태를 바꾸는 액션 + 수시로 바뀌는 값)과 속성 목록(라벨 좌 / 값 우, 2열)을
// 나눈다. 모든 항목을 한 줄에 흘리던 이전 형태는 라벨·값·버튼이 같은 12px로 이어져
// 한 문장처럼 읽혔고, 라벨 위/값 아래 그리드는 시선이 칸마다 위아래로 오르내렸다.
export interface DetailMetaField {
  label: string;
  /** 값과, 그 값을 바꾸는 액션(ghost 버튼·Select)을 함께 둔다 */
  value: ReactNode;
}

interface DetailMetaProps {
  status: ReactNode;
  fields?: DetailMetaField[];
}

export function DetailMeta({ status, fields = [] }: DetailMetaProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 type-caption text-text-muted">{status}</div>
      {fields.length > 0 && (
        <dl className="grid max-w-4xl border-t border-ui-border-soft sm:grid-cols-2 sm:gap-x-12">
          {fields.map(field => (
            <div key={field.label} className="flex min-h-12 min-w-0 items-center gap-4 border-b border-ui-border-soft py-1">
              <dt className="w-24 shrink-0 type-body text-text-dim">{field.label}</dt>
              <dd className="flex min-w-0 flex-1 items-center gap-2 type-body text-text-base">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
