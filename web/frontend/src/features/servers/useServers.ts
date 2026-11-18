import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { buildServerRows, type ServerRow } from './serverStatus';

const settled = <T,>(result: PromiseSettledResult<T[] | null>): T[] | null => result.status === 'fulfilled' ? result.value ?? [] : null;

// 서버 목록은 새 집계 API 없이 기존 목록 응답을 serverId로 묶어서 만든다.
export function useServers(): {
  rows: ServerRow[];
  loading: boolean;
  /** 서버 목록 자체를 불러오지 못했다 */
  error: string | null;
  /** 대상 목록 가운데 불러오지 못한 종류의 라벨. 비어 있으면 전부 성공 */
  failed: string[];
  updatedAt: Date | null;
  reload: () => void;
} {
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // 자동 갱신과 새로고침이 겹치면 마지막 요청의 결과만 쓴다.
  const latest = useRef(0);

  const reload = useCallback(() => {
    const id = ++latest.current;
    setLoading(true);
    void Promise.allSettled([
      api.getServers(), api.getUptimeMonitors(true), api.getObservedServices(), api.getInfrastructureResources(), api.getLogSummary(),
    ]).then(([servers, monitors, apps, infrastructure, logSummaries]) => {
      if (id !== latest.current) return;
      setLoading(false);
      // 다시 불러오다 실패하면 이전 행을 지우지 않는다. 화면이 이전 정보임을 알린다.
      if (servers.status === 'rejected') { setError(getErrorMessage(servers.reason)); return; }
      setError(null);
      setRows(buildServerRows({
        servers: servers.value ?? [],
        monitors: settled(monitors), apps: settled(apps), infrastructure: settled(infrastructure), logSummaries: settled(logSummaries),
      }));
      setFailed(([[monitors, '업타임'], [apps, '앱'], [infrastructure, '인프라'], [logSummaries, '로그 요약']] as const)
        .filter(([result]) => result.status === 'rejected').map(([, label]) => label));
      setUpdatedAt(new Date());
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { rows, loading, error, failed, updatedAt, reload };
}
