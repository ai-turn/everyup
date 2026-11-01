import { Tooltip } from '../../components/common/Tooltip';
import { Link } from 'react-router-dom';
import { Button, ResourceCardHeader, ResourceTable } from '../../components/common';
import { TelemetryCollectionStatus } from '../telemetry/components/TelemetryCollectionStatus';
import type { ApiRequestStatusSummary } from '../../services/api';
import type { ApiTarget } from './useApiTargets';
import type { GlobalTimeRange } from '../../components/common';

function totalRequests(summary: ApiRequestStatusSummary) {
  return summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther;
}

function summaryText({ summary, loading }: ApiTarget) {
  if (loading) return '요약 조회 중…';
  if (!summary) return '요약 조회 실패';
  if (summary.top5xxPath) return `${summary.top5xxMethod} ${summary.top5xxPath}`;
  return totalRequests(summary) > 0 ? '이 기간에 5xx 없음' : '이 기간에 수집된 HTTP 요청 없음';
}

export function ApiTargets({ rows, view, range, returnTo, onRetry }: {
  rows: ApiTarget[]; view: 'card' | 'grid'; range: GlobalTimeRange; returnTo: string; onRetry: (id: string) => void;
}) {
  const to = (row: ApiTarget) => `/api/${row.service.id}?range=${range}`;
  const error = (row: ApiTarget) => (row.error || row.loading) && <div className="mt-2 space-y-2" role="status">
    <p className="type-caption text-status-warn">{row.loading ? '요약을 다시 확인하고 있습니다…' : '요약을 불러오지 못했습니다'}</p>
    <Button size="sm" variant="secondary" loading={row.loading} onClick={() => onRetry(row.service.id)}>다시 시도</Button>
  </div>;
  return <section aria-label="API 대상">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="type-section-title text-text-base">API 대상</h2>
      <span className="type-caption text-text-dim">{rows.length}개</span>
    </div>
    {view === 'card' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => <article key={row.service.id} className="card-interactive group rounded-xl border border-ui-border bg-bg-surface">
        <Link to={to(row)} state={{ returnTo }} className="block p-4">
        <ResourceCardHeader
          title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{row.service.name}</h3>}
          status={<TelemetryCollectionStatus active={row.service.isActive} />}
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div><p className="type-caption text-text-dim">요청</p><p className="text-lg tabular-nums text-text-base">{row.summary ? totalRequests(row.summary).toLocaleString() : '—'}</p></div>
          <div><p className="type-caption text-text-dim">5xx</p><p className={`text-lg tabular-nums ${row.summary?.count5xx ? 'text-status-error' : 'text-text-base'}`}>{row.summary?.count5xx.toLocaleString() ?? '—'}</p></div>
        </div>
        <p className={`mt-4 break-all type-caption text-text-muted ${row.summary?.top5xxPath ? 'font-mono' : ''}`}>{row.summary?.top5xxPath && <span className="font-sans">5xx 최다 경로 </span>}{summaryText(row)}</p>
        </Link>
        {(row.error || row.loading) && <div className="px-4 pb-4">{error(row)}</div>}
      </article>)}
    </div> : <ResourceTable rows={rows} rowKey={row => row.service.id} ariaLabel="API 대상 그리드" columns={[
      { key: 'name', label: '대상', render: row => <><Link to={to(row)} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.service.name}</Link><div className="mt-2 md:hidden"><TelemetryCollectionStatus active={row.service.isActive} /></div><Tooltip content={summaryText(row)} focusable><p className="mt-2 truncate type-caption text-text-muted lg:hidden">{summaryText(row)}</p></Tooltip>{error(row)}</> },
      { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: row => <TelemetryCollectionStatus active={row.service.isActive} /> },
      { key: 'total', label: '요청', className: 'w-20 sm:w-24', align: 'right', render: row => row.summary ? totalRequests(row.summary).toLocaleString() : '—' },
      { key: 'errors', label: '5xx', className: 'w-20', align: 'right', render: row => <span className={row.summary?.count5xx ? 'text-status-error' : ''}>{row.summary?.count5xx.toLocaleString() ?? '—'}</span> },
      { key: 'path', label: '5xx 최다 경로', className: 'hidden lg:table-cell', render: row => <Tooltip content={summaryText(row)} focusable><p className={`truncate type-caption text-text-muted ${row.summary?.top5xxPath ? 'font-mono' : ''}`}>{summaryText(row)}</p></Tooltip> },
    ]} />}
  </section>;
}
