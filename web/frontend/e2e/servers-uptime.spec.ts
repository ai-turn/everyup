import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { menuItem } from './fixtures/menu';
import { deferred, monitor, uptimeFixture } from './fixtures/uptime';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. mock은 쓰기 요청을 메모리에 반영하지만
// page.goto는 앱을 새로 띄워 그 메모리를 버린다. 변경 뒤에는 앱 안에서(뒤로 가기, 링크) 이동한다.
// 업타임 모니터는 자기 페이지가 있다(DESIGN.md §4.7 대상 상세, 2026-11-21). 서버의 업타임 탭은 모니터가 하나여도 목록이다.
const EDGE = 'server_mock_edge_host_01';
const EMPTY = 'server_mock_staging_empty';
const panel = (page: Page) => page.getByRole('tabpanel');
const header = (page: Page) => page.locator('#main-content header').first();
const title = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });
const rowNames = (page: Page) => page.getByRole('table', { name: '업타임 그리드' }).locator('tbody a[data-row-link]');
const serverRows = (page: Page) => page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr');

test('a server with several monitors lists only its own and opens one on its page', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime`);
  await expect(rowNames(page)).toHaveText(['Checkout API', 'Storefront']);
  await expect(panel(page)).not.toContainText('Payment endpoint');

  await rowNames(page).filter({ hasText: 'Storefront' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/monitors/uptime_mock_store$`));
  await expect(title(page, 'Storefront')).toBeVisible();
  await expect(page.getByRole('heading', { name: '응답 시간', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '장애 이력', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('edge-host-01');
  await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('Storefront');
  // 모니터 이름이 유일한 h1이다. 서버 머리말과 서버 탭 줄은 없다.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('tablist', { name: '서버 기능' })).toHaveCount(0);
});

test('a server with one monitor still lists it', async ({ page }) => {
  await page.goto('./servers/server_mock_payments_api/uptime');
  await expect(rowNames(page)).toHaveText(['Payment endpoint']);
  // 추가 버튼은 탭 줄 오른쪽의 조작 자리에 있다.
  await expect(page.getByRole('group', { name: '탭 조작' }).getByRole('button', { name: '모니터 추가' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('adding the first monitor to an empty server opens it and the server is no longer empty', async ({ page }) => {
  await page.goto('./servers');
  const emptyRow = serverRows(page).filter({ has: page.getByRole('link', { name: 'staging-empty', exact: true }) });
  await expect(emptyRow).toContainText('연결한 대상 없음');
  await emptyRow.getByRole('link', { name: 'staging-empty', exact: true }).click();
  await page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^업타임/ }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EMPTY}/uptime$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: '이 서버의 업타임 모니터를 추가하세요' })).toBeVisible();

  await panel(page).getByRole('button', { name: '모니터 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 추가' });
  await dialog.getByRole('textbox', { name: '이름', exact: true }).fill('Staging probe');
  await dialog.getByRole('textbox', { name: 'URL', exact: true }).fill('https://staging.example.com/health');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/servers/${EMPTY}/monitors/uptime_mock_[^/]+$`));
  await expect(title(page, 'Staging probe')).toBeVisible();
  await expect(page.getByText('업타임 모니터를 추가했습니다')).toBeVisible();
  // 포커스는 새 모니터 페이지의 본문이다.
  await expect(page.locator('#main-content [tabindex="-1"]').first()).toBeFocused();

  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
  await expect(emptyRow).toBeVisible();
  await expect(emptyRow).not.toContainText('연결한 대상 없음');
});

test('moving a monitor goes to its page under the new server and it leaves the old one', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime`);
  await rowNames(page).filter({ hasText: 'Storefront' }).click();
  await (await menuItem(header(page), '다른 서버로 옮기기')).click();
  const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
  // 현재 서버는 선택지에 없고, 선택지는 이름순이다.
  await expect(dialog.getByRole('radio', { name: /^edge-host-01/ })).toHaveCount(0);
  const choices = dialog.getByRole('radio');
  const names = await choices.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).labels?.[0]?.textContent ?? ''));
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  await dialog.getByRole('radio', { name: 'Public status (Production)' }).check();
  await dialog.getByRole('button', { name: '옮기기' }).click();

  await expect(dialog).toBeHidden();
  // 옮겨서 이 서버에서 빠진 것은 삭제가 아니다.
  await expect(page.getByText('대상이 삭제되어 옮길 수 없습니다')).toHaveCount(0);
  await expect(page).toHaveURL(/\/servers\/server_mock_public_status\/monitors\/uptime_mock_store$/);
  await expect(page.getByRole('banner')).toContainText('Public status');
  await expect(title(page, 'Storefront')).toBeVisible();
  await expect(page.getByText('업타임 모니터를 옮겼습니다')).toBeVisible();

  // 옮긴 주소가 모니터 페이지를 대신했으므로 뒤로 가면 옛 서버의 목록이다. 모니터는 거기서 빠졌다.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
  await expect(rowNames(page)).toHaveText(['Checkout API']);
});

