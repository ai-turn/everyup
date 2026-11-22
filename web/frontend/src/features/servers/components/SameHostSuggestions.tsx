import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Section } from '../../../components/common';
import { serverPath } from '../serverPaths';
import { sameHostPairs, type ServerRow } from '../serverStatus';

// `아님`으로 닫은 쌍. 이 브라우저에만 남는 편의 기능이다: 저장소를 쓸 수 없으면 다음에 다시 보인다.
const DISMISSED_KEY = 'everyup.sameHost.dismissed';
const pairKey = (docker: ServerRow, direct: ServerRow) => `${docker.server.id}:${direct.server.id}`;

function readDismissed(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * 개요의 같은 호스트 제안(ADR 0012). 이름이 같은 Docker 서버와 직접 연결 서버를 보이고, `합치기`는 직접 연결 서버의 화면에서
 * Docker 서버를 고른 합치기 창을 연다. 확인 없이 합치지 않는다. 제안이 없으면 아무것도 그리지 않는다.
 */
export function SameHostSuggestions({ rows }: { rows: ServerRow[] }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(readDismissed);
  const pairs = sameHostPairs(rows).filter(({ docker, direct }) => !dismissed.includes(pairKey(docker, direct)));
  if (pairs.length === 0) return null;

  const dismiss = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next);
    try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* 이 화면에서만 숨긴다. */ }
  };

  return (
    <Section label="같은 호스트로 보이는 서버" title="같은 호스트인가요?"
      description="이름이 같은 서버입니다. 같은 호스트라면 합쳐서 컨테이너와 직접 연결한 대상을 한 서버에서 보세요.">
      <ul className="space-y-label">
        {pairs.map(({ docker, direct }) => {
          const key = pairKey(docker, direct);
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="min-w-0 type-body text-text-base">
                <span className="font-medium">{docker.server.name}</span>
                <span className="text-text-muted"> (Docker Collector) · </span>
                <span className="font-medium">{direct.server.name}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" aria-label={`합치기: ${docker.server.name} → ${direct.server.name}`}
                  onClick={() => navigate(serverPath(direct.server.id), { state: { mergeFrom: docker.server.id } })}>합치기</Button>
                <Button variant="quiet" size="sm" aria-label={`다른 호스트: ${docker.server.name}, ${direct.server.name}`} onClick={() => dismiss(key)}>아님</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
