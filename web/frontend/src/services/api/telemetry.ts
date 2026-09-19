// Shared OpenTelemetry read models used by Agent-discovered and direct
// Observed Services.
export interface OtelMetricName {
  metricName: string;
  metricType: 'gauge' | 'sum' | 'histogram';
  unit?: string;
  lastAt: string;
}

export interface OtelMetricPoint {
  id: number;
  metricName: string;
  metricType: string;
  unit?: string;
  attributes?: Record<string, unknown>;
  value: number;
  count?: number;
  total?: number;
  createdAt: string;
}

// Latency distribution recovered from an explicit histogram's stored buckets.
// Null when the metric is not an explicit-bucket histogram — an average-only
// shape (gauge, sum, exponential histogram, summary) has no recoverable tail.
export interface MetricExemplar {
  traceId: string;
  spanId?: string;
  value: number;
  time: string;
}

export interface OtelHistogramQuantiles {
  metricName: string;
  unit?: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  // Tail measurements that carry a trace ID, slowest first.
  exemplars?: MetricExemplar[];
}

// One trace collapsed to a row. Reachable regardless of whether the trace was
// projected into api_requests, which only keeps HTTP server spans.
export interface TraceSummary {
  traceId: string;
  name: string;
  kind: string;
  serviceName?: string;
  startTime: string;
  durationMs: number;
  spanCount: number;
  errorCount: number;
}

export interface TraceListQuery {
  from?: string;
  to?: string;
  minDurationMs?: number;
  errorsOnly?: boolean;
  sort?: 'recent' | 'slowest';
  limit?: number;
}

export interface OtelServiceMetric {
  serviceId?: string;
  serviceName: string;
  metricName: string;
  metricType: string;
  unit?: string;
  value: number;
}

// Shared API trace projections used by Agent-discovered and direct Observed
// Services.
export interface ApiRequestStatBucket {
  time: string;
  count: number;
  errorCount: number;
  p50: number;
  p95: number;
  timed: number;
}

export interface ApiRequestStatusSummary {
  count2xx: number;
  count3xx: number;
  count4xx: number;
  count5xx: number;
  countOther: number;
  top5xxMethod?: string;
  top5xxPath?: string;
  top5xxCount?: number;
}
