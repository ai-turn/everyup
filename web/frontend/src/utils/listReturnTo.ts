/** A list may retain its query when a detail page links back to its own section. */
export function listReturnTo(state: unknown, fallback: string): string {
  const candidate = state && typeof state === 'object' && 'returnTo' in state ? state.returnTo : undefined;
  return typeof candidate === 'string' && (candidate === fallback || candidate.startsWith(`${fallback}?`))
    ? candidate
    : fallback;
}

/**
 * The list's own address with the search box's current text. `?q=` reaches the URL inside a
 * router transition, a beat after typing, so a link clicked right after typing would return
 * without the search if it read the URL.
 */
export function returnToWithQuery(pathname: string, params: URLSearchParams, query: string): string {
  const next = new URLSearchParams(params);
  if (query) next.set('q', query); else next.delete('q');
  return `${pathname}${next.size ? `?${next}` : ''}`;
}
