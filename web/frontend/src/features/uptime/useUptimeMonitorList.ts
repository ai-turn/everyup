import { useCallback, useEffect, useRef, useState } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { api, type UptimeMonitor } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

/** enabled가 false이면 불러오지 않는다. 목록을 부모가 가지고 있을 때(서버 상세) 쓴다. */
export function useUptimeMonitorList(suspended: boolean, enabled = true) {
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const pending = useRef<Promise<void> | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(() => {
    if (pending.current) return pending.current;
    setRefreshing(true);
    pending.current = api.getUptimeMonitors(true).then((result) => {
      if (!alive.current) return;
      setMonitors(result ?? []);
      setError(null);
      setUpdatedAt(new Date());
    }).catch((cause: unknown) => {
      if (alive.current) setError(getErrorMessage(cause));
    }).finally(() => {
      pending.current = null;
      if (!alive.current) return;
      setLoading(false);
      setRefreshing(false);
    });
    return pending.current;
  }, []);

  // 변경 전에 시작한 조회가 있으면 마친 뒤 다시 읽어 변경 결과를 확인한다.
  const reloadAfterChange = useCallback(async () => {
    await pending.current;
    await load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, enabled]);
  useAutoRefresh(() => void load(), 30_000, enabled && autoRefresh && !suspended);

  const changeAutoRefresh = (enabled: boolean) => {
    setAutoRefresh(enabled);
    if (enabled) void load();
  };

  return { monitors, loading, refreshing, error, updatedAt, autoRefresh, changeAutoRefresh, load, reloadAfterChange };
}
