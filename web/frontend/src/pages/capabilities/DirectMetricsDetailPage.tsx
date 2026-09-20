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
import { DirectServiceMetricsTab } from '../../features/healthcheck/components/AgentServiceMetricsTab';
import { alertRulesPath } from '../../features/alerts/alertTarget';
import { RotatedTelemetryKeyDialog } from '../../features/telemetry/components/RotatedTelemetryKeyDialog';
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
    return <EmptyState icon="error_outline" title="직접 Metrics 서비스를 불러오지 못했습니다" description={error ?? undefined} action={{ label: 'Metrics로 돌아가기', onClick: () => navigate('/metrics') }} />;
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
      <PageHeader title={service.name} subtitle="직접 연결한 OpenTelemetry Metrics 서비스입니다." />
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
          <Button variant="ghost" className="text-status-error hover:text-status-error" onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete" />삭제</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-ui-border bg-bg-surface p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="type-card-title text-text-base">직접 수집 연결</h2>
            <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${service.isActive ? 'border-status-healthy/20 bg-status-healthy/10 text-status-healthy' : 'border-status-error/20 bg-status-error/10 text-status-error'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${service.isActive ? 'bg-status-healthy' : 'bg-status-error'}`} aria-hidden="true" />
              {service.isActive ? '수집 가능' : '중지됨'}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-ui-hover-soft p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-dim">수집 키</p>
              <p className="mt-1 truncate font-mono text-sm text-text-secondary">{service.apiKeyMasked || '마스킹된 키 없음'}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction('rotate')}><MaterialIcon name="key" />키 재발급</Button>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-ui-hover-soft p-3"><dt className="text-xs text-text-dim">마지막 수집</dt><dd className="mt-1 text-sm text-text-secondary">{service.lastSeenAt ? new Date(service.lastSeenAt).toLocaleString() : '아직 없음'}</dd></div>
            <div className="rounded-lg bg-ui-hover-soft p-3"><dt className="text-xs text-text-dim">허용 신호</dt><dd className="mt-1 font-mono text-sm text-text-secondary">{service.signals.join(', ')}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border border-ui-border bg-bg-surface p-5">
          <h2 className="type-card-title text-text-base">Project</h2>
          <p className="mt-1 text-sm text-text-muted">직접 서비스는 Docker 환경과 별도로 Project에 배정합니다.</p>
          <div className="mt-4 space-y-3">
            <Select value={projectId} onChange={event => setProjectId(event.target.value)} aria-label="Project 선택">
              <option value="">미분류</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
            <Button size="sm" onClick={() => void saveProject()} disabled={savingProject || projectId === (service.projectId ?? '')}>{savingProject ? '저장 중...' : '배정 저장'}</Button>
          </div>
        </section>
      </div>

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
