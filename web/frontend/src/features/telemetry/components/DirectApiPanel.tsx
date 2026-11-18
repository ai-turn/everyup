import { useEffect, useState, type ReactNode } from 'react';
import { Button, ButtonLink, EmptyState, MaterialIcon, SegmentedControl, Tabs, TimeRangePicker, tabId, tabPanelId, type CollectionStatus, type TabItem } from '../../../components/common';
import { useBreadcrumb } from '../../../contexts/BreadcrumbContext';
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

// 서버 탭 안에서는 바깥 탭(API 요청)과 이름이 겹치지 않게 "요청"이라고 쓴다.
const viewTabs = (standalone: boolean): TabItem<'requests' | 'traces'>[] => [
  { key: 'requests', label: standalone ? 'API 요청' : '요청' },
  { key: 'traces', label: '트레이스' },
];
// 서버 탭에서는 같은 앱, 같은 기간의 두 보기라 SegmentedControl이다(DESIGN.md §4.6). 밑줄 탭이면 탭 줄이 두 겹이었다.
const VIEW_OPTIONS = [{ label: '요청', value: 'requests' }, { label: '트레이스', value: 'traces' }] as const;

function ServiceCrumb({ name }: { name: string }) {
  useBreadcrumb([{ label: name }]);
  return null;
}

