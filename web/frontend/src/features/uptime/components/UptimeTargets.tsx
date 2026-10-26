import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, MaterialIcon, StatusLight } from '../../../components/common';
import { Sparkline } from '../../../components/charts';
import type { UptimeMonitor } from '../../../services/api';
import { formatIncidentTime } from '../../../utils/incidentFormat';
import { UptimeMonitorStatusBadge } from './UptimeMonitorStatusBadge';
import { UptimeTargetCard } from './UptimeTargetCard';
import { tableRowLinkHandlers } from '../../../utils/tableRowLink';

interface Props {
  view: 'grid' | 'card';
  monitors: UptimeMonitor[];
  /** 목록을 새로 불러오지 못했다 — 보이는 상태는 이전 것이다. */
  error: boolean;
  returnTo: string;
  loading: boolean;
  changingMonitor: string | null;
  onSetActive: (monitor: UptimeMonitor) => void;
}

interface Target {
  key: string;
  name: string;
  to: string;
  endpoint: string;
  /** `HTTP · 30초` — 대상 이름 아래 한 줄. */
  method: string;
  lastCheck?: string;
  priority: number;
  status: ReactNode;
  monitor: UptimeMonitor;
}

const stateOrder = { down: 0, stale: 1, waiting: 2, up: 3, paused: 4 } as const;

// 일시정지했거나 24시간 안에 체크가 없으면 서버가 값을 보내지 않는다.
const uptimeText = (monitor: UptimeMonitor) => monitor.uptime === undefined ? '—' : `${monitor.uptime.toFixed(2)}%`;
const latencyText = (monitor: UptimeMonitor) => monitor.responseTime === undefined ? '—' : `${monitor.responseTime.toLocaleString()}ms`;

function LatencyTrend({ monitor }: { monitor: UptimeMonitor }) {
  const history = monitor.latencyHistory ?? [];
  return (
    <div className="flex min-h-8 items-center gap-3">
      <span className="w-16 shrink-0 text-right tabular-nums text-text-base">{latencyText(monitor)}</span>
      {history.length > 1 && <div className="min-w-0 flex-1"><Sparkline values={history} /></div>}
    </div>
  );
}

export function UptimeTargets(props: Props) {
  const { view, error, returnTo } = props;
  const targets: Target[] = props.monitors.map((monitor): Target => ({
    key: monitor.id, name: monitor.name, to: `/uptime/${monitor.id}`,
    endpoint: monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url,
    method: `${monitor.type.toUpperCase()} · ${monitor.interval}초`, lastCheck: monitor.lastCheckAt, monitor,
    priority: error ? 1 : !monitor.isActive ? stateOrder.paused : monitor.status === 'unhealthy' ? stateOrder.down : monitor.status === 'healthy' ? stateOrder.up : stateOrder.waiting,
    status: error ? <StatusLight tone="warn" label="확인 불가" /> : <UptimeMonitorStatusBadge monitor={monitor} />,
  }));
  targets.sort((a, b) => a.priority - b.priority);

  const action = (target: Target) => {
    const monitor = target.monitor;
    return (
      <Button size="sm" variant="ghost" className="min-h-11 min-w-11 px-2 sm:min-w-24"
        loading={props.changingMonitor === monitor.id}
        disabled={props.loading || error || props.changingMonitor !== null}
        aria-label={`${target.name} ${monitor.isActive ? '일시정지' : '재개'}`}
        onClick={() => props.onSetActive(monitor)}>
        <MaterialIcon name={monitor.isActive ? 'pause' : 'play_arrow'} size={20} />
        <span className="hidden sm:inline">{monitor.isActive ? '일시정지' : '재개'}</span>
      </Button>
    );
  };

  if (view === 'card') {
    return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {targets.map((target) => <UptimeTargetCard key={target.key} to={target.to} returnTo={returnTo}
        title={target.name}
        subtitle={target.method} status={target.status} endpoint={target.endpoint}
        meta={<div className="w-full space-y-2">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 type-caption text-text-muted">
            <dt>24h 업타임</dt><dd className="tabular-nums text-text-base">{uptimeText(target.monitor)}</dd>
            <dt>평균 응답</dt><dd><LatencyTrend monitor={target.monitor} /></dd>
          </dl>
          <p className="type-caption text-text-muted">마지막 확인 {target.lastCheck ? formatIncidentTime(target.lastCheck) : '아직 없음'}</p>
        </div>}
        actions={action(target)} />)}
    </div>;
  }

  return <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
    <table aria-label="업타임 그리드" className="w-full table-fixed text-left text-sm">
      <caption className="sr-only">장애와 확인이 필요한 대상을 먼저 표시합니다. 좁은 화면에서는 숨긴 열(주소, 업타임·응답, 최근 확인)을 대상 열에 함께 표시합니다.</caption>
      <thead className="border-b border-ui-border bg-ui-table-header text-xs text-text-muted"><tr>
        <th scope="col" className="w-24 px-3 py-3 font-medium sm:w-28 sm:px-4">상태</th>
        <th scope="col" className="px-3 py-3 font-medium sm:px-4 md:w-48 xl:w-56">대상</th>
        <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">체크 주소</th>
        <th scope="col" className="hidden w-24 px-4 py-3 text-right font-medium md:table-cell">24h 업타임</th>
        <th scope="col" className="hidden w-44 px-4 py-3 font-medium xl:table-cell">평균 응답 · 추이</th>
        <th scope="col" className="hidden w-36 px-4 py-3 text-right font-medium 2xl:table-cell">마지막 확인</th>
        <th scope="col" className="w-14 px-1 py-3 font-medium sm:w-28 sm:px-3"><span className="sr-only">모니터 상태 변경</span></th>
      </tr></thead>
      <tbody className="divide-y divide-ui-border-soft">{targets.map((target) => <tr key={target.key} {...tableRowLinkHandlers} className="table-row-link align-top transition-colors hover:bg-ui-hover-soft">
        <td className="px-3 py-4 sm:px-4">{target.status}</td>
        <td className="min-w-0 px-3 py-4 sm:px-4">
          <Link data-row-link to={target.to} state={{ returnTo }} className="block truncate font-medium text-action" title={target.name}>{target.name}</Link>
          <p className="mt-1 truncate type-caption text-text-muted">{target.method}</p>
          <p className="mt-2 truncate font-mono text-xs text-text-dim md:hidden" title={target.endpoint}>{target.endpoint}</p>
          <p className="mt-1 type-caption tabular-nums text-text-muted xl:hidden"><span className="md:hidden">업타임 {uptimeText(target.monitor)} · </span>응답 {latencyText(target.monitor)}</p>
          <p className="mt-1 type-caption text-text-muted 2xl:hidden">{target.lastCheck ? `${formatIncidentTime(target.lastCheck)} 확인` : '확인 기록 없음'}</p>
        </td>
        <td className="hidden px-4 py-4 md:table-cell"><p className="truncate font-mono text-xs text-text-dim" title={target.endpoint}>{target.endpoint}</p></td>
        <td className="hidden px-4 py-4 text-right tabular-nums text-text-base md:table-cell">{uptimeText(target.monitor)}</td>
        <td className="hidden px-4 py-2.5 xl:table-cell"><LatencyTrend monitor={target.monitor} /></td>
        <td className="hidden px-4 py-4 text-right tabular-nums text-text-muted 2xl:table-cell">{target.lastCheck ? formatIncidentTime(target.lastCheck) : '아직 없음'}</td>
        <td className="px-1 py-2 sm:px-3">{action(target)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
