import { expect, test, type Locator, type Page } from '@playwright/test';

// 서버 상세의 기능 탭이 같은 틀을 쓰는지 확인한다(Task 10b). 서버 구성은 src/mocks/SCENARIOS.md의 "Demo servers" 표를 따른다.
const EDGE = 'server_mock_edge_host_01';      // 모니터 2개, 로그 앱 2개, API·메트릭 앱 1개(orders-api), 메모리 72.8%
const PAYMENTS = 'server_mock_payments_api';  // 모니터 1개
const EMPTY = 'server_mock_staging_empty';
const panel = (page: Page) => page.getByRole('tabpanel');
const tablist = (page: Page) => page.getByRole('tablist', { name: '서버 기능' });
const serverHeader = (page: Page) => page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
const actionSlot = (page: Page) => page.getByRole('group', { name: '탭 조작' });
const chartOf = (heading: Locator) => heading.locator('xpath=ancestor::section[1]');

const top = async (locator: Locator) => (await locator.boundingBox())!.y;

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 844 };

// 각 탭의 첫 차트(또는 수치 타일, 로그 목록). 머리말과 패널의 머리 요소가 이것을 첫 화면 밖으로 밀어내면 안 된다.
const FIRST_CONTENT: [string, string, (page: Page) => Locator][] = [
  ['monitor detail', `uptime/uptime_mock_checkout`, (page) => panel(page).locator('section', { has: page.getByRole('heading', { name: '주요 지표' }) })],
  ['infrastructure', 'infrastructure', (page) => chartOf(panel(page).getByRole('heading', { name: 'CPU', exact: true }))],
  ['log app detail', 'logs/observed_mock_checkout', (page) => chartOf(panel(page).getByRole('heading', { name: '로그 발생량', exact: true }))],
  ['metrics', 'metrics', (page) => chartOf(panel(page).getByRole('heading', { level: 3 }).first())],
];

test.describe('at 1440x1000', () => {
  test.use({ viewport: DESKTOP });

  for (const [name, path, first] of FIRST_CONTENT) {
    test(`the ${name} content starts on the first screen`, async ({ page }) => {
      await page.goto(`./servers/${EDGE}/${path}`);
      await expect(first(page)).toBeVisible();
      const y = await top(first(page));
      test.info().annotations.push({ type: 'first-content-y', description: `${name}: ${Math.round(y)}` });
      expect(y).toBeLessThan(600);
    });
  }

  test('the tab row does not move between tabs', async ({ page }) => {
    await page.goto(`./servers/${EDGE}`);
    const tops: number[] = [];
    for (const tab of ['개요', '업타임', '인프라', '로그', 'API 요청', '메트릭']) {
      await tablist(page).getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await expect(panel(page).getByRole('heading').first()).toBeVisible();
      tops.push(await top(tablist(page)));
    }
    // 원인 대상(Checkout API)을 보는 중에는 원인이 링크가 아니라 글자다. 그래도 머리말의 높이는 같다.
    await page.goto(`./servers/${EDGE}/uptime/uptime_mock_checkout`);
    await expect(panel(page).getByRole('heading', { level: 2 })).toBeVisible();
    tops.push(await top(tablist(page)));
    expect(new Set(tops.map(Math.round)).size).toBe(1);
  });

  test('there is one refresh button and it sits on the server name line', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/logs/observed_mock_checkout`);
    const refresh = page.getByRole('button', { name: '새로고침', exact: true });
    await expect(refresh).toHaveCount(1);
    const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    const button = (await refresh.boundingBox())!;
    // 버튼의 세로 범위가 제목의 세로 범위와 겹친다.
    expect(button.y).toBeLessThan(title.y + title.height);
    expect(button.y + button.height).toBeGreaterThan(title.y);
  });

  test('the tab row holds the add action of the open tab', async ({ page }) => {
    for (const [path, label] of [['uptime', '모니터 추가'], ['uptime/uptime_mock_store', '모니터 추가'], ['logs', '로그 연결'],
      ['logs/observed_mock_checkout', '로그 연결'], ['api', 'API 연결'], ['metrics', '메트릭 연결']] as const) {
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
    await page.goto(`./servers/${EDGE}/logs/observed_mock_orders`);
    await panel(page).getByRole('button', { name: '로그 연결 해제' }).click();
    const dialog = page.getByRole('dialog', { name: '로그 연결을 해제할까요?' });
    await expect(dialog).toContainText('이 앱의 로그 데이터');
    await expect(dialog).not.toContainText('메뉴');
    await expect(dialog).not.toContainText('서비스');
  });

  test('moving an app with several signals says all of its data moves', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/logs/observed_mock_orders`);
    await panel(page).getByRole('button', { name: '다른 서버로 옮기기' }).click();
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

  test('connection details are folded on desktop too', async ({ page }) => {
    await page.goto(`./servers/${EDGE}/logs/observed_mock_checkout`);
    const details = panel(page).locator('details');
    await expect(details.getByText('연결 정보')).toBeVisible();
    await expect(panel(page).getByRole('button', { name: '키 재발급' })).toBeHidden();
    // 접힌 상태에서도 연결 중지와 마지막 수집은 상태 줄에 있다.
    await expect(panel(page).getByRole('button', { name: '연결 중지' })).toBeVisible();
    await expect(panel(page).getByText(/^마지막 수집/)).toBeVisible();
    await details.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).getByRole('button', { name: '키 재발급' })).toBeVisible();
  });
});

for (const viewport of [DESKTOP, PHONE]) {
  test.describe(`at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('a target detail links back to its list', async ({ page }) => {
      await page.goto(`./servers/${EDGE}/uptime/uptime_mock_store`);
      await panel(page).getByRole('link', { name: '모니터 목록' }).click();
      await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/uptime$`));

      await page.goto(`./servers/${EDGE}/logs/observed_mock_checkout`);
      await panel(page).getByRole('link', { name: '앱 목록' }).click();
      await expect(page).toHaveURL(new RegExp(`/servers/${EDGE}/logs$`));

      await page.goto(`./servers/${PAYMENTS}/uptime`);
      await expect(panel(page).getByRole('heading', { level: 2, name: 'Payment endpoint' })).toBeVisible();
      await expect(panel(page).getByRole('link', { name: '모니터 목록' })).toHaveCount(0);
    });
  });
}

test('no tab scrolls the page sideways at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['', '/uptime', '/uptime/uptime_mock_store', '/infrastructure', '/logs', '/logs/observed_mock_checkout', '/api', '/metrics']) {
    await page.goto(`./servers/${EDGE}${path}`);
    await expect(panel(page).getByRole('heading').first()).toBeAttached();
    await expect(page.getByText('불러오는 중', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
    expect(await page.locator('#main-content').evaluate((element) => element.scrollWidth - element.clientWidth), path).toBeLessThanOrEqual(1);
  }
});
