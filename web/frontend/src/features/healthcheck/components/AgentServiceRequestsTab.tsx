import { useEffect, useState } from 'react';
import { Button, MaterialIcon, SearchInput, type GlobalTimeRange } from '../../../components/common';
import { api, type ApiRequest } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { TracePanel, type TraceTarget } from '../../traces/components/TracePanel';
import { AgentServiceRequestTrends, DirectServiceRequestTrends } from './AgentServiceRequestTrends';
import { ApiRequestResults } from '../../api-requests/ApiRequestResults';
import { statusRange, useRequestQuery, useRequestWindow, type RequestWindow, type StatusClass } from '../../api-requests/useRequestQuery';
import { ApiEndpointTable } from '../../api-requests/ApiEndpointTable';
import { TelemetrySetupGuidance } from '../../telemetry/components/TelemetrySetupGuidance';
import { TelemetryReceiptStatus } from '../../services/components/TelemetryReceiptStatus';
import { runtimeLabel } from '../runtimeLabels';

interface SharedProps { refreshKey: number; range: GlobalTimeRange; traceId?: string; window?: RequestWindow }
interface AgentProps extends SharedProps { agentId: string; serviceKey: string; runtime?: string }
interface DirectProps extends SharedProps {
  observedServiceId: string;
  /** traces를 한 번도 받지 않았다 — 빈 목록 아래 수집 설정 안내를 펼쳐 둔다. */
  awaitingData?: boolean;
}
type RequestSource = { kind: 'agent'; agentId: string; serviceKey: string; runtime?: string } | { kind: 'direct'; observedServiceId: string };

