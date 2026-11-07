import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, DetailActionToolbar, EmptyState, ListViewToggle, MaterialIcon, PageHeader, ResourceTable, StatusLight } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { api, type Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { ProjectDialog } from './ProjectsPage';
import { assignableTargets, projectMembers, setTargetGroup, sourcesForProject, type Member, type ProjectSources } from './projectMembers';
import { AddTargetsDialog } from './AddTargetsDialog';
import { openFromGroup } from '../../hooks/useGroupTrail';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';

// all·projects는 대상 추가 대화상자가 다른 그룹의 대상과 그룹 이름을 보여 줄 때 쓴다.
type ProjectData = ProjectSources & { project: Project | null; projects: Project[]; all: ProjectSources };

const EMPTY_SOURCES: ProjectSources = { agents: [], services: [], monitors: [], observedServices: [], infrastructure: [] };

function MemberLink({ to, icon, type, name, detail, state, returnTo, onOpen }: Omit<Member, 'key' | 'assignment'> & { returnTo: string; onOpen: () => void }) {
  const stateClass = { healthy: 'text-status-healthy', warn: 'text-status-warn', error: 'text-status-error', idle: 'text-status-idle' }[state];
  return (
    <Link to={to} state={{ returnTo }} onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-ui-hover-soft">
      <MaterialIcon size={20} name={icon} className={`shrink-0 ${stateClass}`} />
      <span className="min-w-0 flex-1"><span className="block truncate type-label text-text-base">{name}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{type} · {detail}</span></span>
      <MaterialIcon size={20} name="chevron_right" className="shrink-0 text-text-dim" />
    </Link>
  );
}

export function ProjectOverviewPage() {
  const { view, setView, returnTo } = useListView();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectData>({ project: null, projects: [], all: EMPTY_SOURCES, ...EMPTY_SOURCES });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [adding, setAdding] = useState(false);
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
    setError(null);
    const all: ProjectSources = {
      agents,
      services: servicesResult.status === 'fulfilled' ? servicesResult.value ?? [] : [],
      monitors: monitorsResult.status === 'fulfilled' ? monitorsResult.value ?? [] : [],
      observedServices: observedResult.status === 'fulfilled' ? observedResult.value ?? [] : [],
      infrastructure: infrastructureResult.status === 'fulfilled' ? infrastructureResult.value ?? [] : [],
    };
    setData({ project, projects, all, ...sourcesForProject(projectId, all) });
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
  if (error) return <EmptyState icon="sync_problem" title="그룹을 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: () => void load() }} />;
  if (!data.project) return <EmptyState icon="folder_open" title="그룹을 찾을 수 없습니다" action={{ label: '그룹', to: '/projects' }} />;

  const project = data.project;
  const deleteProject = async () => {
    setDeletingProject(true);
    try { await api.deleteProject(project.id); navigate('/projects'); }
    catch (requestError) { toast.error(getErrorMessage(requestError)); }
    finally { setDeletingProject(false); }
  };

  const members = projectMembers(data);
  // 대상 화면을 그룹 안에서 연 것으로 보이게 한다(useGroupTrail). 행 클릭도 이 링크를 누른다.
  const openMember = (to: string) => openFromGroup({ id: project.id, name: project.name, path: to.split('?')[0] });
  const removeMember = async (member: Member) => {
    if (!member.assignment) return;
    try {
      await setTargetGroup(member.assignment);
      toast.success(`그룹에서 뺐습니다: ${member.name}`);
      await load(true);
    } catch (requestError) { toast.error(getErrorMessage(requestError)); }
  };
  // Docker 서비스와 Docker 호스트의 인프라는 Docker 환경을 따르므로 따로 뺄 수 없다.
  // ✕ 아이콘은 대상 삭제로 읽혀서 "빼기"라고 쓴다. 대상은 지워지지 않고 미분류로 돌아간다.
  const removeButton = (member: Member) => member.assignment
    ? <Button variant="quiet" aria-label={`${member.name} 그룹에서 빼기`} onClick={() => void removeMember(member)}>빼기</Button>
    : null;

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
            <Button collapseLabel onClick={() => setAdding(true)}><MaterialIcon name="add" />대상 추가</Button>
            <Button collapseLabel variant="secondary" onClick={() => setEditing(true)}><MaterialIcon name="edit" />수정</Button>
            <Button collapseLabel variant="destructive" onClick={() => setDeleting(true)}><MaterialIcon name="delete_outline" />삭제</Button>
          </>
        }
      />

      {failedSources.length > 0 && <section className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status"><div className="flex items-start gap-3"><MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" /><div><p className="type-label text-text-base">일부 모니터링 정보를 불러오지 못했습니다</p><p className="mt-0.5 type-body text-text-muted">{failedSources.join(', ')} 정보를 제외한 결과입니다.</p></div></div><Button variant="secondary" size="sm" onClick={() => void load()}>다시 시도</Button></section>}

      {totalTargets === 0 ? <section className="rounded-xl border border-ui-border bg-bg-surface"><EmptyState icon="folder_open" title="아직 배정된 대상이 없습니다" description="Docker 환경, 업타임 모니터, 직접 연결 서비스, Collector를 이 그룹에 모아 보세요." action={{ label: '대상 추가', onClick: () => setAdding(true) }} /></section> : (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3"><div><h2 className="type-card-title text-text-base">대상</h2><p className="mt-0.5 type-body text-text-muted">장애를 먼저, 수집 지연을 그다음에 보여줍니다.</p></div><ListViewToggle view={view} onChange={setView} /></div>
          {view === 'card' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{members.map(({ key, assignment, ...member }) => <div key={key} className="flex items-center overflow-hidden rounded-xl border border-ui-border bg-bg-surface"><MemberLink {...member} returnTo={returnTo} onOpen={() => openMember(member.to)} />{assignment && <div className="pr-2">{removeButton({ key, assignment, ...member })}</div>}</div>)}</div> :
            <ResourceTable rows={members} rowKey={row => row.key} ariaLabel="그룹 구성 그리드" columns={[
              // 종류 아이콘은 분류라 중립색이다(§5.3). 상태는 현황 열의 StatusLight가 말한다(§5.1).
              { key: 'name', label: '대상', render: row => <div className="flex min-w-0 items-start gap-3"><MaterialIcon size={20} name={row.icon} className="mt-0.5 shrink-0 text-text-muted" /><div className="min-w-0"><Link to={row.to} state={{ returnTo }} onClick={() => openMember(row.to)} data-row-link className="block truncate font-medium text-action">{row.name}</Link><p className="mt-1 type-caption text-text-muted">{row.type}</p><div className="mt-2 md:hidden"><StatusLight tone={row.state} label={row.detail} /></div></div></div> },
              { key: 'detail', label: '현황', className: 'hidden md:table-cell', render: row => <StatusLight tone={row.state} label={row.detail} /> },
              { key: 'actions', label: '작업', className: 'w-28 whitespace-nowrap', align: 'right', render: removeButton },
            ]} />}
        </section>
      )}

      {adding && <AddTargetsDialog project={project} projects={data.projects} targets={assignableTargets(data.all)} onClose={() => setAdding(false)} onAdded={() => load(true)} />}
      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} onSave={async input => { await api.updateProject(project.id, input); await load(); }} />}
      <ConfirmDialog isOpen={deleting} onClose={() => setDeleting(false)} onConfirm={() => void deleteProject()} title="그룹을 삭제할까요?" message="배정된 Docker 환경, 업타임 모니터, 직접 서비스와 Collector는 삭제되지 않고 미분류로 남습니다." confirmLabel="삭제" isProcessing={deletingProject} />
    </div>
  );
}
