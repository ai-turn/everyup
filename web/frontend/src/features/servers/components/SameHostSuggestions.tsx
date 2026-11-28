import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button, Section } from '../../../components/common';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { serverPath } from '../serverPaths';
import { sameHostPairs, type ServerRow } from '../serverStatus';

const pairKey = (dockerServerId: string, serverId: string) => `${dockerServerId}:${serverId}`;

/**
 * 개요의 같은 호스트 제안(ADR 0012). 이름이 같은 Docker 서버와 직접 연결 서버를 보이고, `합치기`는 직접 연결 서버의 화면에서
 * Docker 서버를 고른 합치기 창을 연다. 확인 없이 합치지 않는다. `아님`은 서버에 기록되어 모든 사용자에게 다시 보이지 않는다.
 * 기록을 불러오지 못하면 제안을 모두 보인다(답을 모르는 쌍을 숨기지 않는다). 제안이 없으면 아무것도 그리지 않는다.
 */
export function SameHostSuggestions({ rows }: { rows: ServerRow[] }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [dismissing, setDismissing] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.getSameHostDismissals().then((pairs) => {
      if (alive) setDismissed(new Set((pairs ?? []).map((pair) => pairKey(pair.dockerServerId, pair.serverId))));
    }, () => {});
    return () => { alive = false; };
  }, []);
  const pairs = sameHostPairs(rows).filter(({ docker, direct }) => !dismissed.has(pairKey(docker.server.id, direct.server.id)));
  if (pairs.length === 0) return null;

  const dismiss = async (dockerServerId: string, serverId: string) => {
    const key = pairKey(dockerServerId, serverId);
    setDismissing(key);
    try {
      await api.dismissSameHost({ dockerServerId, serverId });
      setDismissed((current) => new Set(current).add(key));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDismissing(null);
    }
  };

  return (
    <Section label="같은 호스트로 보이는 서버" title="같은 호스트인가요?"
      description="이름이 같은 서버입니다. 같은 호스트라면 합쳐서 컨테이너와 직접 연결한 대상을 한 서버에서 보세요.">
      <ul className="space-y-label">
        {pairs.map(({ docker, direct }) => {
          const key = pairKey(docker.server.id, direct.server.id);
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="min-w-0 type-body text-text">
                <span className="font-medium">{docker.server.name}</span>
                <span className="text-text-muted"> (Docker Collector) · </span>
                <span className="font-medium">{direct.server.name}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" aria-label={`합치기: ${docker.server.name} → ${direct.server.name}`}
                  onClick={() => navigate(serverPath(direct.server.id), { state: { mergeFrom: docker.server.id } })}>합치기</Button>
                <Button variant="quiet" size="sm" aria-label={`다른 호스트: ${docker.server.name}, ${direct.server.name}`} loading={dismissing === key}
                  onClick={() => void dismiss(docker.server.id, direct.server.id)}>아님</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
