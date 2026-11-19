import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type TimelineIncident, type UptimeMonitor, type UptimeMonitorHistory, type UptimeMonitorMetric, type UptimeMonitorSummary } from '../../services/api';
import { ApiError, getErrorMessage } from '../../utils/errors';

type DetailState = {
  monitor: UptimeMonitor | null;
  metrics: UptimeMonitorMetric[] | null;
  summary: UptimeMonitorSummary | null;
  history: UptimeMonitorHistory | null;
  incidents: TimelineIncident[] | null;
  failures: UptimeMonitorMetric[] | null;
  errors: { monitor?: string; metrics?: string; summary?: string; history?: string; incidents?: string; failures?: string };
  notFound: boolean;
  loading: boolean;
  refreshing: boolean;
};

// 패널(UptimeMonitorPanel)은 monitorId를 key로 그린다. 늦게 온 응답은 그 인스턴스의 것이다.
export function useUptimeMonitorDetail(monitorId: string) {
  const [state, setState] = useState<DetailState>({ monitor: null, metrics: null, summary: null, history: null, incidents: null, failures: null, errors: {}, notFound: false, loading: true, refreshing: false });
  const pending = useRef<Promise<void> | null>(null);
  // 서버 상세에서 화살표 키로 탭을 지나가면 마운트 직후 언마운트된다. 그 뒤에 온 응답은 버린다.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(() => {
    if (pending.current) return pending.current;
    setState((current) => ({ ...current, refreshing: true }));
    const request = Promise.allSettled([
      api.getUptimeMonitor(monitorId),
      api.getUptimeMonitorMetrics(monitorId, 100),
      api.getUptimeMonitorSummary(monitorId, '30d'),
      api.getUptimeMonitorHistory(monitorId, 90),
      api.getUptimeMonitorIncidents(monitorId, 90),
      api.getUptimeMonitorFailures(monitorId, 90),
    ]).then(([monitor, metrics, summary, history, incidents, failures]) => {
      if (!alive.current) return;
      const notFound = monitor.status === 'rejected' && monitor.reason instanceof ApiError && monitor.reason.status === 404;
      setState((current) => ({
        monitor: monitor.status === 'fulfilled' ? monitor.value : notFound ? null : current.monitor,
        metrics: metrics.status === 'fulfilled' ? metrics.value ?? [] : current.metrics,
        summary: summary.status === 'fulfilled' ? summary.value : current.summary,
        history: history.status === 'fulfilled' ? history.value : current.history,
        incidents: incidents.status === 'fulfilled' ? incidents.value ?? [] : current.incidents,
        failures: failures.status === 'fulfilled' ? failures.value ?? [] : current.failures,
        errors: {
          monitor: monitor.status === 'rejected' ? getErrorMessage(monitor.reason) : undefined,
          metrics: metrics.status === 'rejected' ? getErrorMessage(metrics.reason) : undefined,
          summary: summary.status === 'rejected' ? getErrorMessage(summary.reason) : undefined,
          history: history.status === 'rejected' ? getErrorMessage(history.reason) : undefined,
          incidents: incidents.status === 'rejected' ? getErrorMessage(incidents.reason) : undefined,
          failures: failures.status === 'rejected' ? getErrorMessage(failures.reason) : undefined,
        },
        notFound, loading: false, refreshing: false,
      }));
    }).finally(() => { pending.current = null; });
    pending.current = request;
    return request;
  }, [monitorId]);
  return { ...state, load };
}
