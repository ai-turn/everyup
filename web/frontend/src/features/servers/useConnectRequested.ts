import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CONNECT_STATE } from './serverPaths';

/**
 * 서버 개요의 연결 버튼이 이 탭으로 옮기면서 연결 대화 상자를 열어 달라고 했는가. 연결은 데이터가 보일 자리(탭)에서 시작하고,
 * 개요는 그 자리로 보내기만 한다(연결 진입점 정리 D2). 표시는 한 번만 쓴다: 기록에서 지워 새로고침이나 뒤로 가기로 다시 열리지 않게 한다.
 */
export function useConnectRequested(): boolean {
  const navigate = useNavigate();
  const location = useLocation();
  const requested = (location.state as Record<string, unknown> | null)?.[CONNECT_STATE] === true;
  const [initial] = useState(requested);
  useEffect(() => {
    if (requested) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [requested, location.pathname, location.search, navigate]);
  return initial;
}
