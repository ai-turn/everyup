import { request } from './base';

// --- Types ---

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LogHistogramBucket {
  time: string;
  error: number;
  warn: number;
  info: number;
  debug: number;
  trace: number;
}

export interface LinkedRequest {
  id: number;
  method: string;
  path: string;
  statusCode: number;
  isError: boolean;
}

export interface LogEntry {
  id: number;
  serviceId: string;
  agentId?: string;
  serviceName?: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  source?: 'internal' | 'otlp';
  fingerprint?: string;
  traceId?: string;
  spanId?: string;
  createdAt: string;
  linkedRequest?: LinkedRequest;
}

export interface ApiRequest {
  id: number;
  serviceId: string;
  requestId: string;
  method: string;
  path: string;
  pathTemplate: string;
  route?: string;
  serviceName?: string;
  traceId?: string;
  spanId?: string;
  statusCode: number;
  durationMs: number;
  clientIp?: string;
  error?: string;
  isError: boolean;
  createdAt: string;
}

export interface TraceSpanEvent {
  name: string;
  timeUnixNano?: number;
  attributes?: Record<string, unknown>;
}

export interface TraceSpan {
  id: number;
  serviceId?: string;
  serviceName?: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  startUnixNano: number;
  endUnixNano: number;
  durationMs: number;
  statusCode?: string;
  statusMessage?: string;
  attributes?: Record<string, unknown>;
  events?: TraceSpanEvent[];
  resource?: Record<string, unknown>;
  createdAt: string;
}

export interface TraceDetail {
  traceId: string;
  spans: TraceSpan[];
  logs: LogEntry[];
  apiRequests: ApiRequest[];
}

export interface AuditEvent {
  id: number;
  userId: number;
  username: string;
  action: string;
  traceId?: string;
  metadata?: string;
  createdAt: string;
}

export type UptimeMonitorType = 'http' | 'tcp';
export type UptimeMonitorStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface UptimeMonitor {
  id: string;
  name: string;
  projectId?: string;
  type: UptimeMonitorType;
  isActive: boolean;
  url: string;
  port?: number;
  method: string;
  expectedStatus: number;
  timeout: number;
  interval: number;
  status: UptimeMonitorStatus;
  lastCheckAt?: string;
  uptime?: number;
  responseTime?: number;
}

export interface UptimeMonitorInput {
  name: string;
  type: UptimeMonitorType;
  url?: string;
  host?: string;
  port?: number;
  method?: string;
  expectedStatus?: number;
  timeout?: number;
  interval?: number;
  isActive?: boolean;
}

export interface UptimeMonitorMetric {
  id: number;
  serviceId: string;
  status: 'success' | 'failure';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}

export interface UptimeMonitorSummary {
  serviceId: string;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptime: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
}

export interface UptimeMonitorDay {
  date: string;
  status: 'up' | 'partial' | 'down';
  uptime: number;
}

export interface UptimeMonitorHistory {
  percentage: number;
  days: UptimeMonitorDay[];
}

// --- API ---

export const servicesApi = {
  getUptimeMonitors: () => request<UptimeMonitor[]>('/services?type=http,tcp'),

  getUptimeMonitor: (id: string) =>
    request<UptimeMonitor>(`/services/${id}`),

  getUptimeMonitorMetrics: (id: string, limit = 100) =>
    request<UptimeMonitorMetric[]>(`/services/${id}/metrics?limit=${limit}`),

  getUptimeMonitorSummary: (id: string, duration = '30d') =>
    request<UptimeMonitorSummary | null>(`/services/${id}/metrics/summary?duration=${duration}`),

  getUptimeMonitorHistory: (id: string, days = 90) =>
    request<UptimeMonitorHistory>(`/services/${id}/uptime?days=${days}`),

  createUptimeMonitor: (data: UptimeMonitorInput) =>
    request<UptimeMonitor>('/services', { method: 'POST', body: JSON.stringify(data) }),

  updateUptimeMonitor: (id: string, data: UptimeMonitorInput) =>
    request<UptimeMonitor>(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUptimeMonitor: (id: string) =>
    request<void>(`/services/${id}`, { method: 'DELETE' }),

  getTrace: (traceId: string) =>
    request<TraceDetail>(`/traces/${traceId}`),

  getAuditEvents: (params?: { action?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<AuditEvent[]>(`/audit${qs ? `?${qs}` : ''}`);
  },
};
