import { useState, useEffect, useCallback, useRef } from 'react';
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
import { LEVEL_BASE, LEVEL_TEXT, LEVEL_CHIP } from '../logLevelStyle';

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

// Stacked-bar colors matching LEVEL_TEXT token colors.
// 600단계: 500단계는 흰 배경에서 warn 2.15 / info 2.77 / trace 2.56으로 WCAG 1.4.11(3:1) 미달이었다.
const LEVEL_BAR: { key: keyof Omit<LogHistogramBucket, 'time'>; color: string; name: string }[] = [
  { key: 'error', color: '#dc2626', name: 'ERROR' },
  { key: 'warn',  color: '#d97706', name: 'WARN' },
  { key: 'info',  color: '#0284c7', name: 'INFO' },
  { key: 'debug', color: '#7c3aed', name: 'DEBUG' },
  { key: 'trace', color: '#64748b', name: 'TRACE' },
];

const LOG_LEVELS: { value: LogLevel | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'error', label: 'ERROR' },
  { value: 'warn', label: 'WARN' },
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
  { value: 'trace', label: 'TRACE' },
];

// 라이트 텍스트는 700단계 — 600은 자기 -100 배경 위에서 red 3.95 / sky 3.57로 AA 미달이었다.
// Levels selectable for the OTLP ingest filter (what gets stored), in severity order.
const INGEST_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

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

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Structured attributes the row can filter on. Nested values stay in the JSON
// dump below — only a scalar makes sense as an exact-match filter.
function filterableAttributes(log: LogEntry): [string, string][] {
  const attributes = (log.metadata as { attributes?: Record<string, unknown> } | undefined)?.attributes;
  if (!attributes) return [];
  return Object.entries(attributes)
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
  const attributes = filterableAttributes(log);

  return (
    <div
      className={`px-4 py-3 bg-bg-surface transition-colors ${hasMeta ? 'cursor-pointer hover:bg-ui-hover-soft' : ''}`}
      {...activatable(() => setExpanded(v => !v), hasMeta)}
      aria-expanded={hasMeta ? expanded : undefined}
    >
      <div className="flex items-start gap-3">
        <span className={`${LEVEL_BASE} mt-0.5 ${LEVEL_TEXT[log.level] ?? LEVEL_TEXT.info}`}>
          {log.level}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-text-base wrap-break-word">{log.message}</p>
          <p className="text-xs text-text-dim mt-0.5">{formatTime(log.createdAt)}</p>
        </div>
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
        <>
          {attributes.length > 0 && (
            <div className="mt-3 ml-11 flex flex-wrap gap-1.5">
              {attributes.map(([key, value]) => (
                <Button
                  key={key}
                  variant="secondary"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onFilterAttribute(key, value); }}
                  title={`${key}=${value} 로 필터`}
                  className="font-mono"
                >
                  <span className="text-text-dim">{key}</span>
                  <span>=</span>
                  <span>{value}</span>
                </Button>
              ))}
            </div>
          )}
          <pre className="mt-3 ml-11 text-xs font-mono text-text-muted bg-ui-hover-soft rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </>
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
  const [histogram, setHistogram] = useState<{ buckets: LogHistogramBucket[]; window: [number, number] }>({ buckets: [], window: [0, 1] });
  // A histogram bucket picked by click/Enter narrows the list to that slice.
  // Tied to the range it was picked in, so switching range drops it.
  const [picked, setPicked] = useState<{ from: number; range: GlobalTimeRange } | null>(null);
  const activeBucket = picked?.range === range ? picked.from : null;
  const bucketMs = RANGE_BUCKET[range].bucketMins * 60_000;
  const [live, setLive] = useState(false);
  const [page, setPage] = useState(1);

  // Ingest filter: which levels are stored at OTLP ingest ([] = accept all).
  const [showSettings, setShowSettings] = useState(false);
  const [ingestLevels, setIngestLevels] = useState<string[]>([]);
  const [savingFilter, setSavingFilter] = useState(false);

  useEffect(() => {
    const request = directServiceId
      ? api.getObservedServiceLogFilter(directServiceId)
      : api.getAgentServiceLogFilter(agentId!, serviceKey!);
    request
      .then(r => setIngestLevels(r?.levels ?? []))
      .catch(() => {});
  }, [agentId, directServiceId, serviceKey]);

  const toggleIngestLevel = (l: string) =>
    setIngestLevels(cur => (cur.includes(l) ? cur.filter(x => x !== l) : [...cur, l]));

  const saveIngestFilter = async () => {
    setSavingFilter(true);
    try {
      const r = directServiceId
        ? await api.setObservedServiceLogFilter(directServiceId, ingestLevels as LogLevel[])
        : await api.setAgentServiceLogFilter(agentId!, serviceKey!, ingestLevels);
      setIngestLevels(r?.levels ?? []);
      toast.success('수집 설정을 저장했습니다');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingFilter(false);
    }
  };

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {
        level: level || undefined,
        search: search || undefined,
        attrKey: attrFilter?.key,
        attrValue: attrFilter?.value,
        traceId,
        from: activeBucket === null ? rangeFrom(range) : new Date(activeBucket).toISOString(),
        to: activeBucket === null ? undefined : new Date(activeBucket + bucketMs).toISOString(),
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
  }, [agentId, directServiceId, serviceKey, refreshKey, level, search, attrFilter, range, page, traceId, activeBucket]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  // Volume histogram — follows the header range and the level/search view filters.
  const fetchHistogram = useCallback(() => {
    const r = RANGE_BUCKET[range];
    const to = Date.now();
    const from = to - r.hours * 3600 * 1000;
    const params = {
      level: level || undefined,
      search: search || undefined,
      attrKey: attrFilter?.key,
      attrValue: attrFilter?.value,
      from: new Date(from).toISOString(),
      bucketMins: r.bucketMins,
    };
    const request = directServiceId
      ? api.getObservedServiceLogHistogram(directServiceId, params)
      : api.getAgentServiceLogHistogram(agentId!, serviceKey!, params);
    request
      .then((b) => setHistogram({ buckets: b ?? [], window: [from, to] }))
      .catch(() => setHistogram({ buckets: [], window: [from, to] }));
  }, [agentId, directServiceId, serviceKey, level, search, attrFilter, range, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
            placeholder="메시지 검색..."
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

        {/* Active time-slice filter, set by picking a histogram bar */}
        {activeBucket !== null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setPicked(null); setPage(1); }}
            title="구간 필터 해제"
          >
            <span className="tabular-nums">{formatTimeTick(activeBucket)} – {formatTimeTick(activeBucket + bucketMs)}</span>
            <MaterialIcon size={20} name="close" />
          </Button>
        )}

        {/* Live tail: 5s silent polling while on */}
        <button
          type="button"
          onClick={() => { setLive(v => !v); setPage(1); }}
          title="5초마다 자동 갱신"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
            live
              ? 'bg-red-500/10 text-red-500'
              : 'bg-ui-hover text-text-muted hover:bg-ui-active'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-red-500 animate-pulse' : 'bg-slate-400 dark:bg-text-dim-dark'}`} />
          LIVE
        </button>

        {/* Ingest filter settings toggle */}
        <button
          type="button"
          onClick={() => setShowSettings(v => !v)}
          title="수집 설정"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showSettings
              ? 'bg-primary/10 text-primary'
              : 'bg-ui-hover text-text-muted hover:bg-ui-active'
          }`}
        >
          <MaterialIcon size={20} name="tune" />
          수집 설정
        </button>
      </div>

      {/* Ingest filter panel — controls which levels are STORED (vs. the view filter above) */}
      {showSettings && (
        <div className="rounded-xl border border-ui-border bg-ui-hover-soft p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-text-base">수집할 로그 레벨</p>
            <p className="type-body text-text-muted mt-0.5">
              선택한 레벨만 저장됩니다. 모두 해제하면 전체 저장. (앞으로 들어오는 로그에만 적용)
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {INGEST_LEVELS.map(l => {
              const on = ingestLevels.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleIngestLevel(l)}
                  className={`px-2.5 py-1 rounded-lg text-xs uppercase transition-colors ${
                    on
                      ? LEVEL_CHIP[l]
                      : 'bg-bg-surface text-text-dim border border-ui-border opacity-60'
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={saveIngestFilter} loading={savingFilter}>
              저장
            </Button>
            <span className="text-xs text-text-dim">
              {ingestLevels.length === 0 ? '전체 수집' : `${ingestLevels.length}개 레벨 수집`}
            </span>
          </div>
        </div>
      )}

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
          {total.toLocaleString()}건 중 {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, total).toLocaleString()}
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
            {search || level || attrFilter ? '조건에 맞는 로그가 없습니다' : '이 기간에 수집된 로그가 없습니다'}
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
