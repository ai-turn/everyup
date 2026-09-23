import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { DirectServiceLogsTab } from '../../features/healthcheck/components/AgentServiceLogsTab';
import { alertRulesPath } from '../../features/alerts/alertTarget';
import { RotatedTelemetryKeyDialog } from '../../features/telemetry/components/RotatedTelemetryKeyDialog';
import { DirectConnectionMeta } from '../../features/telemetry/components/DirectConnectionMeta';
import { api, type ObservedService, type ObservedServiceSetup, type Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

export function DirectLogsDetailPage() {
  const { serviceId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      if (!serviceRow.signals.includes('logs')) {
        setError('이 서비스에는 Logs 기능이 연결되어 있지 않습니다.');
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
        toast.success('직접 로그 서비스를 삭제했습니다.');
        navigate('/logs', { replace: true });
      }
      setConfirmAction(null);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-96 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />;
  if (error || !service) return <EmptyState icon="error_outline" title="직접 로그 서비스를 불러오지 못했습니다" description={error ?? undefined} action={{ label: '로그로 돌아가기', onClick: () => navigate('/logs') }} />;

  const confirmCopy = {
    rotate: {
      title: '직접 수집 키를 재발급할까요?',
      message: '현재 키는 즉시 폐기됩니다. 모든 OpenTelemetry Exporter에 새 키를 반영해야 합니다.',
      label: '재발급',
      variant: 'primary' as const,
    },
    revoke: {
      title: '직접 수집 연결을 중지할까요?',
      message: '이 키를 사용한 새 로그 수집이 즉시 차단됩니다. 저장된 로그는 유지됩니다.',
      label: '연결 중지',
      variant: 'danger' as const,
    },
    delete: {
      title: '직접 로그 서비스를 삭제할까요?',
      message: '이 서비스의 로그, 직접 수집 연결, 대상별 알림 규칙이 함께 삭제됩니다.',
      label: '삭제',
      variant: 'danger' as const,
    },
  };
  const selectedConfirm = confirmAction ? confirmCopy[confirmAction] : null;

  return (
    <div>
      <PageHeader
        title={service.name}
        subtitle="직접 연결한 OpenTelemetry 로그 서비스입니다."
        meta={
          <DirectConnectionMeta
            isActive={service.isActive}
            apiKeyMasked={service.apiKeyMasked}
            lastSeenAt={service.lastSeenAt}
            detail={{ label: '허용 신호', value: service.signals.join(', ') }}
            onRotateKey={() => setConfirmAction('rotate')}
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
          <Button variant="secondary" onClick={() => setRefreshKey(value => value + 1)}><MaterialIcon name="refresh" />새로고침</Button>
          </>
        }
        actions={
          <>
          <Button variant="secondary" onClick={() => navigate(alertRulesPath({ kind: 'direct', serviceId: service.id }))}><MaterialIcon name="notifications" />알림 규칙</Button>
          {service.isActive && <Button variant="ghost" onClick={() => setConfirmAction('revoke')}><MaterialIcon name="block" />연결 중지</Button>}
          <Button variant="destructive" onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete_outline" />삭제</Button>
          </>
        }
      />

      <DirectServiceLogsTab observedServiceId={service.id} refreshKey={refreshKey} range={range} traceId={searchParams.get('traceId') ?? undefined} />

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
