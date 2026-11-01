import { Link } from 'react-router-dom';
import { ResourceCardHeader, ResourceTable, Tooltip, type ListView } from '../../components/common';
import { TelemetryCollectionStatus } from '../telemetry/components/TelemetryCollectionStatus';
import type { MetricServiceRow } from './useMetricServices';

const NAMES_SHOWN = 3;

function MetricNames({ names, query }: { names: string[]; query: string }) {
  const matching = query ? names.filter(name => name.toLowerCase().includes(query)) : [];
  const preview = matching.length ? matching : names;
  return names.length ? <>
    <ul className="space-y-1">
      {preview.slice(0, NAMES_SHOWN).map(name => <li key={name} className="truncate font-mono text-xs text-text-secondary"><Tooltip content={name} focusable><span>{name}</span></Tooltip></li>)}
    </ul>
    {preview.length > NAMES_SHOWN && <p className="mt-1 type-caption text-text-muted">외 {preview.length - NAMES_SHOWN}개</p>}
  </> : <p className="type-body text-text-muted">저장된 메트릭이 없습니다.</p>;
}

function LastMetricReceived({ at }: { at?: string }) {
  return <p className="type-caption text-text-muted">
    마지막 수신 {at ? <time dateTime={at}>{new Date(at).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</time> : '기록 없음'}
  </p>;
}

export function MetricServices({ rows, view, returnTo, query }: {
  rows: MetricServiceRow[];
  view: ListView;
  returnTo: string;
  query: string;
}) {
  if (view === 'card') return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {rows.map(row => <Link key={row.id} to={`/metrics/${row.id}`} state={{ returnTo }} className="card-interactive group min-w-0 rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{row.name}</h3>}
        status={<TelemetryCollectionStatus active={row.active} />}
      />
      <div className="mt-4 space-y-2">
        <p className="type-caption text-text-muted">메트릭 {row.metricNames.length}개</p>
        <MetricNames names={row.metricNames} query={query} />
        <LastMetricReceived at={row.lastMetricAt} />
      </div>
    </Link>)}
  </div>;

  return <ResourceTable rows={rows} rowKey={row => row.id} ariaLabel="메트릭 서비스 그리드" columns={[
    { key: 'name', label: '서비스', render: row => <>
      <Link to={`/metrics/${row.id}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link>
      <div className="mt-2 md:hidden"><TelemetryCollectionStatus active={row.active} /></div>
      <div className="mt-2"><LastMetricReceived at={row.lastMetricAt} /></div>
      <div className="mt-2 lg:hidden"><MetricNames names={row.metricNames} query={query} /></div>
    </> },
    { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: row => <TelemetryCollectionStatus active={row.active} /> },
    { key: 'count', label: '메트릭', className: 'w-20 sm:w-24', align: 'right', render: row => row.metricNames.length },
    { key: 'metrics', label: '메트릭 이름', className: 'hidden lg:table-cell', render: row => <MetricNames names={row.metricNames} query={query} /> },
  ]} />;
}
