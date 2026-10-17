import { Link, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../common';
import { useBreadcrumbTrail, type Crumb } from '../../contexts/BreadcrumbContext';
import { sectionFor } from './navSections';
import { listReturnTo } from '../../utils/listReturnTo';

// 데스크톱 전용 위치 표시 헤더. 높이 h-16은 Sidebar 로고 블록과 같은 값이라
// 사이드바 경계 너머로 크롬 상단이 한 줄로 이어진다.
//
// 뒤로가기 버튼을 따로 두지 않는다 (DESIGN.md §3.4) — 첫 크럼이 목록 링크라
// 별도 "목록으로"와 목적지가 같다.
export function AppHeader() {
  const { pathname, state } = useLocation();
  const declared = useBreadcrumbTrail();

  // 섹션 크럼은 경로에서 자동으로 나온다. 상세 페이지는 `useBreadcrumb`으로
  // 그 **뒤쪽만** 선언하면 된다 — 목록 페이지는 아무것도 하지 않아도 된다.
  const section = sectionFor(pathname);
  const crumbs: Crumb[] = [
    ...(section ? [{ label: section.label, to: listReturnTo(state, section.to) }] : []),
    ...(declared ?? []),
  ];

  if (crumbs.length === 0) return null;

  return (
    // overflow-hidden + scrollbar-gutter:stable은 장식이 아니라 정렬을 위한 것이다.
    // 본문 스크롤 컨테이너가 같은 거터(15px)를 예약하는데 헤더는 그 바깥이라,
    // 안쪽 max-w-320 박스를 mx-auto로 가운데 두면 양쪽이 거터의 절반씩(7.5px) 어긋난다.
    // 헤더도 같은 값을 예약하게 해서 두 박스의 폭을 맞춘다 — 오버레이 스크롤바
    // 환경에서는 양쪽 다 0을 예약하므로 자동으로 맞는다. 헤더에 드롭다운처럼
    // 넘치는 요소를 넣으려면 이 클립을 먼저 풀어야 한다.
    <header className="hidden h-16 shrink-0 items-center overflow-y-hidden [scrollbar-gutter:stable] border-b border-ui-border bg-bg-surface lg:flex">
      <nav aria-label="현재 위치" className="w-full max-w-320 mx-auto px-4 sm:px-6">
        <ol className="flex items-center gap-1.5 min-w-0">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${crumb.label}\u0000${crumb.to ?? ''}`} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && (
                  <MaterialIcon size={20} name="chevron_right" className="shrink-0 text-text-dim" />
                )}
                {crumb.to && !last ? (
                  <Link
                    to={crumb.to}
                    className="truncate type-label text-text-muted transition-colors hover:text-action"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={`truncate type-label ${last ? 'text-text-base' : 'text-text-muted'}`}
                    aria-current={last ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </header>
  );
}
