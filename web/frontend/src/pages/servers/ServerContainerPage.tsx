import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, MaterialIcon, parseTimeRange } from '../../components/common';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { AgentHealthCheckDetailView } from '../../features/healthcheck/components/AgentHealthCheckDetailView';
import type { DetailTab } from '../../features/healthcheck/components/AgentServiceTabs';
import { listBack } from '../../features/targets/listBack';
import { SERVERS_PATH, serverPath } from '../../features/servers/serverPaths';
import { getErrorMessage } from '../../utils/errors';

function serviceKeyFromPath(pathname: string): string | null {
  // Read the raw segment once: router params normalize encoded slashes, which
  // would change an opaque key containing the literal text "%2F".
  const rawKey = pathname.replace(/\/$/, '').split('/').pop() ?? '';
  try { return decodeURIComponent(rawKey); } catch { return null; }
}

interface Found {
  service: AgentServiceFlat;
  agent: ConnectedAgent;
  /** 서버 이름. 서버를 불러오지 못하면 Docker Collector 이름이다(만들 때 같은 이름이다). */
  serverName: string;
}

/**
 * 컨테이너(Docker Collector가 발견한 Docker 서비스) 하나의 페이지(`/servers/:serverId/containers/:key`, DESIGN.md §4.7 대상 상세).
 * Docker 환경은 서버다(ADR 0012). 서버의 Docker Collector를 찾고, 그 Collector의 컨테이너를 키로 찾는다.
 */
export function ServerContainerPage() {
  const { serverId = '' } = useParams<{ serverId: string }>();
  const { pathname } = useLocation();
  const serviceKey = serviceKeyFromPath(pathname);
  return <ContainerDetail key={`${serverId}/${serviceKey}`} serverId={serverId} serviceKey={serviceKey} />;
}

function ContainerDetail({ serverId, serviceKey }: { serverId: string; serviceKey: string | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  // 서버 상세와 같다: 화살표 키로 연달아 옮기면 기록 하나를 덮어써서, 뒤로 가기 한 번이면 키보드 탐색을 시작한 탭으로 돌아간다.
  // 키를 빠르게 연달아 누르면 다음 키가 새 주소로 다시 그려지기 전에 오므로 아직 그려지지 않은 키보드 이동을 기억한다.
  const pendingKeyboard = useRef(false);
  useEffect(() => { pendingKeyboard.current = false; }, [location]);
  // 컨테이너 탭이나 로그 탭의 목록에서 열었으면 복귀 링크가 그 목록이다. 탭을 바꾸면 state가 사라지므로 처음 것을 기억한다.
  const [back] = useState(() => listBack(location.state, [
    { path: serverPath(serverId, 'containers'), label: '컨테이너 목록' },
    { path: serverPath(serverId, 'logs'), label: '컨테이너 목록' },
  ]));

  const [found, setFound] = useState<Found | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const pending = useRef<Promise<void> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedTab = searchParams.get('tab');
  const tab: DetailTab = selectedTab === 'logs' || selectedTab === 'requests' || selectedTab === 'traces' || selectedTab === 'metrics' || selectedTab === 'infra'
    ? selectedTab
    : 'uptime';

  const fetchService = useCallback(() => {
    if (pending.current) return pending.current;
    setRefreshing(true);
    const request = (async () => {
    try {
      if (serviceKey === null) { setFound(null); return; }
      // 서버 이름은 크럼에만 쓴다. 서버를 불러오지 못해도 컨테이너는 보인다.
      const [all, agents, server] = await Promise.all([api.getAllAgentServicesFlat(), api.getAgents(), api.getServer(serverId).catch(() => null)]);
      // 이 서버의 Docker Collector. 합치기 전에는 Docker 서버의 ID가 Docker Collector의 ID다(migrateV59).
      const agent = agents.find((candidate) => candidate.serverId === serverId) ?? agents.find((candidate) => candidate.id === serverId);
      const service = agent && all.find((s) => s.agentId === agent.id && s.key === serviceKey);
      setFound(agent && service ? { agent, service, serverName: server?.name ?? agent.name } : null);
      setLoadError(null);
      setUpdatedAt(new Date());
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    })().finally(() => { pending.current = null; });
    pending.current = request;
    return request;
  }, [serverId, serviceKey]);

  useEffect(() => { fetchService(); }, [fetchService]);

  const handleRefresh = useCallback(() => {
    fetchService();
    setRefreshKey((prev) => prev + 1);
  }, [fetchService]);

  const { refresh } = useAutoRefresh(handleRefresh, 30_000, autoRefresh);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-text-muted">
        <MaterialIcon size={24} name="sync" className="animate-spin" />
        <span>로딩 중…</span>
      </div>
    );
  }

  if (loadError && !found) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-heading">
        <MaterialIcon size={32} name="sync_problem" className="text-status-warn" />
        <div className="text-center"><p className="type-label text-text-base">컨테이너를 불러오지 못했습니다</p><p className="mt-1 type-body text-text-muted">{loadError}</p></div>
        <div className="flex gap-2"><ButtonLink variant="secondary" to={SERVERS_PATH}>서버 목록</ButtonLink><Button loading={refreshing} onClick={() => void fetchService()}>다시 시도</Button></div>
      </div>
    );
  }

  if (!found) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-heading">
        <MaterialIcon size={32} name="error_outline" className="text-red-500" />
        <p className="text-text-muted">
          컨테이너를 찾을 수 없습니다
        </p>
        <ButtonLink to={SERVERS_PATH}>
          서버 목록으로
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
    {loadError && <div role="alert" className="mb-4 rounded-xl border border-ui-border-soft px-4 py-3 type-control text-text-secondary">컨테이너 조회에 실패했습니다. 이전에 불러온 상태입니다. <Button size="sm" variant="secondary" loading={refreshing} onClick={handleRefresh}>다시 시도</Button></div>}
    <AgentHealthCheckDetailView
      service={found.service}
      agent={found.agent}
      serverId={serverId}
      serverName={found.serverName}
      back={back}
      serviceKey={serviceKey!}
      refreshKey={refreshKey}
      onRefresh={refresh}
      refreshing={refreshing}
      updatedAt={updatedAt}
      autoRefresh={autoRefresh}
      onAutoRefreshChange={setAutoRefresh}
      tab={tab}
      traceId={searchParams.get('traceId') ?? undefined}
      initialRange={parseTimeRange(searchParams.get('range'))}
      onTabChange={(nextTab, source) => {
        const next = new URLSearchParams(searchParams);
        if (nextTab === 'uptime') next.delete('tab');
        else next.set('tab', nextTab);
        const keyboard = source === 'keyboard';
        const previousKeyboard = pendingKeyboard.current || (location.state as { tabKeys?: boolean } | null)?.tabKeys === true;
        pendingKeyboard.current = keyboard;
        setSearchParams(next, { replace: keyboard && previousKeyboard, state: keyboard ? { tabKeys: true } : null });
      }}
    />
    </>
  );
}
