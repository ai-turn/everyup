import { useState, type KeyboardEvent } from 'react';
import {
  CHART_HEIGHT, ChartCard, ChartEmpty, ChartLegend, ChartSkeleton, OPERATOR_LABEL,
  formatAxisValue, formatTimeLabel, formatTimeTick, niceTicks, timeTicks,
} from '../../../components/charts';

export type SlotState = 'up' | 'partial' | 'down';

/** One check, or one bucket of checks. */
export interface ResponseSlot {
  t: number;
  /** null when every check in the slot failed — a failed check's time is its timeout, not a response. */
  latencyMs: number | null;
  state: SlotState;
  /** Shown on hover, e.g. "HTTP 503 · upstream timeout" or "12회 중 3회 실패". */
  detail: string;
}

interface ResponseTimeCardProps {
  slots: ResponseSlot[];
  /** Failed checks in the window — a bucket can hold several. */
  failedChecks: number;
  caption: string;
  /** The queried window; without it the chart spans the slots. */
  window?: [number, number];
  thresholds?: { id: string; operator: string; threshold: number }[];
  loading?: boolean;
  className?: string;
}

const LANE = 16;
const LANE_GAP = 8;
const X_LABELS = 20;
const BARS = CHART_HEIGHT - LANE - LANE_GAP - X_LABELS;
// The bar covers this share of its slot; the whole slot is the hover target.
const BAR_SHARE = 0.62;

const LANE_CLASS: Record<SlotState, string> = {
  up: 'bg-status-healthy/45',
  partial: 'bg-status-warn',
  down: 'bg-status-error',
};

function medianStep(times: number[]): number | null {
  const steps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  return steps.length > 0 ? steps[Math.floor(steps.length / 2)] : null;
}

const round = (value: number) => String(Math.round(value));

/**
 * 응답 시간 — Datadog Synthetics처럼 체크마다 결과 칸 하나와 막대 하나를 세로로 맞춘다. 실패는
 * 결과 칸의 빨강과 바닥의 짧은 빨간 막대로만 말한다: 실패한 체크의 시간은 타임아웃이라 막대 높이가
 * 되면 차트를 늘리고, 전체 높이 음영은 두 번의 실패도 차트에서 가장 큰 모양이 됐다.
 * 막대는 시간 위치에 놓인다 — 수집이 끊긴 구간은 빈칸으로 보인다.
 */