test('deleting a monitor returns to the list it was opened from', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime`);
  await rowNames(page).filter({ hasText: 'Storefront' }).click();
  await (await menuItem(header(page), '삭제')).click();
  await page.getByRole('dialog', { name: '업타임을 삭제할까요?' }).getByRole('button', { name: '삭제' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
  await expect(rowNames(page)).toHaveText(['Checkout API']);
  await expect(panel(page)).toBeFocused();
});

test('a monitor of another server is not shown in this server', async ({ page }) => {
  for (const path of [`./servers/${EDGE}/monitors/uptime_mock_payments`, `./servers/${EDGE}/uptime/uptime_mock_payments`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: '이 서버의 모니터가 아닙니다' })).toBeVisible();
    await expect(page.getByText('Payment endpoint')).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'edge-host-01 서버로' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}$`));
});

test('status filter and bulk pause stay inside the server', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime`);
  const down = panel(page).getByRole('group', { name: '상태로 거르기' }).getByRole('button', { name: /장애/ });
  await down.click();
  await expect(page).toHaveURL(/status=down/);
  await expect(rowNames(page)).toHaveText(['Checkout API']);
  await down.click();
  await expect(rowNames(page)).toHaveCount(2);

  // 보기 전환은 탭 줄 오른쪽의 조작 자리에 있다.
  await page.getByRole('group', { name: '탭 조작' }).getByRole('group', { name: '대상 보기 방식' }).getByRole('button', { name: '카드' }).click();
  await expect(page).toHaveURL(/view=card/);
  // 카드 보기의 선택지는 이 서버의 모니터뿐이다.
  await expect(panel(page).getByRole('checkbox')).toHaveCount(2);
  await panel(page).getByRole('checkbox', { name: 'Storefront 선택' }).check();
  const bar = panel(page).getByRole('region', { name: '선택한 대상 작업' });
  await bar.getByRole('button', { name: '일시정지' }).click();
  await expect(panel(page).getByRole('button', { name: 'Storefront 재개' })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Checkout API 일시정지' })).toBeVisible();
});

test('on phones a monitor page opened from the list links back to it, with its filters', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`./servers/${EDGE}/uptime?status=up`);
  await rowNames(page).filter({ hasText: 'Storefront' }).click();
  await header(page).getByRole('link', { name: '모니터 목록', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime\\?status=up$`));
  // 주소로 바로 연 모니터도 그 서버의 업타임 목록으로 돌아간다.
  await page.goto(`./servers/${EDGE}/monitors/uptime_mock_store`);
  await header(page).getByRole('link', { name: '모니터 목록', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
});

