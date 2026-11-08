import { useCallback, useEffect, useRef, useState } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { api, type UptimeMonitor } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

export function useUptimeMonitorList(suspended: boolean) {
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const pending = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    if (pending.current) return pending.current;
    setRefreshing(true);
    pending.current = api.getUptimeMonitors(true).then((result) => {
      setMonitors(result ?? []);
      setError(null);
      setUpdatedAt(new Date());
    }).catch((cause: unknown) => {
      setError(getErrorMessage(cause));
    }).finally(() => {
      setLoading(false);
      setRefreshing(false);
      pending.current = null;
    });
    return pending.current;
  }, []);

  // 변경 전에 시작한 조회가 있으면 마친 뒤 다시 읽어 변경 결과를 확인한다.
  const reloadAfterChange = useCallback(async () => {
    await pending.current;
    await load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useAutoRefresh(() => void load(), 30_000, autoRefresh && !suspended);

  const changeAutoRefresh = (enabled: boolean) => {
    setAutoRefresh(enabled);
    if (enabled) void load();
  };

  return { monitors, loading, refreshing, error, updatedAt, autoRefresh, changeAutoRefresh, load, reloadAfterChange };
}
