import { useState } from 'react';

/**
 * 화면의 새로고침 신호(refreshToken)를 패널이 쓸 값으로 바꾼다. held인 동안(패널의 변경 요청이 진행 중) 바뀐 신호는 버린다.
 * 변경 요청이 끝나면 패널이 어차피 다시 불러오고, 변경 전에 시작한 조회의 응답이 변경 뒤의 화면을 덮지 않게 하려는 것이다.
 * 반환값은 held가 아닐 때 신호가 바뀔 때마다 1씩 오른다(마운트 때의 값은 그대로).
 */
export function useHeldToken(token: number, held: boolean): number {
  const [state, setState] = useState({ token, value: token });
  // 렌더링 중에 맞춘다(React의 "이전 렌더의 정보로 상태 조정" 방식).
  if (state.token !== token) setState({ token, value: held ? state.value : state.value + 1 });
  return state.value;
}
