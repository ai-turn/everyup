import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type InfrastructureResource, type LogServiceSummary, type ObservedService, type UptimeMonitor } from '../../services/api';

/** 이보다 빨리 끝나는 다시 불러오기는 진행 중으로 보이지 않는다(30초마다 버튼이 깜빡이지 않게). */
const BUSY_AFTER_MS = 300;
/** 응답 없이 이보다 오래 걸린 요청은 버려진 것으로 보고 다음 주기와 새로고침을 다시 허용한다(API 클라이언트에 시간 제한이 없다). */
const ABANDON_AFTER_MS = 30_000;
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
    join(true) && `${join(true)} 정보는 이전에 불러온 것입니다. 최신 상태는 확인할 수 없습니다.`,
  ].filter(Boolean).join(' ');
}

/** 대상을 이전 목록과 지금의 행에서 빼거나(next 없음) 응답으로 바꾼다(신호를 해제한 앱, 다른 서버로 옮긴 대상). */
export type ForgetTarget = {
  (kind: 'monitors', id: string, next?: UptimeMonitor): void;
  (kind: 'apps', id: string, next?: ObservedService): void;
  (kind: 'infrastructure', id: string, next?: InfrastructureResource): void;
};

type BuildInput = Parameters<typeof buildServerRows>[0];

interface LastLists { monitors: UptimeMonitor[] | null; apps: ObservedService[] | null; infrastructure: InfrastructureResource[] | null }

