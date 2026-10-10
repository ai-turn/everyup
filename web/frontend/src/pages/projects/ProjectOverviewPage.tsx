import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, DetailActionToolbar, EmptyState, MaterialIcon, PageHeader } from '../../components/common';
import {
  api,
  type AgentServiceFlat,
  type ConnectedAgent,
  type InfrastructureResource,
  type ObservedService,
  type Project,
  type UptimeMonitor,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { ProjectDialog } from './ProjectsPage';
import { isCollectorFresh } from '../../utils/operationalStatus';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';

type ProjectData = {
  project: Project | null;
  agents: ConnectedAgent[];
  services: AgentServiceFlat[];
  monitors: UptimeMonitor[];
  observedServices: ObservedService[];
  infrastructure: InfrastructureResource[];
};

type MemberState = 'healthy' | 'warn' | 'error' | 'idle';
type Member = { key: string; to: string; icon: string; name: string; detail: string; state: MemberState };

// 문제가 먼저 — 장애, 수집 지연, 비활성, 정상. 대상이 많아도 장애가 목록 아래에 묻히지 않게 해서
// 이 화면의 KPI 카드(장애 수·수집 확인 필요 수)를 대신한다. 같은 상태 안에서는 유형 순서를 지킨다(안정 정렬).
// key에 유형을 붙인다 — Docker 호스트의 인프라 리소스는 환경과 같은 id를 쓴다.
const STATE_ORDER: Record<MemberState, number> = { error: 0, warn: 1, idle: 2, healthy: 3 };

function MemberLink({ to, icon, name, detail, state }: Omit<Member, 'key'>) {
  const stateClass = { healthy: 'text-status-healthy', warn: 'text-status-warn', error: 'text-status-error', idle: 'text-status-idle' }[state];
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ui-hover-soft">
      <MaterialIcon size={20} name={icon} className={`shrink-0 ${stateClass}`} />
      <span className="min-w-0 flex-1"><span className="block truncate type-label text-text-base">{name}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{detail}</span></span>
      <MaterialIcon size={20} name="chevron_right" className="shrink-0 text-text-dim" />
    </Link>
  );
}

