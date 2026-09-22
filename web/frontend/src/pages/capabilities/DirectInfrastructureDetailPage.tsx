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
  TimeRangePicker,
  type GlobalTimeRange,
} from '../../components/common';
import { InfraGauges } from '../../features/infra/components/InfraGauges';
import { InfraTrends } from '../../features/infra/components/InfraTrends';
import { InfrastructureCollectorKeyDialog } from '../../features/infrastructure/components/InfrastructureCollectorKeyDialog';
import { DirectConnectionMeta } from '../../features/telemetry/components/DirectConnectionMeta';
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
      <PageHeader
        title={resource.name}
        subtitle="표준 OpenTelemetry Collector hostmetrics 리소스입니다."
        meta={
          <DirectConnectionMeta
            isActive={resource.isActive}
            apiKeyMasked={resource.apiKeyMasked}
            lastSeenAt={resource.lastSeenAt}
            detail={{ label: '어댑터', value: 'OpenTelemetry Collector' }}
            onRotateKey={() => setConfirmAction('rotate')}
            projects={projects}
            projectId={projectId}
            savedProjectId={resource.projectId ?? ''}
            onProjectChange={setProjectId}
            onSaveProject={() => void saveProject()}
            savingProject={savingProject}
          />
        }
      />
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
          <Button variant="destructive" onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete" />삭제</Button>
          </>
        }
      />

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
