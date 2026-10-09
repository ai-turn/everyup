import type { GlobalTimeRange } from '../../../components/common';
import { InfraGauges } from '../../infra/components/InfraGauges';
import { InfraTrends } from '../../infra/components/InfraTrends';

interface Props {
  agentId: string;
  refreshKey: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

export function AgentServiceInfraTab({ agentId, refreshKey, range }: Props) {
  return (
    <div className="space-y-5">
      <InfraGauges hostId={agentId} refreshKey={refreshKey} />
      <InfraTrends hostId={agentId} refreshKey={refreshKey} range={range} />
    </div>
  );
}
