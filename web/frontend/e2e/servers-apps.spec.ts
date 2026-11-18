import { expect, test, type Page } from '@playwright/test';
import type { ObservedService, Server } from '../src/services/api';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. mock은 쓰기 요청을 메모리에 반영하지만
// page.goto는 앱을 새로 띄워 그 메모리를 버린다. 변경 뒤에는 앱 안에서(뒤로 가기, 링크, 탭) 이동한다.
const EDGE = 'server_mock_edge_host_01';       // checkout-api(로그만), orders-api(로그, 트레이스, 메트릭)
const BATCH = 'server_mock_batch_host_01';     // notification-worker, billing-worker(둘 다 로그, 메트릭)
const EMPTY = 'server_mock_staging_empty';
const panel = (page: Page) => page.getByRole('tabpanel').first();
const serverTabs = (page: Page) => page.getByRole('tablist', { name: '서버 기능' });
const metricApps = (page: Page) => page.getByRole('group', { name: '메트릭 앱' });

test('a server with one trace app shows that app\'s requests without a selector', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/api`);
  await expect(panel(page).getByRole('heading', { level: 2, name: 'orders-api' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/api$`));
  await expect(page.getByRole('table', { name: 'API 요청 목록' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'API 요청 앱' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'API 요청 앱' })).toHaveCount(0);
  // 로그만 보내는 checkout-api는 API 요청 탭의 대상이 아니다.
  await expect(panel(page)).not.toContainText('checkout-api');
  await expect(panel(page).getByText('수집 중', { exact: true })).toBeVisible();
  // 추가 버튼은 탭 줄 오른쪽의 조작 자리에 있다.
  await expect(page.getByRole('group', { name: '탭 조작' }).getByRole('button', { name: 'API 연결' })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: '다른 서버로 옮기기' })).toBeVisible();
  // 서버 화면의 그룹은 서버가 정한다. 머리말이 유일한 h1이고 새로고침도 머리말에만 있다.
  await expect(page.getByRole('combobox', { name: '그룹 배정' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(panel(page).getByRole('button', { name: '새로고침' })).toHaveCount(0);
});

test('the metrics tab of a server with one metrics app has no selector and skips log-only apps', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/metrics`);
  await expect(panel(page).getByRole('heading', { level: 2, name: 'orders-api' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/metrics$`));
  await expect(metricApps(page)).toHaveCount(0);
  await expect(panel(page)).not.toContainText('checkout-api');
});

