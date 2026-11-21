import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, EmptyState, IconButton, Input, ListViewToggle, LoadErrorBanner, MaterialIcon, PageHeader, ResourceCardHeader, ResourceTable, StatusLight } from '../../components/common';
import { partialFailureMessage, useServers } from '../../features/servers/useServers';
import { useListView } from '../../hooks/useListView';
import { SCRIM_MODAL_DIALOG } from '../../hooks/useOverlay';
import { api, type Project, type ProjectInput } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { Field } from '../../features/alerts/components/FormLayout';
import { assignableTargets, projectMembers, sourcesForProject, summarizeMembers, type ProjectSources } from './projectMembers';

export function ProjectDialog({ project, onClose, onSave }: {
  project: Project | null;
  onClose: () => void;
  onSave: (input: ProjectInput) => Promise<void>;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // 브라우저 기본 검증(말풍선) 대신 입력 아래에 오류를 둔다(폼은 noValidate, UI/UX 점검 A5).
    if (!name.trim()) { setNameError('그룹 이름을 입력하세요'); nameRef.current?.focus(); return; }
    setSaving(true);
    try { await onSave({ name, description }); onClose(); }
    catch (error) { toast.error(getErrorMessage(error)); }
    finally { setSaving(false); }
  };

  return (
    // Backdrop click is supplemental; Escape and the labelled cancel button are keyboard equivalents.
    // react-doctor-disable-next-line no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-labelledby="project-dialog-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}
      className={`m-auto w-full max-w-md overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-lg ${SCRIM_MODAL_DIALOG}`}
    >
      <form onSubmit={submit} noValidate>
        <div className="border-b border-ui-border px-6 py-4"><h2 id="project-dialog-title" className="type-card-title text-text-base">{project ? '그룹 수정' : '그룹 추가'}</h2></div>
        <div className="space-y-heading p-6">
          <Field label="이름" htmlFor="project-name" required error={nameError ?? undefined}><Input id="project-name" ref={nameRef} invalid={Boolean(nameError)} value={name} onChange={event => { setName(event.target.value); setNameError(null); }} placeholder="예: Production" /></Field>
          <Field label="설명" htmlFor="project-description"><Input id="project-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="선택 사항" /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>취소</Button><Button type="submit" loading={saving}>{project ? '저장' : '추가'}</Button></div>
      </form>
    </dialog>
  );
}

// 대상 추가·빼기는 그룹 상세 한곳에서 한다. 목록은 상태를 훑고 그룹으로 들어가는 자리다.
function ProjectCard({ project, returnTo, status, counts, onEdit, onDelete }: {
  project: Project;
  returnTo: string;
  status: ReactNode;
  counts: [string, number | string][];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-ui-border-soft bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h2 className="truncate type-card-title text-text-base"><Link to={`/projects/${project.id}`} state={{ returnTo }} className="hover:text-action">{project.name}</Link></h2>}
        badge={status}
        status={<div className="flex gap-1"><IconButton icon="edit" label="그룹 수정" size="sm" onClick={onEdit} /><IconButton icon="delete_outline" label="그룹 삭제" size="sm" tone="danger" onClick={onDelete} /></div>}
      />
      <p className="mt-3 type-body text-text-muted">{project.description || '설명이 없습니다'}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {counts.map(([label, count]) => <div key={label} className="rounded-md bg-ui-hover-soft p-3"><p className="type-caption text-text-dim">{label}</p><p className="mt-1 type-stat text-text-base">{count}</p></div>)}
      </div>
    </article>
  );
}

type DockerSources = { agents: ProjectSources['agents']; services: ProjectSources['services'] | null };
const COUNTS = [['agent', 'Docker 환경'], ['server', '서버']] as const;

