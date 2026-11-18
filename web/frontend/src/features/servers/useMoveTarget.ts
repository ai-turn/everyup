import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

/**
 * 다른 서버로 옮길 대상의 ID를 쥔다. 옮길 때 최신 행에서 찾아야 그 사이의 일시정지나 수정을 되돌리지 않는다.
 * 대화 상자를 열어 둔 사이에 대상이 다른 곳에서 삭제되면 알리고 닫는다. 옮기기에 성공해 이 서버에서 빠진 것은 삭제가 아니다.
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
    moving: movingId === null ? undefined : found ?? (uncertain ? lastFound : undefined),
    open: (id: string) => { setMoved(false); setLastFound(undefined); setMovingId(id); },
    close: () => setMovingId(null),
    /** 옮기기 요청이 성공한 뒤, 서버 데이터를 다시 불러오기 전에 부른다. */
    markMoved: () => setMoved(true),
  };
}
