import { expect, test, type Page } from '@playwright/test';
import { uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });
const panel = (page: Page) => page.getByRole('tabpanel');

test('grid is the default and switching views preserves search and reload', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  const toggle = page.getByRole('group', { name: '대상 보기 방식' });
  const targets = page.getByRole('region', { name: '업타임 대상', exact: true });
  const search = page.getByRole('textbox', { name: '모니터 검색' });
  await expect(toggle.getByRole('button', { name: '그리드', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(targets.getByRole('table', { name: '업타임 그리드' })).toBeVisible();
  await expect(targets.getByRole('checkbox')).toHaveCount(0);
  await expect(targets.getByRole('columnheader').first()).toHaveText('상태');
  await search.fill('api');
  await expect(targets.getByRole('link')).toHaveCount(1);
  const names = await targets.getByRole('link').allTextContents();
  await toggle.getByRole('button', { name: '카드', exact: true }).click();
  await expect(page).toHaveURL(/view=card/);
  await expect(search).toHaveValue('api');
  await expect(targets.getByRole('article')).toHaveCount(1);
  await expect(targets.getByRole('link')).toHaveText(names);
  await page.reload();
  await expect(toggle.getByRole('button', { name: '카드', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toHaveValue('api');
  await toggle.getByRole('button', { name: '그리드', exact: true }).click();
  await expect(targets.getByRole('table')).toBeVisible();
  await expect(targets.getByRole('link')).toHaveText(names);
  await expect(page).not.toHaveURL(/view=card/);
  await search.fill('no-match');
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
  await toggle.getByRole('button', { name: '카드', exact: true }).click();
  await expect(toggle.getByRole('button', { name: '카드', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
  await search.clear();
  await expect(targets.getByRole('article')).toHaveCount(2);
});

// 상세의 `모니터 목록` 링크는 목록의 검색어와 카드 보기를 되살린다.
test('returning from a detail keeps the search and the card view', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime?q=api&view=card');
  const toggle = page.getByRole('group', { name: '대상 보기 방식' });
  const targets = page.getByRole('region', { name: '업타임 대상', exact: true });
  await targets.getByRole('link', { name: 'Public API', exact: true }).click();
  await panel(page).getByRole('link', { name: '모니터 목록', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '모니터 검색' })).toHaveValue('api');
  await expect(toggle.getByRole('button', { name: '카드', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('both views share state priority and mobile grid retains actions without horizontal scrolling', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors[0].status = 'unhealthy';
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./servers/server-1/uptime?view=unexpected');
  const targets = page.getByRole('region', { name: '업타임 대상', exact: true });
  await expect(targets.getByRole('table')).toBeVisible();
  await expect(targets.getByRole('link').first()).toHaveText('Public API');
  const row = targets.getByRole('row').filter({ has: page.getByRole('link', { name: 'Public API', exact: true }) });
  await expect(row.getByRole('button', { name: 'Public API 일시정지', exact: true })).toBeVisible();
  await expect(row.getByText('https://api.example.com/health', { exact: true }).filter({ visible: true })).toBeVisible();
  // 표는 table-bleed로 셀 패딩만큼 영역 밖으로 펼쳐진다(DESIGN.md §4.5). 넘침은 영역이 아니라 실제로 가로 스크롤이 생기는
  // 본문 스크롤 컨테이너에서 잰다.
  expect(await page.evaluate(() => { const scroller = document.querySelector('#main-content > div')!; return scroller.scrollWidth - scroller.clientWidth; })).toBeLessThanOrEqual(1);
  const names = await targets.getByRole('link').allTextContents();
  await page.getByRole('group', { name: '대상 보기 방식' }).getByRole('button', { name: '카드', exact: true }).click();
  await expect(targets.getByRole('article')).toHaveCount(2);
  await expect(targets.getByRole('link')).toHaveText(names);
});
