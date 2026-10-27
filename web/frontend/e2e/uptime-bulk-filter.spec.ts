import { expect, test } from '@playwright/test';
import { monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

async function threeMonitors(page: import('@playwright/test').Page) {
  const state = await uptimeFixture(page);
  state.monitors = [
    monitor('up-monitor', { name: 'Up API' }),
    monitor('down-monitor', { name: 'Down API', status: 'unhealthy' }),
    monitor('paused-monitor', { name: 'Paused API', isActive: false, status: 'unknown' }),
  ];
  return state;
}

const rowNames = (page: import('@playwright/test').Page) =>
  page.getByRole('table', { name: '업타임 그리드' }).locator('tbody a[data-row-link]');

test('summary counts filter the list by state and keep it in the URL', async ({ page }) => {
  await threeMonitors(page);
  await page.goto('./uptime');
  const down = page.getByRole('group', { name: '상태로 거르기' }).getByRole('button', { name: /장애/ });
  await down.click();
  await expect(down).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/status=down/);
  await expect(rowNames(page)).toHaveText(['Down API']);
  await page.reload();
  await expect(rowNames(page)).toHaveText(['Down API']);
  await down.click();
  await expect(rowNames(page)).toHaveCount(3);
  await expect(page).not.toHaveURL(/status=/);
});

test('bulk pause only touches selected active monitors', async ({ page }) => {
  const state = await threeMonitors(page);
  await page.goto('./uptime');
  await page.getByRole('checkbox', { name: 'Up API 선택' }).check();
  await page.getByRole('checkbox', { name: 'Paused API 선택' }).check();
  const bar = page.getByRole('region', { name: '선택한 대상 작업' });
  await expect(bar).toContainText('2개 선택');
  await bar.getByRole('button', { name: '일시정지' }).click();
  await expect(bar).toHaveCount(0);
  const puts = state.requests.filter((request) => request.method === 'PUT');
  expect(puts.map((request) => [request.path, request.body?.isActive])).toEqual([['/services/up-monitor', false]]);
});

test('select all + delete confirms, deletes every visible monitor and nothing hidden by a filter', async ({ page }) => {
  const state = await threeMonitors(page);
  await page.goto('./uptime');
  await page.getByRole('checkbox', { name: 'Paused API 선택' }).check();
  // Filtered out of view → dropped from the bulk selection.
  await page.getByRole('group', { name: '상태로 거르기' }).getByRole('button', { name: /장애/ }).click();
  await expect(page.getByRole('region', { name: '선택한 대상 작업' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: '보이는 대상 모두 선택' }).check();
  await page.getByRole('region', { name: '선택한 대상 작업' }).getByRole('button', { name: '삭제' }).click();
  const dialog = page.getByRole('dialog', { name: '업타임 1개를 삭제할까요?' });
  await expect(dialog).toContainText('Down API');
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect.poll(() => state.requests.filter((request) => request.method === 'DELETE').map((request) => request.path)).toEqual(['/services/down-monitor']);
});
