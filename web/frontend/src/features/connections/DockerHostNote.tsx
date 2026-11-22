import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ConnectedAgent } from '../../services/api';

/**
 * 직접 연결·인프라 대화 상자의 Docker 안내(연결 진입점 정리 D1-A). Docker 데이터는 Docker 환경에만 있으므로(ADR 0011), 같은 호스트를
 * 서버에도 연결하면 두 곳에 나뉜다. Docker 환경이 하나라도 있을 때만 보이고, 서버와 이름이 같은 환경이 있으면 그 환경으로 바로 보낸다.
 * 목록을 불러오지 못하면 아무것도 보이지 않는다: 연결을 막는 정보가 아니다.
 */
export function DockerHostNote({ serverName, infrastructure = false, sameNameOnly = false }: {
  serverName: string;
  infrastructure?: boolean;
  /** 같은 이름의 환경이 있을 때만 보인다. 로그 대화 상자는 stdout 로그를 Docker 환경에서 연결하라는 안내가 이미 있다. */
  sameNameOnly?: boolean;
}) {
  const [agents, setAgents] = useState<ConnectedAgent[] | null>(null);
  useEffect(() => {
    let active = true;
    api.getAgents().then((rows) => { if (active) setAgents(rows ?? []); }).catch(() => { if (active) setAgents([]); });
    return () => { active = false; };
  }, []);
  if (!agents || agents.length === 0) return null;

  const same = agents.find((agent) => agent.name.trim().toLowerCase() === serverName.trim().toLowerCase());
  if (!same && sameNameOnly) return null;
  const what = infrastructure
    ? 'Docker Collector의 인프라 기능이 같은 호스트 지표를 수집합니다. 두 번 수집하지 않도록 그 환경에서 인프라를 연결하세요.'
    : '컨테이너로 도는 앱이라면 그 환경의 Docker Collector로 연결하세요. 데이터가 Docker 환경 한 곳에 모입니다.';
  return (
    <p className="type-body text-text-muted">
      {same
        // 조사가 이름의 받침에 따라 갈리지 않게 이름은 괄호 안에 둔다.
        ? <>이 서버와 이름이 같은 Docker 환경이 있습니다(<Link to={`/agents/${encodeURIComponent(same.id)}`} className="text-action underline underline-offset-2">{same.name}</Link>). 같은 호스트라면 {what}</>
        : <>이 호스트를 <Link to="/environments" className="text-action underline underline-offset-2">Docker 환경</Link>으로도 연결했다면 {what}</>}
    </p>
  );
}
