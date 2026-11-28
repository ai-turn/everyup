import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Button, EmptyState, MaterialIcon, ResourceTable, Section, TimeRangePicker, type GlobalTimeRange } from '../../../components/common';
import { StatusShape } from '../../../components/common/StatusShape';
import type { StatusTone } from '../../../components/common/statusTone';
import { useHeaderActionSlot } from '../../../contexts/BreadcrumbContext';
import { useInfraMetrics } from '../../../hooks/useInfra';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { api, type AgentServiceFlat, type LogServiceSummary, type UptimeMonitorDay } from '../../../services/api';
import { formatClock } from '../../../utils/incidentFormat';
import { formatThroughput } from '../../../utils/systemTransform';
import { connectAction, DOCKER_INSTALL } from '../../connections/connectCopy';
import { containerPath } from '../../docker/dockerPaths';
import { InfraTrends } from '../../infra/components/InfraTrends';
import { WARNING_PCT } from '../../infra/usage';
import { CONNECT_STATE, SERVER_CAPABILITIES, serverPath, type ServerCapability } from '../serverPaths';
import { capabilityUnverified, type ServerRow, type TargetIssue } from '../serverStatus';

const ISSUE_LINK: Record<TargetIssue['kind'], string> = { monitor: '모니터 보기', container: '컨테이너 보기', app: '앱 보기', infrastructure: '인프라 보기', docker: 'Docker Collector 보기' };

/** 장애 배너(G안, Better Stack): 지금 장애인 대상마다 한 줄. 누르면 그 대상으로 간다. */
function IncidentBanners({ issues }: { issues: TargetIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <section aria-label="진행 중 장애" className="flex flex-col gap-label">
      {issues.map((issue) => (
        <Link key={`${issue.kind}-${issue.id}`} to={issue.to}
          className="flex min-h-11.5 items-center gap-lead rounded-lg border border-crit-border bg-crit-bg px-3.5 text-text transition-colors hover:bg-crit/15">
          <StatusShape tone="error" />
          <span className="min-w-0 truncate type-label">{issue.text}</span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 type-label-sm text-crit-text">{ISSUE_LINK[issue.kind]}<MaterialIcon size={16} name="chevron_right" /></span>
        </Link>
      ))}
    </section>
  );
}

interface Kpi { label: string; value: ReactNode; unit?: string; note?: string; warn?: boolean }

/** 주요 지표 띠: 테두리 하나에 칸을 세로선으로 나눈다(개요의 요약 띠와 같은 틀). */
function KpiStrip({ cells }: { cells: Kpi[] }) {
  if (cells.length === 0) return null;
  return (
    <section aria-label="주요 지표" className="grid grid-cols-2 divide-border rounded-lg border border-border bg-surface sm:flex sm:divide-x">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0 flex-1 px-4.5 py-3.5">
          <p className="type-caption text-text-faint">{cell.label}</p>
          <p className="mt-label flex flex-wrap items-baseline gap-x-2">
            <span className={`type-kpi ${cell.warn ? 'text-attn-text' : 'text-text'}`}>{cell.value}<span className="type-caption text-text-faint">{cell.unit}</span></span>
            {cell.note && <span className="type-caption tabular-nums text-text-faint">{cell.note}</span>}
            {cell.warn && <span className="sr-only">, 주의 기준 초과</span>}
          </p>
        </div>
      ))}
    </section>
  );
}

const CONTAINER_PREVIEW = 6;
const containerTone = (container: AgentServiceFlat): StatusTone => !container.seen ? 'idle' : container.healthy ? 'healthy' : 'error';
const CONTAINER_STATE: Record<StatusTone, [string, string]> = {
  error: ['응답 없음', 'text-crit-text'], warn: ['확인 필요', 'text-attn-text'], healthy: ['실행 중', 'text-text-muted'], idle: ['대기', 'text-text-faint'],
};

