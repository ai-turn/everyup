import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { parseTimeRange, type GlobalTimeRange } from '../../../components/common';
import type { ObservedService } from '../../../services/api';
import type { AppTab } from '../serverPaths';
import { appCapability } from '../serverStatus';
import { APP_TABS, DEFAULT_APP_TAB, isAppTab } from './appTabs';

/** 앱 페이지의 열린 탭과 기간. 둘 다 주소(`?tab=`, `?range=`)에 있어 새로고침과 뒤로 가기에도 남는다. */
export function useAppTabState(app: ObservedService) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: AppTab = isAppTab(requested) ? requested : DEFAULT_APP_TAB[appCapability(app)];
  const current = APP_TABS.find((item) => item.key === tab)!;
  // 기간을 바꾸면 요청 목록의 쪽 번호를 버린다.
  const range: GlobalTimeRange = parseTimeRange(searchParams.get('range')) ?? '6h';
  const setRange = (next: GlobalTimeRange) => {
    const params = new URLSearchParams(searchParams);
    params.set('range', next);
    params.delete('page');
    setSearchParams(params);
  };

  // 화살표 키로 탭을 연달아 옮기면 기록 하나를 덮어쓴다(서버 상세, Docker 서비스 상세와 같다).
  const pendingKeyboard = useRef(false);
  useEffect(() => { pendingKeyboard.current = false; }, [location]);
  const openTab = (next: AppTab, source?: 'keyboard') => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    const keyboard = source === 'keyboard';
    const previousKeyboard = pendingKeyboard.current || (location.state as { tabKeys?: boolean } | null)?.tabKeys === true;
    pendingKeyboard.current = keyboard;
    setSearchParams(params, { replace: keyboard && previousKeyboard, state: keyboard ? { tabKeys: true } : null });
  };

  return { tab, current, range, setRange, openTab, traceId: searchParams.get('traceId') ?? undefined };
}
