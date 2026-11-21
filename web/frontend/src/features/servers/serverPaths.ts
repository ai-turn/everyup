// 서버 화면의 주소는 여기서만 만든다. 컴포넌트마다 문자열을 이어 붙이면 인코딩과 순서가 어긋난다.

export const SERVERS_PATH = '/servers';
export const NEW_SERVER_PATH = '/servers/new';
/** 여러 서버를 가로지르는 로그 요약. 사이드바에서는 서버 섹션에 속한다(설계 6.6). */
export const ALL_LOGS_PATH = '/logs';

export type ServerCapability = 'uptime' | 'infrastructure' | 'logs' | 'api' | 'metrics';

export const SERVER_CAPABILITIES: readonly { key: ServerCapability; label: string }[] = [
  { key: 'uptime', label: '업타임' },
  { key: 'infrastructure', label: '인프라' },
  { key: 'logs', label: '로그' },
  { key: 'api', label: 'API 요청' },
  { key: 'metrics', label: '메트릭' },
];

/** 개요의 첫 버튼이 업타임 탭으로 옮기면서 넘기는 router state의 키. 탭이 모니터 추가 대화 상자를 한 번 연다. */
export const ADD_MONITOR_STATE = 'addMonitor';

/** 연결 안내의 주 버튼과 탭 줄의 추가 버튼이 같이 쓰는 문구(DESIGN.md §4.1 액션 앵커). */
export const CONNECT_LABEL: Record<ServerCapability, string> = {
  uptime: '모니터 추가', infrastructure: '인프라 연결', logs: '로그 연결', api: 'API 연결', metrics: '메트릭 연결',
};

// 삭제 뒤 목록으로 돌아갈 때 사용자가 마지막으로 보던 검색어와 필터를 되살린다. 새로고침하면 사라진다.
let serversSearch = '';
export function rememberServersSearch(search: string) { serversSearch = search; }
export function serversListPath(): string { return `${SERVERS_PATH}${serversSearch}`; }

export function serverPath(serverId: string, capability?: ServerCapability, targetId?: string): string {
  return [SERVERS_PATH, serverId, capability, capability && targetId]
    .filter((part): part is string => Boolean(part))
    .map((part, index) => index === 0 ? part : encodeURIComponent(part))
    .join('/');
}

/** 직접 연결한 앱 페이지의 탭(DESIGN.md §4.7 대상 상세). 키는 Docker 서비스 상세(`?tab=`)와 같다. */
export type AppTab = 'logs' | 'requests' | 'traces' | 'metrics';

/** 앱 하나의 페이지. 탭을 주지 않으면 앱이 받는 데이터로 고른다(로그 > 메트릭 > API 요청). */
export function appPath(serverId: string, appId: string, tab?: AppTab): string {
  return `${SERVERS_PATH}/${encodeURIComponent(serverId)}/apps/${encodeURIComponent(appId)}${tab ? `?tab=${tab}` : ''}`;
}

/**
 * 옛 앱 주소(`/servers/:s/{logs,api,metrics}/:app`, `/logs/:id` 등)를 앱 페이지 주소로 바꾼다. 쿼리(traceId, range, 필터)는 그대로
 * 넘긴다. 옛 API 요청 탭의 `tab=traces`(요청/트레이스 보기)는 트레이스 탭이 된다.
 */
export function legacyAppPath(serverId: string, appId: string, kind: 'logs' | 'api' | 'metrics', search: string): string {
  const params = new URLSearchParams(search);
  const tab: AppTab = kind === 'api' ? (params.get('tab') === 'traces' ? 'traces' : 'requests') : kind;
  const next = new URLSearchParams({ tab });
  params.forEach((value, key) => { if (key !== 'tab') next.append(key, value); });
  return `${appPath(serverId, appId)}?${next}`;
}

/** 업타임 모니터 하나의 페이지(대상 상세, 2026-11-21). 옛 주소 `/servers/:s/uptime/:id`는 여기로 넘어간다. */
export function monitorPath(serverId: string, monitorId: string): string {
  return `${SERVERS_PATH}/${encodeURIComponent(serverId)}/monitors/${encodeURIComponent(monitorId)}`;
}
