import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseTimeRange, type GlobalTimeRange } from '../../components/common';

export interface MetricWindow {
  range: GlobalTimeRange;
  from: string;
  to: string;
}

function createWindow(range: GlobalTimeRange): MetricWindow {
  const to = Date.now();
  return { range, from: new Date(to - Number.parseInt(range) * 3_600_000).toISOString(), to: new Date(to).toISOString() };
}

export function useMetricWindow(range: GlobalTimeRange, refreshKey = 0): MetricWindow {
  return useMemo(() => {
    void refreshKey;
    return createWindow(range);
  }, [range, refreshKey]);
}

export function useMetricQuery() {
  const [params, setParams] = useSearchParams();
  const update = useCallback((changes: { range?: GlobalTimeRange; metricSearch?: string | null; metric?: string | null }, replace = false) => setParams(current => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    return next;
  }, { replace }), [setParams]);

  return {
    range: parseTimeRange(params.get('range')) ?? '6h',
    // Docker service tabs also use q for logs and requests.
    search: params.get('metricSearch') ?? '',
    metric: params.get('metric'),
    update,
  };
}
