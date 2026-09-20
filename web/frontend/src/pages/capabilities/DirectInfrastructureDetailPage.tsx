import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  DetailActionToolbar,
  EmptyState,
  MaterialIcon,
  PageHeader,
  Select,
  TimeRangePicker,
  type GlobalTimeRange,
} from '../../components/common';
import { InfraGauges } from '../../features/infra/components/InfraGauges';
import { InfraTrends } from '../../features/infra/components/InfraTrends';
import { InfrastructureCollectorKeyDialog } from '../../features/infrastructure/components/InfrastructureCollectorKeyDialog';
import { api, type InfrastructureResource, type InfrastructureResourceSetup, type Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

export function DirectInfrastructureDetailPage() {

  const { resourceId = '' } = useParams();
  const navigate = useNavigate();
  const [resource, setResource] = useState<InfrastructureResource | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [range, setRange] = useState<GlobalTimeRange>('6h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useBreadcrumb(resource ? [{ label: resource.name }] : []);
  const [savingProject, setSavingProject] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);
  const [rotatedSetup, setRotatedSetup] = useState<InfrastructureResourceSetup | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resourceRow, projectRows] = await Promise.all([
        api.getInfrastructureResource(resourceId),
        api.getProjects(),
      ]);
      setResource(resourceRow);
      setProjectId(resourceRow.projectId ?? '');
      setProjects(projectRows ?? []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => { void load(); }, [load]);

  const saveProject = async () => {
    if (!resource) return;
    setSavingProject(true);
    try {
      const updated = await api.updateInfrastructureResource(resource.id, { name: resource.name, projectId: projectId || undefined });
      setResource(updated);
      toast.success('Project 배정을 저장했습니다.');
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setSavingProject(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!resource || !confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction === 'rotate') {
        const setup = await api.rotateInfrastructureResourceKey(resource.id);
        setResource(setup);
        setRotatedSetup(setup);
      } else if (confirmAction === 'revoke') {
        setResource(await api.revokeInfrastructureResourceKey(resource.id));
        toast.success('Collector 연결을 중지했습니다.');
      } else {
        await api.deleteInfrastructureResource(resource.id);
        toast.success('인프라 리소스를 삭제했습니다.');
        navigate('/infrastructure', { replace: true });
      }
      setConfirmAction(null);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-96 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />;
  if (error || !resource) {
    return <EmptyState icon="error_outline" title="인프라 리소스를 불러오지 못했습니다" description={error ?? undefined} action={{ label: '인프라로 돌아가기', onClick: () => navigate('/infrastructure') }} />;
  }

  const confirmCopy = {
    rotate: { title: 'Collector 키를 재발급할까요?', message: '현재 키는 즉시 폐기됩니다. 실행 중인 OpenTelemetry Collector 설정에 새 키를 반영해야 합니다.', label: '재발급', variant: 'primary' as const },
    revoke: { title: 'Collector 연결을 중지할까요?', message: '새 hostmetrics 수집이 즉시 차단됩니다. 저장된 이력은 유지됩니다.', label: '연결 중지', variant: 'danger' as const },
    delete: { title: '인프라 리소스를 삭제할까요?', message: '저장된 호스트 메트릭 이력과 대상별 리소스 알림 규칙을 함께 삭제합니다.', label: '삭제', variant: 'danger' as const },
  };
  const selectedConfirm = confirmAction ? confirmCopy[confirmAction] : null;

  return (
    <div>
      <PageHeader title={resource.name} subtitle="표준 OpenTelemetry Collector hostmetrics 리소스입니다." />
      <DetailActionToolbar
        controls={
          <>
          <TimeRangePicker value={range} onChange={setRange} />
          <Button variant="secondary" onClick={() => setRefreshKey(value => value + 1)}><MaterialIcon name="refresh" />새로고침</Button>
          </>
        }
        actions={
          <>
          <Button variant="secondary" onClick={() => navigate('/alerts')}><MaterialIcon name="notifications" />알림 규칙</Button>
          {resource.isActive && <Button variant="ghost" onClick={() => setConfirmAction('revoke')}><MaterialIcon name="block" />연결 중지</Button>}
          <Button variant="ghost" className="text-status-error hover:text-status-error" onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete" />삭제</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-ui-border bg-bg-surface p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="type-card-title text-text-base">Collector 연결</h2>
            <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs ${resource.isActive ? 'bg-status-healthy/10 text-status-healthy' : 'bg-status-error/10 text-status-error'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${resource.isActive ? 'bg-status-healthy' : 'bg-status-error'}`} aria-hidden="true" />
              {resource.isActive ? '수집 가능' : '중지됨'}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-ui-hover-soft p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-dim">수집 키</p>
              <p className="mt-1 truncate font-mono text-sm text-text-secondary">{resource.apiKeyMasked || '마스킹된 키 없음'}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction('rotate')}><MaterialIcon name="key" />키 재발급</Button>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-ui-hover-soft p-3"><dt className="text-xs text-text-dim">마지막 수집</dt><dd className="mt-1 text-sm text-text-secondary">{resource.lastSeenAt ? new Date(resource.lastSeenAt).toLocaleString() : '아직 없음'}</dd></div>
            <div className="rounded-lg bg-ui-hover-soft p-3"><dt className="text-xs text-text-dim">어댑터</dt><dd className="mt-1 text-sm text-text-secondary">OpenTelemetry Collector</dd></div>
          </dl>
        </section>
        <section className="rounded-xl border border-ui-border bg-bg-surface p-5">
          <h2 className="type-card-title text-text-base">Project</h2>
          <p className="mt-1 text-sm text-text-muted">Collector 리소스는 Docker 환경과 별도로 Project에 배정합니다.</p>
          <div className="mt-4 space-y-3">
            <Select value={projectId} onChange={event => setProjectId(event.target.value)} aria-label="Project 선택">
              <option value="">미분류</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
            <Button size="sm" onClick={() => void saveProject()} disabled={savingProject || projectId === (resource.projectId ?? '')}>{savingProject ? '저장 중...' : '배정 저장'}</Button>
          </div>
        </section>
      </div>

      <InfraGauges hostId={resource.id} refreshKey={refreshKey} />
      <InfraTrends hostId={resource.id} refreshKey={refreshKey} range={range} />

      <ConfirmDialog
        isOpen={Boolean(selectedConfirm)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void runConfirmedAction()}
        title={selectedConfirm?.title ?? ''}
        message={selectedConfirm?.message ?? ''}
        confirmLabel={selectedConfirm?.label}
        variant={selectedConfirm?.variant}
        isProcessing={processing}
      />
      {rotatedSetup && <InfrastructureCollectorKeyDialog setup={rotatedSetup} onClose={() => setRotatedSetup(null)} />}
    </div>
  );
}
