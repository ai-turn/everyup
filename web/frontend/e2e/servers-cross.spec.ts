import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import type { Project, Server } from '../src/services/api';
import { uptimeFixture } from './fixtures/uptime';

// 여러 서버를 가로지르는 화면(설계 6.6): 개요, 그룹, 알림 규칙, 명령 팔레트.
// 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표(attention 시나리오)를 따른다.
const EDGE = 'server_mock_edge_host_01';
const crumbs = (page: Page) => page.getByRole('navigation', { name: '현재 위치', exact: true });
const sidebarCurrent = (page: Page) => page.locator('aside a[aria-current="page"]');
const attention = (page: Page) => page.getByRole('region', { name: '현재 확인 필요' });
const groupMembers = (page: Page) => page.getByRole('table', { name: '그룹 구성 그리드', exact: true }).locator('tbody tr');
const serverGroup = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) }).getByText(/^그룹 /);

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test('an outage on the overview opens its monitor page and is linked to its incident once', async ({ page }) => {
  await page.goto('./');
  const path = `/servers/${EDGE}/monitors/uptime_mock_checkout`;
  const items = attention(page).locator(`a[href$="${path}"]`);
  await expect(items).toHaveCount(1);
  // 서버 이름을 함께 쓰고, 장애 이력의 진행 중 장애와 이어져 경과 시간이 보인다.
  await expect(items).toContainText('edge-host-01 / Checkout API');
  await expect(items).toContainText('경과');
  // 일시정지한 모니터(Redis TCP)는 서버 목록에서처럼 문제가 아니다.
  await expect(attention(page)).not.toContainText('Redis TCP');
  await items.click();
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
  // 정상과 대기 서버(일시정지 모니터만 있는 서버, 대상이 없는 서버)는 개요에 나오면 안 된다.
  const calm = [...await names('healthy'), ...await names('idle')];
  expect(flagged.length).toBeGreaterThan(0);
  await page.goto('./');
  await expect(attention(page).getByRole('listitem').first()).toBeVisible();
  // 확인 필요는 세 건까지 먼저 보이고 나머지는 제자리에서 펼친다. 모두 펼쳐서 비교한다.
  await attention(page).getByRole('button', { name: /모두 보기$/ }).click();
  // 항목의 첫 줄은 대상 제목이다. 직접 대상은 `서버 / 대상`, 서버와 이름이 같은 인프라는 서버 이름이다.
  const items = await attention(page).getByRole('listitem').getByRole('link').allInnerTexts();
  const serverOf = (text: string) => text.trim().split('\n')[0].split(' / ')[0].trim();
  const servers = items.map(serverOf);
  for (const name of flagged) expect(servers).toContain(name);
  for (const name of calm) expect(servers).not.toContain(name);
});

test('the overview scope counts servers once, Docker hosts included, with all logs on the scope line', async ({ page }) => {
  await page.goto('./');
  const scope = page.getByRole('navigation', { name: '모니터링 범위' });
  // Docker 환경은 같은 ID의 서버다(ADR 0012). 서버 수에 들어 있고 따로 세지 않는다. 데모는 서버 9개와 Docker 서버 4개다.
  await expect(scope.getByRole('link', { name: '서버 13', exact: true })).toHaveAttribute('href', /\/servers$/);
  await expect(scope).not.toContainText('Docker 환경');
  for (const old of ['업타임 모니터', '직접 연결 서비스', '인프라 리소스']) await expect(scope).not.toContainText(old);
  await scope.getByRole('link', { name: '전체 로그', exact: true }).click();
  await expect(page).toHaveURL(/\/logs$/);
});

test('a group lists its servers with the server list status and keeps the group while inside a server', async ({ page }) => {
  await page.goto('./servers');
  // 서버 목록 행의 원인 문구(StatusLight 아래 줄)
  const listCause = await page.getByRole('table', { name: '서버 그리드' }).locator('tbody tr').filter({ hasText: 'edge-host-01' })
    .getByText(/응답 없음/).first().innerText();
  await page.getByRole('link', { name: '그룹', exact: true }).click();
  await page.getByRole('link', { name: 'Production', exact: true }).click();
  const member = groupMembers(page).filter({ hasText: 'edge-host-01' });
  await expect(member).toContainText('서버');
  await expect(member).toContainText('장애');
  await expect(member).toContainText(listCause);
  // 직접 대상(모니터, 앱, 인프라)은 서버에 들어 있으므로 따로 나오지 않는다.
  await expect(groupMembers(page).getByRole('link', { name: 'Checkout API', exact: true })).toHaveCount(0);
  await member.getByRole('link', { name: 'edge-host-01', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}$`));
  await expect(crumbs(page)).toHaveText(/^그룹.*Production.*edge-host-01$/);
  await expect(sidebarCurrent(page)).toHaveText('그룹');
  // 탭을 옮기고 대상으로 들어가도 그룹 안이다.
  await page.getByRole('tab', { name: /^업타임/ }).click();
  await page.getByRole('link', { name: 'Checkout API', exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/monitors/uptime_mock_checkout`));
  await expect(crumbs(page)).toHaveText(/^그룹.*Production.*edge-host-01.*Checkout API$/);
  await expect(sidebarCurrent(page)).toHaveText('그룹');
});

