import { useEffect, useState } from 'react';
import type { GlobalTimeRange } from '../../../components/common';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import { ResponseTimeCard, type ResponseSlot } from '../../uptime/components/ResponseTimeCard';
import { api, type ServiceHistoryPoint } from '../../../services/api';

interface AgentResponseTimeChartProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

const RANGE_MS: Record<GlobalTimeRange, number> = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 };

export function AgentResponseTimeChart({ agentId, serviceKey, refreshKey, range }: AgentResponseTimeChartProps) {

  const [points, setPoints] = useState<ServiceHistoryPoint[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  // First load only — a refresh keeps the previous chart instead of flashing the skeleton.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setPoints(await api.getAgentServiceHistory(agentId, serviceKey, range));
      } catch {
        setPoints([]);
      } finally {
        setLoadedAt(Date.now());
        setLoading(false);
      }
    };
    void load();
  }, [agentId, serviceKey, range, refreshKey]);

  const thresholds = useAlertThresholds({ kind: 'agent', agentId, serviceKey }, 'response_time');

  // Each point is a bucket of checks. latencyMs averages the healthy checks only,
  // so a bucket where every check failed has no latency at all.
  const windowStart = loadedAt - RANGE_MS[range];
  const buckets = points
    .map((point) => ({ point, t: new Date(point.time).getTime(), failed: Math.round(point.total * (1 - point.uptimePct / 100)) }))
    // The card describes the chart's window only.
    .filter(({ t }) => t >= windowStart);
  const slots: ResponseSlot[] = buckets.map(({ point, t, failed }) => ({
    t,
    latencyMs: point.uptimePct > 0 ? Math.round(point.latencyMs) : null,
    state: failed === 0 ? 'up' : point.uptimePct > 0 ? 'partial' : 'down',
    detail: failed === 0 ? `${point.total}회 정상` : `${point.total}회 중 ${failed}회 실패`,
  }));

  return (
    <ResponseTimeCard
      className="mb-8"
      slots={slots}
      failedChecks={buckets.reduce((sum, bucket) => sum + bucket.failed, 0)}
      caption="ms"
      window={[windowStart, loadedAt]}
      thresholds={thresholds}
      loading={loading}
    />
  );
}
