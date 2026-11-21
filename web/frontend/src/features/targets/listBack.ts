import { listReturnTo } from '../../utils/listReturnTo';

/**
 * 대상 페이지를 목록에서 열었으면 그 목록으로 돌아가는 링크(검색·보기 방식 포함, state.returnTo). 목록이 아닌 곳에서 왔으면 없다.
 * `lists`는 돌아갈 수 있는 목록의 주소와 링크 문구다.
 */
export function listBack(state: unknown, lists: readonly { path: string; label: string }[]): { label: string; to: string } | undefined {
  const given = (state as { returnTo?: unknown } | null)?.returnTo;
  if (typeof given !== 'string') return undefined;
  const list = lists.find(({ path }) => listReturnTo(state, path) === given);
  return list ? { label: list.label, to: given } : undefined;
}
