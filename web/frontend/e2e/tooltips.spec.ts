import { expect, test } from '@playwright/test';

test.describe('shared tooltip interactions', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174/' });
  test.beforeEach(async ({ page }) => { await page.goto('/e2e/fixtures/tooltips.html'); });

  test('hover is delayed, remains hoverable and Escape dismisses without moving focus', async ({ page }) => {
    const trigger = page.getByRole('button', { name: '액션 0', exact: true });
    const hint = page.getByRole('tooltip');
    await trigger.hover();
    await expect(hint).toHaveCount(0);
    await expect(hint).toHaveText('공통 액션 도움말');
    await hint.hover();
    await expect(hint).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(hint).toHaveCount(0);
    await expect(trigger).not.toHaveAttribute('title');
    await page.mouse.move(0, 0);
    await page.keyboard.press('Tab');
    await expect(trigger).toBeFocused();
    await expect(hint).toBeVisible();
    const description = await trigger.getAttribute('aria-describedby');
    expect(description?.split(' ')).toContain('existing-description');
    expect(description?.split(' ')).toContain(await hint.getAttribute('id'));
    await page.keyboard.press('Escape');
    await expect(hint).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-describedby', 'existing-description');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '액션 1', exact: true })).toBeVisible();
  });

  test('disabled hints, copy feedback and existing input refs work', async ({ page }) => {
    const hint = page.getByRole('tooltip');
    await page.getByRole('button', { name: '비활성 액션', exact: true }).hover();
    await expect(hint).toHaveText('입력 중에는 변경할 수 없습니다');
    await page.getByRole('button', { name: '입력 포커스', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '설정 값', exact: true })).toBeFocused();
    await page.getByRole('button', { name: '값 복사', exact: true }).click();
    await page.mouse.move(0, 0);
    await page.getByRole('button', { name: '값 복사', exact: true }).hover();
    await expect(hint).toHaveText('복사했습니다');
    await expect(page.locator('[title]')).toHaveCount(0);
  });

  test('hints escape clipping, wrap long text and remain inside the viewport in both themes', async ({ page }, testInfo) => {
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 700 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme);
        const trigger = page.getByRole('button', { name: '화면 가장자리 도움말', exact: true });
        await page.mouse.move(0, 0);
        await trigger.hover();
        const hint = page.getByRole('tooltip');
        await expect(hint).toHaveText('화면 가장자리 도움말');
        const rect = await hint.boundingBox();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(700);
        await page.screenshot({ path: testInfo.outputPath(`tooltip-edge-${width}-${theme}.png`) });
        await page.keyboard.press('Escape');
        await page.getByText('긴 경로 정보', { exact: true }).focus();
        await expect(hint).toContainText('긴 경로 /v1/payments/');
        expect((await hint.boundingBox())!.width).toBeLessThanOrEqual(Math.min(320, width - 16));
        await expect(hint).toBeVisible();
        await page.keyboard.press('Escape');
        await page.getByText('긴 경로 정보', { exact: true }).blur();
      }
    }
  });

  test('a native modal keeps its tooltip in the top layer and Escape closes the hint first', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: '대화상자 열기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '설정 대화상자', exact: true });
    await dialog.getByRole('textbox').hover();
    await expect(dialog.getByRole('tooltip')).toHaveText('대화상자 안 도움말');
    await expect.poll(() => dialog.getByRole('tooltip').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + 2));
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('tooltip-native-dialog.png') });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test('application hint controls no longer render browser title attributes', async ({ page }) => {
  for (const route of ['api', 'api/observed_mock_orders', 'uptime', 'logs', 'alerts', 'metrics', 'settings']) {
    await page.goto(`./${route}`);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('[title]')).toHaveCount(0);
  }
});
