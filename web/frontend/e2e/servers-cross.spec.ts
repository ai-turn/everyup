import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import type { Server } from '../src/services/api';
import { uptimeFixture } from './fixtures/uptime';

// 여러 서버를 가로지르는 화면(설계 6.6): 개요, 알림 규칙, 명령 팔레트.
// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표(attention 시나리오)를 따른다.
const EDGE = 'server_mock_edge_host_01';
const attention = (page: Page) => page.getByRole('region', { name: '주의 필요' });

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test('an outage on the overview leads to its server, and its incident opens the monitor page', async ({ page }) => {
  await page.goto('./');
  // 주의 필요의 행은 서버다(G안). 원인에 모니터 이름과 경과 시간이 있다.
  const row = attention(page).getByRole('listitem').filter({ hasText: 'edge-host-01' });
  await expect(row).toContainText('Checkout API');
  await expect(row.getByRole('link')).toHaveAttribute('href', new RegExp(`/servers/${EDGE}$`));
  // 일시정지한 모니터(Redis TCP)는 서버 목록에서처럼 문제가 아니다.
  await expect(attention(page)).not.toContainText('Redis TCP');
  // 진행 중인 장애는 최근 장애에서 모니터 페이지로 바로 간다.
  const path = `/servers/${EDGE}/monitors/uptime_mock_checkout`;
  const incident = page.getByRole('region', { name: '최근 장애' }).locator(`a[href$="${path}"]`);
  await expect(incident).toHaveCount(1);
  await expect(incident).toContainText('진행 중');
  await incident.click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout API' })).toBeVisible();
});

test('the overview and the server list agree on which servers need attention', async ({ page }) => {
  // 서버 목록의 상태 필터로 서버 이름을 모은다(앱 안에서 이동해 같은 데이터를 본다).
  const names = async (status: string) => {
    await page.goto(`./servers?status=${status}`);
    const links = page.getByRole('table', { name: '서버 그리드' }).locator('tbody a[data-row-link]');
    await expect(links.first()).toBeVisible();
    return links.allInnerTexts();
  };
  const flagged = [...await names('error'), ...await names('warn')];
  const healthy = await names('healthy');
  const idle = await names('idle');
  expect(flagged.length).toBeGreaterThan(0);
  await page.goto('./');
  const rows = attention(page).getByRole('listitem');
  await expect(rows.first()).toBeVisible();
  const listed = await rows.evaluateAll((items) => items.map((item) => ({
    name: item.querySelector('a > span:first-child span span')?.textContent?.trim() ?? '',
    state: item.querySelector('a > span:nth-child(2)')?.textContent ?? '',
  })));
  const servers = listed.map((item) => item.name);
  for (const name of flagged) expect(servers).toContain(name);
  for (const name of healthy) expect(servers).not.toContain(name);
  // 대기 서버는 아직 아무것도 연결하지 않은 것만 `대기`로 나온다(일시정지만 있는 서버는 할 일이 아니다).
  for (const item of listed.filter((entry) => !flagged.includes(entry.name))) {
    expect(idle).toContain(item.name);
    expect(item.state).toBe('대기');
  }
});

test('the overview counts servers once, Docker hosts included, and links to the server list and all logs', async ({ page }) => {
  await page.goto('./');
  // Docker 환경은 같은 ID의 서버다(ADR 0012). 서버 수에 들어 있고 따로 세지 않는다. 데모는 서버 9개와 Docker 서버 4개다.
  await expect(page.getByText('13개 서버 · 24시간', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '요약' })).toContainText('/ 13');
  await expect(page.locator('main').getByRole('link', { name: '서버 전체 보기' })).toHaveAttribute('href', /\/servers$/);
  await page.getByRole('region', { name: '요약' }).getByRole('link', { name: '에러 로그', exact: true }).click();
  await expect(page).toHaveURL(/\/logs$/);
});

