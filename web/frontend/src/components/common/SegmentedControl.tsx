import { useContext } from 'react';
import { ControlDefaultsContext } from './controlSize';
import { MaterialIcon } from './MaterialIcon';
import { STATUS_DOT, type StatusTone } from './statusTone';
import { Tooltip } from './Tooltip';

// Single-track segmented control for mutually-exclusive pick-one selectors
// (time ranges, date presets, category filters). It deliberately uses a
// labelled button group instead of ARIA tabs: changing a value does not
// necessarily reveal a separate tabpanel, and callers should not inherit the
// keyboard contract of a document-tab interface by accident.
//
// Dark layering is context-proof: track = ui-hover, active pill = ui-active —
// both lighter than the page (#111113) and card (#18191b) surfaces, so the
// control stays visible whether it sits on a card or the bare page.

interface SegmentedOption<T extends string> {
  label: string;
  value: T;
  /** 아이콘을 쓰면 label은 접근성 이름과 툴팁으로 유지한다. */
  icon?: string;
  /** 선택지 대상의 상태 점. 점의 접근 가능한 이름은 toneLabel이다(§5.2).
   *  정상이 아니면 toneLabel을 글자로도 보인다(터치 화면에는 툴팁이 없다). 정상은 점과 툴팁만 둔다(§5.1, 색을 덜 쓴다). */
  tone?: StatusTone;
  toneLabel?: string;
}

// 트랙을 포함한 바깥 높이가 같은 행의 Button·입력과 같아야 한다(DESIGN.md §4.1): sm 32 = Button sm,
// md 44(모바일)·40(sm 이상) = Button md. 모바일 md는 선택 버튼이 44px(터치 영역)이라 트랙의 패딩·테두리가 높이를 더하면
// 48px로 옆 버튼보다 4px 컸다. 그래서 모바일 md 트랙은 패딩·테두리 대신 높이를 차지하지 않는 안쪽 1px 선을 쓴다.
const SIZES = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-11 px-3 text-sm sm:h-9',
} as const;

const ICON_SIZES = {
  sm: 'h-7 w-7',
  md: 'h-11 w-11 sm:h-9 sm:w-9',
} as const;

const TRACK = {
  sm: 'p-px border border-ui-border',
  md: 'border-ui-border shadow-[inset_0_0_0_1px_var(--color-ui-border)] sm:p-px sm:border sm:shadow-none',
} as const;

export function SegmentedControl<T extends string>({
  options, value, onChange, size, ariaLabel, scroll = false,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 정하지 않으면 자리가 정한다: `AppHeader` 안(ControlDefaultsContext)은 sm, 본문은 md. */
  size?: keyof typeof SIZES;
  ariaLabel?: string;
  /** 줄바꿈하지 않는다. 넘치면 호출자가 감싼 영역(overflow-x-auto) 안에서 가로로 스크롤한다. */
  scroll?: boolean;
}) {
  const defaults = useContext(ControlDefaultsContext);
  const resolved = size ?? defaults.size ?? 'md';
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex ${scroll ? 'flex-nowrap' : 'max-w-full flex-wrap'} items-center gap-0.5 rounded-lg bg-ui-hover ${TRACK[resolved]}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          // scroll이면 긴 이름이 잘리므로(max-w-36) 전체 이름도 툴팁에 보인다.
          <Tooltip key={o.value} content={o.icon ? o.label
            : [scroll ? o.label : undefined, o.tone === 'healthy' ? o.toneLabel : undefined].filter(Boolean).join(', ') || undefined}><button
            aria-label={o.icon ? o.label : undefined}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex ${scroll ? 'shrink-0' : 'min-w-0 max-w-full'} items-center justify-center gap-1.5 ${o.icon ? ICON_SIZES[resolved] : SIZES[resolved]} font-medium rounded-md transition-colors ${
            active
            ? 'bg-ui-raised text-text-base shadow-sm forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]'
            : 'text-text-muted hover:text-text-base'
            }`}
          >
            {o.icon ? <MaterialIcon name={o.icon} /> : <span className={`truncate ${scroll ? 'max-w-36' : ''}`}>{o.label}</span>}
            {o.tone && <span role="img" aria-label={o.toneLabel} className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[o.tone]}`} />}
            {o.tone && o.tone !== 'healthy' && <span aria-hidden="true" className="shrink-0 type-caption text-text-muted">{o.toneLabel}</span>}
          </button></Tooltip>
        );
      })}
    </div>
  );
}
