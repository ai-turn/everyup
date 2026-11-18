import { Link, useLocation } from 'react-router-dom';
import { Button, DetailMeta, MaterialIcon, PageHeader, StatusLight, Tooltip } from '../../../components/common';
import { SERVER_CAPABILITIES, SERVERS_PATH, serverPath } from '../serverPaths';
import { capabilityTargets, STATE_LABEL, type ServerRow } from '../serverStatus';

/**
 * 원인 대상을 이미 보고 있는가. 대상이 하나뿐인 탭(모니터 하나, 앱 하나, 인프라)은 주소에 대상 ID가 없으므로,
 * 지금 탭이 원인의 탭이고 그 탭의 대상이 하나뿐이면 같은 화면이다.
 */
function showingCause(row: ServerRow, to: string, pathname: string) {
  if (to === pathname) return true;
  return SERVER_CAPABILITIES.some(({ key }) => {
    const tab = serverPath(row.server.id, key);
    return pathname === tab && to.startsWith(`${tab}/`) && capabilityTargets(row.targets, key).length === 1;
  });
}

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
  const causeLink = cause?.to && !showingCause(row, cause.to, pathname) ? cause.to : undefined;
  return (
    <header>
      {/* 데스크톱은 AppHeader 크럼이 이 역할을 한다 (DESIGN.md §3.4) */}
      <Link to={SERVERS_PATH} className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-action lg:hidden">
        <MaterialIcon size={20} name="arrow_back" />서버 목록
      </Link>
      {/* 조작은 모든 폭에서 서버 이름과 같은 줄의 오른쪽이다. 이름이 길면 이름이 말줄임되고 버튼은 줄지 않는다.
          버튼만 있는 줄이 탭과 본문을 밀어냈다(모바일에서는 상태 줄 아래 한 줄을 따로 썼다). */}
      <PageHeader
        title={row.server.name}
        compactActions
        truncateTitle
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
      >
        <Button collapseLabel variant="secondary" loading={refreshing} onClick={onRefresh}><MaterialIcon name="refresh" />새로고침</Button>
        <Button collapseLabel variant="secondary" onClick={onSettings}><MaterialIcon name="settings" />서버 설정</Button>
      </PageHeader>
    </header>
  );
}
