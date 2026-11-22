import { expect, test, type Page } from '@playwright/test';
import { menuItem } from './fixtures/menu';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. mock은 쓰기 요청을 메모리에 반영하지만
// page.goto는 앱을 새로 띄워 그 메모리를 버린다. 변경 뒤에는 앱 안에서(뒤로 가기, 링크) 이동한다.
const EDGE = 'server_mock_edge_host_01';       // 로그 앱 checkout-api, orders-api
const DB = 'server_mock_db_primary_01';        // 메트릭만 연결된 catalog-worker
const BATCH = 'server_mock_batch_host_01';     // 로그와 메트릭을 함께 가진 notification-worker, billing-worker
const EMPTY = 'server_mock_staging_empty';
const panel = (page: Page) => page.getByRole('tabpanel');
const appLinks = (page: Page) => page.getByRole('table', { name: '앱 그리드' }).locator('tbody a[data-row-link]');
const patterns = (page: Page) => panel(page).locator('section', { has: page.getByRole('heading', { name: '자주 발생한 오류·경고' }) }).getByRole('link');
const serverRows = (page: Page) => page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr');
// 서버 머리말 상태 줄의 그룹. 앱 수정 요청에서 serverId가 빠지면 백엔드(와 mock)가 서버의 그룹을 해제한다.
const serverGroup = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) }).getByText(/^그룹 /);
// 앱은 자기 페이지가 있다(DESIGN.md §4.7 대상 상세, 2026-11-21). 머리말이 앱의 것이다.
const appHeader = (page: Page) => page.locator('#main-content header').first();
const appTitle = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

test('a server with several log apps lists only its own apps and patterns', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/logs`);
  await expect(panel(page).getByRole('heading', { level: 2, name: '앱' })).toBeVisible();
  await expect(appLinks(page)).toHaveCount(2);
  await expect(appLinks(page).filter({ hasText: 'checkout-api' })).toHaveCount(1);
  await expect(appLinks(page).filter({ hasText: 'orders-api' })).toHaveCount(1);
  await expect(patterns(page).first()).toBeVisible();
  // 다른 서버의 앱과 그 패턴은 없다.
  await expect(panel(page)).not.toContainText('payments-api');
  await expect(panel(page)).not.toContainText('notification-worker');
  // 추가 버튼은 탭 줄 오른쪽의 조작 자리에 있다.
  await expect(page.getByRole('group', { name: '탭 조작' }).getByRole('button', { name: '로그 연결' })).toBeVisible();
  // 서버 이름이 유일한 h1이고, 새로고침은 머리말에만 있다.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(panel(page).getByRole('button', { name: '새로고침' })).toHaveCount(0);
});

test('an app opens its own page on the logs tab and a pattern narrows them', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/logs`);
  await appLinks(page).filter({ hasText: 'checkout-api' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/apps/observed_mock_checkout\\?tab=logs&range=24h$`));
  await expect(appTitle(page, 'checkout-api')).toBeVisible();
  await expect(panel(page).getByText(/^[\d,]+건 중/)).toBeVisible();
  await expect(appHeader(page).getByText('수집 중', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('checkout-api');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(panel(page).getByRole('button', { name: '새로고침' })).toHaveCount(0);

  await page.goBack();
  const pattern = patterns(page).first();
  const count = Number((await pattern.innerText()).match(/([\d,]+)회/)![1].replace(/,/g, ''));
  await pattern.click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/apps/observed_mock_[^/?]+\\?tab=logs&range=24h&pattern=`));
  await expect(panel(page).getByRole('button', { name: '같은 패턴만' })).toBeVisible();
  await expect(panel(page).getByText(new RegExp(`^${count.toLocaleString()}건 중`))).toBeVisible();
});

