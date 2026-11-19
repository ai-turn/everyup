import { expect, test } from '@playwright/test';

// Capability menus leave Docker data to its Docker Environment (ADR 0007), so the
// environment detail must carry the host metrics and log summary on its own.
// Like the server detail, each capability is a tab whose address can be reopened.
test.describe('docker environment detail', () => {
  test('tabs hold the services, host metrics, the 24-hour log summary and requests', async ({ page }) => {
    await page.goto('./agents/agent_demo_01');
    const tabs = page.getByRole('tablist', { name: 'Docker 환경 기능' });
    await expect(tabs.getByRole('tab')).toHaveText(['개요', '인프라', '로그', 'API 요청']);
    await expect(tabs.getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'true');
    // 서비스 목록은 개요에 있다.
    await expect(page.getByRole('heading', { name: '서비스', exact: true })).toBeVisible();

    await tabs.getByRole('tab', { name: '인프라' }).click();
    await expect(page).toHaveURL(/\/agents\/agent_demo_01\/infrastructure$/);
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('CPU')).toBeVisible();
    await expect(panel.getByText('디스크', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '서비스', exact: true })).toHaveCount(0);

    await tabs.getByRole('tab', { name: '로그' }).click();
    const logs = page.locator('section', { has: page.getByRole('heading', { name: '로그', exact: true }) });
    await expect(logs.getByRole('link').first()).toHaveText('payment-worker');

    // 뒤로 가기는 이전 탭으로 돌아간다.
    await page.goBack();
    await expect(tabs.getByRole('tab', { name: '인프라' })).toHaveAttribute('aria-selected', 'true');
    await page.goForward();

    await page.getByRole('link', { name: /Payment gateway timeout after 5000ms.*24회/ }).click();
    await expect(page).toHaveURL(/\/services\/agent_demo_01\/shop%3Apayment-worker\?tab=logs&range=24h&pattern=/);
    await expect(page.getByRole('button', { name: '같은 패턴만' })).toBeVisible();
  });

  test('an unknown tab address opens the overview', async ({ page }) => {
    await page.goto('./agents/agent_demo_01/nope');
    await expect(page).toHaveURL(/\/agents\/agent_demo_01$/);
    await expect(page.getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'true');
  });
});
