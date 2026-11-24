import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { menuItem } from './fixtures/menu';
import type { ObservedService, Server } from '../src/services/api';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. mock은 쓰기 요청을 메모리에 반영하지만
// page.goto는 앱을 새로 띄워 그 메모리를 버린다. 변경 뒤에는 앱 안에서(뒤로 가기, 링크, 탭) 이동한다.
// 서버의 API 요청·메트릭 탭은 앱 목록이고, 앱은 자기 페이지가 있다(DESIGN.md §4.7 대상 상세, 2026-11-21).
const EDGE = 'server_mock_edge_host_01';       // checkout-api(로그만), orders-api(로그, 트레이스, 메트릭)
const BATCH = 'server_mock_batch_host_01';     // notification-worker, billing-worker(둘 다 로그, 메트릭)
const EMPTY = 'server_mock_staging_empty';
const panel = (page: Page) => page.getByRole('tabpanel').first();
const appTabs = (page: Page) => page.getByRole('tablist', { name: '앱 데이터' });
const appList = (page: Page, name: string) => page.getByRole('table', { name });
const rowNames = (page: Page, name: string) => appList(page, name).locator('tbody [data-row-link]');

test('the API requests tab lists the trace apps and opens one on its own page', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/api`);
  // 로그만 보내는 checkout-api는 API 요청 탭의 대상이 아니다.
  await expect(rowNames(page, 'API 요청 앱')).toHaveText(['orders-api']);
  await expect(appList(page, 'API 요청 앱').getByText('수집 중', { exact: true })).toBeVisible();
  // 추가 버튼은 탭 줄 오른쪽의 조작 자리에 있다.
  await expect(page.getByRole('group', { name: '탭 조작' }).getByRole('button', { name: 'API 요청 연결' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  await rowNames(page, 'API 요청 앱').first().click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/apps/observed_mock_orders\\?tab=requests$`));
  await expect(page.getByRole('heading', { level: 1, name: 'orders-api' })).toBeVisible();
  await expect(appTabs(page).getByRole('tab', { selected: true })).toHaveText('API 요청');
  await expect(page.getByRole('table', { name: 'API 요청 목록' })).toBeVisible();
  // 옮기기는 머리말의 더보기 메뉴 안이다(DESIGN.md §4.1 상세 헤더).
  await expect(await menuItem(page.locator('#main-content header').first(), '다른 서버로 옮기기')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('the metrics tab lists only the apps that send metrics, the worst first', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/metrics`);
  await expect(rowNames(page, '메트릭 앱')).toHaveText(['orders-api']);
  // 두 앱이 모두 수집 중이면 이름순이다.
  await page.goto(`./servers/${BATCH}/metrics?range=24h`);
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/metrics\\?range=24h$`));
  await expect(rowNames(page, '메트릭 앱')).toHaveText(['billing-worker', 'notification-worker']);

  // notification-worker의 연결을 멈추면(대기) 목록에서 수집 중인 앱보다 위다.
  await rowNames(page, '메트릭 앱').filter({ hasText: 'notification-worker' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/apps/observed_mock_notifications\\?tab=metrics$`));
  await page.getByRole('button', { name: '연결 중지' }).click();
  await page.getByRole('dialog', { name: '직접 수집 연결을 중지할까요?' }).getByRole('button', { name: '연결 중지' }).click();
  await expect(page.getByText('연결 비활성화됨').first()).toBeVisible();
  await page.goBack();
  await expect(rowNames(page, '메트릭 앱')).toHaveText(['notification-worker', 'billing-worker']);
  await expect(appList(page, '메트릭 앱').locator('tbody tr').first()).toContainText('연결 비활성화됨');
});

test('requests and traces are two tabs of the app page, like a Docker service', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/apps/observed_mock_orders?tab=requests`);
  await expect(appTabs(page).getByRole('tab')).toHaveText(['로그', 'API 요청', '트레이스', '메트릭']);
  await appTabs(page).getByRole('tab', { name: '트레이스' }).click();
  await expect(page).toHaveURL(/[?&]tab=traces/);
  await expect(page.getByRole('table', { name: '트레이스 목록' })).toBeVisible();
  // 요청/트레이스를 바꾸던 두 번째 조작은 없다.
  await expect(page.getByRole('group', { name: '요청/트레이스 보기' })).toHaveCount(0);
});

