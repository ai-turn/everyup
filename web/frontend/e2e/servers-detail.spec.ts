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
  await expect(cause).toHaveAttribute('href', new RegExp(`/servers/${EDGE}/monitors/uptime_mock_checkout$`));
});

test('tabs come in order and name the failing capability', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  const tabs = tablist(page).getByRole('tab');
  await expect(tabs).toHaveText([/^개요/, /^업타임/, /^인프라/, /^로그/, /^API 요청/, /^메트릭/]);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  // 대상 수는 화면에 숫자로 두지 않고 접근 가능한 이름에만 담는다.
  await expect(tablist(page).getByRole('tab', { name: /업타임.*모니터 2개.*장애/ })).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: /인프라.*리소스 1개/ })).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: /로그.*앱 2개/ })).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: '개요', exact: true })).toBeVisible();
  await expect(tablist(page).getByRole('img', { name: '장애' })).toHaveCount(1);
  // 탭 이름 옆에 대상 수를 숫자로 두지 않는다.
  const visibleText = await tabs.nth(1).evaluate((tab) => [...tab.childNodes]
    .filter((node) => !(node instanceof Element && node.classList.contains('sr-only'))).map((node) => node.textContent).join(''));
  expect(visibleText).not.toMatch(/\d/);
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', await tabs.first().getAttribute('id') ?? '');
});

test('capabilities without targets read as not connected yet', async ({ page }) => {
  // payments-api: 업타임, 로그, API 요청만 있다.
  await page.goto('./servers/server_mock_payments_api');
  await expect(tablist(page).getByRole('tab', { name: '메트릭 연결 전', exact: true })).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: '인프라 연결 전', exact: true })).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: /^로그\W*앱 1개$/ })).toBeVisible();
  const connectable = page.getByRole('region', { name: '연결할 수 있는 기능' });
  // Docker Collector가 없는 서버는 설치를 마지막에 더한다(ADR 0012).
  await expect(connectable.getByRole('button')).toHaveText(['인프라 연결', '메트릭 연결', 'Docker Collector 설치']);
  // 연결은 데이터가 보일 탭에서 시작한다: 그 탭으로 옮기면서 대화 상자를 연다. 새로고침하면 다시 열리지 않는다.
  await connectable.getByRole('button', { name: '메트릭 연결' }).click();
  await expect(page).toHaveURL(/\/servers\/server_mock_payments_api\/metrics$/);
  const dialog = page.getByRole('dialog', { name: '메트릭 연결' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2, name: '이 서버의 메트릭을 연결하세요' })).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

test('switching tabs changes the address and back returns to the overview', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  const logs = tablist(page).getByRole('tab', { name: /^로그/ });
  await logs.click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/logs$`));
  await expect(logs).toHaveAttribute('aria-selected', 'true');
  await expect(tablist(page).getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2, name: '앱' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}$`));
  await expect(tablist(page).getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'true');
});

