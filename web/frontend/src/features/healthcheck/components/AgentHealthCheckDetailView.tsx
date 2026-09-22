import { useBreadcrumb } from '../../../contexts/BreadcrumbContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, IconButton, MaterialIcon, StatusBadge, TimeRangePicker, type GlobalTimeRange } from '../../../components/common';
import { useSpinAction } from '../../../hooks/useSpinAction';
import { useIsMobile } from '../../../hooks/useMediaQuery';
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

// Internal: layouts receive the shared chart time range from the wrapper below.
interface LayoutProps extends AgentHealthCheckDetailViewProps {
  range: GlobalTimeRange;
  onRangeChange: (r: GlobalTimeRange) => void;
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
function ContainerMeta({ service }: { service: AgentServiceFlat }) {
  if (!service.image) return null;
  const uptime = formatUptime(service.startedAt);
  const restarts = service.restartCount ?? 0;
  return (
    <div className="flex items-center gap-2 mt-1.5 text-xs text-text-dim min-w-0">
      <span className="font-mono truncate">{service.image}</span>
      {restarts > 0 && (
        <>
          <span className="text-text-dim shrink-0">·</span>
          <span className={`shrink-0 ${restarts >= 3 ? 'text-status-warn' : ''}`}>
            재시작 {restarts}회
          </span>
        </>
      )}
      {uptime && (
        <>
          <span className="text-text-dim shrink-0">·</span>
          <span className="shrink-0">업타임 {uptime}</span>
        </>
      )}
    </div>
  );
}

function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);
  return <IconButton icon="refresh" label="새로고침" onClick={handleRefresh} iconClassName={spinning ? 'animate-spin' : ''} />;
}

function DesktopLayout(props: LayoutProps) {
  const navigate = useNavigate();
  const { service, agentId, serviceKey, refreshKey, onRefresh, range, onRangeChange, tab, onTabChange } = props;

  return (
    <>
      {/* ver2: breadcrumb (project / service) + status badge, range + refresh on the right */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-text-base truncate">{service.name}</h1>
          <StatusBadge healthy={service.healthy} />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(alertRulesPath({ kind: 'agent', agentId, serviceKey }))}><MaterialIcon size={16} name="notifications" />알림 규칙</Button>
            <TimeRangePicker value={range} onChange={onRangeChange} />
            <RefreshButton onRefresh={onRefresh} />
          </div>
        </div>
        <ContainerMeta service={service} />
      </div>
      <AgentServiceTabs
        key={serviceKey}
        service={service}
        agentId={agentId}
        serviceKey={serviceKey}
        refreshKey={refreshKey}
        range={range}
        showServiceName={false}
        tab={tab}
        traceId={props.traceId}
        onTabChange={onTabChange}
      />
    </>
  );
}

function MobileLayout(props: LayoutProps) {

  const navigate = useNavigate();
  const { service, agentId, serviceKey, refreshKey, onRefresh, range, onRangeChange, tab, onTabChange } = props;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/agents/${agentId}`)}
          className="flex items-center gap-1 text-text-muted active:opacity-60 transition-opacity cursor-pointer"
        >
          <MaterialIcon size={20} name="arrow_back" />
          <span className="text-sm">목록으로</span>
        </button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(alertRulesPath({ kind: 'agent', agentId, serviceKey }))}><MaterialIcon size={16} name="notifications" />알림 규칙</Button>
          <TimeRangePicker value={range} onChange={onRangeChange} />
          <RefreshButton onRefresh={onRefresh} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-text-muted">{service.agentName}</p>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="truncate text-xl font-bold text-text-base">{service.name}</h1>
          <StatusBadge healthy={service.healthy} />
        </div>
      </div>
      <ContainerMeta service={service} />
      <AgentServiceTabs key={serviceKey} service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} tab={tab} traceId={props.traceId} onTabChange={onTabChange} />
    </div>
  );
}

export function AgentHealthCheckDetailView(props: AgentHealthCheckDetailViewProps) {
  const isMobile = useIsMobile();
  // Shared chart range for all tabs; survives service switches (Tabs remount on key).
  const [range, setRange] = useState<GlobalTimeRange>('6h');
  // 탭(health/logs/metrics/…)은 위치가 아니라 하위 뷰이므로 trail에 넣지 않는다 —
  // 실제 담김 관계는 Docker 환경 › 에이전트 › 서비스다.
  useBreadcrumb([
    { label: props.service.agentName, to: `/agents/${props.agentId}` },
    { label: props.service.name },
  ]);
  const layoutProps: LayoutProps = { ...props, range, onRangeChange: setRange };
  return isMobile ? <MobileLayout {...layoutProps} /> : <DesktopLayout {...layoutProps} />;
}
