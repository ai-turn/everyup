import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon, ResourceTable, Tooltip } from '../../../components/common';
import { StatusShape } from '../../../components/common/StatusShape';
import type { ServiceHistoryPoint } from '../../../services/api';
import { CRITICAL_PCT, WARNING_PCT } from '../../infra/usage';
import { UptimeStrip } from '../../uptime/components/UptimeStrip';
import { combineBuckets } from '../../uptime/uptimeBuckets';
import { environmentState } from '../../services/environmentState';
import { SERVER_CAPABILITIES, serverPath, type ServerCapability } from '../serverPaths';
import { STATE_LABEL, type ServerMetric, type ServerRow } from '../serverStatus';

const percent = (value: number, digits: number) => `${value.toFixed(digits)}%`;

/** 수치를 내는 기능. 이 기능에 연결된 대상이 없으면 그 수치는 `연결 전`이다. */
const METRIC_SOURCE: Record<ServerMetric, ServerCapability> = {
  cpu: 'infrastructure', memory: 'infrastructure', disk: 'infrastructure', uptime: 'uptime', errorLogs: 'logs',
};

const STATE_TEXT = { error: 'text-crit-text', warn: 'text-attn-text', healthy: 'text-text-muted', idle: 'text-text-faint' } as const;

/** 기능이 아직 연결되지 않은 칸(G안 점선 상자). */
function NotConnected() {
  return <span className="inline-flex h-4.5 items-center whitespace-nowrap rounded-sm border border-dashed border-uptime-no-data px-1.5 type-caption text-text-faint">연결 전</span>;
}

/**
 * 값이 없는 까닭은 셋이다. 연결한 대상이 없으면 `연결 전`, 연결했지만 값이 아직 없으면 `-`, 조회에 실패했으면 표시를 둔다.
 * 마우스에는 툴팁, 화면 낭독기에는 숨긴 글자가 까닭을 말한다. 칸마다 Tab 지점을 늘리지 않는다(focusable 없음).
 */
function Value({ row, metric, render }: { row: ServerRow; metric: ServerMetric; render: (value: number) => ReactNode }) {
  const value = row[metric];
  if (value !== undefined) return render(value);
  if (row.unavailable.includes(metric)) {
    return <><Tooltip content="불러오지 못함"><span aria-hidden="true" className="inline-flex align-middle text-text-muted"><MaterialIcon name="sync_problem" size={16} /></span></Tooltip><span className="sr-only">불러오지 못함</span></>;
  }
  if (row.capabilities[METRIC_SOURCE[metric]] === null) return <NotConnected />;
  return <><Tooltip content="데이터 없음"><span aria-hidden="true" className="text-text-faint">-</span></Tooltip><span className="sr-only">데이터 없음</span></>;
}

const usageFill = (value: number) => value >= CRITICAL_PCT ? 'bg-crit' : value >= WARNING_PCT ? 'bg-attn' : 'bg-ok';
/** 기준을 넘은 수치는 색만으로 구분하지 않는다. 화면 낭독기에는 글자로 알린다. */
function OverWarning({ value }: { value: number }) {
  return value >= WARNING_PCT ? <span className="sr-only">, 주의 기준 초과</span> : null;
}

/** 수치 + 얇은 막대(G안, Beszel). 막대 색은 70%·85% 기준을 따른다. */
function Usage({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-lead">
      <span className={`w-12 shrink-0 tabular-nums ${value >= WARNING_PCT ? 'text-attn-text' : 'text-text'}`}>{percent(value, 1)}<OverWarning value={value} /></span>
      <span aria-hidden="true" className="relative h-1 min-w-0 max-w-21 flex-1 rounded-full bg-border-strong">
        <span className={`absolute inset-y-0 left-0 rounded-full ${usageFill(value)}`} style={{ width: `${Math.min(100, value)}%` }} />
      </span>
    </span>
  );
}

/** 이름 아래 줄: 연결 방식과 대상 수(G안 `Docker Collector · 컨테이너 6`, `직접 연결 · 업타임 모니터 2`). */
function connectionText(row: ServerRow): string {
  const { docker, containers, monitors, apps, infrastructure } = row.targets;
  if (docker) return environmentState(docker) !== 'install' ? `Docker Collector${containers.length ? ` · 컨테이너 ${containers.length}개` : ''}` : 'Docker Collector 설치 대기';
  const direct = apps.length > 0 || Boolean(infrastructure);
  const parts = [direct ? '직접 연결' : null, monitors.length ? `업타임 모니터 ${monitors.length}개` : null].filter(Boolean);
  return parts.join(' · ') || '연결한 대상 없음';
}

