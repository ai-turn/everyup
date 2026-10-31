import { expect, test } from '@playwright/test';

// Capability menus leave Docker data to its Docker Environment (ADR 0007), so the
// environment detail must carry the host metrics and log summary on its own.
test.describe('docker environment detail', () => {
  test('shows host metrics and the 24-hour log summary of its services', async ({ page }) => {
    await page.goto('./agents/agent_demo_01');

    const infra = page.locator('section', { has: page.getByRole('heading', { name: '인프라', exact: true }) });
    await expect(infra.getByText('CPU')).toBeVisible();
    await expect(infra.getByText('디스크', { exact: true })).toBeVisible();

    const logs = page.locator('section', { has: page.getByRole('heading', { name: '로그', exact: true }) });
    await expect(logs.getByRole('link').first()).toHaveText('payment-worker');

    await page.getByRole('link', { name: /Payment gateway timeout after 5000ms.*24회/ }).click();
    await expect(page).toHaveURL(/\/services\/agent_demo_01\/shop%3Apayment-worker\?tab=logs&range=24h&pattern=/);
    await expect(page.getByRole('button', { name: '같은 패턴만' })).toBeVisible();
  });
});
