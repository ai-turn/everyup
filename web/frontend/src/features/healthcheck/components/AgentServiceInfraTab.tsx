import type { GlobalTimeRange } from '../../../components/common';
import { InfraTrends } from '../../infra/components/InfraTrends';
import { useInfraMetrics } from '../../../hooks/useInfra';

interface Props {
  agentId: string;
  refreshKey: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

export function AgentServiceInfraTab({ agentId, refreshKey, range }: Props) {
  const { data, loading, error } = useInfraMetrics(agentId, range, refreshKey);
  // 현재 값은 차트 머리에 있다 — 인프라 상세와 같은 구성.
  return <InfraTrends hostId={agentId} charts={data?.charts} loading={loading} range={range} error={error} />;
}
