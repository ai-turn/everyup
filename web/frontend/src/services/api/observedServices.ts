import { request } from './base';
import type { ApiRequest, LogEntry, LogHistogramBucket, LogLevel } from './services';
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

export type TelemetrySignal = 'logs' | 'metrics' | 'traces';

export interface ObservedService {
  id: string;
  name: string;
  projectId?: string;
  signals: TelemetrySignal[];
  logLevelFilter?: LogLevel[];
  apiExcludePaths?: string[];
  isActive: boolean;
  apiKeyMasked?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObservedServiceInput {
  name: string;
  projectId?: string;
  signals: TelemetrySignal[];
}

export interface ObservedServiceSetup extends ObservedService {
  apiKey: string;
}

export interface DirectLogQuery {
  level?: LogLevel;
  search?: string;
  // Exact match on one structured attribute, e.g. http.route=/orders.
  attrKey?: string;
  attrValue?: string;
  traceId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface DirectMetricPointQuery {
  name: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface DirectApiRequestQuery {
  search?: string;
  errorsOnly?: boolean;
  from?: string;
  to?: string;
  minStatus?: number;
  maxStatus?: number;
  limit?: number;
  offset?: number;
}

function logQuery(params?: DirectLogQuery): URLSearchParams {
  const query = new URLSearchParams();
  query.set('limit', String(params?.limit ?? 100));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.level) query.set('level', params.level);
  if (params?.search) query.set('search', params.search);
  if (params?.attrKey) { query.set('attrKey', params.attrKey); query.set('attrValue', params.attrValue ?? ''); }
  if (params?.traceId) query.set('traceId', params.traceId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  return query;
}

function apiRequestQuery(params?: DirectApiRequestQuery): URLSearchParams {
  const query = new URLSearchParams();
  query.set('limit', String(params?.limit ?? 100));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.search) query.set('search', params.search);
  if (params?.errorsOnly) query.set('errorsOnly', 'true');
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.minStatus) query.set('minStatus', String(params.minStatus));
  if (params?.maxStatus) query.set('maxStatus', String(params.maxStatus));
  return query;
}

export const observedServicesApi = {
  getObservedServices: (signal?: TelemetrySignal) =>
    request<ObservedService[]>(`/observed-services${signal ? `?signal=${signal}` : ''}`),

  getObservedService: (id: string) =>
    request<ObservedService>(`/observed-services/${id}`),

  createObservedService: (data: ObservedServiceInput) =>
    request<ObservedServiceSetup>('/observed-services', { method: 'POST', body: JSON.stringify(data) }),

  updateObservedService: (id: string, data: ObservedServiceInput) =>
    request<ObservedService>(`/observed-services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteObservedService: (id: string) =>
    request<void>(`/observed-services/${id}`, { method: 'DELETE' }),

  rotateObservedServiceKey: (id: string) =>
    request<ObservedServiceSetup>(`/observed-services/${id}/rotate-key`, { method: 'POST' }),

  revokeObservedServiceKey: (id: string) =>
    request<ObservedService>(`/observed-services/${id}/revoke-key`, { method: 'POST' }),

  getObservedServiceLogs: (id: string, params?: DirectLogQuery) =>
    request<{ data: LogEntry[]; total: number }>(`/observed-services/${id}/logs?${logQuery(params)}`),

  getObservedServiceLogHistogram: (
    id: string,
    params?: Omit<DirectLogQuery, 'traceId' | 'limit' | 'offset'> & { bucketMins?: number },
  ) => {
    const query = logQuery(params);
    query.delete('limit');
    if (params?.bucketMins) query.set('bucketMins', String(params.bucketMins));
    return request<LogHistogramBucket[]>(`/observed-services/${id}/log-histogram?${query}`);
  },

  getObservedServiceLogFilter: (id: string) =>
    request<{ levels: LogLevel[] }>(`/observed-services/${id}/log-filter`),

  setObservedServiceLogFilter: (id: string, levels: LogLevel[]) =>
    request<{ levels: LogLevel[] }>(`/observed-services/${id}/log-filter`, {
      method: 'PUT',
      body: JSON.stringify({ levels }),
    }),

  getObservedServiceMetrics: () =>
    request<OtelServiceMetric[]>('/observed-services/service-metrics'),

  getObservedServiceOtelMetricNames: (id: string) =>
    request<OtelMetricName[]>(`/observed-services/${id}/otel-metrics`),

  getObservedServiceOtelMetricPoints: (id: string, params: DirectMetricPointQuery) => {
    const query = new URLSearchParams({ name: params.name });
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.limit) query.set('limit', String(params.limit));
    return request<OtelMetricPoint[]>(`/observed-services/${id}/otel-metrics/points?${query}`);
  },

  // Trace discovery: the only path to a trace api_requests did not project.
  getObservedServiceTraces: (id: string, params?: TraceListQuery) => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.minDurationMs) query.set('minDurationMs', String(params.minDurationMs));
    if (params?.errorsOnly) query.set('errorsOnly', 'true');
    if (params?.sort === 'slowest') query.set('sort', 'slowest');
    if (params?.limit) query.set('limit', String(params.limit));
    return request<TraceSummary[]>(`/observed-services/${id}/traces?${query}`);
  },
  // p50/p95/p99 from an explicit histogram's buckets; null for other shapes.
  getObservedServiceOtelMetricQuantiles: (id: string, params: { name: string; from?: string; to?: string }) => {
    const query = new URLSearchParams({ name: params.name });
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    return request<OtelHistogramQuantiles | null>(`/observed-services/${id}/otel-metrics/quantiles?${query}`);
  },

  getObservedServiceRequests: (id: string, params?: DirectApiRequestQuery) =>
    request<{ data: ApiRequest[]; total: number }>(`/observed-services/${id}/requests?${apiRequestQuery(params)}`),

  getObservedServiceRequestStats: (
    id: string,
    params?: { from?: string; to?: string; bucketMins?: number },
  ) => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.bucketMins) query.set('bucketMins', String(params.bucketMins));
    return request<ApiRequestStatBucket[]>(`/observed-services/${id}/request-stats?${query}`);
  },

  getObservedServiceRequestStatusSummary: (
    id: string,
    params?: { from?: string; to?: string },
  ) => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    return request<ApiRequestStatusSummary>(`/observed-services/${id}/request-status-summary?${query}`);
  },

  getObservedServiceApiExclusions: (id: string) =>
    request<{ paths: string[] }>(`/observed-services/${id}/api-exclusions`),

  setObservedServiceApiExclusions: (id: string, paths: string[]) =>
    request<{ paths: string[] }>(`/observed-services/${id}/api-exclusions`, {
      method: 'PUT',
      body: JSON.stringify({ paths }),
    }),
};
