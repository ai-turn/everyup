import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../common';
import { useSetHeaderActionSlot } from '../../contexts/BreadcrumbContext';
import { useLocationCrumbs } from './useLocationCrumbs';

// 데스크톱 전용 상단 줄(G안): 왼쪽은 경로, 오른쪽은 화면이 넣는 자리(갱신 상태·기간 선택)와 알림 링크.
// 페이지 제목은 본문의 h1이 맡고 여기서는 13px 경로만 그린다. 메뉴 첫 화면은 크럼이 하나라 앞에 EveryUp을 붙인다.
// 뒤로가기 버튼을 따로 두지 않는다 (DESIGN.md §3.4) — 첫 크럼이 목록 링크다.
export function AppHeader() {
  const crumbs = useLocationCrumbs();
  const setActionSlot = useSetHeaderActionSlot();

  if (crumbs.length === 0) return null;
  const trail = crumbs.length === 1 ? [{ label: 'EveryUp', to: '/' }, ...crumbs] : crumbs;

  return (
    <header className="hidden h-13 shrink-0 items-center gap-3 border-b border-border px-8 lg:flex">
      <nav aria-label="현재 위치" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-2 type-control">
          {trail.map((crumb, i) => {
            const last = i === trail.length - 1;
            return (
              <Fragment key={`${crumb.label}\u0000${crumb.to ?? ''}`}>
                {i > 0 && <li aria-hidden="true" className="shrink-0 text-text-faint">/</li>}
                <li className="flex min-w-0 items-center">
                  {crumb.to && !last ? (
                    <Link to={crumb.to} className="truncate py-0.5 text-text-faint transition-colors hover:text-text">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={`truncate ${last ? 'font-medium text-text' : 'text-text-faint'}`} aria-current={last ? 'page' : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
      {/* 화면이 PageHeader에서 포털로 넣는 자리: 메뉴 첫 화면의 갱신 상태, 상세의 기간 선택(DESIGN.md §3.4). */}
      <div ref={setActionSlot} className="flex shrink-0 items-center gap-3" />
      <Link to="/alerts" aria-label="알림" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text">
        <MaterialIcon size={16} name="notifications" />
      </Link>
    </header>
  );
}
