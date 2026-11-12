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

/** 분포 띠에서 고른 상태코드 대역. 목록 조회의 minStatus/maxStatus가 된다. */
export type StatusClass = '2xx' | '3xx' | '4xx' | '5xx';
const STATUS_CLASSES: StatusClass[] = ['2xx', '3xx', '4xx', '5xx'];

/** 상태코드 글자색. 요청 목록과 트레이스 패널이 같은 422를 같은 색으로 보이게 한다. */
export function statusClass(code: number) {
  return code >= 500 ? 'text-status-error' : code >= 400 ? 'text-status-warn' : 'text-text-secondary';
}

export function statusRange(value: StatusClass | undefined) {
  if (!value) return {};
  const base = Number(value[0]) * 100;
  return { minStatus: base, maxStatus: base + 99 };
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
    status: STATUS_CLASSES.find(value => value === params.get('status')),
    // Endpoint 표에서 고른 한 endpoint. q(부분 일치)와 달리 정확히 그 method + template만.
    method: params.get('method') || undefined,
    pathTemplate: params.get('pathTemplate') || undefined,
    update,
  };
}
