import { useState, useEffect, useCallback } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { MaterialIcon } from '../../components/common/MaterialIcon';
import { PageHeader } from '../../components/common/PageHeader';
import { CollectionStatusBadge } from '../../components/common/CollectionStatusBadge';
import { SearchInput } from '../../components/common/SearchInput';
import { ListToolbar, ListViewToggle, RefreshIconButton, ResourceCardHeader, ResourceTable, StatusLight } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { api, type AgentOverview, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { PendingServiceCard } from '../../features/services/components/PendingServiceCard';
import { AddServiceModal } from '../../features/services/components/AddServiceModal';
import { InstrumentationOverrideModal } from '../../features/services/components/InstrumentationOverrideModal';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { getErrorMessage } from '../../utils/errors';
import { returnToWithQuery } from '../../utils/listReturnTo';
import { toast } from 'react-hot-toast';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

interface ProjectCardProps {
  agentId: string;
  agent?: ConnectedAgent;
  agentName: string;
  services: AgentServiceFlat[];
  /** 검색으로 걸러진 하위 서비스. 그리드의 트리 행과 같은 목록이다. */
  shownServices: AgentServiceFlat[];
  overview?: AgentOverview;
  returnTo: string;
}

const serviceHref = (service: AgentServiceFlat) => `/services/${service.agentId}/${encodeURIComponent(service.key)}`;
// 장애 먼저, 같은 상태끼리는 이름순 — 트리 행과 카드 목록이 같은 순서를 쓴다.
const byAttention = (a: AgentServiceFlat, b: AgentServiceFlat) => Number(a.healthy) - Number(b.healthy) || a.name.localeCompare(b.name);

// One project (= one agent = one docker-compose host) rendered as a single card.
// 카드 전체는 제목 링크를 늘려(after:inset-0) 환경 상세로 가고, 하위 서비스는 각자 링크다 —
// 그리드의 트리 행과 같은 목적지를 카드에서도 고를 수 있어야 한다(DESIGN.md §4.5 두 보기 동일).
function ProjectCard({ agentId, agent, agentName, services, shownServices, overview, returnTo }: ProjectCardProps) {
  const online = agent ? agentOnline(agent) : true;
  const total = services.length;
  const healthy = services.filter(s => s.healthy).length;
  const allHealthy = healthy === total;

  return (
    <article className="card-interactive relative bg-bg-surface border border-ui-border-soft rounded-xl p-4 flex flex-col gap-heading">
      {/* Header: collection state + environment name */}
      <ResourceCardHeader
        title={<h2 className="type-card-title text-text-base truncate"><Link to={`/agents/${agentId}`} state={{ returnTo }} className="after:absolute after:inset-0 after:rounded-xl">{agentName}</Link></h2>}
        status={<CollectionStatusBadge status={online ? 'collecting' : 'delayed'} />}
      />

      {/* Summary: service count + health */}
      <div className="flex items-center justify-between gap-2">
        <span className="type-caption text-text-muted">{`서비스 ${total}개`}</span>
        <StatusLight tone={allHealthy ? 'healthy' : 'error'} label={`${healthy}/${total} 정상`} />
      </div>

      {/* 하위 서비스: 장애를 앞에 두고, 각 이름은 서비스 상세로 간다. 카드 링크 위로 올려(z-10) 따로 누른다. */}
      {shownServices.length > 0 && (
        <ul className="relative z-10 flex flex-wrap gap-x-3 gap-y-1" aria-label={`${agentName} 서비스`}>
          {[...shownServices].sort(byAttention).map((service) => (
            <li key={service.key}>
              <Link to={serviceHref(service)} state={{ returnTo }} className={`inline-flex items-center gap-1.5 type-caption hover:underline ${service.healthy ? 'text-text-muted' : 'text-status-error'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${service.healthy ? 'bg-status-healthy-fill' : 'bg-status-error-fill'}`} aria-hidden="true" />
                {service.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* KPI rollup (from /agents/overview; hidden until it loads) */}
      {overview && (
        <div className="flex items-center gap-4 text-sm">
          <div>
            <div className="text-xs text-text-dim">업타임 30일</div>
            <div className="font-medium text-text-base">
              {overview.uptimePct != null ? `${overview.uptimePct.toFixed(2)}%` : '-'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-dim">요청 24h</div>
            <div className="font-medium text-text-base">
              {overview.requests24h > 0
                ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(overview.requests24h)
                : '-'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-dim">p95</div>
            <div className={`font-medium ${
              overview.p95Ms != null && overview.p95Ms > 500
                ? 'text-status-warn'
                : 'text-text-base'
            }`}>
              {overview.p95Ms != null ? `${overview.p95Ms}ms` : '-'}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export function ServiceGridPage() {
  const { view, setView } = useListView();

  const navigate = useNavigate();
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [overview, setOverview] = useState<Record<string, AgentOverview>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 개요의 `Docker 연결`은 ?connect=docker로 와서 연결 모달을 바로 연다. 새로고침 때 다시
  // 열리지 않게 파라미터는 읽자마자 지운다.
  const [searchParams, setSearchParams] = useSearchParams();
  // 입력값은 로컬 상태가 쥔다. URL(?q=)은 react-router가 transition 안에서 반영해 값이 한 박자 늦게 돌아오므로,
  // URL에 직접 묶으면 한글 조합 중 글자가 덮여 '결제'가 'ㄱ겨결결ㅈ제제'가 됐다. URL은 공유·복귀용 사본이다.
  // ponytail: URL→입력은 마운트 때만 읽는다. 같은 화면에서 ?q=만 바뀌는 이동이 생기면 그때 동기화를 더한다.
  const [search, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const setSearch = (value: string) => { setSearchInput(value); setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (value) next.set('q', value); else next.delete('q');
    return next;
  }, { replace: true }); };
  const location = useLocation();
  const returnTo = returnToWithQuery(location.pathname, searchParams, search);
  const [showAddModal, setShowAddModal] = useState(() => searchParams.get('connect') === 'docker');
  useEffect(() => {
    if (searchParams.has('connect')) setSearchParams(current => { const next = new URLSearchParams(current); next.delete('connect'); return next; }, { replace: true });
  }, [searchParams, setSearchParams]);
  const [installModalAgent, setInstallModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [instrumentationAgentId, setInstrumentationAgentId] = useState<string | null>(null);
  const [keyModalAgent, setKeyModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  // 접은 환경만 기억한다. 기본은 모두 펼침(환경과 서비스를 한눈에 보는 것이 이 목록의 목적).
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleCollapsed = (agentId: string) => setCollapsed(current => {
    const next = new Set(current);
    if (next.has(agentId)) next.delete(agentId); else next.add(agentId);
    return next;
  });

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
  // 이름이 맞으면 하위 서비스를 모두, 서비스만 맞으면 맞은 서비스만 펼친다.
  const q = search.toLowerCase();
  const serviceMatches = (s: AgentServiceFlat) => s.name.toLowerCase().includes(q) || s.endpoint.toLowerCase().includes(q);
  const groups = allGroups
    .map((g) => ({ ...g, shown: !q || g.agentName.toLowerCase().includes(q) ? g.services : g.services.filter(serviceMatches) }))
    .filter((g) => !q || g.agentName.toLowerCase().includes(q) || g.shown.length > 0);

  const visiblePending = pendingAgents.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));
  // 그리드는 환경 행 아래에 서비스 행을 끼운 평평한 목록이다. 열은 같은 표를 쓰고,
  // 이름 열만 깊이에 따라 들여쓰고 연결선을 그린다.
  type EnvRow = { kind: 'env'; agentId: string; agent?: ConnectedAgent; agentName: string; services: AgentServiceFlat[]; shown: AgentServiceFlat[]; pending: boolean; rollup?: AgentOverview };
  type ServiceRow = { kind: 'service'; agentId: string; service: AgentServiceFlat; last: boolean };
  const envRows: EnvRow[] = [
    ...groups.map(group => ({ kind: 'env' as const, ...group, pending: false, rollup: overview[group.agentId] })),
    ...visiblePending.map(agent => ({ kind: 'env' as const, agentId: agent.id, agent, agentName: agent.name, services: [], shown: [], pending: true, rollup: overview[agent.id] })),
  ];
  const treeRows: (EnvRow | ServiceRow)[] = envRows.flatMap((row): (EnvRow | ServiceRow)[] => {
    if (collapsed.has(row.agentId)) return [row];
    const children = [...row.shown].sort(byAttention);
    return [row, ...children.map((service, index) => ({ kind: 'service' as const, agentId: row.agentId, service, last: index === children.length - 1 }))];
  });
  const envStatus = (row: EnvRow) => row.pending ? <StatusLight tone="idle" label="설치 대기" /> : <CollectionStatusBadge status={row.agent && agentOnline(row.agent) ? 'collecting' : 'delayed'} />;
  // 업타임·요청·p95는 환경 행과 서비스 행이 같은 열을 쓴다 — 서비스 값은 같은 집계의 서비스별 조각이다.
  const rollupOf = (row: EnvRow | ServiceRow): { uptimePct: number | null; requests24h: number; p95Ms: number | null } | undefined =>
    row.kind === 'env' ? row.rollup : overview[row.agentId]?.services?.find(item => item.key === row.service.key);
  const shownServiceCount = envRows.reduce((sum, row) => sum + row.shown.length, 0);
  const serviceStatus = (service: AgentServiceFlat) => <StatusLight tone={service.healthy ? 'healthy' : 'error'} label={service.healthy ? '정상' : '장애'} />;

  return (
    // 머리말 → 툴바 → 목록은 페이지 블록 24px(page-stack).
    <div className="page-stack">
      <PageHeader menu
        title="Docker 환경"
      >
        <RefreshIconButton onClick={() => void load()} refreshing={loading} />
        {(services.length > 0 || agents.length > 0) && <ListViewToggle view={view} onChange={setView} />}
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
          onClear={() => setSearch('')}
          resultCount={`환경 ${envRows.length} · 서비스 ${shownServiceCount}`}
          shortcut
        />
      } />

      <div className="page-stack">

      {/* Content */}
      {error && (
        <section className="flex flex-col gap-lead rounded-xl border border-ui-border-soft bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div className="flex items-start gap-3"><MaterialIcon size={20} name="sync_problem" className="icon-lead text-status-warn" /><div><p className="type-label text-text-base">Docker 환경을 불러오지 못했습니다</p><p className="mt-intra type-body text-text-muted">{error}</p></div></div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>다시 시도</Button>
        </section>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-ui-hover animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 && agents.length === 0 ? (
        // 불러오지 못해 목록이 비었으면 위 오류 배너만 둔다. 빈 상태(연결 안내)나 "검색 결과가 없습니다"는
        // 사실이 아니다 — 검색하지 않았고, 연결된 환경이 없는지도 모른다(UI/UX 점검 A1).
        error ? null : (
        <EmptyState
          icon="sensors"
          title="아직 연결된 Docker 환경이 없습니다"
          description="Docker 환경을 연결하면 컨테이너와 호스트가 자동으로 표시됩니다"
          action={{ label: 'Docker 연결', onClick: () => setShowAddModal(true) }}
        />)
      ) : (
        <section>
        <h2 className="sr-only">Docker 환경 목록</h2>
        {envRows.length === 0 ? (error && !search.trim() ? null : <EmptyState icon="sensors" title="검색 결과가 없습니다" />) : view === 'grid' ? <ResourceTable rows={treeRows} rowKey={row => row.kind === 'env' ? row.agentId : `${row.agentId}/${row.service.key}`} ariaLabel="Docker 환경 그리드" columns={[
          { key: 'name', label: 'Docker 환경 · 서비스', render: row => row.kind === 'env' ? (
            // 펼침 버튼(20px)의 가운데(left-2.5)가 하위 행 연결선의 x다. -my-4 py-4로 셀 높이 전체를 덮어야 선이 행 사이에서 끊기지 않는다.
            <div className="relative -my-4 py-4">
              {row.shown.length > 0 && !collapsed.has(row.agentId) && <span aria-hidden="true" className="absolute top-9 bottom-0 left-2.5 w-px bg-ui-border" />}
              <div className="flex min-w-0 items-center gap-1.5">
                {row.shown.length > 0 ? (
                  // 보이는 자리는 20px 줄에 맞추고 누르는 영역은 32px — 빗나간 탭이 행 링크(환경 상세)로 새지 않게.
                  <button type="button" onClick={() => toggleCollapsed(row.agentId)} aria-expanded={!collapsed.has(row.agentId)} aria-label={`${row.agentName} 서비스 ${collapsed.has(row.agentId) ? '펼치기' : '접기'}`} className="-mx-1.5 -my-1.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-ui-hover hover:text-text-base">
                    <MaterialIcon name="chevron_right" className={`transition-transform ${collapsed.has(row.agentId) ? '' : 'rotate-90'}`} />
                  </button>
                ) : <span className="w-5 shrink-0" aria-hidden="true" />}
                {row.pending ? <span className="block truncate font-medium">{row.agentName}</span> : <Link to={`/agents/${row.agentId}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.agentName}</Link>}
              </div>
              {/* 서비스 수는 열 대신 이름 아래 보조 줄 — 서비스 행의 체크 주소와 같은 자리다. */}
              <p className="mt-intra pl-6.5 type-caption text-text-muted">서비스 {row.services.length}개<span className="lg:hidden">{row.rollup?.uptimePct != null ? ` · 30일 업타임 ${row.rollup.uptimePct.toFixed(2)}%` : ''}</span></p>
              <div className="mt-2 pl-6.5 md:hidden">{envStatus(row)}</div>
            </div>
          ) : (
            // 세로선은 위 행에서 이어 내려오고, 마지막 서비스에서 가로선 높이까지만 그린다(└).
            <div className="relative -my-4 py-4 pl-9">
              <span aria-hidden="true" className={`absolute top-0 left-2.5 w-px bg-ui-border ${row.last ? 'h-6.5' : 'bottom-0'}`} />
              <span aria-hidden="true" className="absolute top-6.5 left-2.5 h-px w-4 bg-ui-border" />
              {/* 표는 평평한 행이라 스크린리더는 들여쓰기를 모른다 — 어느 환경의 서비스인지 글로 붙인다(링크 이름은 그대로). */}
              <span className="sr-only">{row.service.agentName} 환경의 서비스</span>
              <Link to={serviceHref(row.service)} state={{ returnTo }} data-row-link className="block truncate text-text-base">{row.service.name}</Link>
              <p className="mt-intra truncate font-mono type-caption text-text-muted">{row.service.endpoint || row.service.key}</p>
              <div className="mt-2 md:hidden">{serviceStatus(row.service)}</div>
            </div>
          ) },
          { key: 'collection', label: '상태', className: 'hidden w-36 md:table-cell', render: row => row.kind === 'env' ? envStatus(row) : serviceStatus(row.service) },
          { key: 'uptime', label: '업타임 30일', className: 'hidden w-32 lg:table-cell', align: 'right', render: row => { const rollup = rollupOf(row); return rollup?.uptimePct == null ? '-' : `${rollup.uptimePct.toFixed(2)}%`; } },
          { key: 'requests', label: '요청 24h', className: 'hidden w-28 lg:table-cell', align: 'right', render: row => { const rollup = rollupOf(row); return rollup?.requests24h ? rollup.requests24h.toLocaleString() : '-'; } },
          { key: 'p95', label: 'p95', className: 'hidden w-24 xl:table-cell', align: 'right', render: row => { const rollup = rollupOf(row); return rollup?.p95Ms == null ? '-' : `${rollup.p95Ms.toLocaleString()}ms`; } },
          { key: 'actions', label: '최근 오류', className: 'w-32', render: row => row.kind === 'service' ? (row.service.healthy ? null : <span className="line-clamp-2 type-caption text-status-error">{row.service.lastError || '상태 체크 실패'}</span>) : row.pending ? <details><summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-ui-border text-action">설치·작업</summary><div className="mt-2 flex flex-col gap-label"><Button size="sm" variant="secondary" onClick={() => setInstallModalAgent({ id: row.agentId, name: row.agentName })}>설치 명령어</Button><Button size="sm" variant="ghost" onClick={() => setKeyModalAgent({ id: row.agentId, name: row.agentName })}>API Key</Button><Button size="sm" variant="destructive" onClick={() => handleDelete(row.agentId)}>비활성화</Button></div></details> : <span className="type-caption text-text-muted">{row.services.filter(service => !service.healthy).length ? `장애 ${row.services.filter(service => !service.healthy).length}개` : '장애 신호 없음'}</span> },
        ]} /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g) => (
            <ProjectCard
              key={g.agentId}
              agentId={g.agentId}
              agent={g.agent}
              agentName={g.agentName}
              services={g.services}
              shownServices={g.shown}
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
        </div>}
        </section>
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
