import { useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';

/**
 * 목록 화면의 검색어와 필터를 주소(`?q=`, `?status=` 등)에 둔다(DESIGN.md §4.5 목록 필터).
 *
 * 입력값은 로컬 상태가 쥔다. URL은 react-router가 transition 안에서 반영해 값이 한 박자 늦게 돌아오므로,
 * URL에 직접 묶으면 한글 조합 중 글자가 덮여 '결제'가 'ㄱ겨결결ㅈ제제'가 됐다. URL은 공유·복귀용 사본이다.
 * 이 훅이 쓰는 주소 변경은 모두 replace다. 그 밖의 이동(링크, 뒤로 가기)이면 검색창이 주소의 q를 따른다.
 *
 * @param alsoClear 필터를 바꿀 때 함께 지울 매개변수(업타임 탭의 열린 패널 `inspect` 등)
 */
export function useListSearch(alsoClear: readonly string[] = []) {
  const [params, setParams] = useSearchParams();
  const [query, setQueryInput] = useState(() => params.get('q') ?? '');
  const location = useLocation();
  const navigationType = useNavigationType();
  // 첫 기록의 key는 항상 default라 key만으로는 이동을 놓친다. 주소도 함께 본다.
  const seen = `${location.key}${location.search}`;
  const [seenLocation, setSeenLocation] = useState(seen);
  if (seen !== seenLocation) {
    setSeenLocation(seen);
    if (navigationType !== 'REPLACE') setQueryInput(params.get('q') ?? '');
  }

  const update = (change: (next: URLSearchParams) => void) => setParams((current) => {
    const next = new URLSearchParams(current);
    change(next);
    alsoClear.forEach((key) => next.delete(key));
    return next;
  }, { replace: true });
  const setParam = (key: string, value: string | null) => update((next) => { if (value) next.set(key, value); else next.delete(key); });
  const setQuery = (value: string) => { setQueryInput(value); setParam('q', value); };
  /** 검색어와 주어진 필터를 한 번에 지운다(빈 결과의 `필터 해제`). */
  const clearFilters = (keys: readonly string[]) => { setQueryInput(''); update((next) => ['q', ...keys].forEach((key) => next.delete(key))); };

  return { params, query, search: query.trim().toLowerCase(), setQuery, setParam, clearFilters };
}
