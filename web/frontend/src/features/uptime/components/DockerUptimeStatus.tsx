import { StatusLight } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';
import { dockerUptimeState } from '../../../utils/operationalStatus';

const statuses = {
  paused: { tone: 'idle', label: '일시정지' },
  waiting: { tone: 'idle', label: '확인 대기' },
  stale: { tone: 'warn', label: '수집 지연' },
  up: { tone: 'healthy', label: '정상' },
  down: { tone: 'error', label: '장애' },
} as const;

export function DockerUptimeStatus({ service }: { service: AgentServiceFlat }) {
  return <StatusLight {...statuses[dockerUptimeState(service)]} />;
}
