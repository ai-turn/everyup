// e2e 서버의 주소. 같은 기기의 다른 worktree가 기본 포트(4173/4174)로 e2e를 돌리는 중이면 Playwright가 그 서버를 재사용해
// 남의 코드를 시험한다. E2E_DEMO_PORT·E2E_API_PORT로 비켜 돌린다(playwright.config.ts도 같은 값을 쓴다).
export const DEMO_PORT = Number(process.env.E2E_DEMO_PORT ?? 4173);
export const API_PORT = Number(process.env.E2E_API_PORT ?? 4174);
/** 실제 HTTP 실패·복구를 시험하는 dev 서버(목업 끔). */
export const API_URL = `http://127.0.0.1:${API_PORT}/`;
