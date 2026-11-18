import { Tooltip } from '../../components/common/Tooltip';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { serverPath } from '../../features/servers/serverPaths';

const OverviewPrototype = import.meta.env.DEV ? lazy(() => import('./Overview.prototype').then((module) => ({ default: module.OverviewPrototype }))) : null;

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
  const [prototypeParams] = useSearchParams();
  const prototypeVariant = import.meta.env.DEV ? prototypeParams.get('variant') : null;
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [observedServices, setObservedServices] = useState<ObservedService[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureResource[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineIncident[]>([]);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pendingLoad = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    // 두 재시도 버튼과 수동·자동 갱신이 겹쳐도 같은 조회가 끝나기를 기다린다.
    if (pendingLoad.current) return pendingLoad.current;
    pendingLoad.current = (async () => {
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
    })().finally(() => { pendingLoad.current = null; });
    return pendingLoad.current;
  }, []);

  const retry = async () => {
    setRetrying(true);
    try {
      await load();
    } finally {
      setRetrying(false);
    }
  };

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
  const timelineFailed = failedSources.includes('timeline');

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
        to: serverPath(monitor.serverId, 'uptime', monitor.id),
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
  // 모양은 실제 배치(범위 스트립, 그 아래 확인 필요·이력 패널)를 따른다.
  if (!updatedAt) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader menu title="개요" />
        <div className="h-8 w-96 max-w-full animate-pulse rounded-md bg-ui-hover-soft" />
        <div className="h-80 animate-pulse rounded-lg bg-ui-hover-soft" />
      </div>
    );
  }

  if (OverviewPrototype && prototypeVariant && ['A', 'B', 'C'].includes(prototypeVariant)) {
    return <Suspense fallback={<p className="p-6 text-text-muted">설계안을 불러오는 중</p>}><OverviewPrototype variant={prototypeVariant} attention={attention} timeline={timeline} agents={agents} services={services} monitors={monitors} observed={observedServices} infrastructure={infrastructure} failedSources={failedSources} updatedAt={updatedAt} onRefresh={handleRefresh} /></Suspense>;
  }

  return (
    <div className={`space-y-5 ${prototypeVariant ? 'pb-36' : ''}`}>
      {/* 연결 추가는 각 화면(Docker 환경·업타임·로그)의 일이다. 개요의 머리는 장애에 내준다. */}
      <PageHeader menu
        title="개요"
        meta={updatedAt && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-caption text-text-muted">
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 갱신 · 30초마다 자동 갱신
            </span>
            <Button collapseLabel onClick={handleRefresh}>
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
        <section className="flex flex-col gap-3 rounded-xl border border-ui-border-soft bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" />
            <div>
              <p className="type-label text-text-base">일부 모니터링 정보를 불러오지 못했습니다</p>
              <p className="mt-0.5 type-body text-text-muted">
                불러오지 못한 영역: {failedSources.map((source) => SOURCE_LABELS[source] ?? source).join(', ')}. 이 영역은 정상 여부를 판단할 수 없습니다.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="min-w-28" loading={retrying} onClick={() => void retry()}>다시 시도</Button>
        </section>
      )}

      {/* 조회 실패로 0건이 된 것을 "대상 없음"으로 오인해 온보딩을 띄우지 않는다. */}
      {totalTargets === 0 && !statusUnknown ? (
        <section>
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
          {/* 모니터링 범위 — 카드 대신 한 줄. 숫자보다 "무엇을 보고 있나"를 한눈에 주는 자리라 크게 키우지 않는다.
              글자만 늘어서면 문장처럼 읽혀서 사이드바·그룹 목록과 같은 아이콘을 앞에 붙였다. */}
          {/* 범위 줄은 아래 목록과 성격이 달라서(전체 규모 vs 지금 볼 것) 그룹 사이 선과 같은 옅은 선으로 끊는다.
              선을 nav가 아니라 감싼 div에 긋는 것은 nav의 -mx-2 때문에 선이 본문보다 양쪽으로 8px 삐져나오기 때문이다. */}
          <div className="border-b border-ui-border-soft pb-4">
          <nav aria-label="모니터링 범위" className="-mx-2 flex flex-wrap items-center gap-x-1 gap-y-1">
            {([
              ['Docker 환경', agents.length, '/environments', 'agents', 'dns'],
              ['업타임 모니터', monitors.length, '/uptime', 'monitors', 'monitor_heart'],
              ['직접 연결 서비스', observedServices.length, '/logs', 'observed', 'hub'],
              ['인프라 리소스', infrastructure.length, '/infrastructure', 'infrastructure', 'memory'],
            ] as const).map(([label, count, to, source, icon]) => (
              failedSources.includes(source) ? (
                <span key={label} className="inline-flex h-8 items-center gap-1.5 px-2">
                  <MaterialIcon name={icon} size={20} className="text-text-dim" />
                  <span className="type-body text-text-muted">{label}</span>
                  <Tooltip content="불러오지 못했습니다" focusable><span className="type-label text-text-muted" aria-label="확인 불가">-</span></Tooltip>
                </span>
              ) : (
                <Link key={label} to={to} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-ui-hover">
                  <MaterialIcon name={icon} size={20} className="text-text-dim" />
                  <span className="type-body text-text-muted">{label}</span>
                  <span className="type-label tabular-nums text-text-base">{count}</span>
                </Link>
              )
            ))}
            <Link to="/projects" className="ml-auto inline-flex h-8 items-center px-2 type-body text-action link-underline">
              그룹으로 정리
            </Link>
          </nav>
          </div>

          {/* Linear식 목록: 카드·행 구분선·배경 띠 없이 그룹 제목과 간격으로 나누고, 두 그룹 사이에만 옅은 선을 둔다. 행은 Triage 인박스처럼 두 줄. */}
          <div className="section-stack">
            <section id="attention" aria-label="현재 확인 필요" className="scroll-mt-5">
              <GroupHeader title="현재 확인 필요" count={attention.length} countLabel={`확인 필요 ${attention.length}건`} />
              {attention.length === 0 ? (
                <div className="flex items-center gap-3 py-3">
                  <MaterialIcon name={statusUnknown ? 'sync_problem' : 'check_circle'} className={statusUnknown ? 'text-status-warn' : 'text-status-healthy'} />
                  <p className="type-body text-text-muted">
                    {statusUnknown ? '불러온 영역에서는 이상이 없지만, 전체가 정상인지는 아직 알 수 없습니다.' : '현재 확인이 필요한 이상이 없습니다'}
                  </p>
                </div>
              ) : (
                <ul className="-mx-3 mt-1">
                  {(showAllAttention ? attention : attention.slice(0, 6)).map((item) => {
                    const episode = item.tone === 'error' ? activeEpisodes.get(item.to.split('?')[0]) : undefined;
                    return (
                      <li key={item.id}>
                        <ListRow
                          to={item.to}
                          marker={<MaterialIcon name={item.icon} className={item.tone === 'error' ? 'text-status-error' : 'text-status-warn'} />}
                          title={item.title}
                          detail={episode?.message || item.detail}
                          start={episode && formatIncidentTime(episode.startedAt)}
                          duration={episode ? <span className="text-status-error">{formatDuration(episode.durationSec)} 경과</span> : item.timeLabel}
                        />
                      </li>
                    );
                  })}
                  {attention.length > 6 && (
                    <li className="py-1">
                      <Button variant="ghost" size="sm" aria-expanded={showAllAttention} onClick={() => setShowAllAttention((value) => !value)}><MaterialIcon name={showAllAttention ? 'expand_less' : 'expand_more'} />{showAllAttention ? '우선 항목만 보기' : `전체 ${attention.length}건 보기`}</Button>
                    </li>
                  )}
                </ul>
              )}
            </section>

            {/* 최근 장애 이력 — 위가 지금을 말한다면 이쪽은 시간축이다.
                "지금 문제 없음"과 "닷새째 조용함"은 다른 정보고, 신뢰를 주는 건 후자다.
                직접 연결 서비스는 이력 테이블이 없어 범위를 헤더에 밝힌다(안 밝히면 "전부 조용하다"로 오독된다). */}
            <section aria-label="최근 장애 이력">
              <GroupHeader
                title="최근 장애 이력"
                count={timelineFailed ? undefined : timeline.length}
                countLabel={timelineFailed ? '최근 장애 확인 불가' : `최근 장애 ${timeline.length}건`}
                note="업타임 모니터·Docker 서비스, 최근 7일"
              />
              {timelineFailed && (
                <div role="status" className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <MaterialIcon name="sync_problem" className="shrink-0 text-status-warn" />
                    <p className="type-body text-text-muted">
                      <span className="type-label text-text-base">장애 이력을 불러오지 못했습니다</span>{' '}
                      {timeline.length > 0 ? '이전에 불러온 기록입니다. 최신 기록은 확인할 수 없습니다.' : '최근 7일간의 장애 기록을 확인할 수 없습니다.'}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" className="min-w-28" loading={retrying} onClick={() => void retry()}>다시 시도</Button>
                </div>
              )}
              {timeline.length === 0 ? (
                !timelineFailed && <p className="py-3 type-body text-text-muted">최근 7일간 기록된 장애가 없습니다</p>
              ) : (
                <ul className="-mx-3 mt-1">
                  {timeline.map((episode) => (
                    <li key={`${episode.source}-${episode.targetPath}-${episode.startedAt}`}>
                      <ListRow
                        to={episode.targetPath}
                        marker={<span className={`h-2 w-2 rounded-full ${episode.active ? 'bg-status-error-fill animate-pulse' : 'bg-status-idle-fill'}`} aria-hidden="true" />}
                        title={episode.targetName}
                        detail={episode.message || (episode.source === 'uptime' ? '업타임 체크 실패' : 'Docker 서비스 상태 이상')}
                        start={formatIncidentTime(episode.startedAt)}
                        duration={episode.active
                          ? <span className="text-status-error">{formatDuration(episode.durationSec)} 경과</span>
                          : `${formatDuration(episode.durationSec)} 지속`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function GroupHeader({ title, count, countLabel, note }: { title: string; count?: number; countLabel: string; note?: string }) {
  return (
    <div className="flex h-8 items-center gap-2">
      {/* 섹션 제목이다(section-stack 선으로 나뉜다) — 그룹 제목용 12px이면 아래 행 이름(14px)보다 작아 위계가 뒤집혔다. */}
      <h2 className="type-card-title text-text-base">{title}</h2>
      {/* span의 aria-label은 대부분의 스크린리더가 읽지 않는다 — 숫자는 감추고 같은 뜻을 글로 둔다. */}
      <span className="type-body tabular-nums text-text-muted"><span aria-hidden="true">{count ?? '-'}</span><span className="sr-only">{countLabel}</span></span>
      {note && <span className="ml-auto min-w-0 truncate type-caption text-text-muted">{note}</span>}
    </div>
  );
}

// Triage식 두 줄 행: 윗줄은 대상과 시작 시각, 아랫줄은 원인과 경과. 선 없이 hover 배경으로만 행을 드러낸다.
// 시작 시각이 없는 항목(수집 지연 등)은 timeLabel 하나를 윗줄 오른쪽에 둔다.
function ListRow({ to, marker, title, detail, start, duration }: {
  to: string;
  marker: ReactNode;
  title: string;
  detail: string;
  start?: string;
  duration?: ReactNode;
}) {
  return (
    <Link to={to} className="flex gap-3 rounded-md px-3 py-2 transition-colors hover:bg-ui-hover-soft">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{marker}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 truncate type-label text-text-base">{title}</span>
          <span className="ml-auto shrink-0 whitespace-nowrap type-caption tabular-nums text-text-muted">{start ?? duration}</span>
        </span>
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 truncate type-body text-text-muted">{detail}</span>
          {start && <span className="ml-auto shrink-0 whitespace-nowrap type-caption tabular-nums text-text-muted">{duration}</span>}
        </span>
      </span>
    </Link>
  );
}
