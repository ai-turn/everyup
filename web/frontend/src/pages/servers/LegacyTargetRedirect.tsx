import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, MaterialIcon } from '../../components/common';
import { serverPath, SERVERS_PATH, type ServerCapability } from '../../features/servers/serverPaths';
import { openFromGroup, useGroupTrail } from '../../hooks/useGroupTrail';
import { api } from '../../services/api';
import { ApiError, getErrorMessage } from '../../utils/errors';

const lookup = (kind: ServerCapability, id: string): Promise<{ serverId?: string } | null> =>
  kind === 'uptime' ? api.getUptimeMonitor(id)
    : kind === 'infrastructure' ? api.getInfrastructureResource(id)
      : api.getObservedService(id);

/**
 * 옛 기능별 메뉴의 대상 주소(/uptime/:id, /logs/:id 등). 대상을 조회해 서버를 알아낸 뒤 그 서버 화면으로 바꾼다.
 * 이미 보낸 알림과 북마크의 링크가 여기로 온다. 쿼리와 해시는 그대로 넘긴다(설계 6.2).
 */
export function LegacyTargetRedirect({ kind }: { kind: ServerCapability }) {
  const { id = '' } = useParams<{ id: string }>();
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  // 그룹에서 연 옛 주소면 그룹 맥락을 새 주소로 옮긴다. 그룹 화면의 링크는 아직 옛 주소다.
  const trail = useGroupTrail();
  const [result, setResult] = useState<'missing' | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    lookup(kind, id).then((target) => {
      if (!alive) return;
      // 서버가 없는 대상(Docker 환경의 서비스·리소스)은 옛 직접 연결 주소의 대상이 아니다.
      if (!target?.serverId) { setResult('missing'); return; }
      // 인프라 리소스는 서버마다 하나라 탭 주소가 곧 그 리소스다.
      const path = kind === 'infrastructure' ? serverPath(target.serverId, kind) : serverPath(target.serverId, kind, id);
      if (trail) openFromGroup({ ...trail, path });
      navigate(`${path}${search}${hash}`, { replace: true });
    }, (cause: unknown) => {
      if (alive) setResult(cause instanceof ApiError && cause.status === 404 ? 'missing' : { error: getErrorMessage(cause) });
    });
    return () => { alive = false; };
  }, [kind, id, search, hash, navigate, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- trail은 이동할 때 한 번 읽는다

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
