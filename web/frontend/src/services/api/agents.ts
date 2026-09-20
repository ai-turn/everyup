import type { LogEntry, ApiRequest, LogHistogramBucket } from './services';
import type {
  ApiRequestStatBucket,
  ApiRequestStatusSummary,
  TraceListQuery,
  TraceSummary,
  OtelHistogramQuantiles,
  OtelMetricName,
  OtelMetricPoint,
  OtelServiceMetric,
} from './telemetry';
import { request } from './base';

function traceQuery(params?: TraceListQuery): URLSearchParams {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.minDurationMs) query.set('minDurationMs', String(params.minDurationMs));
  if (params?.errorsOnly) query.set('errorsOnly', 'true');
  if (params?.sort === 'slowest') query.set('sort', 'slowest');
  if (params?.limit) query.set('limit', String(params.limit));
  return query;
}

export interface ConnectedAgent {
  id: string;
  name: string;
  projectId?: string;
  version?: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  profile?: AgentProfile;
  capabilities?: AgentCapabilityReport;
}

export type AgentProfileKind = 'all-in-one' | 'basic' | 'custom';
export type AgentCollectionCapability = 'uptime' | 'logs' | 'infrastructure' | 'api' | 'metrics';

export interface AgentProfile {
  kind: AgentProfileKind;
  capabilities: AgentCollectionCapability[];
}

export type AgentCapabilityState = 'available' | 'degraded' | 'unavailable';

export interface AgentCapabilityStatus {
  state: AgentCapabilityState;
  reason?: string;
  detail?: string;
}

export interface AgentCapabilityReport {
  checkedAt: string;
  host: {
    os?: string;
    arch?: string;
    kernelVersion?: string;
    btf: boolean;
    lockdown?: string;
  };
  containerMonitoring: AgentCapabilityStatus;
  hostMetrics: AgentCapabilityStatus;
  automaticTracing: AgentCapabilityStatus;
  contextPropagation: AgentCapabilityStatus;
}

export interface AgentJoinCode {
  joinCode: string;
  expiresAt: string;
}

export interface SignalReceipt {
  serviceName: string;
  signal: string;
  firstReceivedAt: string;
  lastReceivedAt: string;
}

export interface CollectorSetupStatus {
  connected: boolean;
  lastContactAt?: string;
  lastEnrolledAt?: string;
  desiredHash: string;
  appliedHash: string;
  configApplied: boolean;
  profile: AgentProfile;
  signals: SignalReceipt[];
}

export interface AgentServiceSnapshot {
  agentId: string;
  key: string;
  name: string;
  checkType: string;
  endpoint: string;
  /** Agent-detected language runtime ("java", "node", "python", "go", "dotnet"). */
  runtime?: string;
  /** Container image ref incl tag (docker-discovered services only). */
  image?: string;
  /** Docker container restart count; >0 hints a crash/restart loop. */
  restartCount?: number;
  /** Container start time (ISO); UI derives uptime. Absent/zero for non-container services. */
  startedAt?: string;
  healthy: boolean;
  seen: boolean;
  silenced: boolean;
  lastError?: string;
  lastStatus?: number;
  lastLatency?: string;
  updatedAt?: string;
  observedAt: string;
}

// AgentServiceFlat adds agentName from the joined agents table.
export interface AgentServiceFlat extends AgentServiceSnapshot {
  agentName: string;
}

