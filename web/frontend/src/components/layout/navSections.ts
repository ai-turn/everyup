// 내비게이션의 단일 출처 — 경로·라벨·아이콘. 사이드바, 모바일 하단 내비와 더보기, 명령 팔레트,
// AppHeader의 첫 크럼이 모두 이 표를 읽는다(DESIGN.md §3.4).
//
// 예전에는 다섯 곳이 각자 목록을 갖고 있어서 라벨이 갈렸고(`환경설정`·`설정`·`환경 설정`), 모바일
// 더보기에는 업타임·로그·인프라가 빠져 있었다. 화면마다 다른 표현(사이드바의 개요 배지와
// `/#attention` 링크, 팔레트의 "홈" 표시)은 각 컴포넌트가 가진다.

export interface NavTarget {
  /** 목록 경로이자 섹션 prefix */
  to: string;
  label: string;
  icon: string;
}

export interface NavSection extends NavTarget {
  /** 사이드바 그룹 헤더. 없으면 맨 위 그룹 */
  group?: '메뉴' | '관리';
  /** 사이드바가 없는 폭(`lg` 미만)에서 들어가는 곳 — 하단 내비 또는 더보기 */
  mobile: 'bottom' | 'more';
  /** 더보기 카드 설명 */
  description?: string;
  /** 이 섹션에 담기는 다른 경로 prefix(상세 화면). 사이드바 활성 항목·첫 크럼이 이 섹션을 가리킨다 */
  aliases?: string[];
}

export const NAV_SECTIONS: NavSection[] = [
  { to: '/', label: '개요', icon: 'dashboard', mobile: 'bottom' },
  { to: '/projects', label: 'Projects', icon: 'folder_open', mobile: 'bottom' },
  { to: '/environments', label: 'Docker 환경', icon: 'dns', mobile: 'more', aliases: ['/agents', '/services'], description: 'Collector 연결과 발견된 서비스를 관리합니다.' },
  { to: '/uptime', label: '업타임', icon: 'monitor_heart', group: '메뉴', mobile: 'more', description: '서비스 응답과 장애 대상을 확인합니다.' },
  { to: '/logs', label: '로그', icon: 'article', group: '메뉴', mobile: 'more', description: '서비스별 오류·경고를 보고 로그를 검색합니다.' },
  { to: '/infrastructure', label: '인프라', icon: 'memory', group: '메뉴', mobile: 'more', description: '서버의 CPU, 메모리, 디스크 상태를 확인합니다.' },
  { to: '/api', label: 'API 요청', icon: 'api', group: '메뉴', mobile: 'more', description: '요청 상태와 오류를 확인합니다.' },
  { to: '/metrics', label: '메트릭', icon: 'monitoring', group: '메뉴', mobile: 'more', description: 'OpenTelemetry 메트릭을 확인합니다.' },
  { to: '/alerts', label: '알림', icon: 'notifications', group: '관리', mobile: 'bottom' },
  { to: '/settings', label: '환경 설정', icon: 'settings', group: '관리', mobile: 'more', description: 'EveryUp 환경을 설정합니다.' },
];

/** 모바일 하단 내비의 마지막 칸. 사이드바에는 없다 */
export const MORE_TARGET: NavTarget = { to: '/more', label: '더보기', icon: 'apps' };

const PREFIXES: { prefix: string; target: NavTarget }[] = [
  ...NAV_SECTIONS.flatMap((section) => [section.to, ...(section.aliases ?? [])].map((prefix) => ({ prefix, target: section }))),
  { prefix: MORE_TARGET.to, target: MORE_TARGET },
];

/** 경로가 속한 섹션. 가장 긴 prefix가 이기고, 개요(`/`)는 정확히 일치할 때만이다. */
export function sectionFor(pathname: string): NavTarget | null {
  if (pathname === '/') return NAV_SECTIONS[0];
  return PREFIXES
    .filter(({ prefix }) => prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`)))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.target ?? null;
}
