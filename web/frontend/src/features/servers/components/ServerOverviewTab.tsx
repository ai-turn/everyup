import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState, StatusLight, type StatusTone } from '../../../components/common';
import type { UptimeMonitor } from '../../../services/api';
import { formatDuration } from '../../../utils/incidentFormat';
import { WARNING_PCT } from '../../infra/usage';
import { RecentUptimeChecks } from '../../uptime/components/RecentUptimeChecks';
import { SERVER_CAPABILITIES, serverPath, type ServerCapability } from '../serverPaths';
import { capabilityTargets, monitorState, STATE_LABEL, STATE_ORDER, type ServerRow } from '../serverStatus';

const percent = (value: number | undefined, digits: number) => value === undefined ? '-' : `${value.toFixed(digits)}%`;
const count = (value: number) => `${value}개`;

interface Stat { label: string; value: string; warn?: boolean }

function stats(row: ServerRow, capability: ServerCapability, known: boolean): Stat[] {
  const targets = known ? capabilityTargets(row.targets, capability).length : undefined;
  const n = targets === undefined ? '-' : count(targets);
  const usage = (label: string, value?: number): Stat => ({ label, value: percent(value, 1), warn: value !== undefined && value >= WARNING_PCT });
  switch (capability) {
    case 'uptime': return [{ label: '모니터', value: n }, { label: '24시간 가용률', value: percent(row.uptime, 2) }];
    case 'infrastructure': return [usage('CPU', row.cpu), usage('메모리', row.memory), usage('디스크', row.disk)];
    case 'logs': return [{ label: '앱', value: n }, { label: '24시간 오류 로그', value: row.errorLogs === undefined ? '-' : row.errorLogs.toLocaleString() }];
    default: return [{ label: '앱', value: n }];
  }
}

function MonitorChecks({ monitor }: { monitor: UptimeMonitor }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 truncate type-caption text-text-secondary">{monitor.name}</p>
      {!monitor.recentChecks ? <p className="type-caption text-text-muted">체크 기록 확인 불가</p>
        : monitor.recentChecks.length === 0 ? <p className="type-caption text-text-muted">{monitor.isActive ? '첫 체크 대기' : '체크 기록 없음'}</p>
          : <RecentUptimeChecks metrics={monitor.recentChecks} paused={!monitor.isActive} />}
    </div>
  );
}

function CapabilityRow({ row, capability, label, tone, known }: { row: ServerRow; capability: ServerCapability; label: string; tone: StatusTone; known: boolean }) {
  const headingId = useId();
  // 모니터가 많으면 상태가 나쁜 순으로 셋까지만 띠를 그린다. 나머지는 업타임 탭에 있다.
  const monitors = capability === 'uptime'
    ? [...row.targets.monitors].sort((a, b) => STATE_ORDER[monitorState(a).state] - STATE_ORDER[monitorState(b).state]).slice(0, 3)
    : [];
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
      <div className="sm:w-40 sm:shrink-0">
        <h3 id={headingId} className="type-card-title text-text-base">{label}</h3>
        <div className="mt-1"><StatusLight tone={tone} label={known ? STATE_LABEL[tone] : '확인 불가'} pulse={tone === 'error'} /></div>
      </div>
      <div className="min-w-0 flex-1 space-y-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats(row, capability, known).map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="type-caption text-text-muted">{stat.label}</dt>
              <dd className={`mt-1 type-label tabular-nums ${stat.warn ? 'text-status-warn' : 'text-text-base'}`}>{stat.value}</dd>
            </div>
          ))}
        </dl>
        {monitors.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {monitors.map((monitor) => <MonitorChecks key={monitor.id} monitor={monitor} />)}
          </div>
        )}
      </div>
      <Link to={serverPath(row.server.id, capability)} className="inline-flex min-h-11 shrink-0 items-center type-label text-action link-underline sm:min-h-0">{label} 보기</Link>
    </section>
  );
}

export function ServerOverviewTab({ row, unknown, onOpen }: {
  row: ServerRow;
  /** 대상 목록을 불러오지 못한 기능. 연결 여부를 모르므로 "연결할 수 있는 기능"에 넣지 않는다. */
  unknown: ReadonlySet<ServerCapability>;
  onOpen: (capability: ServerCapability) => void;
}) {
  const connected = SERVER_CAPABILITIES
    .filter(({ key }) => row.capabilities[key] !== null || unknown.has(key))
    .map((item) => ({ ...item, known: !unknown.has(item.key), tone: row.capabilities[item.key] ?? 'warn' }))
    .sort((a, b) => STATE_ORDER[a.tone] - STATE_ORDER[b.tone]);
  const connectable = SERVER_CAPABILITIES.filter(({ key }) => row.capabilities[key] === null && !unknown.has(key));

  if (connected.length === 0) {
    return (
      <EmptyState icon="dns" title="아직 연결한 기능이 없습니다" description="업타임 모니터는 설치 없이 바로 추가할 수 있습니다.">
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => onOpen('uptime')}>업타임 모니터 추가</Button>
          {connectable.filter(({ key }) => key !== 'uptime').map(({ key, label }) => (
            <Button key={key} variant="secondary" onClick={() => onOpen(key)}>{label} 연결</Button>
          ))}
        </div>
      </EmptyState>
    );
  }

  // 진행 중인 장애가 여럿이면 가장 오래된 것을 배너에 둔다.
  const incidents = row.targets.monitors
    .filter((monitor) => monitor.activeIncident?.active)
    .sort((a, b) => (b.activeIncident?.durationSec ?? 0) - (a.activeIncident?.durationSec ?? 0));
  const incident = incidents[0];

  return (
    <div className="space-y-5">
      {incident && (
        <Link to={serverPath(row.server.id, 'uptime', incident.id)}
          className="flex w-full items-center gap-3 rounded-xl border border-ui-border-soft bg-bg-surface px-4 py-3 text-left transition-colors hover:bg-ui-hover-soft">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-status-error-fill" />
          <span className="min-w-0 truncate type-label text-text-base">진행 중 장애: {incident.name}</span>
          <span className="shrink-0 type-caption text-text-muted">
            {formatDuration(incident.activeIncident!.durationSec)} 경과{incidents.length > 1 && ` · +${incidents.length - 1}`}
          </span>
        </Link>
      )}
      <div className="section-stack">
        <section aria-label="연결된 기능" className="section-stack">
          {connected.map(({ key, label, tone, known }) => <CapabilityRow key={key} row={row} capability={key} label={label} tone={tone} known={known} />)}
        </section>
        {connectable.length > 0 && (
          <section aria-labelledby="server-connectable" className="space-y-2">
            <h2 id="server-connectable" className="type-card-title text-text-base">연결할 수 있는 기능</h2>
            <div className="-mx-2 flex flex-wrap gap-x-2">
              {connectable.map(({ key, label }) => <Button key={key} variant="text" className="px-2" onClick={() => onOpen(key)}>{label}</Button>)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
