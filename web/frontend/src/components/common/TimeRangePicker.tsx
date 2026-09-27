import { SegmentedControl } from './SegmentedControl';

// Shared time-range preset for the service-detail charts (response time,
// metrics, request trends, infra trends). List filters (logs/requests) keep
// their own day-based presets — different axis.
export type GlobalTimeRange = '1h' | '6h' | '24h';

const OPTIONS: { label: string; value: GlobalTimeRange }[] = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
];

export function TimeRangePicker({ value, onChange }: {
  value: GlobalTimeRange;
  onChange: (range: GlobalTimeRange) => void;
}) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} ariaLabel="시간 범위" />;
}
