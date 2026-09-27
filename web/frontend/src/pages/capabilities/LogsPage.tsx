import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CollectionStatusBadge, ConnectionSourceBadge, EmptyState, PageHeader, ResourceCardHeader, StatusLight, type CollectionStatus } from '../../components/common';
import { fillBuckets, formatTimeTick } from '../../components/charts';
import { LEVEL_BASE, LEVEL_FILL, LEVEL_TEXT } from '../../features/healthcheck/logLevelStyle';
import { MonitoringConnection } from '../../features/services/components/MonitoringConnection';
import { api, type LogHistogramBucket, type LogPattern, type LogServiceSummary } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

// "지금 이상이 있는가"에 답하는 창 — 보존 기간 전체를 세면 끝난 사고가 계속 빨갛게 남는다.
// /logs/summary·/logs/patterns도 서버에서 같은 24시간을 센다.
const WINDOW_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const SPARKLINE_MIN_SCALE = 10;

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko });

// 수집은 Docker 서비스를 에이전트+이름으로, 직접 연결을 id로 묶는다 — 요약·패턴도 같은 키다.
const scopeKey = (scope: { serviceId?: string; agentId?: string; serviceName?: string }) =>
  scope.agentId ? `agent:${scope.agentId}:${scope.serviceName}` : `direct:${scope.serviceId}`;

interface LogServiceRow {
  key: string;
  name: string;
  connection: 'direct' | 'docker';
  subtitle?: string;
  /** 직접 연결을 꺼 둔 상태. */
  stopped?: boolean;
  /** 서비스 로그 화면 — 카드가 센 것과 같은 24시간 창으로 연다. */
  to: string;
  summary?: LogServiceSummary;
}

/** 시간대별 오류·경고 막대. Grafana Logs Drilldown의 서비스 카드처럼 목록에서 추세만 읽힌다. */
function LogSparkline({ buckets, window: span }: { buckets: LogHistogramBucket[]; window: [number, number] }) {
  // 서버는 로그가 있던 시간대만 준다 — 없는 시간대는 0건이다.
  const slots = fillBuckets(
    buckets.map(bucket => ({ ...bucket, t: Date.parse(bucket.time) })),
    span,
    HOUR_MS,
    t => ({ t, time: '', error: 0, warn: 0, info: 0, debug: 0, trace: 0 }),
  );
  const peak = Math.max(0, ...slots.map(slot => slot.error + slot.warn));
  // 척도는 카드마다지만 바닥을 둔다 — 하루 경고 3건이 꽉 찬 막대로 그려지면 급증처럼 읽혔다.
  const scale = Math.max(peak, SPARKLINE_MIN_SCALE);
  // 1건짜리 시간대가 최댓값 옆에서 0처럼 사라지지 않게 최소 높이를 둔다.
  const bar = (count: number) => ({ height: `${(count / scale) * 100}%`, minHeight: 2 });

  return (
    // 빈 막대는 건수·마지막 줄이 이미 말하는 것 이상을 전하지 않는다 — 수신이 없던 창에서
    // "오류 없음"으로 읽히지 않게 보조기술에는 숨긴다.
    <div
      {...(peak > 0 ? { role: 'img', 'aria-label': `최근 24시간 오류·경고 추이, 가장 많은 시간대 ${peak}건` } : { 'aria-hidden': true })}
      className="flex h-8 items-end gap-px border-b border-ui-border"
    >
      {slots.map(slot => (
        <div key={slot.t} title={`${formatTimeTick(slot.t)} · ERROR ${slot.error} · WARN ${slot.warn}`} className="flex h-full flex-1 flex-col-reverse">
          {slot.error > 0 && <div className={LEVEL_FILL.error} style={bar(slot.error)} />}
          {slot.warn > 0 && <div className={LEVEL_FILL.warn} style={bar(slot.warn)} />}
        </div>
      ))}
    </div>
  );
}

