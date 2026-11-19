import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

/** 목록을 불러오지 못한 상태(uncertain)에서 옮기기를 눌렀는데 대상을 찾지 못했을 때. 없다고 단정하지 않는다. */
export const MOVE_TARGET_UNCERTAIN = '대상 정보를 확인하지 못했습니다. 새로고침한 뒤에 다시 시도해 주세요.';

/**
 * 다른 서버로 옮길 대상의 ID를 쥔다. 옮길 때 최신 행에서 찾아야 그 사이의 일시정지나 수정을 되돌리지 않는다.
 * 대화 상자를 열어 둔 사이에 대상이 다른 곳에서 삭제되면 알리고 닫는다. 옮기기에 성공해 이 서버에서 빠진 것은 삭제가 아니다
 * (대화 상자는 close를 부를 때까지 마지막으로 찾은 대상으로 열려 있다).
 * uncertain이면(이 기능의 목록을 불러오지 못했거나 이전 정보다) 없어진 것인지 알 수 없으므로 판정을 미루고 마지막으로 찾은 대상을 둔다.
 */
export function useMoveTarget<T>(find: (id: string) => T | undefined, uncertain = false) {
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [goneCount, setGoneCount] = useState(0);
  const [lastFound, setLastFound] = useState<T | undefined>(undefined);
  const found = movingId ? find(movingId) : undefined;
  // 렌더링 중에 맞춘다(React의 "이전 렌더의 정보로 상태 조정" 방식). 알림만 효과에서 띄운다.
  if (found !== undefined && found !== lastFound) setLastFound(found);
  if (movingId !== null && found === undefined && !moved && !uncertain) {
    setMovingId(null);
    setGoneCount((count) => count + 1);
  }
  useEffect(() => {
    if (goneCount > 0) toast.error('대상이 삭제되어 옮길 수 없습니다');
  }, [goneCount]);
  return {
    moving: movingId === null ? undefined : found ?? (uncertain || moved ? lastFound : undefined),
    open: (id: string) => { setMoved(false); setLastFound(undefined); setMovingId(id); },
    close: () => setMovingId(null),
    /** 옮기기 요청이 성공한 뒤, 서버 데이터를 다시 불러오기 전에 부른다. */
    markMoved: () => setMoved(true),
  };
}

/**
 * 삭제나 이동을 시작한 대상. 행에서는 먼저 빠지지만(forgetTarget) 화면은 서버 데이터를 다시 불러온 뒤에 옮겨 간다.
 * 그 사이에 "이 서버의 것이 아닙니다"나 연결 안내가 보이지 않게 탭은 자리 표시를 둔다. 화면이 바뀌면(location.key) 잊는다.
 * mounted는 다시 불러오는 사이에 사용자가 다른 화면으로 떠났는지 본다. 떠났으면 화면을 옮기지 않는다.
 */
export function useLeavingTarget() {
  const { key } = useLocation();
  const [leaving, setLeaving] = useState<string | null>(null);
  // 화면이 한 번 바뀌면 잊는다. 뒤로 가기로 같은 기록(같은 key)에 돌아와도 자리 표시로 남지 않게 렌더링 중에 지운다.
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setLeaving(null);
  }
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return {
    leaving: leaving === key,
    leave: () => setLeaving(key),
    mounted,
  };
}
