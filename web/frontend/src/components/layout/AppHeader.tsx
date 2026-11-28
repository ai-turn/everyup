import { Link } from 'react-router-dom';
import { MaterialIcon } from '../common';
import { useMenuTitle, useSetHeaderActionSlot } from '../../contexts/BreadcrumbContext';
import { useLocationCrumbs } from './useLocationCrumbs';

// 데스크톱 전용 위치 표시 헤더. 높이 h-16은 Sidebar 로고 블록과 같은 값이라
// 사이드바 경계 너머로 크롬 상단이 한 줄로 이어진다.
//
// 뒤로가기 버튼을 따로 두지 않는다 (DESIGN.md §3.4) — 첫 크럼이 목록 링크라
// 별도 "목록으로"와 목적지가 같다.
export function AppHeader() {
  const crumbs = useLocationCrumbs();
  const setActionSlot = useSetHeaderActionSlot();
  // 메뉴 첫 화면은 크럼 하나가 그 화면의 제목이다. 본문 h1은 데스크톱에서 숨기므로 여기서 페이지 제목 크기로 그린다.
  const menuTitle = useMenuTitle();

  if (crumbs.length === 0) return null;

  return (
    // overflow-hidden + scrollbar-gutter:stable은 장식이 아니라 정렬을 위한 것이다.
    // 본문 스크롤 컨테이너가 같은 거터(15px)를 예약하는데 헤더는 그 바깥이라,
    // 안쪽 max-w-320 박스를 mx-auto로 가운데 두면 양쪽이 거터의 절반씩(7.5px) 어긋난다.
    // 헤더도 같은 값을 예약하게 해서 두 박스의 폭을 맞춘다 — 오버레이 스크롤바
    // 환경에서는 양쪽 다 0을 예약하므로 자동으로 맞는다. 헤더에 드롭다운처럼
    // 넘치는 요소를 넣으려면 이 클립을 먼저 풀어야 한다.
    <header className="hidden h-16 shrink-0 items-center overflow-y-hidden [scrollbar-gutter:stable] border-b border-border bg-surface lg:flex">
      <div className="flex w-full max-w-320 mx-auto items-center gap-4 px-4 sm:px-6">
      <nav aria-label="현재 위치" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 min-w-0">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${crumb.label}\u0000${crumb.to ?? ''}`} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && (
                  <MaterialIcon size={20} name="chevron_right" className="shrink-0 text-text-faint" />
                )}
                {crumb.to && !last ? (
                  <Link
                    to={crumb.to}
                    // 누르는 높이 24px(20px 글자 + 위아래 2px). 머리말은 h-16 고정이라 높이가 바뀌지 않는다.
                    className="truncate py-0.5 type-label text-text-muted transition-colors hover:text-text"
                  >
                    {crumb.label}
                  </Link>
                ) : menuTitle && crumbs.length === 1 ? (
                  <span className="truncate type-page-title text-text" aria-current="page">
                    {crumb.label}
                    {typeof menuTitle.count === 'number' && <> <span className="font-medium tabular-nums text-text-muted">{menuTitle.count}</span></>}
                  </span>
                ) : (
                  <span
                    className={`truncate type-label ${last ? 'text-text' : 'text-text-muted'}`}
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
      {/* 메뉴 첫 화면의 주 액션·갱신 표시가 PageHeader(menu)에서 포털로 들어온다(DESIGN.md §3.4). */}
      <div ref={setActionSlot} className="flex shrink-0 items-center gap-3" />
      </div>
    </header>
  );
}
