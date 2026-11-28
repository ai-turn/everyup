import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { menuItem } from './fixtures/menu';
import type { ObservedService, ObservedServiceMetricName, Server, UptimeMonitor } from '../src/services/api';
import { deferred, monitor, uptimeFixture } from './fixtures/uptime';

// 서버 데이터의 갱신: 갱신 시각, 자동 갱신 스위치, 겹치는 요청, 다시 불러오기에 실패한 종류의 이전 목록 유지(Task 11b).
test.use({ baseURL: API_URL, viewport: { width: 1440, height: 1000 } });

const at = '2026-11-01T00:00:00Z';
const server: Server = { id: 's1', name: 'web-01', createdAt: at, updatedAt: at };
const app: ObservedService = { id: 'a1', name: 'orders-api', serverId: 's1', signals: ['logs', 'traces'], isActive: true, lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at };

const panel = (page: Page) => page.getByRole('tabpanel');
const tablist = (page: Page) => page.getByRole('tablist', { name: '서버 기능' });
const serverHeader = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
// 갱신 시각(`12:00:00 갱신`). 보이는 글자는 지난 시간이라 매초 바뀌므로 화면 낭독기용 시각을 본다.
const stamp = (page: Page) => page.getByRole('group', { name: '데이터 갱신' }).locator('[aria-live]');
const refresh = (page: Page) => page.getByRole('button', { name: '새로고침', exact: true });
// 앱은 자기 페이지가 있다(DESIGN.md §4.7 대상 상세). 앱의 상태·조작은 그 페이지의 머리말에 있다.
const appHeader = (page: Page) => page.locator('#main-content header').first();
const appRows = (page: Page, name: string) => page.getByRole('table', { name }).locator('tbody tr');

async function mockServer(page: Page, options: {
  infrastructure?: boolean; monitors?: UptimeMonitor[];
  /** apps는 a1 말고 더 둘 앱, signals는 a1의 신호 */
  apps?: ObservedService[]; signals?: ObservedService['signals']; catalog?: ObservedServiceMetricName[];
} = {}) {
  const state = {
    // 키는 경로(GET) 또는 `메서드 경로`이다.
    failures: new Set<string>(),
    holds: new Map<string, Promise<void>>(),
    requests: [] as string[],
    writes: [] as { method: string; path: string; body: Record<string, unknown> | null }[],
    app: { ...app, ...(options.signals ? { signals: options.signals } : {}) } as ObservedService | null,
    infrastructure: options.infrastructure
      ? { id: 'r1', name: 'web-01', serverId: 's1', isActive: true, apiKeyMasked: 'evup_****0001', adapter: 'otel-collector', lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at }
      : null,
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    const key = `${method} ${path}`;
    state.requests.push(method === 'GET' ? path : key);
    if (method !== 'GET') state.writes.push({ method, path, body: request.postData() ? request.postDataJSON() as Record<string, unknown> : null });
    await (state.holds.get(key) ?? (method === 'GET' ? state.holds.get(path) : undefined));
    if (state.failures.has(key) || (method === 'GET' && state.failures.has(path))) {
      await route.fulfill({ status: 500, json: { success: false, error: { code: 'DATABASE_ERROR', message: 'Fixture request failed' } } });
      return;
    }
    if (path === '/observed-services/a1') {
      if (!state.app) { await route.fulfill({ status: 404, json: { success: false, error: { code: 'OBSERVED_SERVICE_NOT_FOUND' } } }); return; }
      if (method === 'PUT') state.app = { ...state.app, ...(request.postDataJSON() as Partial<ObservedService>) };
      if (method === 'DELETE') { state.app = null; await route.fulfill({ status: 204 }); return; }
      await route.fulfill({ json: { success: true, data: state.app } });
      return;
    }
    // 앱 패널(로그, API 요청)이 부르는 객체 응답. 나머지는 빈 목록이다.
    const data = path === '/servers' ? [server] : path === '/services' ? options.monitors ?? []
      : path === '/observed-services' ? [...(state.app ? [state.app] : []), ...(options.apps ?? [])]
      : path === '/observed-services/metric-catalog' ? options.catalog ?? []
      : path.endsWith('/otel-metrics/health') ? { metrics: [], checkedAt: at }
      : path === '/infrastructure-resources' ? (state.infrastructure ? [state.infrastructure] : [])
        : path === '/infrastructure-resources/r1' || path === '/infrastructure-resources/r1/revoke-key' ? state.infrastructure
          : path === '/observed-services/a1/revoke-key' ? state.app
          : path === '/observed-services/a1/rotate-key' ? { ...state.app, apiKey: 'evup_rotated_app_key' }
          : path === '/infrastructure-resources/r1/rotate-key' ? { ...state.infrastructure, apiKey: 'evup_rotated_infra_key' }
            : path.endsWith('/request-stats') ? { buckets: [], truncated: false }
              : path.endsWith('/request-endpoints') ? { endpoints: [], truncated: false }
                : path.endsWith('/request-status-summary') ? { count2xx: 0, count3xx: 0, count4xx: 0, count5xx: 0, countOther: 0 }
                  : path.endsWith('/requests') || path.endsWith('/logs') ? { data: [], total: 0 }
                    : path.endsWith('/log-filter') ? { levels: ['error', 'warn', 'info'] }
                      : path.endsWith('/api-exclusions') ? { paths: [] } : [];
    await route.fulfill({ json: { success: true, data } });
  });
  const count = (path: string) => () => state.requests.filter((item) => item === path).length;
  return { ...state, get app() { return state.app; }, writes: state.writes, serverReads: count('/servers'), count };
}

