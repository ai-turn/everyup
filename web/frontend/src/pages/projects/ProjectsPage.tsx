import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, EmptyState, IconButton, Input, ListViewToggle, MaterialIcon, PageHeader, ResourceCardHeader, ResourceTable, StatusLight } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { SCRIM_MODAL_DIALOG } from '../../hooks/useOverlay';
import { api, type Project, type ProjectInput } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { assignableTargets, projectMembers, sourcesForProject, summarizeMembers, type ProjectSources } from './projectMembers';

export function ProjectDialog({ project, onClose, onSave }: {
  project: Project | null;
  onClose: () => void;
  onSave: (input: ProjectInput) => Promise<void>;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      <form onSubmit={submit}>
        <div className="border-b border-ui-border px-6 py-4"><h2 id="project-dialog-title" className="type-card-title text-text-base">{project ? '그룹 수정' : '그룹 추가'}</h2></div>
        <div className="space-y-4 p-6">
          <label className="block space-y-1.5" htmlFor="project-name"><span className="type-label text-text-secondary">이름</span><Input id="project-name" required value={name} onChange={event => setName(event.target.value)} placeholder="예: Production" /></label>
          <label className="block space-y-1.5" htmlFor="project-description"><span className="type-label text-text-secondary">설명</span><Input id="project-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="선택 사항" /></label>
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
  counts: [string, number][];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h2 className="truncate type-card-title text-text-base"><Link to={`/projects/${project.id}`} state={{ returnTo }} className="hover:text-action">{project.name}</Link></h2>}
        badge={status}
        status={<div className="flex gap-1"><IconButton icon="edit" label="그룹 수정" size="sm" onClick={onEdit} /><IconButton icon="delete_outline" label="그룹 삭제" size="sm" tone="danger" onClick={onDelete} /></div>}
      />
      <p className="mt-3 type-body text-text-muted">{project.description || '설명이 없습니다'}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counts.map(([label, count]) => <div key={label} className="rounded-md border border-ui-border bg-ui-hover-soft p-3"><p className="text-xs text-text-dim">{label}</p><p className="mt-1 type-stat text-text-base">{count}</p></div>)}
      </div>
    </article>
  );
}

type ListSources = Omit<ProjectSources, 'services'> & { services: ProjectSources['services'] | null };
const COUNTS = [['agent', 'Docker 환경'], ['monitor', '업타임'], ['direct', '직접 서비스'], ['infra', 'Collector']] as const;

export function ProjectsPage() {
  const { view, setView, returnTo } = useListView();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  // 상태 요약은 그룹 상세와 같은 입력으로 계산한다. Docker 서비스를 불러오지 못하면 services가 null이다.
  // 장애를 모른 채 "정상"이라고 말하지 않는다.
  const [sources, setSources] = useState<ListSources>({ agents: [], services: [], monitors: [], observedServices: [], infrastructure: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [projectRows, agentRows, monitorRows, directRows, infrastructureRows, serviceRows] = await Promise.all([api.getProjects(), api.getAgents(), api.getUptimeMonitors(), api.getObservedServices(), api.getInfrastructureResources(), api.getAllAgentServicesFlat().catch(() => null)]);
      setProjects(projectRows ?? []);
      setSources({ agents: agentRows ?? [], services: serviceRows, monitors: monitorRows ?? [], observedServices: directRows ?? [], infrastructure: infrastructureRows ?? [] });
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

  // Collector는 직접 등록한 인프라만 센다. Docker 호스트의 인프라는 Docker 환경 숫자에 이미 들어 있다.
  const countsOf = (project: Project): [string, number][] => {
    const own = assignableTargets(sourcesForProject(project.id, { ...sources, services: [] }));
    return COUNTS.map(([kind, label]) => [label, own.filter(target => target.kind === kind).length]);
  };
  const renderStatus = (project: Project) => {
    if (!sources.services) return <StatusLight tone="idle" label="상태 확인 불가" />;
    const { tone, label } = summarizeMembers(projectMembers(sourcesForProject(project.id, { ...sources, services: sources.services })));
    return <StatusLight tone={tone} label={label} />;
  };

  return <div>
    <PageHeader title="그룹" subtitle="같이 운영하는 Docker 환경, 업타임 모니터, 애플리케이션과 서버를 한곳에 묶어 상태를 확인합니다."><Button onClick={() => setEditing(null)}><MaterialIcon name="add" />추가</Button></PageHeader>
    {projects.length > 0 && <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="type-section-title text-text-base">그룹 목록</h2>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-dim">{`${projects.length}개`}</span>
        <ListViewToggle view={view} onChange={setView} />
      </div>
    </div>}
    {loading ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[0, 1].map(item => <div key={item} className="h-72 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div> : error ? <EmptyState icon="error_outline" title="그룹을 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: () => void load() }} /> : projects.length === 0 ? <EmptyState icon="folder_open" title="아직 그룹이 없습니다" description="필요할 때 모니터링 대상을 묶어 보세요." action={{ label: '추가', onClick: () => setEditing(null) }} /> : view === 'grid' ? <ResourceTable rows={projects} rowKey={project => project.id} ariaLabel="그룹 그리드"
      columns={[
        { key: 'name', label: '그룹', render: project => <><Link to={`/projects/${project.id}`} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{project.name}</Link><p className="mt-1 line-clamp-2 break-words type-caption text-text-muted">{project.description || '설명 없음'}</p><div className="mt-2 md:hidden">{renderStatus(project)}</div><p className="mt-2 type-caption text-text-muted md:hidden">{countsOf(project).map(([label, count]) => `${label} ${count}`).join(', ')}</p></> },
        { key: 'status', label: '상태', className: 'hidden md:table-cell', render: renderStatus },
        ...COUNTS.map(([kind, label], index) => ({ key: kind, label, className: 'hidden w-28 md:table-cell', align: 'right' as const, render: (project: Project) => countsOf(project)[index][1] })),
      ]} /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{projects.map(project => <ProjectCard key={project.id} project={project} returnTo={returnTo} status={renderStatus(project)} counts={countsOf(project)} onEdit={() => setEditing(project)} onDelete={() => setDeleting(project)} />)}</div>}
    {editing !== undefined && <ProjectDialog project={editing} onClose={() => setEditing(undefined)} onSave={saveProject} />}
    <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void deleteProject()} title="그룹을 삭제할까요?" message="배정된 Docker 환경, 업타임 모니터, 직접 서비스와 Collector는 삭제되지 않고 미분류로 남습니다." confirmLabel="삭제" isProcessing={deletingProject} />
  </div>;
}
