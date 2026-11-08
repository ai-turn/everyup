import { expect, test } from '@playwright/test';

test('uptime response chart shows realistic samples, an outage and keyboard tooltips', async ({ page }) => {
  await page.goto('./uptime/uptime_mock_store');
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: '응답 시간', exact: true }) });
  await expect(card.getByRole('button', { name: '6H', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('.recharts-line-curve')).toBeVisible();
  await expect(card.locator('.response-outage')).toHaveCount(1);
  await expect(card.locator('[data-response-counts]')).toContainText('실패 17회');
  await expect(card.locator('[data-response-average]')).toContainText('ms');
  const plot = card.getByRole('application', { name: /응답 시간 추이/ });
  await plot.focus(); await plot.press('ArrowRight');
  await expect(card.locator('[data-response-tooltip]')).toContainText('평균 응답');
  await expect(page.getByRole('heading', { name: '장애 이력', exact: true })).toBeVisible();
});