test('several metrics apps open the worst one, keep the choice in the address and drop the old query', async ({ page }) => {
  await page.goto(`./servers/${BATCH}/metrics?range=24h`);
  // 두 앱이 모두 수집 중이면 이름순 첫 번째다.
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/metrics/observed_mock_billing\\?range=24h$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'billing-worker' })).toBeVisible();
  await expect(metricApps(page).getByRole('button')).toHaveCount(2);
  await expect(metricApps(page).getByRole('button', { name: 'billing-worker 수집 중' })).toHaveAttribute('aria-pressed', 'true');

  const other = metricApps(page).getByRole('button', { name: 'notification-worker 수집 중' });
  await other.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/metrics/observed_mock_notifications$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'notification-worker' })).toBeVisible();
  await expect(other).toHaveAttribute('aria-pressed', 'true');

  // billing-worker의 연결을 멈추면(대기) 수집 중인 notification-worker가 더 나쁜 상태다.
  await metricApps(page).getByRole('button', { name: /^billing-worker/ }).click();
  await panel(page).getByRole('button', { name: '연결 중지' }).click();
  await page.getByRole('dialog', { name: '직접 수집 연결을 중지할까요?' }).getByRole('button', { name: '연결 중지' }).click();
  await expect(metricApps(page).getByRole('button', { name: 'billing-worker 연결 비활성화됨' })).toBeVisible();
  // 보고 있던 앱은 상태가 바뀌어도 그대로다.
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/metrics/observed_mock_billing$`));
  await serverTabs(page).getByRole('tab', { name: /^메트릭/ }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/metrics/observed_mock_notifications$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'notification-worker' })).toBeVisible();
});

test('the requests and traces switch is its own tab row inside the API tab', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/api`);
  const views = page.getByRole('tablist', { name: '요청/트레이스 보기' });
  await views.getByRole('tab', { name: '트레이스' }).click();
  await expect(page).toHaveURL(/[?&]tab=traces/);
  await expect(views.getByRole('tab', { name: '트레이스' })).toHaveAttribute('aria-selected', 'true');
  await expect(serverTabs(page).getByRole('tab', { selected: true })).toHaveText(/^API 요청/);
  // 안쪽 탭의 화살표 키는 서버 탭을 옮기지 않는다.
  await page.keyboard.press('ArrowLeft');
  await expect(views.getByRole('tab', { name: '요청' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/api\\?`));
  await expect(serverTabs(page).getByRole('tab', { selected: true })).toHaveText(/^API 요청/);
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
  await panel(page).getByRole('button', { name: 'API 연결' }).click();
  const dialog = page.getByRole('dialog', { name: 'API 요청 연결' });
  await expect(dialog.getByText('연결 정보를 확인하고 있습니다…')).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: '그룹' })).toHaveCount(0);
  await dialog.getByLabel('앱 이름').fill('staging-api');
  await dialog.getByRole('button', { name: '추가' }).click();
  await expect(dialog.getByRole('button', { name: 'API Key 복사' })).toBeVisible();
  // 서버 데이터를 다시 불러와 탭의 본문이 바뀌어도 키 안내는 남는다.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'staging-api' })).toBeAttached();
  await expect(dialog.getByRole('button', { name: 'API Key 복사' })).toBeVisible();

  await dialog.getByRole('button', { name: 'API 보기' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/servers/${EMPTY}/api/observed_mock_[^/?]+$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'staging-api' })).toBeVisible();
  await expect(page.getByText('API 요청을 연결했습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();
});

test('moving a metrics app goes to its new server', async ({ page }) => {
  await page.goto(`./servers/${BATCH}/metrics/observed_mock_notifications`);
  await panel(page).getByRole('button', { name: '다른 서버로 옮기기' }).click();
  const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
  await dialog.getByRole('radio', { name: 'payments-api (Production)' }).check();
  await dialog.getByRole('button', { name: '옮기기' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api\/metrics\/observed_mock_notifications$/);
  await expect(page.getByRole('heading', { level: 1, name: 'payments-api' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { level: 2, name: 'notification-worker' })).toBeVisible();
  await expect(page.getByText('앱을 옮겼습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();
});

test('detaching metrics from an app with logs returns to the first screen without it and keeps the group', async ({ page }) => {
  await page.goto(`./servers/${BATCH}/metrics/observed_mock_notifications`);
  // 서버 머리말 상태 줄의 그룹. 수정 요청에서 serverId가 빠지면 백엔드(와 mock)가 서버의 그룹을 해제한다.
  const serverGroup = page.locator('header', { has: page.getByRole('heading', { level: 1 }) }).getByText(/^그룹 /);
  await expect(serverGroup).toHaveText('그룹 Backoffice');
  await panel(page).getByRole('button', { name: '메트릭 연결 해제' }).click();
  await page.getByRole('dialog', { name: '메트릭 연결을 해제할까요?' }).getByRole('button', { name: '메트릭 연결 해제' }).click();
  // 남은 앱이 하나라 선택 컨트롤 없이 그 앱을 보여 준다.
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/metrics$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'billing-worker' })).toBeVisible();
  await expect(metricApps(page)).toHaveCount(0);
  await expect(panel(page)).toBeFocused();
  await expect(serverGroup).toHaveText('그룹 Backoffice');
});

test('the app selector fits 320px without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`./servers/${BATCH}/metrics`);
  await expect(panel(page).getByRole('heading', { level: 2, name: 'billing-worker' })).toBeVisible();
  for (const button of await metricApps(page).getByRole('button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});

// 데모 데이터에 없는 앱 구성(앱이 늘어나는 서버, 이름이 긴 앱 4개, 앱 6개)은 API를 가로챈다.
test.describe('app compositions outside the demo data', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174/' });
  const at = '2026-11-01T00:00:00Z';
  const server = (id: string, name: string): Server => ({ id, name, createdAt: at, updatedAt: at });
  const app = (id: string, name: string, serverId: string, changes: Partial<ObservedService> = {}): ObservedService =>
    ({ id, name, serverId, signals: ['metrics'], isActive: true, lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at, ...changes });
  const waiting = { lastSeenAt: undefined };

  async function mockApps(page: Page, apps: () => ObservedService[]) {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const servers = [server('one', 'one-01'), server('four', 'four-01'), server('six', 'six-01')];
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      const data = path === '/servers' ? servers : path === '/observed-services' ? apps()
        : path.endsWith('/otel-metrics/health') ? { checkedAt: new Date().toISOString(), metrics: [] } : [];
      await route.fulfill({ json: { success: true, data } });
    });
    return errors;
  }

  test('a second app appearing keeps the app that was on screen', async ({ page }) => {
    const apps = [app('a-first', 'first-worker', 'one')];
    const errors = await mockApps(page, () => apps);
    await page.goto('./servers/one/metrics');
    const heading = panel(page).getByRole('heading', { level: 2, name: 'first-worker' });
    await expect(heading).toBeVisible();
    await heading.evaluate((element) => element.setAttribute('data-mounted', 'before'));
    // 데이터 대기 중인 새 앱이 더 나쁜 상태지만, 보던 앱에서 넘어가지 않는다.
    apps.push(app('a-new', 'new-worker', 'one', waiting));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(metricApps(page).getByRole('button')).toHaveCount(2);
    await expect(page).toHaveURL(/\/servers\/one\/metrics\/a-first$/);
    await expect(heading).toHaveAttribute('data-mounted', 'before');
    await expect(metricApps(page).getByRole('button', { name: /^first-worker/ })).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });

  test('four apps with long names scroll inside the selector at 320px and show non-healthy states as text', async ({ page }) => {
    const long = 'payment-settlement-reconciliation-worker';
    await mockApps(page, () => [
      app('f1', `${long}-a`, 'four'), app('f2', `${long}-b`, 'four', waiting),
      app('f3', `${long}-c`, 'four', { isActive: false }), app('f4', `${long}-d`, 'four'),
    ]);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('./servers/four/metrics');
    await expect(page).toHaveURL(/\/servers\/four\/metrics\/f2$/);
    await expect(metricApps(page).getByRole('button')).toHaveCount(4);
    await expect(metricApps(page).getByRole('button', { name: `${long}-b 데이터 대기 중` })).toContainText('데이터 대기 중');
    await expect(metricApps(page).getByRole('button', { name: `${long}-c 연결 비활성화됨` })).toContainText('연결 비활성화됨');
    // 정상인 앱은 점만 둔다.
    await expect(metricApps(page).getByRole('button', { name: `${long}-a 수집 중` })).not.toContainText('수집 중');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const scroller = metricApps(page).locator('..');
    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    // 선택된 앱은 스크롤 영역 안에 보인다.
    const area = (await scroller.boundingBox())!;
    const selected = (await metricApps(page).getByRole('button', { pressed: true }).boundingBox())!;
    expect(selected.x).toBeGreaterThanOrEqual(area.x - 1);
    expect(selected.x + selected.width).toBeLessThanOrEqual(area.x + area.width + 1);
  });

  test('more than four apps use a list whose options state non-healthy apps in text', async ({ page }) => {
    await mockApps(page, () => [
      app('s1', 'alpha-worker', 'six'), app('s2', 'bravo-worker', 'six', waiting), app('s3', 'charlie-worker', 'six'),
      app('s4', 'delta-worker', 'six', { isActive: false }), app('s5', 'echo-worker', 'six'), app('s6', 'foxtrot-worker', 'six'),
    ]);
    await page.goto('./servers/six/metrics');
    await expect(page).toHaveURL(/\/servers\/six\/metrics\/s2$/);
    const select = page.getByRole('combobox', { name: '메트릭 앱' });
    await expect(select).toHaveText('bravo-worker (데이터 대기 중)');
    await select.click();
    await expect(page.getByRole('option')).toHaveText([
      'alpha-worker', 'bravo-worker (데이터 대기 중)', 'charlie-worker', 'delta-worker (연결 비활성화됨)', 'echo-worker', 'foxtrot-worker',
    ]);
    await page.getByRole('option', { name: 'echo-worker' }).click();
    await expect(page).toHaveURL(/\/servers\/six\/metrics\/s5$/);
    await expect(panel(page).getByRole('heading', { level: 2, name: 'echo-worker' })).toBeVisible();
  });
});
