import { Tooltip } from '../../components/common/Tooltip';
import { Link } from 'react-router-dom';
import { CollectionStatusBadge, LoadErrorBanner, ResourceCardHeader, ResourceTable, StatusLight } from '../../components/common';
import { TelemetryCollectionStatus } from '../telemetry/components/TelemetryCollectionStatus';
import type { ApiRequestStatusSummary } from '../../services/api';
import type { ApiTarget } from './useApiTargets';
import type { GlobalTimeRange } from '../../components/common';

function totalRequests(summary: ApiRequestStatusSummary) {
  return summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther;
}

// 상세의 에러율과 같은 정의(5xx 또는 OTel ERROR). 5xx 건수만 보이면 목록 0건인 서비스가 상세에서는 에러율이 있었다.
function errorRate(summary?: ApiRequestStatusSummary) {
  const total = summary ? totalRequests(summary) : 0;
  return summary && total > 0 ? summary.errorCount / total * 100 : null;
}

const waiting = (row: ApiTarget) => !row.service.isActive || row.collection === 'waiting';

// 문제 순: 에러율 → 5xx 건수. 아직 받은 적 없거나 중지한 대상은 맨 아래.
function compareTargets(a: ApiTarget, b: ApiTarget) {
  return Number(waiting(a)) - Number(waiting(b))
    || (errorRate(b.summary) ?? -1) - (errorRate(a.summary) ?? -1)
    || (b.summary?.count5xx ?? 0) - (a.summary?.count5xx ?? 0);
}

function summaryText({ summary, loading, collection }: ApiTarget) {
  if (loading) return '요약 조회 중…';
  if (!summary) return '-';
  if (summary.top5xxPath) return `${summary.top5xxMethod} ${summary.top5xxPath}`;
  if (totalRequests(summary) > 0) return '이 기간에 5xx 없음';
  return collection === 'waiting' ? '아직 수신한 트레이스 없음' : '이 기간에 수집된 HTTP 요청 없음';
}

function status(row: ApiTarget) {
  if (!row.service.isActive) return <StatusLight tone="error" label="중지됨" />;
  return row.collection ? <CollectionStatusBadge status={row.collection} /> : <TelemetryCollectionStatus active />;
}

const count = (row: ApiTarget) => row.summary ? totalRequests(row.summary).toLocaleString() : '-';
const rate = (row: ApiTarget) => {
  const value = errorRate(row.summary);
  return <span className={value ? 'text-status-error' : ''}>{value === null ? '-' : `${value.toFixed(1)}%`}</span>;
};
const p95 = (row: ApiTarget) => row.summary?.timed ? `${row.summary.p95.toLocaleString()}ms` : '-';

export function ApiTargets({ rows: unsorted, view, range, returnTo, onRetry }: {
  rows: ApiTarget[]; view: 'card' | 'grid'; range: GlobalTimeRange; returnTo: string; onRetry: (id: string) => void;
}) {
  const rows = [...unsorted].sort(compareTargets);
  const to = (row: ApiTarget) => `/api/${row.service.id}?range=${range}`;
  const error = (row: ApiTarget) => (row.error || row.loading) && <div className="mt-2">
    <LoadErrorBanner inline role="status" title={row.loading ? '요약을 다시 확인하고 있습니다…' : '요약을 불러오지 못했습니다'}
      retrying={row.loading} onRetry={() => onRetry(row.service.id)} />
  </div>;
  return <section aria-label="API 대상">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="type-section-title text-text-base">API 대상</h2>
      <span className="type-caption text-text-dim">{`${rows.length}개 · 최근 ${Number.parseInt(range)}시간, 에러율 높은 순`}</span>
    </div>
    {view === 'card' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => <article key={row.service.id} className="card-interactive group rounded-xl border border-ui-border bg-bg-surface">
        <Link to={to(row)} state={{ returnTo }} className="block p-4">
        <ResourceCardHeader
          title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{row.service.name}</h3>}
          status={status(row)}
        />
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div><p className="type-caption text-text-dim">요청</p><p className="type-stat text-text-base">{count(row)}</p></div>
          <div><p className="type-caption text-text-dim">에러율</p><p className="type-stat text-text-base">{rate(row)}</p></div>
          <div><p className="type-caption text-text-dim">p95</p><p className="type-stat text-text-base">{p95(row)}</p></div>
        </div>
        {row.summary && <p className={`mt-4 break-all type-caption text-text-muted ${row.summary.top5xxPath ? 'font-mono' : ''}`}>{row.summary.top5xxPath && <span className="font-sans">5xx 최다 경로 </span>}{summaryText(row)}</p>}
        </Link>
        {(row.error || row.loading) && <div className="px-4 pb-4">{error(row)}</div>}
      </article>)}
    </div> : <ResourceTable rows={rows} rowKey={row => row.service.id} ariaLabel="API 대상 그리드" columns={[
      { key: 'name', label: '대상', render: row => <><Link to={to(row)} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.service.name}</Link><div className="mt-2 md:hidden">{status(row)}<p className="mt-2 type-caption tabular-nums text-text-muted sm:hidden">p95 {p95(row)}</p></div>{row.summary && <Tooltip content={summaryText(row)} focusable><p className="mt-2 truncate type-caption text-text-muted lg:hidden">{summaryText(row)}</p></Tooltip>}{error(row)}</> },
      { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: status },
      { key: 'total', label: '요청', className: 'w-20 sm:w-24', align: 'right', render: count },
      { key: 'errorRate', label: '에러율', className: 'w-20', align: 'right', render: rate },
      { key: 'p95', label: 'p95', className: 'hidden w-24 sm:table-cell', align: 'right', render: p95 },
      { key: 'path', label: '5xx 최다 경로', className: 'hidden lg:table-cell', render: row => <Tooltip content={summaryText(row)} focusable><p className={`truncate type-caption text-text-muted ${row.summary?.top5xxPath ? 'font-mono' : ''}`}>{summaryText(row)}</p></Tooltip> },
    ]} />}
  </section>;
}
