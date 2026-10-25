import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ListViewToggle, PageHeader, ResourceCardHeader, ResourceTable } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { TelemetryCollectionStatus } from '../../features/telemetry/components/TelemetryCollectionStatus';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import {
  api,
  type ApiRequestStatusSummary,
  type ObservedService,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

interface DirectApiSummary {
  service: ObservedService;
  summary: ApiRequestStatusSummary;
}

function totalRequests(summary: ApiRequestStatusSummary) {
  return summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther;
}

function ApiCard({
  name,
  active,
  summary,
  to,
  returnTo,
}: {
  name: string;
  active: boolean;
  summary: ApiRequestStatusSummary;
  to: string;
  returnTo: string;
}) {
  const total = totalRequests(summary);
  const hasErrors = summary.count5xx > 0;
  return (
    <Link to={to} state={{ returnTo }} className="card-interactive group rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{name}</h3>}
        // 수집 상태다 — 정상/장애(StatusBadge)로 그리면 Collector가 잠깐 끊긴 것이 서비스 장애로 읽힌다 (§5.1a).
        status={<TelemetryCollectionStatus active={active} />}
      />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div><p className="text-xs text-text-dim">요청</p><p className="text-lg text-text-base">{total.toLocaleString()}</p></div>
        <div><p className="text-xs text-text-dim">5xx</p><p className={`text-lg ${hasErrors ? 'text-status-error' : 'text-text-base'}`}>{summary.count5xx.toLocaleString()}</p></div>
      </div>
      {summary.top5xxPath ? (
        <p className="mt-4 truncate font-mono text-xs text-text-muted">{summary.top5xxMethod} {summary.top5xxPath}</p>
      ) : (
        <p className="mt-4 type-body text-text-muted">{total > 0 ? '아직 오류 요청이 없습니다' : '첫 trace 수신을 기다리는 중입니다.'}</p>
      )}
    </Link>
  );
}

export function ApiPage() {
  const { view, setView, returnTo } = useListView();
  const [directRows, setDirectRows] = useState<DirectApiSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    api.getObservedServices('traces')
      .then(async services => {
        const directSummaries = await Promise.all(services.map(async service => ({
          service,
          summary: await api.getObservedServiceRequestStatusSummary(service.id),
        })));
        if (!alive) return;
        setDirectRows(directSummaries);
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const rows = directRows.map(({ service, summary }) => ({ id: service.id, name: service.name, active: service.isActive, summary, to: `/api/${service.id}` }));

  return (
    <div>
      <PageHeader title="API 요청" subtitle="요청 수, 응답 시간, 오류 추이를 확인해 API 문제를 찾습니다.">
        <MonitoringConnection capability="api" onConnected={reload} />
      </PageHeader>
      <div className="mb-5 flex"><ListViewToggle view={view} onChange={setView} /></div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-40 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="API 데이터를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />
      ) : rows.length === 0 ? (
        <EmptyState icon="api" title="표시할 API 대상이 없습니다" description="앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
          <div className="flex flex-col items-center gap-4">
            <MonitoringConnection capability="api" onConnected={reload} />
            <DockerEnvironmentHint />
          </div>
        </EmptyState>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">API 대상</h2>
            <span className="text-xs text-text-dim">{rows.length}</span>
          </div>
          {view === 'card' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(row => <ApiCard key={row.id} {...row} returnTo={returnTo} />)}</div> :
            <ResourceTable rows={rows} rowKey={row => row.id} ariaLabel="API 대상 그리드" columns={[
              { key: 'name', label: '대상', render: row => <><Link to={row.to} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link><div className="mt-2 md:hidden"><TelemetryCollectionStatus active={row.active} /></div><p className="mt-2 truncate font-mono text-xs text-text-muted lg:hidden">{row.summary.top5xxPath ? `${row.summary.top5xxMethod} ${row.summary.top5xxPath}` : totalRequests(row.summary) > 0 ? '오류 요청 없음' : '첫 trace 수신 대기'}</p></> },
              { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: row => <TelemetryCollectionStatus active={row.active} /> },
              { key: 'total', label: '요청', className: 'w-20 sm:w-24', align: 'right', render: row => totalRequests(row.summary).toLocaleString() },
              { key: 'errors', label: '5xx', className: 'w-20', align: 'right', render: row => <span className={row.summary.count5xx ? 'text-status-error' : ''}>{row.summary.count5xx.toLocaleString()}</span> },
              { key: 'path', label: '최근 5xx 경로', className: 'hidden lg:table-cell', render: row => <p className="truncate font-mono text-xs text-text-muted">{row.summary.top5xxPath ? `${row.summary.top5xxMethod} ${row.summary.top5xxPath}` : totalRequests(row.summary) > 0 ? '오류 요청 없음' : '첫 trace 수신 대기'}</p> },
            ]} />}
        </section>
      )}

    </div>
  );
}
