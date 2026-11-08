import { useId, useState, type ReactNode } from 'react';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TimelineIncident } from '../../../services/api';
import {
  CHART_HEIGHT, CHART_INITIAL_DIMENSION, CHART_MARGIN, ChartCard, ChartEmpty, ChartSkeleton,
  OPERATOR_LABEL, formatAxisValue, formatTimeLabel, formatTimeTick, gridProps, lineProps,
  niceTicks, thresholdLines, timeXAxisProps, tooltipCursor, useChartTheme, yAxisProps,
} from '../../../components/charts';
import { Tooltip as HintTooltip } from '../../../components/common/Tooltip';
import { formatDuration } from '../../../utils/incidentFormat';

export interface ResponseSlot {
  t: number;
  latencyMs: number | null;
  state: 'up' | 'partial' | 'down';
  totalChecks: number;
  failedChecks: number;
}

/** A failed check outside any incident — the incident list already covers the rest. */
export interface ResponseFailure {
  at: number;
  message: string;
}

// One row of the "failures in this window" list, and the chart mark it highlights.
interface FailureEvent {
  key: string;
  kind: 'outage' | 'failure';
  from: number;
  to: number;
  active: boolean;
  checks: number;
  message: string;
}

interface ResponsePoint extends ResponseSlot {
  end: number;
  missing: boolean;
  isolated: boolean;
}

interface ResponseTimeCardProps {
  slots: ResponseSlot[];
  caption: string;
  window: [number, number];
  bucketMs: number;
  incidents?: TimelineIncident[];
  failures?: ResponseFailure[];
  thresholds?: { id: string; operator: string; threshold: number }[];
  loading?: boolean;
  unavailable?: boolean;
  notice?: ReactNode;
  controls?: ReactNode;
}

const number = (value: number) => Math.round(value).toLocaleString();

// The server omits empty buckets. Explicit null rows preserve their real time
// and keep pointer and keyboard tooltips available when every probe fails.
function responsePoints(slots: ResponseSlot[], [from, to]: [number, number], step: number): ResponsePoint[] {
  const byTime = new Map(slots.map((slot) => [Math.floor(slot.t / step) * step, slot]));
  const points: ResponsePoint[] = [];
  for (let t = from; t <= to; t += step) {
    const slot = byTime.get(t);
    points.push({ ...slot, t, end: Math.min(t + step, to), latencyMs: slot?.latencyMs ?? null,
      state: slot?.state ?? 'up', totalChecks: slot?.totalChecks ?? 0, failedChecks: slot?.failedChecks ?? 0,
      missing: !slot, isolated: false });
  }
  return points.map((point, index) => ({ ...point,
    isolated: point.latencyMs !== null && points[index - 1]?.latencyMs == null && points[index + 1]?.latencyMs == null,
  }));
}

function responseAxis(values: number[]) {
  if (!values.length) return { domain: [0, 100] as [number, number], ticks: [0, 25, 50, 75, 100], interval: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A minimum visible span avoids exaggerating a few milliseconds of jitter.
  const span = Math.max(max - min, max * 0.4, 100);
  const rough = niceTicks(span * 1.3);
  const step = rough[1] - rough[0];
  const low = Math.max(0, Math.floor((min - span * 0.15) / step) * step);
  const high = Math.max(low + step * 2, Math.ceil((max + span * 0.15) / step) * step);
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => low + index * step);
  return { domain: [low, high] as [number, number], ticks, interval: 0 };
}

function ResponseTooltip({ point, color, messages }: { point?: ResponsePoint; color: string; messages: string[] }) {
  if (!point) return null;
  return (
    <div data-response-tooltip role="status" className="max-w-64 rounded-lg border border-chart-border bg-bg-surface px-3.5 py-3 text-sm shadow-lg">
      <p className="mb-2 type-caption text-text-muted">{formatTimeLabel(point.t)} – {formatTimeTick(point.end)}</p>
      {point.missing ? <p className="text-text-secondary">수집 데이터 없음</p> : (
        <>
          <div className="flex items-center justify-between gap-8">
            <span className="inline-flex items-center gap-2 text-text-muted"><span className="h-2 w-2 rounded-full" style={{ background: color }} />평균 응답</span>
            <span className="font-bold tabular-nums text-text-base">{point.latencyMs === null ? '응답 없음' : `${number(point.latencyMs)} ms`}</span>
          </div>
          <p className={`mt-2 type-caption ${point.failedChecks ? 'text-status-error' : 'text-text-muted'}`}>
            체크 {number(point.totalChecks)}회 중 실패 {number(point.failedChecks)}회
          </p>
          {messages.map((message) => <p key={message} className="mt-1 break-words type-caption text-text-secondary">{message}</p>)}
        </>
      )}
    </div>
  );
}

