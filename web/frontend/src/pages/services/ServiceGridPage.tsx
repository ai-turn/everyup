import { useState, useEffect, useCallback } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { MaterialIcon } from '../../components/common/MaterialIcon';
import { PageHeader } from '../../components/common/PageHeader';
import { CollectionStatusBadge } from '../../components/common/CollectionStatusBadge';
import { SearchInput } from '../../components/common/SearchInput';
import { ListToolbar, ListViewToggle, ResourceCardHeader, ResourceTable, StatusLight } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { api, type AgentOverview, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { PendingServiceCard } from '../../features/services/components/PendingServiceCard';
import { AddServiceModal } from '../../features/services/components/AddServiceModal';
import { InstrumentationOverrideModal } from '../../features/services/components/InstrumentationOverrideModal';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { getErrorMessage } from '../../utils/errors';
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
  returnTo: string;
}

// One project (= one agent = one docker-compose host) rendered as a single card.
// Clicking drills into the project detail page that lists its internal services.
function ProjectCard({ agentId, agent, agentName, services, overview, returnTo }: ProjectCardProps) {
  const online = agent ? agentOnline(agent) : true;
  const total = services.length;
  const healthy = services.filter(s => s.healthy).length;
  const down = services.filter(s => !s.healthy);
  const allHealthy = down.length === 0;

  return (
    <Link
      to={`/agents/${agentId}`}
      state={{ returnTo }}
      aria-label={agentName}
      className="card-interactive bg-bg-surface border border-ui-border rounded-xl p-4 flex flex-col gap-3"
    >
      {/* Header: collection state + environment name */}
      <ResourceCardHeader
        title={<h2 className="type-card-title text-text-base truncate">{agentName}</h2>}
        status={<CollectionStatusBadge status={online ? 'collecting' : 'delayed'} />}
      />

      {/* Summary: service count + health */}
      <div className="flex items-center justify-between gap-2">
        <span className="type-caption text-text-muted">{`서비스 ${total}개`}</span>
        <StatusLight tone={allHealthy ? 'healthy' : 'error'} label={`${healthy}/${total} 정상`} />
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
            <div className="text-xs text-text-dim">업타임 30일</div>
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
    </Link>
  );
}

export function ServiceGridPage() {
  const { view, setView, returnTo } = useListView();

  const navigate = useNavigate();
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [overview, setOverview] = useState<Record<string, AgentOverview>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 개요의 `Docker 연결`은 ?connect=docker로 와서 연결 모달을 바로 연다. 새로고침 때 다시
  // 열리지 않게 파라미터는 읽자마자 지운다.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const setSearch = (value: string) => setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (value) next.set('q', value); else next.delete('q');
    return next;
  }, { replace: true });
  const [showAddModal, setShowAddModal] = useState(() => searchParams.get('connect') === 'docker');
  useEffect(() => {
    if (searchParams.has('connect')) setSearchParams(current => { const next = new URLSearchParams(current); next.delete('connect'); return next; }, { replace: true });
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
  }, [load]);
  useAutoRefresh(load, 30_000);

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
  const environmentRows = [
    ...groups.map(group => ({ ...group, pending: false, rollup: overview[group.agentId] })),
    ...visiblePending.map(agent => ({ agentId: agent.id, agent, agentName: agent.name, services: [] as AgentServiceFlat[], pending: true, rollup: overview[agent.id] })),
  ];

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
      }><ListViewToggle view={view} onChange={setView} /></ListToolbar>

      <div className="space-y-5">

      {/* Content */}
      {error && (
        <section className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div className="flex items-start gap-3"><MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" /><div><p className="text-sm font-medium text-text-base">Docker 환경을 불러오지 못했습니다</p><p className="mt-0.5 type-body text-text-muted">{error}</p></div></div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>다시 시도</Button>
        </section>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        <EmptyState icon="sensors" title="검색 결과가 없습니다" />
      ) : (
        view === 'grid' ? <ResourceTable rows={environmentRows} rowKey={row => row.agentId} ariaLabel="Docker 환경 그리드" columns={[
          { key: 'name', label: 'Docker 환경', render: row => <>{row.pending ? <span className="block truncate font-medium">{row.agentName}</span> : <Link to={`/agents/${row.agentId}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.agentName}</Link>}<div className="mt-2 md:hidden">{row.pending ? <StatusLight tone="idle" label="설치 대기" /> : <CollectionStatusBadge status={row.agent && agentOnline(row.agent) ? 'collecting' : 'delayed'} />}</div><p className="mt-2 type-caption text-text-muted lg:hidden">서비스 {row.services.length}개{row.rollup?.uptimePct != null ? ` · 30일 업타임 ${row.rollup.uptimePct.toFixed(2)}%` : ''}</p></> },
          { key: 'collection', label: '수집', className: 'hidden w-36 md:table-cell', render: row => row.pending ? <StatusLight tone="idle" label="설치 대기" /> : <CollectionStatusBadge status={row.agent && agentOnline(row.agent) ? 'collecting' : 'delayed'} /> },
          { key: 'services', label: '서비스', className: 'hidden w-24 lg:table-cell', align: 'right', render: row => row.services.length },
          { key: 'uptime', label: '업타임 30일', className: 'hidden w-32 lg:table-cell', align: 'right', render: row => row.rollup?.uptimePct == null ? '—' : `${row.rollup.uptimePct.toFixed(2)}%` },
          { key: 'requests', label: '요청 24h', className: 'hidden w-28 xl:table-cell', align: 'right', render: row => row.rollup?.requests24h ? row.rollup.requests24h.toLocaleString() : '—' },
          { key: 'p95', label: 'p95', className: 'hidden w-24 xl:table-cell', align: 'right', render: row => row.rollup?.p95Ms == null ? '—' : `${row.rollup.p95Ms}ms` },
          { key: 'actions', label: '작업', className: 'w-32', render: row => row.pending ? <details><summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-ui-border text-action">설치·작업</summary><div className="mt-2 flex flex-col gap-2"><Button size="sm" variant="secondary" onClick={() => setInstallModalAgent({ id: row.agentId, name: row.agentName })}>설치 명령어</Button><Button size="sm" variant="ghost" onClick={() => setKeyModalAgent({ id: row.agentId, name: row.agentName })}>API Key</Button><Button size="sm" variant="destructive" onClick={() => handleDelete(row.agentId)}>비활성화</Button></div></details> : <span className="type-caption text-text-muted">{row.services.filter(service => !service.healthy).length ? `장애 ${row.services.filter(service => !service.healthy).length}개` : '장애 신호 없음'}</span> },
        ]} /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g) => (
            <ProjectCard
              key={g.agentId}
              agentId={g.agentId}
              agent={g.agent}
              agentName={g.agentName}
              services={g.services}
              overview={overview[g.agentId]}
              returnTo={returnTo}
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
        description="Docker Collector 연결이 차단되며 수집 데이터는 보존됩니다."
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
