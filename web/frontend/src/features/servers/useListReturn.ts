import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { listReturnTo } from '../../utils/listReturnTo';

/**
 * 탭의 목록에서 대상 상세로 올 때 넘겨받은 목록의 주소(state.returnTo, 검색어·필터·보기 방식 포함).
 * 같은 탭의 목록 주소일 때만 쓰고, 없으면 탭의 첫 화면이다. 상세에서 쿼리만 바꾸는 이동(필터 해제 등)은 state를 버리므로
 * 같은 대상을 보는 동안은 처음 넘겨받은 주소를 기억한다.
 */
export function useListReturn(firstScreen: string, targetId: string | undefined): string {
  const location = useLocation();
  const given = listReturnTo(location.state, firstScreen);
  const [kept, setKept] = useState({ targetId, firstScreen, path: given });
  const same = kept.targetId === targetId && kept.firstScreen === firstScreen;
  // 렌더링 중에 맞춘다(React의 "이전 렌더의 정보로 상태 조정" 방식).
  if (!same || (given !== firstScreen && given !== kept.path)) setKept({ targetId, firstScreen, path: given });
  return same && given === firstScreen ? kept.path : given;
}
