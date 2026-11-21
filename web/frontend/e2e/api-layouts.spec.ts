import { expect, test } from '@playwright/test';

// 데모: orders-api는 edge-host-01의 하나뿐인 API 앱이다(SCENARIOS.md). 서버의 API 요청 탭은 앱 목록이고, 요청은 앱 페이지에 있다.
// 옛 API 목록은 서버 목록이 대신한다. 서버 목록의 폭은 servers-list.spec.ts가 확인한다.
const API_TAB = './servers/server_mock_edge_host_01/api';
const API_APP = './servers/server_mock_edge_host_01/apps/observed_mock_orders?tab=requests';

test('API detail and connection fit responsive layouts in both themes', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark']) {
      await page.goto(`${API_APP}&range=6h`);
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme);
      await expect(page.getByRole('table', { name: 'API 요청 목록' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '앱 전체 추이', exact: true })).toBeVisible();
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
  await page.goto(API_TAB);
  const trigger = page.getByRole('button', { name: 'API 연결', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'API 요청 연결' });
  await expect(dialog.getByRole('textbox', { name: '앱 이름', exact: true })).toBeVisible();
  await dialog.screenshot({ path: testInfo.outputPath('api-connection.png') });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
