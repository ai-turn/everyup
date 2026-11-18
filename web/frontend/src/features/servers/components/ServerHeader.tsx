import { Link } from 'react-router-dom';
import { Button, DetailActionToolbar, DetailMeta, MaterialIcon, PageHeader, StatusLight, Tooltip } from '../../../components/common';
import { SERVERS_PATH } from '../serverPaths';
import { STATE_LABEL, type ServerRow } from '../serverStatus';

export function ServerHeader({ row, groupName, onRefresh, refreshing, onSettings }: {
  row: ServerRow;
  /** 그룹 목록을 불러오지 못했으면 undefined. 그룹 칸을 숨긴다. */
  groupName?: string;
  onRefresh: () => void;
  refreshing: boolean;
  onSettings: () => void;
}) {
  return (
    <header>
      {/* 데스크톱은 AppHeader 크럼이 이 역할을 한다 (DESIGN.md §3.4) */}
      <Link to={SERVERS_PATH} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-action lg:hidden">
        <MaterialIcon size={20} name="arrow_back" />서버 목록
      </Link>
      <PageHeader
        title={row.server.name}
        meta={<>
          {row.server.description && (
            <Tooltip content={row.server.description}><p className="mb-2 truncate type-body text-text-muted">{row.server.description}</p></Tooltip>
          )}
          <DetailMeta
            status={<>
              <StatusLight tone={row.state} label={STATE_LABEL[row.state]} pulse={row.state === 'error'} />
              {row.cause && (row.cause.to
                ? <Link to={row.cause.to} className="inline-flex min-h-11 items-center text-action link-underline sm:min-h-6">{row.cause.text}</Link>
                : <span className="type-caption text-text-muted">{row.cause.text}</span>)}
            </>}
            fields={groupName === undefined ? [] : [{ label: '그룹', value: groupName }]}
          />
        </>}
      />
      <DetailActionToolbar
        controls={<Button collapseLabel variant="secondary" loading={refreshing} onClick={onRefresh}><MaterialIcon name="refresh" />새로고침</Button>}
        actions={<Button collapseLabel variant="secondary" onClick={onSettings}><MaterialIcon name="settings" />서버 설정</Button>}
      />
    </header>
  );
}
