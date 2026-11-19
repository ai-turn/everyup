import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, ConfirmDialog, EmptyState, MaterialIcon, TimeRangePicker, parseTimeRange, type GlobalTimeRange } from '../../../components/common';
import { useHeldToken } from '../../../hooks/useHeldToken';
import { useInfraMetrics } from '../../../hooks/useInfra';
import { api, type InfrastructureResource, type InfrastructureResourceSetup } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { alertRulesPath } from '../../alerts/alertTarget';
import { InfrastructureCollectorKeyDialog } from '../../infrastructure/components/InfrastructureCollectorKeyDialog';
import type { PanelStatus } from '../../servers/serverStatus';
import { DirectConnectionMeta } from '../../telemetry/components/DirectConnectionMeta';
import { InfraTrends } from './InfraTrends';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

const CONFIRM_COPY = {
  rotate: { title: 'API Key를 재발급할까요?', message: '현재 키는 즉시 폐기됩니다. 실행 중인 OpenTelemetry Collector 설정에 새 키를 반영해야 합니다.', label: '재발급', variant: 'primary' as const },
  revoke: { title: 'Collector 연결을 중지할까요?', message: '새 hostmetrics 수집이 즉시 차단됩니다. 저장된 이력은 유지됩니다.', label: '연결 중지', variant: 'danger' as const },
  delete: { title: '인프라 리소스를 삭제할까요?', message: '저장된 호스트 메트릭 이력과 대상별 리소스 알림 규칙을 함께 삭제합니다.', label: '삭제', variant: 'danger' as const },
};

/** 서버 인프라 탭의 리소스 상세 본문. 리소스는 서버마다 하나라 제목은 스크린리더에만 두고, 조작은 상태 줄 오른쪽에 둔다. */
export function InfrastructurePanel({ resource, status, serverName, onDeleted, extraActions, onChanged, refreshToken = 0 }: {
  /** 서버 상세가 불러온 리소스. 패널은 따로 불러오지 않는다(갱신의 주체는 서버 상세 하나다). */
  resource: InfrastructureResource;
  /** 상태 줄. 탭이 탭의 점과 같은 판정으로 정한다. */
  status: PanelStatus;
  /** 리소스 이름이 이와 같으면 다시 적지 않는다(서버 이름이 이미 h1이다). */
  serverName?: string;
  /** 삭제가 끝난 뒤 */
  onDeleted: () => void;
  /** 알림 규칙과 삭제 사이에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  extraActions?: ReactNode;
  /** 연결 중지나 키 재발급으로 리소스가 바뀐 뒤. 서버 상세가 서버 데이터를 다시 불러온다. */
  onChanged?: () => void | Promise<void>;
  /** 화면의 새로고침을 누를 때마다 바뀐다. 바뀌면 사용률 추이를 다시 불러온다. */
  refreshToken?: number;
}) {
  // 기간은 주소(range)에 둔다(설계 6.7).
  const [searchParams, setSearchParams] = useSearchParams();
  const range = parseTimeRange(searchParams.get('range')) ?? '6h';
  const setRange = (value: GlobalTimeRange) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set('range', value); return next; });
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);
  const [rotatedSetup, setRotatedSetup] = useState<InfrastructureResourceSetup | null>(null);
  // 마운트 때의 refreshToken은 첫 조회와 같으므로 합쳐도 처음에 한 번만 불러온다.
  // 변경 요청이 진행 중일 때의 새로고침 신호는 버린다(변경 전의 응답이 변경 뒤의 화면을 덮지 않게).
  const { data: metrics, loading: metricsLoading, error: metricsError } = useInfraMetrics(resource.id, range, refreshKey + useHeldToken(refreshToken, processing));
  const refresh = () => setRefreshKey((value) => value + 1);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction === 'delete') {
        await api.deleteInfrastructureResource(resource.id);
        toast.success('인프라 리소스를 삭제했습니다');
        // 화면이 바뀔 때까지 조작을 막아 둔다(processing을 풀지 않는다).
        onDeleted();
        return;
      }
      if (confirmAction === 'rotate') {
        const setup = await api.rotateInfrastructureResourceKey(resource.id);
        if (!alive.current) return;
        setRotatedSetup(setup);
      } else {
        await api.revokeInfrastructureResourceKey(resource.id);
        if (!alive.current) return;
        toast.success('Collector 연결을 중지했습니다');
      }
      // 다시 불러온 결과가 반영된 뒤에 닫는다. 먼저 닫으면 그동안 옛 상태와 누를 수 있는 버튼이 보였다.
      await onChanged?.();
      if (!alive.current) return;
      setConfirmAction(null);
      setProcessing(false);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
      // 삭제에 성공하면 화면이 바뀔 때까지 풀지 않으므로 finally가 아니라 실패에서만 푼다.
      // react-doctor-disable-next-line no-loading-flag-reset-outside-finally
      if (alive.current) setProcessing(false);
    }
  };

  const selectedConfirm = confirmAction ? CONFIRM_COPY[confirmAction] : null;
  // 이동, 편집, 파괴 순서(DESIGN.md §4.1)
  const actions = <>
    <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'infrastructure', resourceId: resource.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
    {extraActions}
    <Button collapseLabel variant="destructive" disabled={processing} onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete_outline" />삭제</Button>
  </>;
  const rangePicker = <TimeRangePicker value={range} onChange={setRange} />;
  return (
    <div className="space-y-5">
      {/* 리소스는 서버마다 하나이고 이름이 서버 이름과 같은 경우가 많다. 제목은 스크린리더에만 두고 조작은 상태 줄 오른쪽이다. */}
      <h2 className="sr-only">인프라</h2>
      {/* 연결 중지는 DirectConnectionMeta가 상태 바로 옆에 둔다. */}
      <DirectConnectionMeta
        isActive={resource.isActive}
        status={status}
        statusDetail={resource.name !== serverName && <span className="text-text-dim">{resource.name}</span>}
        statusAside={<>{rangePicker}{actions}</>}
        collapsed
        collapseOnMobile
        // 서버 화면 안에서 "서버 정보"는 서버 자체의 정보로 읽힌다.
        collapseLabel="연결 정보"
        apiKeyMasked={resource.apiKeyMasked}
        lastSeenAt={resource.lastSeenAt}
        detail={{ label: '연결 방식', value: 'OpenTelemetry Collector' }}
        onRotateKey={() => setConfirmAction('rotate')}
        onRevoke={() => setConfirmAction('revoke')}
      />

      {/* 현재 값·위험 표시는 차트 머리에 있다. 같은 지표를 게이지 줄로 한 번 더 그리지 않는다. */}
      <InfraTrends
        hostId={resource.id}
        charts={metrics?.charts}
        loading={metricsLoading}
        range={range}
        error={metricsError}
        onRetry={refresh}
        showHeading={false}
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
