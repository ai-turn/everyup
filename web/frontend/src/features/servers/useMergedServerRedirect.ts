import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

/**
 * 합쳐서 사라진 Docker 서버의 주소를 합친 서버로 옮긴다(같은 호스트 합치기, ADR 0012). Docker 서버의 ID는 그 Docker
 * Collector의 ID이므로(migrateV59), 서버를 찾지 못하면 그 ID의 Collector가 지금 속한 서버로 간다. 아래 경로(탭, 대상), 쿼리,
 * 해시, state를 그대로 넘기고 기록을 바꾼다. 별도의 표가 필요 없다. 직접 연결 서버끼리 합친 옛 주소는 찾을 수 없다로 남는다.
 */
export function useMergedServerRedirect(serverId: string, missing: boolean) {
  const navigate = useNavigate();
  const { pathname, search, hash, state } = useLocation();
  useEffect(() => {
    if (!missing || !serverId) return;
    let alive = true;
    api.getAgents().then((agents) => {
      const moved = agents?.find((agent) => agent.id === serverId && agent.serverId && agent.serverId !== serverId);
      if (!alive || !moved?.serverId) return;
      const prefix = `/servers/${serverId}`;
      navigate(`/servers/${moved.serverId}${pathname.slice(pathname.indexOf(prefix) + prefix.length)}${search}${hash}`, { replace: true, state });
    }, () => {});
    return () => { alive = false; };
  }, [missing, serverId, pathname, search, hash, state, navigate]);
}
