import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, useActiveTooltipLabel,
} from 'recharts';
import { Button, MaterialIcon, Pagination, SegmentedControl, SearchInput, type GlobalTimeRange, IconButton } from '../../../components/common';
import {
  CHART_INITIAL_DIMENSION, CHART_MARGIN, CHART_STRIP_HEIGHT, ChartCard, ChartLegend, ChartTooltip, fillBuckets, formatTimeTick, gridProps,
  niceYAxis, timeXAxisProps, useChartTheme, yAxisProps, type TooltipPayloadItem,
} from '../../../components/charts';
import { api, type LogEntry, type LogHistogramBucket, type LogLevel } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { activatable } from '../../../utils/a11y';
import { toast } from 'react-hot-toast';
import { TracePanel } from '../../traces/components/TracePanel';
import { LEVEL_BASE, LEVEL_TEXT } from '../logLevelStyle';

interface BaseProps {
  refreshKey: number;
  /** Shared range from the page-header picker — drives the list AND the histogram. */
  range: GlobalTimeRange;
  traceId?: string;
}

interface AgentSourceProps extends BaseProps {
  agentId: string;
  serviceKey: string;
  observedServiceId?: never;
}

interface DirectSourceProps extends BaseProps {
  observedServiceId: string;
  agentId?: never;
  serviceKey?: never;
}

type Props = AgentSourceProps | DirectSourceProps;

// Histogram window/bucket per header range — same widths as the request trends chart.
const RANGE_BUCKET: Record<GlobalTimeRange, { hours: number; bucketMins: number }> = {
  '1h': { hours: 1, bucketMins: 2 },
  '6h': { hours: 6, bucketMins: 10 },
  '24h': { hours: 24, bucketMins: 30 },
};

// Stacked-bar colors matching LEVEL_TEXT token colors. Names are the server's
// lowercase level tokens, as on every log row (DESIGN.md §1.5).
// 600단계: 500단계는 흰 배경에서 warn 2.15 / info 2.77 / trace 2.56으로 WCAG 1.4.11(3:1) 미달이었다.
const LEVEL_BAR: { key: keyof Omit<LogHistogramBucket, 'time'>; color: string; name: string }[] = [
  { key: 'error', color: '#dc2626', name: 'error' },
  { key: 'warn',  color: '#d97706', name: 'warn' },
  { key: 'info',  color: '#0284c7', name: 'info' },
  { key: 'debug', color: '#7c3aed', name: 'debug' },
  { key: 'trace', color: '#64748b', name: 'trace' },
];

const LOG_LEVELS: { value: LogLevel | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'error', label: 'error' },
  { value: 'warn', label: 'warn' },
  { value: 'info', label: 'info' },
  { value: 'debug', label: 'debug' },
  { value: 'trace', label: 'trace' },
];

const PAGE_SIZE = 25;

function rangeFrom(range: GlobalTimeRange): string {
  return new Date(Date.now() - RANGE_BUCKET[range].hours * 3600 * 1000).toISOString();
}

/**
 * Reports the histogram's hovered/keyboard-focused bucket, so a click or Enter
 * can pick it. The active bucket lives in Recharts' own store, and this hook is
 * the only way to read it — hence the effect instead of lifted state.
 */
function ActiveBucketSync({ onChange }: { onChange: (t: number | undefined) => void }) {
  const label = useActiveTooltipLabel();
  useEffect(() => { onChange(typeof label === 'number' ? label : undefined); }, [label, onChange]);
  return null;
}

