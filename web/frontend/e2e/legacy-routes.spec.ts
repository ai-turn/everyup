import { expect, test } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { dockerService, uptimeFixture } from './fixtures/uptime';

// 옛 기능별 메뉴의 주소는 서버 화면으로 바뀐다(설계 6.2). 이미 보낸 알림과 북마크의 링크가 이 경로로 온다.
// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다.

for (const path of ['uptime', 'infrastructure', 'api', 'metrics', 'services']) {
  test(`./${path} goes to the server list`, async ({ page }) => {
    await page.goto(`./${path}`);
    await expect(page).toHaveURL(/\/servers$/);
    await expect(page.getByRole('table', { name: '서버 그리드' })).toBeVisible();
  });
}

test('a monitor address goes to the monitor page under its server', async ({ page }) => {
  await page.goto('./uptime/uptime_mock_docs');
  await expect(page).toHaveURL(/\/servers\/server_mock_staging_host_01\/monitors\/uptime_mock_docs$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Documentation' })).toBeVisible();
});

// 2026-11-21 이전의 서버 탭 안 모니터 주소. 장애 이력, 알림, 북마크의 링크가 이 경로로 온다.
test('the old server uptime tab address of a monitor goes to the monitor page with its query and hash', async ({ page }) => {
  await page.goto('./servers');
  await page.goto('./servers/server_mock_edge_host_01/uptime/uptime_mock_store?range=24h#history');
  await expect(page).toHaveURL(/\/servers\/server_mock_edge_host_01\/monitors\/uptime_mock_store\?range=24h#history$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Storefront' })).toBeVisible();
  await expect(page.getByRole('group', { name: '기간' }).getByRole('button', { name: '24시간', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
});

test('an old infrastructure resource address goes to the server infrastructure tab with its query', async ({ page }) => {
  await page.goto('./servers/server_mock_edge_host_01/infrastructure/infra_mock_edge_01?range=24h');
  await expect(page).toHaveURL(/\/servers\/server_mock_edge_host_01\/infrastructure\?range=24h$/);
  await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('tab', { name: /^인프라/ })).toHaveAttribute('aria-selected', 'true');
});

// 앱은 자기 페이지가 있다(대상 상세, 2026-11-21). 옛 기능 메뉴의 앱 주소는 쿼리와 해시를 옮겨 앱 페이지의 그 탭으로 간다.
test('a log address keeps its query and hash', async ({ page }) => {
  await page.goto('./logs/observed_mock_checkout?range=6h&pattern=abc#latest');
  await expect(page).toHaveURL(/\/servers\/server_mock_edge_host_01\/apps\/observed_mock_checkout\?tab=logs&range=6h&pattern=abc#latest$/);
  await expect(page.getByRole('heading', { level: 1, name: 'checkout-api' })).toBeVisible();
});

test('api and metrics addresses go to the app page, with the traces view as the traces tab', async ({ page }) => {
  await page.goto('./api/observed_mock_orders?tab=traces');
  await expect(page).toHaveURL(/\/servers\/server_mock_edge_host_01\/apps\/observed_mock_orders\?tab=traces$/);
  await expect(page.getByRole('tab', { name: '트레이스' })).toHaveAttribute('aria-selected', 'true');
  await page.goto('./api/observed_mock_orders?traceId=abc');
  await expect(page).toHaveURL(/\/apps\/observed_mock_orders\?tab=requests&traceId=abc$/);
  await page.goto('./metrics/observed_mock_inventory?range=24h');
  await expect(page).toHaveURL(/\/servers\/server_mock_inventory_api\/apps\/observed_mock_inventory\?tab=metrics&range=24h$/);
});

// 2026-11-21 이전의 서버 탭 안 앱 주소. 알림·북마크·공유한 링크가 이 경로로 온다.
for (const [old, tab] of [['logs', 'logs'], ['api', 'requests'], ['metrics', 'metrics']] as const) {
  test(`the old server ${old} tab address of an app goes to the app page ${tab} tab with its query and hash`, async ({ page }) => {
    await page.goto('./servers');
    await page.goto(`./servers/server_mock_edge_host_01/${old}/observed_mock_orders?traceId=t1&range=24h#x`);
    await expect(page).toHaveURL(new RegExp(`/servers/server_mock_edge_host_01/apps/observed_mock_orders\\?tab=${tab}&traceId=t1&range=24h#x$`));
    await expect(page.getByRole('heading', { level: 1, name: 'orders-api' })).toBeVisible();
    await expect(page.getByRole('tab', { selected: true })).toHaveText(tab === 'logs' ? '로그' : tab === 'requests' ? 'API 요청' : '메트릭');
    // 바꾼 주소가 옛 주소를 대신해 뒤로 가기가 옛 주소로 돌아가지 않는다.
    await page.goBack();
    await expect(page).toHaveURL(/\/servers$/);
  });
}

test('the old api tab address keeps its traces view as the traces tab', async ({ page }) => {
  await page.goto('./servers/server_mock_edge_host_01/api/observed_mock_orders?tab=traces&range=1h');
  await expect(page).toHaveURL(/\/apps\/observed_mock_orders\?tab=traces&range=1h$/);
  await expect(page.getByRole('tab', { name: '트레이스' })).toHaveAttribute('aria-selected', 'true');
});

test('an infrastructure address goes to the server infrastructure tab', async ({ page }) => {
  await page.goto('./infrastructure/infra_mock_db_01');
  await expect(page).toHaveURL(/\/servers\/server_mock_db_primary_01\/infrastructure$/);
});

test('the redirect replaces the old address, so back does not return to it', async ({ page }) => {
  await page.goto('./servers');
  await page.goto('./uptime/uptime_mock_docs');
  await expect(page).toHaveURL(/\/servers\/server_mock_staging_host_01\/monitors\/uptime_mock_docs$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
});

// Docker 환경은 같은 ID의 서버다(ADR 0012). 옛 Docker 환경 목록·화면 주소는 서버 목록·화면으로 간다.
test('the old Docker environment list goes to the Docker servers in the server list with its query and hash', async ({ page }) => {
  await page.goto('./servers/server_mock_edge_host_01');
  await page.goto('./environments?q=prod#top');
  await expect(page).toHaveURL(/\/servers\?q=prod&connection=docker#top$/);
  const grid = page.getByRole('table', { name: '서버 그리드' });
  await expect(grid.getByRole('link', { name: 'prod-server', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '연결 방식으로 거르기' })).toContainText('Docker Collector');
  await page.goBack();
  await expect(page).toHaveURL(/\/servers\/server_mock_edge_host_01$/);
  await page.goto('./agents');
  await expect(page).toHaveURL(/\/servers\?connection=docker$/);
  // Docker Collector가 없는 서버는 걸러진다.
  await expect(grid.getByRole('link', { name: 'edge-host-01', exact: true })).toHaveCount(0);
  await expect(grid.getByRole('link', { name: 'worker-cluster', exact: true })).toBeVisible();
});

// 옛 `Docker 연결`은 서버 추가에서 Docker Collector 설치를 고른 화면이다(통합 3단계).
test('the old Docker connect address opens server adding with Docker Collector chosen', async ({ page }) => {
  for (const old of ['./environments?connect=docker', './servers?q=staging&connect=docker']) {
    await page.goto(old);
    await expect(page).toHaveURL(/\/servers\/new\?connection=docker$/);
    await expect(page.getByRole('radio', { name: /^Docker Collector 설치/ })).toBeChecked();
  }
});

for (const [old, tab] of [['', ''], ['/infrastructure', '/infrastructure'], ['/logs', '/logs'], ['/api', '/api'], ['/services', '']] as const) {
  test(`the old Docker environment address agents/:id${old} goes to the server${tab || ' overview'} with its query and hash`, async ({ page }) => {
    await page.goto('./servers');
    await page.goto(`./agents/agent_demo_01${old}?range=24h#x`);
    await expect(page).toHaveURL(new RegExp(`/servers/agent_demo_01${tab}\\?range=24h#x$`));
    await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/servers$/);
  });
}

test('a missing target explains itself and links to the server list', async ({ page }) => {
  await page.goto('./metrics/missing');
  // 제목은 옛 주소가 가리킨 종류를 말한다.
  await expect(page.getByRole('heading', { level: 1, name: '앱을 찾을 수 없습니다' })).toBeVisible();
  await page.getByRole('link', { name: '서버 목록', exact: true }).click();
  await expect(page).toHaveURL(/\/servers$/);
});

// 옛 Docker 서비스 상세(`/services/:agentId/:key`)는 그 Docker 서버의 컨테이너 페이지로 간다(ADR 0012). 장애 이력, 알림, 북마크의 링크다.
test('an old Docker service address goes to the container page under its server with its query and hash', async ({ page }) => {
  await page.goto('./servers');
  await page.goto('./services/agent_demo_01/shop%3Apayment-worker?tab=logs&range=24h#latest');
  await expect(page).toHaveURL(/\/servers\/agent_demo_01\/containers\/shop%3Apayment-worker\?tab=logs&range=24h#latest$/);
  await expect(page.getByRole('heading', { level: 1, name: 'payment-worker' })).toBeVisible();
  await expect(page.getByRole('tab', { selected: true })).toHaveText('로그');
  await page.goBack();
  await expect(page).toHaveURL(/\/servers$/);
});

test.describe('against the API', () => {
  test.use({ baseURL: API_URL });

  test('an old Docker service address keeps a key with an encoded slash', async ({ page }) => {
    const state = await uptimeFixture(page);
    state.services = [dockerService({ key: 'svc%2Fraw' })];
    await page.goto(`./services/docker-host/${encodeURIComponent('svc%2Fraw')}?tab=logs`);
    await expect(page).toHaveURL(/\/servers\/docker-host\/containers\/svc%252Fraw\?tab=logs$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Docker API' })).toBeVisible();
  });

  test('a 404 is not found, a failed lookup offers a retry', async ({ page }) => {
    const state = await uptimeFixture(page);
    state.failures.set('GET /services/gone', 404);
    await page.goto('./uptime/gone');
    await expect(page.getByRole('heading', { level: 1, name: '업타임 모니터를 찾을 수 없습니다' })).toBeVisible();
    await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);

    state.failures.set('GET /services/http-monitor', 500);
    await page.goto('./uptime/http-monitor?range=6h');
    await expect(page.getByRole('heading', { level: 1, name: '대상을 불러오지 못했습니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: '서버 목록', exact: true })).toHaveCount(0);
    state.failures.delete('GET /services/http-monitor');
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page).toHaveURL(/\/servers\/server-1\/monitors\/http-monitor\?range=6h$/);
  });

  test('a Docker environment resource goes to its server infrastructure tab', async ({ page }) => {
    // Docker 환경에서 온 인프라 리소스는 ID가 그 환경과 같고, Docker 환경은 같은 ID의 서버다(ADR 0012).
    // 옛 응답처럼 serverId가 없어도 그 서버로 간다.
    const state = await uptimeFixture(page);
    state.responses.set('GET /infrastructure-resources/docker-host', { id: 'docker-host', name: 'Production Docker', adapter: 'everyup-agent', isActive: true });
    await page.goto('./infrastructure/docker-host');
    await expect(page).toHaveURL(/\/servers\/docker-host\/infrastructure$/);
    // 실제 백엔드의 단건 조회는 직접 연결 리소스만 찾는다(404). 그래도 환경 목록에서 찾아 보낸다.
    state.responses.delete('GET /infrastructure-resources/docker-host');
    state.failures.set('GET /infrastructure-resources/docker-host', 404);
    await page.goto('./infrastructure/docker-host?range=6h');
    await expect(page).toHaveURL(/\/servers\/docker-host\/infrastructure\?range=6h$/);
    // 어느 환경에도 없는 ID는 찾을 수 없다.
    state.failures.set('GET /infrastructure-resources/gone', 404);
    await page.goto('./infrastructure/gone');
    await expect(page.getByRole('heading', { level: 1, name: '인프라 리소스를 찾을 수 없습니다' })).toBeVisible();
  });
});

// 그룹은 없어졌다(ADR 0013). 옛 그룹 목록·상세와 그 아래 주소는 서버 목록으로 가고, 검색어 같은 쿼리와 해시는 남는다.
test('the old group list goes to the server list with its query and hash', async ({ page }) => {
  await page.goto('./projects?q=edge#top');
  await expect(page).toHaveURL(/\/servers\?q=edge#top$/);
  await expect(page.getByRole('table', { name: '서버 그리드' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '서버 또는 대상 검색' })).toHaveValue('edge');
});

test('an old group address goes to the server list without hiding servers', async ({ page }) => {
  for (const path of ['./projects/project_mock_production?status=error', './projects/project_mock_staging/members']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/servers(\?status=error)?$/);
    await expect(page.getByRole('table', { name: '서버 그리드' })).toBeVisible();
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/servers\?status=error$/);
});

// 그보다 옛날의 `/projects/:agentId`는 Docker 환경 상세였고, Docker 환경은 같은 ID의 서버다(ADR 0012).
test('an old Docker environment address under projects goes to its server', async ({ page }) => {
  await page.goto('./projects/agent_demo_01');
  await expect(page).toHaveURL(/\/servers\/agent_demo_01$/);
  await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();
});
