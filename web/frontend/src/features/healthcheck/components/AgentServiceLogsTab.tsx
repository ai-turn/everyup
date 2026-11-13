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
  // error·warn은 상태 채움 토큰을 테마에서 읽는다(barColor) — 여기 값은 쓰지 않는다.
  { key: 'error', color: '', name: 'error' },
  { key: 'warn',  color: '', name: 'warn' },
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
  const barColor = (key: string, color: string) => (key === 'error' ? theme.errorColor : key === 'warn' ? theme.warnColor : color);
  const totals = LEVEL_BAR.map((l) => ({ ...l, color: barColor(l.key, l.color), count: data.reduce((sum, b) => sum + b[l.key], 0) }));
  // Recharts의 accessibilityLayer는 숫자(시간) X축에서 현재 인덱스를 못 구해 화살표가 먹지 않고,
  // Enter는 툴팁을 끄기만 했다 — 키보드 구간 이동을 직접 둔다. null = 키보드로 고르는 중 아님.
  const [kbd, setKbd] = useState<number | null>(null);
  const kbdBucket = kbd === null ? undefined : data[kbd];
  const emphasized = kbdBucket ? kbdBucket.t : activeBucket;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      setKbd((i) => i === null ? data.length - 1 : Math.min(data.length - 1, Math.max(0, i + step)));
    } else if (e.key === 'Enter') {
      if (kbdBucket) onPick(kbdBucket.t); else pick();
    } else if (e.key === 'Escape') {
      setKbd(null);
    }
  };
  const peak = Math.max(0, ...data.map((b) => LEVEL_BAR.reduce((sum, l) => sum + b[l.key], 0)));

  return (
    <ChartCard
      title="로그 발생량"
      unit={`건 / ${bucketMs / 60_000}분`}
      right={<ChartLegend items={totals.filter((l) => l.count > 0).map((l) => ({ label: `${l.name} ${l.count.toLocaleString()}`, color: l.color }))} />}
    >
      <div
        tabIndex={0}
        role="group"
        aria-label="로그 발생량 차트. 좌우 화살표로 구간을 고르고 Enter로 그 구간 로그만 봅니다."
        className="rounded-lg"
        onKeyDown={onKeyDown}
        onBlur={() => setKbd(null)}
      >
        <ResponsiveContainer width="100%" height={CHART_STRIP_HEIGHT} initialDimension={CHART_INITIAL_DIMENSION}>
          <BarChart data={data} margin={CHART_MARGIN} onClick={pick} style={{ cursor: 'pointer' }} accessibilityLayer={false}>
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
              <Bar key={l.key} dataKey={l.key} stackId="lv" fill={barColor(l.key, l.color)} stroke={theme.surfaceColor} strokeWidth={1} name={l.name} isAnimationActive={false}>
                {data.map((b) => (
                  <Cell key={b.t} fillOpacity={emphasized === null || b.t === emphasized ? 1 : 0.35} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* 키보드로 고른 구간 — 보이는 사용자와 스크린리더 모두에게 같은 문장 */}
      <p aria-live="polite" className="mt-1 type-caption text-text-dim tabular-nums">
        {kbdBucket && `${formatTimeTick(kbdBucket.t)} ~ ${formatTimeTick(kbdBucket.t + bucketMs)} · ${
          LEVEL_BAR.filter((l) => kbdBucket[l.key] > 0).map((l) => `${l.name} ${kbdBucket[l.key]}`).join(', ') || '0건'} · Enter로 이 구간만 보기`}
      </p>
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

  // 행 전체를 role=button으로 두면 안의 트레이스 버튼이 중첩 인터랙티브가 된다(axe nested-interactive).
  // 마우스는 행 어디를 눌러도 펼치고, 키보드·스크린리더는 끝의 펼침 버튼을 쓴다.
  return (
    <div
      className={`px-4 py-3 bg-bg-surface transition-colors ${hasMeta ? 'cursor-pointer hover:bg-ui-hover-soft' : ''}`}
      onClick={hasMeta ? () => setExpanded(v => !v) : undefined}
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
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? '로그 상세 접기' : '로그 상세 펼치기'}
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            className="-my-1.5 -mr-1.5 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-dim hover:bg-ui-hover max-sm:h-11 max-sm:w-11"
          >
            <MaterialIcon size={20} name={expanded ? 'expand_less' : 'expand_more'} />
          </button>
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
                  className="h-auto min-h-8 max-w-full py-1 text-left font-mono"
                >
                  <span className="text-text-dim">{key}</span>
                  <span>=</span>
                  <span className="min-w-0 break-all">{value}</span>
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
            <summary className="cursor-pointer py-1 type-caption text-text-dim max-sm:py-3">원본 JSON</summary>
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
  // 조회 실패를 따로 둔다 — 실패 후 빈 목록이 '수집된 로그가 없습니다'로 읽혀 장애를 가렸다.
  // stale = 실시간 갱신 실패: 이전 행은 남기되 최신이 아님을 표시한다.
  const [loadError, setLoadError] = useState<{ message: string; stale: boolean } | null>(null);
  const [histogramFailed, setHistogramFailed] = useState(false);

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
      setLoadError(null);
    } catch (err) {
      // 화면 안에 실패 상태를 그리므로 토스트는 쓰지 않는다. 조건·기간이 바뀐 조회가 실패하면
      // 이전 행은 다른 조건의 결과라 비운다.
      if (!silent) { setLogs([]); setTotal(0); }
      setLoadError({ message: getErrorMessage(err), stale: silent });
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
      .then((b) => { setHistogram({ buckets: b ?? [], window: [from, to] }); setHistogramFailed(false); })
      .catch(() => { setHistogram({ buckets: [], window: [from, to] }); setHistogramFailed(true); });
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

  const hasConditions = !!(search || level || attrFilter || pattern || traceId || activeBucket !== null);
  const clearConditions = () => {
    setSearch(''); setInputValue(''); setLevel(''); setAttrFilter(null); setPicked(null); setPage(1);
    if (pattern || traceId) setSearchParams(params => { params.delete('pattern'); params.delete('traceId'); return params; }, { replace: true });
  };

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
        {/* 보기 필터임을 라벨로 밝힌다 — 위 '수집 레벨'(저장 설정)과 같은 표기라 혼동됐다. */}
        {/* 44px 높이를 지키면서 한 줄에 여섯 개가 들어가도록 좁은 화면에서만 좌우 여백을 줄인다 */}
        <div className="flex flex-col items-start gap-1 max-sm:w-full max-sm:[&_button]:px-2 sm:flex-row sm:items-center sm:gap-2">
          <span className="whitespace-nowrap type-caption text-text-dim">레벨 필터</span>
          <SegmentedControl size="md" options={LOG_LEVELS} value={level} onChange={v => { setLevel(v); setPage(1); }} ariaLabel="레벨 필터" />
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-48 flex gap-1.5">
          <SearchInput
            wrapperClassName="flex-1"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="메시지 검색 후 Enter"
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
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${live ? 'bg-status-healthy-fill animate-pulse' : 'bg-text-dim'}`} />
          실시간
        </Button>
      </div>

      {/* Volume histogram — stacked per-level counts over the header range */}
      {histogramFailed && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ui-border bg-bg-surface px-4 py-3">
          <p className="type-body text-text-muted">로그 발생량을 불러오지 못했습니다</p>
          <Button variant="ghost" size="sm" onClick={fetchHistogram}>다시 시도</Button>
        </div>
      )}
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

      {/* Live refresh failed — keep the rows, say they are no longer current */}
      {loadError?.stale && logs.length > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ui-border bg-bg-surface px-4 py-3">
          <p className="type-body text-status-warn">최신 로그를 불러오지 못했습니다. 아래는 이전 조회 결과입니다.</p>
          <Button variant="ghost" size="sm" onClick={() => void fetch()}>다시 시도</Button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-xl bg-ui-hover animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 && loadError ? (
        <div role="alert" className="py-16 text-center">
          <MaterialIcon size={36} name="error" className="text-status-error mb-2" />
          <p className="type-body font-medium text-text-base">로그를 불러오지 못했습니다</p>
          <p className="mt-1 text-sm text-text-dim">{loadError.message}</p>
          <Button className="mt-4" onClick={() => void fetch()}>다시 시도</Button>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center">
          <MaterialIcon size={36} name="article" className="text-text-dim mb-2" />
          <p className="text-sm text-text-dim">
            {hasConditions ? '조건에 맞는 로그가 없습니다' : '이 기간에 수집된 로그가 없습니다'}
          </p>
          {hasConditions && <Button variant="secondary" className="mt-4" onClick={clearConditions}>조건 초기화</Button>}
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
