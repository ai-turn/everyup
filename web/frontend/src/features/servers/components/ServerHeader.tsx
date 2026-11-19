import { Link, useLocation } from 'react-router-dom';
import { DetailMeta, IconButton, MaterialIcon, PageHeader, StatusLight, Tooltip } from '../../../components/common';
import { SERVERS_PATH, serverPath, type ServerCapability } from '../serverPaths';
import { UptimeRefreshControls } from '../../uptime/components/UptimeRefreshControls';
import { capabilityTargets, STATE_LABEL, type ServerRow } from '../serverStatus';

// 대상이 하나면 탭의 첫 화면이 곧 그 대상의 상세인 탭. 로그 탭의 첫 화면은 앱이 하나여도 서버 범위의 요약이라 빠진다.
// 인프라는 원인 주소가 탭 주소와 같아서 주소 비교로 처리된다.
const SINGLE_TARGET_TABS: readonly ServerCapability[] = ['uptime', 'api', 'metrics'];

/**
 * 원인 대상을 이미 보고 있는가. 대상이 하나뿐인 탭은 주소에 대상 ID가 없으므로,
 * 지금 탭이 원인의 탭이고 그 탭의 대상이 하나뿐이면 같은 화면이다.
 */
function showingCause(row: ServerRow, to: string, pathname: string) {
  if (to === pathname) return true;
  return SINGLE_TARGET_TABS.some((key) => {
    const tab = serverPath(row.server.id, key);
    return pathname === tab && to.startsWith(`${tab}/`) && capabilityTargets(row.targets, key).length === 1;
  });
}

export function ServerHeader({ row, groupName, onRefresh, refreshing, onSettings, updatedAt, autoRefresh, onAutoRefreshChange }: {
  row: ServerRow;
  /** 그룹 목록을 불러오지 못했으면 undefined. 그룹 항목을 숨긴다. */
  groupName?: string;
  onRefresh: () => void;
  /** 서버 데이터를 다시 불러오는 중이다. 새로고침이 회전하고 눌리지 않는다. */
  refreshing: boolean;
  onSettings: () => void;
  /** 서버 데이터를 마지막으로 성공해서 불러온 시각 */
  updatedAt: Date | null;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
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
              {/* 상태 줄의 오른쪽 끝. 좁은 화면에서는 상태 줄 아래로 흐른다. 모든 탭에서 같은 자리라 머리말의 높이가 같다.
                  갱신 중 표시는 새로고침 버튼의 회전이 맡는다(글자가 바뀌면 줄바꿈 위치가 흔들린다). */}
              <div className="ml-auto">
                <UptimeRefreshControls updatedAt={updatedAt} onRefresh={onRefresh} refreshing={refreshing}
                  autoRefresh={autoRefresh} onAutoRefreshChange={onAutoRefreshChange} />
              </div>
            </>}
          />
        </>}
      >
        {/* 누구나 아는 아이콘이라 라벨 없이 둔다. 이름은 툴팁과 aria-label이 맡는다. 새로고침은 상태 줄의 갱신 시각 옆에 있다. */}
        <IconButton icon="settings" label="서버 설정" tone="quiet" onClick={onSettings} />
      </PageHeader>
    </header>
  );
}
