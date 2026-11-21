import { useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, EmptyState, StatusLight, type StatusTone } from '../../../components/common';
import type { UptimeMonitor } from '../../../services/api';
import { formatDuration } from '../../../utils/incidentFormat';
import { WARNING_PCT } from '../../infra/usage';
import { RecentUptimeChecks } from '../../uptime/components/RecentUptimeChecks';
import { ADD_MONITOR_STATE, SERVER_CAPABILITIES, serverPath, type ServerCapability } from '../serverPaths';
import { capabilityLabel, capabilityTargets, capabilityUnverified, monitorState, STATE_ORDER, type ServerRow } from '../serverStatus';

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

function MonitorChecks({ monitor, stale }: { monitor: UptimeMonitor; stale: boolean }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 truncate type-caption text-text-secondary">{monitor.name}</p>
      {!monitor.recentChecks ? <p className="type-caption text-text-muted">체크 기록 확인 불가</p>
        : monitor.recentChecks.length === 0 ? <p className="type-caption text-text-muted">{monitor.isActive ? '첫 체크 대기' : '체크 기록 없음'}</p>
          : <RecentUptimeChecks metrics={monitor.recentChecks} paused={!monitor.isActive} stale={stale} />}
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
      <div className="space-y-intra sm:w-40 sm:shrink-0">
        <h2 id={headingId} className="type-section-title text-text-base">{label}</h2>
        <div><StatusLight tone={tone} label={known ? capabilityLabel(row, capability, tone) : '확인 불가'} /></div>
      </div>
      <div className="min-w-0 flex-1 space-y-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats(row, capability, known).map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="type-caption text-text-muted">{stat.label}</dt>
              <dd className={`mt-1 type-label tabular-nums ${stat.warn ? 'text-status-warn' : 'text-text-base'}`}>{stat.value}{stat.warn && <span className="sr-only">, 주의 기준 초과</span>}</dd>
            </div>
          ))}
        </dl>
        {monitors.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {monitors.map((monitor) => <MonitorChecks key={monitor.id} monitor={monitor} stale={!known} />)}
          </div>
        )}
      </div>
      <Link to={serverPath(row.server.id, capability)} className="inline-flex min-h-11 shrink-0 items-center type-label text-action link-underline sm:min-h-6">{label} 보기</Link>
    </section>
  );
}

export function ServerOverviewTab({ row, onOpen }: {
  row: ServerRow;
  onOpen: (capability: ServerCapability) => void;
}) {
  const navigate = useNavigate();
  // 대상 목록을 불러오지 못했거나 이전 목록인 기능은 지금 상태를 모른다. 경고가 아니므로 대기 톤으로, 연결된 기능들 다음에 둔다.
  const unknown = (key: ServerCapability) => capabilityUnverified(row, key);
  const connected = SERVER_CAPABILITIES
    .filter(({ key }) => row.capabilities[key] !== null || unknown(key))
    .map((item) => ({ ...item, known: !unknown(item.key), tone: row.capabilities[item.key] ?? 'idle' }))
    .sort((a, b) => Number(!a.known) - Number(!b.known) || STATE_ORDER[a.tone] - STATE_ORDER[b.tone]);
  const connectable = SERVER_CAPABILITIES.filter(({ key }) => row.capabilities[key] === null && !unknown(key));

  if (connected.length === 0) {
    return (
      <EmptyState icon="dns" headingLevel="h2" title="아직 연결한 기능이 없습니다" description="업타임 모니터는 설치 없이 바로 추가할 수 있습니다.">
        {/* 업타임 탭으로 옮기면서 추가 대화 상자를 연다. 같은 뜻의 버튼을 탭에서 한 번 더 누르지 않게. */}
        <Button onClick={() => navigate(serverPath(row.server.id, 'uptime'), { state: { [ADD_MONITOR_STATE]: true } })}>업타임 모니터 추가</Button>
        {/* 다른 기능의 선택지는 탭 줄의 "연결 전" 표시가 이미 보여 준다. */}
        <p className="mt-3 type-body text-text-muted">다른 기능은 각 탭에서 연결합니다.</p>
      </EmptyState>
    );
  }

  // 장애가 하나면 머리말의 원인 링크가 이미 같은 말을 한다. 둘 이상일 때만 배너로 모두 나열한다. 오래된 것부터.
  // 이전에 불러온 모니터의 장애를 지금의 장애처럼 나열하지 않는다.
  const incidents = (unknown('uptime') ? [] : row.targets.monitors)
    .filter((monitor) => monitor.activeIncident?.active)
    .sort((a, b) => (b.activeIncident?.durationSec ?? 0) - (a.activeIncident?.durationSec ?? 0));

  return (
    <div className="page-stack">
      {incidents.length > 1 && (
        <section aria-labelledby="server-incidents" className="flex items-start gap-3 rounded-xl border border-ui-border-soft bg-bg-surface px-4 py-3">
          <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-status-error-fill" />
          <div className="min-w-0">
            <h2 id="server-incidents" className="type-label text-text-base">진행 중 장애 {incidents.length}건</h2>
            <ul className="mt-1 flex flex-wrap gap-x-4">
              {incidents.map((monitor) => (
                <li key={monitor.id} className="min-w-0">
                  <Link to={serverPath(row.server.id, 'uptime', monitor.id)} className="inline-flex min-h-11 items-center gap-1.5 type-body text-action link-underline sm:min-h-6">
                    {monitor.name}<span className="type-caption text-text-muted">{formatDuration(monitor.activeIncident!.durationSec)} 경과</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <div className="section-stack">
        <section aria-label="연결된 기능" className="section-stack">
          {connected.map(({ key, label, tone, known }) => <CapabilityRow key={key} row={row} capability={key} label={label} tone={tone} known={known} />)}
        </section>
        {connectable.length > 0 && (
          <section aria-labelledby="server-connectable" className="space-y-2">
            <h2 id="server-connectable" className="type-section-title text-text-base">연결할 수 있는 기능</h2>
            <div className="-mx-2 flex flex-wrap gap-x-2">
              {connectable.map(({ key, label }) => <Button key={key} variant="text" className="px-2" onClick={() => onOpen(key)}>{label}</Button>)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
