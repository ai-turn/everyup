import { expect, test, type Page } from '@playwright/test';

// 목록 화면의 공통 규칙(DESIGN.md §3.4 메뉴 첫 화면의 제목, §4.5 목록 필터의 공통 규칙). 데모 데이터는 src/mocks/SCENARIOS.md.
const crumbs = (page: Page) => page.getByRole('navigation', { name: '현재 위치' });
const chips = (page: Page, name = '상태로 거르기') => page.getByRole('group', { name });
const titleSize = (page: Page) => crumbs(page).locator('[aria-current="page"]').evaluate((node) => getComputedStyle(node).fontSize);

test.describe('the title of a menu screen is said once', () => {
  test('desktop: the top bar carries the title and the count, the body h1 is for screen readers', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [route, name] of [['servers', '서버'], ['environments', 'Docker 환경'], ['projects', '그룹']] as const) {
      await page.goto(`./${route}`);
      await expect(crumbs(page)).toHaveText(new RegExp(`^${name} \\d+$`));
      expect(await titleSize(page)).toBe('24px');
      // 본문에는 같은 제목이 보이지 않는다(sr-only 1px 상자).
      const h1 = page.getByRole('heading', { level: 1, name: new RegExp(`^${name} \\d+$`) });
      await expect(h1).toBeAttached();
      expect((await h1.boundingBox())!.width).toBeLessThanOrEqual(1);
    }
    // 탭이 목록을 나누는 알림은 탭이 개수를 말한다.
    await page.goto('./alerts');
    await expect(crumbs(page)).toHaveText(/^알림$/);
    expect(await titleSize(page)).toBe('24px');
    // 상세의 크럼은 위치다. 불러오는 동안 크럼이 하나여도 제목 크기가 아니다.
    await page.goto('./servers/server_mock_edge_host_01');
    await expect(crumbs(page)).toHaveText(/^서버.*edge-host-01$/);
    expect(await titleSize(page)).toBe('14px');
  });

  test('mobile: the body h1 carries the count and the actions share its row', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [route, name, action] of [['servers', '서버', '추가'], ['projects', '그룹', '추가'], ['alerts', '알림', '규칙 추가']] as const) {
      await page.goto(`./${route}`);
      const h1 = page.getByRole('heading', { level: 1, name: new RegExp(`^${name}( \\d+)?$`) });
      await expect(h1).toBeVisible();
      const title = (await h1.boundingBox())!;
      const button = (await page.getByRole('main').getByRole(route === 'projects' || route === 'alerts' ? 'button' : 'link', { name: action, exact: true }).boundingBox())!;
      expect(Math.abs((title.y + title.height / 2) - (button.y + button.height / 2))).toBeLessThanOrEqual(4);
    }
  });
});

test.describe('summaries are filter chips whose counts follow the other filters', () => {
  test('groups: status chips, search and clearing', async ({ page }) => {
    await page.goto('./projects');
    const table = page.getByRole('table', { name: '그룹 그리드' });
    await expect(table.locator('tbody tr')).toHaveCount(3);
    const down = chips(page).getByRole('button', { name: /^장애/ });
    await expect(down).toHaveText(/장애\s*1$/);
    await down.focus();
    await page.keyboard.press('Enter');
    await expect(down).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/[?&]status=error/);
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table).toContainText('Production');
    // 검색어가 바뀌면 칩의 개수가 따라간다.
    await page.getByRole('textbox', { name: '그룹 이름 또는 설명 검색' }).fill('배포');
    await expect(down).toHaveText(/장애\s*0$/);
    await expect(chips(page).getByRole('button', { name: /^정상/ })).toHaveText(/정상\s*1$/);
    await expect(page.getByText('검색 결과가 없습니다')).toBeVisible();
    await page.getByRole('button', { name: '필터 해제', exact: true }).click();
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(page).not.toHaveURL(/status=|q=/);
  });

  test('Docker environments: service status chips narrow the tree', async ({ page }) => {
    await page.goto('./environments');
    const table = page.getByRole('table', { name: 'Docker 환경 그리드' });
    const down = chips(page).getByRole('button', { name: /^장애/ });
    await expect(down).toHaveText(/장애\s*1$/);
    await down.click();
    await expect(page).toHaveURL(/[?&]status=error/);
    // 장애 서비스가 있는 환경과 그 서비스만 남는다.
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table).toContainText('prod-server');
    await expect(table).toContainText('payment-worker');
    await expect(table).not.toContainText('postgres');
  });

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