function ServiceRequestsPanel({ source, refreshKey, range, traceId: traceFilter, window: controlledWindow, awaitingData = false }: SharedProps & { source: RequestSource; awaitingData?: boolean }) {
  const { search, errorsOnly, page, traceId: queryTraceId, status, method, pathTemplate, update } = useRequestQuery();
  const traceId = traceFilter ?? queryTraceId;
  const [result, setResult] = useState<{ rows: ApiRequest[]; total: number; loading: boolean; error: string | null }>({ rows: [], total: 0, loading: true, error: null });
  const [retryKey, setRetryKey] = useState(0);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const fallbackWindow = useRequestWindow(range, refreshKey);
  const window = controlledWindow ?? fallbackWindow;
  const sourceKind = source.kind;
  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    let active = true;
    const load = async () => {
      setResult(previous => ({ ...previous, loading: true, error: null }));
      try {
        const params = { errorsOnly, search: search || undefined, traceId, method, pathTemplate, ...statusRange(status), ...window, limit: 25, offset: (page - 1) * 25 };
        const response = sourceKind === 'direct'
          ? await api.getObservedServiceRequests(observedServiceId, params)
          : await api.getAgentServiceRequests(agentId, serviceKey, params);
        if (!active) return;
        if (page > 1 && response.data.length === 0) {
          update({ page: null });
          return;
        }
        setResult({ rows: response.data, total: response.total, loading: false, error: null });
      } catch (error) {
        if (active) setResult({ rows: [], total: 0, loading: false, error: getErrorMessage(error) });
      }
    };
    void load();
    return () => { active = false; };
  }, [sourceKind, agentId, serviceKey, observedServiceId, search, errorsOnly, traceId, method, pathTemplate, status, page, window, refreshKey, retryKey, update]);

  const filtered = Boolean(search || errorsOnly || traceId || status || pathTemplate);
  const clear = () => update({ q: null, errorsOnly: null, traceId: null, status: null, method: null, pathTemplate: null, page: null });
  const target: TraceTarget = source.kind === 'direct' ? { kind: 'direct', observedServiceId: source.observedServiceId } : { kind: 'agent', agentId: source.agentId, serviceKey: source.serviceKey };
  const statusFilter = { status, onStatusChange: (value?: StatusClass) => update({ status: value ?? null, page: null }) };
  return <div className="space-y-4">
    {source.kind === 'direct'
      ? <DirectServiceRequestTrends observedServiceId={source.observedServiceId} refreshKey={refreshKey} range={range} window={window} {...statusFilter} />
      : <AgentServiceRequestTrends agentId={source.agentId} serviceKey={source.serviceKey} refreshKey={refreshKey} range={range} window={window} {...statusFilter} />}

    <ApiEndpointTable source={target} window={window} refreshKey={refreshKey}
      selected={method && pathTemplate ? { method, path: pathTemplate } : undefined}
      onSelect={endpoint => update({ method: endpoint?.method ?? null, pathTemplate: endpoint?.path ?? null, page: null })} />

    {/* 검색·필터는 그것이 거르는 "요청 결과" 제목 아래에 둔다 — 제목 위에 있으면 위의 Endpoint 표를 거르는 것처럼 읽혔다. */}
    <ApiRequestResults toolbar={<>
    <div className="flex flex-wrap items-center gap-3">
      <Button variant={errorsOnly ? 'destructive' : 'secondary'} aria-pressed={errorsOnly}
        title="5xx 또는 OpenTelemetry에서 오류로 기록한 요청" onClick={() => update({ errorsOnly: errorsOnly ? null : 'true', page: null })}>
        <MaterialIcon name="error_outline" />에러만
      </Button>
      <form className="flex min-w-0 flex-1 gap-2 max-sm:basis-full" onSubmit={event => {
        event.preventDefault();
        update({ q: String(new FormData(event.currentTarget).get('q') ?? '').trim() || null, page: null });
      }}>
        <SearchInput key={search} name="q" aria-label="요청 경로 검색" defaultValue={search} placeholder="경로 검색…" wrapperClassName="min-w-0 flex-1" />
        <Button type="submit" variant="secondary">검색</Button>
      </form>
    </div>
    {filtered && <div aria-label="적용한 요청 필터" className="flex flex-wrap items-center gap-2 type-caption text-text-secondary">
      {pathTemplate && <span className="break-all font-mono">Endpoint: {method} {pathTemplate}</span>}
      {search && <span className="break-all">경로: {search}</span>}
      {status && <span>상태: {status}</span>}
      {errorsOnly && <span>오류 요청만</span>}
      {traceId && <span className="break-all font-mono">traceId: {traceId}</span>}
      <Button variant="ghost" size="sm" onClick={clear}>필터 해제</Button>
    </div>}
    </>} requests={result.rows} total={result.total} page={page} loading={result.loading} error={result.error}
      filtered={filtered} waiting={awaitingData} onClear={clear} onRetry={() => setRetryKey(key => key + 1)}
      onPageChange={value => update({ page: value === 1 ? null : String(value) })} onSelect={setActiveTraceId} />
    {!result.loading && !result.error && !filtered && result.rows.length === 0 && <details open={awaitingData} className="rounded-xl border border-ui-border bg-bg-surface p-4">
      <summary className="cursor-pointer type-label text-action">수집 설정 안내</summary>
      <div className="mt-4 space-y-4">
        <p className="type-body text-text-muted">HTTP 요청은 method와 HTTP 상태코드가 있는 SERVER span에서 표시합니다. 다른 span이 수신돼도 이 목록은 비어 있을 수 있습니다.</p>
        {source.kind === 'direct' ? <><TelemetrySetupGuidance signals={['traces']} /><TelemetryReceiptStatus path={`/observed-services/${source.observedServiceId}/setup-status`} expected={['traces']} /></>
          : <p className="type-body text-text-muted">{source.runtime ? `${runtimeLabel(source.runtime)} 서비스의 ` : ''}Docker 환경에서 API 수집 설정을 확인해 주세요. 앱에 OpenTelemetry를 연결하거나 Docker Collector의 everyup-ebpf 수집을 설정할 수 있습니다.</p>}
      </div>
    </details>}
    {activeTraceId && <TracePanel traceId={activeTraceId} target={target} onClose={() => setActiveTraceId(null)} />}
  </div>;
}

export function AgentServiceRequestsTab({ agentId, serviceKey, runtime, ...props }: AgentProps) {
  return <ServiceRequestsPanel {...props} source={{ kind: 'agent', agentId, serviceKey, runtime }} />;
}

export function DirectServiceRequestsTab({ observedServiceId, ...props }: DirectProps) {
  return <ServiceRequestsPanel {...props} source={{ kind: 'direct', observedServiceId }} />;
}