/** Stacked per-level log volume over the header range; a picked bar narrows the list to its bucket. */
function LogVolumeHistogram({ buckets, window: span, bucketMs, activeBucket, onPick }: {
  buckets: LogHistogramBucket[];
  window: [number, number];
  bucketMs: number;
  activeBucket: number | null;
  onPick: (bucketStart: number) => void;
}) {
  const theme = useChartTheme();
  const hovered = useRef<number | undefined>(undefined);
  const syncHovered = useCallback((t: number | undefined) => { hovered.current = t; }, []);
  const pick = () => { if (hovered.current !== undefined) onPick(hovered.current); };

  // The server returns only buckets that had logs; an absent one is zero logs.
  const data = fillBuckets(
    buckets.map((b) => ({ ...b, t: Date.parse(b.time) })),
    span,
    bucketMs,
    (t) => ({ t, time: '', error: 0, warn: 0, info: 0, debug: 0, trace: 0 }),
  );
  const totals = LEVEL_BAR.map((l) => ({ ...l, count: data.reduce((sum, b) => sum + b[l.key], 0) }));
  const peak = Math.max(0, ...data.map((b) => LEVEL_BAR.reduce((sum, l) => sum + b[l.key], 0)));

  return (
    <ChartCard
      title="로그 발생량"
      unit={`건 / ${bucketMs / 60_000}분`}
      right={<ChartLegend items={totals.filter((l) => l.count > 0).map((l) => ({ label: `${l.name} ${l.count.toLocaleString()}`, color: l.color }))} />}
    >
      {/* Recharts' accessibility layer lets arrow keys walk the bars; Enter picks one. */}
      <div onKeyDown={(e) => { if (e.key === 'Enter') pick(); }}>
        <ResponsiveContainer width="100%" height={CHART_STRIP_HEIGHT} initialDimension={CHART_INITIAL_DIMENSION}>
          <BarChart data={data} margin={CHART_MARGIN} onClick={pick} style={{ cursor: 'pointer' }}>
            <CartesianGrid {...gridProps(theme)} />
            <XAxis {...timeXAxisProps(theme, span)} padding={{ left: 6, right: 6 }} />
            <YAxis {...yAxisProps(theme, 36)} {...niceYAxis(peak)} allowDecimals={false} />
            <Tooltip content={({ active, label, payload }) => (
              <ChartTooltip
                active={active}
                label={label}
                payload={(payload as TooltipPayloadItem[] | undefined)?.filter((item) => Number(item.value) > 0)}
                unit="건"
                theme={theme}
                valueFormatter={(v) => String(v)}
                // The hint lives where the pointer already is, not as a sentence under the chart.
                footer="누르면 이 구간 로그만 봅니다"
              />
            )} />
            <ActiveBucketSync onChange={syncHovered} />
            {LEVEL_BAR.map((l) => (
              // A surface-coloured stroke leaves a hairline between stacked segments.
              <Bar key={l.key} dataKey={l.key} stackId="lv" fill={l.color} stroke={theme.tooltipBg} strokeWidth={1} name={l.name} isAnimationActive={false}>
                {data.map((b) => (
                  <Cell key={b.t} fillOpacity={activeBucket === null || b.t === activeBucket ? 1 : 0.35} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ko-KR fixed like the chart axes — the browser locale made rows and axes disagree.
function formatTime(ts: string) {
  return new Date(ts).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
}

// Scalar entries of one metadata section. Nested values stay in the raw JSON —
// only a scalar makes sense as an exact-match filter or a key=value line.
function scalarEntries(log: LogEntry, section: 'attributes' | 'resource'): [string, string][] {
  const values = (log.metadata as Record<string, Record<string, unknown> | undefined> | undefined)?.[section];
  if (!values) return [];
  return Object.entries(values)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => [key, String(value)]);
}

function LogRow({ log, onOpenTrace, onFilterAttribute }: {
  log: LogEntry;
  onOpenTrace: (traceId: string) => void;
  onFilterAttribute: (key: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // !! 필수 — undefined면 activatable의 기본 파라미터가 발동해 비활성 행까지 버튼이 된다.
  const hasMeta = !!log.metadata && Object.keys(log.metadata).length > 0;
  const attributes = scalarEntries(log, 'attributes');
  const resource = scalarEntries(log, 'resource');

  return (
    <div
      className={`px-4 py-3 bg-bg-surface transition-colors ${hasMeta ? 'cursor-pointer hover:bg-ui-hover-soft' : ''}`}
      {...activatable(() => setExpanded(v => !v), hasMeta)}
      aria-expanded={hasMeta ? expanded : undefined}
    >
      {/* Time leads so the list scans in time order; on phones it takes its own line. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 sm:flex-nowrap">
        <time dateTime={log.createdAt} className="mt-0.5 w-full shrink-0 text-xs tabular-nums text-text-dim sm:w-auto">{formatTime(log.createdAt)}</time>
        <span className={`${LEVEL_BASE} mt-0.5 ${LEVEL_TEXT[log.level] ?? LEVEL_TEXT.info}`}>
          {log.level}
        </span>
        {/* pre-wrap keeps a stack trace's lines */}
        <p className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word font-mono text-sm text-text-base">{log.message}</p>
        {log.traceId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onOpenTrace(log.traceId!); }}
            title="트레이스 보기"
          >
            <MaterialIcon name="timeline" />
            트레이스
          </Button>
        )}
        {hasMeta && (
          <MaterialIcon size={20}
            name={expanded ? 'expand_less' : 'expand_more'}
            className="text-text-dim shrink-0 mt-0.5"
          />
        )}
      </div>
      {expanded && hasMeta && (
        // Clicks and keys inside stay here — only the summary line collapses the row.
        <div className="cursor-auto" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {attributes.length > 0 && (
            <>
            <p className="mt-3 type-caption text-text-dim">Attributes</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {attributes.map(([key, value]) => (
                <Button
                  key={key}
                  variant="secondary"
                  size="sm"
                  onClick={() => onFilterAttribute(key, value)}
                  title={`${key}=${value} 로 필터`}
                  className="font-mono"
                >
                  <span className="text-text-dim">{key}</span>
                  <span>=</span>
                  <span>{value}</span>
                </Button>
              ))}
            </div>
            </>
          )}
          {resource.length > 0 && (
            <>
            <p className="mt-3 type-caption text-text-dim">Resource</p>
            <dl className="mt-1.5 grid gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-[max-content_1fr]">
              {resource.map(([key, value]) => (
                <Fragment key={key}><dt className="text-text-dim">{key}</dt><dd className="break-all text-text-secondary">{value}</dd></Fragment>
              ))}
            </dl>
            </>
          )}
          {/* The same fields again plus anything nested — closed, since the lists above already read it. */}
          <details className="mt-3">
            <summary className="cursor-pointer type-caption text-text-dim">원본 JSON</summary>
            <pre className="mt-1.5 text-xs font-mono text-text-muted bg-ui-hover-soft rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ServiceLogsPanel(props: Props) {
  const { refreshKey, range, traceId } = props;
  const directServiceId = 'observedServiceId' in props ? props.observedServiceId : undefined;
  const agentId = 'agentId' in props ? props.agentId : undefined;
  const serviceKey = 'serviceKey' in props ? props.serviceKey : undefined;
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  // Exact match on one structured attribute, set by clicking it on a row.
  const [attrFilter, setAttrFilter] = useState<{ key: string; value: string } | null>(null);
  // One recurring error, set by following it from the logs page (?pattern=).
  const [searchParams, setSearchParams] = useSearchParams();
  const pattern = searchParams.get('pattern') ?? undefined;
  const clearParam = (name: 'pattern' | 'traceId') => {
    setSearchParams(params => { params.delete(name); return params; }, { replace: true });
    setPage(1);
  };
  const [histogram, setHistogram] = useState<{ buckets: LogHistogramBucket[]; window: [number, number] }>({ buckets: [], window: [0, 1] });
  // A histogram bucket picked by click/Enter narrows the list to that slice.
  // Tied to the range it was picked in, so switching range drops it.
  const [picked, setPicked] = useState<{ from: number; range: GlobalTimeRange } | null>(null);
  const activeBucket = picked?.range === range ? picked.from : null;
  const bucketMs = RANGE_BUCKET[range].bucketMins * 60_000;
  const [live, setLive] = useState(false);
  const [page, setPage] = useState(1);

  // One filter set for the list and the histogram — built twice, traceId reached
  // only the list and the histogram counted every log.
  const filters = {
    level: level || undefined,
    search: search || undefined,
    attrKey: attrFilter?.key,
    attrValue: attrFilter?.value,
    traceId,
    fingerprint: pattern,
  };

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {
        ...filters,
        // A trace's logs are found by id, not by time — a trace older than the
        // header range would otherwise come up empty.
        from: traceId ? undefined : activeBucket === null ? rangeFrom(range) : new Date(activeBucket).toISOString(),
        to: traceId || activeBucket === null ? undefined : new Date(activeBucket + bucketMs).toISOString(),
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      };
      const res = directServiceId
        ? await api.getObservedServiceLogs(directServiceId, params)
        : await api.getAgentServiceLogs(agentId!, serviceKey!, params);
      // The header range is a prop, so a narrower window can strand us past the
      // last page; fall back to the first rather than showing an empty table.
      if ((res?.data?.length ?? 0) === 0 && (res?.total ?? 0) > 0 && page > 1) {
        setPage(1);
        return;
      }
      setLogs(res?.data ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [agentId, directServiceId, serviceKey, refreshKey, level, search, attrFilter, range, page, traceId, pattern, activeBucket]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  // Volume histogram — follows the header range and the view filters. One trace's
  // logs fall in a bar or two of a range-wide chart, so it is left out then.
  const fetchHistogram = useCallback(() => {
    const r = RANGE_BUCKET[range];
    const to = Date.now();
    const from = to - r.hours * 3600 * 1000;
    if (traceId) {
      setHistogram({ buckets: [], window: [from, to] });
      return;
    }
    const params = { ...filters, from: new Date(from).toISOString(), bucketMins: r.bucketMins };
    const request = directServiceId
      ? api.getObservedServiceLogHistogram(directServiceId, params)
      : api.getAgentServiceLogHistogram(agentId!, serviceKey!, params);
    request
      .then((b) => setHistogram({ buckets: b ?? [], window: [from, to] }))
      .catch(() => setHistogram({ buckets: [], window: [from, to] }));
  }, [agentId, directServiceId, serviceKey, level, search, attrFilter, pattern, traceId, range, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchHistogram(); }, [fetchHistogram]);

  // Live tail: 5s silent polling of both list and histogram.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      fetch(true);
      fetchHistogram();
    }, 5_000);
    return () => clearInterval(id);
  }, [live, fetch, fetchHistogram]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputValue);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Level filter */}
        <SegmentedControl options={LOG_LEVELS} value={level} onChange={v => { setLevel(v); setPage(1); }} ariaLabel="로그 레벨" />

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-48 flex gap-1.5">
          <SearchInput
            wrapperClassName="flex-1"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="메시지 검색…"
          />
          {search && (
            <IconButton icon="close" label="검색어 지우기" tone="quiet" onClick={() => { setSearch(''); setInputValue(''); setPage(1); }} />
          )}
        </form>

        {/* Active attribute filter, set by clicking an attribute on a row */}
        {attrFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setAttrFilter(null); setPage(1); }}
            title="Attribute 필터 해제"
            className="font-mono"
          >
            <span>{attrFilter.key}={attrFilter.value}</span>
            <MaterialIcon size={20} name="close" />
          </Button>
        )}

        {/* Active pattern filter, set by following a recurring error from the logs page */}
        {pattern && (
          <Button variant="ghost" size="sm" onClick={() => clearParam('pattern')} title="패턴 필터 해제">
            <span>같은 패턴만</span>
            <MaterialIcon size={20} name="close" />
          </Button>
        )}

        {/* Active trace filter, set by following a trace's logs link */}
        {traceId && (
          <Button variant="ghost" size="sm" onClick={() => clearParam('traceId')} title="트레이스 필터 해제">
            <span>트레이스 <span className="font-mono">{traceId.slice(0, 8)}</span>의 로그만</span>
            <MaterialIcon size={20} name="close" />
          </Button>
        )}

        {/* Active time-slice filter, set by picking a histogram bar */}
        {activeBucket !== null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setPicked(null); setPage(1); }}
            title="구간 필터 해제"
          >
            <span className="tabular-nums">{formatTimeTick(activeBucket)} ~ {formatTimeTick(activeBucket + bucketMs)}</span>
            <MaterialIcon size={20} name="close" />
          </Button>
        )}

        {/* Live tail: 5s silent polling while on. Healthy green, not red — on is not an error. */}
        <Button variant="secondary" aria-pressed={live} onClick={() => { setLive(v => !v); setPage(1); }} title="5초마다 자동 갱신">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${live ? 'bg-status-healthy animate-pulse' : 'bg-text-dim'}`} />
          실시간
        </Button>
      </div>

      {/* Volume histogram — stacked per-level counts over the header range */}
      {histogram.buckets.length > 0 && (
        <LogVolumeHistogram
          buckets={histogram.buckets}
          window={histogram.window}
          bucketMs={bucketMs}
          activeBucket={activeBucket}
          onPick={(from) => { setPicked({ from, range }); setPage(1); }}
        />
      )}

      {/* Count */}
      {!loading && total > 0 && (
        <p className="text-xs text-text-dim">
          {total.toLocaleString()}건 중 {((page - 1) * PAGE_SIZE + 1).toLocaleString()}~{Math.min(page * PAGE_SIZE, total).toLocaleString()}
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-xl bg-ui-hover animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center">
          <MaterialIcon size={36} name="article" className="text-text-dim mb-2" />
          <p className="text-sm text-text-dim">
            {search || level || attrFilter || pattern || traceId ? '조건에 맞는 로그가 없습니다' : '이 기간에 수집된 로그가 없습니다'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-ui-border-soft border border-ui-border rounded-xl overflow-hidden">
          {logs.map(log => (
            <LogRow
              key={log.id}
              log={log}
              onOpenTrace={setActiveTraceId}
              onFilterAttribute={(key, value) => { setAttrFilter({ key, value }); setPage(1); }}
            />
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-end bg-ui-hover-soft/60 px-4 py-2.5">
              {/* Live tail only ever shows the newest page, so leaving page 1 turns it off. */}
              <Pagination
                page={page}
                totalPages={totalPages}
                onChange={p => { setPage(p); if (p > 1) setLive(false); }}
                previousLabel="이전"
                nextLabel="다음"
              />
            </div>
          )}
        </div>
      )}
      {activeTraceId && (
        <TracePanel traceId={activeTraceId} target={props.observedServiceId ? { kind: 'direct', observedServiceId: props.observedServiceId } : { kind: 'agent', agentId: props.agentId!, serviceKey: props.serviceKey! }} onClose={() => setActiveTraceId(null)} />
      )}
    </div>
  );
}

export function AgentServiceLogsTab(props: AgentSourceProps) {
  return <ServiceLogsPanel {...props} />;
}

export function DirectServiceLogsTab(props: DirectSourceProps) {
  return <ServiceLogsPanel {...props} />;
}
