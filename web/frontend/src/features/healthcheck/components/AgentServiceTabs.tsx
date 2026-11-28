import { useState } from 'react';
import { Tabs, tabId, tabPanelId, type GlobalTimeRange, type TabItem } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';
import { AgentUptimeOverview } from './AgentUptimeOverview';
import { AgentResponseTimeChart } from './AgentResponseTimeChart';
import { AgentFailureHistory } from './AgentFailureHistory';
import { AgentServiceLogsTab } from './AgentServiceLogsTab';
import { AgentServiceRequestsTab } from './AgentServiceRequestsTab';
import { AgentServiceTracesTab } from './AgentServiceTracesTab';
import { AgentServiceMetricsTab } from './AgentServiceMetricsTab';
import { AgentServiceInfraTab } from './AgentServiceInfraTab';
import { IncidentFigures, RecentContainerLogs } from './ContainerOverview';

export interface ServiceTabsProps {
  service: AgentServiceFlat;
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  /** Shared chart time range picked in the page header. */
  range: GlobalTimeRange;
  traceId?: string;
}

export type DetailTab = 'uptime' | 'logs' | 'requests' | 'traces' | 'metrics' | 'infra';

const TABS: TabItem<DetailTab>[] = [
  // 첫 탭은 컨테이너의 개요다(G안): 장애 수치 → 업타임 수치·응답 시간·90일 → 최근 로그 | 이벤트.
  { key: 'uptime',   label: '개요' },
  { key: 'logs',     label: '로그' },
  { key: 'requests', label: 'API 요청' },
  { key: 'traces',   label: '트레이스' },
  { key: 'metrics',  label: '메트릭' },
  { key: 'infra',    label: '인프라' },
];

function UptimeContent({ service, agentId, serviceKey, refreshKey, range, onOpenLogs }: ServiceTabsProps & { onOpenLogs: () => void }) {
  // 장애 수치(응답하지 않을 때만) → 모니터 상세와 같은 순서(수치 → 응답 추이 → 90일 띠) → 최근 로그 | 이벤트. 구역 간격은 section(§3.1).
  return (
    <div className="flex flex-col gap-section">
      <IncidentFigures service={service} refreshKey={refreshKey} />
      <AgentUptimeOverview agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey}>
        <AgentResponseTimeChart key={range} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />
      </AgentUptimeOverview>
      <div className="grid gap-x-10 gap-y-section xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <RecentContainerLogs agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} onOpenLogs={onOpenLogs} />
        <AgentFailureHistory agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
      </div>
    </div>
  );
}

function TabContent({ tab, service, agentId, serviceKey, refreshKey, range, traceId, onOpenLogs }: { tab: DetailTab; onOpenLogs: () => void } & ServiceTabsProps) {
  if (tab === 'logs')     return <AgentServiceLogsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} traceId={traceId} />;
  if (tab === 'requests') return <AgentServiceRequestsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} traceId={traceId} runtime={service.runtime} />;
  if (tab === 'traces')   return <AgentServiceTracesTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
  if (tab === 'metrics')  return <AgentServiceMetricsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
  if (tab === 'infra')    return <AgentServiceInfraTab agentId={agentId} refreshKey={refreshKey} range={range} />;
  return <UptimeContent service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} onOpenLogs={onOpenLogs} />;
}

// Tab bar + content for a single agent service. Resets to the uptime tab when
// the selected service changes (key={serviceKey} at the call site).
export function AgentServiceTabs({ initialTab = 'uptime', tab, onTabChange, ...props }: ServiceTabsProps & {
  initialTab?: DetailTab;
  tab?: DetailTab;
  /** source는 키보드(화살표, Home, End)로 바꾼 경우에만 'keyboard'다. */
  onTabChange?: (tab: DetailTab, source?: 'keyboard') => void;
}) {
  const [uncontrolledTab, setUncontrolledTab] = useState<DetailTab>(initialTab);
  const activeTab = tab ?? uncontrolledTab;
  const changeTab = (nextTab: DetailTab, source?: 'keyboard') => {
    onTabChange?.(nextTab, source);
    if (tab === undefined) setUncontrolledTab(nextTab);
  };
  const idPrefix = `service-${props.serviceKey}`;
  return (
    // 탭 → 패널 24px(group).
    <div className="page-stack">
      {/* Tabs는 포커스 링 자리로 -m-1을 가져 부모의 간격이 닿지 않는다. 한 겹 감싸 page-stack이 간격을 준다. */}
      <div className="min-w-0"><Tabs items={TABS} active={activeTab} onChange={changeTab} ariaLabel="컨테이너 데이터" idPrefix={idPrefix} /></div>
      <div role="tabpanel" id={tabPanelId(idPrefix, activeTab)} aria-labelledby={tabId(idPrefix, activeTab)}>
        <TabContent tab={activeTab} {...props} onOpenLogs={() => changeTab('logs')} />
      </div>
    </div>
  );
}
