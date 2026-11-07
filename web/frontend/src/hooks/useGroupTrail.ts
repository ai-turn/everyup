import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_SECTIONS, sectionFor, type NavTarget } from '../components/layout/navSections';

// 그룹 상세에서 연 대상 화면은 그룹 안에 머문 것으로 보여 준다: 사이드바는 "그룹", breadcrumb은
// 그룹 › Staging › 대상, 돌아가기는 그 그룹이다. 대상 화면은 업타임·로그 등 각 메뉴의 상세를 그대로 쓴다.
//
// 라우터 state가 아니라 sessionStorage에 둔다. 상세 화면이 기간(6H·24H)이나 탭을 바꾸면
// setSearchParams가 state 없이 이동해서 그룹 맥락이 중간에 사라지기 때문이다.
// 연 대상의 경로 안에 있는 동안만 유효하고, 그룹 화면도 대상 화면도 아닌 곳으로 가면 지운다.
// 그래서 나중에 업타임 메뉴에서 같은 대상을 열면 업타임 맥락으로 보인다.

export type GroupTrail = { id: string; name: string; path: string };

const KEY = 'everyup.groupTrail';
const GROUP_SECTION = NAV_SECTIONS.find((section) => section.to === '/projects')!;

function read(): GroupTrail | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as GroupTrail : null;
  } catch { return null; }
}

/** 그룹 상세의 대상 링크 onClick에서 부른다. path는 쿼리 없는 대상 경로다. */
export function openFromGroup(trail: GroupTrail) {
  try { sessionStorage.setItem(KEY, JSON.stringify(trail)); } catch { /* 저장소가 막혀 있으면 메뉴 맥락으로 보인다 */ }
}

const within = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

export function useGroupTrail(): GroupTrail | null {
  const { pathname } = useLocation();
  const trail = read();
  const active = trail && within(pathname, trail.path) ? trail : null;
  const stale = Boolean(trail && !active && pathname !== `/projects/${trail.id}`);
  useEffect(() => {
    if (stale) try { sessionStorage.removeItem(KEY); } catch { /* 무시 */ }
  }, [stale]);
  return active;
}

/** 사이드바·하단 내비·첫 크럼이 가리킬 섹션. 그룹에서 연 대상이면 그룹이다. */
export function useCurrentSection(): NavTarget | null {
  const { pathname } = useLocation();
  return useGroupTrail() ? GROUP_SECTION : sectionFor(pathname);
}