function LogCard({ row, window: span }: { row: LogServiceRow; window: [number, number] }) {
  const summary = row.summary;
  const error = summary?.error ?? 0;
  const warn = summary?.warn ?? 0;
  const lastReceived = summary?.lastReceivedAt;
  // 창 안에 아무 로그도 없으면 0건은 "이상 없음"이 아니라 "모름"이다.
  const receivedInWindow = error + warn > 0 || (!!lastReceived && Date.parse(lastReceived) >= span[0]);
  const collection: CollectionStatus = receivedInWindow ? 'collecting' : lastReceived ? 'delayed' : 'waiting';
  const count = (value: number, tone: string) => (
    receivedInWindow
      ? <p className={`text-lg tabular-nums ${value > 0 ? tone : 'text-text-base'}`}>{value.toLocaleString()}</p>
      : <p className="text-lg text-text-dim" title="최근 24시간 수신한 로그 없음">—</p>
  );

  return (
    <Link to={row.to} className="card-interactive group flex flex-col rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-primary">{row.name}</h3>}
        badge={<ConnectionSourceBadge source={row.connection} />}
        subtitle={row.subtitle}
        status={row.stopped ? <StatusLight tone="error" label="중지됨" /> : <CollectionStatusBadge status={collection} />}
      />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div><p className="text-xs text-text-dim">ERROR</p>{count(error, 'text-status-error')}</div>
        <div><p className="text-xs text-text-dim">WARN</p>{count(warn, 'text-status-warn')}</div>
      </div>
      <div className="mt-3">
        <LogSparkline buckets={summary?.buckets ?? []} window={span} />
      </div>
      <div className="mt-3 flex min-w-0 items-baseline gap-2 text-xs">
        {summary?.latest ? (
          <>
            <span className={`${LEVEL_BASE} ${LEVEL_TEXT[summary.latest.level] ?? LEVEL_TEXT.info}`}>{summary.latest.level}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-text-secondary" title={summary.latest.message}>{summary.latest.message}</span>
            <span className="shrink-0 text-text-dim">{ago(summary.latest.createdAt)}</span>
          </>
        ) : (
          <span className="text-text-muted">
            {!lastReceived
              ? '아직 수신한 로그가 없습니다'
              : receivedInWindow ? `오류·경고 없음 · 마지막 수신 ${ago(lastReceived)}` : `마지막 수신 ${ago(lastReceived)}`}
          </span>
        )}
      </div>
    </Link>
  );
}

function PatternRow({ pattern, row, windowStart }: { pattern: LogPattern; row: LogServiceRow; windowStart: number }) {
  const isNew = Date.parse(pattern.firstSeen) >= windowStart;
  return (
    <li>
      <Link
        to={`${row.to}&pattern=${encodeURIComponent(pattern.fingerprint)}`}
        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ui-hover-soft"
      >
        <span className={`${LEVEL_BASE} mt-0.5 ${LEVEL_TEXT[pattern.level] ?? LEVEL_TEXT.info}`}>{pattern.level}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm text-text-base" title={pattern.message}>{pattern.message}</p>
          {/* 줄바꿈은 항목 사이에서만 — "처음 2일 / 전"처럼 시간 표현이 갈라지지 않게 */}
          <p className="mt-0.5 text-xs text-text-dim">
            {row.name} · <span className="whitespace-nowrap">마지막 {ago(pattern.lastSeen)}</span> ·{' '}
            {isNew
              ? <strong className="whitespace-nowrap font-medium text-text-secondary">새로 발생 · {ago(pattern.firstSeen)}</strong>
              : <span className="whitespace-nowrap">처음 {ago(pattern.firstSeen)}</span>}
          </p>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-text-base">{pattern.count.toLocaleString()}회</span>
      </Link>
    </li>
  );
}

