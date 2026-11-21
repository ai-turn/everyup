import { expect, test, type Locator, type Page } from '@playwright/test';
import { API_URL } from './fixtures/ports';
import { menuItem } from './fixtures/menu';
import type { ObservedService } from '../src/services/api';
import { monitor, uptimeFixture } from './fixtures/uptime';

// 서버 상세의 기능 탭이 같은 틀을 쓰는지 확인한다(Task 10b). 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다.
// 앱은 자기 페이지가 있다(DESIGN.md §4.7 대상 상세, 2026-11-21). 서버의 로그·API 요청·메트릭 탭은 앱 목록이다.
const EDGE = 'server_mock_edge_host_01';      // 모니터 2개, 로그 앱 2개, API·메트릭 앱 1개(orders-api), 메모리 72.8%
const PAYMENTS = 'server_mock_payments_api';  // 모니터 1개
const EMPTY = 'server_mock_staging_empty';
const panel = (page: Page) => page.getByRole('tabpanel');
const tablist = (page: Page) => page.getByRole('tablist', { name: '서버 기능' });
const serverHeader = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
const appHeader = (page: Page) => page.locator('#main-content header').first();
const actionSlot = (page: Page) => page.getByRole('group', { name: '탭 조작' });
const chartOf = (heading: Locator) => heading.locator('xpath=ancestor::section[1]');
// 탭 본문이 그려졌다(목록 탭에는 제목이 없을 수 있다).
const painted = (page: Page) => expect(panel(page).locator('*').first()).toBeVisible();

const top = async (locator: Locator) => (await locator.boundingBox())!.y;

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 844 };

// 각 탭에서 사용자가 처음 보는 데이터 요소가 탭 줄 아래 몇 px에서 시작하는지와 그 상한. 패널 머리(제목·상태·연결 정보)가
// 데이터를 밀어내면 실패한다. 상한은 1440×1000에서 잰 값에 30px 정도의 여유(글꼴 대체)를 둔 값이다.
// 2026-11-21(간격 체계 P6): 화면 위쪽 절대 좌표 대신 탭 줄 아래 거리를 잰다. 서버 머리말이 바뀔 때마다 상한을 올려야 했다
// (#140). 탭 줄의 위치는 아래 'the tab row does not move between tabs'가, 블록 사이 간격은 spacing-rhythm spec이 지킨다.
// 앱 페이지는 앱의 탭 줄(앱 데이터)에서 잰다. 앱의 머리말이 탭 줄 위에 있으므로 탭 아래에는 데이터만 있다(76·227·152px, 2026-11-21).
const FIRST_CONTENT: [string, string, string, (page: Page) => Locator, number][] = [
  // 수치 타일의 첫 값(24시간 업타임)
  ['monitor detail', `${EDGE}/uptime/uptime_mock_checkout`, '서버 기능', (page) => panel(page).locator('section', { has: page.getByRole('heading', { name: '주요 지표' }) }).locator('dd').first(), 246],
  // 첫 차트 카드
  ['infrastructure', `${EDGE}/infrastructure`, '서버 기능', (page) => chartOf(panel(page).getByRole('heading', { name: 'CPU', exact: true })), 154],
  // 로그 발생량 차트 카드
  ['app logs', `${EDGE}/apps/observed_mock_checkout?tab=logs`, '앱 데이터', (page) => chartOf(panel(page).getByRole('heading', { name: '로그 발생량', exact: true })), 106],
  // 수치 타일의 첫 값(요청 수)
  ['app requests', `${EDGE}/apps/observed_mock_orders?tab=requests`, '앱 데이터', (page) => panel(page).getByRole('button', { name: /^요청 수/ }).locator('.type-kpi'), 257],
  // 첫 지표 차트 카드
  ['app metrics', `${EDGE}/apps/observed_mock_orders?tab=metrics`, '앱 데이터', (page) => chartOf(panel(page).getByRole('heading', { level: 3 }).first()), 182],
];