export function ProjectsPage() {
  const { view, setView, returnTo } = useListView();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  // 상태 요약은 그룹 상세와 같은 입력으로 계산한다. Docker 서비스를 불러오지 못하면 services가 null이다.
  // 장애를 모른 채 "정상"이라고 말하지 않는다. 서버는 서버 목록과 같은 훅에서 온다.
  const [docker, setDocker] = useState<DockerSources>({ agents: [], services: [] });
  // 오류 로그 수를 보여 주지 않으므로 로그 요약은 불러오지 않는다.
  const servers = useServers({ logSummary: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [projectRows, agentRows, serviceRows] = await Promise.all([api.getProjects(), api.getAgents(), api.getAllAgentServicesFlat().catch(() => null)]);
      setProjects(projectRows ?? []);
      setDocker({ agents: agentRows ?? [], services: serviceRows });
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // 새 그룹은 비어 있으니 바로 상세로 가서 대상을 추가하게 한다.
  const saveProject = async (input: ProjectInput) => {
    if (editing) { await api.updateProject(editing.id, input); await load(); return; }
    const created = await api.createProject(input);
    navigate(`/projects/${created.id}`, { state: { returnTo } });
  };
  const deleteProject = async () => {
    if (!deleting) return;
    setDeletingProject(true);
    try { await api.deleteProject(deleting.id); setDeleting(null); await load(); }
    catch (requestError) { toast.error(getErrorMessage(requestError)); }
    finally { setDeletingProject(false); }
  };

  // 서버 목록을 불러오지 못했으면 그룹의 서버를 모른다. 0개나 "정상"이라고 말하지 않는다.
  const serversUnknown = !servers.loaded;
  const countsOf = (project: Project): [string, number | string][] => {
    const own = assignableTargets(sourcesForProject(project.id, { ...docker, services: [], servers: servers.rows }));
    return COUNTS.map(([kind, label]) => [label, kind === 'server' && serversUnknown ? '-' : own.filter(target => target.kind === kind).length]);
  };
  const renderStatus = (project: Project) => {
    if (!docker.services || serversUnknown) return <StatusLight tone="idle" label="상태 확인 불가" />;
    const { tone, label } = summarizeMembers(projectMembers(sourcesForProject(project.id, { ...docker, services: docker.services, servers: servers.rows })));
    return <StatusLight tone={tone} label={label} />;
  };
  const serverFailures = [...(servers.error ? [{ label: '서버', stale: servers.loaded }] : []), ...servers.failed];

  // 머리말 → 목록은 PageHeader의 아래 여백(24px), 알림 배너 → 목록은 16px이다.
  return <div className="space-y-heading">
    <PageHeader menu title="그룹">
      {projects.length > 0 && <ListViewToggle view={view} onChange={setView} />}
      <Button onClick={() => setEditing(null)}><MaterialIcon name="add" />추가</Button>
    </PageHeader>
    {projects.length > 0 && <h2 className="sr-only">그룹 목록</h2>}
    {!loading && !error && projects.length > 0 && serverFailures.length > 0 && <LoadErrorBanner role="status" title="일부 정보를 불러오지 못했습니다" message={partialFailureMessage(serverFailures)} onRetry={() => void servers.reload()} retrying={servers.loading} />}
    {loading || (!servers.loaded && !servers.error) ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[0, 1].map(item => <div key={item} className="h-72 animate-pulse rounded-xl bg-ui-hover-soft" />)}</div> : error ? <EmptyState icon="error_outline" title="그룹을 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: () => void load() }} /> : projects.length === 0 ? <EmptyState icon="folder_open" title="아직 그룹이 없습니다" description="필요할 때 모니터링 대상을 묶어 보세요." action={{ label: '추가', onClick: () => setEditing(null) }} /> : view === 'grid' ? <ResourceTable rows={projects} rowKey={project => project.id} ariaLabel="그룹 그리드"
      columns={[
        { key: 'name', label: '그룹', render: project => <><Link to={`/projects/${project.id}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{project.name}</Link><p className="mt-1 line-clamp-2 break-words type-caption text-text-muted">{project.description || '설명 없음'}</p><div className="mt-2 md:hidden">{renderStatus(project)}</div><p className="mt-2 type-caption text-text-muted md:hidden">{countsOf(project).map(([label, count]) => `${label} ${count}`).join(', ')}</p></> },
        { key: 'status', label: '상태', className: 'hidden md:table-cell', render: renderStatus },
        ...COUNTS.map(([kind, label], index) => ({ key: kind, label, className: 'hidden w-28 md:table-cell', align: 'right' as const, render: (project: Project) => countsOf(project)[index][1] })),
      ]} /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{projects.map(project => <ProjectCard key={project.id} project={project} returnTo={returnTo} status={renderStatus(project)} counts={countsOf(project)} onEdit={() => setEditing(project)} onDelete={() => setDeleting(project)} />)}</div>}
    {editing !== undefined && <ProjectDialog project={editing} onClose={() => setEditing(undefined)} onSave={saveProject} />}
    <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void deleteProject()} title="그룹을 삭제할까요?" message="배정된 서버와 Docker 환경은 삭제되지 않고 미분류로 남습니다." confirmLabel="삭제" isProcessing={deletingProject} />
  </div>;
}