export function LogsPage() {
  const [rows, setRows] = useState<LogServiceRow[]>([]);
  const [patterns, setPatterns] = useState<{ pattern: LogPattern; row: LogServiceRow }[]>([]);
  const [span, setSpan] = useState<[number, number]>([0, 0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(key => key + 1);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getAgents(), api.getAllAgentServicesFlat(), api.getObservedServices('logs'), api.getLogSummary(), api.getLogPatterns(),
    ])
      .then(([agents, agentServices, directServices, summaries, patternRows]) => {
        if (!alive) return;
        // 프로필이 없으면 전 기능 수집(MonitoringSetupPanel과 같은 기본값). 로그를 끈 에이전트의
        // 서비스는 0건이 "이상 없음"으로 읽히므로 뺀다.
        const logAgents = new Set(agents
          .filter(agent => !agent.profile?.capabilities.length || agent.profile.capabilities.includes('logs'))
          .map(agent => agent.id));
        const summaryByKey = new Map((summaries ?? []).map(summary => [scopeKey(summary), summary]));
        const next: LogServiceRow[] = [
          ...(directServices ?? []).map(service => ({
            key: scopeKey({ serviceId: service.id }),
            name: service.name,
            connection: 'direct' as const,
            stopped: !service.isActive,
            to: `/logs/${service.id}?range=24h`,
          })),
          ...(agentServices ?? []).filter(service => logAgents.has(service.agentId)).map(service => ({
            key: scopeKey({ agentId: service.agentId, serviceName: service.name }),
            name: service.name,
            connection: 'docker' as const,
            subtitle: service.agentName,
            to: `/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=logs&range=24h`,
          })),
        ].map(row => ({ ...row, summary: summaryByKey.get(row.key) }));
        // 문제가 있는 서비스가 먼저 — 정렬은 안정적이라 같은 건수끼리는 목록 순서를 지킨다.
        next.sort((a, b) => (b.summary?.error ?? 0) - (a.summary?.error ?? 0) || (b.summary?.warn ?? 0) - (a.summary?.warn ?? 0));
        const rowByKey = new Map(next.map(row => [row.key, row]));

        const now = Date.now();
        setError(null);
        setSpan([now - WINDOW_MS, now]);
        setRows(next);
        // 목록에 없는 서비스(삭제됐거나 로그를 끈 에이전트)의 패턴은 열 곳이 없다.
        setPatterns((patternRows ?? []).flatMap(pattern => {
          const row = rowByKey.get(scopeKey(pattern));
          return row ? [{ pattern, row }] : [];
        }));
      })
      .catch(requestError => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div>
      <PageHeader title="로그" subtitle="서비스별 최근 오류·경고 건수를 보고, 서비스를 열어 로그를 검색합니다.">
        <MonitoringConnection capability="logs" onConnected={reload} />
      </PageHeader>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-48 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title="로그를 불러오지 못했습니다" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState icon="article" title="아직 로그 서비스가 없습니다" description="기존 Docker 환경을 선택하거나 앱을 OpenTelemetry로 직접 연결하면 여기에 표시됩니다.">
          <MonitoringConnection capability="logs" onConnected={reload} />
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="type-section-title text-text-base">로그 서비스</h2>
              <span className="text-xs text-text-dim">{`최근 24시간 · ${rows.length}`}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map(row => <LogCard key={row.key} row={row} window={span} />)}
            </div>
          </section>
          {/* 오류가 없으면 섹션째 숨긴다 — 위 카드가 이미 0건이라고 말한다. */}
          {patterns.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 className="type-section-title text-text-base">자주 발생한 오류·경고</h2>
                <span className="text-xs text-text-dim">최근 24시간 · 숫자·ID만 다른 메시지는 하나로 셉니다</span>
              </div>
              <ul className="divide-y divide-ui-border-soft overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
                {patterns.map(({ pattern, row }) => (
                  <PatternRow key={`${row.key}|${pattern.fingerprint}`} pattern={pattern} row={row} windowStart={span[0]} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
