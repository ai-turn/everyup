import { useCallback, useEffect, useState } from 'react';
import { useAutoRefresh } from './useAutoRefresh';
import { api, type AgentServiceFlat, type UptimeMonitor } from '../services/api';
import { uptimeState } from '../features/uptime/uptimeState';

// 지금 장애인 대상 수. 사이드바 개요 배지와 탭 제목의 "(N) 장애"가 같은 값을 쓴다(MainLayout이 한 번 읽는다).
// 개요의 "장애 N"과 같은 판정이다 — Docker 서비스만 세면 업타임 모니터 장애가 빠져 두 숫자가 갈렸다.
// 모니터는 서버 목록과 같은 uptimeState로 센다(일시정지한 모니터의 마지막 상태는 장애가 아니다).
export function useFailureCount(): number {
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);

  const load = useCallback(async () => {
    // Navigation remains available even when its alert badge cannot load.
    const [servicesResult, monitorsResult] = await Promise.allSettled([api.getAllAgentServicesFlat(), api.getUptimeMonitors()]);
    if (servicesResult.status === 'fulfilled') setServices(servicesResult.value ?? []);
    if (monitorsResult.status === 'fulfilled') setMonitors(monitorsResult.value ?? []);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  useAutoRefresh(() => void load(), 30_000);

  return services.filter((service) => !service.healthy).length
    + monitors.filter((monitor) => uptimeState(monitor) === 'down').length;
}
