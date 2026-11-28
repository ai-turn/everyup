import { SegmentedControl } from './SegmentedControl';

// Shared time-range preset for the service-detail charts (response time,
// metrics, request trends, infra trends). List filters (logs/requests) keep
// their own day-based presets — different axis.
export type GlobalTimeRange = '1h' | '6h' | '24h';

const OPTIONS: { label: string; value: GlobalTimeRange }[] = [
  { label: '1시간', value: '1h' },
  { label: '6시간', value: '6h' },
  { label: '24시간', value: '24h' },
];

export function TimeRangePicker({ value, onChange, size }: {
  value: GlobalTimeRange;
  onChange: (range: GlobalTimeRange) => void;
  /** 상단 줄(AppHeader)에서는 sm. 정하지 않으면 자리가 정한다. */
  size?: 'sm' | 'md';
}) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} size={size} ariaLabel="기간" />;
}
