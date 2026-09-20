import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConnectionSourceBadge, EmptyState, PageHeader, ResourceCardHeader, StatusBadge } from '../../components/common';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import {
  api,
  type ApiRequestStatusSummary,
  type ConnectedAgent,
  type ObservedService,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

interface AgentApiSummary {
  agent: ConnectedAgent;
  summary: ApiRequestStatusSummary;
}

interface DirectApiSummary {
  service: ObservedService;
  summary: ApiRequestStatusSummary;
}

function agentOnline(agent: ConnectedAgent) {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

function totalRequests(summary: ApiRequestStatusSummary) {
  return summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther;
}

function ApiCard({
  name,
  connection,
  active,
  summary,
  to,
}: {
  name: string;
  connection: 'direct' | 'docker';
  active: boolean;
  summary: ApiRequestStatusSummary;
  to: string;
}) {
  const total = totalRequests(summary);
  const hasErrors = summary.count5xx > 0;
  return (
    <Link to={to} className="card-interactive group rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        icon="api"
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-primary">{name}</h3>}
        badge={<ConnectionSourceBadge source={connection} />}
        status={<StatusBadge healthy={active} />}
      />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div><p className="text-xs text-text-dim">요청</p><p className="font-mono text-lg text-text-base">{total.toLocaleString()}</p></div>
        <div><p className="text-xs text-text-dim">5xx</p><p className={`font-mono text-lg ${hasErrors ? 'text-status-error' : 'text-text-base'}`}>{summary.count5xx.toLocaleString()}</p></div>
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
  const [agentRows, setAgentRows] = useState<AgentApiSummary[]>([]);
  const [directRows, setDirectRows] = useState<DirectApiSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getAgents(), api.getObservedServices('traces')])
      .then(async ([agents, services]) => {
        const [agentSummaries, directSummaries] = await Promise.all([
          Promise.all(agents.map(async agent => ({
            agent,
            summary: await api.getRequestStatusSummary(agent.id),
          }))),
          Promise.all(services.map(async service => ({
            service,
            summary: await api.getObservedServiceRequestStatusSummary(service.id),
          }))),
        ]);
        if (!alive) return;
        setAgentRows(agentSummaries);
        setDirectRows(directSummaries);
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const isEmpty = directRows.length === 0 && agentRows.length === 0;

  return (
    <div>
      <PageHeader title="API 요청" subtitle="요청 수, 응답 시간, 오류 추이를 확인해 API 문제를 찾습니다.">
        <MonitoringConnection capability="api" onConnected={reload} />
      </PageHeader>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-40 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="API 데이터를 불러오지 못했습니다" description={error} />
      ) : isEmpty ? (
        <EmptyState icon="api" title="표시할 API 대상이 없습니다" description="기존 Docker 환경을 선택하거나 앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
          <MonitoringConnection capability="api" onConnected={reload} />
        </EmptyState>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">API 대상</h2>
            <span className="font-mono text-xs text-text-dim">{directRows.length + agentRows.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {directRows.map(({ service, summary }) => (
              <ApiCard key={service.id} name={service.name} connection="direct" active={service.isActive} summary={summary} to={`/api/${service.id}`} />
            ))}
            {agentRows.map(({ agent, summary }) => (
              <ApiCard key={agent.id} name={agent.name} connection="docker" active={agentOnline(agent)} summary={summary} to={`/agents/${agent.id}`} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
