import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CollectionStatusBadge, EmptyState, ListViewToggle, PageHeader, ResourceCardHeader, ResourceTable, StatusLight } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { infraCollection, peakUsage, usageLevel, type UsageLevel } from '../../features/infra/usage';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import { api, type InfrastructureResource } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

const USAGE = [['cpuUsage', 'CPU'], ['memoryUsage', '메모리'], ['diskUsage', '디스크']] as const;

// 수집 상태다 — 정상/장애로 그리면 수신이 잠깐 끊긴 호스트가 장애로 읽힌다 (DESIGN.md §5.1a).
function resourceCollectionStatus(resource: InfrastructureResource) {
  if (!resource.isActive) return <StatusLight tone="error" label="중지됨" />;
  return <CollectionStatusBadge status={infraCollection(resource)} />;
}

const LEVEL_STYLE: Record<UsageLevel, { text: string; bar: string; label?: string }> = {
  critical: { text: 'text-status-error', bar: 'bg-status-error-fill', label: '위험' },
  warning: { text: 'text-status-warn', bar: 'bg-status-warn-fill', label: '주의' },
  normal: { text: 'text-text-base', bar: 'bg-primary' },
};

// 숫자만으로는 84.6%와 18.5%가 똑같이 보였다 — 막대 길이로 크기를, 색으로 주의·위험을 함께 보인다.
function UsageValue({ value, bar = false }: { value?: number; bar?: boolean }) {
  if (value == null) return <span className="text-text-muted">-</span>;
  const style = LEVEL_STYLE[usageLevel(value)];
  return (
    <span className="block">
      <span className={`tabular-nums ${style.text}`}>{value.toFixed(1)}%{style.label && <span className="sr-only"> {style.label}</span>}</span>
      {bar && (
        <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-ui-hover" aria-hidden="true">
          <span className={`block h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, value)}%` }} />
        </span>
      )}
    </span>
  );
}

const lastSeen = (resource: InfrastructureResource) =>
  resource.lastSeenAt ? formatDistanceToNow(new Date(resource.lastSeenAt), { addSuffix: true, locale: ko }) : '아직 없음';

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
              <div className="type-stat"><UsageValue value={resource[key]} bar /></div>
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
      // 사용률이 높은 서버가 위로 — 서버가 많아져도 먼저 볼 곳을 훑지 않고 찾는다.
      .then(rows => { if (alive) setResources((rows ?? []).filter(resource => resource.adapter === 'otel-collector').sort((a, b) => peakUsage(b) - peakUsage(a))); })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div>
      <PageHeader title="인프라" subtitle="인프라 Collector로 직접 연결한 서버의 CPU, 메모리, 디스크 상태입니다.">
        <MonitoringConnection capability="infrastructure" onConnected={reload} />
      </PageHeader>
      <DockerEnvironmentHint className="mb-5" />
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-44 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div>
      ) : error ? (
        <EmptyState icon="error_outline" title="인프라를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />
      ) : resources.length === 0 ? (
        <EmptyState icon="memory" title="표시할 인프라가 없습니다" description="표준 OpenTelemetry Collector를 연결하면 여기에 표시됩니다.">
          <div className="flex flex-col items-center gap-4">
            <MonitoringConnection capability="infrastructure" onConnected={reload} />
          </div>
        </EmptyState>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">인프라 대상</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-dim">{`서버 ${resources.length}개 · 사용률 높은 순`}</span>
              <ListViewToggle view={view} onChange={setView} />
            </div>
          </div>
          {view === 'card' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{resources.map(resource => <ResourceCard key={resource.id} resource={resource} returnTo={returnTo} />)}</div> :
            <ResourceTable rows={resources} rowKey={row => row.id} ariaLabel="인프라 대상 그리드" columns={[
              { key: 'name', label: '대상', render: row => <><Link to={`/infrastructure/${row.id}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link><div className="mt-2 md:hidden">{resourceCollectionStatus(row)}<p className="mt-2 type-caption text-text-muted">{USAGE.map(([key, label], index) => <Fragment key={key}>{index > 0 && ', '}{label} <UsageValue value={row[key]} /></Fragment>)}</p></div></> },
              { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: resourceCollectionStatus },
              { key: 'lastSeen', label: '마지막 수집', className: 'hidden w-32 lg:table-cell', render: row => <span className="text-text-muted">{lastSeen(row)}</span> },
              ...USAGE.map(([key, label]) => ({ key, label, className: 'hidden w-28 md:table-cell', align: 'right' as const, render: (row: InfrastructureResource) => <UsageValue value={row[key]} bar /> })),
            ]} />}
        </section>
      )}
    </div>
  );
}
