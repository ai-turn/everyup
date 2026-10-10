import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, MaterialIcon, PageHeader } from '../../components/common';
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
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  to: string;
  tone: 'warn' | 'error';
  icon: string;
  observedAt?: string;
  timeLabel?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  agents: 'Docker 환경',
  services: 'Docker 서비스 상태',
  monitors: '업타임 모니터',
  observed: '직접 연결 서비스',
  infrastructure: '인프라 리소스',
  timeline: '장애 이력',
};

export function OverviewPage() {
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [observedServices, setObservedServices] = useState<ObservedService[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureResource[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineIncident[]>([]);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
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
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  useAutoRefresh(() => void load(), 30_000);
  // 직접 누른 새로고침만 아이콘을 돌린다 — 30초 자동 갱신마다 버튼을 비활성으로 깜빡이지 않게 (상세 화면과 같은 방식).
  const { spinning, trigger: handleRefresh } = useSpinAction(load);

  const staleAgents = agents.filter((agent) => !isCollectorFresh(agent.lastSeenAt));
  const unhealthyServices = services.filter((service) => !service.healthy);
  const unhealthyMonitors = monitors.filter((monitor) => monitor.status === 'unhealthy');
  const directAwaitingData = observedServices.filter((service) => service.isActive && !service.lastSeenAt);
  const inactiveInfrastructure = infrastructure.filter((resource) => resource.isActive && !isCollectorFresh(resource.lastSeenAt));

  // 상태 소스가 하나라도 실패하면 "이상 없음"을 단정할 수 없다. 이력(timeline)만 실패한 경우는 현재 상태 판단과 무관하다.
  const statusUnknown = failedSources.some((source) => source !== 'timeline');

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [
      ...unhealthyServices.map((service) => ({
        id: `service-${service.agentId}-${service.key}`,
        title: service.name,
        detail: service.lastError || '상태 체크에 실패했습니다',
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
        detail: 'Docker Collector 데이터가 지연되었거나 끊겼습니다',
        to: `/agents/${agent.id}`,
        tone: 'warn' as const,
        icon: 'sensors_off',
        observedAt: agent.lastSeenAt,
        timeLabel: agent.lastSeenAt ? `마지막 수신 ${formatIncidentTime(agent.lastSeenAt)}` : '수신 기록 없음',
      })),
      ...directAwaitingData.map((service) => ({
        id: `observed-${service.id}`,
        title: service.name,
        detail: '직접 연결한 서비스에서 아직 데이터가 확인되지 않았습니다',
        to: `/logs/${service.id}`,
        tone: 'warn' as const,
        icon: 'schedule',
        observedAt: service.createdAt,
        timeLabel: `${formatIncidentTime(service.createdAt)} 연결`,
      })),
      ...inactiveInfrastructure.map((resource) => ({
        id: `infrastructure-${resource.id}`,
        title: resource.name,
        detail: '인프라 Collector 데이터가 지연되었거나 끊겼습니다',
        to: `/infrastructure/${resource.id}`,
        tone: 'warn' as const,
        icon: 'sensors_off',
        observedAt: resource.lastSeenAt,
        timeLabel: resource.lastSeenAt ? `마지막 수신 ${formatIncidentTime(resource.lastSeenAt)}` : '수신 기록 없음',
      })),
    ];
    // 서비스·모니터 목록을 못 불러왔어도 이력에 진행 중인 장애가 있으면 그것만큼은 확실한 이상이다.
    const listedPaths = new Set(items.map((item) => item.to.split('?')[0]));
    const unlistedActive = timeline.filter((episode) =>
      episode.active
      && failedSources.includes(episode.source === 'uptime' ? 'monitors' : 'services')
      && !listedPaths.has(episode.targetPath));
    items.push(...unlistedActive.map((episode) => ({
      id: `episode-${episode.source}-${episode.targetPath}`,
      title: episode.targetName,
      detail: episode.message || (episode.source === 'uptime' ? '업타임 체크 실패' : 'Docker 서비스 상태 이상'),
      to: episode.targetPath,
      tone: 'error' as const,
      icon: 'error_outline',
      observedAt: episode.startedAt,
    })));
    return items.sort((a, b) => {
      if (a.tone !== b.tone) return a.tone === 'error' ? -1 : 1;
      const observedDelta = Date.parse(b.observedAt ?? '') - Date.parse(a.observedAt ?? '');
      if (Number.isFinite(observedDelta) && observedDelta !== 0) return observedDelta;
      return a.id.localeCompare(b.id);
    });
  }, [directAwaitingData, failedSources, inactiveInfrastructure, staleAgents, timeline, unhealthyMonitors, unhealthyServices]);

  // 확인 필요 행에 "언제부터"를 붙이기 위해 진행 중인 에피소드를 대상 경로로 찾는다.
  const activeEpisodes = new Map(timeline.filter((episode) => episode.active).map((episode) => [episode.targetPath, episode]));

  // 백그라운드 탭에서도 장애가 보이도록 탭 제목에 장애 수를 붙인다.
  const errorCount = attention.filter((item) => item.tone === 'error').length;
  useEffect(() => {
    if (errorCount === 0) return;
    const previous = document.title;
    document.title = `(${errorCount}) 장애 · ${previous}`;
    return () => { document.title = previous; };
  }, [errorCount]);

  const totalTargets = agents.length + monitors.length + observedServices.length + infrastructure.length;

  // 첫 로드에만 스켈레톤을 보인다 — 대상이 0개인 상태에서 30초마다 다시 깜빡이지 않게.
  // 모양은 실제 배치(확인 필요 + 범위 카드, 그 아래 이력)를 따른다.
  if (!updatedAt) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader title="모니터링 개요" subtitle="수집 상태와 현재 이상을 먼저 확인하세요." />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="h-56 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
          <div className="h-56 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
        </div>
        <div className="h-48 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 연결 추가는 각 화면(Docker 환경·업타임·로그)의 일이다. 개요의 머리는 장애에 내준다. */}
      <PageHeader
        title="모니터링 개요"
        subtitle="수집 상태와 현재 이상을 먼저 확인하세요."
        meta={updatedAt && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-caption text-text-muted">
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 갱신 · 30초마다 자동 갱신
            </span>
            <Button variant="ghost" onClick={handleRefresh}>
              <MaterialIcon size={20} name="refresh" className={spinning ? 'animate-spin' : ''} />새로고침
            </Button>
          </div>
        )}
      />
      {/* 확인 필요 수가 바뀔 때만 읽힌다(텍스트가 같으면 다시 알리지 않는다). */}
      <p className="sr-only" aria-live="polite">
        {updatedAt && `확인 필요 ${attention.length}건${statusUnknown ? ', 일부 상태 확인 불가' : ''}`}
      </p>

      {failedSources.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" />
            <div>
              <p className="type-label text-text-base">일부 모니터링 정보를 불러오지 못했습니다</p>
              <p className="mt-0.5 type-body text-text-muted">
                불러오지 못한 영역: {failedSources.map((source) => SOURCE_LABELS[source] ?? source).join(', ')}. 이 영역은 정상 여부를 판단할 수 없습니다.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>다시 시도</Button>
        </section>
      )}

      {/* 조회 실패로 0건이 된 것을 "대상 없음"으로 오인해 온보딩을 띄우지 않는다. */}
      {totalTargets === 0 && !statusUnknown ? (
        <section className="rounded-xl border border-ui-border bg-bg-surface">
          <EmptyState
            icon="sensors"
            title="아직 모니터링 대상이 없습니다"
            description="Docker 환경, 업타임 모니터 또는 직접 OpenTelemetry 연결 중 하나를 선택해 시작하세요."
          >
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to="/environments?connect=docker">Docker 연결</ButtonLink>
              <ButtonLink variant="secondary" to="/uptime">업타임 모니터 추가</ButtonLink>
              <ButtonLink variant="secondary" to="/logs">OpenTelemetry 직접 연결</ButtonLink>
            </div>
          </EmptyState>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <article id="attention" className="scroll-mt-5 rounded-xl border border-ui-border bg-bg-surface">
              <div className="flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3.5">
                <div>
                  <h2 className="type-card-title text-text-base">현재 확인 필요</h2>
                  <p className="mt-0.5 type-body text-text-muted">장애를 먼저, 수집 지연을 그다음에 보여줍니다.</p>
                </div>
                <span className="text-sm tabular-nums text-text-muted" aria-label={`확인 필요 ${attention.length}건`}>{attention.length}</span>
              </div>
              {attention.length === 0 && statusUnknown ? (
                <div className="flex min-h-44 flex-col items-center justify-center p-5 text-center">
                  <MaterialIcon size={32} name="sync_problem" className="text-status-warn" />
                  <p className="mt-3 type-label text-text-base">일부 상태를 확인하지 못했습니다</p>
                  <p className="mt-2 type-body text-text-muted">불러온 영역에서는 이상이 없지만, 전체가 정상인지는 아직 알 수 없습니다.</p>
                </div>
              ) : attention.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center p-5 text-center">
                  <MaterialIcon size={32} name="check_circle" className="text-status-healthy" />
                  <p className="mt-3 type-label text-text-base">현재 확인이 필요한 이상이 없습니다</p>
                  <p className="mt-2 type-body text-text-muted">수집 연결과 서비스 상태 모두 정상입니다.</p>
                </div>
              ) : (
                <>
                <ul className="divide-y divide-ui-border-soft">
                  {(showAllAttention ? attention : attention.slice(0, 6)).map((item) => {
                    const episode = item.tone === 'error' ? activeEpisodes.get(item.to.split('?')[0]) : undefined;
                    return (
                    <li key={item.id}>
                      <Link to={item.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ui-hover-soft">
                        <MaterialIcon size={20} name={item.icon} className={`shrink-0 ${item.tone === 'error' ? 'text-status-error' : 'text-status-warn'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate type-label text-text-base">{item.title}</span>
                          <span className="mt-0.5 line-clamp-2 type-body text-text-muted">{episode?.message || item.detail}</span>
                        </span>
                        {episode ? (
                          <span className="shrink-0 text-right">
                            <span className="block type-caption text-text-muted">{formatIncidentTime(episode.startedAt)} 시작</span>
                            <span className="mt-0.5 block type-caption text-status-error">{formatDuration(episode.durationSec)} 경과</span>
                          </span>
                        ) : item.timeLabel && (
                          <span className="shrink-0 type-caption text-text-muted">{item.timeLabel}</span>
                        )}
                        <MaterialIcon size={20} name="chevron_right" className="shrink-0 text-text-dim" />
                      </Link>
                    </li>
                    );
                  })}
                </ul>
                {attention.length > 6 && <div className="border-t border-ui-border px-4 py-3"><Button variant="secondary" size="sm" onClick={() => setShowAllAttention((value) => !value)}>{showAllAttention ? '우선 항목만 보기' : `전체 ${attention.length}건 보기`}</Button></div>}
                </>
              )}
            </article>

            <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
              <h2 className="type-card-title text-text-base">모니터링 범위</h2>
              <p className="mt-0.5 type-body text-text-muted">연결 방식별로 수집 범위를 확인하세요.</p>
              <ul className="-mx-2 mt-3">
                {([
                  ['Docker 환경', agents.length, '/environments', 'agents'],
                  ['업타임 모니터', monitors.length, '/uptime', 'monitors'],
                  ['직접 연결 서비스', observedServices.length, '/logs', 'observed'],
                  ['인프라 리소스', infrastructure.length, '/infrastructure', 'infrastructure'],
                ] as const).map(([label, count, to, source]) => (
                  <li key={label}>
                    {failedSources.includes(source) ? (
                      <div className="flex min-h-10 items-center justify-between gap-3 px-2">
                        <span className="text-sm text-text-secondary">{label}</span>
                        <span className="text-sm text-text-muted" aria-label="확인 불가" title="불러오지 못했습니다">—</span>
                      </div>
                    ) : (
                      // 숫자만 링크였던 8px 타깃 대신 행 전체를 링크로 — 이름도 "Docker 환경 2"로 읽힌다.
                      <Link to={to} className="flex min-h-10 items-center justify-between gap-3 rounded-md px-2 transition-colors hover:bg-ui-hover-soft">
                        <span className="text-sm text-text-secondary">{label}</span>
                        <span className="text-sm tabular-nums text-action">{count}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <ButtonLink variant="ghost" size="sm" to="/projects" className="mt-3">
                Project로 대상 정리하기 <MaterialIcon size={20} name="arrow_forward" />
              </ButtonLink>
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
                <p className="mt-0.5 type-body text-text-muted">업타임 모니터와 Docker 서비스의 최근 7일 기록입니다.</p>
              </div>
              <span className="text-sm tabular-nums text-text-muted" aria-label={`최근 장애 ${timeline.length}건`}>{timeline.length}</span>
            </div>
            {timeline.length === 0 ? (
              <div className="flex min-h-32 flex-col items-center justify-center p-5 text-center">
                <p className="type-label text-text-base">최근 7일간 기록된 장애가 없습니다</p>
                <p className="mt-2 type-body text-text-muted">업타임 모니터와 Docker 서비스 모두 중단 없이 동작했습니다.</p>
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
                        <span className="block truncate type-label text-text-base">{episode.targetName}</span>
                        <span className="mt-0.5 block type-body text-text-muted">
                          {episode.message || (episode.source === 'uptime' ? '업타임 체크 실패' : 'Docker 서비스 상태 이상')}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block type-caption text-text-muted">{formatIncidentTime(episode.startedAt)} 시작</span>
                        <span className={`mt-0.5 block type-caption ${episode.active ? 'text-status-error' : 'text-text-dim'}`}>
                          {formatDuration(episode.durationSec)}{episode.active ? ' 경과' : ' 지속'}
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
