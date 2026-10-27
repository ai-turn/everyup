import { StatusLight } from '../../../components/common';
import type { UptimeMonitor } from '../../../services/api';
import { UPTIME_STATE_LIGHT, uptimeState } from '../uptimeState';

export function UptimeMonitorStatusBadge({ monitor }: { monitor: UptimeMonitor }) {
  const [tone, label] = UPTIME_STATE_LIGHT[uptimeState(monitor)];
  return <StatusLight tone={tone} label={label} />;
}
