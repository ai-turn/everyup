import { expect, test } from '@playwright/test';
import { dockerService, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('[04] direct detail and browser back preserve the searched list', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./uptime');
  const search = page.getByRole('textbox', { name: '서비스 또는 대상 검색' });
  await search.fill('Public');
  await page.getByRole('link', { name: 'Public API', exact: true }).click();
  await expect(page).toHaveURL(/\/uptime\/http-monitor$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Public API' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('업타임');
  await page.goBack();
  await expect(search).toHaveValue('Public');
  await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveText(['Public API']);
  await page.goForward();
  await page.getByRole('navigation', { name: '현재 위치' }).getByRole('link', { name: '업타임', exact: true }).click();
  await expect(search).toHaveValue('Public');
});

for (const key of ['shop:api', 'worker%ready', 'svc%2Fraw', '주문 서비스']) {
  test(`[04] Docker key ${key} survives navigation and a deep reload`, async ({ page }) => {
    const state = await uptimeFixture(page);
    state.services = [dockerService({ key })];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./uptime');
    await page.getByRole('link', { name: 'Docker API', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Docker API', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: '업타임', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Docker API', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('[04] mobile direct detail provides a return to the uptime list', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await uptimeFixture(page);
  await page.goto('./uptime/http-monitor');
  await expect(page.getByRole('heading', { level: 1, name: 'Public API' })).toBeVisible();
  await page.locator('main').getByRole('link', { name: '업타임', exact: true }).click();
  await expect(page).toHaveURL(/\/uptime$/);
  await expect(page.getByRole('heading', { level: 1, name: '업타임', exact: true })).toBeVisible();
});

test('[04] mobile return retains the searched list context', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await uptimeFixture(page);
  await page.goto('./uptime');
  await page.getByRole('textbox', { name: '서비스 또는 대상 검색' }).fill('Database');
  await page.getByRole('link', { name: 'Database', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Database', exact: true })).toBeVisible();
  await page.locator('main').getByRole('link', { name: '업타임', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '서비스 또는 대상 검색' })).toHaveValue('Database');
});
