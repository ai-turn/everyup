import { CollectionStatusBadge, StatusLight } from '../../../components/common';
import type { ConnectedAgent } from '../../../services/api';
import { ENVIRONMENT_INSTALL_LABEL, environmentState } from '../environmentState';

/** Docker 환경의 상태 표시. 목록과 환경 머리말이 같이 쓴다(`environmentState`). */
export function EnvironmentStatus({ agent }: { agent: Pick<ConnectedAgent, 'version' | 'lastSeenAt'> }) {
  const state = environmentState(agent);
  return state === 'install' ? <StatusLight tone="idle" label={ENVIRONMENT_INSTALL_LABEL} /> : <CollectionStatusBadge status={state} />;
}
