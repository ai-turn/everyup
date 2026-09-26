import { expect, test } from '@playwright/test';

test('uptime response time shows one result cell and bar per check', async ({ page }) => {
  await page.goto('./uptime/uptime_mock_store');
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: '응답 시간', exact: true }) });
  await expect(card.getByText('체크 72회 · 최근 36시간 · ms')).toBeVisible();
  // Two failed checks: red result cells and baseline stubs, not bars as tall as their timeout.
  await expect(card.locator('.bg-status-error')).toHaveCount(4);
  const summary = card.locator('p[aria-live]');
  await expect(summary).toContainText('평균 116 ms');
  await expect(summary).toContainText('실패 2회');

  // The arrow keys walk the checks and the summary line names the one in focus.
  await card.getByRole('group', { name: /체크별 결과와 응답 시간/ }).press('ArrowLeft');
  await expect(summary).toContainText('114ms · HTTP 200');

  await expect(page.getByRole('heading', { name: '체크 기록', exact: true })).toBeVisible();
});
