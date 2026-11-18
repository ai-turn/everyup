import { expect, test } from '@playwright/test';
import { uptimeFixture } from './fixtures/uptime';

// 옛 기능별 메뉴의 주소는 서버 화면으로 바뀐다(설계 6.2). 이미 보낸 알림과 북마크의 링크가 이 경로로 온다.
// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다.

for (const path of ['uptime', 'infrastructure', 'api', 'metrics', 'services']) {
  test(`./${path} goes to the server list`, async ({ page }) => {
    await page.goto(`./${path}`);
    await expect(page).toHaveURL(/\/servers$/);
    await expect(page.getByRole('table', { name: '서버 그리드' })).toBeVisible();
  });
}

test('a monitor address goes to its server uptime tab', async ({ page }) => {
  await page.goto('./uptime/uptime_mock_docs');
  await expect(page).toHaveURL(/\/servers\/server_mock_staging_host_01\/uptime\/uptime_mock_docs$/);
  await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2, name: 'Documentation' })).toBeVisible();
});

test('a log address keeps its query and hash', async ({ page }) => {
  await page.goto('./logs/observed_mock_checkout?range=6h&pattern=abc#latest');
  await expect(page).toHaveURL(/\/servers\/server_mock_edge_host_01\/logs\/observed_mock_checkout\?range=6h&pattern=abc#latest$/);
  await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2, name: 'checkout-api' })).toBeVisible();
});

test('api and metrics addresses go to the app in its server', async ({ page }) => {
  await page.goto('./api/observed_mock_orders?tab=traces');
  await expect(page).toHaveURL(/\/servers\/server_mock_edge_host_01\/api\/observed_mock_orders\?tab=traces$/);
  await page.goto('./metrics/observed_mock_inventory?range=24h');
  await expect(page).toHaveURL(/\/servers\/server_mock_inventory_api\/metrics\/observed_mock_inventory\?range=24h$/);
});

test('an infrastructure address goes to the server infrastructure tab', async ({ page }) => {
  await page.goto('./infrastructure/infra_mock_db_01');
  await expect(page).toHaveURL(/\/servers\/server_mock_db_primary_01\/infrastructure$/);
});

test('the redirect replaces the old address, so back does not return to it', async ({ page }) => {
  await page.goto('./servers');
  await page.goto('./uptime/uptime_mock_docs');
  await expect(page).toHaveURL(/\/servers\/server_mock_staging_host_01\/uptime\/uptime_mock_docs$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
});

test('a missing target explains itself and links to the server list', async ({ page }) => {
  await page.goto('./metrics/missing');
  await expect(page.getByRole('heading', { level: 1, name: '대상을 찾을 수 없습니다' })).toBeVisible();
  await page.getByRole('link', { name: '서버 목록', exact: true }).click();
  await expect(page).toHaveURL(/\/servers$/);
});

test.describe('against the API', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174/' });

  test('a 404 is not found, a failed lookup offers a retry', async ({ page }) => {
    const state = await uptimeFixture(page);
    state.failures.set('GET /services/gone', 404);
    await page.goto('./uptime/gone');
    await expect(page.getByRole('heading', { level: 1, name: '대상을 찾을 수 없습니다' })).toBeVisible();
    await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);

    state.failures.set('GET /services/http-monitor', 500);
    await page.goto('./uptime/http-monitor?range=6h');
    await expect(page.getByRole('heading', { level: 1, name: '대상을 불러오지 못했습니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: '서버 목록', exact: true })).toHaveCount(0);
    state.failures.delete('GET /services/http-monitor');
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page).toHaveURL(/\/servers\/server-1\/uptime\/http-monitor\?range=6h$/);
  });

  test('a target without a server (a Docker environment resource) is not found', async ({ page }) => {
    // Docker 환경에서 온 인프라 리소스에는 serverId가 없다(Review Focus 1).
    const state = await uptimeFixture(page);
    state.responses.set('GET /infrastructure-resources/docker-host', { id: 'docker-host', name: 'Production Docker', adapter: 'everyup-agent', isActive: true });
    await page.goto('./infrastructure/docker-host');
    await expect(page.getByRole('heading', { level: 1, name: '대상을 찾을 수 없습니다' })).toBeVisible();
  });
});
