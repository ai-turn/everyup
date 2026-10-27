import { useEffect, useState } from 'react';
import { UptimeOverview } from '../../uptime/components/UptimeOverview';
import { api, type ServiceUptimeDay } from '../../../services/api';

interface AgentCheckHistoryBarProps {
  agentId: string;
  refreshKey?: number;
  className?: string;
}

const HISTORY_DAYS = 90;

export function AgentCheckHistoryBar({ agentId, refreshKey, className }: AgentCheckHistoryBarProps) {
  const [days, setDays] = useState<ServiceUptimeDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgentUptime(agentId, HISTORY_DAYS)
      .then(setDays)
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [agentId, refreshKey]);

  const uptime90d = days.length > 0
    ? days.reduce((sum, day) => sum + day.uptimePct, 0) / days.length
    : null;
  const incidentDays = days.filter((day) => day.uptimePct < 99.5).length;

  return (
    <UptimeOverview
      className={className}
      loading={loading}
      stats={[
        { label: '90일 업타임', value: uptime90d === null ? '-' : `${uptime90d.toFixed(2)}%` },
        { label: '90일 장애', value: loading ? '-' : `${incidentDays}일` },
      ]}
      days={days.map((day) => ({
        date: day.date,
        uptime: day.uptimePct,
        detail: `${day.healthyChecks}/${day.totalChecks} 정상`,
      }))}
    />
  );
}
