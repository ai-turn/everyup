import { api } from '../services/api';
import { useDataFetch } from './useDataFetch';
import { mockGauges, mockCharts as mockTrendCharts } from '../mocks/infra';
import { systemInfoToGauges, historyToCharts } from '../utils/systemTransform';
import type { ChartData, GaugeData } from '../types/infra';

export interface InfraMetrics {
  gauges: GaugeData[];
  charts: ChartData[];
}

// 게이지와 추세는 같은 현재값·이력을 쓰므로 한 번만 받는다. 게이지 스파크라인은 6시간 고정이라
// (DESIGN.md §4.2) 차트 범위가 다를 때만 6시간 이력을 따로 받는다.
export function useInfraMetrics(hostId: string, range = '6h', refreshKey = 0) {
  return useDataFetch<InfraMetrics>(
    { gauges: mockGauges, charts: mockTrendCharts },
    async () => {
      const [info, history, sparkHistory] = await Promise.all([
        api.getSystemInfo(hostId).catch(() => null),
        api.getSystemMetricsHistory(hostId, range).catch(() => null),
        range === '6h' ? null : api.getSystemMetricsHistory(hostId, '6h').catch(() => null),
      ]);
      const spark = range === '6h' ? history : sparkHistory;
      return {
        gauges: info ? systemInfoToGauges(info, spark ?? undefined) : [],
        charts: history ? historyToCharts(history, info) : [],
      };
    },
    [hostId, range, refreshKey]
  );
}
