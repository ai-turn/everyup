import { Link } from 'react-router-dom';
import { Button, MaterialIcon, StatusLight, Tooltip } from '../../../components/common';
import type { UptimeMonitor } from '../../../services/api';
import { formatDuration } from '../../../utils/incidentFormat';
import { tableRowLinkHandlers } from '../../../utils/tableRowLink';
import { uptimeState } from '../uptimeState';
import { RecentUptimeChecks } from './RecentUptimeChecks';
import { UptimeMonitorStatusBadge } from './UptimeMonitorStatusBadge';
import { UptimeTargetCard } from './UptimeTargetCard';

interface Props {
  view: 'grid' | 'card';
  monitors: UptimeMonitor[];
  error: boolean;
  returnTo: string;
  loading: boolean;
  changingMonitor: string | null;
  onSetActive: (monitor: UptimeMonitor) => void;
  selected: ReadonlySet<string>;
  onSelect: (ids: string[], checked: boolean) => void;
}

const stateOrder = { down: 0, waiting: 1, up: 2, paused: 3 } as const;
const address = (monitor: UptimeMonitor) => monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url;
const uptimeText = (monitor: UptimeMonitor) => monitor.uptime === undefined ? '-' : `${monitor.uptime.toFixed(2)}%`;
const latencyText = (monitor: UptimeMonitor) => monitor.responseTime === undefined ? '-' : `${Math.round(monitor.responseTime).toLocaleString()}ms`;

function MonitorStatus({ monitor, error }: { monitor: UptimeMonitor; error: boolean }) {
  const incident = !error && monitor.isActive && monitor.status === 'unhealthy' && monitor.activeIncident?.active ? monitor.activeIncident : undefined;
  return (
    <div className="space-y-1">
      {error ? <StatusLight tone="warn" label="확인 불가" /> : <UptimeMonitorStatusBadge monitor={monitor} />}
      {incident && <Tooltip content={`장애 시작 ${new Date(incident.startedAt).toLocaleString()} · ${formatDuration(incident.durationSec)} 지속${incident.message ? ` · ${incident.message}` : ''}`} focusable>
        <p className="truncate type-caption tabular-nums text-status-error">{formatDuration(incident.durationSec)} 지속</p>
      </Tooltip>}
    </div>
  );
}

function CheckHistory({ monitor, error }: { monitor: UptimeMonitor; error: boolean }) {
  if (!monitor.recentChecks) return <p className="type-caption text-text-muted">체크 기록 확인 불가</p>;
  if (monitor.recentChecks.length === 0) return <p className="type-caption text-text-muted">{monitor.isActive ? '첫 체크 대기' : '체크 기록 없음'}</p>;
  return <RecentUptimeChecks metrics={monitor.recentChecks} paused={!monitor.isActive} stale={error} />;
}

function CheckMethod({ monitor }: { monitor: UptimeMonitor }) {
  return <Tooltip content={monitor.type === 'http' ? `HTTP · 기대 상태 코드 ${monitor.expectedStatus}` : 'TCP 연결 확인'} focusable>
    <span className="type-caption text-text-muted">{monitor.type.toUpperCase()}</span>
  </Tooltip>;
}

