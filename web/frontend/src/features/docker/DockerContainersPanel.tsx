import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, List, ListRow, ListViewToggle, ResourceCardHeader, ResourceTable, Section, Tooltip } from '../../components/common';
import { useListView } from '../../hooks/useListView';
import { api, type AgentEvent, type AgentIncident, type AgentServiceFlat, type OtelServiceMetric } from '../../services/api';
import { formatClock, formatDuration, formatIncidentTime } from '../../utils/incidentFormat';
import { AgentCheckHistoryBar } from '../healthcheck/components/AgentCheckHistoryBar';
import { DockerUptimeStatus } from '../uptime/components/DockerUptimeStatus';
import { containerPath } from './dockerPaths';

// Formats a representative metric value; OTel bytes ("By") as KB/MB/GB, else a rounded number with its unit appended.
function formatMetricValue(v: number, unit?: string): string {
  if (unit === 'By') {
    const abs = Math.abs(v);
    if (abs >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)}GB`;
    if (abs >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)}MB`;
    if (abs >= 1024) return `${(v / 1024).toFixed(1)}KB`;
    return `${Math.round(v)}B`;
  }
  const r = Math.round(v * 100) / 100;
  return unit && unit !== '1' ? `${r}${unit}` : String(r);
}

// Compact label from a dotted metric name, e.g. "jvm.memory.used" → "memory.used".
const metricLabel = (name: string) => name.split('.').slice(-2).join('.');

/** 컨테이너 하나의 카드. 상태·응답 시간·상태 코드는 목록 응답 그대로이고, 대표 지표는 그 컨테이너가 보낸 OTel 지표다. */
function ContainerCard({ serverId, service, metric, returnTo }: { serverId: string; service: AgentServiceFlat; metric?: OtelServiceMetric; returnTo: string }) {
  return (
    <Link to={containerPath(serverId, service.key)} state={{ returnTo }} aria-label={service.name}
      className="card-interactive group bg-bg-surface border border-ui-border-soft rounded-xl p-4 flex flex-col gap-heading">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{service.name}</h3>}
        subtitle={service.runtime ?? service.checkType}
        status={<DockerUptimeStatus service={service} />}
      />
      <div className="grid grid-cols-3 gap-3 type-control">
        <div className="min-w-0">
          <div className="type-caption text-text-dim">응답 시간</div>
          <div className="font-medium text-text-base truncate">{service.lastLatency ?? '-'}</div>
        </div>
        <div className="min-w-0">
          <div className="type-caption text-text-dim">상태</div>
          <div className={`${service.healthy ? 'text-status-healthy' : 'text-status-error'}`}>{service.lastStatus ?? '-'}</div>
        </div>
        {metric && (
          <div className="min-w-0">
            <Tooltip content={metric.metricName}><div className="type-caption text-text-dim truncate">{metricLabel(metric.metricName)}</div></Tooltip>
            <div className="font-medium text-text-base truncate">{formatMetricValue(metric.value, metric.unit)}</div>
          </div>
        )}
      </div>
      {!service.healthy && service.lastError && <p className="type-caption text-status-error truncate -mt-1">{service.lastError}</p>}
    </Link>
  );
}

/**
 * 서버의 컨테이너 탭(ADR 0012). 옛 Docker 환경 개요의 본문이다: 진행 중 장애, 컨테이너 목록, 90일 체크 기록, 장애 이력과 타임라인.
 * 장애 이력·타임라인·대표 지표는 부가 정보라 각자 실패해도 목록은 그대로다.
 */
