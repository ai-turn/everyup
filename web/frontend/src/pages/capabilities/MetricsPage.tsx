import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConnectionSourceBadge, EmptyState, PageHeader, ResourceCardHeader } from '../../components/common';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import {
  api,
  type AgentServiceFlat,
  type ConnectedAgent,
  type ObservedService,
  type OtelServiceMetric,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

interface AgentMetricRow extends OtelServiceMetric {
  agent: ConnectedAgent;
  service?: AgentServiceFlat;
}

const METRIC_SKELETONS = ['metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6'];

function formatMetric(value: number, unit?: string) {
  if (unit === 'By') {
    if (Math.abs(value) >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
    if (Math.abs(value) >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
    if (Math.abs(value) >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  }
  const formatted = Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function MetricCard({
  name,
  connection,
  subtitle,
  metric,
  to,
  active = true,
}: {
  name: string;
  connection: 'direct' | 'docker';
  subtitle?: string;
  metric?: OtelServiceMetric;
  to: string;
  active?: boolean;
}) {
  return (
    <Link to={to} className="card-interactive group rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-primary">{name}</h3>}
        badge={<ConnectionSourceBadge source={connection} />}
        subtitle={subtitle}
        status={
          <span className="flex items-center gap-1.5 type-caption text-text-muted">
            <span className={`h-2 w-2 rounded-full ${active ? 'bg-status-healthy' : 'bg-status-error'}`} aria-hidden="true" />
            {active ? '수집 가능' : '중지됨'}
          </span>
        }
      />
      {metric ? (
        <>
          <p className="mt-4 break-all font-mono text-xs text-text-muted">{metric.metricName}</p>
          <div className="mt-6 flex items-end justify-between gap-3">
            <span className="text-xs text-text-muted">현재 값</span>
            <span className="font-mono text-2xl tabular-nums text-text-base">{formatMetric(metric.value, metric.unit)}</span>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-lg bg-ui-hover-soft px-3 py-4 text-sm text-text-muted">첫 메트릭 수신을 기다리는 중입니다.</div>
      )}
    </Link>
  );
}

export function MetricsPage() {
  const [agentMetrics, setAgentMetrics] = useState<AgentMetricRow[]>([]);
  const [directServices, setDirectServices] = useState<ObservedService[]>([]);
  const [directMetrics, setDirectMetrics] = useState<OtelServiceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getAgents(),
      api.getAllAgentServicesFlat(),
      api.getObservedServices('metrics'),
      api.getObservedServiceMetrics(),
    ])
      .then(async ([agents, services, observedServices, observedMetrics]) => {
        const servicesByName = new Map(services.map(service => [`${service.agentId}:${service.name}`, service]));
        const rows = await Promise.all(agents.map(async agent => {
          const items = await api.getAgentServiceMetrics(agent.id);
          return items.map(metric => ({
            ...metric,
            agent,
            service: servicesByName.get(`${agent.id}:${metric.serviceName}`),
          }));
        }));
        if (!alive) return;
        setAgentMetrics(rows.flat());
        setDirectServices(observedServices ?? []);
        setDirectMetrics(observedMetrics ?? []);
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const directByService = useMemo(
    () => new Map(directMetrics.map(metric => [metric.serviceId, metric])),
    [directMetrics],
  );
  const visibleAgentMetrics = useMemo(
    () => agentMetrics.filter(metric => metric.service),
    [agentMetrics],
  );

  const isEmpty = directServices.length === 0 && visibleAgentMetrics.length === 0;

  return (
    <div>
      <PageHeader title="메트릭" subtitle="서비스의 성능 수치와 시간에 따른 변화를 확인합니다.">
        <MonitoringConnection capability="metrics" onConnected={reload} />
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {METRIC_SKELETONS.map(item => <div key={item} className="h-44 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="메트릭을 불러오지 못했습니다" description={error} />
      ) : isEmpty ? (
        <EmptyState icon="monitoring" title="아직 연결된 메트릭 서비스가 없습니다" description="기존 Docker 환경을 선택하거나 앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
          <MonitoringConnection capability="metrics" onConnected={reload} />
        </EmptyState>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">메트릭 서비스</h2>
            <span className="font-mono text-xs text-text-dim">{directServices.length + visibleAgentMetrics.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {directServices.map(service => (
              <MetricCard
                key={service.id}
                name={service.name}
                connection="direct"
                metric={directByService.get(service.id)}
                to={`/metrics/${service.id}`}
                active={service.isActive}
              />
            ))}
            {visibleAgentMetrics.map(metric => metric.service ? (
              <MetricCard
                key={`${metric.agent.id}:${metric.serviceName}:${metric.metricName}`}
                name={metric.serviceName}
                connection="docker"
                subtitle={metric.agent.name}
                metric={metric}
                to={`/services/${metric.service.agentId}/${encodeURIComponent(metric.service.key)}?tab=metrics`}
              />
            ) : null)}
          </div>
        </section>
      )}

    </div>
  );
}
