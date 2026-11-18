import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, MaterialIcon, TimeRangePicker, parseTimeRange, type GlobalTimeRange } from '../../../components/common';
import { useBreadcrumb } from '../../../contexts/BreadcrumbContext';
import type { ObservedService } from '../../../services/api';
import { alertRulesPath } from '../../alerts/alertTarget';
import { DirectServiceLogsTab } from '../../healthcheck/components/AgentServiceLogsTab';
import { LogIngestLevels } from '../../logs/components/LogIngestLevels';
import { signalList } from '../signals';
import { useDirectServicePanel } from '../useDirectServicePanel';
import { DirectConnectionMeta } from './DirectConnectionMeta';

function ServiceCrumb({ name }: { name: string }) {
  useBreadcrumb([{ label: name }]);
  return null;
}

/** 직접 연결한 앱 하나의 로그 본문. 앱 이름이 패널의 제목이고 조작은 그 줄 오른쪽에 둔다. */
export function DirectLogsPanel({ serviceId, service: given, onRemoved, back, listLink, extraActions, onChanged, standalone = false, refreshToken = 0 }: {
  serviceId: string;
  /** 서버 상세가 이미 불러온 앱. 주면 따로 불러오지 않는다. */
  service?: ObservedService;
  /** 삭제나 로그 연결 해제가 끝난 뒤 */
  onRemoved: () => void;
  /** 불러오지 못했을 때 돌아갈 곳. 서버 탭에서는 label을 링크 문구 그대로 쓴다. */
  back: { label: string; to: string };
  /** 서버 탭: 패널 제목 위에 모든 폭에서 보이는 앱 목록 복귀 링크 */
  listLink?: ReactNode;
  /** 알림 규칙과 삭제 사이에 놓을 추가 조작(예: 다른 서버로 옮기기) */
  extraActions?: ReactNode;
  /** 연결 중지나 키 재발급으로 앱이 바뀐 뒤 */
  onChanged?: () => void | Promise<void>;
  /** 옛 로그 상세(/logs/:id)처럼 패널이 페이지 전체일 때: 제목이 h1이고 경로 표시와 새로고침을 패널이 갖는다. Task 13에서 없앤다. */
  standalone?: boolean;
  /** 화면의 새로고침을 누를 때마다 바뀐다. 바뀌면 로그를 다시 불러온다. */
  refreshToken?: number;
}) {
  const [searchParams] = useSearchParams();
  const [range, setRange] = useState<GlobalTimeRange>(() => parseTimeRange(searchParams.get('range')) ?? '6h');
  const [refreshKey, setRefreshKey] = useState(0);
  const { service, loading, error, reload, connection, removalButton, dialogs } = useDirectServicePanel(serviceId, 'logs', onRemoved, { service: given, onChanged, standalone });

  if (loading) return <div aria-busy="true" className="h-96 animate-pulse rounded-xl bg-ui-hover-soft" />;
  if (!service) {
    return (
      <EmptyState icon="error_outline" title="로그 앱을 불러오지 못했습니다" description={error ?? undefined} headingLevel={standalone ? 'h3' : 'h2'}>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reload}>다시 시도</Button>
          <ButtonLink variant="secondary" to={back.to}>{standalone ? `${back.label}로 돌아가기` : back.label}</ButtonLink>
        </div>
      </EmptyState>
    );
  }

  const Heading = standalone ? 'h1' : 'h2';
  const rangePicker = <TimeRangePicker value={range} onChange={setRange} />;

  return (
    <div className="space-y-5">
      {standalone && <ServiceCrumb name={service.name} />}
      {listLink}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading className={`min-w-0 wrap-anywhere text-text-base ${standalone ? 'type-page-title' : 'type-section-title'}`}>{service.name}</Heading>
        {/* 이동, 편집, 파괴 순서(DESIGN.md §4.1) */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: service.id })}><MaterialIcon name="notifications" />알림 규칙</ButtonLink>
          {extraActions}
          {removalButton}
        </div>
      </div>
      {/* 연결 중지는 DirectConnectionMeta가 상태 바로 옆에 둔다. */}
      <DirectConnectionMeta
        {...connection}
        detail={{ label: '수집 데이터', value: signalList(service.signals) }}
        extraFields={[{ label: '수집 레벨', value: <LogIngestLevels observedServiceId={service.id} /> }]}
        collapseOnMobile
        collapseLabel={standalone ? undefined : '연결 정보'}
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
      <DirectServiceLogsTab observedServiceId={service.id} refreshKey={refreshKey + refreshToken} range={range} traceId={searchParams.get('traceId') ?? undefined} />
      {dialogs}
    </div>
  );
}
