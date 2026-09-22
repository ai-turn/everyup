import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CopyButton, ICON_ACTION_SM, MaterialIcon } from '../../../components/common';
import { useClipboardCopy } from '../../../hooks/useClipboardCopy';
import { useOverlay, SCRIM_PANEL } from '../../../hooks/useOverlay';
import { getErrorMessage } from '../../../utils/errors';
import { api, TraceDetail, TraceSpan, LogEntry, ApiRequest } from '../../../services/api';

interface TracePanelProps {
  traceId: string;
  target: TraceTarget;
  onClose: () => void;
}

export type TraceTarget =
  | { kind: 'agent'; agentId: string; serviceKey: string }
  | { kind: 'direct'; observedServiceId: string };

function traceTargetPath(target: TraceTarget, tab: 'logs' | 'requests', traceId: string): string {
  const query = `traceId=${encodeURIComponent(traceId)}`;
  if (target.kind === 'agent') {
    return `/services/${target.agentId}/${encodeURIComponent(target.serviceKey)}?tab=${tab}&${query}`;
  }
  return tab === 'logs'
    ? `/logs/${target.observedServiceId}?${query}`
    : `/api/${target.observedServiceId}?${query}`;
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
}

function spanKindBadge(kind: string): string {
  switch (kind) {
    case 'SERVER':   return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'CLIENT':   return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'PRODUCER':
    case 'CONSUMER': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'INTERNAL': return 'bg-slate-500/10 text-text-muted';
    default:         return 'bg-slate-500/10 text-text-muted';
  }
}

function statusBadge(code: string | undefined): string {
  if (code === 'ERROR') return 'bg-status-error/10 text-status-error';
  if (code === 'OK')    return 'bg-status-healthy/10 text-status-healthy';
  return 'bg-slate-500/10 text-text-muted';
}

function logLevelBadge(level: string): string {
  switch (level) {
    case 'error': return 'bg-red-500/10 text-red-600 dark:text-red-400';
    case 'warn':  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'info':  return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'debug': return 'bg-slate-500/10 text-text-muted';
    case 'trace': return 'bg-slate-500/10 text-text-dim';
    default:      return 'bg-slate-500/10 text-text-muted';
  }
}

type CopyFn = (text: string) => Promise<boolean>;

function copyButton(onCopy: () => Promise<boolean>, label: string) {
  return (
    <CopyButton
      onCopy={onCopy}
      className={`${ICON_ACTION_SM} ml-auto`}
      title={label}
    />
  );
}

function formatSpanCopy(span: TraceSpan): string {
  return [
    `kind=${span.kind}`,
    `name=${span.name || '(unnamed)'}`,
    span.serviceName ? `service=${span.serviceName}` : null,
    span.statusCode && span.statusCode !== 'UNSET' ? `status=${span.statusCode}` : null,
    `duration=${formatDuration(span.durationMs)}`,
    `traceId=${span.traceId}`,
    `spanId=${span.spanId}`,
  ].filter(Boolean).join(' ');
}

function formatApiRequestCopy(req: ApiRequest): string {
  return [
    `method=${req.method}`,
    `path=${req.path}`,
    `status=${req.statusCode}`,
    `duration=${formatDuration(req.durationMs)}`,
    req.serviceName ? `service=${req.serviceName}` : null,
    req.traceId ? `traceId=${req.traceId}` : null,
    req.spanId ? `spanId=${req.spanId}` : null,
  ].filter(Boolean).join(' ');
}

function formatLogCopy(log: LogEntry): string {
  return [
    `time=${log.createdAt}`,
    `level=${log.level}`,
    `message=${log.message}`,
    log.serviceName ? `service=${log.serviceName}` : null,
    log.traceId ? `traceId=${log.traceId}` : null,
    log.spanId ? `spanId=${log.spanId}` : null,
  ].filter(Boolean).join(' ');
}

interface CapturedBody {
  id: string;
  label: string;
  body: string;
  spanName: string;
  serviceName?: string;
  size?: number;
  truncated?: boolean;
}

