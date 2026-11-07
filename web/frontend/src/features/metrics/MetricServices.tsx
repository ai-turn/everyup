import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ResourceCardHeader, ResourceTable, StatusLight, Tooltip, type ListView } from '../../components/common';
import { flaggedMetrics, metricCollection, metricFlags, metricTitle } from './metricPresentation';
import type { MetricServiceRow } from './useMetricServices';

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko });

type Row = MetricServiceRow & { flagged: MetricServiceRow['metrics'] };

/** 확인 필요 수 — 임계값 초과가 있으면 오류색, 그 밖의 상태만 있으면 경고색. 중지한 서비스는 판정하지 않는다. */
function AttentionCount({ row }: { row: Row }) {
  if (!row.active) return <Tooltip content="수집을 중지한 서비스" focusable><span className="text-text-muted">-</span></Tooltip>;
  const tone = row.flagged.some(metric => metric.breached) ? 'text-status-error' : row.flagged.length ? 'text-status-warn' : 'text-text-base';
  return <span className={`tabular-nums ${tone}`}>{row.flagged.length}</span>;
}

/** 무엇을 봐야 하는지 한 줄 — 확인할 지표가 있으면 그 이름과 상태, 없으면 마지막 수신. */
function AttentionLine({ row, query, now }: { row: Row; query: string; now: number }) {
  const matching = query && !row.name.toLowerCase().includes(query) ? row.metricNames.filter(name => name.toLowerCase().includes(query)) : [];
  if (matching.length) return <Tooltip content={matching.join(', ')} focusable><span className="min-w-0 truncate font-mono text-text-secondary">{matching.join(', ')}</span></Tooltip>;
  if (row.metrics.length === 0) return <span className="text-text-muted">아직 수신한 메트릭이 없습니다</span>;
  // 줄바꿈은 항목 사이에서만 — "1분 / 미만 전"처럼 시간 표현이 갈라지지 않게
  if (row.flagged.length === 0) return <>
    {row.active && <span className="whitespace-nowrap text-text-muted">이상 없음</span>}
    <span className="whitespace-nowrap text-text-muted">마지막 수신 {row.lastReceivedAt ? ago(row.lastReceivedAt) : '기록 없음'}</span>
  </>;
  const [first, ...rest] = row.flagged;
  const flag = metricFlags(first, now)[0];
  return <>
    <span className={`shrink-0 whitespace-nowrap font-medium ${first.breached ? 'text-status-error' : 'text-status-warn'}`}>{flag.label}</span>
    <Tooltip content={first.metricName} focusable><span className="min-w-0 truncate text-text-secondary">{metricTitle(first)}</span></Tooltip>
    {rest.length > 0 && <span className="shrink-0 whitespace-nowrap text-text-muted">외 {rest.length}개</span>}
  </>;
}

function Status({ row }: { row: Row }) {
  return <StatusLight {...metricCollection(row.active, row.lastReceivedAt, row.lastMetricAt)} />;
}

function Count({ label, children }: { label: string; children: React.ReactNode }) {
  return <div role="group" aria-label={label}><p className="text-xs text-text-dim">{label}</p><p className="text-lg">{children}</p></div>;
}

export function MetricServices({ rows, now, view, returnTo, query }: {
  rows: MetricServiceRow[];
  /** 판정 기준 시각 — 목록을 불러온 때 */
  now: number;
  view: ListView;
  returnTo: string;
  query: string;
}) {
  const items: Row[] = rows.map(row => ({ ...row, flagged: flaggedMetrics(row.active, row.metrics, now) }));
  const line = (row: Row) => <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"><AttentionLine row={row} query={query} now={now} /></div>;

  if (view === 'card') return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {items.map(row => <Link key={row.id} to={`/metrics/${row.id}`} state={{ returnTo }} className="card-interactive group flex min-w-0 flex-col rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{row.name}</h3>} status={<Status row={row} />} />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Count label="확인 필요"><AttentionCount row={row} /></Count>
        <Count label="메트릭"><span className="tabular-nums text-text-base">{row.metrics.length}</span></Count>
      </div>
      <div className="mt-3">{line(row)}</div>
    </Link>)}
  </div>;

  return <ResourceTable rows={items} rowKey={row => row.id} ariaLabel="메트릭 서비스 그리드" columns={[
    { key: 'name', label: '서비스', render: row => <>
      <Link to={`/metrics/${row.id}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link>
      <div className="mt-2 md:hidden"><Status row={row} /></div>
      <div className="mt-2 xl:hidden">{line(row)}</div>
    </> },
    { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: row => <Status row={row} /> },
    { key: 'attention', label: '확인 필요', className: 'w-24', align: 'right', render: row => <AttentionCount row={row} /> },
    { key: 'count', label: '메트릭', className: 'w-20', align: 'right', render: row => <span className="tabular-nums">{row.metrics.length}</span> },
    { key: 'detail', label: '확인할 지표', className: 'hidden xl:table-cell', render: line },
  ]} />;
}
