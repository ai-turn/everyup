import { useEffect, useState } from 'react';
import type { AlertRule, ServiceHistoryPoint } from '../../../services/api';
import { UptimeFetchNotice } from '../../healthcheck/components/UptimeFetchNotice';
import { ResponseTimeCard, type ResponseSlot } from './ResponseTimeCard';

interface BucketedResponseTimeChartProps {
  /** Memoize it: a new function reloads the chart. */
  load: () => Promise<ServiceHistoryPoint[]>;
  windowMs: number;
  caption: string;
  thresholds: AlertRule[];
  refreshKey?: number;
}

// Docker 서비스 업타임 탭과 모니터 상세가 함께 쓰는 버킷 응답 시간 카드.
export function BucketedResponseTimeChart({ load, windowMs, caption, thresholds, refreshKey }: BucketedResponseTimeChartProps) {
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
    .map((point) => ({ point, t: new Date(point.time).getTime(), failed: Math.round(point.total * (1 - point.uptimePct / 100)) }))
    // The card describes the chart's window only.
    .filter(({ t }) => t >= windowStart);
  const slots: ResponseSlot[] = buckets.map(({ point, t, failed }) => ({
    t,
    latencyMs: point.uptimePct > 0 ? Math.round(point.latencyMs) : null,
    state: failed === 0 ? 'up' : point.uptimePct > 0 ? 'partial' : 'down',
    detail: failed === 0 ? `${point.total}회 정상` : `${point.total}회 중 ${failed}회 실패`,
  }));

  return (
    <div className="space-y-3">
      {error && <UptimeFetchNotice source="체크 이력" onRetry={() => setAttempt((value) => value + 1)} />}
      {(!error || loadedAt > 0) && <ResponseTimeCard
        slots={slots}
        failedChecks={buckets.reduce((sum, bucket) => sum + bucket.failed, 0)}
        caption={caption}
        window={[windowStart, loadedAt]}
        thresholds={thresholds}
        loading={loading}
      />}
    </div>
  );
}