function attrString(attrs: Record<string, unknown> | undefined, key: string): string {
  const value = attrs?.[key];
  return typeof value === 'string' ? value : '';
}

function attrNumber(attrs: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = attrs?.[key];
  return typeof value === 'number' ? value : undefined;
}

function attrBool(attrs: Record<string, unknown> | undefined, key: string): boolean {
  return attrs?.[key] === true;
}

function capturedBodyLabel(eventName: string): string {
  if (eventName === 'request_body_masked') return '요청';
  if (eventName === 'response_body_masked') return '응답';
  return '바디';
}

function extractCapturedBodies(spans: TraceSpan[]): CapturedBody[] {
  return spans.flatMap((span) =>
    (span.events ?? [])
      .filter((event) => event.name === 'request_body_masked' || event.name === 'response_body_masked')
      .map((event) => ({
        id: `${span.traceId}-${span.spanId}-${event.name}-${event.timeUnixNano ?? 0}`,
        label: capturedBodyLabel(event.name),
        body: attrString(event.attributes, 'body'),
        spanName: span.name || '(unnamed)',
        serviceName: span.serviceName,
        size: attrNumber(event.attributes, 'body_size'),
        truncated: attrBool(event.attributes, 'body_truncated'),
      }))
      .filter((item) => item.body !== ''),
  );
}

// Non-admins get captured bodies stripped server-side (body deleted,
// body_redacted=true). Count them so the panel can show an access notice
// instead of silently hiding the section.
function countRedactedBodies(spans: TraceSpan[]): number {
  return spans.reduce(
    (n, span) =>
      n +
      (span.events ?? []).filter(
        (event) =>
          (event.name === 'request_body_masked' || event.name === 'response_body_masked') &&
          attrBool(event.attributes, 'body_redacted'),
      ).length,
    0,
  );
}

function formatCapturedBodyCopy(item: CapturedBody): string {
  return [
    `${item.label.toLowerCase()} body`,
    item.serviceName ? `service=${item.serviceName}` : null,
    `span=${item.spanName}`,
    item.truncated ? 'truncated=true' : null,
    item.body,
  ].filter(Boolean).join('\n');
}

interface HeaderEntry {
  name: string;
  value: string;
}

interface CapturedHeaders {
  id: string;
  spanName: string;
  serviceName?: string;
  request: HeaderEntry[];
  response: HeaderEntry[];
}

// OTel captures headers as `http.request.header.<name>` / `http.response.header.<name>`
// span attributes; values are arrays of strings per semconv. Sensitive names
// arrive already masked ("***") from ingest.
function headerValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value ?? '');
}

function extractCapturedHeaders(spans: TraceSpan[]): CapturedHeaders[] {
  const out: CapturedHeaders[] = [];
  for (const span of spans) {
    const request: HeaderEntry[] = [];
    const response: HeaderEntry[] = [];
    for (const [key, value] of Object.entries(span.attributes ?? {})) {
      if (key.startsWith('http.request.header.')) {
        request.push({ name: key.slice('http.request.header.'.length), value: headerValue(value) });
      } else if (key.startsWith('http.response.header.')) {
        response.push({ name: key.slice('http.response.header.'.length), value: headerValue(value) });
      }
    }
    if (request.length === 0 && response.length === 0) continue;
    request.sort((a, b) => a.name.localeCompare(b.name));
    response.sort((a, b) => a.name.localeCompare(b.name));
    out.push({
      id: `${span.traceId}-${span.spanId}-headers`,
      spanName: span.name || '(unnamed)',
      serviceName: span.serviceName,
      request,
      response,
    });
  }
  return out;
}

function formatCapturedHeadersCopy(item: CapturedHeaders): string {
  const lines = [item.serviceName ? `service=${item.serviceName}` : null, `span=${item.spanName}`];
  if (item.request.length > 0) {
    lines.push('[request headers]', ...item.request.map((h) => `${h.name}: ${h.value}`));
  }
  if (item.response.length > 0) {
    lines.push('[response headers]', ...item.response.map((h) => `${h.name}: ${h.value}`));
  }
  return lines.filter(Boolean).join('\n');
}

