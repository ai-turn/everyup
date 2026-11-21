import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TimeRangePicker, parseTimeRange, type GlobalTimeRange, type OverflowMenuItem } from '../../../components/common';
import { useHeldToken } from '../../../hooks/useHeldToken';
import type { ObservedService } from '../../../services/api';
import { DirectServiceLogsTab } from '../../healthcheck/components/AgentServiceLogsTab';
import { LogIngestLevels } from '../../logs/components/LogIngestLevels';
import { signalList } from '../signals';
import type { PanelStatus } from '../../servers/serverStatus';
import { useDirectServicePanel } from '../useDirectServicePanel';
import { DirectConnectionMeta } from './DirectConnectionMeta';
import { DirectPanelTitle } from './DirectPanelTitle';

/** 서버 로그 탭에서 앱 하나의 로그 본문. 앱 이름이 패널의 제목이고 조작은 그 줄 오른쪽에 둔다. */
export function DirectLogsPanel({ service, status, onRemoved, menuItems = [], onChanged, refreshToken = 0 }: {
  /** 서버 상세가 불러온 앱. 패널은 따로 불러오지 않는다. */
  service: ObservedService;
  /** 상태 줄. 탭이 탭의 점과 같은 판정으로 정한다. */
  status: PanelStatus;
  /** 삭제나 로그 연결 해제가 끝난 뒤 */
  onRemoved: (remaining: ObservedService | null) => void;
  /** 알림 규칙과 삭제 사이에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  menuItems?: OverflowMenuItem[];
  /** 연결 중지나 키 재발급으로 앱이 바뀐 뒤 */
  onChanged?: () => void | Promise<void>;
  /** 화면의 새로고침을 누를 때마다 바뀐다. 바뀌면 로그를 다시 불러온다. */
  refreshToken?: number;
}) {
  const [searchParams] = useSearchParams();
  const [range, setRange] = useState<GlobalTimeRange>(() => parseTimeRange(searchParams.get('range')) ?? '6h');
  const { processing, connection, removalItem, dialogs } = useDirectServicePanel(service, 'logs', onRemoved, onChanged);
  // 변경 요청이 진행 중일 때의 새로고침 신호는 버린다(변경 전의 응답이 변경 뒤의 화면을 덮지 않게).
  const token = useHeldToken(refreshToken, processing);

  return (
    <div className="page-stack">
      <DirectPanelTitle service={service} menuItems={[...menuItems, removalItem]}>
        {/* 연결 중지는 DirectConnectionMeta가 상태 바로 옆에 둔다. 연결 정보는 확인하는 값이라 접고, 기간 선택은 상태 줄 오른쪽 끝에 둔다. */}
        <DirectConnectionMeta
          {...connection}
          status={status}
          detail={{ label: '수집 데이터', value: signalList(service.signals) }}
          extraFields={[{ label: '수집 레벨', value: <LogIngestLevels observedServiceId={service.id} /> }]}
          collapseOnMobile
          collapseLabel="연결 정보"
          collapsed
          statusAside={<TimeRangePicker value={range} onChange={setRange} />}
        />
      </DirectPanelTitle>
      <DirectServiceLogsTab observedServiceId={service.id} refreshKey={token} range={range} traceId={searchParams.get('traceId') ?? undefined} />
      {dialogs}
    </div>
  );
}
