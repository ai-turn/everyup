import { useEffect, useState, type ReactNode } from 'react';
import { ButtonLink, MaterialIcon, SegmentedControl, TimeRangePicker, type CollectionStatus } from '../../../components/common';
import { useHeldToken } from '../../../hooks/useHeldToken';
import { api, type ObservedService } from '../../../services/api';
import { alertRulesPath } from '../../alerts/alertTarget';
import { ApiExclusionsSettings } from '../../api-requests/ApiExclusionsSettings';
import { useRequestQuery, useRequestWindow } from '../../api-requests/useRequestQuery';
import { DirectServiceRequestsTab } from '../../healthcheck/components/AgentServiceRequestsTab';
import { DirectServiceTracesTab } from '../../healthcheck/components/AgentServiceTracesTab';
import { receiptCollection, signalList } from '../signals';
import { useDirectServicePanel } from '../useDirectServicePanel';
import { DirectConnectionMeta } from './DirectConnectionMeta';

// 같은 앱, 같은 기간의 두 보기라 SegmentedControl이다(DESIGN.md §4.6). 바깥 탭(API 요청)과 이름이 겹치지 않게 "요청"이라고 쓴다.
const VIEW_OPTIONS = [{ label: '요청', value: 'requests' }, { label: '트레이스', value: 'traces' }] as const;

/** 서버 API 요청 탭에서 앱 하나의 요청과 트레이스. 앱 이름이 패널의 제목이고 조작은 그 줄 오른쪽에 둔다. */
export function DirectApiPanel({ service, onRemoved, extraActions, onChanged, refreshToken = 0 }: {
  /** 서버 상세가 불러온 앱. 패널은 따로 불러오지 않는다. */
  service: ObservedService;
  /** 삭제나 API 요청 연결 해제가 끝난 뒤 */
  onRemoved: (remaining: ObservedService | null) => void;
  /** 알림 규칙과 삭제 사이에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  extraActions?: ReactNode;
  /** 연결 중지, 키 재발급, 제외 경로 저장으로 앱이 바뀐 뒤 */
  onChanged?: () => void | Promise<void>;
  /** 화면의 새로고침을 누를 때마다 바뀐다. 바뀌면 요청과 트레이스를 다시 불러온다. */
  refreshToken?: number;
}) {
  const { range, tab: view, traceId, update } = useRequestQuery();
  const { processing, connection, removalButton, dialogs } = useDirectServicePanel(service, 'traces', onRemoved, onChanged);
  // 변경 요청이 진행 중일 때의 새로고침 신호는 버린다(변경 전의 응답이 변경 뒤의 화면을 덮지 않게).
  const reloadKey = useHeldToken(refreshToken, processing);
  const window = useRequestWindow(range, reloadKey);
  // 트레이스 수신 기준. lastSeenAt은 로그 수신으로도 갱신되어 트레이스를 받은 적 없는 앱도 수신 중으로 보인다.
  const [collection, setCollection] = useState<CollectionStatus | undefined>();
  // 저장한 제외 경로. 서버 데이터를 다시 불러오기 전에도 개수가 맞게 이 값을 먼저 쓴다.
  const [savedPaths, setSavedPaths] = useState<string[] | null>(null);
  useEffect(() => {
    let current = true;
    api.getObservedServiceSetupStatus(service.id)
      .then((receipts) => { if (current) setCollection(receiptCollection(receipts, 'traces')); }, () => { if (current) setCollection(undefined); });
    return () => { current = false; };
  }, [service.id, reloadKey]);

  return (
    <div className="space-y-5">
      {/* 제목이 위의 요소보다 아래의 상태 줄에 붙어 보이게 아래 간격을 줄이고 버튼 줄의 가운데에 맞춘다. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 wrap-anywhere text-text-base type-section-title">{service.name}</h2>
        {/* 이동, 편집, 파괴 순서(DESIGN.md §4.1) */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: service.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
          {extraActions}
          {removalButton}
        </div>
      </div>
      {/* 상태는 앱 선택의 상태와 같은 판정(appState)이다. 연결 정보는 접고, 보기와 기간 선택은 상태 줄 오른쪽 끝에 둔다. */}
      <DirectConnectionMeta
        {...connection}
        detail={{ label: '수집 데이터', value: signalList(service.signals) }}
        collapseOnMobile
        collapseLabel="연결 정보"
        collapsed
        statusAside={<>
          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={(tab) => update({ tab })} size="md" ariaLabel="요청/트레이스 보기" />
          <TimeRangePicker value={range} onChange={(value) => update({ range: value, page: null })} />
        </>}
      />
      <div>
        {view === 'requests'
          ? <DirectServiceRequestsTab observedServiceId={service.id} refreshKey={reloadKey} range={range} window={window} traceId={traceId} awaitingData={collection === 'waiting'} noun="앱" />
          : <DirectServiceTracesTab observedServiceId={service.id} refreshKey={reloadKey} range={range} window={window} />}
        <ApiExclusionsSettings key={service.id} serviceId={service.id} paths={savedPaths ?? service.apiExcludePaths ?? []}
          onSaved={(paths) => { setSavedPaths(paths); void onChanged?.(); }} />
      </div>
      {dialogs}
    </div>
  );
}
