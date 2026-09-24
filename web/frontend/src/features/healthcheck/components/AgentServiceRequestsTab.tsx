import { useState, useEffect, useCallback } from 'react';
import { MaterialIcon, Pagination, SearchInput, type GlobalTimeRange, IconButton } from '../../../components/common';
import { api, type ApiRequest } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { activatable } from '../../../utils/a11y';
import { toast } from 'react-hot-toast';
import { TracePanel } from '../../traces/components/TracePanel';
import { runtimeLabel } from '../runtimeLabels';
import { AgentServiceRequestTrends, DirectServiceRequestTrends } from './AgentServiceRequestTrends';

interface SharedProps {
  refreshKey: number;
  /** Shared range from the page-header picker — drives the trends chart, the list, and the KPI row. */
  range: GlobalTimeRange;
  traceId?: string;
}

interface AgentProps extends SharedProps {
  agentId: string;
  serviceKey: string;
  /** Agent-detected runtime — drives the setup hint in the empty state. */
  runtime?: string;
}

interface DirectProps extends SharedProps {
  observedServiceId: string;
}

type RequestSource =
  | { kind: 'agent'; agentId: string; serviceKey: string; runtime?: string }
  | { kind: 'direct'; observedServiceId: string };

const RANGE_HOURS: Record<GlobalTimeRange, number> = { '1h': 1, '6h': 6, '24h': 24 };

const PAGE_SIZE = 25;

function rangeFrom(range: GlobalTimeRange): string {
  return new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
}

function methodClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'POST':   return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'PUT':
    case 'PATCH':  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'DELETE': return 'bg-red-500/10 text-red-600 dark:text-red-400';
    default:       return 'bg-slate-500/10 text-text-muted';
  }
}

