import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Button, ButtonLink, ConfirmDialog, DetailActionToolbar, EmptyState, MaterialIcon, PageHeader, TimeRangePicker,
} from '../../components/common';
import { DirectServiceRequestsTab } from '../../features/healthcheck/components/AgentServiceRequestsTab';
import { alertRulesPath } from '../../features/alerts/alertTarget';
import { DirectServiceTracesTab } from '../../features/healthcheck/components/AgentServiceTracesTab';
import { RotatedTelemetryKeyDialog } from '../../features/telemetry/components/RotatedTelemetryKeyDialog';
import { DirectConnectionMeta } from '../../features/telemetry/components/DirectConnectionMeta';
import { api, type ObservedService, type ObservedServiceSetup, type Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { ApiExclusionsSettings } from '../../features/api-requests/ApiExclusionsSettings';
import { useRequestQuery, useRequestWindow } from '../../features/api-requests/useRequestQuery';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

export function DirectApiDetailPage() {

  const { serviceId = '' } = useParams();
  const navigate = useNavigate();
  const { range, tab: view, traceId, update } = useRequestQuery();
  const [service, setService] = useState<ObservedService | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const window = useRequestWindow(range, refreshKey);
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const serviceRow = await api.getObservedService(serviceId);
        if (!active) return;
        if (!serviceRow.signals.includes('traces')) {
          setError('이 서비스에는 API 기능이 연결되어 있지 않습니다.');
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
        await api.deleteObservedService(service.id);
        toast.success('직접 API 서비스를 삭제했습니다.');
        navigate('/api', { replace: true });
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
    return <EmptyState icon="error_outline" title="직접 API 서비스를 불러오지 못했습니다" description={error ?? undefined} action={{ label: 'API로 돌아가기', to: '/api' }} />;
  }

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
    delete: {
      title: '이 Observed Service를 삭제할까요?',
      message: '이 서비스의 traces와 연결된 다른 데이터, 직접 수집 연결, 대상별 알림 규칙을 함께 삭제합니다.',
      label: '삭제',
      variant: 'danger' as const,
    },
  };
  const selectedConfirm = confirmAction ? confirmCopy[confirmAction] : null;

  return (
    <div>
      <PageHeader
        title={service.name}
        meta={
          <DirectConnectionMeta
            isActive={service.isActive}
            apiKeyMasked={service.apiKeyMasked}
            lastSeenAt={service.lastSeenAt}
            detail={{ label: '수집 데이터', value: service.signals.join(', ') }}
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
          <TimeRangePicker value={range} onChange={value => update({ range: value, page: null })} />
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

      <div role="tablist" aria-label="요청/트레이스 보기" className="mb-4 flex border-b border-ui-border">
        {(['requests', 'traces'] as const).map((tab, index) => <button key={tab} id={`api-tab-${tab}`} type="button" role="tab"
          tabIndex={view === tab ? 0 : -1} aria-selected={view === tab} aria-controls="api-data-panel"
          onClick={() => update({ tab })}
          onKeyDown={event => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - index : -1;
            if (next < 0) return;
            event.preventDefault();
            update({ tab: next === 0 ? 'requests' : 'traces' });
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${view === tab ? 'border-primary text-text-base' : 'border-transparent text-text-muted hover:text-text-base'}`}>
          {tab === 'requests' ? 'API 요청' : '트레이스'}
        </button>)}
      </div>
      <div role="tabpanel" id="api-data-panel" aria-labelledby={`api-tab-${view}`}>
        {view === 'requests'
          ? <DirectServiceRequestsTab observedServiceId={service.id} refreshKey={refreshKey} range={range} window={window} traceId={traceId} />
          : <DirectServiceTracesTab observedServiceId={service.id} refreshKey={refreshKey} range={range} window={window} />}
      </div>
      <ApiExclusionsSettings key={service.id} serviceId={service.id} paths={service.apiExcludePaths ?? []} onSaved={paths => setService(current => current ? { ...current, apiExcludePaths: paths } : current)} />

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
