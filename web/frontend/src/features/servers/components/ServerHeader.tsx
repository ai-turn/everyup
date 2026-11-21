import { Link, useLocation } from 'react-router-dom';
import { DetailMeta, IconButton, MaterialIcon, PageHeader, RefreshStatus, StatusLight, Tooltip } from '../../../components/common';
import { SERVERS_PATH, serverPath, type ServerCapability } from '../serverPaths';

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

export function ServerHeader({ row, groupName, onRefresh, refreshing, onSettings, updatedAt, autoRefresh, onAutoRefreshChange, targetOpen = false }: {
  row: ServerRow;
  /** 탭이 모니터·앱 하나를 보여 준다. 그 대상의 제목(24/700)이 서버 이름보다 앞서도록 서버 이름을 16px로 낮춘다. 제목 줄은
   *  설정 버튼(40px) 높이라 머리말 높이는 그대로다 — 탭을 바꿔도 탭 줄이 움직이지 않는다(§4.6). */
  targetOpen?: boolean;
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
      {/* 데스크톱은 AppHeader 크럼이 이 역할을 한다 (DESIGN.md §3.4). 좁은 화면에서는 복귀 링크와 같은 줄의 오른쪽 끝에 갱신 상태를
          둔다 — 상태 줄 아래로 흘러 한 줄을 더 쓰던 것을 줄였다(2026-11-20 점검 B1). 넓은 화면은 상태 줄의 오른쪽 끝이다. */}
      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <Link to={SERVERS_PATH} className="inline-flex min-h-11 items-center gap-1.5 type-control text-text-muted transition-colors hover:text-action">
          <MaterialIcon size={20} name="arrow_back" />서버 목록
        </Link>
        <RefreshStatus updatedAt={updatedAt} onRefresh={onRefresh} refreshing={refreshing}
          autoRefresh={autoRefresh} onAutoRefreshChange={onAutoRefreshChange} />
      </div>
      {/* 조작은 모든 폭에서 서버 이름과 같은 줄의 오른쪽이다. 이름이 길면 이름이 말줄임되고 버튼은 줄지 않는다.
          버튼만 있는 줄이 탭과 본문을 밀어냈다(모바일에서는 상태 줄 아래 한 줄을 따로 썼다). */}
      <PageHeader
        title={row.server.name}
        compactActions
        truncateTitle
        subordinateTitle={targetOpen}
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
              <div className="ml-auto max-lg:hidden">
                <RefreshStatus updatedAt={updatedAt} onRefresh={onRefresh} refreshing={refreshing}
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
