import { expect, test } from '@playwright/test';

test.describe('shared tabs', () => {
  test('arrow, Home and End keys move focus and selection', async ({ page }) => {
    await page.goto('./services/agent_demo_01/shop%3Aapi');
    const tabs = page.getByRole('tablist', { name: '서비스 데이터' }).getByRole('tab');
    await expect(tabs).toHaveCount(6);
    const last = tabs.nth(5);

    await tabs.first().click();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('End');
    await expect(last).toHaveAttribute('aria-selected', 'true');
    await expect(last).toBeFocused();

    // 끝에서 오른쪽으로 가면 처음으로 돌아간다.
    await page.keyboard.press('ArrowRight');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowLeft');
    await expect(last).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Home');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.first()).toBeFocused();
  });

  test('only the selected tab is in the tab order', async ({ page }) => {
    await page.goto('./services/agent_demo_01/shop%3Aapi');
    const tabs = page.getByRole('tablist', { name: '서비스 데이터' }).getByRole('tab');
    await tabs.nth(2).click();

    await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0');
    for (const index of [0, 1, 3, 4, 5]) {
      await expect(tabs.nth(index)).toHaveAttribute('tabindex', '-1');
    }
    // 패널은 선택된 탭과 연결된다.
    const panelId = await tabs.nth(2).getAttribute('aria-controls');
    await expect(page.locator(`[id="${panelId}"]`)).toHaveAttribute('role', 'tabpanel');
  });
});
