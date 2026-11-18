import { useState, type ReactNode } from 'react';
import { Button, ButtonLink, EmptyState, MaterialIcon, TimeRangePicker } from '../../../components/common';
import { useBreadcrumb } from '../../../contexts/BreadcrumbContext';
import { useHeldToken } from '../../../hooks/useHeldToken';
import type { ObservedService } from '../../../services/api';
import { alertRulesPath } from '../../alerts/alertTarget';
import { DirectServiceMetricsTab } from '../../healthcheck/components/AgentServiceMetricsTab';
import { metricHealthCollection } from '../../metrics/metricPresentation';
import { useMetricHealth } from '../../metrics/useMetricHealth';
import { useMetricQuery } from '../../metrics/useMetricQuery';
import { signalList } from '../signals';
import { useDirectServicePanel } from '../useDirectServicePanel';
import { DirectConnectionMeta } from './DirectConnectionMeta';

function ServiceCrumb({ name }: { name: string }) {
  useBreadcrumb([{ label: name }]);
  return null;
}

/** 직접 연결한 앱 하나의 메트릭. 앱 이름이 패널의 제목이고 조작은 그 줄 오른쪽에 둔다. */
export function DirectMetricsPanel({ serviceId, service: given, onRemoved, back, extraActions, onChanged, standalone = false, refreshToken = 0 }: {
  serviceId: string;
  /** 서버 상세가 이미 불러온 앱. 주면 따로 불러오지 않는다. */
  service?: ObservedService;
  /** 삭제나 메트릭 연결 해제가 끝난 뒤 */
  onRemoved: (remaining: ObservedService | null) => void;
  /** 불러오지 못했을 때 돌아갈 곳. 서버 탭에서는 label을 링크 문구 그대로 쓴다. */
  back: { label: string; to: string };
  /** 알림 규칙과 삭제 사이에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  extraActions?: ReactNode;
  /** 연결 중지나 키 재발급으로 앱이 바뀐 뒤 */
  onChanged?: () => void | Promise<void>;
  /** 옛 메트릭 상세(/metrics/:id): 제목이 h1이고 경로 표시, 새로고침, 그룹 배정을 패널이 갖는다. Task 13에서 없앤다. */
  standalone?: boolean;
  /** 화면의 새로고침을 누를 때마다 바뀐다. 바뀌면 메트릭을 다시 불러온다. */
  refreshToken?: number;
}) {
  const { range, update } = useMetricQuery();
  const [refreshKey, setRefreshKey] = useState(0);
  const { service, loading, error, reload, processing, connection, removalButton, dialogs, projectFields } = useDirectServicePanel(serviceId, 'metrics', onRemoved, {
    service: given, onChanged, standalone, assignProject: standalone,
  });
  // 변경 요청이 진행 중일 때의 새로고침 신호는 버린다(변경 전의 응답이 변경 뒤의 화면을 덮지 않게).
  const reloadKey = refreshKey + useHeldToken(refreshToken, processing);
  // 머리말의 수집 상태(옛 상세)와 본문 격자가 같은 health 응답을 쓴다.
  const metricHealth = useMetricHealth({ kind: 'direct', observedServiceId: serviceId }, reloadKey);

  if (loading) return <div aria-busy="true" className="h-96 animate-pulse rounded-xl bg-ui-hover-soft" />;
  if (!service) {
    return (
      <EmptyState icon="error_outline" title="메트릭 앱을 불러오지 못했습니다" description={error ?? undefined} headingLevel={standalone ? 'h3' : 'h2'}>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reload}>다시 시도</Button>
          <ButtonLink variant="secondary" to={back.to}>{standalone ? `${back.label}로 돌아가기` : back.label}</ButtonLink>
        </div>
      </EmptyState>
    );
  }

  const Heading = standalone ? 'h1' : 'h2';
  const rangePicker = <TimeRangePicker value={range} onChange={(value) => update({ range: value })} />;
  // 서버 탭에서는 앱 선택의 상태와 같은 판정(appState)을 쓴다. 옛 상세는 메트릭 수신 기준이다.
  const health = standalone && metricHealth.health ? metricHealthCollection(metricHealth.health, service.isActive) : null;
  const status = standalone ? { collection: health?.collection, lastSeenAt: health ? health.receivedAt ?? null : service.lastSeenAt } : {};

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
      <DirectConnectionMeta
        {...connection}
        {...status}
        {...projectFields}
        detail={{ label: '수집 데이터', value: signalList(service.signals) }}
        collapseOnMobile
        collapseLabel={standalone ? '서비스 정보' : '연결 정보'}
        // 서버 탭: 연결 정보는 확인하는 값이라 접고, 기간 선택은 상태 줄 오른쪽 끝에 둔다. 새로고침은 서버 머리말 하나다.
        collapsed={!standalone}
        statusAside={standalone ? undefined : rangePicker}
      />
      {standalone && (
        <div className="flex flex-wrap items-center gap-2">
          {rangePicker}
          <Button collapseLabel variant="secondary" onClick={() => setRefreshKey((value) => value + 1)}><MaterialIcon name="refresh" />새로고침</Button>
        </div>
      )}
      <DirectServiceMetricsTab
        observedServiceId={service.id}
        state={metricHealth}
        refreshKey={reloadKey}
        range={range}
        active={service.isActive}
        noun={standalone ? undefined : '앱'}
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
