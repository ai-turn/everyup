import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ConnectionSourceBadge, EmptyState, PageHeader, ResourceCardHeader } from '../../components/common';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { api, type AgentServiceFlat, type LogLevel, type ObservedService } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

// "지금 이상이 있는가"에 답하는 창 — 보존 기간 전체를 세면 끝난 사고가 계속 빨갛게 남는다.
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface LevelCounts { error: number; warn: number }

// limit=1이어도 total은 서버 COUNT라 정확하다. 로그 행은 상세 화면에서 본다.
async function countLevels(fetch: (level: LogLevel) => Promise<{ total: number }>): Promise<LevelCounts> {
  const [error, warn] = await Promise.all([fetch('error'), fetch('warn')]);
  return { error: error.total, warn: warn.total };
}

function LogCard({
  name,
  connection,
  subtitle,
  status,
  counts,
  to,
}: {
  name: string;
  connection: 'direct' | 'docker';
  subtitle?: string;
  status?: ReactNode;
  counts: LevelCounts;
  to: string;
}) {
  return (
    <Link to={to} className="card-interactive group rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-primary">{name}</h3>}
        badge={<ConnectionSourceBadge source={connection} />}
        subtitle={subtitle}
        status={status}
      />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div><p className="text-xs text-text-dim">ERROR</p><p className={`text-lg tabular-nums ${counts.error > 0 ? 'text-status-error' : 'text-text-base'}`}>{counts.error.toLocaleString()}</p></div>
        <div><p className="text-xs text-text-dim">WARN</p><p className={`text-lg tabular-nums ${counts.warn > 0 ? 'text-status-warn' : 'text-text-base'}`}>{counts.warn.toLocaleString()}</p></div>
      </div>
    </Link>
  );
}

export function LogsPage() {
  const [agentRows, setAgentRows] = useState<{ service: AgentServiceFlat; counts: LevelCounts }[]>([]);
  const [directRows, setDirectRows] = useState<{ service: ObservedService; counts: LevelCounts }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    const from = new Date(Date.now() - WINDOW_MS).toISOString();
    Promise.all([api.getAgents(), api.getAllAgentServicesFlat(), api.getObservedServices('logs')])
      .then(async ([agents, agentServices, directServices]) => {
        // 프로필이 없으면 전 기능 수집(MonitoringSetupPanel과 같은 기본값). 로그를 끈 에이전트의
        // 서비스는 0건이 "이상 없음"으로 읽히므로 뺀다.
        const logAgents = new Set(agents
          .filter(agent => !agent.profile?.capabilities.length || agent.profile.capabilities.includes('logs'))
          .map(agent => agent.id));
        const [agentCounts, directCounts] = await Promise.all([
          Promise.all((agentServices ?? []).filter(service => logAgents.has(service.agentId)).map(async service => ({
            service,
            counts: await countLevels(level => api.getAgentServiceLogs(service.agentId, service.key, { level, from, limit: 1 })),
          }))),
          Promise.all((directServices ?? []).map(async service => ({
            service,
            counts: await countLevels(level => api.getObservedServiceLogs(service.id, { level, from, limit: 1 })),
          }))),
        ]);
        if (!alive) return;
        setError(null);
        setAgentRows(agentCounts);
        setDirectRows(directCounts);
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const isEmpty = directRows.length === 0 && agentRows.length === 0;

  return (
    <div>
      <PageHeader title="로그" subtitle="서비스별 최근 오류·경고 건수를 보고, 서비스를 열어 로그를 검색합니다.">
        <MonitoringConnection capability="logs" onConnected={reload} />
      </PageHeader>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-32 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="로그를 불러오지 못했습니다" description={error} />
      ) : isEmpty ? (
        <EmptyState icon="article" title="아직 로그 서비스가 없습니다" description="기존 Docker 환경을 선택하거나 앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
          <MonitoringConnection capability="logs" onConnected={reload} />
        </EmptyState>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="type-section-title text-text-base">로그 서비스</h2>
            <span className="text-xs text-text-dim">{`최근 24시간 · ${directRows.length + agentRows.length}`}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {directRows.map(({ service, counts }) => (
              <LogCard
                key={service.id}
                name={service.name}
                connection="direct"
                status={
                  <span
                    className={`mt-1 block h-2.5 w-2.5 shrink-0 rounded-full ${service.isActive ? 'bg-status-healthy' : 'bg-status-error'}`}
                    role="img"
                    aria-label={service.isActive ? '수집 가능' : '중지됨'}
                  />
                }
                counts={counts}
                to={`/logs/${service.id}`}
              />
            ))}
            {agentRows.map(({ service, counts }) => (
              <LogCard
                key={`${service.agentId}:${service.key}`}
                name={service.name}
                connection="docker"
                subtitle={service.agentName}
                counts={counts}
                to={`/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=logs`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
