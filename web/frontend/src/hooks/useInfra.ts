import { useEffect, useState } from 'react';
import { api, type SystemInfo } from '../services/api';
import { systemInfoToGauges, historyToCharts } from '../utils/systemTransform';
import { ApiError, getErrorMessage } from '../utils/errors';
import type { ChartData, GaugeData } from '../types/infra';

export interface InfraMetrics {
  gauges: GaugeData[];
  charts: ChartData[];
  /** 호스트 정보(코어 수, 전체 용량, 네트워크, OS). 한 번도 수신하지 않았으면 null. */
  info: SystemInfo | null;
}

// 아직 한 번도 수신하지 않은 호스트는 info가 NO_DATA(503)로 온다 — 실패가 아니라 빈 상태다.
const isNoData = (error: unknown) => error instanceof ApiError && error.code === 'NO_DATA';

// 데모도 mockRouter를 거친다 — 고정 mock을 바로 돌려주면 모든 호스트가 같은 값을 보여 준다.
export function useInfraMetrics(hostId: string, range = '6h', refreshKey = 0) {
  const [data, setData] = useState<InfraMetrics | null>(null);
  // hostId가 비면(인프라를 연결하지 않은 서버) 부르지 않는다.
  const [loading, setLoading] = useState(Boolean(hostId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostId) return;
    let alive = true;
    Promise.all([
      api.getSystemInfo(hostId).catch(requestError => { if (isNoData(requestError)) return null; throw requestError; }),
      api.getSystemMetricsHistory(hostId, range),
    ])
      .then(([info, history]) => {
        if (!alive) return;
        setError(null);
        setData({ gauges: info ? systemInfoToGauges(info, history) : [], charts: historyToCharts(history, info), info });
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [hostId, range, refreshKey]);

  return { data, loading, error };
}
