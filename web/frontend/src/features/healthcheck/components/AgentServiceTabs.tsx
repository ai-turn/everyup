import { useState } from 'react';
import { type GlobalTimeRange } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';
import { AgentIdentity } from './AgentIdentity';
import { AgentUptimeOverview } from './AgentUptimeOverview';
import { AgentResponseTimeChart } from './AgentResponseTimeChart';
import { AgentFailureHistory } from './AgentFailureHistory';
import { AgentServiceLogsTab } from './AgentServiceLogsTab';
import { AgentServiceRequestsTab } from './AgentServiceRequestsTab';
import { AgentServiceTracesTab } from './AgentServiceTracesTab';
import { AgentServiceMetricsTab } from './AgentServiceMetricsTab';
import { AgentServiceInfraTab } from './AgentServiceInfraTab';
import { ServiceIncidentBanner } from './ServiceIncidentBanner';

export interface ServiceTabsProps {
  service: AgentServiceFlat;
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  /** Shared chart time range picked in the page header. */
  range: GlobalTimeRange;
  traceId?: string;
}

export type DetailTab = 'overview' | 'uptime' | 'logs' | 'requests' | 'traces' | 'metrics' | 'infra';

const TABS: { key: DetailTab; labelKo: string }[] = [
  { key: 'overview', labelKo: '개요' },
  { key: 'uptime',   labelKo: '업타임' },
  { key: 'logs',     labelKo: '로그' },
  { key: 'requests', labelKo: 'API 요청' },
  { key: 'traces',   labelKo: '트레이스' },
  { key: 'metrics',  labelKo: '메트릭' },
  { key: 'infra',    labelKo: '인프라' },
];

function TabBar({ active, onChange, serviceKey }: { active: DetailTab; onChange: (t: DetailTab) => void; serviceKey: string }) {
  return (
    <div role="tablist" aria-label="서비스 데이터" className="mb-6 flex gap-1 overflow-x-auto border-b border-ui-border">
      {TABS.map(tab => {
        const selected = active === tab.key;
        const tabId = `service-tab-${serviceKey}-${tab.key}`;
        return (
        <button
          key={tab.key}
          id={tabId}
          type="button"
          role="tab"
          aria-selected={selected}
          aria-controls={`service-panel-${serviceKey}-${tab.key}`}
          onClick={() => onChange(tab.key)}
          className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            selected
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          {tab.labelKo}
        </button>
        );
      })}
    </div>
  );
}

function OverviewContent({ service }: Pick<ServiceTabsProps, 'service'>) {
  return <AgentIdentity service={service} />;
}

function UptimeContent({ service, agentId, serviceKey, refreshKey, range }: ServiceTabsProps) {
  return (
    <>
      <AgentIdentity service={service} />
      <AgentUptimeOverview agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
      <AgentResponseTimeChart agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />
      <AgentFailureHistory agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </>
  );
}

function TabContent({ tab, service, agentId, serviceKey, refreshKey, range, traceId }: { tab: DetailTab } & ServiceTabsProps) {
  if (tab === 'overview') return <OverviewContent service={service} />;
  if (tab === 'logs')     return <AgentServiceLogsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} traceId={traceId} />;
  if (tab === 'requests') return <AgentServiceRequestsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} traceId={traceId} runtime={service.runtime} />;
  if (tab === 'traces')   return <AgentServiceTracesTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
  if (tab === 'metrics')  return <AgentServiceMetricsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
  if (tab === 'infra')    return <AgentServiceInfraTab agentId={agentId} refreshKey={refreshKey} range={range} />;
  return <UptimeContent service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
}

// Tab bar + content for a single agent service. Reused by the full-page service
// detail and the project master-detail view. Resets to the overview tab when the
// selected service changes (key={serviceKey} at the call site).
export function AgentServiceTabs({ initialTab = 'overview', tab, onTabChange, ...props }: ServiceTabsProps & {
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
  return (
    <>
      <ServiceIncidentBanner service={props.service} onInvestigate={() => changeTab('logs')} />
      <TabBar active={activeTab} onChange={changeTab} serviceKey={props.serviceKey} />
      <div role="tabpanel" id={`service-panel-${props.serviceKey}-${activeTab}`} aria-labelledby={`service-tab-${props.serviceKey}-${activeTab}`}>
        <TabContent tab={activeTab} {...props} />
      </div>
    </>
  );
}
