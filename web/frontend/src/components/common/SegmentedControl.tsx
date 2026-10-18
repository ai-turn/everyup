import { MaterialIcon } from './MaterialIcon';

// Single-track segmented control for mutually-exclusive pick-one selectors
// (time ranges, date presets, category filters). It deliberately uses a
// labelled button group instead of ARIA tabs: changing a value does not
// necessarily reveal a separate tabpanel, and callers should not inherit the
// keyboard contract of a document-tab interface by accident.
//
// Dark layering is context-proof: track = ui-hover, active pill = ui-active —
// both lighter than the page (#0d1117) and card (#161b22) surfaces, so the
// control stays visible whether it sits on a card or the bare page.

interface SegmentedOption<T extends string> {
  label: string;
  value: T;
  /** 아이콘을 쓰면 label은 접근성 이름과 툴팁으로 유지한다. */
  icon?: string;
}

const SIZES = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-10 px-3 text-sm sm:h-9', // 트랙 포함 44 / sm 이상 40
} as const;

const ICON_SIZES = {
  sm: 'h-7 w-7',
  md: 'h-11 w-11 sm:h-9 sm:w-9',
} as const;

export function SegmentedControl<T extends string>({
  options, value, onChange, size = 'sm', ariaLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: keyof typeof SIZES;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg p-px bg-ui-hover border border-ui-border"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            aria-label={o.icon ? o.label : undefined}
            title={o.icon ? o.label : undefined}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center justify-center ${o.icon ? ICON_SIZES[size] : SIZES[size]} font-medium rounded-md transition-colors ${
              active
                ? 'bg-ui-raised text-text-base shadow-sm'
                : 'text-text-muted hover:text-text-base'
            }`}
          >
            {o.icon ? <MaterialIcon name={o.icon} /> : o.label}
          </button>
        );
      })}
    </div>
  );
}
