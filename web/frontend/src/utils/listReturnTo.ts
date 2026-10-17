/** A list may retain its query when a detail page links back to its own section. */
export function listReturnTo(state: unknown, fallback: string): string {
  const candidate = state && typeof state === 'object' && 'returnTo' in state ? state.returnTo : undefined;
  return typeof candidate === 'string' && (candidate === fallback || candidate.startsWith(`${fallback}?`))
    ? candidate
    : fallback;
}