test('a data type the app does not send is a muted tab that offers to add it to this app', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/apps/observed_mock_checkout`);
  // checkout-api는 로그만 보낸다. 첫 탭은 받는 데이터(로그)다.
  await expect(appTabs(page).getByRole('tab', { selected: true })).toHaveText('로그');
  await expect(appTabs(page).getByRole('tab', { name: /^메트릭/ })).toContainText('연결 전');
  // 받지 않는 유형이 둘(API 요청, 메트릭)이라 연결 줄의 `연결 추가`는 고르는 메뉴다. 고르면 그 탭으로 옮기면서 대화 상자를 연다.
  await page.locator('[data-connection="otel"]:visible').getByRole('button', { name: '연결 추가' }).click();
  await expect(page.getByRole('menuitem')).toHaveText(['API 요청 연결', '메트릭 연결']);
  await page.getByRole('menuitem', { name: 'API 요청 연결' }).click();
  await expect(page).toHaveURL(/[?&]tab=requests/);
  const dialog = page.getByRole('dialog', { name: 'API 요청 연결' });
  await expect(dialog.getByText(/^적용 범위 이 앱 하나에 적용됩니다\. API Key는 그대로이고/)).toBeVisible();
  // 이 앱에 더한다. 새 앱과 기존 앱 중에서 고르지 않는다.
  await expect(dialog.getByRole('group', { name: '앱 선택 방식' })).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: '앱' })).toHaveText('checkout-api');
});

test('a server without metrics apps asks to connect them', async ({ page }) => {
  await page.goto(`./servers/${EMPTY}/metrics`);
  await expect(panel(page).getByRole('heading', { level: 2, name: '이 서버의 메트릭을 연결하세요' })).toBeVisible();
  await expect(panel(page).getByText(/^앱이 OpenTelemetry로 보내는 메트릭을 차트로 확인합니다\./)).toBeVisible();
  await expect(panel(page).getByRole('button', { name: '메트릭 연결' })).toBeVisible();
  await page.goto(`./servers/${EMPTY}/api`);
  await expect(panel(page).getByRole('heading', { level: 2, name: '이 서버의 API 요청을 연결하세요' })).toBeVisible();
});

test('connecting API requests to an empty server keeps the key guidance and lands on the new app', async ({ page }) => {
  await page.goto(`./servers/${EMPTY}/api`);
  await panel(page).getByRole('button', { name: 'API 요청 연결' }).click();
  const dialog = page.getByRole('dialog', { name: 'API 요청 연결' });
  await expect(dialog.getByText('연결 정보를 확인하고 있습니다…')).toHaveCount(0);
  await dialog.getByLabel('앱 이름').fill('staging-api');
  await dialog.getByRole('button', { name: '연결', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'API Key 복사' })).toBeVisible();
  // 서버 데이터를 다시 불러와 탭의 본문이 바뀌어도 키 안내는 남는다.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(rowNames(page, 'API 요청 앱')).toHaveText(['staging-api']);
  await expect(dialog.getByRole('button', { name: 'API Key 복사' })).toBeVisible();

  await dialog.getByRole('button', { name: 'API 요청 보기' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/servers/${EMPTY}/apps/observed_mock_[^/?]+\\?tab=requests$`));
  await expect(page.getByRole('heading', { level: 1, name: 'staging-api' })).toBeVisible();
  await expect(page.getByText('API 요청을 연결했습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();
});

