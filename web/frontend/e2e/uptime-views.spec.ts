import { expect, test } from '@playwright/test';
import { uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('grid is the default and switching views preserves search, reload and detail return', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./uptime');
  const toggle = page.getByRole('group', { name: '대상 보기 방식' });
  const targets = page.getByRole('region', { name: '업타임 대상', exact: true });
  const search = page.getByRole('textbox', { name: '서비스 또는 대상 검색' });
  await expect(toggle.getByRole('button', { name: '그리드', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(targets.getByRole('table', { name: '업타임 그리드' })).toBeVisible();
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
  await targets.getByRole('link', { name: 'Public API', exact: true }).click();
  await page.getByRole('navigation', { name: '현재 위치' }).getByRole('link', { name: '업타임', exact: true }).click();
  await expect(search).toHaveValue('api');
  await expect(toggle.getByRole('button', { name: '카드', exact: true })).toHaveAttribute('aria-pressed', 'true');
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

test('both views share state priority and mobile grid retains actions without horizontal scrolling', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors[0].status = 'unhealthy';
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./uptime?view=unexpected');
  const targets = page.getByRole('region', { name: '업타임 대상', exact: true });
  await expect(targets.getByRole('table')).toBeVisible();
  await expect(targets.getByRole('link').first()).toHaveText('Public API');
  const row = targets.getByRole('row').filter({ has: page.getByRole('link', { name: 'Public API', exact: true }) });
  await expect(row.getByRole('button', { name: 'Public API 일시정지', exact: true })).toBeVisible();
  await expect(row.getByText('https://api.example.com/health', { exact: true }).filter({ visible: true })).toBeVisible();
  expect(await targets.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  const names = await targets.getByRole('link').allTextContents();
  await page.getByRole('group', { name: '대상 보기 방식' }).getByRole('button', { name: '카드', exact: true }).click();
  await expect(targets.getByRole('article')).toHaveCount(2);
  await expect(targets.getByRole('link')).toHaveText(names);
});
