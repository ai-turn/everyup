import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CollectionStatusBadge, EmptyState, ListViewToggle, PageHeader, ResourceCardHeader, ResourceTable, StatusLight } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { CRITICAL_PCT } from '../../features/infra/components/InfraGauges';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import { api, type InfrastructureResource } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { isCollectorFresh } from '../../utils/operationalStatus';

const USAGE = [['cpuUsage', 'CPU'], ['memoryUsage', '메모리'], ['diskUsage', '디스크']] as const;

// 수집 상태다 — 정상/장애로 그리면 수신이 잠깐 끊긴 호스트가 장애로 읽힌다 (DESIGN.md §5.1a).
function resourceCollectionStatus(resource: InfrastructureResource) {
  if (!resource.isActive) return <StatusLight tone="error" label="중지됨" />;
  if (!resource.lastSeenAt) return <CollectionStatusBadge status="waiting" />;
  return <CollectionStatusBadge status={isCollectorFresh(resource.lastSeenAt) ? 'collecting' : 'delayed'} />;
}

// 상세 게이지와 같은 선을 넘은 값만 칠한다 — 목록에서 자원 이상을 찾는 단서다.
function UsageValue({ value }: { value?: number }) {
  if (value == null) return <>-</>;
  if (value < CRITICAL_PCT) return <>{value.toFixed(1)}%</>;
  return <span className="text-status-error">{value.toFixed(1)}%<span className="sr-only"> 위험</span></span>;
}

function ResourceCard({ resource, returnTo }: { resource: InfrastructureResource; returnTo: string }) {
  return (
    <Link
      to={`/infrastructure/${resource.id}`}
      state={{ returnTo }}
      className="card-interactive group rounded-xl border border-ui-border bg-bg-surface p-4"
    >
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{resource.name}</h3>}
        status={resourceCollectionStatus(resource)}
      />
      {USAGE.some(([key]) => resource[key] != null) ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {USAGE.map(([key, label]) => (
            <div key={key}>
              <p className="text-xs text-text-dim">{label}</p>
              <p className="text-base text-text-base"><UsageValue value={resource[key]} /></p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 type-body text-text-muted">아직 수집된 호스트 메트릭이 없습니다</p>
      )}
    </Link>
  );
}

export function InfrastructurePage() {
  const { view, setView, returnTo } = useListView();
  const [resources, setResources] = useState<InfrastructureResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    // 같은 목록을 개요·그룹·알림도 쓰므로 Docker 호스트는 서버가 아니라 여기서 뺀다(ADR 0007).
    api.getInfrastructureResources()
      .then(rows => { if (alive) setResources((rows ?? []).filter(resource => resource.adapter === 'otel-collector')); })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div>
      <PageHeader title="인프라" subtitle="서버의 CPU, 메모리, 디스크 상태를 확인하고 자원 이상을 찾습니다.">
        <MonitoringConnection capability="infrastructure" onConnected={reload} />
      </PageHeader>
      <div className="mb-5 flex"><ListViewToggle view={view} onChange={setView} /></div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-44 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div>
      ) : error ? (
        <EmptyState icon="error_outline" title="인프라를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />
      ) : resources.length === 0 ? (
        <EmptyState icon="memory" title="표시할 인프라가 없습니다" description="표준 OpenTelemetry Collector를 연결하면 여기에 표시됩니다.">
          <div className="flex flex-col items-center gap-4">
            <MonitoringConnection capability="infrastructure" onConnected={reload} />
            <DockerEnvironmentHint />
          </div>
        </EmptyState>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">인프라 대상</h2>
            <span className="text-xs text-text-dim">{resources.length}</span>
          </div>
          {view === 'card' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{resources.map(resource => <ResourceCard key={resource.id} resource={resource} returnTo={returnTo} />)}</div> :
            <ResourceTable rows={resources} rowKey={row => row.id} ariaLabel="인프라 대상 그리드" columns={[
              { key: 'name', label: '대상', render: row => <><Link to={`/infrastructure/${row.id}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link><div className="mt-2 md:hidden">{resourceCollectionStatus(row)}<p className="mt-2 type-caption text-text-muted">{USAGE.map(([key, label], index) => <Fragment key={key}>{index > 0 && ', '}{label} <UsageValue value={row[key]} /></Fragment>)}</p></div></> },
              { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: resourceCollectionStatus },
              ...USAGE.map(([key, label]) => ({ key, label, className: 'hidden w-24 md:table-cell', align: 'right' as const, render: (row: InfrastructureResource) => <UsageValue value={row[key]} /> })),
            ]} />}
        </section>
      )}
    </div>
  );
}
