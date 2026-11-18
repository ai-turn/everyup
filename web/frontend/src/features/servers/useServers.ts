import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type InfrastructureResource, type ObservedService, type UptimeMonitor } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { buildServerRows, type ServerRow } from './serverStatus';

const settled = <T,>(result: PromiseSettledResult<T[] | null>): T[] | null => result.status === 'fulfilled' ? result.value ?? [] : null;

/** 불러오지 못한 대상 목록의 종류. stale이면 이전에 불러온 목록으로 보여 주고 있다. */
export interface FailedTargets { label: string; stale: boolean }

/** 머리말의 "일부 정보를 불러오지 못했습니다" 안내 문구 */
export function partialFailureMessage(failed: FailedTargets[]): string {
  const join = (stale: boolean) => failed.filter((item) => item.stale === stale).map((item) => item.label).join(', ');
  return [
    join(false) && `${join(false)} 정보를 제외한 결과입니다.`,
    join(true) && `${join(true)} 정보는 이전에 불러온 것입니다.`,
  ].filter(Boolean).join(' ');
}

interface LastLists { monitors: UptimeMonitor[] | null; apps: ObservedService[] | null; infrastructure: InfrastructureResource[] | null }

// 서버 목록은 새 집계 API 없이 기존 목록 응답을 serverId로 묶어서 만든다.
export function useServers(): {
  rows: ServerRow[];
  /** 다시 불러오는 중이다(가장 최근 요청이 아직 끝나지 않았다). */
  loading: boolean;
  /** 서버 목록을 한 번이라도 불러왔다 */
  loaded: boolean;
  /** 서버 목록 자체를 불러오지 못했다 */
  error: string | null;
  /** 대상 목록 가운데 불러오지 못한 종류. 비어 있으면 전부 성공 */
  failed: FailedTargets[];
  /** 서버 목록과 모든 대상 목록을 마지막으로 성공해서 불러온 시각. 일부라도 실패하면 바뀌지 않는다. */
  updatedAt: Date | null;
  /**
   * 다시 불러온다. 이 요청이나 그 뒤에 시작한 가장 최근 요청의 결과가 반영된 뒤에 끝난다.
   * 실패해도 거부하지 않는다(화면이 오류를 알린다).
   */
  reload: () => Promise<void>;
  /** 자동 갱신의 한 주기. 앞선 요청이 끝나지 않았으면 건너뛴다. */
  poll: () => void;
} {
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedTargets[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // 자동 갱신과 새로고침이 겹치면 마지막 요청의 결과만 쓴다.
  const latest = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const pending = useRef(false);
  // 종류마다 마지막으로 성공한 목록. 다시 불러오다 실패한 동안에만 쓴다(성공하면 새 목록으로 바뀐다).
  const last = useRef<LastLists>({ monitors: null, apps: null, infrastructure: null });

  const reload = useCallback((): Promise<void> => {
    const id = ++latest.current;
    pending.current = true;
    setLoading(true);
    const done: Promise<void> = Promise.allSettled([
      api.getServers(), api.getUptimeMonitors(true), api.getObservedServices(), api.getInfrastructureResources(), api.getLogSummary(),
    ]).then(([servers, monitors, apps, infrastructure, logSummaries]) => {
      if (id !== latest.current) return;
      pending.current = false;
      setLoading(false);
      const fresh = { monitors: settled(monitors), apps: settled(apps), infrastructure: settled(infrastructure) };
      const lists: LastLists = {
        monitors: fresh.monitors ?? last.current.monitors,
        apps: fresh.apps ?? last.current.apps,
        infrastructure: fresh.infrastructure ?? last.current.infrastructure,
      };
      last.current = lists;
      // 다시 불러오다 실패하면 이전 행을 지우지 않는다. 화면이 이전 정보임을 알린다.
      if (servers.status === 'rejected') { setError(getErrorMessage(servers.reason)); return; }
      setError(null);
      setLoaded(true);
      setRows(buildServerRows({
        servers: servers.value ?? [], ...lists, logSummaries: settled(logSummaries),
        stale: { monitors: !fresh.monitors, apps: !fresh.apps, infrastructure: !fresh.infrastructure },
      }));
      const failures = ([[monitors, '업타임', lists.monitors], [apps, '앱', lists.apps], [infrastructure, '인프라', lists.infrastructure], [logSummaries, '로그 요약', null]] as const)
        .filter(([result]) => result.status === 'rejected').map(([, label, list]) => ({ label, stale: list !== null }));
      setFailed(failures);
      if (failures.length === 0) setUpdatedAt(new Date());
    // 더 늦게 시작한 요청에 밀렸으면 그 요청이 반영될 때까지 기다린다. 기다리는 쪽(생성 뒤의 이동 등)이 옛 행을 보지 않게.
    }).then(() => (id === latest.current ? undefined : inFlight.current ?? undefined));
    inFlight.current = done;
    return done;
  }, []);

  const poll = useCallback(() => { if (!pending.current) void reload(); }, [reload]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { rows, loading, loaded, error, failed, updatedAt, reload, poll };
}