test('on a phone the app page links back to the card view the app was opened from', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./servers/${EDGE}/logs?view=card`);
  await panel(page).getByRole('link', { name: /checkout-api/ }).first().click();
  await expect(appTitle(page, 'checkout-api')).toBeVisible();
  // 탭을 바꿔도 처음 연 목록으로 돌아간다.
  await page.getByRole('tablist', { name: '앱 데이터' }).getByRole('tab', { name: /^메트릭/ }).click();
  await appHeader(page).getByRole('link', { name: '앱 목록', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/logs\\?view=card$`));
  await expect(page.getByRole('button', { name: '카드', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('connecting logs to an empty server keeps the key guidance open and the app lands on this server', async ({ page }) => {
  await page.goto('./servers');
  const emptyRow = serverRows(page).filter({ has: page.getByRole('link', { name: 'staging-empty', exact: true }) });
  await emptyRow.getByRole('link', { name: 'staging-empty', exact: true }).click();
  await page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^로그/ }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EMPTY}/logs$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: '이 서버의 로그를 연결하세요' })).toBeVisible();

  await panel(page).getByRole('button', { name: '로그 연결' }).click();
  const dialog = page.getByRole('dialog', { name: '로그 연결' });
  // 그룹은 서버의 것을 쓴다. 다른 서버의 앱(catalog-worker)은 기존 앱 후보가 아니다.
  await expect(dialog.getByText('연결 정보를 확인하고 있습니다…')).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: '그룹' })).toHaveCount(0);
  // 기존 앱은 이 서버의 앱만 고를 수 있다. 고를 앱이 없으면 선택은 막히고 이유를 말한다.
  await dialog.getByRole('button', { name: '기존 앱', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: '앱' })).toBeDisabled();
  await expect(dialog.getByText('이 서버에 로그를 더할 수 있는 앱이 없습니다. 다른 서버의 앱은 그 앱 페이지에서 이 서버로 옮긴 뒤 연결하세요.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '연결', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '새 앱', exact: true }).click();
  await dialog.getByLabel('앱 이름').fill('staging-logs');
  await dialog.getByRole('button', { name: '연결', exact: true }).click();

  await expect(dialog.getByText('로그를 연결할 준비가 되었습니다')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'API Key 복사' })).toBeVisible();
  // 서버 데이터를 다시 불러와 본문이 바뀌어도 한 번만 볼 수 있는 안내는 닫히지 않는다.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(appLinks(page).filter({ hasText: 'staging-logs' })).toBeAttached();
  await expect(dialog.getByText('로그를 연결할 준비가 되었습니다')).toBeVisible();

  await dialog.getByRole('button', { name: '로그 보기' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/servers/${EMPTY}/apps/observed_mock_[^/?]+\\?tab=logs$`));
  await expect(appTitle(page, 'staging-logs')).toBeVisible();
  await expect(appHeader(page).getByText('데이터 대기 중', { exact: true })).toBeVisible();
  await expect(page.getByText('로그를 연결했습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();

  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
  await expect(emptyRow).toContainText('staging-logs 데이터 대기 중');
});

test('adding logs to an existing app offers only this server\'s apps and keeps the app and the group here', async ({ page }) => {
  await page.goto(`./servers/${DB}/logs`);
  await expect(serverGroup(page)).toHaveText('그룹 Production');
  await expect(panel(page).getByRole('heading', { level: 2, name: '이 서버의 로그를 연결하세요' })).toBeVisible();
  await panel(page).getByRole('button', { name: '로그 연결' }).click();
  const dialog = page.getByRole('dialog', { name: '로그 연결' });
  await dialog.getByRole('button', { name: '기존 앱', exact: true }).click();
  await dialog.getByRole('combobox', { name: '앱' }).click();
  await expect(page.getByRole('option')).toHaveText(['앱 선택', 'catalog-worker']);
  await page.getByRole('option', { name: 'catalog-worker' }).click();
  await dialog.getByRole('button', { name: '연결', exact: true }).click();
  await dialog.getByRole('button', { name: '로그 보기' }).click();

  await expect(page).toHaveURL(new RegExp(`/servers/${DB}/apps/observed_mock_catalog\\?tab=logs$`));
  await expect(appTitle(page, 'catalog-worker')).toBeVisible();
  // 로그와 메트릭을 함께 가지므로 삭제가 아니라 로그 연결 해제다.
  await expect(await menuItem(appHeader(page), '로그 연결 해제')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goBack();
  await expect(serverGroup(page)).toHaveText('그룹 Production');
  await expect(appLinks(page)).toHaveText(['catalog-worker']);
});

test('moving an app goes to its page under the new server and it leaves the old one', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/logs`);
  await appLinks(page).filter({ hasText: 'checkout-api' }).click();
  await (await menuItem(appHeader(page), '다른 서버로 옮기기')).click();
  const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
  await expect(dialog.getByRole('radio', { name: /^edge-host-01/ })).toHaveCount(0);
  await dialog.getByRole('radio', { name: 'payments-api (Production)' }).check();
  await dialog.getByRole('button', { name: '옮기기' }).click();

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api\/apps\/observed_mock_checkout\?tab=logs$/);
  await expect(page.getByRole('banner')).toContainText('payments-api');
  await expect(appTitle(page, 'checkout-api')).toBeVisible();
  await expect(page.getByText('앱을 옮겼습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();

  // 옮긴 주소가 앱 페이지를 대신했으므로 뒤로 가면 옛 서버의 로그 목록이다. 앱은 거기서 빠졌다.
  await page.goBack();
  await expect(appLinks(page)).toHaveText(['orders-api']);
});