for (const path of ['uptime', 'monitors/uptime_mock_store']) {
  test(`${path} has no horizontal scroll at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`./servers/${EDGE}/${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('불러오는 중', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('page sections sit one level below the monitor name', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/monitors/uptime_mock_store`);
  await expect(title(page, 'Storefront')).toBeVisible();
  for (const name of ['주요 지표', '응답 시간', '업타임 현황']) {
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeAttached();
  }
  await expect(page.getByRole('heading', { level: 3, name: '장애 이력', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

// 요청을 세거나 실패시켜야 하는 경우는 API를 가로채는 개발 서버에서 확인한다.
test.describe('with an intercepted API', () => {
  test.use({ baseURL: API_URL });
  const at = '2026-11-01T00:00:00Z';
  const s1 = { id: 's1', name: 'web-01', createdAt: at, updatedAt: at };
  const s2 = { id: 's2', name: 'web-02', createdAt: at, updatedAt: at };

  async function twoMonitors(page: Page) {
    const state = await uptimeFixture(page);
    state.monitors = [monitor('http-monitor', { serverId: 's1' }), monitor('tcp-monitor', { name: 'Database', type: 'tcp', url: 'db.example.com', port: 5432, serverId: 's1' })];
    state.responses.set('GET /servers', [s1, s2]);
    return state;
  }

  test('the header refresh is the only refresh and reloads the monitor history', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/monitors/http-monitor');
    await expect(title(page, 'Public API')).toBeVisible();
    const refresh = page.getByRole('button', { name: '새로고침', exact: true });
    await expect(refresh).toHaveCount(1);
    const historyRequests = () => state.requests.filter((request) => request.method === 'GET' && request.path === '/services/http-monitor/metrics').length;
    const before = historyRequests();
    await refresh.click();
    await expect.poll(historyRequests).toBeGreaterThan(before);
  });

  test('a row pause stays busy until the server data has reloaded', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/uptime');
    const pause = panel(page).getByRole('button', { name: 'Public API 일시정지' });
    await expect(pause).toBeEnabled();
    const gate = deferred();
    state.holds.set('GET /servers', gate.promise);
    try {
      await pause.click();
      await expect.poll(() => state.requests.filter((request) => request.method === 'PUT').length).toBe(1);
      await expect(panel(page).getByRole('button', { name: 'Public API 일시정지' })).toBeDisabled();
    } finally { gate.resolve(); state.holds.clear(); }
    await expect(panel(page).getByRole('button', { name: 'Public API 재개' })).toBeEnabled();
  });

  test('moving right after a pause keeps the pause', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/monitors/http-monitor');
    await expect(title(page, 'Public API')).toBeVisible();
    // 서버 데이터의 모니터 목록이 아직 일시정지 전인 동안에 이동 대화 상자를 연다.
    const gate = deferred();
    state.holds.set('GET /services', gate.promise);
    await header(page).getByRole('button', { name: '일시정지', exact: true }).click();
    await expect.poll(() => state.requests.filter((request) => request.method === 'PUT').length).toBe(1);
    await (await menuItem(header(page), '다른 서버로 옮기기')).click();
    const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
    await expect(dialog.getByRole('radio', { name: /web-02/ })).toBeVisible();
    gate.resolve();
    state.holds.clear();
    await expect(header(page).getByRole('button', { name: '재개', exact: true })).toBeEnabled();
    await dialog.getByRole('radio', { name: /web-02/ }).check();
    await dialog.getByRole('button', { name: '옮기기' }).click();
    await expect(page).toHaveURL(/\/servers\/s2\/monitors\/http-monitor$/);
    const move = state.requests.filter((request) => request.method === 'PUT').at(-1)!;
    expect(move.body).toMatchObject({ serverId: 's2', isActive: false });
  });

  test('moving after a pause whose reload failed keeps the monitor paused', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/monitors/http-monitor');
    await expect(title(page, 'Public API')).toBeVisible();
    // 일시정지 뒤의 모니터 목록 조회가 실패한다. 서버 데이터에는 일시정지 전의 모니터(isActive: true)가 남는다.
    state.failures.set('GET /services', 500);
    await header(page).getByRole('button', { name: '일시정지', exact: true }).click();
    await expect(header(page).getByRole('button', { name: '재개', exact: true })).toBeEnabled();
    await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
    await (await menuItem(header(page), '다른 서버로 옮기기')).click();
    const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
    await dialog.getByRole('radio', { name: /web-02/ }).check();
    await dialog.getByRole('button', { name: '옮기기' }).click();
    await expect.poll(() => state.requests.filter((request) => request.method === 'PUT').length).toBe(2);
    // 이동 요청은 화면의 옛 모니터가 아니라 다시 읽은 모니터로 만든다. 일시정지를 되돌리지 않는다.
    const move = state.requests.filter((request) => request.method === 'PUT').at(-1)!;
    expect(move.body).toMatchObject({ serverId: 's2', isActive: false });
  });

  test('a monitor deleted elsewhere while the move dialog is open closes it and the page says so', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/monitors/http-monitor');
    await (await menuItem(header(page), '다른 서버로 옮기기')).click();
    const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
    await expect(dialog.getByRole('radio', { name: /web-02/ })).toBeVisible();
    state.monitors = state.monitors.filter((item) => item.id !== 'http-monitor');
    // 대화 상자가 모달이라 새로고침을 누를 수 없다. 자동 갱신이 다시 보일 때 한 번 도는 것을 이용한다.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    // 모니터 페이지가 모니터를 찾지 못한 화면으로 바뀌고 대화 상자도 함께 닫힌다.
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: '이 서버의 모니터가 아닙니다' })).toBeVisible();
  });

  test('a failed monitor list while the move dialog is open does not call the monitor deleted', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/monitors/http-monitor');
    await (await menuItem(header(page), '다른 서버로 옮기기')).click();
    const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
    await expect(dialog.getByRole('radio', { name: /web-02/ })).toBeVisible();
    // 모니터 목록만 다시 불러오지 못하면 이전 목록이 남는다. 모니터가 삭제된 것이 아니다.
    state.failures.set('GET /services', 500);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
    await expect(title(page, 'Public API')).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /web-02/ })).toBeVisible();
    await expect(page.getByText('대상이 삭제되어 옮길 수 없습니다')).toHaveCount(0);
  });

  test('deleting the only monitor leaves no busy screen behind when the reload fails', async ({ page }) => {
    const state = await uptimeFixture(page);
    state.monitors = [monitor('http-monitor', { serverId: 's1' })];
    state.responses.set('GET /servers', [s1]);
    await page.goto('./servers/s1/uptime');
    await rowNames(page).first().click();
    await expect(title(page, 'Public API')).toBeVisible();
    await (await menuItem(header(page), '삭제')).click();
    // 삭제는 성공하고 그 뒤의 모니터 목록만 다시 불러오지 못한다. 서버 화면은 새로 불러오므로 모니터 목록이 없다.
    state.failures.set('GET /services', 500);
    await page.getByRole('dialog', { name: '업타임을 삭제할까요?' }).getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page).toHaveURL(/\/servers\/s1\/uptime$/);
    await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^업타임/ })).toContainText('확인 불가');
    // 모니터 목록을 불러오지 못했으므로 연결 안내가 아니라 불러오지 못했다는 안내다(B2).
    await expect(panel(page).getByText('업타임 모니터 정보를 불러오지 못했습니다')).toBeVisible();
    await expect(panel(page).getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled();
  });

  test('a failed reload after creating does not claim the monitor belongs elsewhere', async ({ page }) => {
    const state = await uptimeFixture(page);
    state.monitors = [];
    state.responses.set('GET /servers', [s1]);
    await page.goto('./servers/s1/uptime');
    await panel(page).getByRole('button', { name: '모니터 추가' }).click();
    const dialog = page.getByRole('dialog', { name: '업타임 추가' });
    await dialog.getByRole('textbox', { name: '이름', exact: true }).fill('Probe');
    await dialog.getByRole('textbox', { name: 'URL', exact: true }).fill('https://probe.example.com');
    state.responses.delete('GET /servers');
    state.failures.set('GET /servers', 500);
    await dialog.getByRole('button', { name: '추가', exact: true }).click();
    await expect(page).toHaveURL(/\/servers\/s1\/monitors\/created-0$/);
    // 모니터 페이지는 서버 데이터를 새로 불러온다. 서버 목록을 불러오지 못했으면 다른 서버의 것이라고 하지 않고 다시 시도를 둔다.
    await expect(page.getByRole('heading', { level: 1, name: '모니터 정보를 불러오지 못했습니다' })).toBeVisible();
    await expect(page.getByText('이 서버의 모니터가 아닙니다')).toHaveCount(0);
    state.failures.clear();
    state.responses.set('GET /servers', [s1]);
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(title(page, 'Probe')).toBeVisible();
  });
});
