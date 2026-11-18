import { expect, test, type Page } from '@playwright/test';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. 기본 시나리오는 attention이다.
const EDGE = 'server_mock_edge_host_01';
const serverHeader = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
const tablist = (page: Page) => page.getByRole('tablist', { name: '서버 기능' });

test('failing server shows its name, state and a cause link to the monitor', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  await expect(page.getByRole('heading', { level: 1, name: 'edge-host-01' })).toBeVisible();
  const header = serverHeader(page);
  await expect(header).toContainText('장애');
  const cause = header.getByRole('link', { name: /응답 없음/ });
  await expect(cause).toBeVisible();
  await expect(cause).toHaveAttribute('href', new RegExp(`/servers/${EDGE}/uptime/uptime_mock_checkout$`));
  await expect(header).toContainText('Production');
});

test('tabs come in order and name the failing capability', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  const tabs = tablist(page).getByRole('tab');
  await expect(tabs).toHaveText([/^개요/, /^업타임/, /^인프라/, /^로그/, /^API 요청/, /^메트릭/]);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await expect(tablist(page).getByRole('tab', { name: '업타임 장애', exact: true })).toBeVisible();
  await expect(tablist(page).getByRole('img', { name: '장애' })).toHaveCount(1);
  // 탭 이름 옆에 대상 수를 숫자로 두지 않는다.
  await expect(tabs.nth(1)).not.toContainText(/\d/);
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', await tabs.first().getAttribute('id') ?? '');
});

test('capabilities without targets read as not connected yet', async ({ page }) => {
  // payments-api: 업타임, 로그, API 요청만 있다.
  await page.goto('./servers/server_mock_payments_api');
  await expect(tablist(page).getByRole('tab', { name: '메트릭 연결 전', exact: true })).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: '인프라 연결 전', exact: true })).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: '로그', exact: true })).toBeVisible();
  const connectable = page.getByRole('region', { name: '연결할 수 있는 기능' });
  await expect(connectable.getByRole('button')).toHaveText(['인프라', '메트릭']);
  await connectable.getByRole('button', { name: '메트릭' }).click();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api\/metrics$/);
});

test('switching tabs changes the address and back returns to the overview', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  const logs = tablist(page).getByRole('tab', { name: /^로그/ });
  await logs.click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/logs$`));
  await expect(logs).toHaveAttribute('aria-selected', 'true');
  await expect(tablist(page).getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('tabpanel')).toContainText('이 탭은 준비 중입니다');

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}$`));
  await expect(tablist(page).getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'true');
});

test('reselecting a tab returns to its first screen', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime/uptime_mock_checkout`);
  const uptime = tablist(page).getByRole('tab', { name: /^업타임/ });
  await expect(uptime).toHaveAttribute('aria-selected', 'true');
  await uptime.click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
});

test('overview puts the outage banner first and the failing capability on top', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  const panel = page.getByRole('tabpanel');
  const banner = panel.getByRole('link', { name: /진행 중 장애/ });
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('href', new RegExp(`/servers/${EDGE}/uptime/uptime_mock_checkout$`));
  // 배너가 기능 섹션보다 먼저 온다.
  await expect(panel.locator('a, h3').first()).toHaveAccessibleName(/진행 중 장애/);

  const sections = panel.getByRole('region', { name: '연결된 기능' }).getByRole('heading', { level: 3 });
  await expect(sections.first()).toHaveText('업타임');
  await expect(sections).toHaveText(['업타임', '인프라', '로그', 'API 요청', '메트릭']);
});

test('a server without targets offers to connect the first capability', async ({ page }) => {
  await page.goto('./servers/server_mock_staging_empty');
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('아직 연결한 기능이 없습니다')).toBeVisible();
  await expect(panel.getByRole('button', { name: '업타임 모니터 추가' })).toBeVisible();
  await expect(serverHeader(page)).toContainText('미분류');
  await panel.getByRole('button', { name: '업타임 모니터 추가' }).click();
  await expect(page).toHaveURL(/\/servers\/server_mock_staging_empty\/uptime$/);
  await expect(page.getByRole('tabpanel')).toContainText('연결된 대상이 없습니다');
});

test('unknown capability falls back to the overview, unknown server says so', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/nonsense`);
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}$`));
  await expect(tablist(page).getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'true');

  await page.goto('./servers/missing');
  await expect(page.getByText('서버를 찾을 수 없습니다')).toBeVisible();
  await page.getByRole('link', { name: '서버 목록' }).click();
  await expect(page).toHaveURL(/\/servers$/);
});

test('narrow screens keep the page and the tab row to one line', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`./servers/${EDGE}`);
  await expect(tablist(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  const listHeight = (await tablist(page).boundingBox())!.height;
  const tabHeight = (await tablist(page).getByRole('tab').first().boundingBox())!.height;
  expect(Math.abs(listHeight - tabHeight)).toBeLessThanOrEqual(1);
});

test('a failed app list reads as unknown, not as not connected', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  await page.getByRole('combobox', { name: '데모 시나리오' }).click();
  await page.getByRole('option', { name: '부분 수집 실패', exact: true }).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다')).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: '로그', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '연결할 수 있는 기능' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '연결된 기능' })).toContainText('확인 불가');
});