test('another server\'s app id says it is not this server\'s app', async ({ page }) => {
  for (const path of [`./servers/${EDGE}/apps/observed_mock_payments`, `./servers/${EDGE}/logs/observed_mock_payments`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: '이 서버의 앱이 아닙니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'edge-host-01 서버로' })).toHaveAttribute('href', new RegExp(`/servers/${EDGE}$`));
  }
});

test('detaching logs from an app with metrics stays on the app without its logs and keeps the group', async ({ page }) => {
  await page.goto(`./servers/${BATCH}/logs`);
  await expect(serverGroup(page)).toHaveText('그룹 Backoffice');
  await appLinks(page).filter({ hasText: 'notification-worker' }).click();
  await (await menuItem(appHeader(page), '로그 연결 해제')).click();
  await page.getByRole('dialog', { name: '로그 연결을 해제할까요?' }).getByRole('button', { name: '로그 연결 해제' }).click();
  // 남은 데이터(메트릭)의 탭이 첫 탭이다. 로그 탭은 연결 전이다.
  await expect(page).toHaveURL(new RegExp(`/servers/${BATCH}/apps/observed_mock_notifications$`));
  const tabs = page.getByRole('tablist', { name: '앱 데이터' });
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText('메트릭');
  await expect(tabs.getByRole('tab', { name: /^로그/ })).toContainText('연결 전');
  await expect(panel(page)).toBeFocused();
  await page.goBack();
  await expect(appLinks(page)).toHaveText(['billing-worker']);
  await expect(serverGroup(page)).toHaveText('그룹 Backoffice');
});

test('stopping the connection sits in the status row and shows the app as inactive', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/apps/observed_mock_checkout`);
  // 연결 중지는 제목 줄이 아니라 상태 표시와 같은 줄(같은 부모)에 있다.
  const stop = appHeader(page).getByRole('button', { name: '연결 중지' });
  await expect(stop.locator('xpath=..')).toContainText('수집 중');
  await stop.click();
  await page.getByRole('dialog', { name: '직접 수집 연결을 중지할까요?' }).getByRole('button', { name: '연결 중지' }).click();
  await expect(appHeader(page).getByText('연결 비활성화됨', { exact: true })).toBeVisible();
  await expect(stop).toHaveCount(0);
});

test('the logs tab and the app page have no horizontal scroll at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of [`./servers/${EDGE}/logs`, `./servers/${EDGE}/apps/observed_mock_checkout`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
});
