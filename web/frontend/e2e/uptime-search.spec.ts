import { expect, test } from '@playwright/test';
import { dockerService, uptimeFixture } from './fixtures/uptime';

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
    await expect(targets.getByText(String(names.length), { exact: true })).toBeVisible();
  }
});

test('[03] HTTP and Docker displayed endpoints match', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./uptime');
  const search = page.getByRole('textbox', { name: '서비스 또는 대상 검색' });
  for (const [query, name] of [['HTTPS://API.EXAMPLE.COM/HEALTH', 'Public API'], ['docker-api:8080', 'Docker API']]) {
    await search.fill(query);
    await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveText([name]);
  }
});

test('[03] TCP displayed host and port are searchable together and by port', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./uptime');
  const search = page.getByRole('textbox', { name: '서비스 또는 대상 검색' });
  for (const query of ['db.example.com:5432', '5432']) {
    await search.fill(query);
    await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveText(['Database']);
  }
});

test('[03] Docker displayed fallback key is searchable', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.services.push(dockerService({ name: 'Fallback Worker', key: 'bare:key', endpoint: '' }));
  await page.goto('./uptime');
  await page.getByRole('textbox', { name: '서비스 또는 대상 검색' }).fill('bare:key');
  await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveText(['Fallback Worker']);
});

test('[03] missing search results recover after clearing and do not conceal source failures', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./uptime');
  const search = page.getByRole('textbox', { name: '서비스 또는 대상 검색' });
  await search.fill('absent-target');
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
  await search.clear();
  await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveCount(3);
  state.failures.set('GET /agents/services/all', 500);
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Docker 서비스');
  await search.fill('absent-target');
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toHaveCount(0);
  state.failures.clear();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
  await search.clear();
  await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveCount(3);
});

test('[03] an empty registry keeps its setup explanation even when a query is entered', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors = [];
  state.services = [];
  await page.goto('./uptime');
  await expect(page.getByText('표시할 업타임 대상이 없습니다', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '서비스 또는 대상 검색' }).fill('anything');
  await expect(page.getByText('표시할 업타임 대상이 없습니다', { exact: true })).toBeVisible();
});
