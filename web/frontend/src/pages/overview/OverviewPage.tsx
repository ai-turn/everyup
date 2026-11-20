import { Tooltip } from '../../components/common/Tooltip';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, MaterialIcon, PageHeader, RefreshIconButton, SectionHeader } from '../../components/common';
import {
  api,
  type AgentServiceFlat,
  type ConnectedAgent,
  type InfrastructureResource,
  type TimelineIncident,
} from '../../services/api';
import { isCollectorFresh } from '../../utils/operationalStatus';
import { formatClock, formatDuration, formatIncidentTime } from '../../utils/incidentFormat';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import { ALL_LOGS_PATH, NEW_SERVER_PATH, SERVERS_PATH } from '../../features/servers/serverPaths';
import { useServers } from '../../features/servers/useServers';

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  to: string;
  tone: 'warn' | 'error';
  icon: string;
  observedAt?: string;
  timeLabel?: string;
  /** 확인 필요의 종류 순서: 0 수집이 끊겼거나 수신 전, 1 메트릭 임계값 초과, 2 리소스 사용률. */
  warnRank?: number;
}

/** 확인 필요 묶음에 먼저 보이는 수. 나머지는 그 자리에서 펼친다. */
const WARN_PREVIEW = 3;

const SOURCE_LABELS: Record<string, string> = {
  agents: 'Docker 환경',
  services: 'Docker 서비스 상태',
  infrastructure: 'Docker 인프라',
  timeline: '장애 이력',
};

// 문제가 있는 직접 대상의 아이콘. 장애는 종류와 관계없이 같은 표시다.
const ISSUE_ICON = { monitor: 'monitor_heart', infrastructure: 'memory', app: 'hub' } as const;

