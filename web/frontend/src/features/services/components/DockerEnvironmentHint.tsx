import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api';

// 메뉴는 직접 설정한 대상만 보여 준다(ADR 0007). Docker 환경이 있으면 그 데이터가 어디 있는지 알려 준다.
export function DockerEnvironmentHint() {
  const [hasEnvironment, setHasEnvironment] = useState(false);
  useEffect(() => {
    let alive = true;
    api.getAgents().then(agents => { if (alive) setHasEnvironment((agents ?? []).length > 0); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!hasEnvironment) return null;
  return (
    <p className="text-center type-body text-text-muted">
      Docker Collector가 수집한 데이터는 <Link to="/environments" className="text-action hover:underline">Docker 환경</Link>에서 확인합니다.
    </p>
  );
}
