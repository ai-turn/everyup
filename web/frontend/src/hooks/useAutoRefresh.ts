import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook for auto-refreshing data at a specified interval
 * @param callback - Function to call on each refresh
 * @param interval - Interval in milliseconds
 * @param enabled - Whether auto-refresh is enabled
 */
export function useAutoRefresh(
  callback: () => void,
  interval: number,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    // 숨겨진 탭에서는 갱신하지 않고, 다시 보이면 기다리지 않고 한 번 갱신한다.
    const tick = () => {
      if (!document.hidden) savedCallback.current();
    };

    const timer = setInterval(tick, interval);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [interval, enabled]);

  // Manual refresh function
  const refresh = useCallback(() => {
    savedCallback.current();
  }, []);

  return { refresh };
}
