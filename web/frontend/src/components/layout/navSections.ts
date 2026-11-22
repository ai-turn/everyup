// 내비게이션의 단일 출처 — 경로·라벨·아이콘. 사이드바, 모바일 하단 내비와 더보기, 명령 팔레트,
// AppHeader의 첫 크럼이 모두 이 표를 읽는다(DESIGN.md §3.4).
//
// 예전에는 다섯 곳이 각자 목록을 갖고 있어서 라벨이 갈렸다(`환경설정`·`설정`·`환경 설정`).
// 화면마다 다른 표현(사이드바의 개요 배지와 `/#attention` 링크, 팔레트의 "홈" 표시)은 각 컴포넌트가 가진다.

export interface NavTarget {
  /** 목록 경로이자 섹션 prefix */
  to: string;
  label: string;
  icon: string;
}

export interface NavSection extends NavTarget {
  /** 사이드바 그룹 헤더. 없으면 맨 위 그룹 */
  group?: '모니터링 대상' | '관리';
  /** 사이드바가 없는 폭(`lg` 미만)에서 들어가는 곳 — 하단 내비 또는 더보기 */
  mobile: 'bottom' | 'more';
  /** 더보기 카드 설명 */
  description?: string;
  /** 이 섹션에 담기는 다른 경로 prefix(상세 화면). 사이드바 활성 항목·첫 크럼이 이 섹션을 가리킨다 */
  aliases?: string[];
}

export const NAV_SECTIONS: NavSection[] = [
  { to: '/', label: '개요', icon: 'dashboard', mobile: 'bottom' },
  // 전체 로그(/logs)는 사이드바에 없는 서버 섹션의 화면이다(설계 6.6).
  { to: '/servers', label: '서버', icon: 'dns', group: '모니터링 대상', mobile: 'bottom', aliases: ['/logs'] },
  { to: '/environments', label: 'Docker 환경', icon: 'deployed_code', group: '모니터링 대상', mobile: 'more', aliases: ['/agents', '/services'], description: 'Docker Collector 연결과 발견된 서비스를 관리합니다.' },
  { to: '/projects', label: '그룹', icon: 'folder_open', group: '모니터링 대상', mobile: 'more', description: '서버와 Docker 환경을 묶어서 봅니다.' },
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
