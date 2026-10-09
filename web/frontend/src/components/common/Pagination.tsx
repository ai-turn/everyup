// Page controls only — the "N건 중 x–y" summary stays with the caller, whose
// wording and i18n namespace differ per page.

interface PaginationProps {
  /** 1-based. */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  previousLabel?: string;
  nextLabel?: string;
}

// Pages to render: first, last, current±1, with null for ellipsis gaps.
function pageItems(current: number, totalPages: number): (number | null)[] {
  const pages = new Set([1, totalPages, current - 1, current, current + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) items.push(null);
    items.push(p);
    prev = p;
  }
  return items;
}

// 모바일은 44px 터치 타깃, sm 이상은 촘촘하게.
const STEP = 'flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-ui-border text-sm text-text-muted hover:bg-ui-hover disabled:opacity-40 disabled:cursor-not-allowed';

export function Pagination({
  page,
  totalPages,
  onChange,
  previousLabel = '이전',
  nextLabel = '다음',
}: PaginationProps) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className={STEP} aria-label={previousLabel}>
        ‹
      </button>
      {pageItems(page, totalPages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-text-dim">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`flex h-11 min-w-11 sm:h-8 sm:min-w-8 items-center justify-center rounded-md px-1 text-xs font-medium ${
              p === page
                ? 'bg-primary text-white'
                : 'border border-ui-border text-text-muted hover:bg-ui-hover'
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className={STEP} aria-label={nextLabel}>
        ›
      </button>
    </div>
  );
}