export function TracePanel({ traceId, target, onClose }: TracePanelProps) {
  const { copy } = useClipboardCopy();

  const navigate = useNavigate();
  const [data, setData] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const jumpTo = (tab: 'logs' | 'requests') => {
    onClose();
    navigate(traceTargetPath(target, tab, traceId));
  };

  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(true, onClose, panelRef);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const trace = await api.getTrace(traceId);
        if (!cancelled) setData(trace);
      } catch (error) {
        if (!cancelled) setError(getErrorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [traceId]);

  const spans = data?.spans ?? [];
  const logs = data?.logs ?? [];
  const apiRequests = data?.apiRequests ?? [];
  const capturedBodies = extractCapturedBodies(spans);
  const redactedBodyCount = countRedactedBodies(spans);
  const capturedHeaders = extractCapturedHeaders(spans);
  const isEmpty = !loading && !error && spans.length === 0 && logs.length === 0 && apiRequests.length === 0;

  return (
    <div
      className={`fixed inset-0 z-50 ${SCRIM_PANEL}`}
      role="dialog"
      aria-modal="true"
      aria-label="트레이스 상세"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-y-0 right-0 w-full sm:w-[560px] lg:w-[720px] bg-bg-surface border-l border-ui-border shadow-lg flex flex-col animate-slide-in-right"
      >
        <div className="flex-none flex items-center gap-3 px-5 h-16 border-b border-ui-border">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <MaterialIcon size={20} name="timeline" />
          </div>
          <h3 className="type-card-title text-text-base shrink-0">트레이스</h3>
          <code
            className="flex-1 min-w-0 truncate text-xs font-mono text-text-dim"
            title={traceId}
          >
            {traceId}
          </code>
          <CopyButton
            onCopy={() => copy(traceId)}
            className={ICON_ACTION_SM}
            title="트레이스 ID 복사"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-ui-hover text-slate-400 hover:text-text-secondary cursor-pointer shrink-0"
            aria-label="닫기"
          >
            <MaterialIcon size={16} name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-text-muted">
              <MaterialIcon size={16} name="sync" className="mr-2 animate-spin" />
              트레이스 불러오는 중...
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-ui-hover-soft rounded-lg border border-ui-border">
              <MaterialIcon size={16} name="error" className="text-status-error shrink-0 mt-0.5" />
              <p className="text-sm text-text-secondary">{error}</p>
            </div>
          )}

          {isEmpty && (
            <div className="text-center py-10 text-sm text-text-muted">
              이 트레이스에 연결된 span·로그·API 요청이 없습니다.
            </div>
          )}

          {!loading && !error && (logs.length > 0 || apiRequests.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-text-muted mr-1">
                탭에서 보기:
              </span>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => jumpTo('logs')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <MaterialIcon size={16} name="article" />
                  {`로그 (${logs.length})`}
                </button>
              )}
              {apiRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => jumpTo('requests')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <MaterialIcon size={16} name="http" />
                  {`API 요청 (${apiRequests.length})`}
                </button>
              )}
            </div>
          )}

          {!loading && !error && spans.length > 0 && (
            <SpanList spans={spans} onCopy={copy} />
          )}
          {!loading && !error && capturedHeaders.length > 0 && (
            <CapturedHeadersList items={capturedHeaders} onCopy={copy} />
          )}
          {!loading && !error && capturedBodies.length > 0 && (
            <CapturedBodyList items={capturedBodies} onCopy={copy} />
          )}
          {!loading && !error && capturedBodies.length === 0 && redactedBodyCount > 0 && (
            <RestrictedBodyNotice count={redactedBodyCount} />
          )}
          {!loading && !error && apiRequests.length > 0 && (
            <ApiRequestList items={apiRequests} onCopy={copy} />
          )}
          {!loading && !error && logs.length > 0 && (
            <LogList logs={logs} onCopy={copy} />
          )}
        </div>
      </div>
    </div>
  );
}

