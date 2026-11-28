import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon, ResourceTable, StatusLight, Tooltip } from '../../../components/common';
import { WARNING_PCT } from '../../infra/usage';
import { serverPath } from '../serverPaths';
import type { ServerCapability } from '../serverPaths';
import { STATE_LABEL, type ServerMetric, type ServerRow } from '../serverStatus';

const percent = (value: number, digits: number) => `${value.toFixed(digits)}%`;

/** 수치를 내는 기능. 이 기능에 연결된 대상이 없으면 그 수치는 해당 없음이다. */
const METRIC_SOURCE: Record<ServerMetric, ServerCapability> = {
  cpu: 'infrastructure', memory: 'infrastructure', disk: 'infrastructure', uptime: 'uptime', errorLogs: 'logs',
};

/**
 * 값이 없는 까닭은 셋이다. 연결한 대상이 없으면 빈 칸, 연결했지만 값이 아직 없으면 `-`, 조회에 실패했으면 표시를 둔다.
 * 마우스에는 툴팁, 화면 낭독기에는 숨긴 글자가 까닭을 말한다. 칸마다 Tab 지점을 늘리지 않는다(focusable 없음).
 */
function Value({ row, metric, render }: { row: ServerRow; metric: ServerMetric; render: (value: number) => ReactNode }) {
  const value = row[metric];
  if (value !== undefined) return render(value);
  if (row.unavailable.includes(metric)) {
    return <><Tooltip content="불러오지 못함"><span aria-hidden="true" className="inline-flex align-middle text-text-muted"><MaterialIcon name="sync_problem" size={16} /></span></Tooltip><span className="sr-only">불러오지 못함</span></>;
  }
  if (row.capabilities[METRIC_SOURCE[metric]] === null) return <span className="sr-only">수집 안 함</span>;
  return <><Tooltip content="데이터 없음"><span aria-hidden="true" className="text-text-muted">-</span></Tooltip><span className="sr-only">데이터 없음</span></>;
}

const usageClass = (value: number) => value >= WARNING_PCT ? 'text-attn-text' : 'text-text';
/** 기준을 넘은 수치는 색만으로 구분하지 않는다. 화면 낭독기에는 글자로 알린다. */
function OverWarning({ value }: { value: number }) {
  return value >= WARNING_PCT ? <span className="sr-only">, 주의 기준 초과</span> : null;
}

export function ServerTable({ rows, matches }: {
  rows: ServerRow[];
  /** 서버 이름이 아니라 소속 대상이 검색어와 일치한 경우, 일치한 대상의 이름 */
  matches: ReadonlyMap<string, string[]>;
}) {
  const usage = (value: number) => <span className={usageClass(value)}>{percent(value, 1)}<OverWarning value={value} /></span>;
  const cpu = (row: ServerRow) => <Value row={row} metric="cpu" render={usage} />;
  const memory = (row: ServerRow) => <Value row={row} metric="memory" render={usage} />;
  const uptime = (row: ServerRow) => <Value row={row} metric="uptime" render={(value) => percent(value, 2)} />;
  const errorLogs = (row: ServerRow) => <Value row={row} metric="errorLogs" render={(value) => value.toLocaleString()} />;

  // 열은 뷰포트가 아니라 목록 폭에 맞춘다(DESIGN.md §4.5). 이름 열은 폭을 정하고 남는 폭은 상태 열이 받아 원인이 한 줄에 든다.
  // 행은 두 줄이다: 이름 아래 연결 방식, 상태 아래 원인. 좁아지면 수치를 이름 아래 줄로 모은다.
  return <div className="@container">
    <ResourceTable rows={rows} rowKey={(row) => row.server.id} ariaLabel="서버 그리드" alertRow={(row) => row.state === 'error'} columns={[
      { key: 'server', label: '서버', className: '@3xl:w-64 @5xl:w-72', render: (row) => {
        const matched = matches.get(row.server.id) ?? [];
        return <>
          <Tooltip content={row.server.name}><Link data-row-link to={serverPath(row.server.id)} className="block truncate font-medium text-text">{row.server.name}</Link></Tooltip>
          {matched.length > 0 && <p className="mt-1 truncate type-caption text-text">{matched.join(', ')}</p>}
          <p className="mt-1 flex min-h-lh flex-wrap gap-x-3 gap-y-1 type-caption text-text-muted">
            {row.cpu !== undefined && <span className="whitespace-nowrap @3xl:hidden">CPU <span className={`tabular-nums ${usageClass(row.cpu)}`}>{percent(row.cpu, 1)}<OverWarning value={row.cpu} /></span></span>}
            {row.memory !== undefined && <span className="whitespace-nowrap @3xl:hidden">메모리 <span className={`tabular-nums ${usageClass(row.memory)}`}>{percent(row.memory, 1)}<OverWarning value={row.memory} /></span></span>}
            {row.uptime !== undefined && <span className="whitespace-nowrap tabular-nums @3xl:hidden">업타임 {percent(row.uptime, 2)}</span>}
            {row.errorLogs !== undefined && <span className="whitespace-nowrap tabular-nums @3xl:hidden">오류 로그 {row.errorLogs.toLocaleString()}</span>}
            {/* 연결 방식은 분류 축이라 칩이 아니라 글자다(DESIGN.md §9.13). 직접 연결은 대상으로 드러나므로 Docker만 적는다. */}
            {row.targets.docker && <span className="whitespace-nowrap">Docker Collector{row.targets.containers.length > 0 ? ` · 컨테이너 ${row.targets.containers.length}개` : ''}</span>}
          </p>
        </>;
      } },
      { key: 'status', label: '상태', className: 'w-36 @3xl:w-auto', render: (row) => <>
        <StatusLight tone={row.state} label={STATE_LABEL[row.state]} />
        {row.cause && <Tooltip content={row.cause.text}><p className="mt-1 truncate type-caption text-text-muted">{row.cause.text}</p></Tooltip>}
      </> },
      { key: 'cpu', label: 'CPU', className: 'hidden w-20 @3xl:table-cell', align: 'right', render: cpu },
      { key: 'memory', label: '메모리', className: 'hidden w-20 @3xl:table-cell', align: 'right', render: memory },
      { key: 'uptime', label: '업타임 24시간', className: 'hidden w-28 @3xl:table-cell', align: 'right', render: uptime },
      { key: 'errorLogs', label: '오류 로그 24시간', className: 'hidden w-32 @3xl:table-cell', align: 'right', render: errorLogs },
    ]} />
  </div>;
}
