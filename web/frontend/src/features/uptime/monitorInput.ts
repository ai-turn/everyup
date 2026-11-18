import type { UptimeMonitor, UptimeMonitorInput } from '../../services/api';

// PUT은 전체 설정을 받는다. 일시정지나 이동처럼 한 값만 바꿀 때도 나머지를 현재 값으로 채운다.
// 수정 요청에는 항상 소속 서버를 넣는다(설계 5.5). 빼면 백엔드는 서버 화면 이전의 요청으로 처리한다.
export const monitorInput = (monitor: UptimeMonitor, changes: Partial<UptimeMonitorInput> = {}): UptimeMonitorInput => ({
  name: monitor.name, serverId: monitor.serverId, type: monitor.type, url: monitor.type === 'http' ? monitor.url : undefined,
  host: monitor.type === 'tcp' ? monitor.url : undefined, port: monitor.port, method: monitor.method,
  expectedStatus: monitor.expectedStatus, timeout: monitor.timeout, interval: monitor.interval, isActive: monitor.isActive,
  ...changes,
});
