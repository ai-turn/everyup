import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button, LoadErrorBanner } from '../../components/common';
import { api, type ApiEndpointStat, type ApiEndpointStats } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import type { TraceTarget } from '../traces/components/TracePanel';
import type { RequestWindow } from './useRequestQuery';

const LIMIT = 10;

export interface EndpointKey { method: string; path: string }

const rate = (row: ApiEndpointStat) => row.count > 0 ? row.errorCount / row.count * 100 : 0;
const p95 = (row: ApiEndpointStat) => row.timed > 0 ? `${row.p95.toLocaleString()}ms` : '-';

/**
 * "어느 API가 문제인가"에 답하는 표. 서버가 에러 수 → p95 순으로 준다.
 * Endpoint 버튼으로 고르면 아래 요청 목록이 그 method + template로 걸러진다(경로 검색 q는 부분 일치라 /orders가 /orders/:id/cancel까지 잡는다).
 */
export function ApiEndpointTable({ source, window, refreshKey, selected, onSelect }: {
  source: TraceTarget; window: RequestWindow; refreshKey: number;
  selected?: EndpointKey; onSelect: (endpoint: EndpointKey | null) => void;
}) {
  const [result, setResult] = useState<{ data: ApiEndpointStats | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [retryKey, setRetryKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    let active = true;
    const load = async () => {
      setResult(previous => ({ ...previous, loading: true, error: null }));
      try {
        const data = await (observedServiceId
          ? api.getObservedServiceRequestEndpoints(observedServiceId, window)
          : api.getAgentServiceRequestEndpoints(agentId, serviceKey, window));
        if (active) setResult({ data, error: null, loading: false });
      } catch (error) {
        if (active) setResult({ data: null, error: getErrorMessage(error), loading: false });
      }
    };
    void load();
    return () => { active = false; };
  }, [agentId, serviceKey, observedServiceId, window, refreshKey, retryKey]);

  const rows = result.data?.endpoints ?? [];
  if (result.loading && !result.data) return <div aria-label="Endpoint 조회 중" className="h-32 animate-pulse rounded-xl bg-ui-hover" />;
  if (result.error) {
    return <LoadErrorBanner inline title="Endpoint 요약을 불러오지 못했습니다" onRetry={() => setRetryKey(key => key + 1)} />;
  }
  if (result.data?.truncated) {
    return <p role="status" className="type-caption text-text-muted">조회 범위의 요청이 많아 Endpoint 요약을 표시하지 못했습니다. 기간을 줄여 주세요.</p>;
  }
  if (rows.length === 0) return null; // 아래 요청 목록의 빈 상태가 설명한다

  const isSelected = (row: ApiEndpointStat) => row.method === selected?.method && row.path === selected?.path;
  const selectedIndex = rows.findIndex(isSelected);
  const shown = expanded || selectedIndex >= LIMIT ? rows : rows.slice(0, LIMIT);
  const pick = (row: ApiEndpointStat) => onSelect(isSelected(row) ? null : { method: row.method, path: row.path });

  return <section aria-label="Endpoint" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="type-card-title text-text-base">Endpoint</h2>
      <p className="type-caption tabular-nums text-text-muted">{`${rows.length}개 · 에러 많은 순`}</p>
    </div>
    <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
      <table aria-label="Endpoint 목록" className="w-full table-fixed text-xs">
        <thead className="border-b border-ui-border bg-ui-table-header text-text-muted"><tr>
          <th scope="col" className="px-4 py-3 text-left font-medium">Endpoint</th>
          <th scope="col" className="w-16 px-4 py-3 text-right font-medium sm:w-20">요청</th>
          <th scope="col" className="w-20 px-4 py-3 text-right font-medium">에러율</th>
          <th scope="col" className="hidden w-24 px-4 py-3 text-right font-medium sm:table-cell">p95</th>
          <th scope="col" className="hidden w-32 px-4 py-3 text-right font-medium md:table-cell">마지막 오류</th>
        </tr></thead>
        <tbody className="divide-y divide-ui-border-soft">{shown.map(row => {
          const active = isSelected(row);
          const lastError = row.lastErrorAt ? formatDistanceToNow(new Date(row.lastErrorAt), { addSuffix: true, locale: ko }) : '-';
          return <tr key={`${row.method} ${row.path}`} className={`transition-colors ${active ? 'bg-ui-hover' : 'hover:bg-ui-hover-soft'}`}>
            <td className="min-w-0 px-4 py-2.5">
              <Button type="button" variant="text" size="sm" aria-pressed={active}
                aria-label={`${row.method} ${row.path} 요청만 보기`}
                onClick={() => pick(row)}
                className="group -ml-3 min-w-0 max-w-full max-sm:h-11">
                <span className="shrink-0 font-mono text-text-muted">{row.method}</span>
                <span className="truncate font-mono underline-offset-2 group-hover:underline group-focus-visible:underline">{row.path}</span>
              </Button>
              <p className="tabular-nums text-text-muted sm:hidden">p95 {p95(row)}</p>
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">{row.count.toLocaleString()}</td>
            <td className={`px-4 py-2.5 text-right tabular-nums ${row.errorCount ? 'text-status-error' : 'text-text-secondary'}`}>{rate(row).toFixed(1)}%</td>
            <td className="hidden px-4 py-2.5 text-right tabular-nums text-text-secondary sm:table-cell">{p95(row)}</td>
            <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-text-muted md:table-cell">{lastError}</td>
          </tr>;
        })}</tbody>
      </table>
      {rows.length > LIMIT && selectedIndex < LIMIT && <div className="border-t border-ui-border-soft px-4 py-2">
        <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '상위 10개만 보기' : `모두 보기 (${rows.length}개)`}</Button>
      </div>}
    </div>
  </section>;
}
