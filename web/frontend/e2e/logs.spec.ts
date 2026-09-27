import { expect, test } from '@playwright/test';

test.describe('logs page', () => {
  test('cards lead with the noisiest service and a recurring error opens its own logs', async ({ page }) => {
    await page.goto('./logs');

    // Sorted by error count, so the failing worker comes first.
    const cards = page.locator('section', { has: page.getByRole('heading', { name: '로그 서비스' }) }).getByRole('link');
    await expect(cards.first()).toContainText('payment-worker');
    await expect(cards.first()).toContainText('Payment gateway timeout after 5000ms');
    // A service that went quiet says so instead of reading as zero errors.
    await expect(cards.filter({ hasText: 'postgres' })).toContainText('수집 지연');

    await page.getByRole('link', { name: /Payment gateway timeout after 5000ms.*24회/ }).click();
    await expect(page).toHaveURL(/\/services\/agent_demo_01\/shop%3Apayment-worker\?tab=logs&range=24h&pattern=/);
    // The router keeps the old page up while the route loads, and it quotes the
    // same message three times — wait for the destination before reading text.
    await expect(page.getByRole('button', { name: '같은 패턴만' })).toBeVisible();
    await expect(page.getByText('Payment gateway timeout after 5000ms')).toBeVisible();
    await expect(page.getByText('Rate limit exceeded', { exact: false })).toHaveCount(0);

    await page.getByRole('button', { name: '같은 패턴만' }).click();
    await expect(page).not.toHaveURL(/pattern=/);
    await expect(page.getByText('Rate limit exceeded', { exact: false })).toBeVisible();
  });
});
