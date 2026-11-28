import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ServiceHistoryPoint } from '../../services/api';

/**
 * 모니터마다 최근 24시간 버킷(20분)을 불러온다. 개요의 업타임 띠가 쓴다. 실패한 모니터는 값이 없다(띠를 그리지 않는다).
 * ponytail: 모니터마다 요청 하나다. 모니터가 수백 개가 되면 서버에 묶음 조회를 만든다.
 */
export function useMonitorBuckets(ids: string[]) {
  const [buckets, setBuckets] = useState<Record<string, ServiceHistoryPoint[]>>({});
  const key = [...ids].sort().join(',');
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const list = key ? key.split(',') : [];
    const id = ++latest.current;
    const results = await Promise.allSettled(list.map((monitor) => api.getUptimeMonitorBuckets(monitor, '24h')));
    if (id !== latest.current) return;
    const next: Record<string, ServiceHistoryPoint[]> = {};
    results.forEach((result, i) => { if (result.status === 'fulfilled' && result.value) next[list[i]] = result.value; });
    setBuckets(next);
  }, [key]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { buckets, reload };
}
