import { useEffect, useState, type ReactNode } from 'react';
import { UptimeOverview, UptimeStats } from '../../uptime/components/UptimeOverview';
import { uptimeKpis } from '../../uptime/uptimeKpis';
import { api, type ServiceHistoryPoint, type ServiceUptimeDay } from '../../../services/api';
import { UptimeFetchNotice } from './UptimeFetchNotice';

interface AgentUptimeOverviewProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
  /** 수치와 90일 띠 사이(응답 시간 차트). 모니터 상세와 같은 순서다: 수치 → 응답 추이 → 장기 이력. */
  children?: ReactNode;
}

const HISTORY_DAYS = 90;

export function AgentUptimeOverview({ agentId, serviceKey, refreshKey, children }: AgentUptimeOverviewProps) {
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
  // 버킷의 지연은 성공한 체크의 평균이라, 성공한 체크 수로 가중한다.
  const healthy = (point: ServiceHistoryPoint) => point.total * point.uptimePct / 100;
  const healthy24h = (points ?? []).reduce((sum, point) => sum + healthy(point), 0);
  const avgResponse24h = healthy24h > 0 ? (points ?? []).reduce((sum, point) => sum + point.latencyMs * healthy(point), 0) / healthy24h : null;
  const share = (list: ServiceUptimeDay[]) => {
    const checks = list.reduce((sum, day) => sum + day.totalChecks, 0);
    return checks > 0 ? list.reduce((sum, day) => sum + day.healthyChecks, 0) / checks * 100 : null;
  };
  // 30일은 가장 최근 날(오늘)부터 거꾸로 30일이다. 날짜는 'YYYY-MM-DD'라 글자 비교가 곧 날짜 비교다.
  const latest = (days ?? []).reduce((max, day) => day.date > max ? day.date : max, '');
  const monthStart = latest && new Date(Date.parse(latest) - 29 * 86_400_000).toISOString().slice(0, 10);
  const uptime30d = share((days ?? []).filter((day) => day.date >= monthStart));
  const uptime90d = share(days ?? []);

  return (
    // 모니터 상세와 같은 구역 간격(section)이다.
    <div className="space-y-section">
      <section className="space-y-heading">
        {errors.length > 0 && <UptimeFetchNotice source={errors.join(', ')} onRetry={() => setAttempt((value) => value + 1)} />}
        <h2 className="sr-only">주요 지표</h2>
        <UptimeStats stats={loading ? uptimeKpis({}) : uptimeKpis({ uptime24h, uptime30d, avgResponse24h })} />
      </section>
      {children}
      <UptimeOverview
        loading={loading}
        error={!days && errors.includes('90일 이력') ? '조회 실패' : undefined}
        stats={[]}
        historyUptime={uptime90d ?? undefined}
        days={(days ?? []).filter((day) => day.totalChecks > 0).map((day) => ({
          date: day.date,
          uptime: day.uptimePct,
          detail: `${day.healthyChecks}/${day.totalChecks} 정상`,
        }))}
      />
    </div>
  );
}