function statusClass(code: number): string {
  if (code >= 500) return 'text-status-error';
  if (code >= 400) return 'text-status-warn';
  if (code >= 200) return 'text-status-healthy';
  return 'text-text-muted';
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function ServiceRequestsPanel({
  source,
  refreshKey,
  range,
  traceId,
}: SharedProps & { source: RequestSource }) {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [page, setPage] = useState(1);
  const sourceKind = source.kind;
  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  const fetch = useCallback(async () => {
    // The page-level refresh key intentionally invalidates this callback.
    void refreshKey;
    setLoading(true);
    try {
      const params = {
        errorsOnly,
        search: search || undefined,
        traceId,
        from: rangeFrom(range),
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      };
      const res = sourceKind === 'direct'
        ? await api.getObservedServiceRequests(observedServiceId, params)
        : await api.getAgentServiceRequests(agentId, serviceKey, params);
      // The header range is a prop, so a narrower window can strand us past the
      // last page; fall back to the first rather than showing an empty list.
      if ((res?.data?.length ?? 0) === 0 && (res?.total ?? 0) > 0 && page > 1) {
        setPage(1);
        return;
      }
      setRequests(res?.data ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [agentId, errorsOnly, observedServiceId, page, range, refreshKey, search, serviceKey, sourceKind, traceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputValue);
    setPage(1);
  };

  // KPI summary — 전체 is the whole window, the rest describe the loaded page
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const errorCount = requests.filter(r => r.statusCode >= 400).length;
  const avgMs = requests.length > 0
    ? Math.round(requests.reduce((sum, r) => sum + r.durationMs, 0) / requests.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* KPI row — 다른 탭과 동일하게 상단 고정 */}
      {!loading && requests.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '전체', value: `${total.toLocaleString()}건`, color: 'text-text-secondary' },
            { label: '에러 (이 페이지)', value: `${errorCount}건`, color: errorCount > 0 ? 'text-status-error' : 'text-text-dim' },
            { label: '평균 (이 페이지)', value: `${avgMs}ms`, color: 'text-text-secondary' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl bg-bg-surface border border-ui-border px-4 py-3 text-center">
              <p className={`text-xl ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-text-dim mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trends — volume, error rate, and latency percentiles over time */}
      {source.kind === 'direct' ? (
        <DirectServiceRequestTrends observedServiceId={source.observedServiceId} refreshKey={refreshKey} range={range} />
      ) : (
        <AgentServiceRequestTrends agentId={source.agentId} serviceKey={source.serviceKey} refreshKey={refreshKey} range={range} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Error-only toggle */}
        <button
          onClick={() => { setErrorsOnly(v => !v); setPage(1); }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            errorsOnly
              ? 'bg-red-500 text-white'
              : 'bg-ui-hover text-text-muted hover:bg-ui-active'
          }`}
        >
          <MaterialIcon size={20} name="error_outline" />
          에러만
        </button>

        {/* Path search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-48 flex gap-1.5">
          <SearchInput
            wrapperClassName="flex-1"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="경로 검색..."
          />
          {search && (
            <IconButton icon="close" label="검색어 지우기" tone="quiet" onClick={() => { setSearch(''); setInputValue(''); setPage(1); }} />
          )}
        </form>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-xl bg-ui-hover animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center">
          <MaterialIcon size={36} name="http" className="text-text-dim mb-2" />
          <p className="text-sm text-text-dim">
            {search || errorsOnly ? '조건에 맞는 요청이 없습니다' : '이 기간에 수집된 API 요청이 없습니다'}
          </p>
          {!search && !errorsOnly && (
            <div className="mt-6 mx-auto max-w-md text-left p-4 rounded-xl bg-bg-surface border border-ui-border">
              <p className="text-sm font-medium text-text-secondary mb-2">
                {source.kind === 'agent' && source.runtime
                  ? `${runtimeLabel(source.runtime)} 서비스로 감지되었습니다. 트레이스를 수집하려면:`
                  : source.kind === 'direct'
                    ? '애플리케이션 트레이스를 직접 수집하려면:'
                    : '트레이스를 수집하려면:'}
              </p>
              {source.kind === 'direct' ? (
                <ul className="space-y-1.5 text-sm text-text-muted">
                  <li className="flex gap-2"><span className="shrink-0 text-primary">1</span><span>애플리케이션에 OpenTelemetry SDK 또는 zero-code 자동 설정을 적용합니다.</span></li>
                  <li className="flex gap-2"><span className="shrink-0 text-primary">2</span><span>설정 화면에서 발급한 OTLP endpoint와 Authorization 헤더로 traces를 전송합니다.</span></li>
                </ul>
              ) : (
                <ul className="space-y-1.5 text-sm text-text-muted">
                  <li className="flex gap-2">
                    <span className="shrink-0 text-primary">1</span>
                    <span>
                      Docker Collector Compose의 <code className="font-mono text-xs bg-ui-hover px-1 py-0.5 rounded">everyup-ebpf</code> 블록
                      주석 해제 — 앱 수정 없이 경로·상태·지연 시간 수집
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 text-primary">2</span>
                    <span>
                      헤더까지 필요하면 앱에 OpenTelemetry 연결
                      {source.runtime === 'java' && ' — Java는 JAVA_TOOL_OPTIONS 환경변수만으로 가능'}
                      {source.runtime === 'node' && ' — Node.js는 NODE_OPTIONS 환경변수만으로 가능'}
                      {source.runtime === 'python' && ' — Python은 opentelemetry-instrument로 가능'}
                    </span>
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-ui-border-soft border border-ui-border rounded-xl overflow-hidden">
          {requests.map(req => {
            const clickable = !!req.traceId;
            return (
              <div
                key={req.id}
                {...activatable(() => setActiveTraceId(req.traceId!), clickable)}
                className={`flex items-center gap-3 px-4 py-3 bg-bg-surface transition-colors ${clickable ? 'cursor-pointer hover:bg-ui-hover-soft' : ''}`}
              >
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs uppercase ${methodClass(req.method)}`}>
                  {req.method}
                </span>
                <span className={`shrink-0 text-sm ${statusClass(req.statusCode)}`}>
                  {req.statusCode}
                </span>
                <span className="flex-1 min-w-0 text-sm text-text-secondary truncate font-mono">
                  {req.path}
                </span>
                <span className="shrink-0 text-xs text-text-dim">{req.durationMs}ms</span>
                <span className="shrink-0 text-xs text-text-dim">{formatTime(req.createdAt)}</span>
                {clickable && (
                  <MaterialIcon size={20} name="timeline" className="shrink-0 text-text-dim" />
                )}
              </div>
            );
          })}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-ui-hover-soft/60 px-4 py-2.5">
              <p className="text-xs text-text-dim">
                {total.toLocaleString()}건 중 {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, total).toLocaleString()}
              </p>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} previousLabel="이전" nextLabel="다음" />
            </div>
          )}
        </div>
      )}
      {activeTraceId && (
        <TracePanel traceId={activeTraceId} target={source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey }} onClose={() => setActiveTraceId(null)} />
      )}
    </div>
  );
}

export function AgentServiceRequestsTab({ agentId, serviceKey, runtime, ...props }: AgentProps) {
  return <ServiceRequestsPanel {...props} source={{ kind: 'agent', agentId, serviceKey, runtime }} />;
}

export function DirectServiceRequestsTab({ observedServiceId, ...props }: DirectProps) {
  return <ServiceRequestsPanel {...props} source={{ kind: 'direct', observedServiceId }} />;
}
