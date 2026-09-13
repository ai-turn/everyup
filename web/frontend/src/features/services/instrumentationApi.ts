import { request } from '../../services/api/base';
import type { SignalReceipt } from '../../services/api/agents';

export interface InstrumentationRun {
  id: string;
  agentId: string;
  project: string;
  targets: { key: string; name: string; runtime: string }[];
  captureBodies: boolean;
  status: 'planned' | 'applying' | 'verified' | 'failed' | 'rolled_back' | 'rollback_failed';
  reason: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  signals: SignalReceipt[];
}

export function createInstrumentationRun(agentId: string, project: string, keys: string[], captureBodies: boolean) {
  return request<InstrumentationRun>(`/agents/${agentId}/instrumentation-runs`, { method: 'POST', body: JSON.stringify({ project, keys, captureBodies }) });
}
