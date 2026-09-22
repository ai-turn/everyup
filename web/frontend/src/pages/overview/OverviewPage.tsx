import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, EmptyState, MaterialIcon, PageHeader } from '../../components/common';
import {
  api,
  type AgentServiceFlat,
  type ConnectedAgent,
  type InfrastructureResource,
  type ObservedService,
  type TimelineIncident,
  type UptimeMonitor,
} from '../../services/api';
import { isCollectorFresh } from '../../utils/operationalStatus';
import { formatDuration, formatIncidentTime } from '../../utils/incidentFormat';

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  to: string;
  tone: 'warn' | 'error';
  icon: string;
  observedAt?: string;
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [observedServices, setObservedServices] = useState<ObservedService[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineIncident[]>([]);
  const [showAllAttention, setShowAllAttention] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [agentsResult, servicesResult, monitorsResult, observedResult, infrastructureResult, timelineResult] = await Promise.allSettled([
      api.getAgents(),
      api.getAllAgentServicesFlat(),
      api.getUptimeMonitors(),
      api.getObservedServices(),
      api.getInfrastructureResources(),
      api.getIncidentTimeline(7, 6),
    ]);
    const failed: string[] = [];
    if (agentsResult.status === 'fulfilled') setAgents(agentsResult.value ?? []); else failed.push('agents');
    if (servicesResult.status === 'fulfilled') setServices(servicesResult.value ?? []); else failed.push('services');
    if (monitorsResult.status === 'fulfilled') setMonitors(monitorsResult.value ?? []); else failed.push('monitors');
    if (observedResult.status === 'fulfilled') setObservedServices(observedResult.value ?? []); else failed.push('observed');
    if (infrastructureResult.status === 'fulfilled') setInfrastructure(infrastructureResult.value ?? []); else failed.push('infrastructure');
    if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value ?? []); else failed.push('timeline');
    setFailedSources(failed);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const intervalId = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(intervalId);
    };
  }, [load]);

  const staleAgents = agents.filter((agent) => !isCollectorFresh(agent.lastSeenAt));
  const unhealthyServices = services.filter((service) => !service.healthy);
  const unhealthyMonitors = monitors.filter((monitor) => monitor.status === 'unhealthy');
  const directAwaitingData = observedServices.filter((service) => service.isActive && !service.lastSeenAt);
  const inactiveInfrastructure = infrastructure.filter((resource) => resource.isActive && !isCollectorFresh(resource.lastSeenAt));

  const attention = useMemo<AttentionItem[]>(() => ([
    ...unhealthyServices.map((service) => ({
      id: `service-${service.agentId}-${service.key}`,
      title: service.name,
      detail: '장애가 발생했습니다',
      to: `/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=uptime`,
      tone: 'error' as const,
      icon: 'error_outline',
      observedAt: service.observedAt,
    })),
    ...unhealthyMonitors.map((monitor) => ({
      id: `monitor-${monitor.id}`,
      title: monitor.name,
      detail: '업타임 모니터가 장애를 보고했습니다',
      to: `/uptime/${monitor.id}`,
      tone: 'error' as const,
      icon: 'error_outline',
      observedAt: monitor.lastCheckAt,
    })),
    ...staleAgents.map((agent) => ({
      id: `agent-${agent.id}`,
      title: agent.name,
      detail: 'Docker 수집기 데이터가 지연되었거나 끊겼습니다',
      to: `/agents/${agent.id}`,
      tone: 'warn' as const,
      icon: 'sensors_off',
      observedAt: agent.lastSeenAt,
    })),
    ...directAwaitingData.map((service) => ({
      id: `observed-${service.id}`,
      title: service.name,
      detail: '직접 연결한 서비스에서 아직 데이터가 확인되지 않았습니다',
      to: `/logs/${service.id}`,
      tone: 'warn' as const,
      icon: 'schedule',
      observedAt: service.createdAt,
    })),
    ...inactiveInfrastructure.map((resource) => ({
      id: `infrastructure-${resource.id}`,
      title: resource.name,
      detail: '인프라 Collector 데이터가 지연되었거나 끊겼습니다',
      to: `/infrastructure/${resource.id}`,
      tone: 'warn' as const,
      icon: 'sensors_off',
      observedAt: resource.lastSeenAt,
    })),
  ]).sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === 'error' ? -1 : 1;
    const observedDelta = Date.parse(b.observedAt ?? '') - Date.parse(a.observedAt ?? '');
    if (Number.isFinite(observedDelta) && observedDelta !== 0) return observedDelta;
    return a.id.localeCompare(b.id);
  }), [directAwaitingData, inactiveInfrastructure, staleAgents, unhealthyMonitors, unhealthyServices]);

  const totalTargets = agents.length + monitors.length + observedServices.length + infrastructure.length;

  if (loading && totalTargets === 0) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="모니터링 개요" subtitle="수집 상태와 현재 이상을 먼저 확인하세요.">
        <Button onClick={() => navigate('/environments')}>
          <MaterialIcon size={20} name="add" />
          모니터링 시작
        </Button>
      </PageHeader>

      {failedSources.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" />
            <div>
              <p className="text-sm font-medium text-text-base">일부 모니터링 정보를 불러오지 못했습니다</p>
              <p className="mt-0.5 type-body text-text-muted">성공한 영역은 계속 표시합니다. 다시 시도해 최신 상태를 확인하세요.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>다시 시도</Button>
        </section>
      )}

      {totalTargets === 0 ? (
        <section className="rounded-xl border border-ui-border bg-bg-surface">
          <EmptyState
            icon="sensors"
            title="아직 모니터링 대상이 없습니다"
            description="Docker 환경, 업타임 모니터 또는 직접 OpenTelemetry 연결 중 하나를 선택해 시작하세요."
            action={{ label: '모니터링 시작', onClick: () => navigate('/environments') }}
          />
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <article id="attention" className="scroll-mt-5 rounded-xl border border-ui-border bg-bg-surface">
              <div className="flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3.5">
                <div>
                  <h2 className="type-card-title text-text-base">현재 확인 필요</h2>
                  <p className="mt-0.5 text-sm text-text-muted">서비스 상태와 수집 상태를 분리해 보여줍니다.</p>
                </div>
                <span className="font-mono text-sm tabular-nums text-text-muted">{attention.length}</span>
              </div>
              {attention.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center p-5 text-center">
                  <MaterialIcon size={32} name="check_circle" className="text-status-healthy" />
                  <p className="mt-3 text-sm font-medium text-text-base">현재 확인이 필요한 이상이 없습니다</p>
                  <p className="mt-1 type-body text-text-muted">수집 연결과 서비스 상태 모두 정상입니다.</p>
                </div>
              ) : (
                <>
                <ul className="divide-y divide-ui-border-soft">
                  {(showAllAttention ? attention : attention.slice(0, 6)).map((item) => (
                    <li key={item.id}>
                      <Link to={item.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ui-hover-soft">
                        <MaterialIcon size={20} name={item.icon} className={`shrink-0 ${item.tone === 'error' ? 'text-status-error' : 'text-status-warn'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-text-base">{item.title}</span>
                          <span className="mt-0.5 block type-body text-text-muted">{item.detail}</span>
                        </span>
                        <MaterialIcon size={20} name="chevron_right" className="shrink-0 text-text-dim" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {attention.length > 6 && <div className="border-t border-ui-border px-4 py-3"><Button variant="secondary" size="sm" onClick={() => setShowAllAttention((value) => !value)}>{showAllAttention ? '우선 항목만 보기' : `전체 ${attention.length}건 보기`}</Button></div>}
                </>
              )}
            </article>

            <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
              <h2 className="type-card-title text-text-base">모니터링 범위</h2>
              <p className="mt-1 text-sm text-text-muted">연결 방식별로 수집 범위를 확인하세요.</p>
              <dl className="mt-4 space-y-3">
                {[
                  ['Docker 환경', agents.length, '/environments'],
                  ['업타임 모니터', monitors.length, '/uptime'],
                  ['직접 연결 서비스', observedServices.length, '/logs'],
                  ['인프라 리소스', infrastructure.length, '/infrastructure'],
                ].map(([label, count, to]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3">
                    <dt className="text-sm text-text-secondary">{label}</dt>
                    <dd><Link to={String(to)} className="font-mono text-sm tabular-nums text-primary hover:underline">{count}</Link></dd>
                  </div>
                ))}
              </dl>
              <Link to="/projects" className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Project로 대상 정리하기 <MaterialIcon size={20} name="arrow_forward" />
              </Link>
            </article>
          </section>

          {/* 최근 장애 이력 — 위의 '현재 확인 필요'가 지금을 말한다면 이쪽은 시간축이다.
              "지금 문제 없음"과 "닷새째 조용함"은 다른 정보고, 신뢰를 주는 건 후자다. */}
          <section aria-label="최근 장애 이력" className="rounded-xl border border-ui-border bg-bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3.5">
              <div>
                <h2 className="type-card-title text-text-base">최근 장애 이력</h2>
                {/* 직접 연결 서비스는 이력 테이블이 없어 도출할 에피소드가 없다.
                    범위를 밝히지 않으면 "전부 조용하다"로 오독된다. */}
                <p className="mt-0.5 text-sm text-text-muted">업타임 모니터와 Docker 서비스의 최근 7일 기록입니다.</p>
              </div>
              <span className="font-mono text-sm tabular-nums text-text-muted">{timeline.length}</span>
            </div>
            {timeline.length === 0 ? (
              <div className="flex min-h-32 flex-col items-center justify-center p-5 text-center">
                <p className="text-sm font-medium text-text-base">최근 7일간 기록된 장애가 없습니다</p>
                <p className="mt-1 type-body text-text-muted">업타임 모니터와 Docker 서비스 모두 중단 없이 동작했습니다.</p>
              </div>
            ) : (
              <ul className="divide-y divide-ui-border-soft">
                {timeline.map((episode) => (
                  <li key={`${episode.source}-${episode.targetPath}-${episode.startedAt}`}>
                    <Link to={episode.targetPath} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ui-hover-soft">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${episode.active ? 'bg-status-error animate-pulse' : 'bg-status-idle'}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-base">{episode.targetName}</span>
                        <span className="mt-0.5 block type-body text-text-muted">
                          {episode.message || (episode.source === 'uptime' ? '업타임 체크 실패' : 'Docker 서비스 상태 이상')}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block type-caption text-text-muted">{formatIncidentTime(episode.startedAt)} 시작</span>
                        <span className={`mt-0.5 block type-caption ${episode.active ? 'text-status-error' : 'text-text-dim'}`}>
                          {formatDuration(episode.durationSec)}{episode.active ? ' 경과' : ''}
                        </span>
                      </span>
                      <MaterialIcon size={20} name="chevron_right" className="shrink-0 text-text-dim" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
