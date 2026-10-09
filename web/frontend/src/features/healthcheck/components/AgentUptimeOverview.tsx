import { useEffect, useState } from 'react';
import { UptimeOverview } from '../../uptime/components/UptimeOverview';
import { api, type ServiceHistoryPoint, type ServiceUptimeDay } from '../../../services/api';

interface AgentUptimeOverviewProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
}

const HISTORY_DAYS = 90;

export function AgentUptimeOverview({ agentId, serviceKey, refreshKey }: AgentUptimeOverviewProps) {
  const [points, setPoints] = useState<ServiceHistoryPoint[]>([]);
  const [days, setDays] = useState<ServiceUptimeDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getAgentServiceHistory(agentId, serviceKey, '24h').catch(() => []),
      api.getAgentServiceUptime(agentId, serviceKey, HISTORY_DAYS).catch(() => []),
    ])
      .then(([historyPoints, uptimeDays]) => {
        setPoints(historyPoints);
        setDays(uptimeDays);
      })
      .finally(() => setLoading(false));
  }, [agentId, serviceKey, refreshKey]);

  const totalChecks = points.reduce((sum, point) => sum + point.total, 0);
  const uptime24h = points.length > 0
    ? points.reduce((sum, point) => sum + point.uptimePct, 0) / points.length
    : null;
  const uptime90d = days.length > 0
    ? days.reduce((sum, day) => sum + day.uptimePct, 0) / days.length
    : null;
  const incidentDays = days.filter((day) => day.uptimePct < 99.5).length;

  return (
    <UptimeOverview
      loading={loading}
      stats={[
        { label: '24시간 업타임', value: uptime24h === null ? '—' : `${uptime24h.toFixed(2)}%` },
        { label: '90일 업타임', value: uptime90d === null ? '—' : `${uptime90d.toFixed(2)}%` },
        { label: '24시간 체크', value: loading ? '—' : totalChecks.toLocaleString() },
        { label: '90일 장애', value: loading ? '—' : `${incidentDays}일` },
      ]}
      days={days.map((day) => ({
        date: day.date,
        uptime: day.uptimePct,
        detail: `${day.healthyChecks}/${day.totalChecks} 정상`,
      }))}
    />
  );
}
