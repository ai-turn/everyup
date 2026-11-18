import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { Button, ButtonLink, ConfirmDialog, EmptyState, MaterialIcon, TimeRangePicker, type GlobalTimeRange } from '../../../components/common';
import { useBreadcrumb } from '../../../contexts/BreadcrumbContext';
import { useInfraMetrics } from '../../../hooks/useInfra';
import { api, type InfrastructureResource, type InfrastructureResourceSetup, type Project } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { alertRulesPath } from '../../alerts/alertTarget';
import { InfrastructureCollectorKeyDialog } from '../../infrastructure/components/InfrastructureCollectorKeyDialog';
import { DirectConnectionMeta } from '../../telemetry/components/DirectConnectionMeta';
import { infraCollection } from '../usage';
import { InfraTrends } from './InfraTrends';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

const CONFIRM_COPY = {
  rotate: { title: 'API Key를 재발급할까요?', message: '현재 키는 즉시 폐기됩니다. 실행 중인 OpenTelemetry Collector 설정에 새 키를 반영해야 합니다.', label: '재발급', variant: 'primary' as const },
  revoke: { title: 'Collector 연결을 중지할까요?', message: '새 hostmetrics 수집이 즉시 차단됩니다. 저장된 이력은 유지됩니다.', label: '연결 중지', variant: 'danger' as const },
  delete: { title: '인프라 리소스를 삭제할까요?', message: '저장된 호스트 메트릭 이력과 대상별 리소스 알림 규칙을 함께 삭제합니다.', label: '삭제', variant: 'danger' as const },
};

function ResourceCrumb({ name }: { name: string }) {
  useBreadcrumb([{ label: name }]);
  return null;
}

