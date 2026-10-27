import { useEffect, useState } from 'react';
import { UptimeOverview } from '../../uptime/components/UptimeOverview';
import { api, type ServiceHistoryPoint, type ServiceUptimeDay } from '../../../services/api';
import { UptimeFetchNotice } from './UptimeFetchNotice';

interface AgentUptimeOverviewProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
}

const HISTORY_DAYS = 90;

export function AgentUptimeOverview({ agentId, serviceKey, refreshKey }: AgentUptimeOverviewProps) {
  const [points, setPoints] = useState<ServiceHistoryPoint[] | null>(null);
  const [days, setDays] = useState<ServiceUptimeDay[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.getAgentServiceHistory(agentId, serviceKey, '24h'),
      api.getAgentServiceUptime(agentId, serviceKey, HISTORY_DAYS),
    ])
      .then(([historyPoints, uptimeDays]) => {
        if (!active) return;
        if (historyPoints.status === 'fulfilled') setPoints(historyPoints.value);
        if (uptimeDays.status === 'fulfilled') setDays(uptimeDays.value);
        setErrors([...(historyPoints.status === 'rejected' ? ['체크 이력'] : []), ...(uptimeDays.status === 'rejected' ? ['90일 이력'] : [])]);
        setLoading(false);
      })
    return () => { active = false; };
  }, [agentId, serviceKey, refreshKey, attempt]);

  const totalChecks = (points ?? []).reduce((sum, point) => sum + point.total, 0);
  const uptime24h = totalChecks > 0
    ? (points ?? []).reduce((sum, point) => sum + point.total * point.uptimePct, 0) / totalChecks
    : null;
  const checks90d = (days ?? []).reduce((sum, day) => sum + day.totalChecks, 0);
  const uptime90d = checks90d > 0
    ? (days ?? []).reduce((sum, day) => sum + day.healthyChecks, 0) / checks90d * 100
    : null;
  const incidentDays = (days ?? []).filter((day) => day.uptimePct < 99.5 && day.totalChecks > 0).length;

  return (
    <div className="space-y-3">
    {errors.length > 0 && <UptimeFetchNotice source={errors.join(', ')} onRetry={() => setAttempt((value) => value + 1)} />}
    <UptimeOverview
      loading={loading}
      error={!days && errors.includes('90일 이력') ? '조회 실패' : undefined}
      stats={[
        { label: '24시간 업타임', value: uptime24h === null ? '-' : `${uptime24h.toFixed(2)}%` },
        { label: '90일 업타임', value: uptime90d === null ? '-' : `${uptime90d.toFixed(2)}%` },
        { label: '24시간 체크', value: points === null ? '-' : totalChecks.toLocaleString() },
        { label: '90일 장애', value: checks90d === 0 ? '-' : `${incidentDays}일` },
      ]}
      days={(days ?? []).filter((day) => day.totalChecks > 0).map((day) => ({
        date: day.date,
        uptime: day.uptimePct,
        detail: `${day.healthyChecks}/${day.totalChecks} 정상`,
      }))}
    />
    </div>
  );
}
