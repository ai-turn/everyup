import { expect, test, type Page } from '@playwright/test';

// 목록 화면의 공통 규칙(DESIGN.md §3.4 메뉴 첫 화면의 제목, §4.5 목록 필터의 공통 규칙). 데모 데이터는 src/mocks/SCENARIOS.md.
const crumbs = (page: Page) => page.getByRole('navigation', { name: '현재 위치' });
const chips = (page: Page, name = '상태로 거르기') => page.getByRole('group', { name });
const titleSize = (page: Page) => crumbs(page).locator('[aria-current="page"]').evaluate((node) => getComputedStyle(node).fontSize);

test.describe('the title of a menu screen is said once', () => {
  test('desktop: the top bar is the path, the body h1 carries the title and the count', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // G안: 메뉴 첫 화면의 경로는 `EveryUp / 서버`(13px), 제목은 본문 h1(24px)과 흐린 개수다.
    await page.goto('./servers');
    await expect(crumbs(page)).toHaveText(/^EveryUp\/서버$/);
    expect(await titleSize(page)).toBe('13px');
    const h1 = page.getByRole('heading', { level: 1, name: /^서버 \d+$/ });
    await expect(h1).toBeVisible();
    expect(await h1.evaluate((node) => getComputedStyle(node).fontSize)).toBe('24px');
    // 탭이 목록을 나누는 알림은 탭이 개수를 말한다.
    await page.goto('./alerts');
    await expect(crumbs(page)).toHaveText(/^EveryUp\/알림$/);
    await expect(page.getByRole('heading', { level: 1, name: '알림', exact: true })).toBeVisible();
    // 상세의 크럼은 섹션부터 시작한다.
    await page.goto('./servers/server_mock_edge_host_01');
    await expect(crumbs(page)).toHaveText(/^서버\/edge-host-01$/);
    expect(await titleSize(page)).toBe('13px');
  });

  test('mobile: the body h1 carries the count and the actions share its row', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [route, name, action] of [['servers', '서버', '추가'], ['alerts', '알림', '규칙 추가']] as const) {
      await page.goto(`./${route}`);
      const h1 = page.getByRole('heading', { level: 1, name: new RegExp(`^${name}( \\d+)?$`) });
      await expect(h1).toBeVisible();
      const title = (await h1.boundingBox())!;
      const button = (await page.getByRole('main').getByRole(route === 'alerts' ? 'button' : 'link', { name: action, exact: true }).boundingBox())!;
      expect(Math.abs((title.y + title.height / 2) - (button.y + button.height / 2))).toBeLessThanOrEqual(4);
    }
  });
});

test.describe('summaries are filter chips whose counts follow the other filters', () => {
  test('alert rules: type chips follow the severity filter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./alerts?tab=rules');
    const types = chips(page, '유형으로 거르기');
    await expect(types.getByRole('button', { name: /^인프라/ })).toHaveText(/인프라\s*3$/);
    await page.getByRole('combobox', { name: '전체 심각도' }).click();
    await page.getByRole('option', { name: '심각', exact: true }).click();
    await expect(types.getByRole('button', { name: /^인프라/ })).toHaveText(/인프라\s*1$/);
    await types.getByRole('button', { name: /^API 요청/ }).click();
    await expect(page.getByRole('table', { name: '알림 규칙 그리드' }).locator('tbody tr')).toHaveCount(2);
  });

  test('alert rules on mobile use the same type chips', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./alerts?tab=rules');
    const types = chips(page, '유형으로 거르기');
    await types.getByRole('button', { name: /^인프라/ }).click();
    await expect(page.getByRole('table', { name: '알림 규칙 그리드' }).locator('tbody tr')).toHaveCount(3);
    await types.getByRole('button', { name: /^인프라/ }).click();
    await expect(page.getByRole('table', { name: '알림 규칙 그리드' }).locator('tbody tr')).toHaveCount(9);
  });

  test('notification history: status chips count the filtered history', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./alerts?tab=history');
    const failed = chips(page).getByRole('button', { name: /^실패/ });
    await expect(failed).toHaveText(/실패\s*\d+$/);
    const count = Number((await failed.textContent())!.match(/(\d+)$/)![1]);
    // 칩의 라벨은 행의 상태 라벨과 같다.
    await expect(chips(page).getByRole('button', { name: /^발송/ })).toBeVisible();
    await failed.click();
    const rows = page.getByRole('table', { name: '발송 이력 그리드' }).locator('tbody tr').filter({ hasText: '실패' });
    await expect(rows).toHaveCount(count);
  });
});
