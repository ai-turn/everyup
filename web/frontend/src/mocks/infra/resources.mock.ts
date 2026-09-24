import type { GaugeData } from '../../types/infra';
import { SERIES_HEX } from '../../components/charts';

export type { GaugeData };

export const mockGauges: GaugeData[] = [
  {
    label: 'CPU',
    percentage: 42,
    color: SERIES_HEX.primary,
    subtitle: '16 Cores Online',
    spark: [22, 30, 35, 41, 33, 27, 21, 18, 26, 31, 38, 42],
  },
  {
    label: 'Memory',
    percentage: 68,
    color: SERIES_HEX.emerald,
    subtitle: '43.5 GB / 64 GB',
  },
  {
    label: 'Disk',
    percentage: 89,
    color: SERIES_HEX.amber,
    subtitle: '1.78 TB / 2 TB',
  },
  {
    label: 'Network',
    percentage: 72,
    color: SERIES_HEX.teal,
    subtitle: 'In 12.4 MB/s · Out 5.6 MB/s',
    spark: [9, 12, 16, 14, 11, 13, 19, 22, 17, 15, 16, 18],
    displayValue: '18.0',
    displayUnit: 'MB/s',
  },
];
