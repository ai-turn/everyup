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

export function AgentResponseTimeChart({ agentId, serviceKey, refreshKey, range }: AgentResponseTimeChartProps) {
  const load = useCallback(() => api.getAgentServiceHistory(agentId, serviceKey, range), [agentId, serviceKey, range]);
  const thresholds = useAlertThresholds({ kind: 'agent', agentId, serviceKey }, 'response_time');
  return <BucketedResponseTimeChart load={load} windowMs={RANGE_MS[range]} caption="ms" thresholds={thresholds} refreshKey={refreshKey} />;
}
