import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ResourceTable, StatusLight, Tooltip } from '../../../components/common';
import { WARNING_PCT } from '../../infra/usage';
import { serverPath } from '../serverPaths';
import { STATE_LABEL, type ServerRow } from '../serverStatus';

const percent = (value: number, digits: number) => `${value.toFixed(digits)}%`;

/** 값이 없으면 0이 아니라 `-`이다. 왜 없는지는 툴팁과 접근 가능한 이름이 말한다. */
function Value({ value, unavailable, render }: { value?: number; unavailable: boolean; render: (value: number) => ReactNode }) {
  if (value === undefined) {
    const label = unavailable ? '불러오지 못함' : '수집 안 함';
    // 칸마다 Tab 지점을 늘리지 않는다(focusable 없음). 키보드·스크린리더는 접근 가능한 이름으로 읽는다.
    return <Tooltip content={label}><span aria-label={label} className="text-text-muted">-</span></Tooltip>;
  }
  return render(value);
}

const usageClass = (value: number) => value >= WARNING_PCT ? 'text-status-warn' : 'text-text-base';

export function ServerTable({ rows, matches, failed, groupName }: {
  rows: ServerRow[];
  /** 서버 이름이 아니라 소속 대상이 검색어와 일치한 경우, 일치한 대상의 이름 */
  matches: ReadonlyMap<string, string[]>;
  /** useServers의 failed. 실패한 종류의 칸은 수집 안 함이 아니라 불러오지 못함이다. */
  failed: readonly string[];
  groupName: (projectId?: string) => string;
}) {
  const infraFailed = failed.includes('인프라');
  const uptimeFailed = failed.includes('업타임');
  const logsFailed = failed.includes('앱') || failed.includes('로그 요약');
  const usage = (value: number) => <span className={usageClass(value)}>{percent(value, 1)}</span>;
  const cpu = (row: ServerRow) => <Value value={row.cpu} unavailable={infraFailed} render={usage} />;
  const memory = (row: ServerRow) => <Value value={row.memory} unavailable={infraFailed} render={usage} />;
  const uptime = (row: ServerRow) => <Value value={row.uptime} unavailable={uptimeFailed} render={(value) => percent(value, 2)} />;
  const errorLogs = (row: ServerRow) => <Value value={row.errorLogs} unavailable={logsFailed} render={(value) => value.toLocaleString()} />;

  // 열은 뷰포트가 아니라 목록 폭에 맞춘다(DESIGN.md §4.5). 좁아지면 그룹, 수치 순서로 숨기고 이름 아래로 모은다.
  return <div className="@container">
    <ResourceTable rows={rows} rowKey={(row) => row.server.id} ariaLabel="서버 그리드" columns={[
      { key: 'server', label: '서버', render: (row) => {
        const matched = matches.get(row.server.id) ?? [];
        return <>
          <Tooltip content={row.server.name}><Link data-row-link to={serverPath(row.server.id)} className="block truncate font-medium text-action">{row.server.name}</Link></Tooltip>
          {matched.length > 0 && <p className="mt-1 truncate type-caption text-text-secondary">{matched.join(', ')}</p>}
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 type-caption text-text-muted @4xl:hidden">
            {row.cpu !== undefined && <span className="whitespace-nowrap @3xl:hidden">CPU <span className={`tabular-nums ${usageClass(row.cpu)}`}>{percent(row.cpu, 1)}</span></span>}
            {row.memory !== undefined && <span className="whitespace-nowrap @3xl:hidden">메모리 <span className={`tabular-nums ${usageClass(row.memory)}`}>{percent(row.memory, 1)}</span></span>}
            {row.uptime !== undefined && <span className="whitespace-nowrap tabular-nums @3xl:hidden">업타임 {percent(row.uptime, 2)}</span>}
            {row.errorLogs !== undefined && <span className="whitespace-nowrap tabular-nums @3xl:hidden">오류 로그 {row.errorLogs.toLocaleString()}</span>}
            <span className="whitespace-nowrap">{groupName(row.server.projectId)}</span>
          </p>
        </>;
      } },
      { key: 'status', label: '상태', className: 'w-32 @3xl:w-40', render: (row) => <>
        <StatusLight tone={row.state} label={STATE_LABEL[row.state]} />
        {row.cause && <p className="mt-1 break-words type-caption text-text-muted">{row.cause.text}</p>}
      </> },
      { key: 'cpu', label: 'CPU', className: 'hidden w-20 @3xl:table-cell', align: 'right', render: cpu },
      { key: 'memory', label: '메모리', className: 'hidden w-20 @3xl:table-cell', align: 'right', render: memory },
      { key: 'uptime', label: '업타임 24시간', className: 'hidden w-28 @3xl:table-cell', align: 'right', render: uptime },
      { key: 'errorLogs', label: '오류 로그 24시간', className: 'hidden w-32 @3xl:table-cell', align: 'right', render: errorLogs },
      { key: 'group', label: '그룹', className: 'hidden w-32 @4xl:table-cell', render: (row) => <span className="block truncate text-text-secondary">{groupName(row.server.projectId)}</span> },
    ]} />
  </div>;
}