function PanelSectionHeader({ icon, title, count }: { icon: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <MaterialIcon size={16} name={icon} className="text-primary" />
      <h4 className="type-label text-text-base">{title}</h4>
      <span className="text-xs font-medium text-text-secondary bg-ui-active px-2 py-0.5 rounded-md">
        {count}
      </span>
    </div>
  );
}

// Solid bar color for the waterfall track — error wins, else by span kind.
function spanBarColor(span: TraceSpan): string {
  if (span.statusCode === 'ERROR') return 'bg-status-error';
  switch (span.kind) {
    case 'SERVER':   return 'bg-emerald-500';
    case 'CLIENT':   return 'bg-sky-500';
    case 'PRODUCER':
    case 'CONSUMER': return 'bg-amber-500';
    default:         return 'bg-slate-400';
  }
}

function SpanList({ spans, onCopy }: { spans: TraceSpan[]; onCopy: CopyFn }) {

  // Waterfall bounds: earliest start → latest end across the trace.
  const traceStart = Math.min(...spans.map((s) => s.startUnixNano));
  const traceEnd = Math.max(...spans.map((s) => s.endUnixNano));
  const total = Math.max(traceEnd - traceStart, 1);

  return (
    <section>
      <PanelSectionHeader icon="account_tree" title="스팬" count={spans.length} />
      <ul className="space-y-1.5">
        {spans.map((span) => {
          const leftPct = Math.min(Math.max(((span.startUnixNano - traceStart) / total) * 100, 0), 100);
          const widthPct = Math.min(Math.max(((span.endUnixNano - span.startUnixNano) / total) * 100, 0.75), 100 - leftPct);
          return (
            <li
              key={`${span.traceId}-${span.spanId}`}
              className="px-3 py-2 rounded-lg bg-ui-hover-soft border border-ui-border-soft text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs shrink-0 ${spanKindBadge(span.kind)}`}>
                  {span.kind}
                </span>
                <span className="font-mono text-text-secondary truncate flex-1 min-w-0" title={span.name}>
                  {span.name || '(unnamed)'}
                </span>
                {span.serviceName && (
                  <span className="text-text-muted shrink-0">
                    {span.serviceName}
                  </span>
                )}
                {span.statusCode && span.statusCode !== 'UNSET' && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${statusBadge(span.statusCode)}`}>
                    {span.statusCode}
                  </span>
                )}
                <span className="text-text-muted font-mono shrink-0">
                  {formatDuration(span.durationMs)}
                </span>
                {copyButton(() => onCopy(formatSpanCopy(span)), '스팬 행 복사')}
              </div>
              {/* Waterfall track: bar positioned/sized by the span's time window */}
              <div className="relative mt-1.5 h-1.5 w-full rounded bg-slate-200/70 dark:bg-ui-active-dark">
                <div
                  className={`absolute top-0 h-full rounded ${spanBarColor(span)}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HeaderRows({ label, headers }: { label: string; headers: HeaderEntry[] }) {
  if (headers.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-dim">{label}</p>
      <dl className="space-y-0.5">
        {headers.map((h) => (
          <div key={h.name} className="flex gap-2 font-mono text-xs">
            <dt className="shrink-0 text-text-muted">{h.name}:</dt>
            <dd className={`min-w-0 break-all ${h.value === '***' ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'}`}>
              {h.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CapturedHeadersList({ items, onCopy }: { items: CapturedHeaders[]; onCopy: CopyFn }) {

  return (
    <section>
      <PanelSectionHeader icon="list_alt" title="헤더" count={items.length} />
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-ui-border-dark dark:bg-ui-hover-dark"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {item.serviceName && (
                <span className="text-text-muted">{item.serviceName}</span>
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-text-muted" title={item.spanName}>
                {item.spanName}
              </span>
              {copyButton(() => onCopy(formatCapturedHeadersCopy(item)), '헤더 복사')}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <HeaderRows label="요청" headers={item.request} />
              <HeaderRows label="응답" headers={item.response} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Captured request/response bodies are admin-only; the backend audit-logs every
// admin view on fetch. Non-admins never reach this list (see RestrictedBodyNotice).
function RestrictedBodyNotice({ count }: { count: number }) {

  return (
    <section>
      <PanelSectionHeader icon="data_object" title="캡처된 바디" count={count} />
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-ui-border-dark dark:bg-ui-hover-dark">
        <MaterialIcon size={20} name="lock" className="text-amber-500 shrink-0" />
        <div>
          <p className="font-medium text-text-secondary">관리자 전용</p>
          <p className="text-text-muted">
            캡처된 바디를 볼 권한이 없습니다.
          </p>
        </div>
      </div>
    </section>
  );
}

function CapturedBodyList({ items, onCopy }: { items: CapturedBody[]; onCopy: CopyFn }) {

  return (
    <section>
      <PanelSectionHeader icon="data_object" title="캡처된 바디" count={items.length} />
      <p className="mb-2 flex items-center gap-1.5 text-xs text-text-dim">
        <MaterialIcon size={16} name="policy" />
        관리자 전용 · 모든 열람은 감사 로그에 기록됩니다
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-ui-border-dark dark:bg-ui-hover-dark"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                {item.label}
              </span>
              {item.serviceName && (
                <span className="text-text-muted">
                  {item.serviceName}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-text-muted" title={item.spanName}>
                {item.spanName}
              </span>
              {typeof item.size === 'number' && (
                <span className="font-mono text-xs text-text-dim">
                  {item.size}B
                </span>
              )}
              {item.truncated && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                  잘림
                </span>
              )}
              {copyButton(() => onCopy(formatCapturedBodyCopy(item)), '캡처된 바디 복사')}
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700 dark:border-ui-border-dark dark:bg-bg-surface-dark dark:text-text-base-dark">{item.body}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApiRequestList({ items, onCopy }: { items: ApiRequest[]; onCopy: CopyFn }) {

  return (
    <section>
      <PanelSectionHeader icon="api" title="API 요청" count={items.length} />
      <ul className="space-y-1.5">
        {items.map((req) => (
          <li
            key={req.id}
            className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-ui-hover-soft border border-ui-border-soft text-sm sm:flex-nowrap"
          >
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-ui-active text-text-secondary shrink-0">
              {req.method}
            </span>
            <span className="font-mono text-text-secondary truncate flex-1 min-w-0" title={req.path}>
              {req.path}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${
              req.isError
                ? 'bg-status-error/10 text-status-error'
                : 'bg-status-healthy/10 text-status-healthy'
            }`}>
              {req.statusCode}
            </span>
            <span className="text-text-muted font-mono shrink-0">
              {formatDuration(req.durationMs)}
            </span>
            {copyButton(() => onCopy(formatApiRequestCopy(req)), 'API 요청 행 복사')}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LogList({ logs, onCopy }: { logs: LogEntry[]; onCopy: CopyFn }) {

  return (
    <section>
      <PanelSectionHeader icon="article" title="로그" count={logs.length} />
      <ul className="space-y-1.5">
        {logs.map((log) => (
          <li
            key={log.id}
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-ui-hover-soft border border-ui-border-soft text-sm"
          >
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs shrink-0 ${logLevelBadge(log.level)}`}>
              {log.level.toUpperCase()}
            </span>
            <span className="text-text-muted font-mono shrink-0 mt-0.5">
              {formatTime(log.createdAt)}
            </span>
            <span className="text-text-secondary break-all flex-1 min-w-0">
              {log.message}
            </span>
            {copyButton(() => onCopy(formatLogCopy(log)), '로그 행 복사')}
          </li>
        ))}
      </ul>
    </section>
  );
}
