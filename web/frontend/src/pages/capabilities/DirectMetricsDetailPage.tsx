import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Button, ButtonLink, ConfirmDialog, DetailActionToolbar, EmptyState, MaterialIcon, PageHeader, TimeRangePicker,
} from '../../components/common';
import { DirectServiceMetricsTab } from '../../features/healthcheck/components/AgentServiceMetricsTab';
import { alertRulesPath } from '../../features/alerts/alertTarget';
import { RotatedTelemetryKeyDialog } from '../../features/telemetry/components/RotatedTelemetryKeyDialog';
import { DirectConnectionMeta } from '../../features/telemetry/components/DirectConnectionMeta';
import { serviceRemoval, signalList } from '../../features/telemetry/signals';
import { api, type ObservedService, type ObservedServiceSetup, type Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { useMetricQuery } from '../../features/metrics/useMetricQuery';
import { useMetricHealth } from '../../features/metrics/useMetricHealth';
import { metricHealthCollection } from '../../features/metrics/metricPresentation';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

export function DirectMetricsDetailPage() {

  const { serviceId = '' } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<ObservedService | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const { range, update } = useMetricQuery();
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useBreadcrumb(service ? [{ label: service.name }] : []);
  const [savingProject, setSavingProject] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsRetryKey, setProjectsRetryKey] = useState(0);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);
  const [rotatedSetup, setRotatedSetup] = useState<ObservedServiceSetup | null>(null);
  // 헤더 수집 상태와 본문 격자가 같은 health 응답을 쓴다 — 키가 살아 있어도 수신 전·지연일 수 있다.
  const metricHealth = useMetricHealth({ kind: 'direct', observedServiceId: serviceId }, refreshKey);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const serviceRow = await api.getObservedService(serviceId);
        if (!active) return;
        if (!serviceRow.signals.includes('metrics')) {
          setError('이 서비스에는 메트릭이 연결되어 있지 않습니다.');
          return;
        }
        setService(serviceRow);
        setProjectId(serviceRow.projectId ?? '');
      } catch (error) {
        if (active) setError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [serviceId]);

  useEffect(() => {
    let active = true;
    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const rows = await api.getProjects();
        if (active) setProjects(rows ?? []);
      } catch (error) {
        if (active) setProjectsError(getErrorMessage(error));
      } finally {
        if (active) setProjectsLoading(false);
      }
    };
    void loadProjects();
    return () => { active = false; };
  }, [serviceId, projectsRetryKey]);

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
      toast.success('그룹 배정을 저장했습니다.');
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
        const removal = serviceRemoval(service, 'metrics');
        if (removal.kind === 'detach') {
          await api.updateObservedService(service.id, { name: service.name, projectId: service.projectId ?? undefined, signals: removal.signals });
        } else {
          await api.deleteObservedService(service.id);
        }
        toast.success(removal.done);
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
    return <EmptyState icon="error_outline" title="메트릭 서비스를 불러오지 못했습니다" description={error ?? undefined} action={{ label: '메트릭으로 돌아가기', to: '/metrics' }} />;
  }

  const removal = serviceRemoval(service, 'metrics');
  const healthStatus = metricHealth.health && metricHealthCollection(metricHealth.health, service.isActive);
  const confirmCopy = {
    rotate: {
      title: 'API Key를 재발급할까요?',
      message: '현재 키는 즉시 폐기됩니다. 이 서비스의 모든 OpenTelemetry Exporter에 새 키를 반영해야 합니다.',
      label: '재발급',
      variant: 'primary' as const,
    },
    revoke: {
      title: '직접 수집 연결을 중지할까요?',
      message: '이 키를 사용하는 모든 데이터의 수집을 즉시 차단합니다. 저장된 데이터는 유지됩니다.',
      label: '연결 중지',
      variant: 'danger' as const,
    },
    delete: { title: removal.title, message: removal.message, label: removal.button, variant: 'danger' as const },
  };
  const selectedConfirm = confirmAction ? confirmCopy[confirmAction] : null;

  return (
    <div>
      <PageHeader
        title={service.name}
        meta={
          <DirectConnectionMeta
            isActive={service.isActive}
            collection={healthStatus ? healthStatus.collection : undefined}
            collapseOnMobile
            collapseLabel="서비스 정보"
            apiKeyMasked={service.apiKeyMasked}
            lastSeenAt={healthStatus ? healthStatus.receivedAt ?? null : service.lastSeenAt}
            detail={{ label: '수집 데이터', value: signalList(service.signals) }}
            onRotateKey={() => setConfirmAction('rotate')}
            onRevoke={() => setConfirmAction('revoke')}
            projects={projects}
            projectId={projectId}
            savedProjectId={service.projectId ?? ''}
            onProjectChange={setProjectId}
            onSaveProject={() => void saveProject()}
            savingProject={savingProject}
            projectsLoading={projectsLoading}
            projectsError={projectsError}
            onRetryProjects={() => setProjectsRetryKey(key => key + 1)}
          />
        }
      />
      <DetailActionToolbar
        controls={
          <>
          <TimeRangePicker value={range} onChange={value => update({ range: value })} />
          <Button collapseLabel variant="secondary" onClick={() => setRefreshKey(value => value + 1)}><MaterialIcon name="refresh" />새로고침</Button>
          </>
        }
        actions={
          <>
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: service.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
          <Button collapseLabel variant="destructive" onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete_outline" />{removal.button}</Button>
          </>
        }
      />

      <DirectServiceMetricsTab
        observedServiceId={service.id}
        state={metricHealth}
        refreshKey={refreshKey}
        range={range}
        active={service.isActive}
        empty={service.isActive ? (
          <EmptyState
            icon="schedule"
            title="메트릭 수신 대기"
            description="앱을 다시 시작하면 1분 안에 첫 메트릭이 들어옵니다(내보내기 주기 기본 60초). 연결 설정이 없다면 API Key를 재발급해 새 설정을 받으세요."
            action={{ label: '설정 다시 받기', onClick: () => setConfirmAction('rotate') }}
          />
        ) : undefined}
      />

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
