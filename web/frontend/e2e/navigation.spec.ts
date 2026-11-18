import { expect, test, type Page } from '@playwright/test';
import { dockerService, uptimeFixture } from './fixtures/uptime';

// 사이드바와 그 정의(navSections.ts)를 읽는 곳들: 하단 내비, 더보기, 명령 팔레트, 경로 표시(설계 6.1, 6.6).
const EDGE = 'server_mock_edge_host_01'; // edge-host-01, 로그 앱 checkout-api(observed_mock_checkout)

const mainNav = (page: Page) => page.getByRole('navigation', { name: '주 메뉴' });
const crumbs = (page: Page) => page.getByRole('navigation', { name: '현재 위치', exact: true });
const OLD_MENUS = ['업타임', '로그', '인프라', 'API 요청', '메트릭'];

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the sidebar lists servers instead of the capability menus', async ({ page }) => {
    await page.goto('./');
    const links = mainNav(page).getByRole('link');
    // 개요 링크의 이름에는 장애 배지가 붙을 수 있다.
    await expect(links).toHaveText([/^개요/, '서버', 'Docker 환경', '그룹', '알림', '환경 설정']);
    for (const menu of OLD_MENUS) await expect(mainNav(page).getByRole('link', { name: menu, exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByText('모니터링 대상', { exact: true })).toBeVisible();
    await expect(mainNav(page).getByText('관리', { exact: true })).toBeVisible();
    await expect(mainNav(page).getByText('메뉴', { exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByText('모아 보기', { exact: true })).toHaveCount(0);
  });

  test('servers and Docker environments do not share an icon', async ({ page }) => {
    await page.goto('./');
    const iconOf = (name: string) => mainNav(page).getByRole('link', { name, exact: true }).locator('svg').innerHTML();
    expect(await iconOf('서버')).not.toBe(await iconOf('Docker 환경'));
  });

  test('a server detail is inside the servers section', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/uptime/uptime_mock_checkout`);
    await expect(mainNav(page).getByRole('link', { name: '서버', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(mainNav(page).locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(crumbs(page).getByRole('listitem').first()).toHaveText('서버');
    await expect(crumbs(page)).toHaveText(/^서버.*edge-host-01.*Checkout API$/);
    await crumbs(page).getByRole('link', { name: '서버', exact: true }).click();
    await expect(page).toHaveURL(/\/servers$/);
  });

  test('the server list leads to all logs, which stays in the servers section', async ({ page }) => {
    await page.goto('./servers');
    await page.getByRole('link', { name: '전체 로그', exact: true }).click();
    await expect(page).toHaveURL(/\/logs$/);
    await expect(page.getByRole('heading', { level: 1, name: '전체 로그' })).toBeVisible();
    await expect(mainNav(page).getByRole('link', { name: '서버', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(crumbs(page)).toHaveText(/^서버.*전체 로그$/);
    // 로그 연결은 서버의 로그 탭에서 한다.
    await expect(page.getByRole('button', { name: '로그 연결', exact: true })).toHaveCount(0);
  });

  test('all logs shows the server of each app and opens the app in its server', async ({ page }) => {
    await page.goto('./logs');
    const grid = page.getByRole('table', { name: '앱 그리드' });
    await expect(grid.getByRole('columnheader', { name: '앱', exact: true })).toBeVisible();
    await expect(page.getByText(/최근 24시간 · 앱 \d+개/)).toBeVisible();
    const row = grid.locator('tbody tr').filter({ has: page.getByRole('link', { name: 'checkout-api', exact: true }) });
    await expect(row).toContainText('edge-host-01');
    await row.getByRole('link', { name: 'checkout-api', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/logs/observed_mock_checkout\\?range=24h$`));
    await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2, name: 'checkout-api' })).toBeVisible();
  });

  test('a trace opened in an app jumps to the same app in the same server', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/logs/observed_mock_orders`);
    await page.getByRole('tabpanel').getByRole('button', { name: '트레이스', exact: true }).first().click();
    const trace = page.getByRole('dialog', { name: '트레이스 상세' });
    await trace.getByRole('button', { name: /^API 요청 \(/ }).click();
    await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/api/observed_mock_orders\\?traceId=[0-9a-f]+$`));
    await expect(mainNav(page).getByRole('link', { name: '서버', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('all logs names the server of each recurring pattern, a server tab does not', async ({ page }) => {
    await page.goto('./logs');
    const patterns = page.locator('section', { has: page.getByRole('heading', { name: '자주 발생한 오류·경고' }) });
    const checkout = patterns.getByRole('link').filter({ hasText: 'checkout-api' }).first();
    await expect(checkout).toContainText('서버 edge-host-01');
    await page.goto(`./servers/${EDGE}/logs`);
    const tabPatterns = page.locator('section', { has: page.getByRole('heading', { name: '자주 발생한 오류·경고' }) });
    await expect(tabPatterns.getByRole('link').first()).toBeVisible();
    await expect(tabPatterns.getByText(/^서버 /)).toHaveCount(0);
  });

  test('the command palette finds servers and all logs, not the old menus', async ({ page }) => {
    await page.goto('./alerts');
    await page.getByRole('button', { name: /^검색/ }).click();
    const palette = page.getByRole('dialog', { name: '검색' });
    const input = palette.getByRole('textbox', { name: '검색' });
    await input.fill('서버');
    await expect(palette.getByRole('option', { name: '서버', exact: true })).toBeVisible();
    await input.fill('');
    for (const menu of OLD_MENUS) await expect(palette.getByRole('option', { name: menu, exact: true })).toHaveCount(0);
    await expect(palette.getByRole('option', { name: /^전체 로그/ })).toBeVisible();
    await input.fill('서버');
    await palette.getByRole('option', { name: '서버', exact: true }).click();
    await expect(page).toHaveURL(/\/servers$/);
    await expect(page.getByRole('table', { name: '서버 그리드' })).toBeVisible();
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the bottom navigation holds overview, servers and alerts, the rest is under more', async ({ page }) => {
    await page.goto('./');
    const bottom = page.getByRole('navigation', { name: '하단 메뉴' });
    await expect(bottom.getByRole('link')).toHaveText([/^개요/, '서버', '알림', '더보기']);
    await bottom.getByRole('link', { name: '서버', exact: true }).click();
    await expect(page).toHaveURL(/\/servers$/);
    await expect(bottom.getByRole('link', { name: '서버', exact: true })).toHaveAttribute('aria-current', 'page');

    await bottom.getByRole('link', { name: '더보기', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '더보기' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['전체 로그', 'Docker 환경', '그룹', '환경 설정']);
  });
});

// capability-menus.spec.ts를 옮긴 것: Docker 환경만 연결한 설치에서 서버 화면은 비어 있고, Docker 서비스가 끼어들지 않는다(ADR 0007).
test.describe('Docker-only setup', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174/', viewport: { width: 1440, height: 900 } });

  test('the servers section is empty and leaves Docker services out', async ({ page }) => {
    const state = await uptimeFixture(page);
    state.monitors = [];
    state.services = [dockerService()];
    state.responses.set('GET /servers', []);
    // 개발 서버는 /api를 백엔드로 넘기므로 클라이언트 라우팅으로 들어간다.
    await page.goto('./');
    await mainNav(page).getByRole('link', { name: '서버', exact: true }).click();
    await expect(page.getByRole('heading', { name: '아직 서버가 없습니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Docker API', exact: true })).toHaveCount(0);

    await page.getByRole('link', { name: '전체 로그', exact: true }).click();
    await expect(page.getByRole('heading', { name: '로그를 보내는 앱이 없습니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Docker API', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '서버 목록', exact: true })).toHaveAttribute('href', /\/servers$/);
  });
});

// 서버 이름은 보조 정보다. 서버 목록을 불러오지 못해도 앱과 그 서버 주소의 링크는 보인다.
test.describe('all logs without server names', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174/', viewport: { width: 1440, height: 900 } });

  test('a failed server lookup leaves the app list and its server links', async ({ page }) => {
    const state = await uptimeFixture(page);
    const at = new Date().toISOString();
    state.responses.set('GET /observed-services', [{ id: 'app-1', name: 'billing-api', serverId: 'server-1', signals: ['logs'], isActive: true, logLevelFilter: ['error', 'warn', 'info'], lastSeenAt: at, createdAt: at, updatedAt: at }]);
    state.failures.set('GET /servers', 500);
    await page.goto('./');
    await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '서버', exact: true }).click();
    await page.getByRole('link', { name: '전체 로그', exact: true }).click();
    await expect(page.getByRole('heading', { name: '로그를 불러오지 못했습니다' })).toHaveCount(0);
    const link = page.getByRole('table', { name: '앱 그리드' }).getByRole('link', { name: 'billing-api', exact: true });
    await expect(link).toHaveAttribute('href', /\/servers\/server-1\/logs\/app-1\?range=24h$/);
    expect(state.requests.some((request) => request.method === 'GET' && request.path === '/servers')).toBe(true);
  });
});