export function ResponseTimeCard({ slots, caption, window, bucketMs, incidents = [], failures = [], thresholds = [], loading = false, unavailable = false, notice, controls }: ResponseTimeCardProps) {
  const theme = useChartTheme();
  const id = useId();
  const [focused, setFocused] = useState<string | null>(null);
  const domain: [number, number] = [Math.floor(window[0] / bucketMs) * bucketMs, window[1]];
  const points = responsePoints(slots, domain, bucketMs);
  const values = slots.flatMap((slot) => slot.latencyMs === null ? [] : [slot.latencyMs]);
  const axis = responseAxis(values);
  const visibleThresholds = thresholds.filter((rule) => rule.threshold >= axis.domain[0] && rule.threshold <= axis.domain[1]);
  const outsideThresholds = thresholds.filter((rule) => !visibleThresholds.includes(rule));
  const total = slots.reduce((sum, slot) => sum + slot.totalChecks, 0);
  const failed = slots.reduce((sum, slot) => sum + slot.failedChecks, 0);
  const successful = total - failed;
  const average = successful > 0 ? slots.reduce((sum, slot) => sum + (slot.latencyMs ?? 0) * (slot.totalChecks - slot.failedChecks), 0) / successful : null;
  const overlapping = (from: number, to: number) => points.filter((point) => !point.missing && point.t <= to && point.end > from);
  const outages: FailureEvent[] = incidents.map((incident) => {
    const from = Math.max(domain[0], Date.parse(incident.startedAt));
    const to = Math.min(domain[1], incident.endedAt ? Date.parse(incident.endedAt) : domain[1]);
    return { key: `outage-${incident.startedAt}`, kind: 'outage' as const, from, to, active: incident.active, message: incident.message ?? '',
      checks: overlapping(from, to).reduce((sum, point) => sum + point.failedChecks, 0) };
  }).filter((outage) => outage.to > outage.from);
  // A bucket that touches an outage belongs to it, even when the outage starts mid-bucket.
  const inOutage = (point: ResponsePoint) => outages.some((outage) => point.t <= outage.to && point.end > outage.from);
  const bucketOf = (t: number) => Math.floor(t / bucketMs) * bucketMs;
  const failureBuckets = points.filter((point) => point.failedChecks > 0 && !inOutage(point));
  const isolated: FailureEvent[] = failures.filter((failure) => failure.at >= domain[0] && failure.at <= domain[1]).map((failure) => ({
    key: `failure-${bucketOf(failure.at)}`, kind: 'failure', from: failure.at, to: failure.at, active: false, checks: 1, message: failure.message,
  }));
  // Isolated failures in one bucket share its chart mark, so the list groups them the same way.
  const grouped = [...isolated.reduce((map, event) => {
    const prev = map.get(event.key);
    map.set(event.key, prev ? { ...prev, from: Math.min(prev.from, event.from), to: Math.max(prev.to, event.to), checks: prev.checks + 1,
      message: prev.message.includes(event.message) ? prev.message : `${prev.message} · ${event.message}` } : event);
    return map;
  }, new Map<string, FailureEvent>()).values()];
  const events = [...outages, ...grouped].sort((a, b) => b.from - a.from);
  const messagesAt = (point: ResponsePoint) => [...new Set(events
    .filter((event) => point.t <= event.to && point.end > event.from && event.message).map((event) => event.message))];
  const missing = points.some((point, index) => point.missing && index > 0 && index < points.length - 1);
  const timezone = new Intl.DateTimeFormat('ko-KR', { timeZoneName: 'short' }).formatToParts(window[1]).find((part) => part.type === 'timeZoneName')?.value;
  const dateTime = (t: number) => new Date(t).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const at = (t: number) => new Date(t).toDateString() === new Date(window[1]).toDateString() ? formatTimeTick(t) : dateTime(t);

  return (
    <ChartCard as="h2" title="응답 시간" unit={caption} right={controls}>
      {notice}
      {unavailable ? null : loading ? <ChartSkeleton /> : total === 0 ? <ChartEmpty /> : (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <dl aria-label="응답 시간 요약">
              <dt className="mb-1.5 type-caption text-text-muted">선택 기간 평균</dt>
              <dd data-response-average className="text-3xl font-bold leading-none tracking-tight tabular-nums text-text-base">
                {average === null ? '—' : number(average)}{average !== null && <span className="ml-1.5 text-sm font-normal tracking-normal text-text-muted">ms</span>}
              </dd>
            </dl>
            <p data-response-counts className="type-caption text-text-muted">체크 <span className="tabular-nums text-text-secondary">{number(total)}회</span> 중 <span className={failed ? 'font-medium text-status-error' : ''}>실패 {number(failed)}회</span></p>
          </div>
          <figure aria-labelledby={`${id}-description`} className="relative">
            <figcaption id={`${id}-description`} className="sr-only">응답 시간 추이. 좌우 방향키로 시간대를 이동합니다. {caption}. 체크 {total}회 중 실패 {failed}회.</figcaption>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
              <ComposedChart data={points} margin={{ ...CHART_MARGIN, top: 12, right: 12 }} accessibilityLayer aria-label="응답 시간 추이. 좌우 방향키로 시간대 이동">
                <CartesianGrid {...gridProps(theme)} />
                <XAxis {...timeXAxisProps(theme, domain)} minTickGap={40} interval="preserveStartEnd" />
                <YAxis {...yAxisProps(theme)} {...axis} allowDataOverflow tickFormatter={(value) => formatAxisValue(value, 'ms')} />
                {outages.map((outage) => <ReferenceArea key={outage.key} className="response-outage" x1={outage.from} x2={outage.to} fill={theme.errorColor} fillOpacity={focused === outage.key ? 0.2 : 0.08} strokeOpacity={0} />)}
                {thresholdLines(visibleThresholds, theme.errorColor, 'ms')}
                <Tooltip filterNull={false} cursor={tooltipCursor(theme)} isAnimationActive={false}
                  content={({ active, label }) => {
                    const point = active ? points.find((candidate) => candidate.t === Number(label)) : undefined;
                    return point ? <ResponseTooltip point={point} color={theme.primaryColor} messages={messagesAt(point)} /> : null;
                  }} />
                <Line {...lineProps(theme.primaryColor, theme)} dataKey="latencyMs" name="평균 응답"
                  dot={(props) => {
                    const point = props.payload as ResponsePoint;
                    return point.isolated ? <circle key={point.t} data-response-point cx={props.cx} cy={props.cy} r={3} fill={theme.primaryColor} /> : <g key={point.t} />;
                  }} />
                {failureBuckets.map((point) => (
                  <ReferenceLine key={point.t} className="response-failure" x={point.t + (point.end - point.t) / 2} stroke={theme.errorColor}
                    strokeDasharray="3 3" strokeWidth={focused === `failure-${point.t}` ? 2 : 1} strokeOpacity={focused === `failure-${point.t}` ? 1 : 0.6} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            {values.length === 0 && <p className="pointer-events-none absolute inset-x-12 top-1/2 -translate-y-1/2 text-center type-body text-text-muted">성공한 응답이 없습니다</p>}
          </figure>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 type-caption text-text-muted">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5"><span className="h-px w-4 bg-primary" />{caption}</span>
              {outages.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-status-error/25" />장애 구간</span>}
              {failureBuckets.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-3 border-l border-dashed border-status-error" />단발 실패</span>}
              {missing && <span>빈 구간은 수집 데이터 없음</span>}
            </div>
            <span className="tabular-nums">{dateTime(window[0])} – {dateTime(window[1])} · {timezone}</span>
          </div>
          {events.length > 0 && (
            <div className="mt-4 border-t border-ui-border pt-3">
              <h3 className="mb-1 type-caption font-medium text-text-secondary">이 기간의 실패 {events.length}건</h3>
              <ul aria-label="이 기간의 실패" className="max-h-48 overflow-y-auto">
                {events.map((event) => (
                  <li key={event.key} data-response-event={event.kind} tabIndex={0}
                    onMouseEnter={() => setFocused(event.key)} onMouseLeave={() => setFocused(null)} onFocus={() => setFocused(event.key)} onBlur={() => setFocused(null)}
                    className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3 rounded-md px-2 py-1.5 outline-none hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-[5.5rem_12rem_minmax(0,1fr)]">
                    <span className={`type-caption font-medium ${event.kind === 'outage' ? 'text-status-error' : 'text-status-warn'}`}>
                      {event.kind === 'outage' ? (event.active ? '장애 진행 중' : '장애') : '단발 실패'}
                    </span>
                    <span className="type-caption tabular-nums text-text-base">
                      {at(event.from)}{event.to > event.from && ` – ${event.active ? '지금' : at(event.to)}`}
                      <span className="text-text-muted">{event.kind === 'outage' ? ` · ${formatDuration(Math.round((event.to - event.from) / 1000))}` : ''}{event.checks > 1 ? ` · ${number(event.checks)}회` : ''}</span>
                    </span>
                    <span className="col-span-2 min-w-0 sm:col-span-1"><HintTooltip content={event.message || '오류 메시지 없음'}><span className="block truncate type-caption text-text-secondary">{event.message || '오류 메시지 없음'}</span></HintTooltip></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {outsideThresholds.length > 0 && <p className="mt-2 type-caption text-text-muted">{outsideThresholds.map((rule) => `알림 ${OPERATOR_LABEL[rule.operator] ?? '>'} ${number(rule.threshold)}ms`).join(' · ')}</p>}
        </>
      )}
    </ChartCard>
  );
}
