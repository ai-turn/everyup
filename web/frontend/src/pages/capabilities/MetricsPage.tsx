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

// The API returns one row per (service, metric); a card is one service.
interface DockerMetricCard {
  agent: ConnectedAgent;
  service: AgentServiceFlat;
  metricNames: string[];
}

const METRIC_SKELETONS = ['metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6'];

const METRIC_NAMES_SHOWN = 3;

// Same order as the metric picker in the detail view.
const sortedNames = (names: string[] = []) => [...names].sort((a, b) => a.localeCompare(b));

function MetricCard({
  name,
  connection,
  subtitle,
  metricNames,
  to,
  active = true,
}: {
  name: string;
  connection: 'direct' | 'docker';
  subtitle?: string;
  /** Sorted by name — the detail opens on the first one. */
  metricNames: string[];
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
        <div className="mt-6 rounded-lg bg-ui-hover-soft px-3 py-4 text-sm text-text-muted">첫 메트릭 수신을 기다리는 중입니다.</div>
      )}
    </Link>
  );
}

export function MetricsPage() {
  const [dockerCards, setDockerCards] = useState<DockerMetricCard[]>([]);
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
        const cards = new Map<string, DockerMetricCard>();
        await Promise.all(agents.map(async agent => {
          const items = await api.getAgentServiceMetrics(agent.id);
          for (const metric of items) {
            const key = `${agent.id}:${metric.serviceName}`;
            const service = servicesByName.get(key);
            if (!service) continue;
            const card = cards.get(key) ?? { agent, service, metricNames: [] };
            card.metricNames.push(metric.metricName);
            cards.set(key, card);
          }
        }));
        if (!alive) return;
        setDockerCards([...cards.values()]);
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

  const isEmpty = directServices.length === 0 && dockerCards.length === 0;

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
            <span className="text-xs text-text-dim">{directServices.length + dockerCards.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {directServices.map(service => (
              <MetricCard
                key={service.id}
                name={service.name}
                connection="direct"
                metricNames={sortedNames(directNamesByService.get(service.id))}
                to={`/metrics/${service.id}`}
                active={service.isActive}
              />
            ))}
            {dockerCards.map(card => (
              <MetricCard
                key={`${card.agent.id}:${card.service.name}`}
                name={card.service.name}
                connection="docker"
                subtitle={card.agent.name}
                metricNames={sortedNames(card.metricNames)}
                to={`/services/${card.service.agentId}/${encodeURIComponent(card.service.key)}?tab=metrics`}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
