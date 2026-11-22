import { STATUS_DOT, type StatusTone } from './statusTone';

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count: number;
  /** 상태 필터의 점. 0건인 장애·확인 필요는 호출부가 idle로 넘긴다(DESIGN.md §5.4). */
  tone?: StatusTone;
}

// 목록을 한 값으로 거르는 토글 칩(DESIGN.md §4.1 FilterChips). 라벨과 개수는 같은 크기이고 개수만 고정폭 숫자다.
// 다시 누르면 해제한다. 선택은 aria-pressed가 말하고, 보이는 표시는 진한 테두리 + 채움이다(색만으로 전달하지 않는다).
export function FilterChips<T extends string>({ ariaLabel, options, value, onChange }: {
  ariaLabel: string;
  options: FilterChipOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(selected ? null : option.value)}
            className={`inline-flex h-11 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 type-body transition-colors sm:h-10 sm:gap-1.5 sm:px-3 ${selected
              ? 'border-primary bg-ui-hover text-text-base forced-colors:border-[Highlight]'
              : 'border-ui-border bg-bg-surface text-text-secondary hover:bg-ui-hover-soft hover:text-text-base'}`}>
            {option.tone && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[option.tone]}`} />}
            <span>{option.label}</span>
            <span className="font-medium tabular-nums text-text-base">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}
