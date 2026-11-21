import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import type { ObservedService, Server, UptimeMonitor } from '../src/services/api';
import { monitor } from './fixtures/uptime';

// 서버 상태의 합산과 문구. 데모 데이터에 없는 조합이라 API를 가로챈다.
test.use({ baseURL: API_URL });

const at = '2026-11-01T00:00:00Z';
const server = (id: string, name: string): Server => ({ id, name, createdAt: at, updatedAt: at });
const app = (id: string, name: string, serverId: string, changes: Partial<ObservedService> = {}): ObservedService =>
  ({ id, name, serverId, signals: ['logs'], isActive: true, lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at, ...changes });
const down = (id: string, name: string, serverId: string, minutes: number): UptimeMonitor => monitor(id, {
  name, serverId, status: 'unhealthy',
  activeIncident: { source: 'uptime', targetName: name, targetPath: '', startedAt: at, durationSec: minutes * 60, active: true },
});

const servers = [
  server('mixed', 'mixed-01'), server('paused', 'paused-01'), server('empty', 'empty-01'),
  server('apps', 'apps-01'), server('logs-ok', 'logs-ok-01'), server('two-down', 'two-down-01'), server('one-down', 'one-down-01'),
];
const monitors = [
  monitor('m-up', { name: 'Storefront', serverId: 'mixed' }),
  // 일시정지는 마지막 상태가 장애여도 대기다.
  monitor('m-paused', { name: 'Old cron', serverId: 'mixed', isActive: false, status: 'unhealthy' }),
  monitor('m-only-paused', { name: 'Nightly job', serverId: 'paused', isActive: false }),
  down('d1', 'Checkout API', 'two-down', 12), down('d2', 'Payments API', 'two-down', 3),
  down('d3', 'Search API', 'one-down', 5),
];
const apps = [
  app('a-ok', 'orders-api', 'apps'), app('a-wait', 'billing-api', 'apps', { lastSeenAt: undefined }),
  app('a-logs', 'catalog-api', 'logs-ok'),
];

async function mockServers(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const data = path === '/servers' ? servers : path === '/services' ? monitors : path === '/observed-services' ? apps : [];
    await route.fulfill({ json: { success: true, data } });
  });
}

const statusCell = (page: Page, name: string) => page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr')
  .filter({ has: page.getByRole('link', { name, exact: true }) }).getByRole('cell').nth(1);