function ContainersSection({ row }: { row: ServerRow }) {
  const order: Record<StatusTone, number> = { error: 0, warn: 1, idle: 2, healthy: 3 };
  const all = [...row.targets.containers].sort((a, b) => order[containerTone(a)] - order[containerTone(b)] || a.name.localeCompare(b.name));
  const running = all.filter((container) => containerTone(container) === 'healthy').length;
  return (
    <Section label="컨테이너" title="컨테이너" meta={`${all.length} · 실행 중 ${running}`}
      actions={<Link to={serverPath(row.server.id, 'containers')} className="inline-flex min-h-11 items-center type-caption text-text-muted link-underline sm:min-h-0">전체 보기</Link>}>
      {all.length === 0 ? <p className="py-3 type-body text-text-muted">발견한 컨테이너 없음</p> : (
        <ResourceTable rows={all.slice(0, CONTAINER_PREVIEW)} rowKey={(container) => container.key} ariaLabel="컨테이너 요약" columns={[
          { key: 'name', label: '컨테이너', className: 'w-48', render: (container) => (
            <span className="flex min-w-0 items-center gap-lead">
              <StatusShape tone={containerTone(container)} />
              <Link data-row-link to={containerPath(row.server.id, container.key)} className="truncate type-label text-text">{container.name}</Link>
            </span>
          ) },
          { key: 'image', label: '이미지', className: 'hidden md:table-cell', render: (container) => <span className="block truncate font-mono type-caption text-text-faint">{container.image ?? '-'}</span> },
          { key: 'restarts', label: '재시작', className: 'w-20', align: 'right', render: (container) => (
            <span className={(container.restartCount ?? 0) > 0 ? 'text-attn-text' : 'text-text-muted'}>{container.restartCount ?? 0}</span>
          ) },
          { key: 'state', label: '상태', className: 'w-28', render: (container) => {
            const [label, color] = CONTAINER_STATE[containerTone(container)];
            return <span className={`type-label ${color}`}>{label}</span>;
          } },
        ]} />
      )}
    </Section>
  );
}

/** 최근 에러 로그: 로그를 보내는 앱마다 가장 최근의 오류(없으면 경고) 한 줄, 새것부터 다섯. */
function RecentErrorLogs({ serverId }: { serverId: string }) {
  const [summary, setSummary] = useState<LogServiceSummary[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.getLogSummary(serverId).then((rows) => { if (alive) setSummary(rows ?? []); }).catch(() => { if (alive) setSummary(null); });
    return () => { alive = false; };
  }, [serverId]);
  const lines = (summary ?? []).filter((s) => s.latest).sort((a, b) => Date.parse(b.latest!.createdAt) - Date.parse(a.latest!.createdAt)).slice(0, 5);
  const errors = (summary ?? []).reduce((sum, s) => sum + s.error, 0);
  return (
    <Section label="최근 에러 로그" title="최근 에러 로그" meta={summary ? `24시간 · ${errors}건` : undefined}
      actions={<Link to={serverPath(serverId, 'logs')} className="inline-flex min-h-11 items-center type-caption text-text-muted link-underline sm:min-h-0">로그 열기</Link>}>
      {summary === undefined ? <div className="h-24 animate-pulse rounded-md bg-surface-hover" />
        : summary === null ? <p className="py-3 type-body text-text-muted">로그를 불러오지 못했습니다</p>
          : lines.length === 0 ? <p className="py-3 type-body text-text-muted">24시간 오류·경고 없음</p> : (
            <ul className="border-t border-border">
              {lines.map((s) => (
                <li key={`${s.serviceId ?? s.agentId}-${s.serviceName}`} className="grid grid-cols-[4rem_minmax(0,7rem)_minmax(0,1fr)] gap-3 border-b border-border px-3 cell font-mono type-caption">
                  <span className="tabular-nums text-text-faint">{formatClock(s.latest!.createdAt, true)}</span>
                  <span className={`truncate ${s.latest!.level === 'error' ? 'text-crit-text' : 'text-attn-text'}`}>{s.serviceName}</span>
                  <span className="truncate text-text">{s.latest!.message}</span>
                </li>
              ))}
            </ul>
          )}
    </Section>
  );
}

const DAY_CLASS: Record<UptimeMonitorDay['status'] | 'none', string> = { up: 'bg-uptime-ok', partial: 'bg-attn', down: 'bg-uptime-fail', none: 'bg-uptime-no-data' };

