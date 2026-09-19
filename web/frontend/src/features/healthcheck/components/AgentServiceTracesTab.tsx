import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { MaterialIcon, SegmentedControl, type GlobalTimeRange } from '../../../components/common';
import { api, type TraceSummary } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { activatable } from '../../../utils/a11y';
import { TracePanel } from '../../traces/components/TracePanel';

interface SharedProps {
  refreshKey: number;
  range: GlobalTimeRange;
}

interface AgentProps extends SharedProps {
  agentId: string;
  serviceKey: string;
}

interface DirectProps extends SharedProps {
  observedServiceId: string;
}

type TraceSource =
  | { kind: 'agent'; agentId: string; serviceKey: string }
  | { kind: 'direct'; observedServiceId: string };

const RANGE_HOURS: Record<GlobalTimeRange, number> = { '1h': 1, '6h': 6, '24h': 24 };
const LIMIT = 50;

const SORTS = [
  { value: 'recent' as const, label: '최신순' },
  { value: 'slowest' as const, label: '느린순' },
];

function spanKindBadge(kind: string): string {
  switch (kind) {
    case 'SERVER':   return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'CLIENT':   return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'PRODUCER':
    case 'CONSUMER': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    default:         return 'bg-slate-500/10 text-text-muted';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function ServiceTracesPanel({ source, refreshKey, range }: SharedProps & { source: TraceSource }) {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'recent' | 'slowest'>('recent');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

  const sourceKind = source.kind;
  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  const fetch = useCallback(async () => {
    setLoading(true);
    const params = {
      from: new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString(),
      sort,
      errorsOnly: errorsOnly || undefined,
      limit: LIMIT,
    };
    try {
      setTraces(sourceKind === 'agent'
        ? await api.getAgentServiceTraces(agentId, serviceKey, params)
        : await api.getObservedServiceTraces(observedServiceId, params));
    } catch (err) {
      toast.error(getErrorMessage(err));
      setTraces([]);
    } finally {
      setLoading(false);
    }
  }, [sourceKind, agentId, serviceKey, observedServiceId, sort, errorsOnly, range, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl options={SORTS} value={sort} onChange={setSort} ariaLabel="트레이스 정렬" />
        <button
          type="button"
          onClick={() => setErrorsOnly(v => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            errorsOnly ? 'bg-red-500 text-white' : 'bg-ui-hover text-text-muted hover:bg-ui-active'
          }`}
        >
          <MaterialIcon size={16} name="error_outline" />
          에러만
        </button>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-ui-hover" />
      ) : traces.length === 0 ? (
        <div className="rounded-xl border border-ui-border bg-bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            {errorsOnly ? '이 기간에 실패한 트레이스가 없습니다' : '수신한 트레이스가 없습니다. OpenTelemetry SDK가 트레이스를 보내면 여기에 표시됩니다.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ui-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ui-border bg-bg-surface text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                <th className="px-4 py-2 font-medium">트레이스</th>
                <th className="px-4 py-2 font-medium">종류</th>
                <th className="px-4 py-2 text-right font-medium">소요</th>
                <th className="px-4 py-2 text-right font-medium">스팬</th>
                <th className="px-4 py-2 text-right font-medium">시작</th>
              </tr>
            </thead>
            <tbody>
              {traces.map(trace => (
                <tr
                  key={trace.traceId}
                  {...activatable(() => setActiveTraceId(trace.traceId))}
                  className="cursor-pointer border-b border-ui-border-soft/50 bg-bg-surface transition-colors last:border-0 hover:bg-ui-hover-soft"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-text-base">{trace.name}</span>
                      {trace.errorCount > 0 && (
                        <span className="shrink-0 rounded-full bg-status-error/10 px-2 py-0.5 text-xs text-status-error">
                          오류 {trace.errorCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge ${spanKindBadge(trace.kind)}`}>{trace.kind}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-text-secondary">{formatDuration(trace.durationMs)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-text-muted">{trace.spanCount}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-xs text-text-dim">{formatTime(trace.startTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTraceId && <TracePanel traceId={activeTraceId} onClose={() => setActiveTraceId(null)} />}
    </div>
  );
}

export function AgentServiceTracesTab({ agentId, serviceKey, ...common }: AgentProps) {
  return <ServiceTracesPanel {...common} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceTracesTab({ observedServiceId, ...common }: DirectProps) {
  return <ServiceTracesPanel {...common} source={{ kind: 'direct', observedServiceId }} />;
}
