import { Link, useLocation } from 'react-router-dom';
import { Button, DetailMeta, MaterialIcon, PageHeader, StatusLight, Tooltip } from '../../../components/common';
import { SERVERS_PATH } from '../serverPaths';
import { STATE_LABEL, type ServerRow } from '../serverStatus';

export function ServerHeader({ row, groupName, onRefresh, refreshing, onSettings }: {
  row: ServerRow;
  /** 그룹 목록을 불러오지 못했으면 undefined. 그룹 항목을 숨긴다. */
  groupName?: string;
  onRefresh: () => void;
  refreshing: boolean;
  onSettings: () => void;
}) {
  const { pathname } = useLocation();
  const cause = row.cause;
  // 원인 대상을 이미 보고 있으면 같은 화면으로 가는 링크를 두지 않는다.
  const causeLink = cause?.to && cause.to !== pathname ? cause.to : undefined;
  return (
    <header>
      {/* 데스크톱은 AppHeader 크럼이 이 역할을 한다 (DESIGN.md §3.4) */}
      <Link to={SERVERS_PATH} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-action lg:hidden">
        <MaterialIcon size={20} name="arrow_back" />서버 목록
      </Link>
      {/* 조작은 제목 줄 오른쪽이다(DESIGN.md "서비스 상세 헤더 예외"와 같은 배치). 버튼만 있는 줄이 탭과 본문을 밀어냈다. */}
      <PageHeader
        title={row.server.name}
        aside={
          <div role="group" aria-label="서버 조작" className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button collapseLabel variant="secondary" loading={refreshing} onClick={onRefresh}><MaterialIcon name="refresh" />새로고침</Button>
            <Button collapseLabel variant="secondary" onClick={onSettings}><MaterialIcon name="settings" />서버 설정</Button>
          </div>
        }
        meta={<>
          {row.server.description && (
            <Tooltip content={row.server.description}><p className="mb-2 truncate type-body text-text-muted">{row.server.description}</p></Tooltip>
          )}
          <DetailMeta
            status={<>
              <StatusLight tone={row.state} label={STATE_LABEL[row.state]} pulse={row.state === 'error'} />
              {cause && (causeLink
                ? <Link to={causeLink} className="inline-flex min-h-11 items-center text-action link-underline sm:min-h-6">{cause.text}</Link>
                // 링크와 같은 높이: 원인 대상을 보는 중이라 글자로 바뀌어도 탭 줄이 움직이지 않는다.
                : <span className="inline-flex min-h-11 items-center type-caption text-text-muted sm:min-h-6">{cause.text}</span>)}
              {groupName !== undefined && <span>그룹 <span className="text-text-secondary">{groupName}</span></span>}
            </>}
          />
        </>}
      />
    </header>
  );
}
