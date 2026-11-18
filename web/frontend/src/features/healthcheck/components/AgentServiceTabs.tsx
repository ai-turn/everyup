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
  { key: 'uptime',   label: '업타임' },
  { key: 'logs',     label: '로그' },
  { key: 'requests', label: 'API 요청' },
  { key: 'traces',   label: '트레이스' },
  { key: 'metrics',  label: '메트릭' },
  { key: 'infra',    label: '인프라' },
];

function UptimeContent({ agentId, serviceKey, refreshKey, range }: ServiceTabsProps) {
  // 섹션 간격은 여기서 준다 — 카드 없이 간격으로 나누므로 §3.1의 space-y-8.
  return (
    <div className="space-y-8">
      <AgentUptimeOverview agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
      <AgentResponseTimeChart key={range} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />
      <AgentFailureHistory agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </div>
  );
}

function TabContent({ tab, service, agentId, serviceKey, refreshKey, range, traceId }: { tab: DetailTab } & ServiceTabsProps) {
  if (tab === 'logs')     return <AgentServiceLogsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} traceId={traceId} />;
  if (tab === 'requests') return <AgentServiceRequestsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} traceId={traceId} runtime={service.runtime} />;
  if (tab === 'traces')   return <AgentServiceTracesTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
  if (tab === 'metrics')  return <AgentServiceMetricsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
  if (tab === 'infra')    return <AgentServiceInfraTab agentId={agentId} refreshKey={refreshKey} range={range} />;
  return <UptimeContent service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
}

// Tab bar + content for a single agent service. Resets to the uptime tab when
// the selected service changes (key={serviceKey} at the call site).
export function AgentServiceTabs({ initialTab = 'uptime', tab, onTabChange, ...props }: ServiceTabsProps & {
  initialTab?: DetailTab;
  tab?: DetailTab;
  onTabChange?: (tab: DetailTab) => void;
}) {
  const [uncontrolledTab, setUncontrolledTab] = useState<DetailTab>(initialTab);
  const activeTab = tab ?? uncontrolledTab;
  const changeTab = (nextTab: DetailTab) => {
    onTabChange?.(nextTab);
    if (tab === undefined) setUncontrolledTab(nextTab);
  };
  const idPrefix = `service-${props.serviceKey}`;
  return (
    <>
      <div className="mb-6">
        <Tabs items={TABS} active={activeTab} onChange={changeTab} ariaLabel="서비스 데이터" idPrefix={idPrefix} />
      </div>
      <div role="tabpanel" id={tabPanelId(idPrefix, activeTab)} aria-labelledby={tabId(idPrefix, activeTab)}>
        <TabContent tab={activeTab} {...props} />
      </div>
    </>
  );
}
