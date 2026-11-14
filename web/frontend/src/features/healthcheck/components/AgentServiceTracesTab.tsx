import { useEffect, useState } from 'react';
import { Button, MaterialIcon, SegmentedControl, type GlobalTimeRange } from '../../../components/common';
import { api, type TraceSummary } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { TracePanel } from '../../traces/components/TracePanel';
import { spanKindBadge } from '../../traces/spanKind';
import { LEVEL_CHIP } from '../logLevelStyle';
import { useRequestQuery, useRequestWindow, type RequestWindow } from '../../api-requests/useRequestQuery';

interface SharedProps {
  refreshKey: number;
  range: GlobalTimeRange;
  window?: RequestWindow;
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

const LIMIT = 50;

const SORTS = [
  { value: 'recent' as const, label: '최신순' },
  { value: 'slowest' as const, label: '느린순' },
];

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

function ServiceTracesPanel({ source, refreshKey, range, window: controlledWindow }: SharedProps & { source: TraceSource }) {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  // 실패를 빈 목록으로 그리면 "SDK가 보내면 표시됩니다"가 떠서 수집 설정 문제로 읽힌다.
  const [error, setError] = useState<string | null>(null);
  const { traceSort: sort, traceErrorsOnly: errorsOnly, update } = useRequestQuery();
  const [retryKey, setRetryKey] = useState(0);
  const fallbackWindow = useRequestWindow(range, refreshKey);
  const window = controlledWindow ?? fallbackWindow;
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

  const sourceKind = source.kind;
  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = { ...window, sort, errorsOnly: errorsOnly || undefined, limit: LIMIT };
        const rows = sourceKind === 'agent'
          ? await api.getAgentServiceTraces(agentId, serviceKey, params)
          : await api.getObservedServiceTraces(observedServiceId, params);
        if (active) setTraces(rows);
      } catch (error) {
        if (active) setError(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [sourceKind, agentId, serviceKey, observedServiceId, sort, errorsOnly, window, refreshKey, retryKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl options={SORTS} value={sort} onChange={value => update({ traceSort: value })} ariaLabel="트레이스 정렬" />
        {/* 켜짐 = 로그 탭 레벨 필터 칩과 같은 표현. 흰 글자 + red-500 채움은 3.76으로 AA 미달이었다. */}
        <button
          type="button"
          aria-pressed={errorsOnly}
          onClick={() => update({ traceErrorsOnly: errorsOnly ? null : 'true' })}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 type-label-sm transition-colors ${
            errorsOnly ? LEVEL_CHIP.error : 'bg-ui-hover text-text-muted hover:bg-ui-active'
          }`}
        >
          <MaterialIcon size={20} name="error_outline" />
          에러만
        </button>
        <span className="type-caption text-text-muted">최대 {LIMIT}개 표시</span>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-ui-hover" />
      ) : error ? (
        <section role="alert" className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MaterialIcon size={20} name="sync_problem" className="mt-0.5 shrink-0 text-status-warn" />
            <div>
              <p className="type-label text-text-base">트레이스를 불러오지 못했습니다</p>
              <p className="mt-0.5 type-body text-text-muted">{error}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setRetryKey(key => key + 1)}>다시 시도</Button>
        </section>
      ) : traces.length === 0 ? (
        <div className="rounded-xl border border-ui-border bg-bg-surface p-8 text-center">
          <p className="type-body text-text-muted">
            {errorsOnly ? '이 기간에 실패한 트레이스가 없습니다' : '이 기간에 수신한 트레이스가 없습니다. 기간을 바꾸거나 수집 설정을 확인해 주세요.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ui-border">
          {/* 좁은 화면에서는 이름 열만 두고 소요·Span·시작을 이름 아래로 내린다(요청 표와 같은 방식). 537px 표가 잘렸다. */}
          <table aria-label="트레이스 목록" className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-ui-border bg-ui-hover-soft text-left type-label-sm text-text-muted">
                <th scope="col" className="px-4 py-3 font-medium">트레이스</th>
                <th scope="col" className="hidden w-28 px-4 py-3 font-medium sm:table-cell">종류</th>
                <th scope="col" className="hidden w-20 px-4 py-3 text-right font-medium sm:table-cell">소요</th>
                <th scope="col" className="hidden w-16 px-4 py-3 text-right font-medium sm:table-cell">Span</th>
                <th scope="col" className="hidden w-44 px-4 py-3 text-right font-medium lg:table-cell">시작</th>
              </tr>
            </thead>
            <tbody>
              {traces.map(trace => (
                // 선택 가능한 행은 tabIndex + 키 핸들러만 — role="button"은 표 시맨틱을 덮어쓴다 (DESIGN.md §8)
                <tr
                  key={trace.traceId}
                  tabIndex={0}
                  onClick={() => setActiveTraceId(trace.traceId)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveTraceId(trace.traceId);
                    }
                  }}
                  className="cursor-pointer border-b border-ui-border-soft bg-bg-surface transition-colors last:border-0 hover:bg-ui-hover-soft"
                >
                  <td className="min-w-0 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-text-base">{trace.name}</span>
                      {trace.errorCount > 0 && (
                        <span className="shrink-0 text-xs text-status-error">오류 {trace.errorCount}</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-text-muted lg:hidden">
                      <span className="sm:hidden">{trace.kind}</span>
                      <span className="sm:hidden">{formatDuration(trace.durationMs)}</span>
                      <span className="sm:hidden">Span {trace.spanCount}</span>
                      <span>{formatTime(trace.startTime)}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <span className={`badge ${spanKindBadge(trace.kind)}`}>{trace.kind}</span>
                  </td>
                  <td className="hidden px-4 py-2.5 text-right text-xs tabular-nums text-text-secondary sm:table-cell">{formatDuration(trace.durationMs)}</td>
                  <td className="hidden px-4 py-2.5 text-right text-xs tabular-nums text-text-muted sm:table-cell">{trace.spanCount}</td>
                  <td className="hidden whitespace-nowrap px-4 py-2.5 text-right text-xs tabular-nums text-text-dim lg:table-cell">{formatTime(trace.startTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTraceId && <TracePanel traceId={activeTraceId} target={source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey }} onClose={() => setActiveTraceId(null)} />}
    </div>
  );
}

export function AgentServiceTracesTab({ agentId, serviceKey, ...common }: AgentProps) {
  return <ServiceTracesPanel {...common} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceTracesTab({ observedServiceId, ...common }: DirectProps) {
  return <ServiceTracesPanel {...common} source={{ kind: 'direct', observedServiceId }} />;
}
