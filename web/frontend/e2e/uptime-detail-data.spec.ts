import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { deferred, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: API_URL });
// 모니터는 자기 페이지가 있다(대상 상세). 탭 패널이 없으므로 본문 전체를 범위로 쓴다.
const panel = (page: Page) => page.locator('#main-content');

test('[09] initial loading, 404 and server failure have distinct recovery paths', async ({ page }) => {
  const state = await uptimeFixture(page);
  const gate = deferred();
  state.holds.set('GET /services/http-monitor', gate.promise);
  state.failures.set('GET /services/http-monitor', 500);
  try {
    await page.goto('./servers/server-1/monitors/http-monitor');
    await expect(page.getByText('불러오는 중', { exact: true })).toBeVisible();
    gate.resolve(); state.holds.clear();
    await expect(page.getByText('업타임 모니터를 불러오지 못했습니다', { exact: true })).toBeVisible();
    await expect(page.getByText('업타임 모니터를 찾을 수 없습니다', { exact: true })).toHaveCount(0);
    state.failures.clear();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
    // 서버에 없는 모니터는 "이 서버의 모니터가 아닙니다"이고, 그 서버로 돌아가는 길이 있다.
    await page.goto('./servers/server-1/monitors/missing');
    await expect(page.getByRole('heading', { level: 1, name: '이 서버의 모니터가 아닙니다' })).toBeVisible();
    await expect(page.getByText('업타임 모니터를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'web-01 서버로' })).toBeVisible();
  } finally { gate.resolve(); }
});

// 서버 데이터에는 있는 모니터인데 그 모니터의 상세 요청만 404이면 모니터 페이지의 "찾을 수 없음" 화면이다.
test('[09] a monitor listed by the server but missing on its own request shows the page not-found screen', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.failures.set('GET /services/http-monitor', 404);
  await page.goto('./servers/server-1/monitors/http-monitor');
  await expect(panel(page).getByText('업타임 모니터를 찾을 수 없습니다', { exact: true })).toBeVisible();
  await expect(panel(page).getByText('업타임 모니터를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
  await expect(panel(page).getByText('이 서버의 모니터가 아닙니다', { exact: true })).toHaveCount(0);
  // 그 서버로 돌아가는 길이 있다.
  await panel(page).getByRole('link', { name: 'web-01 서버로', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server-1$/);
});

for (const [path, label] of [['/metrics', '최근 체크'], ['/metrics/summary', '30일 요약'], ['/uptime', '90일 이력'], ['/failures', '장애 이력']]) {
  test(`[09] independent failure of ${label} retains monitor and other successful sections`, async ({ page }) => {
    const state = await uptimeFixture(page);
    state.failures.set(`GET /services/http-monitor${path}`, 500);
    await page.goto('./servers/server-1/monitors/http-monitor');
    await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(label);
    if (path !== '/failures') await expect(page.getByRole('heading', { name: '장애 이력', exact: true })).toBeVisible();
    state.failures.clear();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '장애 이력', exact: true })).toBeVisible();
  });
}

test('[09] a failed refresh keeps labelled prior data and disables mutations on unknown monitor state', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./servers/server-1/monitors/http-monitor');
  await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
  const gate = deferred();
  state.holds.set('GET /services/http-monitor', gate.promise);
  for (const path of ['', '/metrics', '/metrics/summary', '/uptime']) state.failures.set(`GET /services/http-monitor${path}`, 500);
  try {
    // 새로고침은 서버 머리말에 하나다. 패널이 다시 불러오는 동안 이전 정보를 그대로 두고 변경 조작만 막는다.
    await page.getByRole('button', { name: '새로고침', exact: true }).click();
    await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
    gate.resolve(); state.holds.clear();
    await expect(page.getByRole('alert')).toContainText('이전에 불러온');
    await expect(page.getByRole('heading', { name: '장애 이력', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '수정', exact: true })).toBeDisabled();
    state.failures.clear();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeEnabled();
  } finally { gate.resolve(); }
});

test('[09] switching monitor ids does not retain another monitor or late response', async ({ page }) => {
  const state = await uptimeFixture(page);
  const gate = deferred();
  state.holds.set('GET /services/http-monitor', gate.promise);
  try {
    await page.goto('./servers/server-1/monitors/tcp-monitor');
    await expect(page.getByRole('heading', { name: 'Database', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '모니터 목록', exact: true }).click();
    await page.getByRole('link', { name: 'Public API', exact: true }).click();
    await expect(page.getByText('불러오는 중', { exact: true })).toBeVisible();
    await page.goBack();
    await page.getByRole('link', { name: 'Database', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Database', exact: true })).toBeVisible();
    gate.resolve();
    await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toHaveCount(0);
  } finally { gate.resolve(); }
});
