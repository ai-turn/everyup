import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Button, MaterialIcon, Pagination, SegmentedControl, SearchInput, type GlobalTimeRange } from '../../../components/common';
import { CHART_INITIAL_DIMENSION, ChartTooltip, chartCardClass, getChartTheme, gridProps, xAxisProps, yAxisProps } from '../../../components/charts';
import { api, type LogEntry, type LogHistogramBucket, type LogLevel } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { activatable } from '../../../utils/a11y';
import { toast } from 'react-hot-toast';
import { TracePanel } from '../../traces/components/TracePanel';
import { LEVEL_STYLE } from '../logLevelStyle';

interface BaseProps {
  refreshKey: number;
  /** Shared range from the page-header picker — drives the list AND the histogram. */
  range: GlobalTimeRange;
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

// Stacked-bar colors matching LEVEL_STYLE badge colors.
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
        <span className={`badge mt-0.5 uppercase ${LEVEL_STYLE[log.level] ?? LEVEL_STYLE.info}`}>
          {log.level}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-base wrap-break-word">{log.message}</p>
          <p className="text-xs text-text-dim mt-0.5">{formatTime(log.createdAt)}</p>
        </div>
        {log.traceId && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenTrace(log.traceId!); }}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-xs text-primary hover:bg-primary/10 cursor-pointer"
            title="트레이스 보기"
          >
            <MaterialIcon size={16} name="timeline" />
            트레이스
          </button>
        )}
        {hasMeta && (
          <MaterialIcon size={16}
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
                <button
                  key={key}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onFilterAttribute(key, value); }}
                  title={`${key}=${value} 로 필터`}
                  className="inline-flex items-center gap-1 rounded-lg border border-ui-border bg-bg-surface px-2 py-0.5 font-mono text-xs text-text-muted hover:border-primary/30 hover:text-primary cursor-pointer"
                >
                  <span className="text-text-dim">{key}</span>
                  <span>=</span>
                  <span>{value}</span>
                </button>
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
  const { refreshKey, range } = props;
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
  const [histogram, setHistogram] = useState<LogHistogramBucket[]>([]);
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
        from: rangeFrom(range),
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
  }, [agentId, directServiceId, serviceKey, refreshKey, level, search, attrFilter, range, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  // Volume histogram — follows the header range and the level/search view filters.
  const fetchHistogram = useCallback(() => {
    const r = RANGE_BUCKET[range];
    const params = {
      level: level || undefined,
      search: search || undefined,
      attrKey: attrFilter?.key,
      attrValue: attrFilter?.value,
      from: rangeFrom(range),
      bucketMins: r.bucketMins,
    };
    const request = directServiceId
      ? api.getObservedServiceLogHistogram(directServiceId, params)
      : api.getAgentServiceLogHistogram(agentId!, serviceKey!, params);
    request
      .then((b) => setHistogram(b ?? []))
      .catch(() => setHistogram([]));
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
            <button type="button" onClick={() => { setSearch(''); setInputValue(''); setPage(1); }}
              aria-label="검색어 지우기" title="검색어 지우기"
              className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-500 transition-colors">
              <MaterialIcon size={16} name="close" />
            </button>
          )}
        </form>

        {/* Active attribute filter, set by clicking an attribute on a row */}
        {attrFilter && (
          <button
            type="button"
            onClick={() => { setAttrFilter(null); setPage(1); }}
            title="속성 필터 해제"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-xs text-primary hover:bg-primary/10 cursor-pointer"
          >
            <span>{attrFilter.key}={attrFilter.value}</span>
            <MaterialIcon size={16} name="close" />
          </button>
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
          <MaterialIcon size={16} name="tune" />
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
                      ? LEVEL_STYLE[l]
                      : 'bg-bg-surface text-text-dim border border-ui-border opacity-60'
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={saveIngestFilter} disabled={savingFilter}>
              <MaterialIcon size={16} name="save" />
              {savingFilter ? '저장 중...' : '저장'}
            </Button>
            <span className="text-xs text-text-dim">
              {ingestLevels.length === 0 ? '전체 수집' : `${ingestLevels.length}개 레벨 수집`}
            </span>
          </div>
        </div>
      )}

      {/* Volume histogram — stacked per-level counts over the header range */}
      {histogram.length > 0 && (() => {
        const theme = getChartTheme();
        const data = histogram.map((b) => ({
          ...b,
          timeLabel: new Date(b.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        return (
          <div className={`p-4 ${chartCardClass}`}>
            <ResponsiveContainer width="100%" height={110} initialDimension={CHART_INITIAL_DIMENSION}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps(theme)} />
                <XAxis dataKey="timeLabel" {...xAxisProps(theme)} />
                <YAxis {...yAxisProps(theme, 36)} allowDecimals={false} />
                <Tooltip content={({ active, label, payload }) => (
                  <ChartTooltip active={active} label={label} payload={payload as import('../../../components/charts').TooltipPayloadItem[]} unit="" theme={theme} valueFormatter={(v) => String(v)} />
                )} />
                {LEVEL_BAR.map((l) => (
                  <Bar key={l.key} dataKey={l.key} stackId="lv" fill={l.color} name={l.name} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

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
        <TracePanel traceId={activeTraceId} onClose={() => setActiveTraceId(null)} />
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
