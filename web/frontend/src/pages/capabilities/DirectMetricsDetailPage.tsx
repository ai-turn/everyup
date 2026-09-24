import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Button, ButtonLink, ConfirmDialog, DetailActionToolbar, EmptyState, MaterialIcon, PageHeader, TimeRangePicker, type GlobalTimeRange,
} from '../../components/common';
import { DirectServiceMetricsTab } from '../../features/healthcheck/components/AgentServiceMetricsTab';
import { alertRulesPath } from '../../features/alerts/alertTarget';
import { RotatedTelemetryKeyDialog } from '../../features/telemetry/components/RotatedTelemetryKeyDialog';
import { DirectConnectionMeta } from '../../features/telemetry/components/DirectConnectionMeta';
import { api, type ObservedService, type ObservedServiceSetup, type Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

export function DirectMetricsDetailPage() {

  const { serviceId = '' } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<ObservedService | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [range, setRange] = useState<GlobalTimeRange>('6h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useBreadcrumb(service ? [{ label: service.name }] : []);
  const [savingProject, setSavingProject] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);
  const [rotatedSetup, setRotatedSetup] = useState<ObservedServiceSetup | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [serviceRow, projectRows] = await Promise.all([
        api.getObservedService(serviceId),
        api.getProjects(),
      ]);
      if (!serviceRow.signals.includes('metrics')) {
        setError('이 서비스에는 Metrics 기능이 연결되어 있지 않습니다.');
        return;
      }
      setService(serviceRow);
      setProjectId(serviceRow.projectId ?? '');
      setProjects(projectRows ?? []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { void load(); }, [load]);

  const saveProject = async () => {
    if (!service) return;
    setSavingProject(true);
    try {
      const updated = await api.updateObservedService(service.id, {
        name: service.name,
        projectId: projectId || undefined,
        signals: service.signals,
      });
      setService(updated);
      toast.success('Project 배정을 저장했습니다.');
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setSavingProject(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!service || !confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction === 'rotate') {
        const setup = await api.rotateObservedServiceKey(service.id);
        setService(setup);
        setRotatedSetup(setup);
      } else if (confirmAction === 'revoke') {
        setService(await api.revokeObservedServiceKey(service.id));
        toast.success('직접 수집 연결을 중지했습니다.');
      } else {
        await api.deleteObservedService(service.id);
        toast.success('직접 Metrics 서비스를 삭제했습니다.');
        navigate('/metrics', { replace: true });
      }
      setConfirmAction(null);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-96 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />;
  if (error || !service) {
    return <EmptyState icon="error_outline" title="직접 Metrics 서비스를 불러오지 못했습니다" description={error ?? undefined} action={{ label: '메트릭으로 돌아가기', to: '/metrics' }} />;
  }

  const confirmCopy = {
    rotate: {
      title: '직접 수집 키를 재발급할까요?',
      message: '현재 키는 즉시 폐기됩니다. 이 서비스의 모든 OpenTelemetry Exporter에 새 키를 반영해야 합니다.',
      label: '재발급',
      variant: 'primary' as const,
    },
    revoke: {
      title: '직접 수집 연결을 중지할까요?',
      message: '이 키를 사용하는 모든 신호의 수집을 즉시 차단합니다. 저장된 데이터는 유지됩니다.',
      label: '연결 중지',
      variant: 'danger' as const,
    },
    delete: {
      title: '이 Observed Service를 삭제할까요?',
      message: '이 서비스의 메트릭과 연결된 다른 신호 데이터, 직접 수집 연결, 대상별 알림 규칙을 함께 삭제합니다.',
      label: '삭제',
      variant: 'danger' as const,
    },
  };
  const selectedConfirm = confirmAction ? confirmCopy[confirmAction] : null;

  return (
    <div>
      <PageHeader
        title={service.name}
        subtitle="직접 연결한 OpenTelemetry Metrics 서비스입니다."
        meta={
          <DirectConnectionMeta
            isActive={service.isActive}
            apiKeyMasked={service.apiKeyMasked}
            lastSeenAt={service.lastSeenAt}
            detail={{ label: '허용 신호', value: service.signals.join(', ') }}
            onRotateKey={() => setConfirmAction('rotate')}
            onRevoke={() => setConfirmAction('revoke')}
            projects={projects}
            projectId={projectId}
            savedProjectId={service.projectId ?? ''}
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
          <Button collapseLabel variant="secondary" onClick={() => setRefreshKey(value => value + 1)}><MaterialIcon name="refresh" />새로고침</Button>
          </>
        }
        actions={
          <>
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: service.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
          <Button collapseLabel variant="destructive" onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete_outline" />삭제</Button>
          </>
        }
      />

      <DirectServiceMetricsTab observedServiceId={service.id} refreshKey={refreshKey} range={range} />

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
      {rotatedSetup && <RotatedTelemetryKeyDialog setup={rotatedSetup} onClose={() => setRotatedSetup(null)} />}
    </div>
  );
}
