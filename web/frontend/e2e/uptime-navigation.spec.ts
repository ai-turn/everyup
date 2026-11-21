import { expect, test, type Page } from '@playwright/test';
import { dockerService, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });
const panel = (page: Page) => page.getByRole('tabpanel');

test('[04] direct detail and browser back preserve the searched list', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  const search = page.getByRole('textbox', { name: '모니터 검색' });
  await search.fill('Public');
  await page.getByRole('link', { name: 'Public API', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime\/http-monitor$/);
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('web-01');
  await page.goBack();
  await expect(search).toHaveValue('Public');
  await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveText(['Public API']);
});

// 목록에서 연 상세의 `모니터 목록` 링크는 목록에서 넘겨받은 주소로 돌아가 검색어를 되살린다(옛 화면의 경로 표시 `업타임`과 같은 동작).
test('[04] returning from a detail to the list keeps the search', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  const search = page.getByRole('textbox', { name: '모니터 검색' });
  await search.fill('Public');
  await page.getByRole('link', { name: 'Public API', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime\/http-monitor$/);
  await page.getByRole('group', { name: '탭 조작' }).getByRole('link', { name: '모니터 목록', exact: true }).click();
  await expect(search).toHaveValue('Public');
});

for (const key of ['shop:api', 'worker%ready', 'svc%2Fraw', '주문 서비스']) {
  test(`[04] Docker key ${key} survives navigation and a deep reload`, async ({ page }) => {
    const state = await uptimeFixture(page);
    state.services = [dockerService({ key })];
    state.responses.set('GET /agents/docker-host/setup-status', { connected: true, configApplied: true, profile: { kind: 'basic', capabilities: ['uptime'] }, signals: [] });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Docker checks open from their Docker Environment (ADR 0007).
    await page.goto('./agents/docker-host');
    await page.getByRole('table', { name: 'Docker 서비스 그리드' }).getByRole('link', { name: 'Docker API', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Docker API', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: '업타임', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Docker API', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('[04] mobile direct detail provides a return to the uptime list', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime/http-monitor');
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
  await page.getByRole('group', { name: '탭 조작' }).getByRole('link', { name: '모니터 목록', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime$/);
  await expect(page.getByRole('table', { name: '업타임 그리드' })).toBeVisible();
});

// 모바일의 복귀 링크(`모니터 목록`)도 같은 주소로 돌아간다.
test('[04] mobile return retains the searched list context', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  await page.getByRole('textbox', { name: '모니터 검색' }).fill('Database');
  await page.getByRole('link', { name: 'Database', exact: true }).click();
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Database', exact: true })).toBeVisible();
  await page.getByRole('group', { name: '탭 조작' }).getByRole('link', { name: '모니터 목록', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '모니터 검색' })).toHaveValue('Database');
});