test('a Docker server in a group is a server member with its container outage as the cause', async ({ page }) => {
  await page.goto('./projects/project_mock_production');
  const member = groupMembers(page).filter({ hasText: '서버 · Docker Collector' }).filter({ has: page.getByRole('link', { name: 'prod-server', exact: true }) });
  await expect(member).toContainText('장애');
  await expect(member).toContainText('payment-worker');
  // 컨테이너는 서버 행의 원인이 말한다. 따로 한 줄 더 나오지 않는다.
  await expect(groupMembers(page).filter({ has: page.getByRole('link', { name: 'payment-worker', exact: true }) })).toHaveCount(0);
  await member.getByRole('link', { name: 'prod-server', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/agent_demo_01$/);
  await expect(page.getByRole('heading', { level: 1, name: 'prod-server' })).toBeVisible();
});

// Docker 환경은 같은 ID의 서버다(ADR 0012). 그룹 목록은 서버 수 하나만 세고, Docker 서버도 그 안에 한 번만 든다.
test('a group counts its Docker server once, as a server', async ({ page }) => {
  await page.goto('./projects');
  const table = page.getByRole('table', { name: '그룹 그리드' });
  await expect(table.getByRole('columnheader')).not.toContainText(['Docker 환경']);
  // Production: 직접 연결한 서버 5개(edge-host-01, db-primary-01, payments-api, inventory-api, Public status)와 prod-server.
  await expect(table.locator('tbody tr').filter({ hasText: 'Production' }).getByRole('cell').last()).toHaveText('6');
});

test('adding a server to a group shows the group on the server', async ({ page }) => {
  await page.goto('./projects/project_mock_staging');
  await page.getByRole('button', { name: '대상 추가', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '대상 추가', exact: true });
  // 대상은 서버 한 종류다. Docker 호스트도 서버로 나온다(ADR 0012).
  await expect(dialog.locator('label').filter({ hasText: 'worker-cluster' })).toBeVisible();
  await dialog.locator('label').filter({ hasText: 'Mail relay' }).click();
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // mock의 변경은 앱 안에서만 남으므로 링크로 들어간다.
  await groupMembers(page).getByRole('link', { name: 'Mail relay', exact: true }).click();
  await expect(serverGroup(page)).toHaveText('그룹 Staging');
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
  await expect(palette.getByRole('textbox')).toHaveAttribute('placeholder', '서버, 대상, 그룹, 페이지 검색…');
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
  const project: Project = { id: 'p1', name: 'Staging', agentCount: 0, monitorCount: 0, observedServiceCount: 0, infrastructureResourceCount: 0, serverCount: 0, createdAt: at, updatedAt: at };

  test('adding servers to a group reads each server first and keeps the dialog open on a name clash', async ({ page }) => {
    // 목록의 이름은 옛 이름이고, 다시 읽으면 새 이름이다. 요청은 다시 읽은 서버로 만든다.
    const servers: Server[] = [
      { id: 's1', name: 'web-01 (old)', description: 'old', createdAt: at, updatedAt: at },
      { id: 's2', name: 'api-01', createdAt: at, updatedAt: at },
    ];
    const puts: { id: string; body: unknown }[] = [];
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      const match = path.match(/^\/servers\/([^/]+)$/);
      if (match && request.method() === 'PUT') {
        puts.push({ id: match[1], body: request.postDataJSON() });
        if (match[1] === 's2') {
          await route.fulfill({ status: 409, json: { success: false, error: { code: 'SERVER_NAME_TAKEN', message: 'server name already exists in this group' } } });
          return;
        }
        servers[0] = { ...servers[0], projectId: 'p1' };
        await route.fulfill({ json: { success: true, data: servers[0] } });
        return;
      }
      if (match) {
        const found = servers.find((row) => row.id === match[1])!;
        await route.fulfill({ json: { success: true, data: match[1] === 's1' ? { ...found, name: 'web-01', description: 'new' } : found } });
        return;
      }
      const data = path === '/projects' ? [project] : path === '/servers' ? servers : [];
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('./projects/p1');
    // 빈 그룹은 빈 화면에도 같은 버튼이 있다.
    await page.getByRole('button', { name: '대상 추가', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: '대상 추가', exact: true });
    await dialog.locator('label').filter({ hasText: 'web-01 (old)' }).click();
    await dialog.locator('label').filter({ hasText: 'api-01' }).click();
    await dialog.getByRole('button', { name: '추가', exact: true }).click();
    // 실패한 서버와 까닭을 대화 상자에 보이고 닫지 않는다. 성공한 서버는 반영된다.
    await expect(dialog.getByRole('alert')).toContainText('1개를 추가하지 못했습니다');
    await expect(dialog.getByRole('alert')).toContainText('api-01: 이 그룹에 같은 이름의 서버가 있습니다');
    await expect(groupMembers(page).filter({ hasText: 'web-01' })).toHaveCount(1);
    await expect(dialog.locator('label').filter({ hasText: 'api-01' }).getByRole('checkbox')).toBeChecked();
    expect(puts.find((put) => put.id === 's1')?.body).toEqual({ name: 'web-01', description: 'new', projectId: 'p1' });
  });

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
    await expect(attention(page)).not.toContainText('현재 확인이 필요한 이상이 없습니다');
    await expect(attention(page)).toContainText('전체가 정상인지는 아직 알 수 없습니다');
  });

  test('an overview with no servers or Docker environments offers to add a server or connect Docker', async ({ page }) => {
    await page.route('**/api/v1/**', (route) => route.fulfill({ json: { success: true, data: [] } }));
    await page.goto('./');
    await expect(page.getByRole('heading', { name: '아직 모니터링 대상이 없습니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: '서버 추가', exact: true })).toHaveAttribute('href', /\/servers\/new$/);
    await expect(page.getByRole('link', { name: 'Docker 연결', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '업타임 모니터 추가' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'OpenTelemetry 직접 연결' })).toHaveCount(0);
  });

  test('removing a server from a group explains a name clash among ungrouped servers and keeps it', async ({ page }) => {
    const servers: Server[] = [{ id: 's1', name: 'web-01', projectId: 'p1', createdAt: at, updatedAt: at }];
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      if (path === '/servers/s1' && request.method() === 'PUT') {
        await route.fulfill({ status: 409, json: { success: false, error: { code: 'SERVER_NAME_TAKEN', message: 'server name already exists in this group' } } });
        return;
      }
      const data = path === '/projects' ? [project] : path === '/servers' ? servers : path === '/servers/s1' ? servers[0] : [];
      await route.fulfill({ json: { success: true, data } });
    });
    await page.goto('./projects/p1');
    await page.getByRole('button', { name: 'web-01 그룹에서 빼기', exact: true }).click();
    await expect(page.getByText('web-01: 미분류에 같은 이름의 서버가 있습니다', { exact: true })).toBeVisible();
    await expect(page.getByText(/already exists/)).toHaveCount(0);
    await expect(groupMembers(page).filter({ hasText: 'web-01' })).toHaveCount(1);
  });

  test('a group whose server list failed is not called empty, nor is the group list', async ({ page }) => {
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      if (path === '/servers') {
        await route.fulfill({ status: 503, json: { success: false, error: { code: 'INTERNAL_ERROR', message: 'down' } } });
        return;
      }
      await route.fulfill({ json: { success: true, data: path === '/projects' ? [{ ...project, serverCount: 2 }] : [] } });
    });
    await page.goto('./projects/p1');
    await expect(page.getByText('일부 모니터링 정보를 불러오지 못했습니다')).toBeVisible();
    await expect(page.getByText(/서버 정보를 제외한 결과입니다/)).toBeVisible();
    await expect(page.getByText('아직 배정된 대상이 없습니다')).toHaveCount(0);
    await page.goto('./projects');
    const row = page.getByRole('table', { name: '그룹 그리드' }).locator('tbody tr').filter({ hasText: 'Staging' });
    await expect(row).toContainText('상태 확인 불가');
    await expect(row).not.toContainText('대상 없음');
    // 서버 개수는 0이 아니라 모름(-)이다.
    await expect(row.getByRole('cell').last()).toHaveText('-');
  });

  test('a delayed Docker host on the overview opens its server infrastructure tab', async ({ page }) => {
    // Docker Collector 자체는 수신 중이지만 그 호스트의 인프라 수집이 끊긴 경우. Docker 환경은 같은 ID의 서버이고(ADR 0012),
    // 그 인프라 리소스도 그 서버에 속한다.
    const state = await uptimeFixture(page);
    state.responses.set('GET /servers', [state.server, { id: 'docker-host', name: 'Production Docker', createdAt: at, updatedAt: at }]);
    state.responses.set('GET /agents', [{ id: 'docker-host', name: 'Production Docker', serverId: 'docker-host', version: '0.3.0', lastSeenAt: new Date().toISOString(), createdAt: at, updatedAt: at }]);
    state.responses.set('GET /infrastructure-resources', [{ id: 'docker-host', name: 'Production Docker', serverId: 'docker-host', adapter: 'everyup-agent', isActive: true, lastSeenAt: new Date(Date.now() - 3_600_000).toISOString(), createdAt: at, updatedAt: at }]);
    await page.goto('./');
    // 서버 목록의 판정과 같은 항목 하나다(Docker Collector는 정상이라 따로 나오지 않는다).
    const item = attention(page).getByRole('link', { name: /^Production Docker.*데이터 확인 필요/ });
    await expect(item).toHaveCount(1);
    await item.click();
    await expect(page).toHaveURL(/\/servers\/docker-host\/infrastructure$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Production Docker' })).toBeVisible();
  });
});