/** 90일 업타임: 서버의 모니터들의 일별 상태를 합친다(하루에 하나라도 전체 실패면 장애, 일부 실패면 확인 필요). */
function Uptime90({ monitorIds }: { monitorIds: string[] }) {
  const [days, setDays] = useState<Map<string, UptimeMonitorDay['status']> | null | undefined>(undefined);
  const [pct, setPct] = useState<number | undefined>();
  const key = monitorIds.join(',');
  useEffect(() => {
    let alive = true;
    const ids = key.split(',');
    Promise.all(ids.map((id) => api.getUptimeMonitorHistory(id, 90))).then((histories) => {
      if (!alive) return;
      const rank = { up: 0, partial: 1, down: 2 } as const;
      const merged = new Map<string, UptimeMonitorDay['status']>();
      for (const history of histories) for (const day of history?.days ?? []) {
        const prev = merged.get(day.date);
        if (!prev || rank[day.status] > rank[prev]) merged.set(day.date, day.status);
      }
      setDays(merged);
      const values = histories.map((history) => history?.percentage).filter((value): value is number => value !== undefined);
      setPct(values.length ? Math.min(...values) : undefined);
    }).catch(() => { if (alive) setDays(null); });
    return () => { alive = false; };
  }, [key]);
  const today = new Date();
  const dates = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - 89 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const statuses = dates.map((date) => days?.get(date) ?? 'none');
  const down = statuses.filter((s) => s === 'down').length;
  const partial = statuses.filter((s) => s === 'partial').length;
  return (
    <Section label="업타임 90일" title="업타임" meta="90일"
      actions={pct !== undefined && <span className="type-label tabular-nums text-text">{pct.toFixed(2)}%</span>}>
      {days === undefined ? <div className="h-16 animate-pulse rounded-md bg-surface-hover" />
        : days === null ? <p className="py-3 type-body text-text-muted">90일 이력을 불러오지 못했습니다</p> : (
          <div className="border-t border-border pt-3">
            <div role="img" aria-label={`최근 90일 중 장애 ${down}일, 일부 실패 ${partial}일`} className="flex h-8 gap-px">
              {statuses.map((status, i) => <span key={dates[i]} className={`min-w-0 flex-1 rounded-xs ${DAY_CLASS[status]}`} />)}
            </div>
            <div className="mt-intra flex justify-between type-caption tabular-nums text-text-faint"><span>90일 전</span><span>오늘</span></div>
            <p className="mt-label flex flex-wrap gap-x-4 type-caption text-text-muted">
              <span className="inline-flex items-center gap-1.5"><StatusShape tone="error" size={8} />장애 {down}일</span>
              <span className="inline-flex items-center gap-1.5"><StatusShape tone="warn" size={8} />일부 실패 {partial}일</span>
            </p>
          </div>
        )}
    </Section>
  );
}

