import { useEffect, useRef, useState } from 'react';
import { api, type ApiRequestStatusSummary, type ObservedService } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import type { RequestWindow } from './useRequestQuery';

export interface ApiTarget {
  service: ObservedService;
  summary?: ApiRequestStatusSummary;
  error?: string;
  loading?: boolean;
}

export function useApiTargets(window: RequestWindow, refreshKey: number) {
  const [rows, setRows] = useState<ApiTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    generation.current += 1;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const services = await api.getObservedServices('traces');
        const results = await Promise.all(services.map(async service => {
          try {
            return { service, summary: await api.getObservedServiceRequestStatusSummary(service.id, window) };
          } catch (error) {
            return { service, error: getErrorMessage(error) };
          }
        }));
        if (active) setRows(results);
      } catch (error) {
        if (active) setError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; generation.current += 1; };
  }, [window, refreshKey]);
  const retryTarget = async (id: string) => {
    const version = generation.current;
    setRows(current => current.map(row => row.service.id === id ? { ...row, error: undefined, loading: true } : row));
    try {
      const summary = await api.getObservedServiceRequestStatusSummary(id, window);
      if (generation.current === version) setRows(current => current.map(row => row.service.id === id ? { service: row.service, summary } : row));
    } catch (error) {
      if (generation.current === version) setRows(current => current.map(row => row.service.id === id ? { service: row.service, error: getErrorMessage(error) } : row));
    }
  };
  return { rows, loading, error, retryTarget };
}
