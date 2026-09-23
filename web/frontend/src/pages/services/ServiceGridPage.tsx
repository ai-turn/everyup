import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { MaterialIcon } from '../../components/common/MaterialIcon';
import { PageHeader } from '../../components/common/PageHeader';
import { CollectionStatusBadge } from '../../components/common/CollectionStatusBadge';
import { SearchInput } from '../../components/common/SearchInput';
import { ListToolbar, ResourceCardHeader } from '../../components/common';
import { api, type AgentOverview, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { PendingServiceCard } from '../../features/services/components/PendingServiceCard';
import { AddServiceModal } from '../../features/services/components/AddServiceModal';
import { InstrumentationOverrideModal } from '../../features/services/components/InstrumentationOverrideModal';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { getErrorMessage } from '../../utils/errors';
import { activatable } from '../../utils/a11y';
import { toast } from 'react-hot-toast';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

interface ProjectCardProps {
  agentId: string;
  agent?: ConnectedAgent;
  agentName: string;
  services: AgentServiceFlat[];
  overview?: AgentOverview;
}

// One project (= one agent = one docker-compose host) rendered as a single card.
// Clicking drills into the project detail page that lists its internal services.
function ProjectCard({ agentId, agent, agentName, services, overview }: ProjectCardProps) {
  const navigate = useNavigate();

  const online = agent ? agentOnline(agent) : true;
  const total = services.length;
  const healthy = services.filter(s => s.healthy).length;
  const down = services.filter(s => !s.healthy);
  const allHealthy = down.length === 0;

  return (
    <div
      {...activatable(() => navigate(`/agents/${agentId}`))}
      aria-label={agentName}
      className="card-interactive bg-bg-surface border border-ui-border rounded-xl p-4 cursor-pointer flex flex-col gap-3"
    >
      {/* Header: collection state + environment name */}
      <ResourceCardHeader
        title={<h2 className="type-card-title text-text-base truncate">{agentName}</h2>}
        status={<CollectionStatusBadge status={online ? 'collecting' : 'delayed'} />}
      />

      {/* Summary: service count + health */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-text-muted">{`서비스 ${total}개`}</span>
        <span className={`flex items-center gap-1 text-sm ${allHealthy ? 'text-status-healthy' : 'text-status-error'}`}>
          <MaterialIcon size={20} name={allHealthy ? 'check_circle' : 'cancel'} />
          {healthy}/{total} 정상
        </span>
      </div>

      {/* Failing services preview */}
      {down.length > 0 && (
        <p className="text-xs text-status-error truncate -mt-1">
          장애: {down.map(s => s.name).join(', ')}
        </p>
      )}

      {/* KPI rollup (from /agents/overview; hidden until it loads) */}
      {overview && (
        <div className="flex items-center gap-4 text-sm">
          <div>
            <div className="text-xs text-text-dim">가동률 30일</div>
            <div className="font-medium text-text-base">
              {overview.uptimePct != null ? `${overview.uptimePct.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-dim">요청 24h</div>
            <div className="font-medium text-text-base">
              {overview.requests24h > 0
                ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(overview.requests24h)
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-dim">p95</div>
            <div className={`font-medium ${
              overview.p95Ms != null && overview.p95Ms > 500
                ? 'text-status-warn'
                : 'text-text-base'
            }`}>
              {overview.p95Ms != null ? `${overview.p95Ms}ms` : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ServiceGridPage() {

  const navigate = useNavigate();
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [overview, setOverview] = useState<Record<string, AgentOverview>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // 개요의 `Docker 연결`은 ?connect=docker로 와서 연결 모달을 바로 연다. 새로고침 때 다시
  // 열리지 않게 파라미터는 읽자마자 지운다.
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(() => searchParams.get('connect') === 'docker');
  useEffect(() => {
    if (searchParams.has('connect')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  const [installModalAgent, setInstallModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [instrumentationAgentId, setInstrumentationAgentId] = useState<string | null>(null);
  const [keyModalAgent, setKeyModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    // KPI rollup is non-critical — cards render without it and fill in when it lands.
    api.getAgentsOverview()
      .then((rows) => setOverview(Object.fromEntries((rows ?? []).map((o) => [o.agentId, o]))))
      .catch(() => {});
    try {
      const [svcs, agts] = await Promise.all([
        api.getAllAgentServicesFlat(),
        api.getAgents(),
      ]);
      setServices(svcs ?? []);
      setAgents(agts ?? []);
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const handleDelete = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    setDeleteTarget({ id: agentId, name: agent?.name ?? agentId });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteAgent(deleteTarget.id);
      toast.success('Docker 환경이 비활성화됐습니다');
      load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleteTarget(null);
    }
  };

  const reportingAgentIds = new Set(services.map((s) => s.agentId));
  // Agents that exist but haven't reported any service yet — show them as
  // "pending" cards in the main grid so a fresh creation feels like it landed.
  const pendingAgents = agents.filter((a) => !reportingAgentIds.has(a.id));
  const connectedAgents = agents.filter((a) => reportingAgentIds.has(a.id));

  // Group ALL services by project (agent) — one project = one card. Orphan
  // services whose agent row is missing fall back to a synthetic group.
  type ProjectGroup = { agentId: string; agent?: ConnectedAgent; agentName: string; services: AgentServiceFlat[] };
  const byAgent = new Map<string, AgentServiceFlat[]>();
  for (const s of services) {
    const arr = byAgent.get(s.agentId);
    if (arr) arr.push(s);
    else byAgent.set(s.agentId, [s]);
  }
  const allGroups: ProjectGroup[] = [];
  for (const agent of connectedAgents) {
    allGroups.push({ agentId: agent.id, agent, agentName: agent.name, services: byAgent.get(agent.id) ?? [] });
    byAgent.delete(agent.id);
  }
  for (const [agentId, svcs] of byAgent) {
    allGroups.push({ agentId, agentName: svcs[0]?.agentName ?? agentId, services: svcs });
  }

  // Project search: a project matches if its name or any of its services match.
  const groups = allGroups.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.agentName.toLowerCase().includes(q) ||
      g.services.some((s) => s.name.toLowerCase().includes(q) || s.endpoint.toLowerCase().includes(q))
    );
  });

  const visiblePending = pendingAgents.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Docker 환경"
        subtitle="연결된 Docker 환경과 모니터링 서비스 현황"
      >
        <Button onClick={() => setShowAddModal(true)}>
          <MaterialIcon size={20} name="add" />
          Docker 연결
        </Button>
      </PageHeader>

      {/* Search */}
      <ListToolbar search={
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="서비스 또는 Docker 환경 이름으로 검색"
          aria-label="서비스 또는 Docker 환경 검색"
        />
      } />

      <div className="space-y-5">

      {/* Content */}
      {error && (
        <section className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div className="flex items-start gap-3"><MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" /><div><p className="text-sm font-medium text-text-base">Docker 환경을 불러오지 못했습니다</p><p className="mt-0.5 text-xs text-text-muted">{error}</p></div></div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>다시 시도</Button>
        </section>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-ui-hover animate-pulse" />
          ))}
        </div>
      ) : !error && services.length === 0 && agents.length === 0 ? (
        <EmptyState
          icon="sensors"
          title="아직 연결된 Docker 환경이 없습니다"
          description="Docker 환경을 연결하면 컨테이너와 호스트가 자동으로 표시됩니다"
          action={{ label: 'Docker 연결', onClick: () => setShowAddModal(true) }}
        />
      ) : groups.length === 0 && visiblePending.length === 0 ? (
        <div className="py-16 text-center text-text-dim text-sm">
          검색 결과가 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <ProjectCard
              key={g.agentId}
              agentId={g.agentId}
              agent={g.agent}
              agentName={g.agentName}
              services={g.services}
              overview={overview[g.agentId]}
            />
          ))}
          {visiblePending.map((agent) => (
            <PendingServiceCard
              key={agent.id}
              agent={agent}
              onDelete={handleDelete}
              onViewKey={() => setKeyModalAgent({ id: agent.id, name: agent.name })}
              onInstall={() => setInstallModalAgent({ id: agent.id, name: agent.name })}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddServiceModal
          onClose={() => setShowAddModal(false)}
          onCreated={load}
          onOpenProject={(id) => {
            setShowAddModal(false);
            navigate(`/agents/${id}`);
          }}
          onConfigureInstrumentation={(id) => {
            setShowAddModal(false);
            setInstrumentationAgentId(id);
          }}
        />
      )}

      {installModalAgent && (
        <AddServiceModal
          existingAgent={installModalAgent}
          onClose={() => setInstallModalAgent(null)}
          onCreated={load}
          onOpenProject={(id) => {
            setInstallModalAgent(null);
            navigate(`/agents/${id}`);
          }}
          onConfigureInstrumentation={(id) => {
            setInstallModalAgent(null);
            setInstrumentationAgentId(id);
          }}
        />
      )}

      {instrumentationAgentId && (
        <InstrumentationOverrideModal
          agentId={instrumentationAgentId}
          onClose={() => setInstrumentationAgentId(null)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Docker 환경 비활성화"
        message={`${deleteTarget?.name ?? ''} Docker 환경을 비활성화하시겠습니까?`}
        description="Docker 수집기 연결이 차단되며 수집 데이터는 보존됩니다."
        confirmLabel="비활성화"
      />

      {keyModalAgent && (
        <ApiKeyModal
          agentId={keyModalAgent.id}
          agentName={keyModalAgent.name}
          onClose={() => setKeyModalAgent(null)}
          onRotated={load}
        />
      )}
      </div>
    </div>
  );
}