export function OverviewPage() {
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  // Docker 환경의 인프라 리소스. 직접 연결 리소스는 서버 행(useServers)이 판정한다.
  const [dockerInfrastructure, setDockerInfrastructure] = useState<InfrastructureResource[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineIncident[]>([]);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pendingLoad = useRef<Promise<void> | null>(null);
  // 서버와 직접 대상의 상태는 서버 목록과 같은 훅과 판정을 쓴다. 따로 계산하면 개요와 서버 목록이 어긋난다.
  // 오류 로그 수를 보여 주지 않으므로 로그 요약은 불러오지 않는다.
  const servers = useServers({ logSummary: false });
  const { poll, refresh: refreshServers } = servers;

  const load = useCallback(() => {
    // 두 재시도 버튼과 수동·자동 갱신이 겹쳐도 같은 조회가 끝나기를 기다린다.
    if (pendingLoad.current) return pendingLoad.current;
    pendingLoad.current = (async () => {
      const [agentsResult, servicesResult, infrastructureResult, timelineResult] = await Promise.allSettled([
        api.getAgents(),
        api.getAllAgentServicesFlat(),
        api.getInfrastructureResources(),
        api.getIncidentTimeline(7, 6),
      ]);
      const failed: string[] = [];
      if (agentsResult.status === 'fulfilled') setAgents(agentsResult.value ?? []); else failed.push('agents');
      if (servicesResult.status === 'fulfilled') setServices(servicesResult.value ?? []); else failed.push('services');
      if (infrastructureResult.status === 'fulfilled') setDockerInfrastructure((infrastructureResult.value ?? []).filter((resource) => resource.adapter === 'everyup-agent')); else failed.push('infrastructure');
      if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value ?? []); else failed.push('timeline');
      setFailedSources(failed);
      setUpdatedAt(new Date());
    })().finally(() => { pendingLoad.current = null; });
    return pendingLoad.current;
  }, []);
  const loadAll = useCallback(() => Promise.all([load(), refreshServers()]).then(() => undefined), [load, refreshServers]);

  const retry = async () => {
    setRetrying(true);
    try {
      await loadAll();
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  useAutoRefresh(() => { void load(); poll(); }, 30_000);
  // 직접 누른 새로고침만 아이콘을 돌린다 — 30초 자동 갱신마다 버튼을 비활성으로 깜빡이지 않게 (상세 화면과 같은 방식).
  const { spinning, trigger: handleRefresh } = useSpinAction(loadAll);

  const staleAgents = agents.filter((agent) => !isCollectorFresh(agent.lastSeenAt));
  const unhealthyServices = services.filter((service) => !service.healthy);
  // Docker 환경의 인프라는 그 환경과 ID와 수신 시각이 같다. 환경 항목이 이미 있으면 같은 곳으로 가는 두 번째 항목을 만들지 않는다.
  const staleDockerInfrastructure = dockerInfrastructure.filter((resource) =>
    resource.isActive && !isCollectorFresh(resource.lastSeenAt) && !staleAgents.some((agent) => agent.id === resource.id));
  // 서버 목록 자체나 대상 목록(업타임, 앱, 인프라, 메트릭 임계값)을 불러오지 못했다. 로그 요약은 불러오지 않는다.
  const serverFailures = [
    ...(servers.error ? ['서버'] : []),
    ...servers.failed.map((item) => item.label),
  ];
  const monitorsUnknown = Boolean(servers.error) || servers.failed.some((item) => item.label === '업타임');
  const failedLabels = [...failedSources.map((source) => SOURCE_LABELS[source] ?? source), ...serverFailures];

  // 상태 소스가 하나라도 실패하면 "이상 없음"을 단정할 수 없다. 이력(timeline)만 실패한 경우는 현재 상태 판단과 무관하다.
  const statusUnknown = failedSources.some((source) => source !== 'timeline') || serverFailures.length > 0;
  const timelineFailed = failedSources.includes('timeline');

  // 이력의 대상 주소로 부모(서버, Docker 환경)의 이름을 붙인다. 찾지 못한 이력(삭제된 대상)은 대상 이름만 쓴다.
  const withParent = useCallback((name: string, path: string) => {
    const [, section, rawId = ''] = path.split('?')[0].split('/');
    const id = decodeURIComponent(rawId);
    const parent = section === 'servers' ? servers.rows.find((row) => row.server.id === id)?.server.name
      : section === 'services' ? agents.find((agent) => agent.id === id)?.name : undefined;
    return parent && parent !== name ? `${parent} / ${name}` : name;
  }, [agents, servers.rows]);

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [
      ...unhealthyServices.map((service) => ({
        id: `service-${service.agentId}-${service.key}`,
        // 서버의 대상과 같이 "부모 / 대상"이다.
        title: `${service.agentName} / ${service.name}`,
        detail: service.lastError || '상태 체크에 실패했습니다',
        to: `/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=uptime`,
        tone: 'error' as const,
        icon: 'error_outline',
        observedAt: service.observedAt,
      })),
      // 서버 목록의 원인과 같은 판정이다. 서버 이름을 앞에 붙인다(인프라 리소스는 보통 서버와 이름이 같다).
      ...servers.rows.flatMap((row) => row.issues.map((issue) => {
        const app = issue.kind === 'app' ? row.targets.apps.find((item) => item.id === issue.id) : undefined;
        return {
          id: `${issue.kind}-${issue.id}`,
          title: issue.name === row.server.name ? row.server.name : `${row.server.name} / ${issue.name}`,
          // 사용률 경고는 방금 받은 값이라 수신 시각 대신 기준을 적는다(인프라 탭의 상태 줄과 같은 표현).
          detail: issue.threshold !== undefined ? `${issue.detail}, 기준 ${issue.threshold}%` : issue.detail,
          to: issue.to,
          tone: issue.state,
          icon: issue.state === 'error' ? 'error_outline' : ISSUE_ICON[issue.kind],
          observedAt: issue.observedAt,
          warnRank: issue.threshold !== undefined ? 2 : issue.kind === 'app' && row.breachedApps.includes(issue.id) ? 1 : 0,
          timeLabel: issue.kind === 'monitor' || issue.threshold !== undefined ? undefined
            : app && !app.lastSeenAt ? `${formatIncidentTime(app.createdAt)} 연결`
              : issue.observedAt ? `마지막 수신 ${formatIncidentTime(issue.observedAt)}` : '수신 기록 없음',
        };
      })),
      ...staleAgents.map((agent) => ({
        id: `agent-${agent.id}`,
        title: agent.name,
        detail: 'Docker Collector 데이터가 지연되었거나 끊겼습니다',
        to: `/agents/${agent.id}`,
        tone: 'warn' as const,
        icon: 'sensors_off',
        warnRank: 0,
        observedAt: agent.lastSeenAt,
        timeLabel: agent.lastSeenAt ? `마지막 수신 ${formatIncidentTime(agent.lastSeenAt)}` : '수신 기록 없음',
      })),
      ...staleDockerInfrastructure.map((resource) => ({
        id: `infrastructure-${resource.id}`,
        title: resource.name,
        detail: '인프라 Collector 데이터가 지연되었거나 끊겼습니다',
        // Docker 환경의 인프라 리소스는 서버가 없고 ID가 그 환경과 같다.
        to: `/agents/${resource.id}`,
        tone: 'warn' as const,
        icon: 'sensors_off',
        warnRank: 0,
        observedAt: resource.lastSeenAt,
        timeLabel: resource.lastSeenAt ? `마지막 수신 ${formatIncidentTime(resource.lastSeenAt)}` : '수신 기록 없음',
      })),
    ];
    // 서비스·모니터 목록을 못 불러왔어도 이력에 진행 중인 장애가 있으면 그것만큼은 확실한 이상이다.
    const listedPaths = new Set(items.map((item) => item.to.split('?')[0]));
    const unlistedActive = timeline.filter((episode) =>
      episode.active
      && (episode.source === 'uptime' ? monitorsUnknown : failedSources.includes('services'))
      && !listedPaths.has(episode.targetPath));
    items.push(...unlistedActive.map((episode) => ({
      id: `episode-${episode.source}-${episode.targetPath}`,
      title: withParent(episode.targetName, episode.targetPath),
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
  }, [failedSources, monitorsUnknown, servers.rows, staleAgents, staleDockerInfrastructure, timeline, unhealthyServices, withParent]);

  // 확인 필요 행에 "언제부터"를 붙이기 위해 진행 중인 에피소드를 대상 경로로 찾는다.
  const activeEpisodes = new Map(timeline.filter((episode) => episode.active).map((episode) => [episode.targetPath, episode]));

  // 장애와 확인 필요를 나눈다. 장애의 수는 사이드바의 배지와 같은 판정이다(모니터는 uptimeState, Docker 서비스는 healthy).
  const outageItems = attention.filter((item) => item.tone === 'error');
  // 확인 필요는 종류의 순서로 먼저 세운다(정렬은 안정적이라 같은 종류 안은 위의 순서 그대로). 관찰 시각만으로 세우면
  // 늘 "방금"인 사용률 경고가 위를 차지하고 수집이 끊긴 대상이 접힌 쪽에 숨었다.
  const warnItems = attention.filter((item) => item.tone === 'warn').sort((a, b) => (a.warnRank ?? 0) - (b.warnRank ?? 0));
  // 나머지는 제자리에서 펼친다. 서버 목록의 확인 필요 필터는 서버 수를 보여 주어 항목 수와 맞지 않았다.
  // 세 건 이하로 줄면 펼친 상태를 접는다(렌더 중에 이전 렌더의 정보로 상태를 맞추는 방식).
  if (showAllAttention && warnItems.length <= WARN_PREVIEW) setShowAllAttention(false);
  const shownWarnItems = showAllAttention ? warnItems : warnItems.slice(0, WARN_PREVIEW);

  // 백그라운드 탭에서도 장애가 보이도록 탭 제목에 장애 수를 붙인다.
  const errorCount = outageItems.length;
  useEffect(() => {
    if (errorCount === 0) return;
    const previous = document.title;
    document.title = `(${errorCount}) 장애 · ${previous}`;
    return () => { document.title = previous; };
  }, [errorCount]);

  const totalTargets = agents.length + servers.rows.length;

  // 첫 로드에만 스켈레톤을 보인다 — 대상이 0개인 상태에서 30초마다 다시 깜빡이지 않게.
  // 모양은 실제 배치(범위 스트립, 그 아래 확인 필요·이력 패널)를 따른다.
  if (!updatedAt || (!servers.loaded && !servers.error)) {
    return (
      <div className="page-stack" aria-busy="true">
        <PageHeader menu title="개요" />
        <div className="h-8 w-96 max-w-full animate-pulse rounded-md bg-ui-hover-soft" />
        <div className="h-80 animate-pulse rounded-lg bg-ui-hover-soft" />
      </div>
    );
  }

  return (
    <div className="page-stack">
      {/* 연결 추가는 각 화면(서버, Docker 환경)의 일이다. 개요의 머리는 장애에 내준다. */}
      <PageHeader menu
        title="개요"
        meta={updatedAt && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-caption text-text-muted">
              {formatClock(updatedAt, true)} 갱신 · 30초마다 자동 갱신
            </span>
            <RefreshIconButton onClick={handleRefresh} refreshing={spinning} />
          </div>
        )}
      />
      {/* 확인 필요 수가 바뀔 때만 읽힌다(텍스트가 같으면 다시 알리지 않는다). */}
      <p className="sr-only" aria-live="polite">
        {updatedAt && `장애 ${outageItems.length}건, 확인 필요 ${warnItems.length}건${statusUnknown ? ', 일부 상태 확인 불가' : ''}`}
      </p>

      {failedLabels.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-ui-border-soft bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <MaterialIcon size={20} name="sync_problem" className="mt-0.5 text-status-warn" />
            <div>
              <p className="type-label text-text-base">일부 모니터링 정보를 불러오지 못했습니다</p>
              <p className="mt-0.5 type-body text-text-muted">
                불러오지 못한 영역: {failedLabels.join(', ')}. 이 영역은 정상 여부를 판단할 수 없습니다.
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
            headingLevel="h2"
            title="아직 모니터링 대상이 없습니다"
            description="서버를 추가해 업타임, 로그, 인프라 같은 기능을 연결하거나 Docker 환경을 연결해 시작하세요."
          >
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink to={NEW_SERVER_PATH}>서버 추가</ButtonLink>
              <ButtonLink variant="secondary" to="/environments?connect=docker">Docker 연결</ButtonLink>
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
              ['서버', servers.rows.length, SERVERS_PATH, Boolean(servers.error) && !servers.loaded, 'dns'],
              ['Docker 환경', agents.length, '/environments', failedSources.includes('agents'), 'deployed_code'],
            ] as const).map(([label, count, to, unknown, icon]) => (
              unknown ? (
                <span key={label} className="inline-flex h-8 items-center gap-1.5 px-2">
                  <MaterialIcon name={icon} size={20} className="text-text-dim" />
                  <span className="type-body text-text-muted">{label}</span>
                  <Tooltip content="불러오지 못했습니다" focusable><span className="type-label text-text-muted" aria-label="확인 불가">-</span></Tooltip>
                </span>
              ) : (
                <Link key={label} to={to} className="inline-flex h-8 min-h-11 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-ui-hover sm:min-h-0">
                  <MaterialIcon name={icon} size={20} className="text-text-dim" />
                  <span className="type-body text-text-muted">{label}</span>
                  <span className="type-label tabular-nums text-text-base">{count}</span>
                </Link>
              )
            ))}
            {/* 전체 로그는 범위 줄의 보조 링크다. 확인 필요의 제목 줄에 있으면 그 목록의 "전체 보기"로 읽혔다. */}
            <span className="ml-auto flex flex-wrap items-center">
              <Link to={ALL_LOGS_PATH} className="inline-flex h-8 min-h-11 items-center px-2 type-body text-action link-underline sm:min-h-0">전체 로그</Link>
              <Link to="/projects" className="inline-flex h-8 min-h-11 items-center px-2 type-body text-action link-underline sm:min-h-0">
                그룹으로 정리
              </Link>
            </span>
          </nav>
          </div>

          {/* Linear식 목록: 카드·행 구분선·배경 띠 없이 그룹 제목과 간격으로 나누고, 두 그룹 사이에만 옅은 선을 둔다. 행은 Triage 인박스처럼 두 줄. */}
          <div className="section-stack">
            <section id="attention" aria-label="현재 확인 필요" className="scroll-mt-5">
              {/* 일부 대상을 불러오지 못한 동안에는 본문이 판단을 유보하므로 건수를 단정하지 않는다. */}
              <GroupHeader title="현재 확인 필요"
                count={statusUnknown ? null : <><span>장애 {outageItems.length}</span>, <span>확인 필요 {warnItems.length}</span></>} />
              {attention.length === 0 ? (
                <div className="flex items-center gap-3 py-3">
                  <MaterialIcon name={statusUnknown ? 'sync_problem' : 'check_circle'} className={statusUnknown ? 'text-status-warn' : 'text-status-healthy'} />
                  <p className="type-body text-text-muted">
                    {statusUnknown ? '불러온 영역에서는 이상이 없지만, 전체가 정상인지는 아직 알 수 없습니다.' : '현재 확인이 필요한 이상이 없습니다'}
                  </p>
                </div>
              ) : (
                <div className="mt-1 space-y-3">
                  {/* 장애가 없으면 확인 필요보다 먼저 그것을 말한다. 경고 몇 건이 장애처럼 읽히지 않게. */}
                  {outageItems.length === 0 ? (
                    <div className="flex items-center gap-3 py-2">
                      <MaterialIcon name={statusUnknown ? 'sync_problem' : 'check_circle'} className={statusUnknown ? 'text-status-warn' : 'text-status-healthy'} />
                      <p className="type-body text-text-muted">{statusUnknown ? '불러온 영역에서는 진행 중인 장애가 없습니다' : '진행 중인 장애 없음'}</p>
                    </div>
                  ) : (
                    <AttentionGroup id="attention-outages" title="장애">
                      {outageItems.map((item) => <AttentionRow key={item.id} item={item} episode={activeEpisodes.get(item.to.split('?')[0])} />)}
                    </AttentionGroup>
                  )}
                  {warnItems.length > 0 && (
                    <AttentionGroup id="attention-warnings" title="확인 필요"
                      footer={warnItems.length > WARN_PREVIEW && (
                        <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-0" aria-expanded={showAllAttention} onClick={() => setShowAllAttention((value) => !value)}><MaterialIcon name={showAllAttention ? 'expand_less' : 'expand_more'} />{showAllAttention ? '우선 항목만 보기' : `확인 필요 ${warnItems.length}건 모두 보기`}</Button>
                      )}>
                      {shownWarnItems.map((item) => <AttentionRow key={item.id} item={item} />)}
                    </AttentionGroup>
                  )}
                </div>
              )}
            </section>

            {/* 최근 장애 이력 — 위가 지금을 말한다면 이쪽은 시간축이다.
                "지금 문제 없음"과 "닷새째 조용함"은 다른 정보고, 신뢰를 주는 건 후자다.
                직접 연결 서비스는 이력 테이블이 없어 범위를 헤더에 밝힌다(안 밝히면 "전부 조용하다"로 오독된다). */}
            <section aria-label="최근 장애 이력">
              <GroupHeader
                title="최근 장애 이력"
                count={timelineFailed ? '-' : timeline.length}
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
                        title={withParent(episode.targetName, episode.targetPath)}
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

function GroupHeader({ title, count, countLabel, note }: { title: string; count: ReactNode; countLabel?: string; note?: string }) {
  return (
    // 섹션 제목이다(section-stack 선으로 나뉜다). 건수·범위는 제목과 같은 기준선의 메타다(DESIGN.md §2.2).
    <SectionHeader
      title={title}
      className="min-h-8"
      meta={(count != null || note) && <>
        {/* span의 aria-label은 대부분의 스크린리더가 읽지 않는다 — 숫자만이면 감추고 같은 뜻을 글로 둔다. */}
        {countLabel ? <><span aria-hidden="true">{count}</span><span className="sr-only">{countLabel}</span></> : count}
        {note && <span className="ml-3">{note}</span>}
      </>}
    />
  );
}

// 현재 확인 필요 안의 묶음(장애, 확인 필요). 제목은 섹션 제목(h2) 아래의 h3이다.
function AttentionGroup({ id, title, footer, children }: { id: string; title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id}>
      <h3 id={id} className="type-label-sm text-text-muted">{title}</h3>
      <ul className="-mx-3 mt-1">{children}</ul>
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}

// 장애 행은 장애 이력의 진행 중 에피소드와 이어져 시작 시각과 경과 시간을 보인다.
function AttentionRow({ item, episode }: { item: AttentionItem; episode?: TimelineIncident }) {
  return (
    <li>
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
