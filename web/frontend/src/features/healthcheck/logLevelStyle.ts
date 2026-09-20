// 로그 레벨 표현. 읽기 전용 토큰과 필터 칩의 선택 상태는 요구가 달라서 둘로 나눠 둔다.

/**
 * 로그 행의 레벨 토큰 — **채움 없이 색 글자만.**
 *
 * 이전에는 `bg-red-100` 계열 불투명 파스텔 틴트를 깔았는데, 그게 부트스트랩 alert
 * 팔레트 그대로라 제일 흔해 보이는 조합이었다(DESIGN.md §9.3이 다른 자리에서는
 * 이미 금지하던 패턴이고, 배지만 예외였다). 틴트를 빼니 대비도 같이 올랐다 —
 * 라이트 기준 red 5.30→6.47, amber 4.51→5.02, sky 5.17→5.93.
 *
 * 서체도 sans에서 mono로 바꿨다. ERROR/WARN/INFO는 기계가 찍는 토큰이고 같은 표의
 * 시간·메시지 컬럼이 전부 mono인데 레벨만 Spoqa(가변폭)라, 글자폭이 제각각인 만큼
 * 컬럼이 들쭉날쭉했다. 틴트는 그 들쭉날쭉함을 덮는 역할도 하고 있었다 — mono 고정폭
 * + `w-12`로 컬럼 모양을 잡으면 채움이 필요 없어진다.
 */
export const LEVEL_BASE = 'inline-block shrink-0 w-12 font-mono text-xs font-medium uppercase';

export const LEVEL_TEXT: Record<string, string> = {
  error: 'text-red-700 dark:text-red-400',
  warn:  'text-amber-700 dark:text-amber-400',
  info:  'text-sky-700 dark:text-sky-400',
  debug: 'text-violet-700 dark:text-violet-400',
  trace: 'text-text-muted',
};

/**
 * 레벨 필터 칩의 **선택** 상태. 여기 채움은 장식이 아니라 토글이 켜졌음을 말하므로
 * 남긴다 — 읽기 전용 토큰과 달리 선택/비선택을 구분할 수단이 필요하다.
 */
export const LEVEL_CHIP: Record<string, string> = {
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  warn:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  info:  'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
  debug: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  trace: 'bg-ui-hover text-text-muted',
};
