import { expect, test } from '@playwright/test';

test('API list, detail and connection fit responsive layouts in both themes', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      await page.goto('./api');
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme);
      await expect(page.getByRole('table', { name: 'API 대상 그리드' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 360 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`api-list-${width}-${theme}.png`) });
      await page.goto('./api/observed_mock_orders?range=6h');
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme);
      await expect(page.getByRole('table', { name: 'API 요청 목록' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '서비스 전체 추이', exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'API 제외 경로', exact: true })).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 360 || width === 1440) {
        await page.screenshot({ path: testInfo.outputPath(`api-detail-${width}-${theme}.png`) });
        await page.getByRole('region', { name: '요청 결과' }).evaluate(element => element.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: testInfo.outputPath(`api-results-${width}-${theme}.png`) });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./api');
  const trigger = page.getByRole('button', { name: 'API 연결', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'API 직접 연결' });
  await expect(dialog.getByRole('textbox', { name: '서비스 이름', exact: true })).toBeVisible();
  await dialog.screenshot({ path: testInfo.outputPath('api-connection.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
