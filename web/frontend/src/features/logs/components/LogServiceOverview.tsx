import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CollectionStatusBadge, ConnectionSourceBadge, ResourceCardHeader, ResourceTable, StatusLight, type CollectionStatus } from '../../../components/common';
import { fillBuckets, formatTimeTick } from '../../../components/charts';
import { LEVEL_BASE, LEVEL_FILL, LEVEL_TEXT } from '../../healthcheck/logLevelStyle';
import type { LogHistogramBucket, LogPattern, LogServiceSummary } from '../../../services/api';
import type { LogPatternRow, LogServiceRow } from '../logServiceRows';

// 로그 메뉴와 Docker 환경 상세가 같은 서비스별 24시간 요약·반복 패턴을 그린다.

const HOUR_MS = 60 * 60 * 1000;
const SPARKLINE_MIN_SCALE = 10;

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko });

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

// 창 안에 아무 로그도 없으면 0건은 "이상 없음"이 아니라 "모름"이다.
function collectionOf(summary: LogServiceSummary | undefined, windowStart: number): CollectionStatus {
  const lastReceived = summary?.lastReceivedAt;
  if ((summary?.error ?? 0) + (summary?.warn ?? 0) > 0) return 'collecting';
  if (!lastReceived) return 'waiting';
  return Date.parse(lastReceived) >= windowStart ? 'collecting' : 'delayed';
}

function LevelCount({ label, value, tone, known }: { label: string; value: number; tone: string; known: boolean }) {
  return (
    <div>
      <p className="text-xs text-text-dim">{label}</p>
      {known
        ? <p className={`text-lg tabular-nums ${value > 0 ? tone : 'text-text-base'}`}>{value.toLocaleString()}</p>
        : <p className="text-lg text-text-dim" title="최근 24시간 수신한 로그 없음">—</p>}
    </div>
  );
}

/** 카드 맨 아래 한 줄 — 가장 최근 오류(없으면 경고), 그것도 없으면 마지막 수신 시각. */
function LatestLine({ summary, known }: { summary?: LogServiceSummary; known: boolean }) {
  const latest = summary?.latest;
  if (latest) {
    return (
      <>
        <span className={`${LEVEL_BASE} ${LEVEL_TEXT[latest.level] ?? LEVEL_TEXT.info}`}>{latest.level}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-text-secondary" title={latest.message}>{latest.message}</span>
        <span className="shrink-0 text-text-dim">{ago(latest.createdAt)}</span>
      </>
    );
  }
  const lastReceived = summary?.lastReceivedAt;
  if (!lastReceived) return <span className="text-text-muted">아직 수신한 로그가 없습니다</span>;
  return <span className="text-text-muted">{`${known ? '오류·경고 없음 · ' : ''}마지막 수신 ${ago(lastReceived)}`}</span>;
}

function LogCard({ row, window: span, returnTo }: { row: LogServiceRow; window: [number, number]; returnTo: string }) {
  const summary = row.summary;
  const collection = collectionOf(summary, span[0]);
  const known = collection === 'collecting';

  return (
    <Link to={row.to} state={{ returnTo }} className="card-interactive group flex flex-col rounded-xl border border-ui-border bg-bg-surface p-4">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text-base group-hover:text-action">{row.name}</h3>}
        badge={row.connection && <ConnectionSourceBadge source={row.connection} />}
        subtitle={row.subtitle}
        status={row.stopped ? <StatusLight tone="error" label="중지됨" /> : <CollectionStatusBadge status={collection} />}
      />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <LevelCount label="ERROR" value={summary?.error ?? 0} tone={LEVEL_TEXT.error} known={known} />
        <LevelCount label="WARN" value={summary?.warn ?? 0} tone={LEVEL_TEXT.warn} known={known} />
      </div>
      <div className="mt-3">
        <LogSparkline buckets={summary?.buckets ?? []} window={span} />
      </div>
      <div className="mt-3 flex min-w-0 items-baseline gap-2 text-xs">
        <LatestLine summary={summary} known={known} />
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

export function LogServiceOverview({ rows, patterns, span, view, returnTo, title = '로그 서비스' }: {
  rows: LogServiceRow[];
  patterns: LogPatternRow[];
  span: [number, number];
  view: 'card' | 'grid';
  returnTo: string;
  title?: string;
}) {
  return (
    <div className="space-y-5">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="type-section-title text-text-base">{title}</h2>
          <span className="text-xs text-text-dim">{`최근 24시간 · ${rows.length}`}</span>
        </div>
        {view === 'card' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(row => <LogCard key={row.key} row={row} window={span} returnTo={returnTo} />)}</div> :
          <ResourceTable rows={rows} rowKey={row => row.key} ariaLabel={`${title} 그리드`} columns={[
            { key: 'name', label: '서비스', render: row => <><Link to={row.to} state={{ returnTo }} data-row-link className="block truncate font-medium text-action">{row.name}</Link><p className="mt-1 truncate type-caption text-text-muted">{row.subtitle || (row.connection === 'direct' ? '직접 연결' : '')}</p><div className="mt-2 md:hidden">{row.stopped ? <StatusLight tone="error" label="중지됨" /> : <CollectionStatusBadge status={collectionOf(row.summary, span[0])} />}</div><div className="mt-2 flex min-w-0 items-baseline gap-2 text-xs xl:hidden"><LatestLine summary={row.summary} known={collectionOf(row.summary, span[0]) === 'collecting'} /></div></> },
            { key: 'collection', label: '수집', className: 'hidden w-32 md:table-cell', render: row => row.stopped ? <StatusLight tone="error" label="중지됨" /> : <CollectionStatusBadge status={collectionOf(row.summary, span[0])} /> },
            ...(['error', 'warn'] as const).map(level => ({ key: level, label: level.toUpperCase(), className: 'w-20', align: 'right' as const, render: (row: LogServiceRow) => collectionOf(row.summary, span[0]) === 'collecting' ? <span className={row.summary?.[level] ? LEVEL_TEXT[level] : 'text-text-base'}>{(row.summary?.[level] ?? 0).toLocaleString()}</span> : <span className="text-text-muted" title="최근 24시간 수신한 로그 없음">—</span> })),
            { key: 'trend', label: '오류·경고 추이', className: 'hidden w-40 lg:table-cell', render: row => <LogSparkline buckets={row.summary?.buckets ?? []} window={span} /> },
            { key: 'latest', label: '최근 로그', className: 'hidden xl:table-cell', render: row => <div className="flex min-w-0 items-baseline gap-2 text-xs"><LatestLine summary={row.summary} known={collectionOf(row.summary, span[0]) === 'collecting'} /></div> },
          ]} />}
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
  );
}
