import { useEffect, useState } from 'react';
import { api, type OtelMetricHealth } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import type { MetricSource } from './useMetricRead';

/**
 * 서비스의 전체 메트릭 health. 직접 상세는 페이지 헤더의 수집 상태와 본문 격자가 같은 응답을 쓰도록 페이지에서 부른다.
 * 대상이 바뀌면 이전 대상의 응답은 돌려주지 않는다.
 */
export function useMetricHealth(source: MetricSource, refreshKey?: number) {
  const sourceKey = JSON.stringify(source);
  const [snapshot, setSnapshot] = useState<{ key: string; health: OtelMetricHealth } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const current = JSON.parse(sourceKey) as MetricSource;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const value = current.kind === 'agent' ? await api.getAgentServiceMetricHealth(current.agentId, current.serviceKey) : await api.getObservedServiceMetricHealth(current.observedServiceId);
        if (!cancelled) setSnapshot({ key: sourceKey, health: value });
      } catch (cause) { if (!cancelled) setError(getErrorMessage(cause)); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [sourceKey, refreshKey, retryKey]);

  return { health: snapshot?.key === sourceKey ? snapshot.health : null, loading, error, retry: () => setRetryKey(key => key + 1) };
}

export type MetricHealthState = ReturnType<typeof useMetricHealth>;
