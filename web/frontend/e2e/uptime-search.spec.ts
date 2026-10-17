import { expect, test } from '@playwright/test';
import { uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('[02] names and Docker environments match without case or outer whitespace sensitivity', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./uptime');
  const search = page.getByRole('textbox', { name: '서비스 또는 대상 검색' });
  const targets = page.getByRole('region', { name: '업타임 대상' });
  for (const [query, names] of [
    [' public aPI ', ['Public API']],
    ['PrOdUcTiOn', ['Docker API']],
    ['api', ['Public API', 'Docker API']],
    ['DaTaBaSe', ['Database']],
    ['', ['Public API', 'Database', 'Docker API']],
  ] as const) {
    await search.fill(query);
    await expect(targets.getByRole('link')).toHaveText([...names]);
    await expect(targets.getByRole('article')).toHaveCount(names.length);
    await expect(targets.getByText(String(names.length), { exact: true })).toBeVisible();
  }
});