/** onInstallDocker: Docker Collector가 없는 서버에 설치 창을 연다(ADR 0012). 연결할 수 있는 기능의 끝에 둔다. */
export function ServerOverviewTab({ row, onInstallDocker, refreshToken = 0 }: { row: ServerRow; onInstallDocker?: () => void; refreshToken?: number }) {
  const navigate = useNavigate();
  const slot = useHeaderActionSlot();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [range, setRange] = useState<GlobalTimeRange>('6h');
  const infra = row.targets.infrastructure;
  const { data: metrics, loading: metricsLoading, error: metricsError } = useInfraMetrics(infra?.id ?? '', range, refreshToken);

  // 연결은 데이터가 보일 자리(기능 탭)에서 시작한다. 개요는 그 탭으로 옮기면서 대화 상자를 열어 달라고만 한다(연결 진입점 정리 D2).
  const startConnect = (key: ServerCapability) => navigate(serverPath(row.server.id, key), { state: { [CONNECT_STATE]: true } });
  const unknown = (key: ServerCapability) => capabilityUnverified(row, key);
  const connected = SERVER_CAPABILITIES.filter(({ key }) => row.capabilities[key] !== null || unknown(key));
  // Docker Collector가 아직 모으지 않는 기능은 설정 가이드가 같은 이름의 버튼으로 더한다. 업타임 모니터는 Docker 기능이 아니다.
  const dockerProfile = row.targets.docker?.profile?.capabilities ?? [];
  const offeredByGuide = (key: ServerCapability) => key !== 'uptime' && dockerProfile.length > 0 && !dockerProfile.includes(key);
  const connectable = SERVER_CAPABILITIES.filter(({ key }) => row.capabilities[key] === null && !unknown(key) && !offeredByGuide(key));

  if (connected.length === 0 && row.containers === null) {
    return (
      <EmptyState icon="dns" headingLevel="h2" title="아직 연결한 기능이 없습니다" description="업타임 모니터는 설치 없이 바로 추가할 수 있습니다. 다른 기능은 연결하면 API Key와 설정 예시를 받습니다.">
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => startConnect('uptime')}>{connectAction('uptime')}</Button>
          {SERVER_CAPABILITIES.filter(({ key }) => key !== 'uptime').map(({ key }) => (
            <Button key={key} variant="secondary" onClick={() => startConnect(key)}>{connectAction(key)}</Button>
          ))}
          {onInstallDocker && <Button variant="secondary" onClick={onInstallDocker}>{DOCKER_INSTALL}</Button>}
        </div>
      </EmptyState>
    );
  }

  const info = metrics?.info;
  const gb = (value: number) => `${value.toFixed(value >= 100 ? 0 : 1)}`;
  const cells: Kpi[] = [
    ...(row.cpu !== undefined ? [{ label: 'CPU', value: row.cpu.toFixed(0), unit: '%', note: info?.cpu.cores ? `${info.cpu.cores}코어` : undefined, warn: row.cpu >= WARNING_PCT }] : []),
    ...(row.memory !== undefined ? [{ label: '메모리', value: row.memory.toFixed(0), unit: '%', note: info?.memory.total ? `${gb(info.memory.used)} / ${gb(info.memory.total)} GB` : undefined, warn: row.memory >= WARNING_PCT }] : []),
    ...(row.disk !== undefined ? [{ label: '디스크', value: row.disk.toFixed(0), unit: '%', note: info?.disk.total ? `${gb(info.disk.used)} / ${gb(info.disk.total)} GB` : undefined, warn: row.disk >= WARNING_PCT }] : []),
    ...(info ? (() => {
      const inbound = formatThroughput(info.network.in);
      const outbound = formatThroughput(info.network.out);
      return [{ label: '네트워크', value: inbound.value, unit: ` ${inbound.unit}`, note: `↓ 수신 · ↑ ${outbound.value} ${outbound.unit}` }];
    })() : []),
    ...(row.uptime !== undefined ? [{ label: '업타임 · 24시간', value: row.uptime.toFixed(2), unit: '%', note: `모니터 ${row.targets.monitors.length}개` }] : []),
  ];
  // 이전에 불러온 대상 목록의 장애를 지금의 장애처럼 띄우지 않는다.
  const issues = row.issues.filter((issue) => issue.state === 'error' && !(issue.kind === 'monitor' && unknown('uptime'))).slice(0, 3);

  return (
    <div className="flex flex-col gap-section">
      {/* 차트의 기간은 넓은 화면에서 상단 줄 오른쪽이다(G안). 좁은 화면은 차트 위에 둔다. */}
      {infra && desktop && slot && createPortal(<TimeRangePicker size="sm" value={range} onChange={setRange} />, slot)}
      <div className="flex flex-col gap-group">
        <IncidentBanners issues={issues} />
        <KpiStrip cells={cells} />
      </div>
      {row.containers !== null && <ContainersSection row={row} />}
      {infra && (
        <Section label="인프라 추세" title="인프라" actions={!desktop && <TimeRangePicker value={range} onChange={setRange} />}>
          <InfraTrends hostId={infra.id} charts={metrics?.charts} loading={metricsLoading} error={metricsError} range={range} showHeading={false} />
        </Section>
      )}
      {(row.capabilities.logs !== null || row.targets.monitors.length > 0) && (
        <div className="grid gap-x-10 gap-y-section xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {row.capabilities.logs !== null && <RecentErrorLogs serverId={row.server.id} />}
          {row.targets.monitors.length > 0 && <Uptime90 monitorIds={row.targets.monitors.map((monitor) => monitor.id)} />}
        </div>
      )}
      {(connectable.length > 0 || onInstallDocker) && (
        <section aria-labelledby="server-connectable" className="space-y-label">
          <h2 id="server-connectable" className="type-section-title text-text">연결할 수 있는 기능</h2>
          <div className="-mx-2 flex flex-wrap gap-x-2">
            {connectable.map(({ key }) => <Button key={key} variant="text" className="px-2" onClick={() => startConnect(key)}>{connectAction(key)}</Button>)}
            {onInstallDocker && <Button variant="text" className="px-2" onClick={onInstallDocker}>{DOCKER_INSTALL}</Button>}
          </div>
        </section>
      )}
    </div>
  );
}
