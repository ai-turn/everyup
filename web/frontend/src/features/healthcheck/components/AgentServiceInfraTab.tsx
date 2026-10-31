import type { GlobalTimeRange } from '../../../components/common';
import { InfraGauges } from '../../infra/components/InfraGauges';
import { InfraTrends } from '../../infra/components/InfraTrends';
import { useInfraMetrics } from '../../../hooks/useInfra';

interface Props {
  agentId: string;
  refreshKey: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

export function AgentServiceInfraTab({ agentId, refreshKey, range }: Props) {
  const { data, loading } = useInfraMetrics(agentId, range, refreshKey);
  return (
    <div className="space-y-5">
      <InfraGauges gauges={data?.gauges} loading={loading} />
      <InfraTrends hostId={agentId} charts={data?.charts} loading={loading} range={range} />
    </div>
  );
}