test('a failed app refresh keeps the log and API app lists but marks them unverified', async ({ page }) => {
  const state = await mockServer(page);
  await page.goto('./servers/s1/logs');
  const appLink = page.getByRole('table', { name: '앱 그리드' }).getByRole('link', { name: 'orders-api' });
  await expect(appLink).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: /^로그/ })).not.toContainText('확인 불가');

  state.failures.add('/observed-services');
  await refresh(page).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(tablist(page).getByRole('tab', { name: /^로그/ })).toContainText('확인 불가');
  await expect(tablist(page).getByRole('tab', { name: /^API 요청/ })).toContainText('확인 불가');
  // 이전 목록이 남는다. 처음부터 실패한 것처럼 불러오지 못했다는 안내로 바뀌지 않는다.
  await expect(appLink).toBeVisible();
  await expect(panel(page).getByText('로그 앱 정보를 불러오지 못했습니다')).toHaveCount(0);
  // 이전 앱의 상태로 서버를 "정상"이라고 하지 않는다. 확인할 수 있는 대상이 없으면 원인도 단정하지 않는다.
  await expect(serverHeader(page).getByText('정상', { exact: true })).toHaveCount(0);

  // API 요청 탭의 앱 목록도 이전 목록이 남고, 앱의 상태는 확인 불가다.
  await tablist(page).getByRole('tab', { name: /^API 요청/ }).click();
  await expect(appRows(page, 'API 요청 앱').filter({ hasText: 'orders-api' })).toContainText('확인 불가');

  state.failures.clear();
  await page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' }).getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
  await expect(tablist(page).getByRole('tab', { name: /^API 요청/ })).not.toContainText('확인 불가');
});

test('an app list that failed from the first load still says it could not be loaded', async ({ page }) => {
  const state = await mockServer(page);
  state.failures.add('/observed-services');
  await page.goto('./servers/s1/logs');
  await expect(panel(page).getByText('로그 앱 정보를 불러오지 못했습니다')).toBeVisible();
  await expect(page.getByRole('table', { name: '앱 그리드' })).toHaveCount(0);
  await expect(tablist(page).getByRole('tab', { name: /^로그/ })).toContainText('확인 불가');
});

test('the header keeps the last successful refresh time when a refresh fails', async ({ page }) => {
  const state = await mockServer(page);
  await page.clock.install();
  await page.goto('./servers/s1');
  await expect(stamp(page)).toContainText('갱신');
  const previous = await stamp(page).textContent();
  await page.clock.fastForward(5_000);
  state.failures.add('/observed-services');
  await refresh(page).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(refresh(page)).toBeEnabled();
  await expect(stamp(page)).toHaveText(previous!);
  state.failures.clear();
  await refresh(page).click();
  await expect(stamp(page)).not.toHaveText(previous!);
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
});

