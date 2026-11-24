import { useLocation } from 'react-router-dom';
import { useBreadcrumbTrail, type Crumb } from '../../contexts/BreadcrumbContext';
import { listReturnTo } from '../../utils/listReturnTo';
import { sectionFor } from './navSections';

// 현재 위치의 크럼. AppHeader의 위치 표시와 탭 제목(MainLayout)이 같은 값을 읽는다.
// 섹션 크럼은 경로에서 자동으로 나온다. 상세 페이지는 `useBreadcrumb`으로
// 그 **뒤쪽만** 선언하면 된다 — 목록 페이지는 아무것도 하지 않아도 된다.
export function useLocationCrumbs(): Crumb[] {
  const { pathname, state } = useLocation();
  const declared = useBreadcrumbTrail();
  const section = sectionFor(pathname);
  return [
    ...(section ? [{ label: section.label, to: listReturnTo(state, section.to) }] : []),
    ...(declared ?? []),
  ];
}
