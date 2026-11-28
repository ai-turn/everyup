import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, EmptyState, ListMore, MaterialIcon, PageHeader, RefreshStatus, Section } from '../../components/common';
import { StatusShape } from '../../components/common/StatusShape';
import type { StatusTone } from '../../components/common/statusTone';
import { api, type LogServiceSummary, type TimelineIncident, type UptimeMonitor } from '../../services/api';
import { formatDuration, formatIncidentTime } from '../../utils/incidentFormat';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSpinAction } from '../../hooks/useSpinAction';
import { ALL_LOGS_PATH, NEW_SERVER_PATH, SERVERS_PATH, monitorPath, serverPath } from '../../features/servers/serverPaths';
import { STATE_LABEL, type ServerRow } from '../../features/servers/serverStatus';
import { useServers } from '../../features/servers/useServers';
import { SameHostSuggestions } from '../../features/servers/components/SameHostSuggestions';
import { UptimeStrip } from '../../features/uptime/components/UptimeStrip';
import { combineBuckets, mergeBuckets } from '../../features/uptime/uptimeBuckets';
import { useMonitorBuckets } from '../../features/uptime/useMonitorBuckets';
import { UPTIME_STATE_LIGHT, uptimeState } from '../../features/uptime/uptimeState';
import { environmentState } from '../../features/services/environmentState';

/** 업타임 모니터 목록에 먼저 보이는 수. 나머지는 그 자리에서 펼친다. */
const MONITOR_PREVIEW = 6;

const SOURCE_LABELS: Record<string, string> = { timeline: '장애 이력', logs: '오류 로그' };
const STATE_ORDER: Record<StatusTone, number> = { error: 0, warn: 1, idle: 2, healthy: 3 };
const STATE_TEXT: Record<StatusTone, string> = { error: 'text-crit-text', warn: 'text-attn-text', idle: 'text-text-faint', healthy: 'text-ok-text' };

const episodeTitle = (episode: TimelineIncident) => episode.message || (episode.source === 'uptime' ? '업타임 체크 실패' : '컨테이너 상태 이상');
const serverPrefix = (id: string) => `${serverPath(id)}/`;
/** 연결한 대상이 하나라도 있는가. 없는 서버는 대기 중에서도 "연결 전"이라는 할 일이 있다. */
const hasTargets = (row: ServerRow) => Boolean(row.targets.monitors.length || row.targets.apps.length || row.targets.containers.length
  || row.targets.infrastructure || (row.targets.docker && environmentState(row.targets.docker) !== 'install'));

