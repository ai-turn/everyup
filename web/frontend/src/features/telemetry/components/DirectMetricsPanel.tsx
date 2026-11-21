import { ButtonLink, EmptyState, MaterialIcon, OverflowMenu, TimeRangePicker, type OverflowMenuItem } from '../../../components/common';
import { useHeldToken } from '../../../hooks/useHeldToken';
import type { ObservedService } from '../../../services/api';
import { alertRulesPath } from '../../alerts/alertTarget';
import { DirectServiceMetricsTab } from '../../healthcheck/components/AgentServiceMetricsTab';
import { useMetricHealth } from '../../metrics/useMetricHealth';
import { useMetricQuery } from '../../metrics/useMetricQuery';
import { signalList } from '../signals';
import type { PanelStatus } from '../../servers/serverStatus';
import { useDirectServicePanel } from '../useDirectServicePanel';
import { DirectConnectionMeta } from './DirectConnectionMeta';

/** 서버 메트릭 탭에서 앱 하나의 메트릭. 앱 이름이 패널의 제목이고 조작은 그 줄 오른쪽에 둔다. */
export function DirectMetricsPanel({ service, status, onRemoved, menuItems = [], onChanged, refreshToken = 0 }: {
  /** 서버 상세가 불러온 앱. 패널은 따로 불러오지 않는다. */
  service: ObservedService;
  /** 상태 줄. 탭이 탭의 점과 같은 판정으로 정한다. */
  status: PanelStatus;
  /** 삭제나 메트릭 연결 해제가 끝난 뒤 */
  onRemoved: (remaining: ObservedService | null) => void;
  /** 알림 규칙과 삭제 사이에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  menuItems?: OverflowMenuItem[];
  /** 연결 중지나 키 재발급으로 앱이 바뀐 뒤 */
  onChanged?: () => void | Promise<void>;
  /** 화면의 새로고침을 누를 때마다 바뀐다. 바뀌면 메트릭을 다시 불러온다. */
  refreshToken?: number;
}) {
  const { range, update } = useMetricQuery();
  const { processing, connection, removalItem, dialogs } = useDirectServicePanel(service, 'metrics', onRemoved, onChanged);
  // 변경 요청이 진행 중일 때의 새로고침 신호는 버린다(변경 전의 응답이 변경 뒤의 화면을 덮지 않게).
  const reloadKey = useHeldToken(refreshToken, processing);
  const metricHealth = useMetricHealth({ kind: 'direct', observedServiceId: service.id }, reloadKey);

  return (
    <div className="page-stack">
      {/* 제목이 위의 요소보다 아래의 상태 줄에 붙어 보이게 아래 간격을 줄이고 버튼 줄의 가운데에 맞춘다. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 wrap-anywhere text-text-base type-page-title">{service.name}</h2>
        {/* 주 조작 하나(알림 규칙)와 더보기(옮기기, 삭제·연결 해제)다(DESIGN.md §4.1 상세 헤더). */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: service.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
          <OverflowMenu items={[...menuItems, removalItem]} />
        </div>
      </div>
      {/* 상태는 탭이 넘긴다(탭의 점, 앱 선택과 같은 판정). 연결 정보는 접고, 기간 선택은 상태 줄 오른쪽 끝에 둔다. */}
      <DirectConnectionMeta
        {...connection}
        status={status}
        detail={{ label: '수집 데이터', value: signalList(service.signals) }}
        collapseOnMobile
        collapseLabel="연결 정보"
        collapsed
        statusAside={<TimeRangePicker value={range} onChange={(value) => update({ range: value })} />}
      />
      <DirectServiceMetricsTab
        observedServiceId={service.id}
        state={metricHealth}
        refreshKey={reloadKey}
        range={range}
        active={service.isActive}
        noun="앱"
        empty={service.isActive ? (
          <EmptyState
            icon="schedule"
            title="메트릭 수신 대기"
            description="앱을 다시 시작하면 1분 안에 첫 메트릭이 들어옵니다(내보내기 주기 기본 60초). 연결 설정이 없다면 API Key를 재발급해 새 설정을 받으세요."
            action={{ label: '설정 다시 받기', onClick: connection.onRotateKey }}
          />
        ) : undefined}
      />
      {dialogs}
    </div>
  );
}
