import { useCallback, useRef, useState } from 'react';
import { api, type UptimeMonitor, type UptimeMonitorHistory, type UptimeMonitorMetric, type UptimeMonitorSummary } from '../../services/api';
import { ApiError, getErrorMessage } from '../../utils/errors';

type DetailState = {
  monitor: UptimeMonitor | null;
  metrics: UptimeMonitorMetric[] | null;
  summary: UptimeMonitorSummary | null;
  history: UptimeMonitorHistory | null;
  errors: { monitor?: string; metrics?: string; summary?: string; history?: string };
  notFound: boolean;
  loading: boolean;
  refreshing: boolean;
};

// The page is keyed by monitorId: a late result belongs only to that instance.
export function useUptimeMonitorDetail(monitorId: string) {
  const [state, setState] = useState<DetailState>({ monitor: null, metrics: null, summary: null, history: null, errors: {}, notFound: false, loading: true, refreshing: false });
  const pending = useRef<Promise<void> | null>(null);
  const load = useCallback(() => {
    if (pending.current) return pending.current;
    setState((current) => ({ ...current, refreshing: true }));
    const request = Promise.allSettled([
      api.getUptimeMonitor(monitorId),
      api.getUptimeMonitorMetrics(monitorId, 100),
      api.getUptimeMonitorSummary(monitorId, '30d'),
      api.getUptimeMonitorHistory(monitorId, 90),
    ]).then(([monitor, metrics, summary, history]) => {
      const notFound = monitor.status === 'rejected' && monitor.reason instanceof ApiError && monitor.reason.status === 404;
      setState((current) => ({
        monitor: monitor.status === 'fulfilled' ? monitor.value : notFound ? null : current.monitor,
        metrics: metrics.status === 'fulfilled' ? metrics.value ?? [] : current.metrics,
        summary: summary.status === 'fulfilled' ? summary.value : current.summary,
        history: history.status === 'fulfilled' ? history.value : current.history,
        errors: {
          monitor: monitor.status === 'rejected' ? getErrorMessage(monitor.reason) : undefined,
          metrics: metrics.status === 'rejected' ? getErrorMessage(metrics.reason) : undefined,
          summary: summary.status === 'rejected' ? getErrorMessage(summary.reason) : undefined,
          history: history.status === 'rejected' ? getErrorMessage(history.reason) : undefined,
        },
        notFound, loading: false, refreshing: false,
      }));
    }).finally(() => { pending.current = null; });
    pending.current = request;
    return request;
  }, [monitorId]);
  return { ...state, load };
}
