import { StatusLight, type StatusTone } from '../../../components/common';
import type { UptimeMonitor } from '../../../services/api';

export function UptimeMonitorStatusBadge({ monitor }: { monitor: UptimeMonitor }) {
  const [tone, label]: [StatusTone, string] = !monitor.isActive
    ? ['idle', '일시정지']
    : monitor.status === 'healthy'
      ? ['healthy', '정상']
      : monitor.status === 'unhealthy'
        ? ['error', '장애']
        : ['idle', '확인 대기'];
  return <StatusLight tone={tone} label={label} />;
}
