import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ButtonLink, EmptyState, MaterialIcon } from '../../components/common';
import { legacyAppPath, monitorPath, serverPath, SERVERS_PATH, type ServerCapability } from '../../features/servers/serverPaths';
import { api } from '../../services/api';
import { ApiError, getErrorMessage } from '../../utils/errors';

// 찾지 못한 대상의 종류. 옛 주소가 무엇을 가리켰는지 말한다.
const MISSING_TITLE: Record<ServerCapability, string> = {
  uptime: '업타임 모니터를 찾을 수 없습니다', infrastructure: '인프라 리소스를 찾을 수 없습니다', logs: '앱을 찾을 수 없습니다', api: '앱을 찾을 수 없습니다', metrics: '앱을 찾을 수 없습니다',
};

const lookup = (kind: ServerCapability, id: string): Promise<{ serverId?: string } | null> =>
  kind === 'uptime' ? api.getUptimeMonitor(id)
    : kind === 'infrastructure' ? api.getInfrastructureResource(id)
      : api.getObservedService(id);

// Docker 환경의 인프라 리소스는 그 환경과 ID가 같고, Docker 환경은 같은 ID의 서버다(ADR 0012). 단건 조회는 직접 연결 리소스만 찾으므로 환경 목록에서 찾는다.
const dockerEnvironmentPath = async (id: string): Promise<string | null> =>
  (await api.getAgents())?.some((agent) => agent.id === id) ? serverPath(id, 'infrastructure') : null;

/** 옮겨 갈 주소. 대상이 없으면 null. */
async function destination(kind: ServerCapability, id: string, search: string): Promise<string | null> {
  const target = await lookup(kind, id).catch((cause: unknown) => {
    if (kind === 'infrastructure' && cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  });
  // 인프라 리소스는 서버마다 하나라 탭 주소가 곧 그 리소스다.
  if (target?.serverId) {
    if (kind === 'infrastructure') return serverPath(target.serverId, kind);
    return kind === 'uptime' ? monitorPath(target.serverId, id) : legacyAppPath(target.serverId, id, kind, search);
  }
  // 서버가 없는 모니터나 앱은 있을 수 없는 데이터라 찾지 못한 것으로 본다.
  return kind === 'infrastructure' ? dockerEnvironmentPath(id) : null;
}

/**
 * 옛 기능별 메뉴의 대상 주소(/uptime/:id, /logs/:id 등). 대상을 조회해 서버를 알아낸 뒤 그 서버 화면으로 바꾼다.
 * 이미 보낸 알림, 북마크, 장애 이력의 targetPath가 여기로 온다. 쿼리와 해시는 그대로 넘긴다(설계 6.2).
 * Docker 환경의 인프라 리소스는 그 서버의 인프라 탭으로 보낸다.
 */
export function LegacyTargetRedirect({ kind }: { kind: ServerCapability }) {
  const { id = '' } = useParams<{ id: string }>();
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState<'missing' | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    destination(kind, id, search).then((path) => {
      if (!alive) return;
      if (!path) { setResult('missing'); return; }
      // 앱 주소는 쿼리를 이미 옮겨 담았다(legacyAppPath).
      navigate(`${path}${path.includes('?') ? '' : search}${hash}`, { replace: true });
    }, (cause: unknown) => {
      if (alive) setResult(cause instanceof ApiError && cause.status === 404 ? 'missing' : { error: getErrorMessage(cause) });
    });
    return () => { alive = false; };
  }, [kind, id, search, hash, navigate, attempt]);

  if (result === 'missing') {
    return (
      // 알림 링크로 왔다면 대상은 없어도 장애는 개요에 있을 수 있다.
      <EmptyState icon="search_off" title={MISSING_TITLE[kind]} description="삭제되었거나 주소가 잘못되었습니다. 서버 목록에서 찾아보세요." headingLevel="h1">
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink to={SERVERS_PATH}>서버 목록</ButtonLink>
          <ButtonLink variant="secondary" to="/#attention">개요에서 현재 장애 보기</ButtonLink>
        </div>
      </EmptyState>
    );
  }
  if (result) {
    return (
      <EmptyState icon="error_outline" title="대상을 불러오지 못했습니다" description={result.error} headingLevel="h1"
        action={{ label: '다시 시도', onClick: () => { setResult(null); setAttempt((value) => value + 1); } }} />
    );
  }
  return (
    <div role="status" className="flex h-64 items-center justify-center gap-3 text-text-muted">
      <MaterialIcon size={24} name="sync" className="animate-spin" />이동하는 중…
    </div>
  );
}

