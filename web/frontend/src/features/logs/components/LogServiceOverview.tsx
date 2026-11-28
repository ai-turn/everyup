import { useState, type ReactNode } from 'react';
import { Tooltip } from '../../../components/common/Tooltip';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button, CollectionStatusBadge, ResourceCardHeader, List, ListRow, ResourceTable, Section, StatusLight, type CollectionStatus } from '../../../components/common';
import { fillBuckets, formatTimeTick } from '../../../components/charts';
import { LEVEL_BASE, LEVEL_FILL, LEVEL_TEXT } from '../../healthcheck/logLevelStyle';
import type { LogHistogramBucket, LogPattern, LogServiceSummary } from '../../../services/api';
import type { LogPatternRow, LogServiceRow } from '../logServiceRows';

// 전체 로그, 서버 로그 탭, Docker 환경 상세가 같은 서비스별 24시간 요약·반복 패턴을 그린다.

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
      className="flex h-8 items-end gap-px border-b border-border"
    >
      {slots.map(slot => (
        <Tooltip key={slot.t} content={`${formatTimeTick(slot.t)} 오류 ${slot.error}건, 경고 ${slot.warn}건`}><div className="flex h-full flex-1 flex-col-reverse">
          {slot.error > 0 && <div className={LEVEL_FILL.error} style={bar(slot.error)} />}
          {slot.warn > 0 && <div className={LEVEL_FILL.warn} style={bar(slot.warn)} />}
        </div></Tooltip>
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
      <p className="type-caption text-text-faint">{label}</p>
      {known
        ? <p className={`type-stat ${value > 0 ? tone : 'text-text'}`}>{value.toLocaleString()}</p>
        : <Tooltip content="최근 24시간 수신한 로그 없음" focusable><p className="type-stat text-text-faint">-</p></Tooltip>}
    </div>
  );
}

/** 카드 맨 아래 한 줄 — 가장 최근 오류(없으면 경고), 그것도 없으면 마지막 수신 시각. */
/** wrap: 좁은 셀(모바일 표의 이름 칸) — 메시지를 둘째 줄 전체 폭으로 내린다. 한 줄이면 `Conne…`만 남았다. */
function LatestLine({ summary, known, wrap = false }: { summary?: LogServiceSummary; known: boolean; wrap?: boolean }) {
  const latest = summary?.latest;
  if (latest) {
    return (
      <>
        <span className={`${LEVEL_BASE} ${LEVEL_TEXT[latest.level] ?? LEVEL_TEXT.info}`}>{latest.level}</span>
        <Tooltip content={latest.message} focusable><span className={`min-w-0 font-mono text-text ${wrap ? 'order-last basis-full line-clamp-2 break-all' : 'flex-1 truncate'}`}>{latest.message}</span></Tooltip>
        <span className="shrink-0 text-text-faint">{ago(latest.createdAt)}</span>
      </>
    );
  }
  const lastReceived = summary?.lastReceivedAt;
  if (!lastReceived) return <span className="text-text-muted">아직 수신한 로그가 없습니다</span>;
  return <span className="text-text-muted">{`${known ? '오류·경고 없음 · ' : ''}마지막 수신 ${ago(lastReceived)}`}</span>;
}

type StatusRow = LogServiceRow & { collection: CollectionStatus };

function LogStatus({ row }: { row: StatusRow }) {
  return row.stopped ? <StatusLight tone="error" label="중지됨" /> : <CollectionStatusBadge status={row.collection} />;
}

function LogCard({ row, window: span, returnTo }: { row: StatusRow; window: [number, number]; returnTo: string }) {
  const summary = row.summary;
  const known = row.collection === 'collecting';

  return (
    <Link to={row.to} state={{ returnTo }} className="card-interactive group flex flex-col rounded-xl border border-border bg-surface p-4">
      <ResourceCardHeader
        title={<h3 className="truncate type-card-title text-text group-hover:text-text">{row.name}</h3>}
        subtitle={row.subtitle}
        status={<LogStatus row={row} />}
      />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <LevelCount label="오류" value={summary?.error ?? 0} tone={LEVEL_TEXT.error} known={known} />
        <LevelCount label="경고" value={summary?.warn ?? 0} tone={LEVEL_TEXT.warn} known={known} />
      </div>
      <div className="mt-3 space-y-intra">
        <LogSparkline buckets={summary?.buckets ?? []} window={span} />
        {/* 막대만으로는 시간 방향을 알 수 없었다 — 양 끝만 짧게 적는다. */}
        <div aria-hidden="true" className="flex justify-between type-caption text-text-faint"><span>24시간 전</span><span>지금</span></div>
      </div>
      <div className="mt-3 flex min-w-0 items-baseline gap-2 type-caption">
        <LatestLine summary={summary} known={known} />
      </div>
    </Link>
  );
}

function PatternRow({ pattern, row, windowStart }: { pattern: LogPattern; row: LogServiceRow; windowStart: number }) {
  const isNew = Date.parse(pattern.firstSeen) >= windowStart;
  return (
    <ListRow
      to={`${row.to}&pattern=${encodeURIComponent(pattern.fingerprint)}`}
      marker={<span className={`${LEVEL_BASE} ${LEVEL_TEXT[pattern.level] ?? LEVEL_TEXT.info}`}>{pattern.level}</span>}
      title={<Tooltip content={pattern.message}><span className="block truncate font-mono font-normal">{pattern.message}</span></Tooltip>}
      detailSize="caption"
      detail={
        // 줄바꿈은 항목 사이에서만 — "처음 2일 / 전"처럼 시간 표현이 갈라지지 않게
        <span className="flex flex-wrap gap-x-3">
          <span>{row.name}</span>{row.serverName && row.serverName !== row.name && <span>서버 {row.serverName}</span>}<span className="whitespace-nowrap">마지막 {ago(pattern.lastSeen)}</span>
          {isNew
            ? <strong className="whitespace-nowrap font-medium text-text">신규 · 처음 {ago(pattern.firstSeen)}</strong>
            : <span className="whitespace-nowrap">처음 {ago(pattern.firstSeen)}</span>}
        </span>
      }
      trailing={<span className="type-control text-text">{pattern.count.toLocaleString()}회</span>}
    />
  );
}

const PATTERN_PREVIEW = 5;

export function LogServiceOverview({ rows, patterns, span, view, returnTo, title, noun, viewToggle, onRetryPatterns }: {
  rows: LogServiceRow[];
  /** null이면 패턴만 불러오지 못한 상태 — 서비스 목록은 그대로 그린다. */
  patterns: LogPatternRow[] | null;
  span: [number, number];
  view: 'card' | 'grid';
  returnTo: string;
  title: string;
  /** 행이 가리키는 대상의 이름(개수 문구, 이름 열). 서버 화면은 앱, 컨테이너 탭은 컨테이너라고 부른다. */
  noun: string;
  /** 보기 전환 — 제목 줄 오른쪽에 둔다. */
  viewToggle?: ReactNode;
  /** 패턴만 불러오지 못했을 때 다시 시도 */
  onRetryPatterns?: () => void;
}) {
  const statusRows = rows.map(row => ({ ...row, collection: collectionOf(row.summary, span[0]) }));
  // 패턴은 상위 몇 개만 먼저 — 20행이 이어지면 페이지 대부분을 차지해 위의 서비스 목록이 묻혔다.
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const shownPatterns = patterns && !showAllPatterns ? patterns.slice(0, PATTERN_PREVIEW) : patterns;
  return (
    // 서비스 목록과 반복 패턴은 성격이 다른 두 섹션이라 개요처럼 section-stack(32px + 옅은 선)으로 나눈다.
    <div className="section-stack">
      <Section title={title} meta={`최근 24시간 · ${noun} ${rows.length}개`} actions={viewToggle}>
        {view === 'card' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{statusRows.map(row => <LogCard key={row.key} row={row} window={span} returnTo={returnTo} />)}</div> :
          <ResourceTable rows={statusRows} rowKey={row => row.key} ariaLabel={`${title} 그리드`} columns={[
            { key: 'name', label: noun, render: row => <><Link to={row.to} state={{ returnTo }} data-row-link className="block truncate font-medium text-text">{row.name}</Link>{row.subtitle && <p className="mt-1 truncate type-caption text-text-muted">{row.subtitle}</p>}<div className="mt-2 md:hidden"><LogStatus row={row} /></div><div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 type-caption-stack xl:hidden"><LatestLine wrap summary={row.summary} known={row.collection === 'collecting'} /></div></> },
            { key: 'collection', label: '수집', className: 'hidden w-32 md:table-cell', render: row => <LogStatus row={row} /> },
            ...(['error', 'warn'] as const).map(level => ({ key: level, label: level === 'error' ? '오류' : '경고', className: 'w-20', align: 'right' as const, render: (row: StatusRow) => row.collection === 'collecting' ? <span className={row.summary?.[level] ? LEVEL_TEXT[level] : 'text-text'}>{(row.summary?.[level] ?? 0).toLocaleString()}</span> : <Tooltip content="최근 24시간 수신한 로그 없음" focusable><span className="text-text-muted">-</span></Tooltip> })),
            { key: 'trend', label: '오류·경고 추이', className: 'hidden w-40 lg:table-cell', render: row => <LogSparkline buckets={row.summary?.buckets ?? []} window={span} /> },
            { key: 'latest', label: '최근 로그', className: 'hidden xl:table-cell', render: row => <div className="flex min-w-0 items-baseline gap-2 type-caption"><LatestLine summary={row.summary} known={row.collection === 'collecting'} /></div> },
          ]} />}
      </Section>
      {/* 오류가 없으면 섹션째 숨긴다 — 위 카드가 이미 0건이라고 말한다. 실패는 숨기지 않는다 — "패턴 없음"으로 읽힌다. */}
      {(patterns === null || patterns.length > 0) && (
        // 위 앱 목록과 같은 섹션 제목(20px, DESIGN.md §2.2). 집계 방식은 긴 설명이라 메타가 아니라 제목 아래 설명 줄이다.
        <Section title="자주 발생한 오류·경고" description="최근 24시간 기준이며, 숫자·ID만 다른 메시지는 하나로 셉니다.">
          {patterns === null ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <p className="type-body text-text-muted">반복 패턴을 불러오지 못했습니다.</p>
              {onRetryPatterns && <Button variant="secondary" size="sm" onClick={onRetryPatterns}>다시 시도</Button>}
            </div>
          ) : (
            <List>
              {shownPatterns!.map(({ pattern, row }) => (
                <PatternRow key={`${row.key}|${pattern.fingerprint}`} pattern={pattern} row={row} windowStart={span[0]} />
              ))}
            </List>
          )}
          {patterns && patterns.length > PATTERN_PREVIEW && (
            // 목록(list-bleed)의 아래 -10px 위에서 버튼까지 8px. 펼치기 조작의 자리는 이 묶음이 갖는다.
            <div className="pt-2">
              <Button variant="ghost" size="sm" aria-expanded={showAllPatterns} onClick={() => setShowAllPatterns(value => !value)}>
                {showAllPatterns ? '접기' : `전체 보기 (${patterns.length})`}
              </Button>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