test('moving a metrics app goes to its page under the new server', async ({ page }) => {
  await page.goto(`./servers/${BATCH}/apps/observed_mock_notifications?tab=metrics`);
  await (await menuItem(page.locator('#main-content header').first(), '다른 서버로 옮기기')).click();
  const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
  await dialog.getByRole('radio', { name: 'payments-api' }).check();
  await dialog.getByRole('button', { name: '옮기기' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api\/apps\/observed_mock_notifications\?tab=metrics$/);
  await expect(page.getByRole('heading', { level: 1, name: 'notification-worker' })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('payments-api');
  await expect(page.getByText('앱을 옮겼습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();
});

test('detaching metrics from an app with logs stays on the app and on its server', async ({ page }) => {
  await page.goto(`./servers/${BATCH}`);
  await page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^메트릭/ }).click();
  await rowNames(page, '메트릭 앱').filter({ hasText: 'notification-worker' }).click();
  await (await menuItem(page.locator('#main-content header').first(), '메트릭 연결 해제')).click();
  await page.getByRole('dialog', { name: '메트릭 연결을 해제할까요?' }).getByRole('button', { name: '메트릭 연결 해제' }).click();
  // 로그가 남았으므로 이 앱의 첫 탭(로그)이다. 메트릭 탭은 연결 전이 된다.
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/apps/observed_mock_notifications$`));
  await expect(appTabs(page).getByRole('tab', { selected: true })).toHaveText('로그');
  await expect(appTabs(page).getByRole('tab', { name: /^메트릭/ })).toContainText('연결 전');
  await expect(panel(page)).toBeFocused();
  await page.locator('#main-content header').first().getByRole('link', { name: 'batch-host-01' }).or(page.getByRole('link', { name: 'batch-host-01' })).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'batch-host-01' })).toBeVisible();
});

test('the app list and the app page fit 320px without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of [`./servers/${BATCH}/metrics`, `./servers/${EDGE}/apps/observed_mock_orders?tab=requests`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
});

// 데모 데이터에 없는 앱 구성(앱이 늘어나는 서버, 이름이 긴 앱)은 API를 가로챈다.
test.describe('app compositions outside the demo data', () => {
  test.use({ baseURL: API_URL });
  const at = '2026-11-01T00:00:00Z';
  const server = (id: string, name: string): Server => ({ id, name, createdAt: at, updatedAt: at });
  const app = (id: string, name: string, serverId: string, changes: Partial<ObservedService> = {}): ObservedService =>
    ({ id, name, serverId, signals: ['metrics'], isActive: true, lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at, ...changes });
  const waiting = { lastSeenAt: undefined };

  async function mockApps(page: Page, apps: () => ObservedService[]) {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const servers = [server('one', 'one-01'), server('four', 'four-01')];
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      const data = path === '/servers' ? servers : path === '/observed-services' ? apps()
        : path.endsWith('/otel-metrics/health') ? { checkedAt: new Date().toISOString(), metrics: [] } : [];
      await route.fulfill({ json: { success: true, data } });
    });
    return errors;
  }

  test('a second app appearing joins the list without moving away from it', async ({ page }) => {
    const apps = [app('a-first', 'first-worker', 'one')];
    const errors = await mockApps(page, () => apps);
    await page.goto('./servers/one/metrics');
    await expect(rowNames(page, '메트릭 앱')).toHaveText(['first-worker']);
    // 데이터 대기 중인 새 앱이 더 나쁜 상태라 위다. 목록은 앱을 대신 열지 않는다.
    apps.push(app('a-new', 'new-worker', 'one', waiting));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(rowNames(page, '메트릭 앱')).toHaveText(['new-worker', 'first-worker']);
    await expect(page).toHaveURL(/\/servers\/one\/metrics$/);
    expect(errors).toEqual([]);
  });

  test('long app names and non-healthy states stay readable in the list at 320px', async ({ page }) => {
    const long = 'payment-settlement-reconciliation-worker';
    await mockApps(page, () => [
      app('f1', `${long}-a`, 'four'), app('f2', `${long}-b`, 'four', waiting),
      app('f3', `${long}-c`, 'four', { isActive: false }), app('f4', `${long}-d`, 'four'),
    ]);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('./servers/four/metrics');
    const rows = appList(page, '메트릭 앱').locator('tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: `${long}-b` })).toContainText('데이터 대기 중');
    await expect(rows.filter({ hasText: `${long}-c` })).toContainText('연결 비활성화됨');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  });
});
