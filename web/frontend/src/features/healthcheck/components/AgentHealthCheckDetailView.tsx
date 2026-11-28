import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button, ButtonLink, MaterialIcon, type DetailMetaField, type GlobalTimeRange } from '../../../components/common';
import { TargetHeader } from '../../targets/TargetHeader';
import { LogIngestLevels } from '../../logs/components/LogIngestLevels';
import { DockerUptimeStatus } from '../../uptime/components/DockerUptimeStatus';
import type { AgentServiceFlat, ConnectedAgent } from '../../../services/api';
import { AgentServiceTabs, type DetailTab } from './AgentServiceTabs';
import { alertRulesPath } from '../../alerts/alertTarget';
import { runtimeLabel } from '../runtimeLabels';
import { serverPath } from '../../servers/serverPaths';
import { DOCKER_CAPABILITY_NAME } from '../../connections/connectCopy';

export interface AgentHealthCheckDetailViewProps {
  service: AgentServiceFlat;
  /** 이 컨테이너를 발견한 Docker Collector. 데이터는 이 ID로 조회한다. */
  agent: ConnectedAgent;
  /** 컨테이너가 속한 서버(ADR 0012). 크럼과 설정 가이드가 이 서버를 가리킨다. */
  serverId: string;
  serverName: string;
  /** 컨테이너 목록에서 열었으면 그 목록으로 돌아가는 링크. */
  back?: { label: string; to: string };
  serviceKey: string;
  refreshKey: number;
  onRefresh: () => void;
  refreshing?: boolean;
  updatedAt: Date | null;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
  tab: DetailTab;
  traceId?: string;
  /** Opening range when a link names one (`?range=`); the picker owns it after that. */
  initialRange?: GlobalTimeRange;
  onTabChange: (tab: DetailTab, source?: 'keyboard') => void;
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

// How the service is checked. These were body chips on a separate overview tab;
// target attributes live in the header band (DESIGN.md §4.1).
function checkFields(service: AgentServiceFlat): DetailMetaField[] {
  return [
    { label: 'Protocol', value: service.checkType.toUpperCase() },
    ...(service.runtime ? [{ label: 'Runtime', value: runtimeLabel(service.runtime) }] : []),
  ];
}

// Container provenance line (image · restarts · uptime). Non-container services
// have no image → renders nothing. A restart count ≥3 is highlighted as a
// possible crash/restart loop.
function containerFields(service: AgentServiceFlat): DetailMetaField[] {
  if (!service.image) return [];
  const uptime = formatUptime(service.startedAt);
  const restarts = service.restartCount ?? 0;
  return [
    { label: 'Image', value: <span className="wrap-anywhere font-mono">{service.image}</span> },
    ...(uptime ? [{ label: 'Uptime', value: uptime }] : []),
    ...(restarts > 0
      ? [{ label: 'Restarts', value: <span className={restarts >= 3 ? 'text-attn-text' : ''}>{restarts}회</span> }]
      : []),
  ];
}

// Docker Collector가 모으는 데이터 유형(수집 프로필). 프로필이 비어 있으면 모두 모은다(MonitoringSetupPanel과 같다).
const DOCKER_CAPABILITY_ORDER = ['uptime', 'logs', 'infrastructure', 'api', 'metrics'] as const;
function collected(agent: ConnectedAgent): string {
  const enabled = new Set<string>(agent.profile?.capabilities ?? []);
  return DOCKER_CAPABILITY_ORDER.filter((capability) => enabled.size === 0 || enabled.has(capability))
    .map((capability) => DOCKER_CAPABILITY_NAME[capability]).join('·');
}

export function AgentHealthCheckDetailView(props: AgentHealthCheckDetailViewProps) {
  const { service, agent, serverId, serviceKey } = props;
  const agentId = agent.id;
  // Shared chart range for all tabs; survives service switches (Tabs remount on key).
  const [range, setRange] = useState<GlobalTimeRange>(props.initialRange ?? '6h');
  const lastChecked = service.observedAt
    ? formatDistanceToNow(new Date(service.observedAt), { addSuffix: true, locale: ko })
    : '없음';
  // 탭(health/logs/metrics/…)은 위치가 아니라 하위 뷰이므로 크럼에 넣지 않는다. 담김 관계는 서버 › 컨테이너다(앱 페이지와 같다).
  const server = serverPath(serverId);
  const refresh = { updatedAt: props.updatedAt, onRefresh: props.onRefresh, refreshing: props.refreshing, autoRefresh: props.autoRefresh, onAutoRefreshChange: props.onAutoRefreshChange };

  return (
    <>
      <TargetHeader
        title={service.name}
        crumbs={[{ label: props.serverName, to: server }]}
        back={props.back}
        status={<>
          <DockerUptimeStatus service={service} />
          {service.lastLatency && <span>지연 시간 {service.lastLatency}</span>}
          <span>마지막 체크 {lastChecked}</span>
          {(service.restartCount ?? 0) >= 3 && <span className="text-attn-text sm:hidden">재시작 {service.restartCount}회</span>}
        </>}
        // 수집 방식은 서버 단위다: 기능을 더하거나 연결을 고치는 곳은 서버 개요의 설정 가이드다. 서버 이름은 크럼에 있으므로
        // 세부는 Docker Collector가 모으는 데이터 유형이다.
        connection={{ kind: 'docker', detail: collected(agent), action: { label: '설정 가이드', to: server } }}
        fieldsLabel="컨테이너 정보"
        fields={[...checkFields(service), ...containerFields(service), { label: '수집 레벨', value: <LogIngestLevels agentId={agentId} serviceKey={serviceKey} /> }]}
        // 주 조작은 제목 줄의 알림 규칙이다. 장애일 때만 에러 로그로 가는 조작을 더한다(이전에는 정상일 때 이유 없이 비활성이었다).
        actions={<>
          <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'agent', agentId, serviceKey })}>
            <MaterialIcon name="notifications" />알림 규칙
          </ButtonLink>
          {!service.healthy && <Button variant="secondary" onClick={() => props.onTabChange('logs')}>에러 확인</Button>}
        </>}
        range={range}
        onRangeChange={setRange}
        refresh={refresh}
      />
      <AgentServiceTabs
        key={`${agentId}/${serviceKey}`}
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
