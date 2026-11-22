import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { serverPath } from '../../features/servers/serverPaths';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, DetailMeta, EmptyState, ListViewToggle, MaterialIcon, OverflowMenu, PageHeader, RefreshStatus, ResourceTable, Section, StatusLight } from '../../components/common';
import { partialFailureMessage, useServers, type FailedTargets } from '../../features/servers/useServers';
import { useListView } from '../../hooks/useListView';
import { api, type Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { ProjectDialog } from './ProjectsPage';
import { assignableTargets, groupChangeFailure, projectMembers, serversOfProject, setTargetGroup, type Member } from './projectMembers';
import { AddTargetsDialog } from './AddTargetsDialog';
import { openFromGroup } from '../../hooks/useGroupTrail';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';

// projects는 대상 추가 대화상자가 다른 그룹의 이름을 보여 줄 때 쓴다. 서버는 서버 목록과 같은 훅(useServers)에서 온다.
type ProjectData = { project: Project | null; projects: Project[] };

// 카드 보기의 대상 링크. 카드의 모서리를 따라 둥글게 둔다(카드에 overflow-hidden을 걸면 포커스 링의 좌우가 잘린다).
function MemberLink({ to, icon, type, name, detail, cause, state, returnTo, onOpen }: Omit<Member, 'key' | 'assignment'> & { returnTo: string; onOpen: () => void }) {
  return (
    <Link to={to} state={{ returnTo }} onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-ui-hover-soft">
      {/* 종류 아이콘은 분류라 표 보기처럼 중립색이다(§5.3). 상태는 표 보기와 같은 StatusLight가 말한다. */}
      <MaterialIcon size={20} name={icon} className="shrink-0 text-text-muted" />
      <span className="min-w-0 flex-1"><span className="block truncate type-label text-text-base">{name}</span><span className="mt-intra block truncate type-caption text-text-muted">{type}</span><span className="mt-1 block"><StatusLight tone={state} label={detail} /></span>{cause && <span className="mt-intra block truncate type-caption text-text-muted">{cause}</span>}</span>
      <MaterialIcon size={20} name="chevron_right" className="shrink-0 text-text-dim" />
    </Link>
  );
}

// 서버 목록의 상태 칸과 같은 모양: 상태와 그 아래 줄의 원인.
function MemberStatus({ member }: { member: Member }) {
  return <><StatusLight tone={member.state} label={member.detail} />{member.cause && <p className="mt-1 line-clamp-2 break-words type-caption text-text-muted">{member.cause}</p>}</>;
}

export function ProjectOverviewPage() {
  const { view, setView, returnTo } = useListView();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectData>({ project: null, projects: [] });
  // 오류 로그 수를 보여 주지 않으므로 로그 요약은 불러오지 않는다. Docker 호스트도 서버다(ADR 0012).
  const servers = useServers({ logSummary: false, includeDocker: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [adding, setAdding] = useState(false);
  // 빼는 중인 구성원(key). 연속으로 눌러 같은 요청이 두 번 나가지 않게 그 행의 버튼을 막는다.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  useBreadcrumb(data.project ? [{ label: data.project.name }] : []);

  // background: 자동 갱신·새로고침은 화면을 유지한 채 다시 불러온다 — 매번 스켈레톤으로 바꾸면 30초마다 페이지 전체가 깜빡인다.
  const load = useCallback(async (background = false) => {
    if (!projectId) return;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const projects = await api.getProjects() ?? [];
      setError(null);
      setData({ project: projects.find((item) => item.id === projectId) ?? null, projects });
      setUpdatedAt(new Date());
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  const { poll, refresh: refreshServers, reload: reloadServers } = servers;
  useAutoRefresh(() => { void load(true); poll(); }, 30_000, autoRefresh);
  const { spinning, trigger: handleRefresh } = useSpinAction(() => { void load(true); void refreshServers(); });
  // 대상을 넣고 뺀 뒤: 둘 다 다시 불러온 결과가 반영된 뒤에 끝난다.
  const reloadAll = () => Promise.all([load(true), reloadServers()]).then(() => undefined);

  const own = projectId ? serversOfProject(projectId, servers.rows) : [];
  const totalTargets = own.length;
  // 서버 목록을 처음부터 못 불러왔으면 빈 그룹이라고 단정하지 않는다(위의 안내만 보인다).
  const membersUnknown = !servers.loaded;
  const failures: FailedTargets[] = [
    ...(servers.error ? [{ label: '서버', stale: servers.loaded }] : []),
    ...servers.failed,
  ];
  // 옛 Docker 환경 상세 주소(`/projects/:agentId`)는 같은 ID의 서버다(ADR 0012).
  const legacyServer = !data.project && servers.rows.some((row) => row.server.id === projectId);
  useEffect(() => {
    if (legacyServer && projectId) navigate(serverPath(projectId), { replace: true });
  }, [legacyServer, projectId, navigate]);

  if (loading || (!servers.loaded && !servers.error)) return <div className="h-64 animate-pulse rounded-xl bg-ui-hover-soft" />;
  if (error) return <EmptyState icon="sync_problem" title="그룹을 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: () => void load() }} />;
  if (!data.project) return <EmptyState icon="folder_open" title="그룹을 찾을 수 없습니다" action={{ label: '그룹', to: '/projects' }} />;

  const project = data.project;
  const deleteProject = async () => {
    setDeletingProject(true);
    try { await api.deleteProject(project.id); navigate('/projects'); }
    catch (requestError) { toast.error(getErrorMessage(requestError)); }
    finally { setDeletingProject(false); }
  };

  const members = projectMembers(own);
  // 대상 화면을 그룹 안에서 연 것으로 보이게 한다(useGroupTrail). 행 클릭도 이 링크를 누른다.
  const openMember = (to: string) => openFromGroup({ id: project.id, name: project.name, path: to.split('?')[0] });
  const removeMember = async (member: Member) => {
    if (!member.assignment || removing.has(member.key)) return;
    setRemoving((current) => new Set(current).add(member.key));
    try {
      await setTargetGroup(member.assignment);
      toast.success(`그룹에서 뺐습니다: ${member.name}`);
      await reloadAll();
    } catch (requestError) { toast.error(`${member.name}: ${groupChangeFailure(requestError)}`); }
    finally {
      setRemoving((current) => { const next = new Set(current); next.delete(member.key); return next; });
    }
  };
  // ✕ 아이콘은 대상 삭제로 읽혀서 "빼기"라고 쓴다. 대상은 지워지지 않고 미분류로 돌아간다.
  const removeButton = (member: Member) => member.assignment
    ? <Button variant="quiet" aria-label={`${member.name} 그룹에서 빼기`} loading={removing.has(member.key)} onClick={() => void removeMember(member)}>빼기</Button>
    : null;

  return (
    <div className="page-stack">
      {/* 상세 헤더에는 채움 부제를 두지 않는다(§4.1) — 사용자가 적은 설명이 있을 때만 */}
      <PageHeader
        title={project.name}
        subtitle={project.description || undefined}
        // 상태 줄: 대상 수와, 오른쪽 끝의 갱신 상태(DESIGN.md §4.1 상세 헤더).
        meta={<DetailMeta status={<>
          <span>대상 {totalTargets}개</span>
          <div className="ml-auto">
            <RefreshStatus updatedAt={updatedAt} onRefresh={handleRefresh} refreshing={spinning} autoRefresh={autoRefresh} onAutoRefreshChange={setAutoRefresh} />
          </div>
        </>} />}
        // 주 조작 하나(대상 추가)와 더보기(수정, 삭제)다.
        actions={
          <>
            <Button collapseLabel variant="secondary" onClick={() => setAdding(true)}><MaterialIcon name="add" />대상 추가</Button>
            <OverflowMenu items={[
              { label: '수정', icon: 'edit', onSelect: () => setEditing(true) },
              { label: '삭제', icon: 'delete_outline', danger: true, onSelect: () => setDeleting(true) },
            ]} />
          </>
        }
      />

      {failures.length > 0 && <section className="flex flex-col gap-lead rounded-xl border border-ui-border-soft bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status"><div className="flex items-start gap-3"><MaterialIcon size={20} name="sync_problem" className="icon-lead text-status-warn" /><div><p className="type-label text-text-base">일부 모니터링 정보를 불러오지 못했습니다</p><p className="mt-intra type-body text-text-muted">{partialFailureMessage(failures)}</p></div></div><Button variant="secondary" size="sm" onClick={() => void reloadAll()}>다시 시도</Button></section>}

      {totalTargets === 0 ? membersUnknown ? null : <section><EmptyState icon="folder_open" title="아직 배정된 대상이 없습니다" description="서버를 이 그룹에 모아 보세요." action={{ label: '대상 추가', onClick: () => setAdding(true) }} /></section> : (
        <Section title="대상" description="장애를 먼저, 수집 지연을 그다음에 보여줍니다." actions={<ListViewToggle view={view} onChange={setView} />}>
          {view === 'card' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{members.map(({ key, assignment, ...member }) => <div key={key} className="flex items-center rounded-xl border border-ui-border-soft bg-bg-surface"><MemberLink {...member} returnTo={returnTo} onOpen={() => openMember(member.to)} />{assignment && <div className="pr-2">{removeButton({ key, assignment, ...member })}</div>}</div>)}</div> :
            <ResourceTable rows={members} rowKey={row => row.key} ariaLabel="그룹 구성 그리드" columns={[
              // 종류 아이콘은 분류라 중립색이다(§5.3). 상태는 현황 열의 StatusLight가 말한다(§5.1).
              { key: 'name', label: '대상', render: row => <div className="flex min-w-0 items-start gap-3"><MaterialIcon size={20} name={row.icon} className="icon-lead shrink-0 text-text-muted" /><div className="min-w-0"><Link to={row.to} state={{ returnTo }} onClick={() => openMember(row.to)} data-row-link className="block truncate font-medium text-action">{row.name}</Link><p className="mt-1 type-caption text-text-muted">{row.type}</p><div className="mt-2 md:hidden"><MemberStatus member={row} /></div></div></div> },
              { key: 'detail', label: '현황', className: 'hidden md:table-cell', render: row => <MemberStatus member={row} /> },
              { key: 'actions', label: '작업', className: 'w-28 whitespace-nowrap', align: 'right', render: removeButton },
            ]} />}
        </Section>
      )}

      {adding && <AddTargetsDialog project={project} projects={data.projects} targets={assignableTargets(servers.rows)} loadFailed={membersUnknown} onRetry={reloadAll} onClose={() => setAdding(false)} onAdded={reloadAll} />}
      {editing && <ProjectDialog project={project} onClose={() => setEditing(false)} onSave={async input => { await api.updateProject(project.id, input); await load(); }} />}
      <ConfirmDialog isOpen={deleting} onClose={() => setDeleting(false)} onConfirm={() => void deleteProject()} title="그룹을 삭제할까요?" message="배정된 서버는 삭제되지 않고 미분류로 남습니다." confirmLabel="삭제" isProcessing={deletingProject} />
    </div>
  );
}
