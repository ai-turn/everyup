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
}

const SIZES = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-10 px-3 text-sm sm:h-9', // 트랙 포함 44 / sm 이상 40
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
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`${SIZES[size]} font-medium rounded-md transition-colors ${
              active
                ? 'bg-ui-raised text-text-base shadow-sm'
                : 'text-text-muted hover:text-text-base'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
