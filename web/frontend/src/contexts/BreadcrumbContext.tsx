import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

export interface Crumb {
  label: string;
  /** 없으면 현재 위치(마지막 크럼) */
  to?: string;
}

interface BreadcrumbValue {
  crumbs: Crumb[] | null;
  setCrumbs: (crumbs: Crumb[] | null) => void;
  /** AppHeader 오른쪽 액션 자리. 메뉴 첫 화면의 PageHeader가 데스크톱에서 주 액션을 여기로 옮긴다. */
  actionSlot: HTMLElement | null;
  setActionSlot: (element: HTMLElement | null) => void;
  /** 메뉴 첫 화면이 떠 있으면 그 제목의 개수. AppHeader가 크럼을 페이지 제목으로 그린다(DESIGN.md §3.4). */
  menuTitle: MenuTitle | null;
  setMenuTitle: (title: MenuTitle | null) => void;
}

/** `count`가 없으면 개수를 말하지 않는 화면, `null`이면 아직 모르는 개수다. */
export interface MenuTitle { count?: number | null }

const BreadcrumbContext = createContext<BreadcrumbValue>({ crumbs: null, setCrumbs: () => {}, actionSlot: null, setActionSlot: () => {}, menuTitle: null, setMenuTitle: () => {} });

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  // ref 콜백으로 채운다 — 커밋의 레이아웃 단계라 페이지가 그려지기 전에 포털 대상이 정해진다.
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [menuTitle, setMenuTitle] = useState<MenuTitle | null>(null);
  const value = useMemo(() => ({ crumbs, setCrumbs, actionSlot, setActionSlot, menuTitle, setMenuTitle }), [crumbs, actionSlot, menuTitle]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHeaderActionSlot() {
  return useContext(BreadcrumbContext).actionSlot;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSetHeaderActionSlot() {
  return useContext(BreadcrumbContext).setActionSlot;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMenuTitle() {
  return useContext(BreadcrumbContext).menuTitle;
}

/** 메뉴 첫 화면의 PageHeader가 마운트된 동안 제목(개수)을 AppHeader에 알린다. 그리기 전에 정해 크기가 바뀌어 보이지 않게 한다. */
// eslint-disable-next-line react-refresh/only-export-components
export function useRegisterMenuTitle(active: boolean, count: number | null | undefined) {
  const { setMenuTitle } = useContext(BreadcrumbContext);
  useLayoutEffect(() => {
    if (!active) return;
    setMenuTitle({ count });
    return () => setMenuTitle(null);
  }, [active, count, setMenuTitle]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBreadcrumbTrail() {
  return useContext(BreadcrumbContext).crumbs;
}

/**
 * 상세 페이지가 **섹션 크럼 뒤에 올 부분만** 선언한다. 첫 크럼(업타임·로그·…)은
 * `navSections`가 경로에서 뽑으므로 여기 넣지 않는다.
 *
 * ```tsx
 * useBreadcrumb([{ label: monitor.name }]);                        // 업타임 › Storefront
 * useBreadcrumb([{ label: serverName, to: `/servers/${id}` },
 *                { label: service.name }]);                        // Docker 환경 › prod-server › api
 * ```
 *
 * 데이터 로딩 전에는 빈 배열을 넘기면 섹션 크럼만 보인다. 훅이 조건부로 호출되면
 * 안 되므로 `...(x ? [c] : [])` 꼴로 배열 쪽을 비운다.
 *
 * 언마운트하면 지워져서 목록 페이지는 섹션 크럼으로 자동 폴백한다.
 * 호출부가 배열을 매번 새로 만들어도 되도록 라벨·링크를 직렬화한 문자열을
 * effect 의존성으로 쓴다 — 호출부마다 useMemo를 강요하지 않기 위한 선택이다.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useBreadcrumb(crumbs: Crumb[]) {
  const { setCrumbs } = useContext(BreadcrumbContext);
  const key = crumbs.map((c) => `${c.label}\u0000${c.to ?? ''}`).join('\u0001');

  const apply = useCallback(() => {
    // key가 빈 문자열이면 ''.split()이 ['']를 돌려줘 빈 크럼이 생긴다 — 먼저 걸러낸다.
    setCrumbs(key === '' ? [] : key.split('\u0001').map((part) => {
      const [label, to] = part.split('\u0000');
      return to ? { label, to } : { label };
    }));
  }, [key, setCrumbs]);

  useEffect(() => {
    apply();
    return () => setCrumbs(null);
  }, [apply, setCrumbs]);
}