// 서버 목록은 새 집계 API 없이 기존 목록 응답을 serverId로 묶어서 만든다.
export function useServers({ logSummary = true }: {
  /**
   * 24시간 오류 로그 수(/logs/summary)를 불러온다. 무거운 조회라 그 수를 보여 주지 않는 화면(개요, 그룹)은 끈다.
   * 끄면 errorLogs는 "조회 실패"가 아니라 쓰지 않는 값이다(unavailable과 failed에 들어가지 않는다).
   */
  logSummary?: boolean;
} = {}): {
  rows: ServerRow[];
  /** 다시 불러오는 중이다(가장 최근 요청이 아직 끝나지 않았다). */
  loading: boolean;
  /** 다시 불러오기가 BUSY_AFTER_MS를 넘게 걸리고 있다. 새로고침 버튼이 진행 중으로 보인다. */
  busy: boolean;
  /** 서버 목록을 한 번이라도 불러왔다 */
  loaded: boolean;
  /** 서버 목록 자체를 불러오지 못했다 */
  error: string | null;
  /** 대상 목록 가운데 불러오지 못한 종류. 비어 있으면 전부 성공 */
  failed: FailedTargets[];
  /**
   * 서버 목록과 대상 목록(모니터, 앱, 인프라)을 마지막으로 성공해서 불러온 시각. 그중 하나라도 실패하면 바뀌지 않는다.
   * 로그 요약과 메트릭 지표 목록은 이전 결과를 보여 주지 않으므로(실패하면 "불러오지 못함") 판정에서 뺀다.
   */
  updatedAt: Date | null;
  /**
   * 다시 불러온다. 이 요청이나 그 뒤에 시작한 가장 최근 요청의 결과가 반영된 뒤에 끝난다.
   * 실패해도 거부하지 않는다(화면이 오류를 알린다).
   */
  reload: () => Promise<void>;
  /** 자동 갱신의 한 주기. 앞선 요청이 끝나지 않았으면 건너뛴다. */
  poll: () => void;
  /** 사용자의 새로고침. 앞선 요청이 끝나지 않았으면 새로 보내지 않고 그 요청에 합류한다. */
  refresh: () => Promise<void>;
  /**
   * 삭제한 대상을 이전 목록에서 빼거나(next 없음) 신호를 해제한 앱을 바꾼다. 그 뒤의 다시 불러오기가 실패해도
   * 지운 대상이 다시 보이지 않게(목록, 개수, 탭의 대상 수) 하고, 남은 패널이 처리 중으로 멈추지 않게 한다.
   */
  forgetTarget: ForgetTarget;
} {
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedTargets[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // 자동 갱신과 새로고침이 겹치면 마지막 요청의 결과만 쓴다.
  const latest = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  // 끝나지 않은 가장 최근 요청을 시작한 시각. 없으면 null.
  const pendingSince = useRef<number | null>(null);
  // 종류마다 마지막으로 성공한 목록. 다시 불러오다 실패한 동안에만 쓴다(성공하면 새 목록으로 바뀐다).
  const last = useRef<LastLists>({ monitors: null, apps: null, infrastructure: null });
  // 마지막으로 행을 만든 입력. forgetTarget이 바뀐 목록으로 행을 다시 만들 때 쓴다(서버 목록 조회가 실패해도 행이 대상을 빼도록).
  const lastBuild = useRef<BuildInput | null>(null);
  // 언마운트 때 정리할 타이머
  const timers = useRef(new Set<number>());
  const later = (run: () => void, ms: number) => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); run(); }, ms);
    timers.current.add(timer);
    return timer;
  };
  const cancel = (timer: number) => { window.clearTimeout(timer); timers.current.delete(timer); };
  useEffect(() => { const pending = timers.current; return () => pending.forEach((timer) => window.clearTimeout(timer)); }, []);

  const reload = useCallback((): Promise<void> => {
    const id = ++latest.current;
    pendingSince.current = Date.now();
    setLoading(true);
    const busyTimer = later(() => { if (id === latest.current) setBusy(true); }, BUSY_AFTER_MS);
    // 매달린 요청은 버린다. 늦게 와도 더 새 요청이 없으면 그대로 반영된다(새 요청이 있으면 위의 id 비교가 버린다).
    const abandonTimer = later(() => {
      if (id !== latest.current) return;
      pendingSince.current = null;
      setLoading(false);
      setBusy(false);
    }, ABANDON_AFTER_MS);
    const done: Promise<void> = Promise.allSettled([
      api.getServers(), api.getUptimeMonitors(true), api.getObservedServices(), api.getInfrastructureResources(),
      logSummary ? api.getLogSummary() : Promise.resolve(undefined), api.getObservedServiceMetricCatalog(),
    ]).then(([servers, monitors, apps, infrastructure, logSummaries, metricCatalog]) => {
      cancel(busyTimer);
      cancel(abandonTimer);
      if (id !== latest.current) return;
      pendingSince.current = null;
      setLoading(false);
      setBusy(false);
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
      lastBuild.current = {
        servers: servers.value ?? [], ...lists, logSummaries: logSummary ? settled(logSummaries as PromiseSettledResult<LogServiceSummary[] | null>) : undefined, metricCatalog: settled(metricCatalog),
        stale: { monitors: !fresh.monitors, apps: !fresh.apps, infrastructure: !fresh.infrastructure },
      };
      setRows(buildServerRows(lastBuild.current));
      const failures = ([[monitors, '업타임', lists.monitors], [apps, '앱', lists.apps], [infrastructure, '인프라', lists.infrastructure],
        [logSummaries, '로그 요약', null], [metricCatalog, '메트릭 임계값', null]] as const)
        .filter(([result]) => result.status === 'rejected').map(([, label, list]) => ({ label, stale: list !== null }));
      setFailed(failures);
      if ([monitors, apps, infrastructure].every((result) => result.status === 'fulfilled')) setUpdatedAt(new Date());
    // 더 늦게 시작한 요청에 밀렸으면 그 요청이 반영될 때까지 기다린다. 기다리는 쪽(생성 뒤의 이동 등)이 옛 행을 보지 않게.
    }).then(() => (id === latest.current ? undefined : inFlight.current ?? undefined));
    inFlight.current = done;
    return done;
  }, [logSummary]);

  // 시작한 지 ABANDON_AFTER_MS가 지난 요청은 끝나지 않았어도 기다리지 않는다(타이머와 같은 시각에 와도 판정이 같게 시각으로 본다).
  const waiting = () => pendingSince.current !== null && Date.now() - pendingSince.current < ABANDON_AFTER_MS;
  const poll = useCallback(() => { if (!waiting()) void reload(); }, [reload]);
  const refresh = useCallback(() => (waiting() && inFlight.current ? inFlight.current : reload()), [reload]);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  // 이전 목록과 지금의 행에 함께 반영한다. 행은 같은 함수로 다시 만들어 상태, 원인, 수치가 목록과 어긋나지 않게 한다.
  const forget = useCallback((kind: keyof LastLists, id: string, next?: { id: string }) => {
    // 응답이 그 대상이 아니면(빈 응답 등) 바꾸지 않고 뺀다.
    const replacement = next && !Array.isArray(next) && next.id === id ? [next] : [];
    const replace = (list: { id: string }[] | null) => list?.flatMap((item) => (item.id !== id ? [item] : replacement)) ?? null;
    // 종류마다 같은 모양의 목록이라 키로 바꾼다(ForgetTarget의 오버로드가 kind와 next의 짝을 강제한다).
    last.current = { ...last.current, [kind]: replace(last.current[kind]) } as LastLists;
    if (lastBuild.current) {
      lastBuild.current = { ...lastBuild.current, [kind]: replace(lastBuild.current[kind]) } as BuildInput;
      setRows(buildServerRows(lastBuild.current));
    }
  }, []);
  const forgetTarget = forget as ForgetTarget;

  return { forgetTarget, rows, loading, busy, loaded, error, failed, updatedAt, reload, poll, refresh };
}
