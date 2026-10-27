import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ListViewToggle, PageHeader, ResourceCardHeader, ResourceTable } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { TelemetryCollectionStatus } from '../../features/telemetry/components/TelemetryCollectionStatus';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { DockerEnvironmentHint } from '../../features/services/components/DockerEnvironmentHint';
import {
  api,
  type ObservedService,
  type OtelServiceMetric,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

const METRIC_SKELETONS = ['metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6'];

const METRIC_NAMES_SHOWN = 3;

// Same order as the metric picker in the detail view.
const sortedNames = (names: string[] = []) => [...names].sort((a, b) => a.localeCompare(b));

function MetricCard({
  name,
  metricNames,
  to,
  active,
  returnTo,
}: {
  name: string;
  /** Sorted by name — the detail opens on the first one. */
  metricNames: string[];
  to: string;
  /** 직접 연결이 켜져 있는가 */
  active: boolean;
  returnTo: string;
}) {
  return (
    <Link to={to} state={{ returnTo }} className="card-interactive group rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{name}</h3>}
        // API·인프라 목록과 같은 수집 상태 표기 (§5.1a)
        status={<TelemetryCollectionStatus active={active} />}
      />
      {/* No single "current value": which of a service's metrics would represent it is arbitrary. */}
      {metricNames.length > 0 ? (
        <div className="mt-4">
          <p className="type-caption text-text-muted">메트릭 {metricNames.length}개</p>
          <ul className="mt-1.5 space-y-1">
            {metricNames.slice(0, METRIC_NAMES_SHOWN).map(metricName => (
              <li key={metricName} className="truncate font-mono text-xs text-text-secondary">{metricName}</li>
            ))}
          </ul>
          {metricNames.length > METRIC_NAMES_SHOWN && (
            <p className="mt-1 type-caption text-text-dim">외 {metricNames.length - METRIC_NAMES_SHOWN}개</p>
          )}
        </div>
      ) : (
        <p className="mt-4 type-body text-text-muted">첫 메트릭 수신을 기다리는 중입니다.</p>
      )}
    </Link>
  );
}

export function MetricsPage() {
  const { view, setView, returnTo } = useListView();
  const [directServices, setDirectServices] = useState<ObservedService[]>([]);
  const [directMetrics, setDirectMetrics] = useState<OtelServiceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getObservedServices('metrics'),
      api.getObservedServiceMetrics(),
    ])
      .then(([observedServices, observedMetrics]) => {
        if (!alive) return;
        setDirectServices(observedServices ?? []);
        setDirectMetrics(observedMetrics ?? []);
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const directNamesByService = useMemo(() => {
    const names = new Map<string, string[]>();
    for (const metric of directMetrics) {
      if (!metric.serviceId) continue;
      names.set(metric.serviceId, [...(names.get(metric.serviceId) ?? []), metric.metricName]);
    }
    return names;
  }, [directMetrics]);

  const rows = directServices.map(service => ({ id: service.id, name: service.name, metricNames: sortedNames(directNamesByService.get(service.id)), to: `/metrics/${service.id}`, active: service.isActive }));

  return (
    <div>
      <PageHeader title="메트릭" subtitle="서비스의 성능 수치와 시간에 따른 변화를 확인합니다.">
        <MonitoringConnection capability="metrics" onConnected={reload} />
      </PageHeader>
      <div className="mb-5 flex"><ListViewToggle view={view} onChange={setView} /></div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {METRIC_SKELETONS.map(item => <div key={item} className="h-44 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="메트릭을 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: reload }} />
      ) : rows.length === 0 ? (
        <EmptyState icon="monitoring" title="아직 연결된 메트릭 서비스가 없습니다" description="앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
          <div className="flex flex-col items-center gap-4">
            <MonitoringConnection capability="metrics" onConnected={reload} />
            <DockerEnvironmentHint />
          </div>
        </EmptyState>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">메트릭 서비스</h2>
            <span className="text-xs text-text-dim">{rows.length}</span>
          </div>
          {view === 'card' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(row => <MetricCard key={row.id} {...row} returnTo={returnTo} />)}</div> :
            <ResourceTable rows={rows} rowKey={row => row.id} ariaLabel="메트릭 서비스 그리드" columns={[
              { key: 'name', label: '서비스', render: row => <><Link to={row.to} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link><div className="mt-2 md:hidden"><TelemetryCollectionStatus active={row.active} /></div><p className="mt-2 truncate font-mono text-xs text-text-muted lg:hidden">{row.metricNames.length ? row.metricNames.slice(0, METRIC_NAMES_SHOWN).join(', ') : '첫 메트릭 수신 대기'}</p></> },
              { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: row => <TelemetryCollectionStatus active={row.active} /> },
              { key: 'count', label: '메트릭', className: 'w-20 sm:w-24', align: 'right', render: row => row.metricNames.length },
              { key: 'metrics', label: '메트릭 이름', className: 'hidden lg:table-cell', render: row => row.metricNames.length ? <><ul className="space-y-1">{row.metricNames.slice(0, METRIC_NAMES_SHOWN).map(name => <li key={name} className="truncate font-mono text-xs text-text-secondary">{name}</li>)}</ul>{row.metricNames.length > METRIC_NAMES_SHOWN && <p className="mt-1 type-caption text-text-muted">외 {row.metricNames.length - METRIC_NAMES_SHOWN}개</p>}</> : <span className="type-caption text-text-muted">첫 메트릭 수신 대기</span> },
            ]} />}
        </section>
      )}

    </div>
  );
}
