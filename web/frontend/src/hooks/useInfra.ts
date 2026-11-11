import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { systemInfoToGauges, historyToCharts } from '../utils/systemTransform';
import { ApiError, getErrorMessage } from '../utils/errors';
import type { ChartData, GaugeData } from '../types/infra';

export interface InfraMetrics {
  gauges: GaugeData[];
  charts: ChartData[];
}

// 아직 한 번도 수신하지 않은 호스트는 info가 NO_DATA(503)로 온다 — 실패가 아니라 빈 상태다.
const isNoData = (error: unknown) => error instanceof ApiError && error.code === 'NO_DATA';

// 데모도 mockRouter를 거친다 — 고정 mock을 바로 돌려주면 모든 호스트가 같은 값을 보여 준다.
export function useInfraMetrics(hostId: string, range = '6h', refreshKey = 0) {
  const [data, setData] = useState<InfraMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getSystemInfo(hostId).catch(requestError => { if (isNoData(requestError)) return null; throw requestError; }),
      api.getSystemMetricsHistory(hostId, range),
    ])
      .then(([info, history]) => {
        if (!alive) return;
        setError(null);
        setData({ gauges: info ? systemInfoToGauges(info, history) : [], charts: historyToCharts(history, info) });
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [hostId, range, refreshKey]);

  return { data, loading, error };
}