/** 인프라 리소스 하나의 상세 본문. 리소스 이름이 패널의 제목이고 조작은 그 줄 오른쪽에 둔다. */
export function InfrastructurePanel({ resourceId, resource: given, onDeleted, back, extraActions, hideGroup = false, onChanged, standalone = false, refreshToken = 0 }: {
  resourceId: string;
  /** 서버 상세가 이미 불러온 리소스. 주면 따로 불러오지 않는다(갱신의 주체는 서버 상세 하나다). */
  resource?: InfrastructureResource;
  /** 삭제가 끝난 뒤 */
  onDeleted: () => void;
  /** 불러오지 못했을 때 돌아갈 곳 */
  back: { label: string; to: string };
  /** 알림 규칙과 삭제 사이에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  extraActions?: ReactNode;
  /** 서버 화면에서는 그룹을 서버가 정하므로 그룹 선택을 숨긴다 */
  hideGroup?: boolean;
  /** 연결 중지나 키 재발급으로 리소스가 바뀐 뒤. 서버 상세가 서버 데이터를 다시 불러온다. */
  onChanged?: () => void | Promise<void>;
  /** 옛 인프라 상세(/infrastructure/:id)처럼 패널이 페이지 전체일 때: 제목이 h1이고 경로 표시와 새로고침을 패널이 갖는다. Task 13에서 없앤다. */
  standalone?: boolean;
  /** 화면의 새로고침을 누를 때마다 바뀐다. 바뀌면 사용률 추이를 다시 불러온다. */
  refreshToken?: number;
}) {
  const [fetched, setFetched] = useState<InfrastructureResource | null>(null);
  const resource = given ?? fetched;
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [range, setRange] = useState<GlobalTimeRange>('6h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(!given);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [savingProject, setSavingProject] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);
  const [rotatedSetup, setRotatedSetup] = useState<InfrastructureResourceSetup | null>(null);
  // 마운트 때의 refreshToken은 첫 조회와 같으므로 합쳐도 처음에 한 번만 불러온다.
  const { data: metrics, loading: metricsLoading, error: metricsError } = useInfraMetrics(resourceId, range, refreshKey + refreshToken);
  const refresh = () => setRefreshKey((value) => value + 1);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const hasGiven = Boolean(given);
  useEffect(() => {
    if (hasGiven) return;
    let current = true;
    setLoading(true);
    setError(null);
    Promise.all([api.getInfrastructureResource(resourceId), hideGroup ? Promise.resolve(null) : api.getProjects()])
      .then(([row, projectRows]) => {
        if (!current) return;
        setFetched(row);
        setProjectId(row.projectId ?? '');
        setProjects(projectRows ?? []);
      })
      .catch((requestError: unknown) => { if (current) setError(getErrorMessage(requestError)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [resourceId, hideGroup, hasGiven, loadKey]);

  // 옛 화면의 그룹 배정. serverId를 보내지 않아 백엔드가 소속 서버의 그룹을 바꾼다(설계 5.5).
  const saveProject = async () => {
    if (!resource) return;
    setSavingProject(true);
    try {
      const updated = await api.updateInfrastructureResource(resource.id, { name: resource.name, projectId: projectId || undefined });
      if (alive.current) setFetched(updated);
      toast.success('그룹 배정을 저장했습니다.');
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      if (alive.current) setSavingProject(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!resource || !confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction === 'delete') {
        await api.deleteInfrastructureResource(resource.id);
        toast.success('인프라 리소스를 삭제했습니다.');
        // 화면이 바뀔 때까지 조작을 막아 둔다(processing을 풀지 않는다).
        onDeleted();
        return;
      }
      if (confirmAction === 'rotate') {
        const setup = await api.rotateInfrastructureResourceKey(resource.id);
        if (!alive.current) return;
        setFetched(setup);
        setRotatedSetup(setup);
      } else {
        const updated = await api.revokeInfrastructureResourceKey(resource.id);
        if (!alive.current) return;
        setFetched(updated);
        toast.success('Collector 연결을 중지했습니다.');
      }
      setConfirmAction(null);
      await onChanged?.();
      if (alive.current) setProcessing(false);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
      // 삭제에 성공하면 화면이 바뀔 때까지 풀지 않으므로 finally가 아니라 실패에서만 푼다.
      // react-doctor-disable-next-line no-loading-flag-reset-outside-finally
      if (alive.current) setProcessing(false);
    }
  };

  if (loading) return <div aria-busy="true" className="h-96 animate-pulse rounded-xl bg-ui-hover-soft" />;
  if (!resource) {
    return (
      <EmptyState icon="error_outline" title="인프라 리소스를 불러오지 못했습니다" description={error ?? undefined} headingLevel={standalone ? 'h3' : 'h2'}>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => setLoadKey((key) => key + 1)}>다시 시도</Button>
          <ButtonLink variant="secondary" to={back.to}>{back.label}로 돌아가기</ButtonLink>
        </div>
      </EmptyState>
    );
  }

  const selectedConfirm = confirmAction ? CONFIRM_COPY[confirmAction] : null;
  const Heading = standalone ? 'h1' : 'h2';

  return (
    <div className="space-y-5">
      {standalone && <ResourceCrumb name={resource.name} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading className={`min-w-0 wrap-anywhere text-text-base ${standalone ? 'type-page-title' : 'type-section-title'}`}>{resource.name}</Heading>
        {/* 이동, 편집, 파괴 순서(DESIGN.md §4.1) */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'infrastructure', resourceId: resource.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
          {extraActions}
          <Button collapseLabel variant="destructive" disabled={processing} onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete_outline" />삭제</Button>
        </div>
      </div>
      {/* 연결 중지는 DirectConnectionMeta가 상태 바로 옆에 둔다. */}
      <DirectConnectionMeta
        isActive={resource.isActive}
        collection={infraCollection(resource)}
        collapseOnMobile
        // 서버 화면 안에서 "서버 정보"는 서버 자체의 정보로 읽힌다.
        collapseLabel={standalone ? '서버 정보' : '연결 정보'}
        apiKeyMasked={resource.apiKeyMasked}
        lastSeenAt={resource.lastSeenAt}
        detail={{ label: '연결 방식', value: 'OpenTelemetry Collector' }}
        onRotateKey={() => setConfirmAction('rotate')}
        onRevoke={() => setConfirmAction('revoke')}
        {...(hideGroup ? {} : {
          projects, projectId, savedProjectId: resource.projectId ?? '',
          onProjectChange: setProjectId, onSaveProject: () => void saveProject(), savingProject,
        })}
      />
      {/* 서버 상세에서는 머리말의 새로고침 하나가 패널까지 갱신한다(refreshToken). */}
      <div className="flex flex-wrap items-center gap-2">
        <TimeRangePicker value={range} onChange={setRange} />
        {standalone && <Button collapseLabel variant="secondary" onClick={refresh}><MaterialIcon name="refresh" />새로고침</Button>}
      </div>

      {/* 현재 값·위험 표시는 차트 머리에 있다. 같은 지표를 게이지 줄로 한 번 더 그리지 않는다. */}
      <InfraTrends
        hostId={resource.id}
        charts={metrics?.charts}
        loading={metricsLoading}
        range={range}
        error={metricsError}
        onRetry={refresh}
        empty={resource.lastSeenAt ? undefined : (
          <EmptyState
            icon="schedule"
            title="Collector 수신 대기"
            description="Collector를 실행하면 30초 안에 첫 메트릭이 들어옵니다. 설정 파일이 없다면 API Key를 재발급해 새 설정을 받으세요."
            action={{ label: '설정 다시 받기', onClick: () => setConfirmAction('rotate') }}
          />
        )}
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
      {rotatedSetup && <InfrastructureCollectorKeyDialog setup={rotatedSetup} onClose={() => setRotatedSetup(null)} />}
    </div>
  );
}
