import { expect, test } from '@playwright/test';
import { deferred, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('[09] initial loading, 404 and server failure have distinct recovery paths', async ({ page }) => {
  const state = await uptimeFixture(page);
  const gate = deferred();
  state.holds.set('GET /services/http-monitor', gate.promise);
  state.failures.set('GET /services/http-monitor', 500);
  try {
    await page.goto('./uptime/http-monitor');
    await expect(page.getByText('불러오는 중', { exact: true })).toBeVisible();
    gate.resolve(); state.holds.clear();
    await expect(page.getByText('업타임 모니터를 불러오지 못했습니다', { exact: true })).toBeVisible();
    await expect(page.getByText('업타임 모니터를 찾을 수 없습니다', { exact: true })).toHaveCount(0);
    state.failures.clear();
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
    await page.goto('./uptime/missing');
    await expect(page.getByText('업타임 모니터를 찾을 수 없습니다', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '업타임으로 돌아가기' })).toBeVisible();
  } finally { gate.resolve(); }
});

for (const [path, label] of [['/metrics', '최근 체크'], ['/metrics/summary', '30일 요약'], ['/uptime', '90일 이력'], ['/failures', '장애 이력']]) {
  test(`[09] independent failure of ${label} retains monitor and other successful sections`, async ({ page }) => {
    const state = await uptimeFixture(page);
    state.failures.set(`GET /services/http-monitor${path}`, 500);
    await page.goto('./uptime/http-monitor');
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
  await page.goto('./uptime/http-monitor');
  await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toBeVisible();
  const gate = deferred();
  state.holds.set('GET /services/http-monitor', gate.promise);
  for (const path of ['', '/metrics', '/metrics/summary', '/uptime']) state.failures.set(`GET /services/http-monitor${path}`, 500);
  try {
    const refresh = page.getByRole('button', { name: '새로고침', exact: true });
    await refresh.click();
    await expect(refresh).toHaveAttribute('aria-busy', 'true');
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
    await page.goto('./uptime/tcp-monitor');
    await expect(page.getByRole('heading', { name: 'Database', exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: '현재 위치' }).getByRole('link', { name: '업타임', exact: true }).click();
    await page.getByRole('link', { name: 'Public API', exact: true }).click();
    await expect(page.getByText('불러오는 중', { exact: true })).toBeVisible();
    await page.goBack();
    await page.getByRole('link', { name: 'Database', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Database', exact: true })).toBeVisible();
    gate.resolve();
    await expect(page.getByRole('heading', { name: 'Public API', exact: true })).toHaveCount(0);
  } finally { gate.resolve(); }
});
