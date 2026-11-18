import { expect, test, type Page } from '@playwright/test';
import { deferred, monitor, uptimeFixture } from './fixtures/uptime';

// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다. mock은 쓰기 요청을 메모리에 반영하지만
// page.goto는 앱을 새로 띄워 그 메모리를 버린다. 변경 뒤에는 앱 안에서(뒤로 가기, 링크) 이동한다.
const EDGE = 'server_mock_edge_host_01';
const EMPTY = 'server_mock_staging_empty';
const panel = (page: Page) => page.getByRole('tabpanel');
const rowNames = (page: Page) => page.getByRole('table', { name: '업타임 그리드' }).locator('tbody a[data-row-link]');
const serverRows = (page: Page) => page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr');

test('a server with several monitors lists only its own and opens one in the tab', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime`);
  await expect(rowNames(page)).toHaveText(['Checkout API', 'Storefront']);
  await expect(panel(page)).not.toContainText('Payment endpoint');

  await rowNames(page).filter({ hasText: 'Storefront' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime/uptime_mock_store$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Storefront' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: '응답 시간', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: '장애 이력', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('Storefront');
  // 서버 이름이 유일한 h1이고, 패널은 두 번째 머리말을 쌓지 않는다.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('a server with one monitor shows its detail without a list', async ({ page }) => {
  await page.goto('./servers/server_mock_payments_api/uptime');
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Payment endpoint' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: '응답 시간', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: '업타임 그리드' })).toHaveCount(0);
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

  await expect(page).toHaveURL(new RegExp(`/servers/${EMPTY}/uptime/uptime_mock_[^/]+$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Staging probe' })).toBeVisible();
  await expect(page.getByText('업타임 모니터를 추가했습니다')).toBeVisible();
  await expect(panel(page)).toBeFocused();

  await page.goBack();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
  await expect(emptyRow).toBeVisible();
  await expect(emptyRow).not.toContainText('연결한 대상 없음');
});

test('moving a monitor goes to its new server and it leaves the old one', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime/uptime_mock_store`);
  await panel(page).getByRole('button', { name: '다른 서버로 옮기기' }).click();
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
  await expect(page).toHaveURL(/\/servers\/server_mock_public_status\/uptime\/uptime_mock_store$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Public status' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Storefront' })).toBeVisible();
  await expect(panel(page)).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime/uptime_mock_store$`));
  await expect(panel(page)).toContainText('이 서버의 모니터가 아닙니다');
  await panel(page).getByRole('link', { name: '업타임 탭으로' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
  // 남은 모니터는 하나라서 목록 없이 상세가 보인다.
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Checkout API' })).toBeVisible();
  await expect(panel(page)).not.toContainText('Storefront');
});

test('deleting a monitor returns to the first screen of the tab', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime/uptime_mock_store`);
  await panel(page).getByRole('button', { name: '삭제' }).click();
  await page.getByRole('dialog', { name: '업타임을 삭제할까요?' }).getByRole('button', { name: '삭제' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Checkout API' })).toBeVisible();
  await expect(panel(page)).not.toContainText('Storefront');
  await expect(panel(page)).toBeFocused();
});

test('a monitor of another server is not shown in this server', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime/uptime_mock_payments`);
  await expect(panel(page)).toContainText('이 서버의 모니터가 아닙니다');
  await expect(panel(page)).not.toContainText('Payment endpoint');
  await panel(page).getByRole('link', { name: '업타임 탭으로' }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
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

test('on phones a monitor screen links back to the tab', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`./servers/${EDGE}/uptime/uptime_mock_store`);
  await panel(page).getByRole('link', { name: '모니터 목록', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));
  // 첫 화면에서는 지금 화면으로 가는 복귀 링크를 두지 않는다.
  await expect(rowNames(page)).toHaveCount(2);
  await expect(panel(page).getByRole('link', { name: '모니터 목록', exact: true })).toHaveCount(0);
});

