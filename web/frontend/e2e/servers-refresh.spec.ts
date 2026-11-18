import { expect, test, type Page } from '@playwright/test';
import type { ObservedService, Server } from '../src/services/api';
import { deferred } from './fixtures/uptime';

// 서버 데이터의 갱신: 갱신 시각, 자동 갱신 스위치, 겹치는 요청, 다시 불러오기에 실패한 종류의 이전 목록 유지(Task 11b).
test.use({ baseURL: 'http://127.0.0.1:4174/', viewport: { width: 1440, height: 1000 } });

const at = '2026-11-01T00:00:00Z';
const server: Server = { id: 's1', name: 'web-01', createdAt: at, updatedAt: at };
const app: ObservedService = { id: 'a1', name: 'orders-api', serverId: 's1', signals: ['logs', 'traces'], isActive: true, lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at };

const panel = (page: Page) => page.getByRole('tabpanel');
const tablist = (page: Page) => page.getByRole('tablist', { name: '서버 기능' });
const serverHeader = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
const stamp = (page: Page) => page.getByRole('group', { name: '서버 데이터 갱신' }).locator('> p');
const refresh = (page: Page) => page.getByRole('button', { name: '새로고침', exact: true });

async function mockServer(page: Page) {
  const state = {
    failures: new Set<string>(),
    holds: new Map<string, Promise<void>>(),
    requests: [] as string[],
  };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    state.requests.push(path);
    await state.holds.get(path);
    if (state.failures.has(path)) {
      await route.fulfill({ status: 500, json: { success: false, error: { code: 'DATABASE_ERROR', message: 'Fixture request failed' } } });
      return;
    }
    // 앱 패널(로그, API 요청)이 부르는 객체 응답. 나머지는 빈 목록이다.
    const data = path === '/servers' ? [server] : path === '/observed-services' ? [app]
      : path.endsWith('/request-stats') ? { buckets: [], truncated: false }
        : path.endsWith('/request-endpoints') ? { endpoints: [], truncated: false }
          : path.endsWith('/request-status-summary') ? { count2xx: 0, count3xx: 0, count4xx: 0, count5xx: 0, countOther: 0 }
            : path.endsWith('/requests') || path.endsWith('/logs') ? { data: [], total: 0 }
              : path.endsWith('/log-filter') ? { levels: ['error', 'warn', 'info'] }
                : path.endsWith('/api-exclusions') ? { paths: [] } : [];
    await route.fulfill({ json: { success: true, data } });
  });
  return { ...state, serverReads: () => state.requests.filter((path) => path === '/servers').length };
}

test('a failed app refresh keeps the log app list and the API panel but marks them unverified', async ({ page }) => {
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

  await tablist(page).getByRole('tab', { name: /^API 요청/ }).click();
  await expect(panel(page).getByRole('heading', { level: 2, name: 'orders-api' })).toBeVisible();

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
  const auto = serverHeader(page).getByRole('switch', { name: '30초마다 자동 갱신' });
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
    await page.clock.fastForward(90_000);
    expect(state.serverReads()).toBe(initial + 1);
  } finally { state.holds.clear(); gate.resolve(); }
  await expect(refresh(page)).toBeEnabled();
  await page.clock.fastForward(30_000);
  await expect.poll(state.serverReads).toBe(initial + 2);
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
      await expect(panel(page).getByRole('heading').first()).toBeVisible();
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
