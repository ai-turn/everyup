import { createContext } from 'react';

/**
 * 크기·variant를 정하지 않은 Button·ButtonLink·ListViewToggle의 기본값. `PageHeader menu`가 채운다:
 * - 데스크톱 `AppHeader`로 포털한 조작: sm(32px) + secondary. 64px 헤더에서 40px 검은 채움 버튼이 크럼보다
 *   무거웠고, `로그 연결`·`추가`는 가끔 쓰는 설정 조작이라 메뉴마다 가장 튈 이유가 없었다.
 * - 모바일 메뉴 첫 화면의 조작: secondary만(터치 높이 md 유지). 남은 폭을 채운 검은 버튼이 같은 이유로 가장 무거웠다.
 * 빈 상태(EmptyState)의 연결 버튼·다이얼로그는 이 Context 밖이라 그대로 primary다.
 */
export const ControlDefaultsContext = createContext<{ size?: 'sm' | 'md'; variant?: 'secondary' }>({});