for (const path of ['uptime', 'uptime/uptime_mock_store']) {
  test(`the uptime tab at ${path} has no horizontal scroll at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`./servers/${EDGE}/${path}`);
    await expect(panel(page).getByRole('heading', { level: 2 }).first()).toBeAttached();
    await expect(page.getByText('불러오는 중', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('a server with one monitor has no list to go back to on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('./servers/server_mock_payments_api/uptime/uptime_mock_payments');
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Payment endpoint' })).toBeVisible();
  await expect(panel(page).getByRole('link', { name: '모니터 목록', exact: true })).toHaveCount(0);
});

test('panel sections sit one level below the monitor name', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/uptime/uptime_mock_store`);
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Storefront' })).toBeVisible();
  for (const name of ['주요 지표', '응답 시간', '업타임 현황']) {
    await expect(panel(page).getByRole('heading', { level: 3, name, exact: true })).toBeAttached();
  }
  await expect(panel(page).getByRole('heading', { level: 4, name: '장애 이력', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('heading', { level: 2 })).toHaveCount(1);
});

// 요청을 세거나 실패시켜야 하는 경우는 API를 가로채는 개발 서버에서 확인한다.
test.describe('with an intercepted API', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174/' });
  const at = '2026-11-01T00:00:00Z';
  const s1 = { id: 's1', name: 'web-01', createdAt: at, updatedAt: at };
  const s2 = { id: 's2', name: 'web-02', createdAt: at, updatedAt: at };

  async function twoMonitors(page: Page) {
    const state = await uptimeFixture(page);
    state.monitors = [monitor('http-monitor', { serverId: 's1' }), monitor('tcp-monitor', { name: 'Database', type: 'tcp', url: 'db.example.com', port: 5432, serverId: 's1' })];
    state.responses.set('GET /servers', [s1, s2]);
    return state;
  }

  test('the header refresh is the only refresh and reloads the panel history', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/uptime/http-monitor');
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
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
    await page.goto('./servers/s1/uptime/http-monitor');
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
    // 서버 데이터의 모니터 목록이 아직 일시정지 전인 동안에 이동 대화 상자를 연다.
    const gate = deferred();
    state.holds.set('GET /services', gate.promise);
    await panel(page).getByRole('button', { name: '일시정지', exact: true }).click();
    await expect.poll(() => state.requests.filter((request) => request.method === 'PUT').length).toBe(1);
    await panel(page).getByRole('button', { name: '다른 서버로 옮기기' }).click();
    const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
    await expect(dialog.getByRole('radio', { name: /web-02/ })).toBeVisible();
    gate.resolve();
    state.holds.clear();
    await expect(panel(page).getByRole('button', { name: '재개', exact: true })).toBeEnabled();
    await dialog.getByRole('radio', { name: /web-02/ }).check();
    await dialog.getByRole('button', { name: '옮기기' }).click();
    await expect(page).toHaveURL(/\/servers\/s2\/uptime\/http-monitor$/);
    const move = state.requests.filter((request) => request.method === 'PUT').at(-1)!;
    expect(move.body).toMatchObject({ serverId: 's2', isActive: false });
  });

  test('a monitor deleted elsewhere while the move dialog is open closes it with a notice', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/uptime/http-monitor');
    await panel(page).getByRole('button', { name: '다른 서버로 옮기기' }).click();
    const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
    await expect(dialog.getByRole('radio', { name: /web-02/ })).toBeVisible();
    state.monitors = state.monitors.filter((item) => item.id !== 'http-monitor');
    // 대화 상자가 모달이라 새로고침을 누를 수 없다. 자동 갱신이 다시 보일 때 한 번 도는 것을 이용한다.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(dialog).toBeHidden();
    await expect(page.getByText('대상이 삭제되어 옮길 수 없습니다')).toBeVisible();
  });

  test('a failed monitor list while the move dialog is open does not call the monitor deleted', async ({ page }) => {
    const state = await twoMonitors(page);
    await page.goto('./servers/s1/uptime/http-monitor');
    await panel(page).getByRole('button', { name: '다른 서버로 옮기기' }).click();
    const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
    await expect(dialog.getByRole('radio', { name: /web-02/ })).toBeVisible();
    // 모니터 목록만 다시 불러오지 못하면 이전 목록이 남고 업타임은 확인 불가다. 모니터가 삭제된 것이 아니다.
    state.failures.set('GET /services', 500);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^업타임/ })).toContainText('확인 불가');
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /web-02/ })).toBeVisible();
    await expect(page.getByText('대상이 삭제되어 옮길 수 없습니다')).toHaveCount(0);
  });

  test('deleting the only monitor leaves no busy panel behind when the reload fails', async ({ page }) => {
    const state = await uptimeFixture(page);
    state.monitors = [monitor('http-monitor', { serverId: 's1' })];
    state.responses.set('GET /servers', [s1]);
    await page.goto('./servers/s1/uptime');
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
    await panel(page).getByRole('button', { name: '삭제', exact: true }).click();
    // 삭제는 성공하고 그 뒤의 모니터 목록만 다시 불러오지 못한다. 이전 목록에는 지운 모니터가 남아 있다.
    state.failures.set('GET /services', 500);
    await page.getByRole('dialog', { name: '업타임을 삭제할까요?' }).getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^업타임/ })).toContainText('확인 불가');
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toHaveCount(0);
    await expect(panel(page).getByRole('button', { name: '모니터 추가', exact: true })).toBeEnabled();
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
    await expect(page).toHaveURL(/\/servers\/s1\/uptime\/created-0$/);
    await expect(panel(page)).toContainText('이 모니터의 정보를 불러오지 못했습니다');
    await expect(panel(page)).not.toContainText('이 서버의 모니터가 아닙니다');
    state.failures.clear();
    state.responses.set('GET /servers', [s1]);
    await panel(page).getByRole('button', { name: '다시 시도' }).click();
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Probe' })).toBeVisible();
  });
});