export function DockerContainersPanel({ serverId, agentId, containers, refreshToken }: { serverId: string; agentId: string; containers: AgentServiceFlat[]; refreshToken: number }) {
  const { view, setView, returnTo } = useListView();
  const [incidents, setIncidents] = useState<AgentIncident[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [metrics, setMetrics] = useState<Record<string, OtelServiceMetric>>({});
  useEffect(() => {
    let alive = true;
    api.getAgentIncidents(agentId).then((rows) => { if (alive) setIncidents(rows ?? []); }, () => {});
    api.getAgentEvents(agentId, 8).then((rows) => { if (alive) setEvents(rows ?? []); }, () => {});
    api.getAgentServiceMetrics(agentId).then((rows) => { if (alive) setMetrics(Object.fromEntries((rows ?? []).map((m) => [m.serviceName, m]))); }, () => {});
    return () => { alive = false; };
  }, [agentId, refreshToken]);

  const active = incidents.filter((incident) => incident.active);
  const banner = active[0];
  const to = (key: string) => containerPath(serverId, key);

  return (
    <div className="space-y-section">
      {banner && (
        <Link to={to(banner.key)} className="w-full flex items-center gap-3 rounded-xl border border-ui-border-soft bg-bg-surface px-4 py-3 text-left hover:bg-ui-hover-soft transition-colors">
          <span className="h-2.5 w-2.5 rounded-full bg-status-error-fill animate-pulse shrink-0" />
          <span className="type-label text-text-base truncate">진행 중 장애: {banner.serviceName}</span>
          <span className="type-caption text-text-muted shrink-0">
            {formatDuration(banner.durationSec)} 경과{active.length > 1 && ` · +${active.length - 1}`}
          </span>
        </Link>
      )}

      <Section title="컨테이너" meta={`${containers.length}개`} actions={<ListViewToggle view={view} onChange={setView} />}>
        {containers.length === 0 ? (
          <EmptyState icon="inventory_2" title="발견된 컨테이너가 없습니다" />
        ) : view === 'grid' ? (
          <ResourceTable rows={containers} rowKey={(row) => row.key} ariaLabel="컨테이너 그리드" columns={[
            { key: 'state', label: '상태', className: 'w-24 sm:w-28', render: (row) => <DockerUptimeStatus service={row} /> },
            { key: 'name', label: '컨테이너', render: (row) => <>
              <Link to={to(row.key)} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link>
              <p className="mt-1 type-caption text-text-muted">{row.runtime || row.checkType}</p>
              <p className="mt-2 truncate font-mono text-xs text-text-muted md:hidden">{row.endpoint}</p>
              <p className="mt-1 type-caption text-text-muted md:hidden">응답 {row.lastLatency ?? '-'} · 상태 {row.lastStatus ?? '-'}</p>
            </> },
            { key: 'endpoint', label: '체크 주소', className: 'hidden lg:table-cell', render: (row) => <Tooltip content={row.endpoint} focusable><p className="truncate font-mono text-xs text-text-muted">{row.endpoint}</p></Tooltip> },
            { key: 'latency', label: '응답 시간', className: 'hidden w-28 md:table-cell', align: 'right', render: (row) => row.lastLatency ?? '-' },
            { key: 'status', label: '상태 코드', className: 'hidden w-24 md:table-cell', align: 'right', render: (row) => row.lastStatus ?? '-' },
            { key: 'metric', label: '메트릭', className: 'hidden w-40 xl:table-cell', render: (row) => metrics[row.name]
              ? <div className="space-y-intra"><Tooltip content={metrics[row.name].metricName} focusable><p className="truncate font-mono text-xs text-text-muted">{metricLabel(metrics[row.name].metricName)}</p></Tooltip><p>{formatMetricValue(metrics[row.name].value, metrics[row.name].unit)}</p></div>
              : '-' },
          ]} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {containers.map((service) => <ContainerCard key={service.key} serverId={serverId} service={service} metric={metrics[service.name]} returnTo={returnTo} />)}
          </div>
        )}
      </Section>

      {/* 90일 체크 기록은 낮고 넓은 막대라 폭 전체 한 줄이다. */}
      {containers.length > 0 && <AgentCheckHistoryBar agentId={agentId} />}

      {/* 장애 이력 | 타임라인: 카드 없이 제목과 간격으로 나눈 두 구역(DESIGN.md §3.1) */}
      {containers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <h3 className="mb-4 type-card-title text-text-base">장애 이력 · 30일</h3>
            {incidents.length === 0 ? (
              <p className="type-body text-text-muted py-4 text-center">최근 30일간 장애가 없습니다</p>
            ) : (
              <List>
                {incidents.slice(0, 5).map((incident) => (
                  <ListRow
                    key={`${incident.key}-${incident.startedAt}`}
                    to={to(incident.key)}
                    marker={<span className={`h-1.5 w-1.5 rounded-full ${incident.active ? 'bg-status-error-fill' : 'bg-status-healthy-fill'}`} />}
                    title={incident.serviceName}
                    detail={`${formatIncidentTime(incident.startedAt)} 시작 · ${formatDuration(incident.durationSec)}`}
                    detailSize="caption"
                    trailing={<span className={incident.active ? 'text-status-error' : 'text-status-healthy'}>{incident.active ? '진행중' : '해소'}</span>}
                  />
                ))}
              </List>
            )}
          </section>
          <section>
            <h3 className="mb-4 type-card-title text-text-base">타임라인</h3>
            {events.length === 0 ? (
              <p className="type-body text-text-muted py-4 text-center">최근 이벤트가 없습니다</p>
            ) : (
              <div className="space-y-intra">
                {events.map((event) => (
                  <div key={event.id} className="flex items-baseline gap-2 py-1.5">
                    <span className="type-caption text-text-dim w-10 shrink-0">{formatClock(event.time)}</span>
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 translate-y-px ${
                      event.type === 'alert_sent' ? 'bg-status-error-fill' : event.type === 'status_change' ? 'bg-status-warn-fill' : 'bg-status-idle-fill'
                    }`} />
                    <Tooltip content={event.message} focusable><span className="type-caption text-text-muted min-w-0 truncate">{event.message || event.type}</span></Tooltip>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
