import { useBreadcrumb } from '../../../contexts/BreadcrumbContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, DetailActionToolbar, DetailMeta, MaterialIcon, PageHeader, StatusBadge, TimeRangePicker, type DetailMetaField, type GlobalTimeRange } from '../../../components/common';
import { useSpinAction } from '../../../hooks/useSpinAction';
import type { AgentServiceFlat } from '../../../services/api';
import { AgentServiceTabs, type DetailTab } from './AgentServiceTabs';
import { alertRulesPath } from '../../alerts/alertTarget';

export interface AgentHealthCheckDetailViewProps {
  service: AgentServiceFlat;
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  onRefresh: () => void;
  tab: DetailTab;
  traceId?: string;
  onTabChange: (tab: DetailTab) => void;
}

// Container uptime from an ISO start time; null when absent or the zero stamp.
function formatUptime(startedAt?: string): string | null {
  if (!startedAt) return null;
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${mins}분`;
  return `${mins}분`;
}

// Container provenance line (image · restarts · uptime). Non-container services
// have no image → renders nothing. A restart count ≥3 is highlighted as a
// possible crash/restart loop.
function containerFields(service: AgentServiceFlat): DetailMetaField[] {
  if (!service.image) return [];
  const uptime = formatUptime(service.startedAt);
  const restarts = service.restartCount ?? 0;
  return [
    { label: 'Image', value: <span className="truncate font-mono">{service.image}</span> },
    ...(uptime ? [{ label: 'Uptime', value: uptime }] : []),
    ...(restarts > 0
      ? [{ label: 'Restarts', value: <span className={restarts >= 3 ? 'text-status-warn' : ''}>{restarts}회</span> }]
      : []),
  ];
}

export function AgentHealthCheckDetailView(props: AgentHealthCheckDetailViewProps) {
  const { service, agentId, serviceKey } = props;
  // Shared chart range for all tabs; survives service switches (Tabs remount on key).
  const [range, setRange] = useState<GlobalTimeRange>('6h');
  const { spinning, trigger: handleRefresh } = useSpinAction(props.onRefresh);
  // 탭(health/logs/metrics/…)은 위치가 아니라 하위 뷰이므로 trail에 넣지 않는다 —
  // 실제 담김 관계는 Docker 환경 › 에이전트 › 서비스다.
  useBreadcrumb([
    { label: service.agentName, to: `/agents/${agentId}` },
    { label: service.name },
  ]);

  return (
    <>
      {/* 데스크톱은 AppHeader breadcrumb가 이 역할을 한다 (DESIGN.md §3.4) */}
      <Link to={`/agents/${agentId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary lg:hidden">
        <MaterialIcon size={20} name="arrow_back" />{service.agentName}
      </Link>
      <PageHeader
        title={service.name}
        meta={
          <DetailMeta status={<StatusBadge healthy={service.healthy} />} fields={containerFields(service)} />
        }
      />
      <DetailActionToolbar
        controls={
          <>
            <TimeRangePicker value={range} onChange={setRange} />
            <Button collapseLabel variant="secondary" onClick={handleRefresh}>
              <MaterialIcon name="refresh" className={spinning ? 'animate-spin' : ''} />새로고침
            </Button>
          </>
        }
        actions={
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'agent', agentId, serviceKey })}>
            <MaterialIcon name="notifications" />알림 규칙
          </ButtonLink>
        }
      />
      <AgentServiceTabs
        key={serviceKey}
        service={service}
        agentId={agentId}
        serviceKey={serviceKey}
        refreshKey={props.refreshKey}
        range={range}
        tab={props.tab}
        traceId={props.traceId}
        onTabChange={props.onTabChange}
      />
    </>
  );
}
