import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, MaterialIcon } from '../../components/common';
import { serverPath, SERVERS_PATH, type ServerCapability } from '../../features/servers/serverPaths';
import { api } from '../../services/api';
import { ApiError, getErrorMessage } from '../../utils/errors';

const lookup = (kind: ServerCapability, id: string): Promise<{ serverId?: string } | null> =>
  kind === 'uptime' ? api.getUptimeMonitor(id)
    : kind === 'infrastructure' ? api.getInfrastructureResource(id)
      : api.getObservedService(id);

// Docker 환경의 인프라 리소스는 그 환경과 ID가 같고 서버가 없다. 단건 조회는 직접 연결 리소스만 찾으므로 환경 목록에서 찾는다.
const dockerEnvironmentPath = async (id: string): Promise<string | null> =>
  (await api.getAgents())?.some((agent) => agent.id === id) ? `/agents/${encodeURIComponent(id)}` : null;

/** 옮겨 갈 주소. 대상이 없으면 null. */
async function destination(kind: ServerCapability, id: string): Promise<string | null> {
  const target = await lookup(kind, id).catch((cause: unknown) => {
    if (kind === 'infrastructure' && cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  });
  // 인프라 리소스는 서버마다 하나라 탭 주소가 곧 그 리소스다.
  if (target?.serverId) return kind === 'infrastructure' ? serverPath(target.serverId, kind) : serverPath(target.serverId, kind, id);
  // 서버가 없는 모니터나 앱은 있을 수 없는 데이터라 찾지 못한 것으로 본다.
  return kind === 'infrastructure' ? dockerEnvironmentPath(id) : null;
}

/**
 * 옛 기능별 메뉴의 대상 주소(/uptime/:id, /logs/:id 등). 대상을 조회해 서버를 알아낸 뒤 그 서버 화면으로 바꾼다.
 * 이미 보낸 알림, 북마크, 장애 이력의 targetPath가 여기로 온다. 쿼리와 해시는 그대로 넘긴다(설계 6.2).
 * Docker 환경의 인프라 리소스는 그 환경 화면으로 보낸다.
 */
export function LegacyTargetRedirect({ kind }: { kind: ServerCapability }) {
  const { id = '' } = useParams<{ id: string }>();
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState<'missing' | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    destination(kind, id).then((path) => {
      if (!alive) return;
      if (!path) { setResult('missing'); return; }
      navigate(`${path}${search}${hash}`, { replace: true });
    }, (cause: unknown) => {
      if (alive) setResult(cause instanceof ApiError && cause.status === 404 ? 'missing' : { error: getErrorMessage(cause) });
    });
    return () => { alive = false; };
  }, [kind, id, search, hash, navigate, attempt]);

  if (result === 'missing') {
    return (
      <EmptyState icon="search_off" title="대상을 찾을 수 없습니다" description="삭제되었거나 주소가 잘못되었습니다. 서버 목록에서 찾아보세요." headingLevel="h1"
        action={{ label: '서버 목록', to: SERVERS_PATH }} />
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
