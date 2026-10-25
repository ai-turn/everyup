import { expect, test } from '@playwright/test';

test.describe('logs page', () => {
  test('lists directly connected services only and a recurring error opens its own logs', async ({ page }) => {
    await page.goto('./logs?view=card');

    const cards = page.locator('section', { has: page.getByRole('heading', { name: '로그 서비스' }) }).getByRole('link');
    await expect(cards.first()).toContainText('checkout-api');
    await expect(cards.first()).toContainText('Connection timeout to upstream service: auth.internal:8080 after 5000ms');
    // Docker Collector logs stay in their Docker Environment (ADR 0007).
    await expect(cards.filter({ hasText: 'payment-worker' })).toHaveCount(0);

    await page.getByRole('link', { name: /Connection timeout to upstream service.*3회/ }).click();
    await expect(page).toHaveURL(/\/logs\/observed_mock_checkout\?range=24h&pattern=/);
    await expect(page.getByRole('button', { name: '같은 패턴만' })).toBeVisible();

    await page.getByRole('button', { name: '같은 패턴만' }).click();
    await expect(page).not.toHaveURL(/pattern=/);
  });
});