/**
 * 서버 탭 안의 옛 앱 주소(`/servers/:s/{logs,api,metrics}/:app`, 2026-11-21 이전). 앱은 이제 자기 페이지가 있다(DESIGN.md §4.7).
 * 쿼리(traceId, range, 필터)와 해시, 화면 state(목록으로 돌아갈 주소)를 그대로 넘긴다.
 */
export function LegacyServerAppRedirect({ kind }: { kind: 'logs' | 'api' | 'metrics' }) {
  const { serverId = '', appId = '' } = useParams<{ serverId: string; appId: string }>();
  const { search, hash, state } = useLocation();
  return <Navigate to={`${legacyAppPath(serverId, appId, kind, search)}${hash}`} replace state={state} />;
}

/** 서버 탭 안의 옛 모니터 주소(`/servers/:s/uptime/:id`, 2026-11-21 이전). 모니터는 이제 자기 페이지가 있다. 쿼리·해시·state를 넘긴다. */
export function LegacyServerMonitorRedirect() {
  const { serverId = '', monitorId = '' } = useParams<{ serverId: string; monitorId: string }>();
  const { search, hash, state } = useLocation();
  return <Navigate to={`${monitorPath(serverId, monitorId)}${search}${hash}`} replace state={state} />;
}

/** 서버 탭 아래의 다른 대상 주소(옛 `/servers/:s/infrastructure/:id`). 대상 페이지가 없는 기능이라 그 탭으로 보낸다. 쿼리·해시를 넘긴다. */
export function LegacyServerTabRedirect() {
  const { serverId = '', capability = '' } = useParams<{ serverId: string; capability: string }>();
  const { search, hash } = useLocation();
  return <Navigate to={`/servers/${encodeURIComponent(serverId)}/${encodeURIComponent(capability)}${search}${hash}`} replace />;
}

/**
 * 옛 Docker 환경 주소(`/agents/:agentId`, `/agents/:agentId/:tab`). Docker 환경은 같은 ID의 서버다(ADR 0012, migrateV59).
 * 탭 키(인프라, 로그, API 요청)는 서버 탭과 같고, 그 밖의 탭은 서버 개요로 간다. 쿼리·해시·state를 넘긴다.
 */
export function LegacyEnvironmentRedirect() {
  const { agentId = '', tab } = useParams<{ agentId: string; tab?: string }>();
  const { search, hash, state } = useLocation();
  const serverTab = tab === 'infrastructure' || tab === 'logs' || tab === 'api' ? tab : undefined;
  return <Navigate to={`${serverPath(agentId, serverTab)}${search}${hash}`} replace state={state} />;
}

/**
 * 옛 Docker 환경 목록(`/environments`, `/agents`). Docker 환경은 서버 목록에 있고, Docker Collector가 있는 서버만 걸러 보인다
 * (`?connection=docker`). 쿼리(검색어, 상태)와 해시를 넘긴다.
 */
export function LegacyEnvironmentsRedirect() {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  params.set('connection', 'docker');
  return <Navigate to={`${SERVERS_PATH}?${params}${hash}`} replace />;
}

/**
 * 옛 Docker 서비스 상세(`/services/:agentId/:key`). 컨테이너 페이지는 서버 아래다(ADR 0012). Docker 서버의 ID는 Docker Collector의
 * ID와 같다(migrateV59). 키는 주소의 원래 조각을 그대로 옮긴다: 라우터 파라미터는 인코딩된 `/`(`%2F`)를 풀어 키를 바꾼다.
 * 쿼리(`?tab=`, `?range=` 등)·해시·state를 넘긴다.
 */
export function LegacyContainerRedirect() {
  const { agentId = '' } = useParams<{ agentId: string }>();
  const { pathname, search, hash, state } = useLocation();
  const rawKey = pathname.replace(/\/$/, '').split('/').pop() ?? '';
  return <Navigate to={`/servers/${encodeURIComponent(agentId)}/containers/${rawKey}${search}${hash}`} replace state={state} />;
}
