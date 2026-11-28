import { StatusShape } from './StatusShape';
import { STATUS_DOT, type StatusTone } from './statusTone';

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count: number;
  /** 상태 필터의 점. 0건인 장애·확인 필요는 호출부가 idle로 넘긴다(DESIGN.md §5.4). */
  tone?: StatusTone;
}

// 목록을 한 값으로 거르는 토글(DESIGN.md §4.1 FilterChips). 다시 누르면 해제한다. 선택은 aria-pressed가 말한다.
// chips: 테두리 알약(진한 테두리 + 채움). tabs: G안 서버 목록의 상태 탭 — 밑줄, 앞에 `전체`, 상태는 모양으로 갈린다.
export function FilterChips<T extends string>({ ariaLabel, options, value, onChange, variant = 'chips', total }: {
  ariaLabel: string;
  options: FilterChipOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  variant?: 'chips' | 'tabs';
  /** tabs의 `전체` 개수 */
  total?: number;
}) {
  if (variant === 'tabs') {
    const tab = (selected: boolean) => `-mb-px inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 type-label transition-colors sm:h-9.5 ${selected
      ? 'border-accent text-text forced-colors:border-[Highlight]'
      : 'border-transparent text-text-muted hover:text-text'}`;
    return (
      <div role="group" aria-label={ariaLabel} className="flex min-w-0 items-center gap-5 overflow-x-auto">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={tab(value === null)}>
          <span>전체</span>
          {total !== undefined && <span className="rounded-full bg-surface-hover px-1.5 type-caption tabular-nums text-text-muted">{total}</span>}
        </button>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(selected ? null : option.value)} className={tab(selected)}>
              {option.tone && <StatusShape tone={option.tone} size={8} />}
              <span>{option.label}</span>
              <span className="type-caption tabular-nums text-text-faint">{option.count}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(selected ? null : option.value)}
            className={`inline-flex h-11 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 type-body transition-colors sm:h-10 sm:gap-1.5 sm:px-3 ${selected
              ? 'border-accent bg-surface-hover text-text forced-colors:border-[Highlight]'
              : 'border-border bg-surface text-text hover:bg-surface-hover hover:text-text'}`}>
            {option.tone && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[option.tone]}`} />}
            <span>{option.label}</span>
            <span className="font-medium tabular-nums text-text">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}