export function OverviewPage() {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineIncident[]>([]);
  const [logSummary, setLogSummary] = useState<LogServiceSummary[] | null>(null);
  const [showAllMonitors, setShowAllMonitors] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pendingLoad = useRef<Promise<void> | null>(null);
  // 서버와 직접 대상의 상태는 서버 목록과 같은 훅과 판정을 쓴다. 따로 계산하면 개요와 서버 목록이 어긋난다.
  // 오류 로그는 요약 띠의 시간별 막대까지 필요해 아래 load가 직접 불러온다(서버별 합계만 주는 훅의 로그 요약은 끈다).
  const servers = useServers({ logSummary: false, includeDocker: true });
  const { poll, refresh: refreshServers } = servers;

  const monitors = useMemo(() => servers.rows.flatMap((row) => row.targets.monitors.map((monitor) => ({ monitor, row }))), [servers.rows]);
  const { buckets, reload: reloadBuckets } = useMonitorBuckets(monitors.map(({ monitor }) => monitor.id));

  const load = useCallback(() => {
    // 두 재시도 버튼과 수동·자동 갱신이 겹쳐도 같은 조회가 끝나기를 기다린다.
    if (pendingLoad.current) return pendingLoad.current;
    pendingLoad.current = (async () => {
      const [timelineResult, logResult] = await Promise.allSettled([api.getIncidentTimeline(7, 6), api.getLogSummary()]);
      const failed: string[] = [];
      if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value ?? []); else failed.push('timeline');
      if (logResult.status === 'fulfilled') setLogSummary(logResult.value ?? []); else failed.push('logs');
      setFailedSources(failed);
      setUpdatedAt(new Date());
    })().finally(() => { pendingLoad.current = null; });
    return pendingLoad.current;
  }, []);
  const loadAll = useCallback(() => Promise.all([load(), refreshServers(), reloadBuckets()]).then(() => undefined), [load, refreshServers, reloadBuckets]);

  const retry = async () => {
    setRetrying(true);
    try {
      await loadAll();
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  useAutoRefresh(() => { void load(); poll(); void reloadBuckets(); }, 30_000, autoRefresh);
  // 직접 누른 새로고침만 아이콘을 돌린다 — 30초 자동 갱신마다 버튼을 비활성으로 깜빡이지 않게 (상세 화면과 같은 방식).
  const { spinning, trigger: handleRefresh } = useSpinAction(loadAll);

  // 서버 목록 자체나 대상 목록(업타임, 앱, 인프라, 메트릭 임계값)을 불러오지 못했다.
  const serverFailures = [...(servers.error ? ['서버'] : []), ...servers.failed.map((item) => item.label)];
  const failedLabels = [...failedSources.map((source) => SOURCE_LABELS[source] ?? source), ...serverFailures];
  // 상태 소스가 하나라도 실패하면 "이상 없음"을 단정할 수 없다. 이력·로그만 실패한 경우는 현재 상태 판단과 무관하다.
  const statusUnknown = serverFailures.length > 0;
  const timelineFailed = failedSources.includes('timeline');

  // 이력의 대상 주소(`/servers/:id/…`, 컨테이너도 서버 아래다)로 부모 서버의 이름을 붙인다.
  const withParent = useCallback((name: string, path: string) => {
    const [, section, rawId = ''] = path.split('?')[0].split('/');
    const id = decodeURIComponent(rawId);
    const parent = section === 'servers' ? servers.rows.find((row) => row.server.id === id)?.server.name : undefined;
    return parent && parent !== name ? `${parent} / ${name}` : name;
  }, [servers.rows]);

  // 주의 필요: 장애·확인 필요 서버와, 아직 아무것도 연결하지 않은 대기 서버(G안 `연결 전`). 일시정지만 있는 대기는 할 일이 아니라 뺀다.
  // 상태 → 이름 순.
  const attention = useMemo(() => servers.rows
    .filter((row) => row.state === 'error' || row.state === 'warn' || (row.state === 'idle' && !hasTargets(row)))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.server.name.localeCompare(b.server.name, 'ko')), [servers.rows]);
  // 장애 수는 사이드바 배지와 같은 판정이다(대상의 장애를 센다).
  const outageCount = servers.rows.reduce((sum, row) => sum + row.issues.filter((issue) => issue.state === 'error').length, 0);
  const activeEpisodes = timeline.filter((episode) => episode.active);

  const sortedMonitors = useMemo(() => [...monitors].sort((a, b) =>
    STATE_ORDER[UPTIME_STATE_LIGHT[uptimeState(a.monitor)][0]] - STATE_ORDER[UPTIME_STATE_LIGHT[uptimeState(b.monitor)][0]]
    || a.monitor.name.localeCompare(b.monitor.name, 'ko')), [monitors]);
  if (showAllMonitors && sortedMonitors.length <= MONITOR_PREVIEW) setShowAllMonitors(false);
  const shownMonitors = showAllMonitors ? sortedMonitors : sortedMonitors.slice(0, MONITOR_PREVIEW);

  // 첫 로드에만 스켈레톤을 보인다 — 대상이 0개인 상태에서 30초마다 다시 깜빡이지 않게.
  if (!updatedAt || (!servers.loaded && !servers.error)) {
    return (
      <div className="page-stack" aria-busy="true">
        <PageHeader menu title="개요" />
        <div className="h-28 animate-pulse rounded-lg bg-surface-hover" />
        <div className="h-80 animate-pulse rounded-lg bg-surface-hover" />
      </div>
    );
  }

  const total = servers.rows.length;

  return (
    <div className="page-stack">
      <PageHeader menu
        title="개요"
        titleNote={`${total}개 서버 · 24시간`}
        // 갱신 상태는 상세 화면과 같은 RefreshStatus다. 메뉴 화면이라 데스크톱은 AppHeader로 간다.
        meta={<RefreshStatus updatedAt={updatedAt} onRefresh={handleRefresh} refreshing={spinning} autoRefresh={autoRefresh} onAutoRefreshChange={setAutoRefresh} />}
      >
        <ButtonLink to={SERVERS_PATH} variant="quiet">서버 전체 보기<MaterialIcon size={16} name="chevron_right" /></ButtonLink>
      </PageHeader>
      {/* 주의 필요 수가 바뀔 때만 읽힌다(텍스트가 같으면 다시 알리지 않는다). */}
      <p className="sr-only" aria-live="polite">
        {`장애 ${outageCount}건, 주의 필요 서버 ${attention.length}대${statusUnknown ? ', 일부 상태 확인 불가' : ''}`}
      </p>

      {failedLabels.length > 0 && (
        <section className="flex flex-col gap-lead rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <MaterialIcon size={20} name="sync_problem" className="icon-lead text-attn-text" />
            <div>
              <p className="type-label text-text">일부 모니터링 정보를 불러오지 못했습니다</p>
              <p className="mt-intra type-body text-text-muted">불러오지 못한 영역: {failedLabels.join(', ')}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="min-w-28" loading={retrying} onClick={() => void retry()}>다시 시도</Button>
        </section>
      )}

      {/* 조회 실패로 0건이 된 것을 "대상 없음"으로 오인해 온보딩을 띄우지 않는다. */}
      {total === 0 && !statusUnknown ? (
        <section>
          <EmptyState icon="sensors" headingLevel="h2" title="아직 모니터링 대상이 없습니다"
            description="서버를 추가해 업타임, 로그, 인프라 같은 기능을 연결하세요.">
            <ButtonLink to={NEW_SERVER_PATH}>서버 추가</ButtonLink>
          </EmptyState>
        </section>
      ) : (
        <div className="flex flex-col gap-section">
          <SummaryStrip rows={servers.rows} monitors={monitors.map(({ monitor }) => monitor)} buckets={buckets}
            outageCount={outageCount} activeEpisodes={activeEpisodes} logSummary={logSummary} statusUnknown={statusUnknown} />

          <Section id="attention" label="주의 필요" className="scroll-mt-5" title="주의 필요" meta={statusUnknown ? null : attention.length}>
            {/* 장애·확인 필요가 없으면 먼저 그것을 말한다. 대기(연결 대기 같은 할 일)는 그 아래 표에 남는다. */}
            {!attention.some((row) => row.state !== 'idle') && (
              <div className="flex items-center gap-3 py-3">
                <MaterialIcon name={statusUnknown ? 'sync_problem' : 'check_circle'} className={statusUnknown ? 'text-attn-text' : 'text-ok-text'} />
                <p className="type-body text-text-muted">{statusUnknown ? '불러온 영역에서는 장애·확인 필요 없음' : '장애·확인 필요 없음'}</p>
              </div>
            )}
            {attention.length > 0 && <AttentionTable rows={attention} timeline={activeEpisodes} buckets={buckets} />}
          </Section>

          {/* 같은 호스트 제안(ADR 0012). 지금의 이상보다 덜 급한 정리 일이라 주의 필요 다음이다. */}
          <SameHostSuggestions rows={servers.rows} />

          <div className="grid gap-x-10 gap-y-section xl:grid-cols-2">
            <Section label="최근 장애" title="최근 장애"
              meta={<><span aria-hidden="true">7일</span><span className="sr-only">{timelineFailed ? '최근 장애 확인 불가' : `최근 장애 ${timeline.length}건`}</span></>}>
              {timelineFailed && (
                <div role="status" className="flex flex-col gap-label cell sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2 type-body text-text-muted">
                    <MaterialIcon name="sync_problem" className="icon-lead shrink-0 text-attn-text" />
                    <span><span className="type-label text-text">장애 이력을 불러오지 못했습니다</span>{' '}
                      {timeline.length > 0 ? '이전에 불러온 기록입니다. 최신 기록은 확인할 수 없습니다.' : '최근 7일간의 장애 기록을 확인할 수 없습니다.'}</span>
                  </p>
                  <Button variant="secondary" size="sm" className="min-w-28" loading={retrying} onClick={() => void retry()}>다시 시도</Button>
                </div>
              )}
              {timeline.length === 0 ? (
                !timelineFailed && <p className="py-3 type-body text-text-muted">최근 7일 장애 없음</p>
              ) : (
                <ul className="border-b border-border">
                  {timeline.map((episode) => (
                    <li key={`${episode.source}-${episode.targetPath}-${episode.startedAt}`}>
                      <Link to={episode.targetPath} className={`${ROW} grid-cols-[0.625rem_minmax(0,1fr)_auto] py-2`}>
                        {episode.active ? <StatusShape tone="error" /> : <ResolvedMark />}
                        <span className="min-w-0">
                          <span className={`block truncate type-label ${episode.active ? 'text-text' : 'text-text-muted'}`}>{episodeTitle(episode)}</span>
                          <span className="block truncate type-caption text-text-faint">{withParent(episode.targetName, episode.targetPath)} · {formatIncidentTime(episode.startedAt)}</span>
                        </span>
                        {episode.active
                          ? <span className="whitespace-nowrap type-label-sm text-crit-text">진행 중 · {formatDuration(episode.durationSec)}</span>
                          : <span className="whitespace-nowrap rounded-full border border-border-strong px-2 type-caption text-text-muted">해결 · {formatDuration(episode.durationSec)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section label="업타임 모니터" title="업타임 모니터" meta={`24시간 · ${monitors.length}개`}>
              {monitors.length === 0 ? (
                <p className="py-3 type-body text-text-muted">업타임 모니터 없음</p>
              ) : (
                <div>
                  <ul className="border-b border-border">
                    {shownMonitors.map(({ monitor, row }) => (
                      <li key={monitor.id}><MonitorRow monitor={monitor} row={row} buckets={buckets[monitor.id]} /></li>
                    ))}
                  </ul>
                  {sortedMonitors.length > MONITOR_PREVIEW && (
                    <div className="list-more">
                      <ListMore expanded={showAllMonitors} onToggle={() => setShowAllMonitors((value) => !value)}
                        label={showAllMonitors ? '앞의 6개만 보기' : `모니터 ${sortedMonitors.length}개 모두 보기`} />
                    </div>
                  )}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

/** 목록 행의 공통 모양(G안): 위 헤어라인, hover 채움, 둥근 hover. 목록의 맨 아래 선은 감싼 ul이 긋는다. */
const ROW = 'grid min-h-12 items-center gap-3 rounded-md border-t border-border px-3 text-text transition-colors hover:bg-surface-hover';

function ResolvedMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
      <circle cx="5" cy="5" r="4" fill="none" stroke="var(--text-faint)" strokeWidth="1.4" />
    </svg>
  );
}

function SummaryStrip({ rows, monitors, buckets, outageCount, activeEpisodes, logSummary, statusUnknown }: {
  rows: ServerRow[];
  monitors: UptimeMonitor[];
  buckets: Record<string, import('../../services/api').ServiceHistoryPoint[]>;
  outageCount: number;
  activeEpisodes: TimelineIncident[];
  logSummary: LogServiceSummary[] | null;
  statusUnknown: boolean;
}) {
  const count = (tone: StatusTone) => rows.filter((row) => row.state === tone).length;
  const measured = monitors.filter((monitor) => monitor.uptime !== undefined);
  const avgUptime = measured.length ? measured.reduce((sum, m) => sum + (m.uptime ?? 0), 0) / measured.length : undefined;
  const uptimeSlots = mergeBuckets(combineBuckets(monitors.map((m) => buckets[m.id] ?? [])), 4).filter((slot) => slot.total > 0);
  const longest = activeEpisodes.reduce((max, episode) => Math.max(max, episode.durationSec), 0);
  const errorTotal = logSummary?.reduce((sum, s) => sum + s.error, 0);
  const hourly = hourlyErrors(logSummary ?? []);

  return (
    <section aria-label="요약" className="grid divide-y divide-border rounded-lg border border-border bg-surface sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
      <Tile icon="dns" label="정상 서버"
        value={<>{statusUnknown ? '-' : count('healthy')}<span className="type-stat text-text-faint"> / {rows.length}</span></>}
        foot={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ToneCount tone="error" n={count('error')} />
          <ToneCount tone="warn" n={count('warn')} />
          <ToneCount tone="idle" n={count('idle')} />
        </span>}
      />
      <Tile icon="monitor_heart" label="평균 업타임"
        value={avgUptime === undefined ? '-' : <>{avgUptime.toFixed(2)}<span className="type-stat text-text-faint">%</span></>}
        chart={uptimeSlots.length > 1 && <Sparkline values={uptimeSlots.map((slot) => slot.pct)} />}
        foot={`24시간 · 모니터 ${monitors.length}개`}
      />
      <Tile icon="warning" label="활성 장애"
        value={<span className={outageCount > 0 ? 'text-crit-text' : undefined}>{statusUnknown ? '-' : outageCount}<span className="type-stat text-text-faint">건</span></span>}
        foot={longest > 0 ? `최장 ${formatDuration(longest)} 경과` : '진행 중 장애 없음'}
      />
      <Tile icon="article" label={<Link to={ALL_LOGS_PATH} className="inline-flex min-h-11 items-center link-underline sm:min-h-0">에러 로그</Link>}
        value={errorTotal === undefined ? '-' : <>{errorTotal}<span className="type-stat text-text-faint">건</span></>}
        chart={hourly.some((n) => n > 0) && <Bars values={hourly} />}
        foot={errorTotal === undefined ? '불러오지 못함' : `24시간 · 최근 1시간 ${hourly[hourly.length - 1] ?? 0}건`}
      />
    </section>
  );
}

function Tile({ icon, label, value, chart, foot }: { icon: string; label: ReactNode; value: ReactNode; chart?: ReactNode; foot: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-label px-5 py-4">
      <p className="flex items-center gap-2 type-body text-text-muted"><MaterialIcon size={16} name={icon} className="shrink-0" />{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="type-kpi text-text">{value}</p>
        {chart}
      </div>
      <div className="type-caption text-text-faint">{foot}</div>
    </div>
  );
}

function ToneCount({ tone, n }: { tone: StatusTone; n: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${n > 0 ? STATE_TEXT[tone] : 'text-text-faint'}`}>
      <StatusShape tone={tone} size={8} />{STATE_LABEL[tone]} {n}
    </span>
  );
}

/** 24시간 시간별 오류 로그 수(오래된 것부터 24칸). 서버는 빈 시간을 주지 않는다. */
function hourlyErrors(summaries: LogServiceSummary[]): number[] {
  const hour = 3_600_000;
  const now = Math.floor(Date.now() / hour) * hour;
  const counts = Array.from({ length: 24 }, () => 0);
  for (const summary of summaries) for (const bucket of summary.buckets) {
    const slot = 23 - Math.round((now - Math.floor(Date.parse(bucket.time) / hour) * hour) / hour);
    if (slot >= 0 && slot < 24) counts[slot] += bucket.error;
  }
  return counts;
}

function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values, 99);
  const range = Math.max(100 - min, 0.01);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 90},${2 + (1 - (v - min) / range) * 20}`).join(' ');
  return (
    <svg width="90" height="24" viewBox="0 0 90 24" aria-hidden="true" className="shrink-0">
      <polyline points={points} fill="none" stroke="var(--chart-2)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 90 / values.length;
  return (
    <svg width="90" height="24" viewBox="0 0 90 24" aria-hidden="true" className="shrink-0">
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(2, (v / max) * 24) : 0;
        return <rect key={i} x={i * w} y={24 - h} width={w - 1} height={h} fill={i === values.length - 1 && v > 0 ? 'var(--crit)' : 'var(--chart-4)'} />;
      })}
    </svg>
  );
}

function AttentionTable({ rows, timeline, buckets }: {
  rows: ServerRow[];
  timeline: TimelineIncident[];
  buckets: Record<string, import('../../services/api').ServiceHistoryPoint[]>;
}) {
  const cols = 'grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,12rem)_6rem_minmax(0,1fr)_4.5rem_15.5rem]';
  return (
    <div>
      <div aria-hidden="true" className={`hidden gap-4 px-3 pb-2 type-label-sm text-text-faint md:grid ${cols}`}>
        <span>서버</span><span>상태</span><span>원인</span><span>경과</span><span>업타임 · 24시간</span>
      </div>
      <ul className="border-b border-border">
        {rows.map((row) => {
          const cause = row.issues.length > 0
            ? row.issues.map((issue) => `${issue.name === row.server.name ? '' : `${issue.name} `}${issue.detail}${issue.threshold !== undefined ? ` · 기준 ${issue.threshold}%` : ''}`).join(' · ')
            : row.cause?.text ?? '';
          const longest = timeline.filter((episode) => episode.targetPath.startsWith(serverPrefix(row.server.id)))
            .reduce((max, episode) => Math.max(max, episode.durationSec), 0);
          const series = row.targets.monitors.map((monitor) => buckets[monitor.id]).filter(Boolean);
          return (
            <li key={row.server.id}>
              <Link to={serverPath(row.server.id)} className={`${ROW} gap-4 py-2 md:py-0 ${cols}`}>
                <span className="flex min-w-0 items-center gap-lead">
                  <StatusShape tone={row.state} />
                  <span className="min-w-0">
                    <span className="block truncate type-label">{row.server.name}</span>
                    <span className="block truncate type-caption text-text-muted md:hidden">{cause}</span>
                  </span>
                </span>
                <span className={`type-label ${STATE_TEXT[row.state]}`}>{STATE_LABEL[row.state]}</span>
                <span className="hidden truncate type-body text-text-muted md:block">{cause}</span>
                <span className="hidden tabular-nums type-body text-text-muted md:block">{longest > 0 ? formatDuration(longest) : '—'}</span>
                <span className="hidden items-center gap-lead md:flex">
                  {series.length > 0 ? <UptimeStrip buckets={combineBuckets(series)} /> : !hasTargets(row) && (
                    <span className="inline-flex h-4.5 items-center rounded-sm border border-dashed border-uptime-no-data px-2 type-caption text-text-faint">연결 전</span>
                  )}
                  {row.uptime !== undefined && <span className="tabular-nums type-caption text-text-muted">{row.uptime.toFixed(2)}%</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MonitorRow({ monitor, row, buckets }: { monitor: UptimeMonitor; row: ServerRow; buckets?: import('../../services/api').ServiceHistoryPoint[] }) {
  const state = uptimeState(monitor);
  const [tone, label] = UPTIME_STATE_LIGHT[state];
  return (
    <Link to={monitorPath(row.server.id, monitor.id)} className={`${ROW} grid-cols-[0.625rem_minmax(0,1fr)_3.75rem] py-2 sm:grid-cols-[0.625rem_minmax(0,9rem)_minmax(0,1fr)_3.75rem_3.5rem]`}>
      <StatusShape tone={tone} label={label} />
      <span className="min-w-0">
        <span className="block truncate type-label">{monitor.name}</span>
        <span className="block truncate type-caption text-text-faint">{row.server.name}</span>
      </span>
      <span className="hidden sm:block">{buckets && <UptimeStrip buckets={buckets} className="w-full" />}</span>
      <span className="text-right tabular-nums type-caption text-text-muted">{monitor.uptime === undefined ? '—' : `${monitor.uptime.toFixed(2)}%`}</span>
      <span className={`hidden text-right tabular-nums type-caption sm:block ${state === 'down' ? 'text-crit-text' : 'text-text-muted'}`}>
        {state === 'down' ? '실패' : state === 'up' && monitor.responseTime !== undefined ? `${Math.round(monitor.responseTime)} ms` : label}
      </span>
    </Link>
  );
}