test('reselecting a tab returns to its first screen', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime?status=down`);
  const uptime = tablist(page).getByRole('tab', { name: /^업타임/ });
  await expect(uptime).toHaveAttribute('aria-selected', 'true');
  // 쿼리가 있으면 같은 탭을 눌러도 쿼리 없는 첫 화면으로 간다(설계 6.4절).
  await uptime.click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
});

test('an outage gets a banner on the overview that opens its target, above the key figures', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  const panel = page.getByRole('tabpanel');
  await expect(serverHeader(page).getByRole('link', { name: /Checkout API 응답 없음/ })).toBeVisible();
  // G안: 장애가 하나여도 개요 맨 위에 배너가 있고 그 대상으로 간다.
  const banner = panel.getByRole('region', { name: '진행 중 장애' }).getByRole('link');
  await expect(banner).toHaveCount(1);
  await expect(banner).toContainText('Checkout API 응답 없음');
  await expect(banner).toHaveAttribute('href', new RegExp(`/servers/${EDGE}/monitors/uptime_mock_checkout$`));
  await expect(panel.getByRole('region', { name: '주요 지표' })).toContainText('CPU');
});

test('a server without targets offers to connect the first capability', async ({ page }) => {
  await page.goto('./servers/server_mock_staging_empty');
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('아직 연결한 기능이 없습니다')).toBeVisible();
  await expect(panel.getByRole('button', { name: '업타임 모니터 추가' })).toBeVisible();
  await expect(panel.getByRole('region', { name: '연결된 기능' })).toHaveCount(0);
  await expect(panel.getByRole('region', { name: '연결할 수 있는 기능' })).toHaveCount(0);
  await panel.getByRole('button', { name: '업타임 모니터 추가' }).click();
  await expect(page).toHaveURL(/\/servers\/server_mock_staging_empty\/uptime$/);
  await expect(page.getByRole('tabpanel')).toContainText('이 서버의 업타임 모니터를 추가하세요');
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
  // 탭 목록은 포커스 링이 들어갈 여백(위아래 4px)을 가진다. 그 안의 탭이 한 줄이다.
  const listHeight = (await tablist(page).boundingBox())!.height;
  const tabHeight = (await tablist(page).getByRole('tab').first().boundingBox())!.height;
  expect(Math.abs(listHeight - 8 - tabHeight)).toBeLessThanOrEqual(1);
});

test('a failed app list reads as unknown, not as not connected', async ({ page }) => {
  await page.goto(`./servers/${EDGE}`);
  await page.getByRole('combobox', { name: '데모 시나리오' }).click();
  await page.getByRole('option', { name: '부분 수집 실패', exact: true }).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다')).toBeVisible();
  const logs = tablist(page).getByRole('tab', { name: /^로그.*확인 불가/ });
  await expect(logs).toBeVisible();
  await expect(logs).not.toContainText('연결 전');
  // 모르는 기능을 연결 전이라고 하지 않는다. Docker Collector 설치만 남는다.
  await expect(page.getByRole('region', { name: '연결할 수 있는 기능' }).getByRole('button')).toHaveText(['Docker Collector 설치']);

  await logs.click();
  await expect(page.getByRole('tabpanel')).toContainText('로그 앱 정보를 불러오지 못했습니다');
  await expect(page.getByRole('tabpanel').getByRole('button', { name: '다시 시도' })).toBeVisible();
});

test('a usage over the warning line is marked in the key figures, not only by color', async ({ page }) => {
  // batch-host-01: 인프라 확인 필요(CPU 76.1%).
  await page.goto('./servers/server_mock_batch_host_01');
  const figures = page.getByRole('tabpanel').getByRole('region', { name: '주요 지표' });
  await expect(figures).toContainText('CPU76%');
  await expect(figures.getByText('주의 기준 초과', { exact: false }).first()).toBeAttached();
});

test('arrow keys move through tabs without piling up history', async ({ page }) => {
  await page.goto('./servers');
  await page.getByRole('link', { name: 'edge-host-01', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}$`));
  const tabs = tablist(page).getByRole('tab');
  await tabs.first().click();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/logs$`));
  await expect(tabs.nth(3)).toBeFocused();
  await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}$`));
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
});

test('the cause link is a full tap target on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`./servers/${EDGE}`);
  const cause = serverHeader(page).getByRole('link', { name: /응답 없음/ });
  expect((await cause.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('a tab opened from the address is scrolled into the tab row without moving the page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`./servers/${EDGE}/metrics`);
  const selected = tablist(page).getByRole('tab', { selected: true });
  await expect(selected).toHaveText(/^메트릭/);
  const row = (await tablist(page).boundingBox())!;
  const tab = (await selected.boundingBox())!;
  expect(tab.x).toBeGreaterThanOrEqual(row.x - 1);
  expect(tab.x + tab.width).toBeLessThanOrEqual(row.x + row.width + 1);
  expect(await page.locator('#main-content').evaluate((element) => element.scrollTop)).toBe(0);
});
