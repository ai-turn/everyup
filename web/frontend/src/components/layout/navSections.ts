// 경로 → 섹션 라벨. AppHeader의 breadcrumb 첫 크럼을 여기서 뽑는다.
//
// 상세 페이지가 `useBreadcrumb`으로 직접 trail을 선언하지 않아도, 이 표만으로
// "어느 섹션에 있는가"는 항상 나온다. 선언하지 않은 페이지는 섹션 크럼만 보인다.
//
// 사이드바·CommandPalette에도 비슷한 목록이 있고 라벨이 미세하게 어긋나 있다
// (`환경설정` vs `환경 설정`). 여기는 사이드바 쪽 표기를 정본으로 삼았다.
// 셋을 하나로 합치는 건 사이드바의 그룹 헤더·badge·tab별 active 판정 때문에
// 단순 치환이 안 되므로 별건으로 둔다.

export interface NavSection {
  /** 경로 prefix. 가장 긴 것이 이긴다. */
  prefix: string;
  label: string;
  /** 크럼이 링크할 목록 경로. prefix와 다를 때만 지정 */
  to?: string;
}

export const NAV_SECTIONS: NavSection[] = [
  { prefix: '/projects', label: 'Projects' },
  { prefix: '/environments', label: 'Docker 환경' },
  { prefix: '/agents', label: 'Docker 환경', to: '/environments' },
  { prefix: '/services', label: 'Docker 환경', to: '/environments' },
  { prefix: '/uptime', label: '업타임' },
  { prefix: '/logs', label: '로그' },
  { prefix: '/infrastructure', label: '인프라' },
  { prefix: '/api', label: 'API 요청' },
  { prefix: '/metrics', label: '메트릭' },
  { prefix: '/alerts', label: '알림' },
  { prefix: '/settings', label: '환경 설정' },
  { prefix: '/more', label: '더보기' },
];

export function sectionFor(pathname: string): NavSection | null {
  if (pathname === '/') return { prefix: '/', label: '개요' };
  return NAV_SECTIONS
    .filter((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
}
