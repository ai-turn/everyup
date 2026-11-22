import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ConnectedAgent } from '../../services/api';
import { DOCKER_SERVERS_PATH, serverPath } from '../servers/serverPaths';
import { sameHostName } from '../servers/serverStatus';
import { collectsHostMetrics } from '../servers/useInfrastructureSources';

/**
 * 직접 연결·인프라 대화 상자의 Docker 안내(연결 진입점 정리 D1-A, ADR 0012). Docker Collector는 서버에 속하므로 같은 서버 안의
 * 일이면 그대로 말한다: 이 서버에 Docker Collector가 있으면 그것으로 연결하라고, 이름이 같은 다른 서버에 있으면 두 서버를 합치라고
 * 안내한다. Docker Collector가 하나도 없거나 목록을 불러오지 못하면 아무것도 보이지 않는다: 연결을 막는 정보가 아니다.
 */
export function DockerHostNote({ serverId, serverName, infrastructure = false, sameNameOnly = false }: {
  serverId: string;
  serverName: string;
  infrastructure?: boolean;
  /** 이 서버나 이름이 같은 서버에 Docker Collector가 있을 때만 보인다. 로그 대화 상자는 stdout 로그 안내가 이미 있다. */
  sameNameOnly?: boolean;
}) {
  const [agents, setAgents] = useState<ConnectedAgent[] | null>(null);
  useEffect(() => {
    let active = true;
    api.getAgents().then((rows) => { if (active) setAgents(rows ?? []); }).catch(() => { if (active) setAgents([]); });
    return () => { active = false; };
  }, []);
  if (!agents || agents.length === 0) return null;

  const own = agents.find((agent) => agent.serverId === serverId);
  if (own) {
    // Docker Collector가 이미 호스트 지표를 모으면 인프라 대화 상자가 출처를 하나 고르게 한다(서버당 하나). 여기서는 말하지 않는다.
    if (infrastructure) {
      return collectsHostMetrics(own) ? null
        : <p className="type-body text-text-muted">이 서버에는 Docker Collector가 있습니다. 서버 개요의 설정 가이드에서 인프라를 더하면 따로 설치하지 않아도 됩니다.</p>;
    }
    return sameNameOnly ? null : <p className="type-body text-text-muted">이 서버에는 Docker Collector가 있습니다. 컨테이너로 도는 앱은 그것으로 연결하세요.</p>;
  }

  const same = agents.find((agent) => agent.serverId && sameHostName(agent.name, serverName));
  if (!same && sameNameOnly) return null;
  // 조건("같은 호스트라면")은 앞 문장이 말하고, 여기서는 할 일만 말한다. 조건을 겹치면 "~했다면 ~라면"이 됐다.
  const what = infrastructure
    ? 'Docker Collector의 인프라 기능이 같은 호스트 지표를 수집합니다. 두 번 수집하지 않도록 Docker Collector에서 인프라를 연결하세요.'
    : '컨테이너로 도는 앱은 Docker Collector로 연결하세요.';
  const link = 'text-action underline underline-offset-2';
  return (
    <p className="type-body text-text-muted">
      {same
        // 조사가 이름의 받침에 따라 갈리지 않게 이름은 괄호 안에 둔다.
        ? <>이름이 같은 서버에 Docker Collector가 있습니다(<Link to={serverPath(same.serverId!)} className={link}>{same.name}</Link>). 같은 호스트라면 서버 설정의 다른 서버 합치기로 두 서버를 합치세요. {what}</>
        : <>이 호스트에 <Link to={DOCKER_SERVERS_PATH} className={link}>Docker Collector</Link>가 있다면, {what}</>}
    </p>
  );
}
