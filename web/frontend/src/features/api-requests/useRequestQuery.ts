import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GlobalTimeRange } from '../../components/common';

export interface RequestWindow { from: string; to: string }

export function requestRange(value: string | null): GlobalTimeRange {
  return value === '1h' || value === '24h' ? value : '6h';
}

function createWindow(range: GlobalTimeRange): RequestWindow {
  const to = Date.now();
  return { from: new Date(to - Number.parseInt(range) * 3_600_000).toISOString(), to: new Date(to).toISOString() };
}

export function useRequestWindow(range: GlobalTimeRange, refreshKey: number = 0) {
  return useMemo(() => {
    void refreshKey;
    return createWindow(range);
  }, [range, refreshKey]);
}

export function useRequestQuery() {
  const [params, setParams] = useSearchParams();
  const update = useCallback((changes: Record<string, string | null>) => setParams(current => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    return next;
  }), [setParams]);
  const rawPage = Number(params.get('page'));
  return {
    range: requestRange(params.get('range')),
    tab: params.get('tab') === 'traces' ? 'traces' as const : 'requests' as const,
    search: params.get('q') ?? '',
    errorsOnly: params.get('errorsOnly') === 'true',
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    traceId: params.get('traceId') || undefined,
    traceSort: params.get('traceSort') === 'slowest' ? 'slowest' as const : 'recent' as const,
    traceErrorsOnly: params.get('traceErrorsOnly') === 'true',
    update,
  };
}