export function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectData>({ project: null, agents: [], services: [], monitors: [], observedServices: [], infrastructure: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  useBreadcrumb(data.project ? [{ label: data.project.name }] : []);

  // background: 자동 갱신·새로고침은 화면을 유지한 채 다시 불러온다 — 매번 스켈레톤으로 바꾸면 30초마다 페이지 전체가 깜빡인다.
  const load = useCallback(async (background = false) => {
    if (!projectId) return;
    if (!background) {
      setLoading(true);
      setError(null);
      setFailedSources([]);
    }
    try {
    const [projectsResult, agentsResult, servicesResult, monitorsResult, observedResult, infrastructureResult] = await Promise.allSettled([
      api.getProjects(), api.getAgents(), api.getAllAgentServicesFlat(), api.getUptimeMonitors(), api.getObservedServices(), api.getInfrastructureResources(),
    ]);
    if (projectsResult.status === 'rejected') {
      setError(getErrorMessage(projectsResult.reason));
      return;
    }
    const projects = projectsResult.value ?? [];
    const agents = agentsResult.status === 'fulfilled' ? agentsResult.value ?? [] : [];
    const project = projects.find((item) => item.id === projectId) ?? null;
    if (!project && agentsResult.status === 'fulfilled' && agents.some((agent) => agent.id === projectId)) {
      navigate(`/agents/${projectId}`, { replace: true });
      return;
    }
    if (!project && agentsResult.status === 'rejected') {
      setError(getErrorMessage(agentsResult.reason));
      return;
    }
    const projectAgents = agents.filter((agent) => agent.projectId === projectId);
    const projectAgentIds = new Set(projectAgents.map((agent) => agent.id));
    setError(null);
    setData({
      project,
      agents: projectAgents,
      services: servicesResult.status === 'fulfilled' ? (servicesResult.value ?? []).filter((service) => projectAgentIds.has(service.agentId)) : [],
      monitors: monitorsResult.status === 'fulfilled' ? (monitorsResult.value ?? []).filter((monitor) => monitor.projectId === projectId) : [],
      observedServices: observedResult.status === 'fulfilled' ? (observedResult.value ?? []).filter((service) => service.projectId === projectId) : [],
      infrastructure: infrastructureResult.status === 'fulfilled' ? (infrastructureResult.value ?? []).filter((resource) => resource.projectId === projectId) : [],
    });
    const failed: string[] = [];
    if (agentsResult.status === 'rejected') failed.push('Docker 환경');
    if (servicesResult.status === 'rejected') failed.push('Docker 서비스');
    if (monitorsResult.status === 'rejected') failed.push('업타임 모니터');
    if (observedResult.status === 'rejected') failed.push('직접 연결 서비스');
    if (infrastructureResult.status === 'rejected') failed.push('인프라');
    setFailedSources(failed);
    } finally {
      setLoading(false);
    }
  }, [navigate, projectId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  useAutoRefresh(() => void load(true), 30_000);
  const { spinning, trigger: handleRefresh } = useSpinAction(() => void load(true));

  const totalTargets = data.agents.length + data.monitors.length + data.observedServices.length + data.infrastructure.length;

  if (loading) return <div className="h-64 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />;
  if (error) return <EmptyState icon="sync_problem" title="Project를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: () => void load() }} />;
  if (!data.project) return <EmptyState icon="folder_open" title="Project를 찾을 수 없습니다" action={{ label: 'Projects', to: '/projects' }} />;

  const project = data.project;
  const deleteProject = async () => {
    setDeletingProject(true);
    try { await api.deleteProject(project.id); navigate('/projects'); }
    catch (requestError) { toast.error(getErrorMessage(requestError)); }
    finally { setDeletingProject(false); }
  };

  const directPath = (service: ObservedService) => service.signals.includes('logs') ? `/logs/${service.id}` : service.signals.includes('metrics') ? `/metrics/${service.id}` : `/api/${service.id}`;

  const members: Member[] = [
    ...data.agents.map((agent): Member => ({ key: `agent-${agent.id}`, to: `/agents/${agent.id}`, icon: 'dns', name: agent.name, detail: isCollectorFresh(agent.lastSeenAt) ? 'Docker Collector 데이터 유입 중' : 'Docker Collector 데이터 지연', state: isCollectorFresh(agent.lastSeenAt) ? 'healthy' : 'warn' })),
    ...data.services.filter((service) => !service.healthy).map((service): Member => ({ key: `service-${service.agentId}-${service.key}`, to: `/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=uptime`, icon: 'error_outline', name: service.name, detail: 'Docker 서비스 장애', state: 'error' })),
    ...data.monitors.map((monitor): Member => ({ key: `monitor-${monitor.id}`, to: `/uptime/${monitor.id}`, icon: 'monitor_heart', name: monitor.name, detail: monitor.status === 'unhealthy' ? '업타임 장애' : monitor.status === 'healthy' ? '업타임 정상' : '상태 확인 중', state: monitor.status === 'unhealthy' ? 'error' : monitor.status === 'healthy' ? 'healthy' : 'idle' })),
    ...data.observedServices.map((service): Member => ({ key: `direct-${service.id}`, to: directPath(service), icon: 'hub', name: service.name, detail: service.isActive ? (service.lastSeenAt ? `마지막 수신 ${new Date(service.lastSeenAt).toLocaleString()}` : '직접 연결 데이터 대기 중') : '직접 연결이 비활성화됨', state: service.isActive ? (service.lastSeenAt ? 'healthy' : 'warn') : 'idle' })),
    ...data.infrastructure.map((resource): Member => ({ key: `infra-${resource.id}`, to: `/infrastructure/${resource.id}`, icon: 'memory', name: resource.name, detail: resource.isActive ? (isCollectorFresh(resource.lastSeenAt) ? '인프라 데이터 유입 중' : '인프라 데이터 확인 필요') : '인프라 Collector가 비활성화됨', state: resource.isActive ? (isCollectorFresh(resource.lastSeenAt) ? 'healthy' : 'warn') : 'idle' })),
  ].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);

  return (
    <div className="space-y-5">
      {/* 상세 헤더에는 채움 부제를 두지 않는다(§4.1) — 사용자가 적은 설명이 있을 때만 */}
      <PageHeader title={project.name} subtitle={project.description || undefined} />
      <DetailActionToolbar
        controls={
          <Button collapseLabel variant="secondary" onClick={handleRefresh}>
            <MaterialIcon name="refresh" className={spinning ? 'animate-spin' : ''} />새로고침
          </Button>
        }
        actions={
          <>
            <Button collapseLabel variant="secondary" onClick={() => setEditing(true)}><MaterialIcon name="edit" />수정</Button>
            <Button collapseLabel variant="destructive" onClick={() => setDeleting(true)}><MaterialIcon name="delete_outline" />삭제</Button>
          </>
        }
      />

      {failedSources.length > 0 && <section className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status"><div className="flex items-start gap-3"><MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" /><div><p className="type-label text-text-base">일부 모니터링 정보를 불러오지 못했습니다</p><p className="mt-0.5 type-body text-text-muted">{failedSources.join(', ')} 정보를 제외한 결과입니다.</p></div></div><Button variant="secondary" size="sm" onClick={() => void load()}>다시 시도</Button></section>}

      {totalTargets === 0 ? <section className="rounded-xl border border-ui-border bg-bg-surface"><EmptyState icon="folder_open" title="아직 배정된 대상이 없습니다" description="Project 관리 화면에서 환경과 모니터링 대상을 배정하세요." action={{ label: 'Project 관리', to: '/projects' }} /></section> : (
        <section className="rounded-xl border border-ui-border bg-bg-surface">
          <div className="border-b border-ui-border px-4 py-3.5"><h2 className="type-card-title text-text-base">대상</h2><p className="mt-0.5 type-body text-text-muted">장애를 먼저, 수집 지연을 그다음에 보여줍니다.</p></div>
          <div className="divide-y divide-ui-border-soft">
            {members.map(({ key, ...member }) => <MemberLink key={key} {...member} />)}
          </div>
        </section>
      )}

      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} onSave={async input => { await api.updateProject(project.id, input); await load(); }} />}
      <ConfirmDialog isOpen={deleting} onClose={() => setDeleting(false)} onConfirm={() => void deleteProject()} title="Project를 삭제할까요?" message="배정된 Docker 환경, 업타임 모니터, 직접 서비스와 Collector는 삭제되지 않고 미분류로 남습니다." confirmLabel="삭제" isProcessing={deletingProject} />
    </div>
  );
}