/** 수집 중인 기능(G안 마지막 열). 컨테이너가 먼저, 나머지는 기능 탭 순서다. */
function collectedText(row: ServerRow): string {
  const labels = [
    ...(row.containers !== null ? ['컨테이너'] : []),
    ...SERVER_CAPABILITIES.filter(({ key }) => row.capabilities[key] !== null).map(({ label }) => label),
  ];
  return labels.join(', ');
}

export function ServerTable({ rows, matches, buckets }: {
  rows: ServerRow[];
  /** 서버 이름이 아니라 소속 대상이 검색어와 일치한 경우, 일치한 대상의 이름 */
  matches: ReadonlyMap<string, string[]>;
  /** 모니터별 24시간 버킷(업타임 띠). 없으면 띠 없이 가용률만 보인다. */
  buckets: Record<string, ServiceHistoryPoint[]>;
}) {
  const usage = (metric: 'cpu' | 'memory' | 'disk') => (row: ServerRow) => <Value row={row} metric={metric} render={(value) => <Usage value={value} />} />;
  const uptime = (row: ServerRow) => {
    const series = row.targets.monitors.map((monitor) => buckets[monitor.id]).filter(Boolean);
    return <Value row={row} metric="uptime" render={(value) => (
      <span className="flex items-center gap-lead">
        {series.length > 0 && <UptimeStrip buckets={combineBuckets(series)} className="w-28" />}
        <span className="whitespace-nowrap tabular-nums type-caption text-text-muted">{percent(value, 2)}</span>
      </span>
    )} />;
  };
  const errorLogs = (row: ServerRow) => <Value row={row} metric="errorLogs" render={(value) => value.toLocaleString()} />;

  // 열은 뷰포트가 아니라 목록 폭에 맞춘다(DESIGN.md §4.5). 좁아지면 수치를 이름 아래 줄로 모은다.
  return <div className="@container">
    <ResourceTable rows={rows} rowKey={(row) => row.server.id} ariaLabel="서버 그리드" columns={[
      { key: 'server', label: '서버', className: '@3xl:w-56', render: (row) => {
        const matched = matches.get(row.server.id) ?? [];
        return <div className="flex min-w-0 items-center gap-lead">
          <StatusShape tone={row.state} />
          <div className="min-w-0">
            <Tooltip content={row.server.name}><Link data-row-link to={serverPath(row.server.id)} className="block truncate type-label text-text">{row.server.name}</Link></Tooltip>
            {matched.length > 0 && <p className="truncate type-caption text-text">{matched.join(', ')}</p>}
            <p className="flex min-h-lh flex-wrap gap-x-3 gap-y-1 type-caption text-text-faint">
              <span className="truncate">{connectionText(row)}</span>
              {row.cpu !== undefined && <span className="whitespace-nowrap @3xl:hidden">CPU <span className={`tabular-nums ${row.cpu >= WARNING_PCT ? 'text-attn-text' : 'text-text-muted'}`}>{percent(row.cpu, 1)}<OverWarning value={row.cpu} /></span></span>}
              {row.memory !== undefined && <span className="whitespace-nowrap @3xl:hidden">메모리 <span className={`tabular-nums ${row.memory >= WARNING_PCT ? 'text-attn-text' : 'text-text-muted'}`}>{percent(row.memory, 1)}<OverWarning value={row.memory} /></span></span>}
              {row.uptime !== undefined && <span className="whitespace-nowrap tabular-nums @5xl:hidden">업타임 {percent(row.uptime, 2)}</span>}
            </p>
          </div>
        </div>;
      } },
      // 상태 단어 아래 흐린 한 줄이 원인이다(장애·확인 필요·대기의 까닭). 정상은 원인이 없다.
      { key: 'status', label: '상태', className: 'w-28 @6xl:w-40', render: (row) => <>
        <span className={`type-label ${STATE_TEXT[row.state]}`}>{STATE_LABEL[row.state]}</span>
        {row.cause && <Tooltip content={row.cause.text}><p className="truncate type-caption text-text-faint">{row.cause.text}</p></Tooltip>}
      </> },
      { key: 'cpu', label: 'CPU', className: 'hidden w-32 @3xl:table-cell', render: usage('cpu') },
      { key: 'memory', label: '메모리', className: 'hidden w-32 @3xl:table-cell', render: usage('memory') },
      { key: 'disk', label: '디스크', className: 'hidden w-32 @4xl:table-cell', render: usage('disk') },
      { key: 'uptime', label: '업타임 · 24시간', className: 'hidden w-52 @5xl:table-cell', render: uptime },
      { key: 'errorLogs', label: '에러 로그', className: 'w-20', align: 'right', render: errorLogs },
      { key: 'collected', label: '수집', className: 'hidden @6xl:table-cell', render: (row) => <span className="block truncate type-caption text-text-faint">{collectedText(row) || '연결 전'}</span> },
    ]} />
  </div>;
}
