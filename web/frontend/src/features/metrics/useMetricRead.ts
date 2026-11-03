import { useEffect, useState } from 'react';
import { api, type MetricQuery, type MetricQueryResult, type OtelHistogramQuantiles, type OtelMetricName } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import type { MetricWindow } from './useMetricQuery';

export type MetricSource =
  | { kind: 'agent'; agentId: string; serviceKey: string }
  | { kind: 'direct'; observedServiceId: string };

export function useMetricRead(source: MetricSource, meta: OtelMetricName, window: MetricWindow, attributes: string, series: string, expanded: boolean, refreshKey = 0) {
  const [retryKey, setRetryKey] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; window: MetricWindow; data: MetricQueryResult } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [distribution, setDistribution] = useState<{ key: string; data: OtelHistogramQuantiles | null; error?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const selection = JSON.stringify([meta.metricName, meta.metricType, meta.unit ?? '', attributes, series]);
  const key = JSON.stringify({ source, selection, from: window.from, to: window.to, expanded, refreshKey, retryKey });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const input = JSON.parse(key) as { source: MetricSource; selection: string; from: string; to: string; expanded: boolean };
    const [name, type, unit, attrs, selected] = JSON.parse(input.selection) as string[];
    const params: MetricQuery = { name, type, unit, from: input.from, to: input.to, attributes: attrs || undefined, series: selected || undefined };
    const load = async () => {
      setPending(true);
      setError(null);
      try {
        const data = input.source.kind === 'direct'
          ? await api.queryObservedServiceMetric(input.source.observedServiceId, params, controller.signal)
          : await api.queryAgentServiceMetric(input.source.agentId, input.source.serviceKey, params, controller.signal);
        if (cancelled) return;
        setSnapshot({ key, window, data });
        if (input.expanded && type === 'histogram') {
          try {
            const scoped = { ...params, series: JSON.stringify(data.selectedSeries) };
            const quantiles = input.source.kind === 'direct'
              ? await api.getObservedServiceOtelMetricQuantiles(input.source.observedServiceId, scoped, controller.signal)
              : await api.getAgentServiceOtelMetricQuantiles(input.source.agentId, input.source.serviceKey, scoped, controller.signal);
            if (!cancelled) setDistribution({ key, data: quantiles });
          } catch (cause) {
            if (!cancelled) setDistribution({ key, data: null, error: getErrorMessage(cause) });
          }
        }
      } catch (cause) {
        if (!cancelled) setError({ key, message: getErrorMessage(cause) });
      } finally {
        if (!cancelled) setPending(false);
      }
    };
    void load();
    return () => { cancelled = true; controller.abort(); };
  }, [key, window]);

  // Refresh retains the previous chart only when its selection and range agree.
  const previousSelection = snapshot ? (JSON.parse(snapshot.key) as { selection: string }).selection : null;
  const shown = previousSelection === selection && snapshot?.window.range === window.range ? snapshot : null;
  return {
    data: shown?.data ?? null,
    options: snapshot?.data ?? null,
    displayedWindow: shown?.window ?? window,
    error: error?.key === key ? error.message : null,
    quantiles: distribution?.key === key && snapshot?.key === key ? distribution.data : null,
    quantilesError: distribution?.key === key ? distribution.error : null,
    quantilesLoading: expanded && meta.metricType === 'histogram' && snapshot?.key === key && distribution?.key !== key,
    pending,
    retry: () => setRetryKey(value => value + 1),
  };
}
