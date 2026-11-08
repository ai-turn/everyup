import { useEffect, useState, type ReactNode } from 'react';
import type { AlertRule, ServiceHistoryPoint, TimelineIncident } from '../../../services/api';
import { UptimeFetchNotice } from '../../healthcheck/components/UptimeFetchNotice';
import { ResponseTimeCard, type ResponseFailure, type ResponseSlot } from './ResponseTimeCard';

interface BucketedResponseTimeChartProps {
  /** Memoize it: a new function reloads the chart. */
  load: () => Promise<ServiceHistoryPoint[]>;
  windowMs: number;
  bucketMs: number;
  caption: string;
  thresholds: AlertRule[];
  refreshKey?: number;
  controls?: ReactNode;
  incidents?: TimelineIncident[];
  failures?: ResponseFailure[];
}

// Docker 서비스 업타임 탭과 모니터 상세가 함께 쓰는 버킷 응답 시간 카드.
export function BucketedResponseTimeChart({ load, windowMs, bucketMs, caption, thresholds, refreshKey, controls, incidents, failures }: BucketedResponseTimeChartProps) {
  const [points, setPoints] = useState<ServiceHistoryPoint[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  // First load only — a refresh keeps the previous chart instead of flashing the skeleton.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await load();
        if (!active) return;
        setPoints(data);
        setError(false);
        setLoadedAt(Date.now());
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, [load, refreshKey, attempt]);

  // Each point is a bucket of checks. latencyMs averages the healthy checks only,
  // so a bucket where every check failed has no latency at all.
  const windowStart = loadedAt - windowMs;
  const buckets = points
    .map((point) => ({ point, t: new Date(point.time).getTime(), failed: Math.max(0, Math.min(point.total, Math.round(point.total * (1 - point.uptimePct / 100)))) }))
    // The card describes the chart's window only.
    .filter(({ point, t }) => point.total > 0 && t >= Math.floor(windowStart / bucketMs) * bucketMs && t <= loadedAt);
  const slots: ResponseSlot[] = buckets.map(({ point, t, failed }) => ({
    t,
    latencyMs: point.total > failed ? point.latencyMs : null,
    state: failed === 0 ? 'up' : point.uptimePct > 0 ? 'partial' : 'down',
    totalChecks: point.total,
    failedChecks: failed,
  }));

  return (
      <ResponseTimeCard
        slots={slots}
        caption={caption}
        window={[windowStart, loadedAt]}
        bucketMs={bucketMs}
        incidents={incidents}
        failures={failures}
        thresholds={thresholds}
        loading={loading}
        controls={controls}
        unavailable={error && loadedAt === 0}
        notice={error && <div className="mb-4"><UptimeFetchNotice source="체크 이력" onRetry={() => setAttempt((value) => value + 1)} /></div>}
      />
  );
}