test('the automatic refresh switch stops and resumes 30 second polling of server data', async ({ page }) => {
  const state = await mockServer(page);
  await page.clock.install();
  await page.goto('./servers/s1');
  await expect(stamp(page)).toContainText('갱신');
  const initial = state.serverReads();
  // 넓은 화면의 갱신 상태는 상단 줄에 있다(G안).
  const auto = page.getByRole('switch', { name: '30초마다 자동 갱신' });
  await expect(auto).toHaveAttribute('aria-checked', 'true');
  await auto.click();
  await page.clock.fastForward(60_000);
  // 화면이 다시 보일 때의 갱신도 멈춘다.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.clock.fastForward(1_000);
  expect(state.serverReads()).toBe(initial);
  await auto.click();
  await expect.poll(state.serverReads).toBe(initial + 1);
  // 그 요청이 끝나야 다음 주기가 건너뛰어지지 않는다.
  await expect(refresh(page)).toBeEnabled();
  await page.clock.fastForward(30_000);
  await expect.poll(state.serverReads).toBe(initial + 2);
});

test('a pending refresh disables the refresh button and skips the next poll', async ({ page }) => {
  const state = await mockServer(page);
  await page.clock.install();
  await page.goto('./servers/s1');
  await expect(stamp(page)).toContainText('갱신');
  const initial = state.serverReads();
  const gate = deferred();
  state.holds.set('/servers', gate.promise);
  try {
    await refresh(page).click();
    await expect.poll(state.serverReads).toBe(initial + 1);
    await expect(refresh(page)).toBeDisabled();
    await page.clock.fastForward(29_000);
    expect(state.serverReads()).toBe(initial + 1);
    await expect(refresh(page)).toBeDisabled();
    // 한 주기(30초)를 넘긴 요청은 버려진 것으로 보고 다음 주기가 새로 보낸다.
    await page.clock.fastForward(31_000);
    await expect.poll(state.serverReads).toBe(initial + 2);
  } finally { state.holds.clear(); gate.resolve(); }
  await expect(refresh(page)).toBeEnabled();
});

test('a refresh shorter than 300ms leaves the button alone, and a click meanwhile joins it', async ({ page }) => {
  const state = await mockServer(page);
  await page.clock.install();
  await page.goto('./servers/s1');
  await expect(stamp(page)).toContainText('갱신');
  // 시계를 멈춰서 300ms의 경계를 실제 시간과 무관하게 본다.
  await page.clock.pauseAt(Date.now() + 1_000);
  const initial = state.serverReads();
  const gate = deferred();
  state.holds.set('/servers', gate.promise);
  try {
    // 자동 갱신(화면이 다시 보일 때)의 요청이 진행 중이다.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(state.serverReads).toBe(initial + 1);
    await page.clock.runFor(299);
    await expect(refresh(page)).toBeEnabled();
    await expect(refresh(page)).not.toHaveAttribute('aria-busy', 'true');
    await page.clock.runFor(1);
    await expect(refresh(page)).toBeDisabled();
    await expect(refresh(page)).toHaveAttribute('aria-busy', 'true');
  } finally { state.holds.clear(); gate.resolve(); }
  await expect(refresh(page)).toBeEnabled();

  // 300ms 안에 직접 누르면 회전은 바로 보이지만 새 요청은 보내지 않고 진행 중인 요청에 합류한다.
  const second = deferred();
  state.holds.set('/servers', second.promise);
  try {
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(state.serverReads).toBe(initial + 2);
    await refresh(page).click();
    await expect(refresh(page)).toHaveAttribute('aria-busy', 'true');
    expect(state.serverReads()).toBe(initial + 2);
  } finally { state.holds.clear(); second.resolve(); }
});

test('a server list whose first load hangs past 30 seconds keeps the placeholder, not an empty list', async ({ page }) => {
  const state = await mockServer(page);
  const gate = deferred();
  state.holds.set('/servers', gate.promise);
  await page.clock.install();
  try {
    await page.goto('./servers');
    await expect(page.getByRole('status').filter({ hasText: '로딩 중' })).toBeAttached();
    await page.clock.fastForward(31_000);
    await expect(page.getByText('아직 서버가 없습니다')).toHaveCount(0);
    await expect(page.getByText(/^서버를 추가하고 업타임/)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: '로딩 중' })).toBeAttached();
  } finally { state.holds.clear(); gate.resolve(); }
  await expect(page.getByRole('table', { name: '서버 그리드' })).toBeVisible();
});