test('the rule form names direct targets with their server, and a monitor page preselects its target', async ({ page }) => {
  await page.goto(`./servers/${EDGE}/monitors/uptime_mock_checkout`);
  await page.getByRole('link', { name: '알림 규칙', exact: true }).click();
  await page.getByRole('button', { name: '규칙 추가', exact: true }).click();
  const target = page.getByRole('combobox', { name: '대상', exact: true });
  await expect(target).toHaveText('edge-host-01 / Checkout API');
  await target.click();
  await expect(page.getByRole('option', { name: 'edge-host-01 / Checkout API', exact: true })).toHaveCount(1);
  await expect(page.getByRole('option', { name: /^(업타임|직접 연결|Collector) \// })).toHaveCount(0);
});

test('the command palette finds servers', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^검색/ }).first().click();
  const palette = page.getByRole('dialog', { name: '검색' });
  await expect(palette.getByRole('textbox')).toHaveAttribute('placeholder', '서버, 대상, 페이지 검색…');
  await palette.getByRole('textbox').fill('edge-host');
  // 그 서버의 모니터와 앱도 보조 문구(edge-host-01의 모니터)로 걸린다. 서버 자신은 이름이 edge-host-01로 시작한다.
  const option = palette.getByRole('option', { name: /^edge-host-01/ });
  await expect(option).toContainText('서버');
  await option.click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}$`));
});

test.describe('against the API', () => {
  test.use({ baseURL: API_URL });
  const at = '2026-11-01T00:00:00Z';

  test('a failed target list on the overview is not read as nothing to check', async ({ page }) => {
    const servers: Server[] = [{ id: 's1', name: 'web-01', createdAt: at, updatedAt: at }];
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      if (path === '/services') {
        await route.fulfill({ status: 503, json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'down' } } });
        return;
      }
      await route.fulfill({ json: { success: true, data: path === '/servers' ? servers : [] } });
    });
    await page.goto('./');
    await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toBeVisible();
    await expect(page.getByText(/불러오지 못한 영역: .*업타임/)).toBeVisible();
    await expect(attention(page)).not.toContainText(/^장애·확인 필요 없음/);
    await expect(attention(page)).toContainText('불러온 영역에서는 장애·확인 필요 없음');
  });

  test('an overview with no servers offers to add a server, Docker hosts included', async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.fulfill({ json: { success: true, data: [] } }));
    await page.goto('./');
    await expect(page.getByRole('heading', { name: '아직 모니터링 대상이 없습니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: '서버 추가', exact: true })).toHaveAttribute('href', /\/servers\/new$/);
    await expect(page.getByRole('link', { name: 'Docker 연결', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '업타임 모니터 추가' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'OpenTelemetry 직접 연결' })).toHaveCount(0);
  });

  test('a delayed Docker host on the overview is one row that opens its server', async ({ page }) => {
    // Docker Collector 자체는 수신 중이지만 그 호스트의 인프라 수집이 끊긴 경우. Docker 환경은 같은 ID의 서버이고(ADR 0012),
    // 그 인프라 리소스도 그 서버에 속한다.
    const state = await uptimeFixture(page);
    state.responses.set('GET /servers', [state.server, { id: 'docker-host', name: 'Production Docker', createdAt: at, updatedAt: at }]);
    state.responses.set('GET /agents', [{ id: 'docker-host', name: 'Production Docker', serverId: 'docker-host', version: '0.3.0', lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at }]);
    state.responses.set('GET /infrastructure-resources', [{ id: 'docker-host', name: 'Production Docker', serverId: 'docker-host', adapter: 'everyup-agent', isActive: true, lastSeenAt: new Date(Date.now() - 3_600_000).toISOString(), createdAt: at, updatedAt: at }]);
    await page.goto('./');
    // 서버 목록의 판정과 같은 행 하나다(Docker Collector는 정상이라 따로 나오지 않는다). 행은 그 서버로 간다.
    const item = attention(page).getByRole('link', { name: /Production Docker/ });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('확인 필요');
    // 이 fixture에는 서버 화면의 데이터가 없어 이동한 뒤의 화면은 보지 않는다.
    await expect(item).toHaveAttribute('href', /\/servers\/docker-host$/);
  });
});
