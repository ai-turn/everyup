import { useCallback } from 'react';
import type { GlobalTimeRange } from '../../../components/common';
import { useAlertThresholds } from '../../alerts/useAlertThresholds';
import { BucketedResponseTimeChart } from '../../uptime/components/BucketedResponseTimeChart';
import { api } from '../../../services/api';

interface AgentResponseTimeChartProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

const RANGE_MS: Record<GlobalTimeRange, number> = { '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000 };
const BUCKET_MS: Record<GlobalTimeRange, number> = { '1h': 120_000, '6h': 300_000, '24h': 1_200_000 };

export function AgentResponseTimeChart({ agentId, serviceKey, refreshKey, range }: AgentResponseTimeChartProps) {
  const load = useCallback(() => api.getAgentServiceHistory(agentId, serviceKey, range), [agentId, serviceKey, range]);
  const thresholds = useAlertThresholds({ kind: 'agent', agentId, serviceKey }, 'response_time');
  return <BucketedResponseTimeChart load={load} windowMs={RANGE_MS[range]} bucketMs={BUCKET_MS[range]} caption={`${BUCKET_MS[range] / 60_000}분 평균`} thresholds={thresholds} refreshKey={refreshKey} />;
}
