import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConnectionSourceBadge, EmptyState, PageHeader, ResourceCardHeader, StatusBadge } from '../../components/common';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { api, type InfrastructureResource } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

function resourceOnline(resource: InfrastructureResource) {
  return resource.isActive && Boolean(resource.lastSeenAt) && Date.now() - new Date(resource.lastSeenAt!).getTime() < 2 * 60 * 1000;
}

function ResourceCard({ resource }: { resource: InfrastructureResource }) {
  const direct = resource.adapter === 'otel-collector';
  const values = [
    ['CPU', resource.cpuUsage],
    ['메모리', resource.memoryUsage],
    ['디스크', resource.diskUsage],
  ] as const;
  return (
    <Link
      to={direct ? `/infrastructure/${resource.id}` : `/agents/${resource.id}`}
      className="card-interactive group rounded-xl border border-ui-border bg-bg-surface p-4"
    >
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-primary">{resource.name}</h3>}
        badge={<ConnectionSourceBadge source={direct ? 'direct' : 'docker'} />}
        status={<StatusBadge healthy={resourceOnline(resource)} />}
      />
      {values.some(([, value]) => value != null) ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {values.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-text-dim">{label}</p>
              <p className="text-base text-text-base">{value == null ? '—' :`${value.toFixed(1)}%`}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-text-dim">아직 수집된 호스트 메트릭이 없습니다</p>
      )}
    </Link>
  );
}

export function InfrastructurePage() {
  const [resources, setResources] = useState<InfrastructureResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    api.getInfrastructureResources()
      .then(rows => { if (alive) setResources(rows ?? []); })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div>
      <PageHeader title="인프라" subtitle="서버의 CPU, 메모리, 디스크 상태를 확인하고 자원 이상을 찾습니다.">
        <MonitoringConnection capability="infrastructure" onConnected={reload} />
      </PageHeader>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-44 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div>
      ) : error ? (
        <EmptyState icon="error_outline" title="인프라를 불러오지 못했습니다" description={error} />
      ) : resources.length === 0 ? (
        <EmptyState icon="memory" title="표시할 인프라가 없습니다" description="기존 Docker 환경을 선택하거나 표준 OpenTelemetry Collector를 연결하면 여기에 표시됩니다.">
          <MonitoringConnection capability="infrastructure" onConnected={reload} />
        </EmptyState>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">인프라 대상</h2>
            <span className="text-xs text-text-dim">{resources.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resources.map(resource => <ResourceCard key={resource.id} resource={resource} />)}
          </div>
        </section>
      )}
    </div>
  );
}
