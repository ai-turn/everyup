import { expect, test, type Page } from '@playwright/test';
import { dockerService, uptimeFixture } from './fixtures/uptime';

// Uptime searches independent monitors only; Docker checks are in their Docker Environment (ADR 0007).

test.use({ baseURL: 'http://127.0.0.1:4174/' });
const panel = (page: Page) => page.getByRole('tabpanel');

test('[02] names match without case or outer whitespace sensitivity', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  const search = page.getByRole('textbox', { name: '모니터 검색' });
  const targets = page.getByRole('region', { name: '업타임 대상' });
  for (const [query, names] of [
    [' public aPI ', ['Public API']],
    ['api', ['Public API']],
    ['DaTaBaSe', ['Database']],
    ['', ['Public API', 'Database']],
  ] as const) {
    await search.fill(query);
    await expect(targets.getByRole('link')).toHaveText([...names]);
    // 개수는 검색창 안에서만 보인다(목록 개수 줄은 헤더 정리로 없앴다).
    if (query) await expect(page.getByText(`${names.length}개`, { exact: true })).toBeVisible();
  }
});

test('[03] HTTP displayed endpoints match and Docker endpoints do not', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  const search = page.getByRole('textbox', { name: '모니터 검색' });
  await search.fill('HTTPS://API.EXAMPLE.COM/HEALTH');
  await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveText(['Public API']);
  await search.fill('docker-api:8080');
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
});

test('[03] TCP displayed host and port are searchable together and by port', async ({ page }) => {
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  const search = page.getByRole('textbox', { name: '모니터 검색' });
  for (const query of ['db.example.com:5432', '5432']) {
    await search.fill(query);
    await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveText(['Database']);
  }
});

test('[03] missing search results recover after clearing and do not conceal a load failure', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  const search = page.getByRole('textbox', { name: '모니터 검색' });
  await search.fill('absent-target');
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
  await search.clear();
  await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveCount(2);
  // 서버 탭은 모니터 목록을 불러오지 못하면 목록과 검색창 대신 실패 안내를 보인다.
  // 그래서 검색어는 실패하기 전에 넣어 두고(주소의 ?q=), 실패한 화면이 "검색 결과 없음"으로 보이지 않는지 확인한다.
  await search.fill('absent-target');
  await expect(page).toHaveURL(/q=absent-target/);
  state.failures.set('GET /services', 500);
  await page.reload();
  await expect(panel(page).getByRole('alert')).toContainText('업타임 모니터');
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toHaveCount(0);
  state.failures.clear();
  await panel(page).getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toBeVisible();
  await search.clear();
  await expect(page.getByRole('region', { name: '업타임 대상' }).getByRole('link')).toHaveCount(2);
});

test('[03] an empty registry keeps its setup explanation even when a query is entered', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors = [];
  state.services = [dockerService()];
  await page.goto('./servers/server-1/uptime');
  const setup = panel(page).getByRole('heading', { name: '이 서버의 업타임 모니터를 추가하세요' });
  await expect(setup).toBeVisible();
  // 모니터가 없는 탭에는 검색창이 없다. 검색어는 주소로 넣는다.
  await page.goto('./servers/server-1/uptime?q=anything');
  await expect(setup).toBeVisible();
  await expect(page.getByText('검색 결과가 없습니다', { exact: true })).toHaveCount(0);
});
