import type { GlobalTimeRange } from './TimeRangePicker';

/** A `?range=` value, when it is one of the presets — so a link can open a detail view on the window it summarized. */
export function parseTimeRange(value: string | null): GlobalTimeRange | undefined {
  return value === '1h' || value === '6h' || value === '24h' ? value : undefined;
}