test('a deleted monitor is gone from the list even when the server list fails right after', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./servers/server-1/monitors/http-monitor');
  await expect(page.getByRole('heading', { level: 1, name: 'Public API' })).toBeVisible();
  state.failures.set('GET /servers', 500);
  await (await menuItem(page.locator('#main-content header').first(), '삭제')).click();
  await page.getByRole('dialog', { name: '업타임을 삭제할까요?' }).getByRole('button', { name: '삭제', exact: true }).click();
  // 업타임 목록으로 간다. 서버 화면은 서버 데이터를 새로 불러오므로, 서버 목록을 불러오지 못하면 서버가 없다고 하지 않고 다시 시도를 둔다.
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '서버를 불러오지 못했습니다' })).toBeVisible();
  state.failures.clear();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('table', { name: '업타임 그리드' }).locator('tbody a[data-row-link]')).toHaveText(['Database']);
  await expect(tablist(page).getByRole('tab', { name: /^업타임/ })).toHaveAccessibleName(/모니터 1개/);
});

test('detaching API requests while the server list fails closes the dialog and leaves the app without them', async ({ page }) => {
  const state = await mockServer(page);
  await page.goto('./servers/s1/apps/a1?tab=requests');
  await expect(page.getByRole('heading', { level: 1, name: 'orders-api' })).toBeVisible();
  state.failures.add('/servers');
  await (await menuItem(appHeader(page), /연결 해제$/)).click();
  await page.getByRole('dialog').getByRole('button', { name: /연결 해제$/ }).click();
  await expect.poll(() => state.app?.signals).toEqual(['logs']);
  await expect(page.getByText('앱 정보를 새로 불러오지 못했습니다')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // 해제한 데이터는 이전 정보에도 반영되어, 남은 로그 탭이 열리고 API 요청 탭은 연결 전이다.
  const tabs = page.getByRole('tablist', { name: '앱 데이터' });
  await expect(tabs.getByRole('tab', { selected: true })).toHaveText('로그');
  await expect(tabs.getByRole('tab', { name: /^API 요청/ })).toContainText('연결 전');
  await expect(page.getByRole('button', { name: '다시 시도', exact: true }).first()).toBeEnabled();
});

test('the server list shows when its data was last refreshed', async ({ page }) => {
  await mockServer(page);
  await page.goto('./servers');
  await expect(page.getByRole('table', { name: '서버 그리드' })).toBeVisible();
  await expect(stamp(page)).toContainText(/\d{2}:\d{2}:\d{2}.* 갱신$/);
  // 목록에는 자동 갱신 스위치를 두지 않는다(지시서 D는 서버 상세의 머리말이다).
  await expect(page.getByRole('switch', { name: '30초마다 자동 갱신' })).toHaveCount(0);
});

test('the delete dialog says the counts come from previously loaded targets', async ({ page }) => {
  const state = await mockServer(page);
  await page.goto('./servers/s1');
  await expect(stamp(page)).toContainText('갱신');
  state.failures.add('/observed-services');
  await refresh(page).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '서버 설정', exact: true }).click();
  await page.getByRole('button', { name: '서버 삭제', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'web-01 서버를 삭제할까요?' });
  await expect(dialog.getByRole('list', { name: '대상 개수' })).toContainText('앱 1개');
  await expect(dialog).toContainText('이전에 불러온 정보라서 지금과 다를 수 있습니다.');
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`the tab row stays put across tabs at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockServer(page);
    await page.goto('./servers/s1');
    await expect(stamp(page)).toContainText('갱신');
    const tops: number[] = [];
    for (const tab of ['개요', '업타임', '인프라', '로그', 'API 요청', '메트릭']) {
      await tablist(page).getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      // 앱 목록 탭(API 요청, 메트릭)은 제목 없는 표다. 본문이 그려진 것만 기다린다.
      await expect(panel(page).locator('*').first()).toBeVisible();
      tops.push((await tablist(page).boundingBox())!.y);
    }
    expect(new Set(tops.map(Math.round)).size).toBe(1);
    if (viewport.width < 1024) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}

test('no horizontal scroll at 320px with the refresh controls in the header', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await mockServer(page);
  await page.goto('./servers/s1/logs');
  await expect(stamp(page)).toContainText('갱신');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});

test('turning automatic refresh back on reloads the monitor page too and off stops its history polling', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  await page.goto('./servers/server-1/monitors/http-monitor');
  await expect(page.getByRole('heading', { level: 1, name: 'Public API' })).toBeVisible();
  const history = () => state.requests.filter((request) => request.method === 'GET' && request.path === '/services/http-monitor/metrics').length;
  const before = history();
  const auto = serverHeader(page).getByRole('switch', { name: '30초마다 자동 갱신' });
  await auto.click();
  await page.clock.fastForward(60_000);
  expect(history()).toBe(before);
  await auto.click();
  await expect.poll(history).toBe(before + 1);
});

test('choosing the selected tab again opens its first screen without the query', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime?q=Public&view=card');
  await expect(page.getByRole('textbox', { name: '모니터 검색' })).toHaveValue('Public');
  await tablist(page).getByRole('tab', { name: /^업타임/ }).click();
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime$/);
  await expect(page.getByRole('textbox', { name: '모니터 검색' })).toHaveValue('');
  await expect(page.getByRole('table', { name: '업타임 그리드' })).toBeVisible();
});

test('a server whose only monitors could not be refreshed says uptime is unverified, in the header, the list and the overview', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors[0].uptime = 99.5;
  await page.goto('./servers');
  const row = page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr').filter({ hasText: 'web-01' });
  await expect(row).toContainText('99.50%');
  state.failures.set('GET /services', 500);
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  // 이전 목록의 수치를 지금의 값처럼 보이지 않는다.
  await expect(row.getByText('불러오지 못함', { exact: true })).toHaveCount(1);
  await expect(row).toContainText('대기');
  await expect(row).toContainText('업타임 확인 불가');
  await row.getByRole('link', { name: 'web-01' }).click();
  await expect(serverHeader(page).getByText('업타임 확인 불가', { exact: true })).toBeVisible();
  await expect(serverHeader(page).getByRole('link', { name: '업타임 확인 불가' })).toHaveCount(0);
  // 개요에서는 업타임 탭이 확인 불가라고 말하고, 주요 지표에 이전 가용률을 지금 값처럼 두지 않는다.
  await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^업타임/ })).toContainText('확인 불가');
  await expect(panel(page).getByRole('region', { name: '주요 지표' }).filter({ hasText: '99.50' })).toHaveCount(0);
});

test('detaching logs after a traces detach whose reload failed deletes the app instead of turning traces back on', async ({ page }) => {
  const state = await mockServer(page);
  await page.goto('./servers/s1/apps/a1?tab=requests');
  await expect(page.getByRole('heading', { level: 1, name: 'orders-api' })).toBeVisible();
  // traces 연결을 해제한다. 그 뒤의 앱 목록 조회가 실패한다.
  state.failures.add('/observed-services');
  await (await menuItem(appHeader(page), /연결 해제$/)).click();
  await page.getByRole('dialog').getByRole('button', { name: /연결 해제$/ }).click();
  await expect.poll(() => state.app?.signals).toEqual(['logs']);
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  // 해제한 신호는 이전 목록에도 반영되어 확인 창이 처리 중으로 남지 않고, 남은 로그 탭이 열린다.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: '앱 데이터' }).getByRole('tab', { selected: true })).toHaveText('로그');

  const writes = state.writes.length;
  await (await menuItem(appHeader(page), /^(삭제|로그 연결 해제)$/)).click();
  const dialog = page.getByRole('dialog', { name: '이 앱을 삭제할까요?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect.poll(() => state.app).toBeNull();
  expect(state.writes.slice(writes).map((write) => `${write.method} ${write.path}`)).toEqual(['DELETE /observed-services/a1']);
  expect(state.writes.some((write) => write.method === 'PUT' && (write.body?.signals as string[] | undefined)?.includes('traces'))).toBe(false);
});

test('the removal dialog judges from the app as it is now, not as the screen last loaded it', async ({ page }) => {
  const state = await mockServer(page);
  await page.goto('./servers/s1/apps/a1?tab=logs');
  await expect(page.getByRole('heading', { level: 1, name: 'orders-api' })).toBeVisible();
  // 다른 곳에서 traces 연결이 해제되었고, 이 화면의 다시 불러오기는 실패한다. 화면의 앱은 [logs, traces]로 남는다.
  state.failures.add('/observed-services');
  state.app!.signals = ['logs'];
  await refresh(page).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await (await menuItem(appHeader(page), '로그 연결 해제')).click();
  const dialog = page.getByRole('dialog', { name: '이 앱을 삭제할까요?' });
  await expect(dialog).toBeVisible();
  // 확인 창을 연 뒤에 다시 바뀌면 실행하지 않고 바뀐 판정으로 다시 확인받는다.
  state.app!.signals = ['logs', 'metrics'];
  const writes = state.writes.length;
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '로그 연결을 해제할까요?' })).toBeVisible();
  expect(state.writes.length).toBe(writes);
  await page.getByRole('dialog').getByRole('button', { name: '로그 연결 해제', exact: true }).click();
  await expect.poll(() => state.app?.signals).toEqual(['metrics']);
});

test('a header refresh during a connection stop does not reload the infrastructure or app panel', async ({ page }) => {
  const state = await mockServer(page, { infrastructure: true });
  for (const [path, revoke, panelRequest] of [
    ['./servers/s1/infrastructure', 'POST /infrastructure-resources/r1/revoke-key', '/hosts/r1/system/metrics'],
    ['./servers/s1/apps/a1?tab=logs', 'POST /observed-services/a1/revoke-key', '/observed-services/a1/logs'],
  ] as const) {
    // 인프라는 패널의 상태 줄, 앱은 앱 페이지 머리말의 상태 줄에 연결 중지가 있다.
    const stop = page.locator('#main-content').getByRole('button', { name: '연결 중지' });
    await page.goto(path);
    await expect(stop).toBeVisible();
    await expect.poll(state.count(panelRequest)).toBeGreaterThan(0);
    const gate = deferred();
    state.holds.set(revoke, gate.promise);
    try {
      await stop.click();
      await page.getByRole('dialog').getByRole('button', { name: '연결 중지', exact: true }).click();
      await expect.poll(() => state.requests.filter((item) => item === revoke).length).toBe(1);
      const before = { panel: state.count(panelRequest)(), servers: state.serverReads() };
      // 확인 창은 모달이라 사람은 그동안 새로고침을 누를 수 없다. 화면의 새로고침 신호가 와도 패널이 무시하는지 이벤트로 확인한다.
      await refresh(page).dispatchEvent('click');
      await expect.poll(state.serverReads).toBe(before.servers + 1);
      await expect(refresh(page)).toBeEnabled();
      expect(state.count(panelRequest)()).toBe(before.panel);
    } finally { state.holds.clear(); gate.resolve(); }
  }
});

test('a server whose failing monitor could not be checked is not called healthy by its other targets', async ({ page }) => {
  const down = monitor('m1', { name: 'Checkout', serverId: 's1', status: 'unhealthy' });
  const state = await mockServer(page, { infrastructure: true, monitors: [down] });
  const row = page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr').filter({ hasText: 'web-01' });
  const statusCell = row.getByRole('cell').nth(1);
  await page.goto('./servers');
  await expect(statusCell).toContainText('장애');

  // 다시 불러오기만 실패: 이전 목록의 장애를 지금의 상태로 쓰지 않지만, 남은 인프라만으로 정상이라고 하지도 않는다.
  state.failures.add('/services');
  await refresh(page).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(statusCell).toHaveText('대기업타임 확인 불가');
  await expect(page.getByRole('group', { name: '상태로 거르기' }).getByRole('button', { name: /정상/ })).toContainText('0');

  // 서버 상세는 처음부터 실패한다. 머리말도 같은 판정이다.
  await row.getByRole('link', { name: 'web-01' }).click();
  await expect(serverHeader(page).getByText('업타임 확인 불가', { exact: true })).toBeVisible();
  await expect(serverHeader(page).getByText('정상', { exact: true })).toHaveCount(0);
  await expect(serverHeader(page).getByText('대기', { exact: true })).toBeVisible();

  // 조회가 회복되면 원래의 상태로 돌아온다.
  state.failures.clear();
  await page.goto('./servers/s1');
  await expect(serverHeader(page).getByText('장애', { exact: true })).toBeVisible();
  await expect(serverHeader(page).getByRole('link', { name: /Checkout 응답 없음/ })).toBeVisible();
});

test('a failed infrastructure refresh leaves the panel unverified, neither healthy nor delayed', async ({ page }) => {
  const state = await mockServer(page, { infrastructure: true });
  await page.clock.install();
  await page.goto('./servers/s1/infrastructure');
  const statusLine = panel(page).getByText('연결 중지', { exact: true }).locator('xpath=ancestor::div[1]');
  await expect(panel(page).getByText('정상', { exact: true })).toBeVisible();
  state.failures.add('/infrastructure-resources');
  await refresh(page).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(statusLine.getByText('확인 불가', { exact: true })).toBeVisible();
  await expect(panel(page).getByText('정상', { exact: true })).toHaveCount(0);
  // 실패한 것은 조회다. 시간이 지나도 이전 수신 시각으로 수집 지연이라고 하지 않는다.
  await page.clock.fastForward(150_000);
  await expect(statusLine.getByText('확인 불가', { exact: true })).toBeVisible();
  await expect(panel(page).getByText(/수집 지연|확인 필요/)).toHaveCount(0);
  await expect(panel(page).getByText(/^마지막 수집/)).toHaveCount(0);
  // 회복하면 지금의 상태로 돌아온다.
  state.failures.clear();
  await refresh(page).click();
  await expect(statusLine.getByText('확인 불가', { exact: true })).toHaveCount(0);
  await expect(panel(page).getByText(/^마지막 수집/)).toBeVisible();
});

test('a failed app refresh leaves the app lists and the app page unverified', async ({ page }) => {
  const second: ObservedService = { ...app, id: 'a2', name: 'billing-api', signals: ['logs', 'traces', 'metrics'] };
  const state = await mockServer(page, { apps: [second] });
  await page.goto('./servers/s1/api');
  await expect(appRows(page, 'API 요청 앱')).toHaveCount(2);
  await expect(appRows(page, 'API 요청 앱').first()).not.toContainText('확인 불가');
  state.failures.add('/observed-services');
  await refresh(page).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  for (const name of ['orders-api', 'billing-api']) {
    await expect(appRows(page, 'API 요청 앱').filter({ hasText: name })).toContainText('확인 불가');
  }
  await tablist(page).getByRole('tab', { name: /^메트릭/ }).click();
  await expect(appRows(page, '메트릭 앱').filter({ hasText: 'billing-api' })).toContainText('확인 불가');

  // 앱 페이지는 서버 데이터를 새로 불러온다. 처음부터 실패하면 앱이 없다고 하지 않고 불러오지 못했다고 한다.
  await tablist(page).getByRole('tab', { name: /^로그/ }).click();
  await page.getByRole('table', { name: '앱 그리드' }).getByRole('link', { name: 'orders-api' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '앱 정보를 불러오지 못했습니다' })).toBeVisible();
  state.failures.clear();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'orders-api' })).toBeVisible();
  // 앱 페이지에서 다시 불러오다 실패하면 이전 앱을 두고, 머리말의 상태는 확인 불가이며 마지막 수집 시각을 숨긴다.
  state.failures.add('/observed-services');
  await refresh(page).click();
  await expect(page.getByText('일부 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  const statusLine = appHeader(page).getByText('연결 중지', { exact: true }).locator('xpath=ancestor::div[1]');
  await expect(statusLine.getByText('확인 불가', { exact: true })).toBeVisible();
  await expect(appHeader(page).getByText('수집 중', { exact: true })).toHaveCount(0);
  await expect(appHeader(page).getByText(/^마지막 수집/)).toHaveCount(0);
});

test('the metrics panel of an app over a threshold says so, like its tab', async ({ page }) => {
  const fresh = new Date().toISOString();
  await mockServer(page, {
    signals: ['metrics'],
    catalog: [{ serviceId: 'a1', metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', lastAt: fresh, lastReceivedAt: fresh, breached: true }],
  });
  await page.goto('./servers/s1/metrics');
  await expect(tablist(page).getByRole('tab', { name: /^메트릭/ }).getByRole('img', { name: '임계값 초과' })).toBeVisible();
  await expect(appRows(page, '메트릭 앱').filter({ hasText: 'orders-api' })).toContainText('임계값 초과');
  await page.getByRole('table', { name: '메트릭 앱' }).getByRole('link', { name: 'orders-api' }).click();
  // 앱 페이지의 상태 줄과 메트릭 탭도 같은 판정이다.
  const statusLine = appHeader(page).getByText('연결 중지', { exact: true }).locator('xpath=ancestor::div[1]');
  await expect(statusLine.getByText('임계값 초과', { exact: true })).toBeVisible();
  await expect(statusLine.getByText('수집 중', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: '앱 데이터' }).getByRole('tab', { name: /^메트릭/ }).getByRole('img', { name: '임계값 초과' })).toBeVisible();
});

test('only the screens that show error log counts ask for the log summary', async ({ page }) => {
  const state = await mockServer(page);
  const summaries = state.count('/logs/summary');
  // 개요는 요약 띠의 에러 로그를, 서버 목록은 서버별 오류 로그 수를 보인다.
  expect(summaries()).toBe(0);
  await page.goto('./');
  await expect.poll(summaries).toBe(1);
  await page.goto('./servers');
  await expect(page.getByRole('table', { name: '서버 그리드' })).toBeVisible();
  await expect.poll(summaries).toBe(2);
});

test.describe('with an English browser', () => {
  test.use({ locale: 'en-US' });

  test('trace and log times use the 24-hour clock of the rest of the screen', async ({ page }) => {
    await mockServer(page);
    const afternoon = new Date();
    afternoon.setHours(15, 21, 53, 0);
    const startTime = afternoon.toISOString();
    // mockServer보다 나중에 건 가로채기가 먼저 걸린다.
    await page.route('**/api/v1/observed-services/a1/traces*', (route) => route.fulfill({ json: { success: true, data: [
      { traceId: 't1', name: 'GET /orders', kind: 'SERVER', startTime, durationMs: 12, spanCount: 1, errorCount: 0 },
    ] } }));
    await page.route('**/api/v1/observed-services/a1/logs*', (route) => route.fulfill({ json: { success: true, data: {
      data: [{ id: 1, serviceId: 'a1', level: 'error', message: 'order failed', createdAt: startTime }], total: 1,
    } } }));
    const twelveHour = /AM|PM|오전|오후/;
    await page.goto('./servers/s1/apps/a1?tab=traces');
    const trace = panel(page).getByRole('button', { name: /GET \/orders/ }).or(panel(page).getByRole('row', { name: /GET \/orders/ })).first();
    await expect(trace).toBeVisible();
    await expect(trace).toContainText('15:21:53');
    await expect(trace).not.toContainText(twelveHour);
    await page.goto('./servers/s1/apps/a1?tab=logs');
    const log = panel(page).locator('div', { has: page.getByText('order failed', { exact: true }) }).last().locator('time');
    await expect(log).toContainText('15:21:53');
    await expect(log).not.toContainText(twelveHour);
  });
});

test('a rotated key stays on screen through a reload of the server data until closed', async ({ page }) => {
  const state = await mockServer(page, { infrastructure: true });
  // 앱 페이지는 넓은 화면에서 연결 정보를 펼쳐 둔다(대상 상세의 머리말). 서버의 인프라 탭은 접어 둔다.
  for (const [path, key, folded] of [['./servers/s1/apps/a1?tab=logs', 'evup_rotated_app_key', false], ['./servers/s1/infrastructure', 'evup_rotated_infra_key', true]] as const) {
    await page.goto(path);
    if (folded) await panel(page).locator('summary', { hasText: '연결 정보' }).click();
    await page.locator('#main-content').getByRole('button', { name: '키 재발급' }).click();
    await page.getByRole('dialog', { name: 'API Key를 재발급할까요?' }).getByRole('button', { name: '재발급', exact: true }).click();
    const shown = page.getByRole('dialog', { name: 'API Key 재발급' });
    await expect(shown.getByText(key, { exact: true })).toBeVisible();
    // 화면이 다시 보이면 서버 데이터를 다시 불러온다. 한 번만 보이는 키는 그대로 남는다.
    const reads = state.serverReads();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(state.serverReads).toBeGreaterThan(reads);
    await expect(refresh(page)).toBeEnabled();
    await expect(shown.getByText(key, { exact: true })).toBeVisible();
    await shown.getByRole('button', { name: '닫기' }).first().click();
    await expect(shown).toHaveCount(0);
  }
});

test('the header refresh reloads the open infrastructure trends and app logs', async ({ page }) => {
  const state = await mockServer(page, { infrastructure: true });
  for (const [path, panelRequest] of [['./servers/s1/infrastructure', '/hosts/r1/system/metrics'], ['./servers/s1/logs/a1', '/observed-services/a1/logs']] as const) {
    await page.goto(path);
    await expect.poll(state.count(panelRequest)).toBeGreaterThan(0);
    await expect(refresh(page)).toBeEnabled();
    const before = state.count(panelRequest)();
    await refresh(page).click();
    await expect.poll(state.count(panelRequest)).toBe(before + 1);
  }
});