test.describe('at 1440x1000', () => {
  test.use({ viewport: DESKTOP });

  for (const [name, path, tabs, first, limit] of FIRST_CONTENT) {
    test(`the ${name} data starts within its measured distance below the tabs`, async ({ page }) => {
      await page.goto(`./servers/${path}`);
      await expect(first(page)).toBeVisible();
      const row = (await page.getByRole('tablist', { name: tabs }).boundingBox())!;
      const y = await top(first(page)) - (row.y + row.height);
      test.info().annotations.push({ type: 'first-content-below-tabs', description: `${name}: ${Math.round(y)}` });
      expect(y).toBeLessThan(limit);
    });
  }

  test('the tab row does not move between tabs', async ({ page }) => {
    await page.goto(`./servers/${EDGE}`);
    const tops: number[] = [];
    for (const tab of ['개요', '업타임', '인프라', '로그', 'API 요청', '메트릭']) {
      await tablist(page).getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await painted(page);
      tops.push(await top(tablist(page)));
    }
    // 원인 대상(Checkout API)을 보는 중에는 원인이 링크가 아니라 글자다. 그래도 머리말의 높이는 같다.
    await page.goto(`./servers/${EDGE}/uptime/uptime_mock_checkout`);
    await expect(panel(page).getByRole('heading', { level: 2 })).toBeVisible();
    tops.push(await top(tablist(page)));
    expect(new Set(tops.map(Math.round)).size).toBe(1);
  });

  test('each tab and app page has one h1 and never skips a heading level', async ({ page }) => {
    for (const path of ['', '/uptime', '/uptime/uptime_mock_checkout', '/infrastructure', '/logs', '/api', '/metrics',
      '/apps/observed_mock_checkout?tab=logs', '/apps/observed_mock_orders?tab=requests', '/apps/observed_mock_orders?tab=traces', '/apps/observed_mock_orders?tab=metrics']) {
      await page.goto(`./servers/${EDGE}${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await painted(page);
      await expect(page.getByText('불러오는 중', { exact: true })).toHaveCount(0);
      // 화면에서 숨긴(sr-only) 제목도 제목 구조에 들어간다.
      const levels = await page.locator('#main-content').evaluate((main) => [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1])));
      expect(levels.filter((level) => level === 1), path).toHaveLength(1);
      levels.forEach((level, index) => { if (index > 0) expect(level, `${path} ${levels.join(',')}`).toBeLessThanOrEqual(levels[index - 1] + 1); });
    }
  });

  test('Tab moves from the tab row to the tab actions and then into the panel', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/uptime`);
    await expect(actionSlot(page).getByRole('button', { name: '모니터 추가' })).toBeVisible();
    await tablist(page).getByRole('tab', { selected: true }).focus();
    const slotStops = await actionSlot(page).locator('button').count();
    for (let index = 0; index < slotStops; index += 1) {
      await page.keyboard.press('Tab');
      expect(await actionSlot(page).evaluate((slot) => slot.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Tab');
    expect(await panel(page).evaluate((element) => element.contains(document.activeElement))).toBe(true);
  });

  test('refresh is one icon beside the update time and settings is an icon on the server name line', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/logs`);
    const refresh = page.getByRole('button', { name: '새로고침', exact: true });
    await expect(refresh).toHaveCount(1);
    // 갱신 시각·새로고침·자동 갱신이 한 묶음이다.
    await expect(page.getByRole('group', { name: '데이터 갱신' }).getByRole('button', { name: '새로고침', exact: true })).toBeVisible();
    const settings = page.getByRole('button', { name: '서버 설정', exact: true });
    // 아이콘 버튼이라 보이는 글자가 없다. 이름은 aria-label이 맡는다.
    await expect(settings).toHaveText('');
    const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    const button = (await settings.boundingBox())!;
    // 버튼의 세로 범위가 제목의 세로 범위와 겹친다.
    expect(button.y).toBeLessThan(title.y + title.height);
    expect(button.y + button.height).toBeGreaterThan(title.y);
  });

  test('the tab row holds the add action of the open tab', async ({ page }) => {
    for (const [path, label] of [['uptime', '모니터 추가'], ['uptime/uptime_mock_store', '모니터 추가'], ['logs', '로그 연결'],
      ['api', 'API 연결'], ['metrics', '메트릭 연결']] as const) {
      await page.goto(`./servers/${EDGE}/${path}`);
      await expect(actionSlot(page).getByRole('button', { name: label, exact: true })).toBeVisible();
      // 패널 안에 같은 버튼을 한 번 더 두지 않는다.
      await expect(panel(page).getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }
    // 업타임 목록의 보기 전환도 이 자리다.
    await page.goto(`./servers/${EDGE}/uptime`);
    await expect(actionSlot(page).getByRole('button', { name: '카드' })).toBeVisible();

    for (const path of ['', '/infrastructure']) {
      await page.goto(`./servers/${EDGE}${path}`);
      await expect(panel(page).getByRole('heading').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /추가$|연결$/ })).toHaveCount(0);
    }
  });

  test('a capability without targets has no tab action and its prompt uses the same words', async ({ page }) => {
    for (const [path, label] of [['uptime', '모니터 추가'], ['infrastructure', '인프라 연결'], ['logs', '로그 연결'], ['api', 'API 연결'], ['metrics', '메트릭 연결']] as const) {
      await page.goto(`./servers/${EMPTY}/${path}`);
      await expect(panel(page).getByRole('button', { name: label, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(1);
    }
  });

  test('infrastructure says why it needs attention and is titled once', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/infrastructure`);
    await expect(panel(page).getByText('확인 필요', { exact: true })).toBeVisible();
    await expect(panel(page).getByText(/메모리 72\.8%, 기준 70%/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'edge-host-01' })).toHaveCount(1);
    await expect(panel(page).getByRole('heading', { name: '인프라 추세' })).toHaveCount(0);

    await panel(page).getByRole('button', { name: '24h', exact: true }).click();
    await expect(page).toHaveURL(/[?&]range=24h/);
    await page.reload();
    await expect(panel(page).getByRole('button', { name: '24h', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the server log list calls its targets apps', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/logs`);
    await expect(panel(page).getByText('앱 2개', { exact: false })).toBeVisible();
    await expect(page.getByRole('table', { name: '앱 그리드' })).toBeVisible();
    await expect(panel(page)).not.toContainText('서비스');

    // 로그, API, 메트릭을 함께 가진 앱은 로그 연결만 해제한다. 사이드바의 메뉴가 없어지므로 "메뉴"라고 쓰지 않는다.
    await page.goto(`./servers/${EDGE}/apps/observed_mock_orders?tab=logs`);
    await (await menuItem(appHeader(page), '로그 연결 해제')).click();
    const dialog = page.getByRole('dialog', { name: '로그 연결을 해제할까요?' });
    await expect(dialog).toContainText('이 앱의 로그 데이터');
    await expect(dialog).not.toContainText('메뉴');
    await expect(dialog).not.toContainText('서비스');
  });

  test('moving an app with several signals says all of its data moves', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/apps/observed_mock_orders`);
    await (await menuItem(appHeader(page), '다른 서버로 옮기기')).click();
    const dialog = page.getByRole('dialog', { name: '다른 서버로 옮기기' });
    await expect(dialog).toContainText('옮길 앱: orders-api');
    await expect(dialog).toContainText('이 앱의 로그, API 요청, 메트릭 데이터가 함께 옮겨집니다.');
  });

  test('the cause link is plain text while its target is open', async ({ page }) => {
    await page.goto(`./servers/${EDGE}`);
    await expect(serverHeader(page).getByRole('link', { name: /Checkout API 응답 없음/ })).toBeVisible();
    await page.goto(`./servers/${EDGE}/uptime/uptime_mock_checkout`);
    await expect(serverHeader(page).getByText(/Checkout API 응답 없음/)).toBeVisible();
    await expect(serverHeader(page).getByRole('link', { name: /Checkout API 응답 없음/ })).toHaveCount(0);
  });

  test('the group is a status line item', async ({ page }) => {
    await page.goto(`./servers/${EDGE}`);
    await expect(serverHeader(page).getByText('그룹 Production', { exact: true })).toBeVisible();
    await expect(serverHeader(page).locator('dd')).toHaveCount(0);
  });

  test('server tab panels fold their connection details, an app page shows them like a Docker service', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/infrastructure`);
    const details = panel(page).locator('details');
    await expect(details.getByText('연결 정보')).toBeVisible();
    await expect(panel(page).getByRole('button', { name: '키 재발급' })).toBeHidden();
    // 접힌 상태에서도 연결 중지와 마지막 수집은 상태 줄에 있다.
    await expect(panel(page).getByRole('button', { name: '연결 중지' })).toBeVisible();
    await expect(panel(page).getByText(/^마지막 수집/)).toBeVisible();
    await details.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).getByRole('button', { name: '키 재발급' })).toBeVisible();

    // 대상 상세의 머리말은 넓은 화면에서 속성을 펼쳐 둔다(좁은 화면에서만 접는다).
    await page.goto(`./servers/${EDGE}/apps/observed_mock_checkout`);
    await expect(appHeader(page).getByRole('button', { name: '키 재발급' })).toBeVisible();
    await expect(appHeader(page).getByRole('button', { name: '연결 중지' })).toBeVisible();
    await expect(appHeader(page).getByText(/^마지막 수집/)).toBeVisible();
  });
});

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('a monitor detail links back to its list', async ({ page }) => {
      await page.goto(`./servers/${EDGE}/uptime/uptime_mock_store`);
      await page.getByRole('group', { name: '탭 조작' }).getByRole('link', { name: '모니터 목록' }).click();
      await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));

      await page.goto(`./servers/${PAYMENTS}/uptime`);
      await expect(panel(page).getByRole('heading', { level: 2, name: 'Payment endpoint' })).toBeVisible();
      await expect(page.getByRole('group', { name: '탭 조작' }).getByRole('link', { name: '모니터 목록' })).toHaveCount(0);
    });

    test('the back link and the tab action share one line right under the tabs', async ({ page }) => {
      await page.goto(`./servers/${EDGE}/uptime/uptime_mock_store`);
      const back = (await actionSlot(page).getByRole('link', { name: '모니터 목록' }).boundingBox())!;
      const add = (await actionSlot(page).getByRole('button', { name: '모니터 추가' }).boundingBox())!;
      expect(Math.abs((back.y + back.height / 2) - (add.y + add.height / 2))).toBeLessThan(2);
      // 패널은 조작 줄 바로 다음 블록이다(페이지 블록 24px). 패널 위에 링크만 있는 줄이 다시 생기면 실패한다.
      const slotBottom = (await actionSlot(page).boundingBox())!;
      const title = await top(panel(page).getByRole('heading', { level: 2 }).first());
      expect(title - (slotBottom.y + slotBottom.height)).toBeLessThan(40);
    });
  });
}