test('a healthy target outweighs a paused one, and idle servers say why', async ({ page }) => {
  await mockServers(page);
  await page.goto('./servers');
  await expect(statusCell(page, 'mixed-01')).toHaveText('정상');
  await expect(statusCell(page, 'paused-01')).toHaveText(/^대기Nightly job 일시정지$/);
  await expect(statusCell(page, 'empty-01')).toHaveText(/^대기연결한 대상 없음$/);
  await expect(statusCell(page, 'apps-01')).toHaveText(/^확인 필요billing-api 데이터 대기 중$/);

  await page.getByRole('link', { name: 'paused-01', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Nightly job 일시정지' })).toHaveAttribute('href', /\/servers\/paused\/uptime\/m-only-paused$/);
  await page.goBack();
  await page.getByRole('link', { name: 'empty-01', exact: true }).click();
  const header = page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
  await expect(header).toContainText('연결한 대상 없음');
  await expect(header.getByRole('link', { name: '연결한 대상 없음' })).toHaveCount(0);
});

test('app-based capabilities say whether data arrives, not that they are healthy', async ({ page }) => {
  await mockServers(page);
  await page.goto('./servers/logs-ok');
  const logs = page.getByRole('region', { name: '로그', exact: true });
  await expect(logs).toContainText('수집 중');
  await expect(logs).not.toContainText('정상');

  await page.goto('./servers/apps');
  await expect(page.getByRole('tablist', { name: '서버 기능' }).getByRole('img', { name: '데이터 대기 중' })).toBeVisible();
  await expect(page.getByRole('region', { name: '로그', exact: true })).toContainText('데이터 대기 중');
});

test('the overview lists outages only when there is more than one', async ({ page }) => {
  await mockServers(page);
  await page.goto('./servers/two-down');
  const banner = page.getByRole('region', { name: '진행 중 장애 2건' });
  await expect(banner.getByRole('link')).toHaveText([/^Checkout API/, /^Payments API/]);
  await expect(banner.getByRole('link').first()).toHaveAttribute('href', /\/servers\/two-down\/uptime\/d1$/);
  await expect(page.locator('.animate-pulse')).toHaveCount(1);

  await page.goto('./servers/one-down');
  await expect(page.getByRole('link', { name: 'Search API 응답 없음, 5분째' })).toBeVisible();
  await expect(page.getByRole('region', { name: /진행 중 장애/ })).toHaveCount(0);
});

test('status filters stay on one line each at 320px', async ({ page }) => {
  await mockServers(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('./servers');
  const filters = page.getByRole('group', { name: '상태로 거르기' }).getByRole('button');
  await expect(filters).toHaveCount(4);
  for (const button of await filters.all()) {
    const label = button.locator('span').nth(1);
    const { height } = (await label.boundingBox())!;
    expect(height).toBeLessThan(24);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('a group with a healthy server and a waiting server reads healthy', async ({ page }) => {
  const project = { id: 'p-mixed', name: 'Mixed group', agentCount: 0, monitorCount: 2, observedServiceCount: 0, infrastructureResourceCount: 0, serverCount: 2, createdAt: at, updatedAt: at };
  // 그룹의 구성원은 서버다. 정상 서버 하나와 일시정지한 모니터만 있는(대기) 서버 하나.
  const groupServers = [{ ...server('g-up', 'up-01'), projectId: 'p-mixed' }, { ...server('g-paused', 'paused-01'), projectId: 'p-mixed' }];
  const groupMonitors = [
    monitor('g-up-m', { name: 'Storefront', serverId: 'g-up', projectId: 'p-mixed' }),
    monitor('g-paused-m', { name: 'Old cron', serverId: 'g-paused', projectId: 'p-mixed', isActive: false }),
  ];
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const data = path === '/projects' ? [project] : path === '/services' ? groupMonitors : path === '/servers' ? groupServers : [];
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('./projects');
  const row = page.getByRole('table', { name: '그룹 그리드' }).locator('tbody tr').filter({ hasText: 'Mixed group' });
  // 문구의 나열은 정렬 순서(대기 먼저)지만 점의 색은 심각도 합산으로 정상이다.
  await expect(row).toContainText('대기 1, 정상 1');
  // 좁은 폭용 사본까지 같은 상태를 두 번 그린다. 둘 다 정상 톤이어야 한다.
  const dots = row.getByText('대기 1, 정상 1').locator('span.rounded-full');
  await expect(dots.first()).toBeAttached();
  for (const dot of await dots.all()) await expect(dot).toHaveClass(/bg-status-healthy-fill/);
});

test('an app with a metric over its threshold makes its server need attention and says why', async ({ page }) => {
  const fresh = new Date().toISOString();
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const data = path === '/servers' ? [server('metrics', 'metrics-01'), server('quiet', 'quiet-01')]
      : path === '/observed-services' ? [
        app('m-app', 'billing-api', 'metrics', { signals: ['logs', 'metrics'] }),
        app('q-app', 'search-api', 'quiet', { signals: ['metrics'] }),
      ]
        : path === '/observed-services/metric-catalog' ? [
          { serviceId: 'm-app', metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', lastAt: fresh, lastReceivedAt: fresh, breached: true },
          { serviceId: 'q-app', metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: fresh, lastReceivedAt: fresh },
        ] : [];
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('./servers');
  const rows = page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr');
  // 확인 필요가 정상보다 앞이다.
  await expect(rows.first()).toContainText('metrics-01');
  await expect(rows.first().getByRole('cell').nth(1)).toContainText('확인 필요');
  await expect(rows.first().getByRole('cell').nth(1)).toContainText('billing-api 임계값 초과 응답 시간');
  await expect(rows.nth(1).getByRole('cell').nth(1)).toContainText('정상');

  await rows.first().getByRole('link', { name: 'metrics-01' }).click();
  // 메트릭 탭에만 상태 점이 붙는다. 로그 탭의 상태는 로그 수신 여부다.
  const tabs = page.getByRole('tablist', { name: '서버 기능' });
  await expect(tabs.getByRole('tab', { name: /^메트릭/ }).getByRole('img', { name: '임계값 초과' })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /^로그/ }).getByRole('img')).toHaveCount(0);
  await expect(page.locator('header', { has: page.getByRole('heading', { level: 1 }) }).getByRole('link', { name: 'billing-api 임계값 초과 응답 시간' }))
    .toHaveAttribute('href', /\/servers\/metrics\/metrics\/m-app$/);
});

test('the server list search also finds metric names and shows the matching metric', async ({ page }) => {
  const fresh = new Date().toISOString();
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const data = path === '/servers' ? [server('metrics', 'metrics-01'), server('quiet', 'quiet-01')]
      : path === '/observed-services' ? [app('q-app', 'search-api', 'quiet', { signals: ['metrics'] })]
        : path === '/observed-services/metric-catalog' ? [
          { serviceId: 'q-app', metricName: 'jvm.memory.used', metricType: 'gauge', unit: 'By', lastAt: fresh, lastReceivedAt: fresh },
        ] : [];
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto('./servers?q=jvm.memory');
  const rows = page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('quiet-01');
  await expect(rows.first()).toContainText('search-api');
});