export function UptimeTargets(props: Props) {
  const { view, error, returnTo } = props;
  const targets = [...props.monitors].sort((a, b) => stateOrder[uptimeState(a)] - stateOrder[uptimeState(b)]);
  const action = (monitor: UptimeMonitor) => (
    <Button size="sm" variant={monitor.isActive ? 'quiet' : 'ghost'} className="min-h-11 min-w-11 px-2"
      loading={props.changingMonitor === monitor.id}
      disabled={props.loading || error || props.changingMonitor !== null}
      aria-label={`${monitor.name} ${monitor.isActive ? '일시정지' : '재개'}`}
      onClick={() => props.onSetActive(monitor)}>
      <MaterialIcon name={monitor.isActive ? 'pause' : 'play_arrow'} size={20} />
      <span className="hidden @5xl:inline">{monitor.isActive ? '일시정지' : '재개'}</span>
    </Button>
  );

  if (view === 'card') {
    return <div className="@container"><div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
      {targets.map((monitor) => <UptimeTargetCard key={monitor.id} to={`/uptime/${monitor.id}`} returnTo={returnTo}
        title={monitor.name} status={<MonitorStatus monitor={monitor} error={error} />} endpoint={address(monitor)}
        meta={<div className="relative w-full space-y-4">
          <dl className="grid grid-cols-2 gap-3 type-caption text-text-muted">
            <div><dt>24h 업타임</dt><dd className="mt-1 tabular-nums text-text-base">{uptimeText(monitor)}</dd></div>
            <div><dt>평균 응답</dt><dd className="mt-1 tabular-nums text-text-base">{latencyText(monitor)}</dd></div>
            <div><dt>체크 방식</dt><dd className="mt-1"><CheckMethod monitor={monitor} /></dd></div>
            <div><dt>수집 간격</dt><dd className="mt-1 tabular-nums text-text-base">{monitor.interval}초</dd></div>
          </dl>
          <div className="space-y-2 border-t border-ui-border-soft pt-3">
            <p className="type-caption text-text-muted">최근 체크{monitor.recentChecks?.length ? ` ${Math.min(monitor.recentChecks.length, 10)}회` : ''}</p>
            <CheckHistory monitor={monitor} error={error} />
          </div>
        </div>}
        actions={<div className="flex items-center gap-3">
          <label className="-m-3 inline-flex cursor-pointer items-center justify-center p-3 sm:-m-2 sm:p-2">
            <input type="checkbox" aria-label={`${monitor.name} 선택`} checked={props.selected.has(monitor.id)}
              onChange={(event) => props.onSelect([monitor.id], event.target.checked)} className="h-4 w-4 cursor-pointer accent-primary" />
          </label>
          {action(monitor)}
        </div>} />)}
    </div></div>;
  }

  return <div className="@container overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
    <table aria-label="업타임 그리드" className="w-full table-fixed text-left text-sm">
      <caption className="sr-only">장애 우선 목록입니다. 최근 체크 결과와 장애 지속 시간을 목록에서 확인하고, 이름을 눌러 상세로 이동합니다.</caption>
      <thead className="border-b border-ui-border bg-ui-table-header text-xs text-text-muted"><tr>
        <th scope="col" className="w-24 px-3 py-3 font-medium @3xl:w-28">상태</th>
        <th scope="col" className="px-3 py-3 font-medium">대상 · 체크 주소</th>
        <th scope="col" className="hidden w-16 px-3 py-3 font-medium @3xl:table-cell">방식</th>
        <th scope="col" className="hidden w-20 px-3 py-3 text-right font-medium @3xl:table-cell">수집 간격</th>
        <th scope="col" className="hidden w-24 px-3 py-3 text-right font-medium @xl:table-cell">24h 업타임</th>
        <th scope="col" className="hidden w-24 px-3 py-3 text-right font-medium @3xl:table-cell">평균 응답</th>
        <th scope="col" className="hidden w-52 px-3 py-3 font-medium @3xl:table-cell @5xl:w-56">최근 체크</th>
        <th scope="col" className="w-14 px-1 py-3 font-medium @5xl:w-28"><span className="sr-only">모니터 상태 변경</span></th>
      </tr></thead>
      <tbody className="divide-y divide-ui-border-soft">{targets.map((monitor) => (
        <tr key={monitor.id} {...tableRowLinkHandlers} className="table-row-link align-middle transition-colors hover:bg-ui-hover-soft">
          <td className="px-3 py-3"><MonitorStatus monitor={monitor} error={error} /></td>
          <td className="min-w-0 px-3 py-3">
            <Tooltip content={monitor.name}><Link data-row-link to={`/uptime/${monitor.id}`} state={{ returnTo }} className="block truncate font-medium text-action">{monitor.name}</Link></Tooltip>
            <Tooltip content={address(monitor)} focusable><p className="mt-1 truncate font-mono text-xs text-text-muted">{address(monitor)}</p></Tooltip>
            <div className="mt-2 space-y-2 @3xl:hidden">
              <p className="flex flex-wrap gap-x-3 gap-y-1 type-caption text-text-muted">
                <span className="whitespace-nowrap">{monitor.type.toUpperCase()} · {monitor.interval}초</span>
                <span className="whitespace-nowrap @xl:hidden">업타임 {uptimeText(monitor)}</span>
                <span className="whitespace-nowrap">응답 {latencyText(monitor)}</span>
              </p>
              <CheckHistory monitor={monitor} error={error} />
            </div>
          </td>
          <td className="hidden px-3 py-3 @3xl:table-cell"><CheckMethod monitor={monitor} /></td>
          <td className="hidden px-3 py-3 text-right tabular-nums text-text-muted @3xl:table-cell">{monitor.interval}초</td>
          <td className="hidden px-3 py-3 text-right tabular-nums text-text-base @xl:table-cell">{uptimeText(monitor)}</td>
          <td className="hidden whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-base @3xl:table-cell">{latencyText(monitor)}</td>
          <td className="hidden px-3 py-3 @3xl:table-cell"><CheckHistory monitor={monitor} error={error} /></td>
          <td className="px-1 py-3 text-right">{action(monitor)}</td>
        </tr>
      ))}</tbody>
    </table>
  </div>;
}
