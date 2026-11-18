import { expect, test, type Page } from '@playwright/test';
import { deferred, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });
const panel = (page: Page) => page.getByRole('tabpanel');

test('[09] initial loading, 404 and server failure have distinct recovery paths', async ({ page }) => {
  const state = await uptimeFixture(page);
  const gate = deferred();
  state.holds.set('GET /services/http-monitor', gate.promise);
  state.failures.set('GET /services/http-monitor', 500);
  try {
    await page.goto('./servers/server-1/uptime/http-monitor');
    await expect(page.getByText('불러오는 중', { exact: true })).toBeVisible();
    gate.resolve(); state.holds.clear();
    await expect(page.getByText('업타임 모니터를 불러오지 못했습니다', { exact: true })).toBeVisible();
    await expect(page.getByText('업타임 모니터를 찾을 수 없습니다', { exact: true })).toHaveCount(0);
    state.failures.clear();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
    // 서버 화면에서 없는 모니터는 "이 서버의 모니터가 아닙니다"이고, 탭의 첫 화면으로 돌아가는 길이 있다.
    await page.goto('./servers/server-1/uptime/missing');
    await expect(panel(page).getByText('이 서버의 모니터가 아닙니다', { exact: true })).toBeVisible();
    await expect(page.getByText('업타임 모니터를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
    await expect(panel(page).getByRole('link', { name: '업타임 탭으로' })).toBeVisible();
  } finally { gate.resolve(); }
});

// 서버 데이터에는 있는 모니터인데 그 모니터의 상세 요청만 404이면 패널 자체의 "찾을 수 없음" 화면이다.
test('[09] a monitor listed by the server but missing on its own request shows the panel not-found screen', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.failures.set('GET /services/http-monitor', 404);
  await page.goto('./servers/server-1/uptime/http-monitor');
  await expect(panel(page).getByText('업타임 모니터를 찾을 수 없습니다', { exact: true })).toBeVisible();
  await expect(panel(page).getByText('업타임 모니터를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
  await expect(panel(page).getByText('이 서버의 모니터가 아닙니다', { exact: true })).toHaveCount(0);
  // 모니터가 둘이라 복귀 링크는 탭의 목록으로 간다.
  await panel(page).getByRole('link', { name: '업타임 탭으로', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime$/);
  await expect(page.getByRole('table', { name: '업타임 그리드' })).toBeVisible();
});

for (const [path, label] of [['/metrics', '최근 체크'], ['/metrics/summary', '30일 요약'], ['/uptime', '90일 이력'], ['/failures', '장애 이력']]) {
  test(`[09] independent failure of ${label} retains monitor and other successful sections`, async ({ page }) => {
    const state = await uptimeFixture(page);
    state.failures.set(`GET /services/http-monitor${path}`, 500);
    await page.goto('./servers/server-1/uptime/http-monitor');
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
  await page.goto('./servers/server-1/uptime/http-monitor');
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
    await page.goto('./servers/server-1/uptime/tcp-monitor');
    await expect(page.getByRole('heading', { name: 'Database', exact: true })).toBeVisible();
    await panel(page).getByRole('link', { name: '모니터 목록', exact: true }).click();
    await page.getByRole('link', { name: 'Public API', exact: true }).click();
    await expect(page.getByText('불러오는 중', { exact: true })).toBeVisible();
    await page.goBack();
    await page.getByRole('link', { name: 'Database', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Database', exact: true })).toBeVisible();
    gate.resolve();
    await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toHaveCount(0);
  } finally { gate.resolve(); }
});