export interface AgentEvent {
  id: number;
  agentId: string;
  time: string;
  type: string;
  serviceName?: string;
  targetKey?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// One time-bucketed data point for the response-time chart.
export interface ServiceHistoryPoint {
  time: string;
  latencyMs: number;
  uptimePct: number;
  total: number;
}

// Per-day uptime for the 90-day calendar.
export interface ServiceUptimeDay {
  date: string;
  uptimePct: number;
  healthyChecks: number;
  totalChecks: number;
}

// Per-project KPI rollup for the home project cards (one row per agent).
export interface AgentOverview {
  agentId: string;
  uptimePct: number | null; // 30d weighted, null when no checks yet
  activeIncidents: number;
  requests24h: number;
  p95Ms: number | null; // latest timed bucket, null when no latency data
}

// One unhealthy episode derived from service history (project dashboard).
export interface AgentIncident {
  key: string;
  serviceName: string;
  startedAt: string;
  endedAt?: string; // absent while still unhealthy
  durationSec: number;
  active: boolean;
}

export const agentsApi = {
	getCollectorSetupStatus: (id: string) => request<CollectorSetupStatus>(`/agents/${id}/setup-status`),
	updateAgentProfile: (id: string, profile: AgentProfile) => request<AgentProfile>(`/agents/${id}/profile`, { method: 'PUT', body: JSON.stringify(profile) }),
  createAgent: (name: string, profile: AgentProfile) =>
    request<{ id: string; name: string; profile: AgentProfile } & AgentJoinCode>('/agents', {
      method: 'POST',
      body: JSON.stringify({ name, profile }),
    }),
  createAgentJoinCode: (agentId: string) =>
    request<AgentJoinCode>(`/agents/${agentId}/join-code`, { method: 'POST' }),
  deleteAgent: (agentId: string) =>
    request<void>(`/agents/${agentId}`, { method: 'DELETE' }),
  // Reveal the full API key. available=false for projects created before key storage existed.
  getAgentKey: (agentId: string) =>
    request<{ apiKey: string; available: boolean }>(`/agents/${agentId}/key`),
  rotateAgentKey: (agentId: string) =>
    request<{ apiKey: string }>(`/agents/${agentId}/rotate-key`, { method: 'POST' }),
  getAgents: () => request<ConnectedAgent[]>('/agents'),
  // Home project cards: per-agent KPI rollup in one call (no N+1).
  getAgentsOverview: () => request<AgentOverview[]>('/agents/overview'),
  getAgentServices: (agentId: string) => request<AgentServiceSnapshot[]>(`/agents/${agentId}/services`),
  getAgentEvents: (agentId: string, limit = 100) =>
    request<AgentEvent[]>(`/agents/${agentId}/events?limit=${limit}`),
  // Healthcheck page — Agent-based
  getAllAgentServicesFlat: () => request<AgentServiceFlat[]>('/agents/services/all'),
  getAgentServiceHistory: (agentId: string, key: string, range = '24h') =>
    request<ServiceHistoryPoint[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/history?range=${range}`),
  getAgentServiceUptime: (agentId: string, key: string, days = 90) =>
    request<ServiceUptimeDay[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/uptime?days=${days}`),
  getAgentServiceKeyEvents: (agentId: string, key: string, limit = 50) =>
    request<AgentEvent[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/events?limit=${limit}`),
  getAgentServiceLogs: (
    agentId: string, key: string,
    params?: { level?: string; search?: string; attrKey?: string; attrValue?: string; traceId?: string; from?: string; to?: string; limit?: number; offset?: number },
  ) => {
    const p = new URLSearchParams();
    p.set('limit', String(params?.limit ?? 100));
    if (params?.offset) p.set('offset', String(params.offset));
    if (params?.level) p.set('level', params.level);
    if (params?.search) p.set('search', params.search);
    if (params?.attrKey) { p.set('attrKey', params.attrKey); p.set('attrValue', params.attrValue ?? ''); }
    if (params?.traceId) p.set('traceId', params.traceId);
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    return request<{ data: LogEntry[]; total: number }>(`/agents/${agentId}/services/${encodeURIComponent(key)}/logs?${p}`);
  },
  // Per-level log counts bucketed over time (logs-tab volume histogram).
  getAgentServiceLogHistogram: (
    agentId: string, key: string,
    params?: { level?: string; search?: string; attrKey?: string; attrValue?: string; from?: string; to?: string; bucketMins?: number },
  ) => {
    const p = new URLSearchParams();
    if (params?.level) p.set('level', params.level);
    if (params?.search) p.set('search', params.search);
    if (params?.attrKey) { p.set('attrKey', params.attrKey); p.set('attrValue', params.attrValue ?? ''); }
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    if (params?.bucketMins) p.set('bucketMins', String(params.bucketMins));
    return request<LogHistogramBucket[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/log-histogram?${p}`);
  },
  getAgentServiceRequests: (
    agentId: string, key: string,
    params?: { search?: string; errorsOnly?: boolean; traceId?: string; from?: string; to?: string; limit?: number; offset?: number },
  ) => {
    const p = new URLSearchParams();
    p.set('limit', String(params?.limit ?? 100));
    if (params?.offset) p.set('offset', String(params.offset));
    if (params?.search) p.set('search', params.search);
    if (params?.errorsOnly) p.set('errorsOnly', 'true');
    if (params?.traceId) p.set('traceId', params.traceId);
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    return request<{ data: ApiRequest[]; total: number }>(`/agents/${agentId}/services/${encodeURIComponent(key)}/requests?${p}`);
  },
  getAgentServiceRequestStats: (
    agentId: string, key: string,
    params?: { from?: string; to?: string; bucketMins?: number },
  ) => {
    const p = new URLSearchParams();
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    if (params?.bucketMins) p.set('bucketMins', String(params.bucketMins));
    return request<ApiRequestStatBucket[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/request-stats?${p}`);
  },
  // Project-level Requests trend: rolls up all of an agent's services.
  getAgentRequestStats: (
    agentId: string,
    params?: { from?: string; to?: string; bucketMins?: number },
  ) => {
    const p = new URLSearchParams();
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    if (params?.bucketMins) p.set('bucketMins', String(params.bucketMins));
    return request<ApiRequestStatBucket[]>(`/agents/${agentId}/request-stats?${p}`);
  },
  // Status-class distribution + top 5xx endpoint. Omit key for the agent rollup.
  getRequestStatusSummary: (
    agentId: string, key?: string,
    params?: { from?: string; to?: string },
  ) => {
    const p = new URLSearchParams();
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    const base = key
      ? `/agents/${agentId}/services/${encodeURIComponent(key)}/request-status-summary`
      : `/agents/${agentId}/request-status-summary`;
    return request<ApiRequestStatusSummary>(`${base}?${p}`);
  },
  // Project-level uptime rollup across all of the agent's services.
  getAgentUptime: (agentId: string, days = 90) =>
    request<ServiceUptimeDay[]>(`/agents/${agentId}/uptime?days=${days}`),
  // Unhealthy episodes derived from service history, newest first.
  getAgentIncidents: (agentId: string, days = 30, limit = 20) =>
    request<AgentIncident[]>(`/agents/${agentId}/incidents?days=${days}&limit=${limit}`),
  // Each service's representative metric (latest value) for the project cards.
  getAgentServiceMetrics: (agentId: string) =>
    request<OtelServiceMetric[]>(`/agents/${agentId}/service-metrics`),
  getAgentServiceOtelMetricNames: (agentId: string, key: string) =>
    request<OtelMetricName[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/otel-metrics`),
  getAgentServiceOtelMetricPoints: (
    agentId: string, key: string,
    params: { name: string; from?: string; to?: string; limit?: number },
  ) => {
    const p = new URLSearchParams();
    p.set('name', params.name);
    if (params.from) p.set('from', params.from);
    if (params.to) p.set('to', params.to);
    if (params.limit) p.set('limit', String(params.limit));
    return request<OtelMetricPoint[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/otel-metrics/points?${p}`);
  },
  // Trace discovery: the only path to a trace api_requests did not project.
  getAgentServiceTraces: (agentId: string, key: string, params?: TraceListQuery) =>
    request<TraceSummary[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/traces?${traceQuery(params)}`),
  // p50/p95/p99 from an explicit histogram's buckets; null for other shapes.
  getAgentServiceOtelMetricQuantiles: (
    agentId: string, key: string, params: { name: string; from?: string; to?: string },
  ) => {
    const p = new URLSearchParams();
    p.set('name', params.name);
    if (params.from) p.set('from', params.from);
    if (params.to) p.set('to', params.to);
    return request<OtelHistogramQuantiles | null>(`/agents/${agentId}/services/${encodeURIComponent(key)}/otel-metrics/quantiles?${p}`);
  },
  // Per-service OTLP ingest filter: which log levels are stored. [] = accept all.
  getAgentServiceLogFilter: (agentId: string, key: string) =>
    request<{ levels: string[] }>(`/agents/${agentId}/services/${encodeURIComponent(key)}/log-filter`),
  setAgentServiceLogFilter: (agentId: string, key: string, levels: string[]) =>
    request<{ levels: string[] }>(`/agents/${agentId}/services/${encodeURIComponent(key)}/log-filter`, {
      method: 'PUT',
      body: JSON.stringify({ levels }),
    }),
};