export function ResponseTimeCard({ slots, failedChecks, caption, window, thresholds = [], loading = false, className = '' }: ResponseTimeCardProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const step = medianStep(slots.map((slot) => slot.t)) ?? 3_600_000;
  const [from, to] = window ?? (slots.length > 0 ? [slots[0].t - step / 2, slots[slots.length - 1].t + step / 2] : [0, 1]);
  const span = Math.max(to - from, 1);
  const pct = (t: number) => ((t - from) / span) * 100;
  const slotWidth = Math.min(100, (step / span) * 100);

  const latencies = slots.flatMap((slot) => (slot.latencyMs === null ? [] : [slot.latencyMs]));
  const ticks = niceTicks(Math.max(0, ...latencies, ...thresholds.map((rule) => rule.threshold)));
  const top = ticks[ticks.length - 1];
  const hasPartial = slots.some((slot) => slot.state === 'partial');
  const hoveredSlot = hovered === null ? null : slots[hovered];

  // One tab stop for the whole chart; arrow keys walk the checks.
  const moveFocus = (event: KeyboardEvent) => {
    const last = slots.length - 1;
    const current = hovered ?? last;
    const next = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setHovered(Math.max(0, Math.min(last, next)));
  };

  const legend = [
    { label: '성공', color: 'var(--color-primary)' },
    ...(hasPartial ? [{ label: '일부 실패', color: 'var(--color-status-warn)' }] : []),
    { label: '실패', color: 'var(--color-status-error)' },
  ];

  return (
    <ChartCard as="h2" title="응답 시간" unit={caption} className={className} right={!loading && slots.length > 0 && <ChartLegend items={legend} />}>
      {loading ? (
        <ChartSkeleton />
      ) : slots.length === 0 ? (
        <ChartEmpty />
      ) : (
        <>
          <div className="flex" style={{ height: CHART_HEIGHT }}>
            {/* Y gutter: the lane's name, then the bar scale. */}
            <div className="relative w-11 shrink-0 type-caption text-text-muted">
              <span className="absolute left-0 top-0 leading-4">결과</span>
              {ticks.map((tick) => (
                <span key={tick} className="absolute right-2 translate-y-1/2 font-medium tabular-nums" style={{ bottom: X_LABELS + (tick / top) * BARS }}>
                  {formatAxisValue(tick, 'ms')}
                </span>
              ))}
            </div>

            <div
              className="relative min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              role="group"
              tabIndex={0}
              aria-label="체크별 결과와 응답 시간 — 방향키로 체크를 옮깁니다"
              onKeyDown={moveFocus}
              onFocus={() => setHovered((index) => index ?? slots.length - 1)}
              onBlur={() => setHovered(null)}
              onMouseLeave={() => setHovered(null)}
            >
              {ticks.map((tick) => (
                <div key={tick} className="absolute inset-x-0 border-t border-chart-border/60" style={{ bottom: X_LABELS + (tick / top) * BARS }} />
              ))}
              {thresholds.map((rule) => (
                <div key={rule.id} className="absolute inset-x-0 border-t border-dashed border-status-error" style={{ bottom: X_LABELS + (rule.threshold / top) * BARS }}>
                  <span className="absolute right-0 -top-5 type-caption text-status-error">{`알림 ${OPERATOR_LABEL[rule.operator] ?? '>'} ${rule.threshold}ms`}</span>
                </div>
              ))}

              {slots.map((slot, index) => (
                <div
                  key={slot.t}
                  className={`absolute top-0 flex -translate-x-1/2 flex-col items-center rounded-sm ${index === hovered ? 'bg-ui-hover' : ''}`}
                  style={{ left: `${pct(slot.t)}%`, width: `${slotWidth}%`, height: LANE + LANE_GAP + BARS }}
                  onMouseEnter={() => setHovered(index)}
                >
                  <span className={`rounded-sm ${LANE_CLASS[slot.state]}`} style={{ width: `${BAR_SHARE * 100}%`, height: LANE }} />
                  <span className="relative w-full" style={{ marginTop: LANE_GAP, height: BARS }}>
                    <span
                      className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-sm ${slot.latencyMs === null ? 'bg-status-error' : 'bg-primary/85'}`}
                      style={{
                        width: `${BAR_SHARE * 100}%`,
                        // A slot where everything failed is a short red stub on the baseline.
                        height: slot.latencyMs === null ? 6 : `${(slot.latencyMs / top) * 100}%`,
                      }}
                    />
                  </span>
                </div>
              ))}

              {timeTicks(from, to).map((t) => (
                <span key={t} className="absolute bottom-0 -translate-x-1/2 type-caption font-medium text-text-muted" style={{ left: `${pct(t)}%` }}>
                  {formatTimeTick(t)}
                </span>
              ))}
            </div>
          </div>

          {/* Summary, or the hovered check — the same line as the 90-day strip's. */}
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 pl-11 type-caption text-text-muted" aria-live="polite">
            {hoveredSlot ? (
              <span className="text-text-secondary">
                <span className="font-medium">{formatTimeLabel(hoveredSlot.t)}</span>
                {' — '}
                {hoveredSlot.latencyMs === null ? '실패' : `${round(hoveredSlot.latencyMs)}ms`}
                {` · ${hoveredSlot.detail}`}
              </span>
            ) : (
              <>
                {latencies.length > 0 && (
                  <>
                    <span>평균 <span className="font-medium tabular-nums text-text-base">{round(latencies.reduce((sum, v) => sum + v, 0) / latencies.length)}</span> ms</span>
                    <span>최대 <span className="font-medium tabular-nums text-text-base">{round(Math.max(...latencies))}</span> ms</span>
                  </>
                )}
                <span>실패 <span className={`font-medium tabular-nums ${failedChecks > 0 ? 'text-status-error' : 'text-text-base'}`}>{failedChecks}</span>회</span>
              </>
            )}
          </p>
        </>
      )}
    </ChartCard>
  );
}