/** 직접 연결한 앱 하나의 API 요청과 트레이스. 앱 이름이 패널의 제목이고 조작은 그 줄 오른쪽에 둔다. */
export function DirectApiPanel({ serviceId, service: given, onRemoved, back, extraActions, onChanged, standalone = false, refreshToken = 0 }: {
  serviceId: string;
  /** 서버 상세가 이미 불러온 앱. 주면 따로 불러오지 않는다. */
  service?: ObservedService;
  /** 삭제나 API 요청 연결 해제가 끝난 뒤 */
  onRemoved: (remaining: ObservedService | null) => void;
  /** 불러오지 못했을 때 돌아갈 곳. 서버 탭에서는 label을 링크 문구 그대로 쓴다. */
  back: { label: string; to: string };
  /** 알림 규칙과 삭제 사이에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  extraActions?: ReactNode;
  /** 연결 중지, 키 재발급, 제외 경로 저장으로 앱이 바뀐 뒤 */
  onChanged?: () => void | Promise<void>;
  /** 옛 API 상세(/api/:id): 제목이 h1이고 경로 표시, 새로고침, 그룹 배정을 패널이 갖는다. Task 13에서 없앤다. */
  standalone?: boolean;
  /** 화면의 새로고침을 누를 때마다 바뀐다. 바뀌면 요청과 트레이스를 다시 불러온다. */
  refreshToken?: number;
}) {
  const { range, tab: view, traceId, update } = useRequestQuery();
  const [refreshKey, setRefreshKey] = useState(0);
  const { service, loading, error, reload, processing, connection, removalButton, dialogs, projectFields } = useDirectServicePanel(serviceId, 'traces', onRemoved, {
    service: given, onChanged, standalone, assignProject: standalone,
  });
  // 변경 요청이 진행 중일 때의 새로고침 신호는 버린다(변경 전의 응답이 변경 뒤의 화면을 덮지 않게).
  const reloadKey = refreshKey + useHeldToken(refreshToken, processing);
  const window = useRequestWindow(range, reloadKey);
  // 트레이스 수신 기준. lastSeenAt은 로그 수신으로도 갱신되어 트레이스를 받은 적 없는 앱도 수신 중으로 보인다.
  const [collection, setCollection] = useState<CollectionStatus | undefined>();
  // 저장한 제외 경로. 옛 상세는 패널을 다시 불러오지 않고 이 값으로 개수를 맞춘다(다시 불러오면 열어 둔 칸이 닫힌다).
  const [savedPaths, setSavedPaths] = useState<string[] | null>(null);
  useEffect(() => {
    let current = true;
    api.getObservedServiceSetupStatus(serviceId)
      .then((receipts) => { if (current) setCollection(receiptCollection(receipts, 'traces')); }, () => { if (current) setCollection(undefined); });
    return () => { current = false; };
  }, [serviceId, reloadKey]);

  if (loading) return <div aria-busy="true" className="h-96 animate-pulse rounded-xl bg-ui-hover-soft" />;
  if (!service) {
    return (
      <EmptyState icon="error_outline" title="API 앱을 불러오지 못했습니다" description={error ?? undefined} headingLevel={standalone ? 'h3' : 'h2'}>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reload}>다시 시도</Button>
          <ButtonLink variant="secondary" to={back.to}>{standalone ? `${back.label}로 돌아가기` : back.label}</ButtonLink>
        </div>
      </EmptyState>
    );
  }

  const Heading = standalone ? 'h1' : 'h2';
  const rangePicker = <TimeRangePicker value={range} onChange={(value) => update({ range: value, page: null })} />;
  const content = view === 'requests'
    ? <DirectServiceRequestsTab observedServiceId={service.id} refreshKey={reloadKey} range={range} window={window} traceId={traceId} awaitingData={collection === 'waiting'} noun={standalone ? undefined : '앱'} />
    : <DirectServiceTracesTab observedServiceId={service.id} refreshKey={reloadKey} range={range} window={window} />;

  return (
    <div className="space-y-5">
      {standalone && <ServiceCrumb name={service.name} />}
      {/* 서버 탭: 제목이 위의 요소보다 아래의 상태 줄에 붙어 보이게 아래 간격을 줄이고 버튼 줄의 가운데에 맞춘다. */}
      <div className={`flex flex-wrap justify-between gap-3 ${standalone ? 'items-start' : 'mb-2 items-center'}`}>
        <Heading className={`min-w-0 wrap-anywhere text-text-base ${standalone ? 'type-page-title' : 'type-section-title'}`}>{service.name}</Heading>
        {/* 이동, 편집, 파괴 순서(DESIGN.md §4.1) */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: service.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
          {extraActions}
          {removalButton}
        </div>
      </div>
      {/* 서버 탭에서는 앱 선택의 상태와 같은 판정(appState)을 쓴다. 옛 상세는 트레이스 수신 기준이다. */}
      <DirectConnectionMeta
        {...connection}
        {...(standalone ? { collection } : {})}
        {...projectFields}
        detail={{ label: '수집 데이터', value: signalList(service.signals) }}
        collapseOnMobile
        collapseLabel={standalone ? '서비스 정보' : '연결 정보'}
        // 서버 탭: 연결 정보는 확인하는 값이라 접고, 기간 선택은 상태 줄 오른쪽 끝에 둔다. 새로고침은 서버 머리말 하나다.
        collapsed={!standalone}
        statusAside={standalone ? undefined : <>
          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={(tab) => update({ tab })} size="md" ariaLabel="요청/트레이스 보기" />
          {rangePicker}
        </>}
      />
      {standalone && (
        <div className="flex flex-wrap items-center gap-2">
          {rangePicker}
          <Button collapseLabel variant="secondary" onClick={() => setRefreshKey((value) => value + 1)}><MaterialIcon name="refresh" />새로고침</Button>
        </div>
      )}
      <div>
        {standalone ? <>
          {/* 옛 API 상세만 밑줄 탭이다. */}
          <div className="mb-4">
            <Tabs items={viewTabs(standalone)} active={view} onChange={(tab) => update({ tab })} ariaLabel="요청/트레이스 보기" idPrefix="api" />
          </div>
          <div role="tabpanel" id={tabPanelId('api', view)} aria-labelledby={tabId('api', view)}>{content}</div>
        </> : content}
        <ApiExclusionsSettings key={service.id} serviceId={service.id} paths={savedPaths ?? service.apiExcludePaths ?? []}
          onSaved={(paths) => { setSavedPaths(paths); if (!standalone) void onChanged?.(); }} />
      </div>
      {dialogs}
    </div>
  );
}
