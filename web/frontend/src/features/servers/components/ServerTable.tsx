import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ResourceTable, StatusLight, Tooltip } from '../../../components/common';
import { WARNING_PCT } from '../../infra/usage';
import { serverPath } from '../serverPaths';
import { STATE_LABEL, type ServerMetric, type ServerRow } from '../serverStatus';

const percent = (value: number, digits: number) => `${value.toFixed(digits)}%`;

/** 값이 없으면 0이 아니라 `-`이다. 왜 없는지는 마우스에는 툴팁, 화면 낭독기에는 숨긴 글자가 말한다. */
function Value({ row, metric, render }: { row: ServerRow; metric: ServerMetric; render: (value: number) => ReactNode }) {
  const value = row[metric];
  if (value === undefined) {
    const label = row.unavailable.includes(metric) ? '불러오지 못함' : '수집 안 함';
    // 칸마다 Tab 지점을 늘리지 않는다(focusable 없음). 이름 없는 span의 aria-label은 읽히지 않으므로 sr-only 글자로 둔다.
    return <><Tooltip content={label}><span aria-hidden="true" className="text-text-muted">-</span></Tooltip><span className="sr-only">{label}</span></>;
  }
  return render(value);
}

const usageClass = (value: number) => value >= WARNING_PCT ? 'text-status-warn' : 'text-text-base';
/** 기준을 넘은 수치는 색만으로 구분하지 않는다. 화면 낭독기에는 글자로 알린다. */
function OverWarning({ value }: { value: number }) {
  return value >= WARNING_PCT ? <span className="sr-only">, 주의 기준 초과</span> : null;
}

export function ServerTable({ rows, matches, groupName }: {
  rows: ServerRow[];
  /** 서버 이름이 아니라 소속 대상이 검색어와 일치한 경우, 일치한 대상의 이름 */
  matches: ReadonlyMap<string, string[]>;
  groupName: (projectId?: string) => string;
}) {
  const usage = (value: number) => <span className={usageClass(value)}>{percent(value, 1)}<OverWarning value={value} /></span>;
  const cpu = (row: ServerRow) => <Value row={row} metric="cpu" render={usage} />;
  const memory = (row: ServerRow) => <Value row={row} metric="memory" render={usage} />;
  const uptime = (row: ServerRow) => <Value row={row} metric="uptime" render={(value) => percent(value, 2)} />;
  const errorLogs = (row: ServerRow) => <Value row={row} metric="errorLogs" render={(value) => value.toLocaleString()} />;

  // 열은 뷰포트가 아니라 목록 폭에 맞춘다(DESIGN.md §4.5). 좁아지면 그룹, 수치 순서로 숨기고 이름 아래로 모은다.
  return <div className="@container">
    <ResourceTable rows={rows} rowKey={(row) => row.server.id} ariaLabel="서버 그리드" columns={[
      { key: 'server', label: '서버', render: (row) => {
        const matched = matches.get(row.server.id) ?? [];
        return <>
          <Tooltip content={row.server.name}><Link data-row-link to={serverPath(row.server.id)} className="block truncate font-medium text-action">{row.server.name}</Link></Tooltip>
          {matched.length > 0 && <p className="mt-1 truncate type-caption text-text-secondary">{matched.join(', ')}</p>}
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 type-caption text-text-muted @4xl:hidden">
            {row.cpu !== undefined && <span className="whitespace-nowrap @3xl:hidden">CPU <span className={`tabular-nums ${usageClass(row.cpu)}`}>{percent(row.cpu, 1)}<OverWarning value={row.cpu} /></span></span>}
            {row.memory !== undefined && <span className="whitespace-nowrap @3xl:hidden">메모리 <span className={`tabular-nums ${usageClass(row.memory)}`}>{percent(row.memory, 1)}<OverWarning value={row.memory} /></span></span>}
            {row.uptime !== undefined && <span className="whitespace-nowrap tabular-nums @3xl:hidden">업타임 {percent(row.uptime, 2)}</span>}
            {row.errorLogs !== undefined && <span className="whitespace-nowrap tabular-nums @3xl:hidden">오류 로그 {row.errorLogs.toLocaleString()}</span>}
            <span className="whitespace-nowrap">{groupName(row.server.projectId)}</span>
          </p>
        </>;
      } },
      { key: 'status', label: '상태', className: 'w-32 @3xl:w-40', render: (row) => <>
        <StatusLight tone={row.state} label={STATE_LABEL[row.state]} />
        {row.cause && <Tooltip content={row.cause.text}><p className="mt-1 truncate type-caption text-text-muted">{row.cause.text}</p></Tooltip>}
      </> },
      { key: 'cpu', label: 'CPU', className: 'hidden w-20 @3xl:table-cell', align: 'right', render: cpu },
      { key: 'memory', label: '메모리', className: 'hidden w-20 @3xl:table-cell', align: 'right', render: memory },
      { key: 'uptime', label: '업타임 24시간', className: 'hidden w-28 @3xl:table-cell', align: 'right', render: uptime },
      { key: 'errorLogs', label: '오류 로그 24시간', className: 'hidden w-32 @3xl:table-cell', align: 'right', render: errorLogs },
      { key: 'group', label: '그룹', className: 'hidden w-32 @4xl:table-cell', render: (row) => <span className="block truncate text-text-secondary">{groupName(row.server.projectId)}</span> },
    ]} />
  </div>;
}