test('no tab or app page scrolls the page sideways at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['', '/uptime', '/uptime/uptime_mock_store', '/infrastructure', '/logs', '/api', '/metrics',
    '/apps/observed_mock_checkout', '/apps/observed_mock_orders?tab=requests', '/apps/observed_mock_orders?tab=metrics']) {
    await page.goto(`./servers/${EDGE}${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await painted(page);
    await expect(page.getByText('불러오는 중', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth), path).toBeLessThanOrEqual(1);
  }
});

// 대상이 하나뿐인 탭의 원인 링크. 데모 데이터에는 이런 서버가 없어서 API를 가로챈다.
test.describe('the cause link on a tab with one target', () => {
  test.use({ baseURL: API_URL, viewport: DESKTOP });
  const at = '2026-11-01T00:00:00Z';

  async function serve(page: Page, apps: ObservedService[]) {
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      const data = path === '/servers' ? [{ id: 's1', name: 'web-01', createdAt: at, updatedAt: at }]
        : path === '/observed-services' ? apps : [];
      await route.fulfill({ json: { success: true, data } });
    });
  }

  test('the logs overview links the cause to the app page', async ({ page }) => {
    // 데이터 대기 중인 로그 앱 하나가 서버의 원인이다. 로그 탭의 첫 화면은 서버 범위의 요약이지 그 앱의 상세가 아니다.
    await serve(page, [{ id: 'a1', name: 'worker', serverId: 's1', signals: ['logs'], isActive: true, createdAt: at, updatedAt: at } as ObservedService]);
    await page.goto('./servers/s1/logs');
    await expect(page.getByRole('table', { name: '앱 그리드' })).toBeVisible();
    const cause = serverHeader(page).getByRole('link', { name: 'worker 데이터 대기 중' });
    await expect(cause).toHaveAttribute('href', /\/servers\/s1\/apps\/a1$/);
    await cause.click();
    await expect(page.getByRole('heading', { level: 1, name: 'worker' })).toBeVisible();
    await expect(appHeader(page).getByText('데이터 대기 중', { exact: true })).toBeVisible();
  });

  test('the uptime tab with its only monitor down shows the cause as plain text', async ({ page }) => {
    // 모니터 상세가 부르는 이력 API까지 응답하는 업타임 fixture를 쓴다.
    const state = await uptimeFixture(page);
    state.monitors = [monitor('m1', { serverId: 's1', status: 'unhealthy' })];
    state.responses.set('GET /servers', [{ id: 's1', name: 'web-01', createdAt: at, updatedAt: at }]);
    await page.goto('./servers/s1');
    await expect(serverHeader(page).getByRole('link', { name: /^Public API 응답 없음/ })).toBeVisible();
    await page.goto('./servers/s1/uptime');
    await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
    await expect(serverHeader(page).getByText(/^Public API 응답 없음/)).toBeVisible();
    await expect(serverHeader(page).getByRole('link', { name: /^Public API 응답 없음/ })).toHaveCount(0);
  });
});
