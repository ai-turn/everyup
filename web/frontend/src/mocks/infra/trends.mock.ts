import type { ChartData } from '../../types/infra';
import { SERIES_HEX } from '../../components/charts';

export type { ChartData };

const now = Date.now();
const makePoints = (count: number, genFn: (i: number) => Record<string, number>) =>
  Array.from({ length: count }, (_, i) => ({
    t: now - (count - 1 - i) * 30 * 60 * 1000,
    ...genFn(i),
  }));

export const mockCharts: ChartData[] = [
  {
    title: 'CPU Usage',
    unit: '%',
    yMax: 100,
    data: makePoints(12, (i) => ({
      cpu: Math.round(20 + Math.sin(i * 0.8) * 15 + (i % 3) * 4),
    })),
    series: [{ key: 'cpu', label: 'Usage', color: SERIES_HEX.primary }],
  },
  {
    title: 'Memory Flow',
    unit: 'GB',
    data: makePoints(12, (i) => ({
      memUsed: parseFloat((20 + Math.sin(i * 0.5) * 5 + i * 0.3).toFixed(1)),
      memCached: parseFloat((8 + Math.cos(i * 0.4) * 2).toFixed(1)),
    })),
    series: [
      { key: 'memUsed', label: 'Used', color: SERIES_HEX.primary },
      { key: 'memCached', label: 'Cached', color: SERIES_HEX.teal },
    ],
  },
  {
    title: 'Disk I/O',
    unit: 'MB/s',
    data: makePoints(12, (i) => ({
      diskRead: parseFloat((Math.abs(Math.sin(i * 1.2)) * 80 + 10).toFixed(2)),
      diskWrite: parseFloat((Math.abs(Math.cos(i * 0.9)) * 40 + 5).toFixed(2)),
    })),
    series: [
      { key: 'diskRead', label: 'Read', color: SERIES_HEX.primary },
      { key: 'diskWrite', label: 'Write', color: SERIES_HEX.amber },
    ],
  },
  {
    title: 'Network Traffic',
    unit: 'MB/s',
    data: makePoints(12, (i) => ({
      netIn: parseFloat((Math.abs(Math.sin(i * 0.7)) * 24 + 4).toFixed(2)),
      netOut: parseFloat((Math.abs(Math.cos(i * 0.9)) * 18 + 2).toFixed(2)),
    })),
    series: [
      { key: 'netIn', label: 'In', color: SERIES_HEX.primary },
      { key: 'netOut', label: 'Out', color: SERIES_HEX.emerald },
    ],
  },
];
