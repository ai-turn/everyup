import { expect, test, type Page } from '@playwright/test';
import { deferred, monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const panel = (page: Page) => page.getByRole('tabpanel');
// 사이드바는 Docker 스냅샷과 모니터를 함께 조회한다. 그 요청 쌍을 빼고 목록 조회만 센다.
const listReads = (state: Awaited<ReturnType<typeof uptimeFixture>>) => () =>
  state.requests.filter((request) => request.method === 'GET' && request.path === '/services').length
  - state.requests.filter((request) => request.method === 'GET' && request.path === '/agents/services/all').length;

test('manual refresh keeps filters, a failed refresh is reported and recovery replaces stale status', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  await page.goto('./servers/server-1/uptime?q=Public&view=card');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.clock.fastForward(5_000);
  state.failures.set('GET /services', 500);
  // 새로고침은 서버 머리말에 하나다.
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  // 이전에 불러온 목록이 있으면 서버 머리말 아래에 이전 정보라는 안내가 하나 나오고 목록은 남는다.
  await expect(page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' })).toContainText('업타임 정보는 이전에 불러온 것입니다. 최신 상태는 확인할 수 없습니다.');
  state.failures.clear();
  state.monitors[0].status = 'unhealthy';
  await page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' }).getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' })).toHaveCount(0);
  await expect(page.getByRole('article').getByText('장애', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '모니터 검색' })).toHaveValue('Public');
  await expect(page).toHaveURL(/view=card/);
});

// 갱신 시각은 서버 머리말에 있다(서버 데이터를 마지막으로 성공해서 불러온 시각). 다시 불러오다 실패하면 그 시각과 이전 목록을
// "확인 불가"로 남겨 두고 행 조작을 막는다.
test('a failed refresh keeps its last successful timestamp and the previous list as unverified', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  await page.goto('./servers/server-1/uptime?q=Public&view=card');
  const stamp = page.getByRole('group', { name: '서버 데이터 갱신' }).locator('> p');
  await expect(stamp).toContainText('갱신');
  await expect(page.getByRole('article')).toHaveCount(1);
  const previous = await stamp.textContent();
  await page.clock.fastForward(5_000);
  state.failures.set('GET /services', 500);
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(stamp).toHaveText(previous!);
  await expect(page.getByRole('article').getByText('확인 불가', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Public API 일시정지' })).toBeDisabled();
  state.failures.clear();
  await page.getByRole('status').filter({ hasText: '일부 정보를 불러오지 못했습니다' }).getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(stamp).not.toHaveText(previous!);
});

test('30 second polling skips hidden tabs and refreshes when the tab is shown again', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  await page.goto('./servers/server-1/uptime');
  await expect(page.getByRole('table', { name: '업타임 그리드' })).toBeVisible();
  const reads = listReads(state);
  const initial = reads();
  state.monitors[0].status = 'unhealthy';
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Public API', exact: true }) })).toContainText('장애');
  expect(reads()).toBe(initial + 1);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(30_000);
  expect(reads()).toBe(initial + 1);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(reads).toBe(initial + 2);
});

// `30초마다 자동 갱신` 스위치는 서버 머리말에 하나다. 갱신이 끝나지 않은 동안에는 다음 주기를 건너뛰고(겹친 갱신을 하나로)
// 새로고침 버튼을 막는다.
test('30 second polling can be paused and coalesces pending refreshes', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  await page.goto('./servers/server-1/uptime');
  await expect(page.getByRole('table', { name: '업타임 그리드' })).toBeVisible();
  const reads = listReads(state);
  const initial = reads();
  const auto = page.getByRole('switch', { name: '30초마다 자동 갱신' });
  await auto.click();
  await page.clock.fastForward(60_000);
  expect(reads()).toBe(initial);
  await auto.click();
  await expect.poll(reads).toBe(initial + 1);
  // 켜면서 보낸 요청이 끝나야 다음 주기가 겹친 갱신으로 건너뛰어지지 않는다.
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
  const gate = deferred();
  state.holds.set('GET /services', gate.promise);
  try {
    await page.clock.fastForward(30_000);
    await expect.poll(reads).toBe(initial + 2);
    // 한 주기(30초) 안에는 끝나지 않은 요청을 기다린다. 넘기면 버려진 것으로 본다(servers-refresh.spec.ts).
    await page.clock.fastForward(29_000);
    expect(reads()).toBe(initial + 2);
    await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeDisabled();
  } finally { state.holds.clear(); gate.resolve(); }
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
});

test('list shows recent checks and outage context inline without per-monitor requests', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors[0].status = 'unhealthy';
  state.monitors[0].activeIncident = { source: 'uptime', targetName: 'Public API', targetPath: '/servers/server-1/uptime/http-monitor', startedAt: new Date(Date.now() - 600_000).toISOString(), durationSec: 600, active: true, message: 'Connection timed out' };
  await page.goto('./servers/server-1/uptime?q=Public&inspect=http-monitor');
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Public API', exact: true }) });
  await expect(row.getByText('10분 지속', { exact: true })).toBeVisible();
  const checks = row.getByRole('group', { name: /최근 체크 2회/ });
  await expect(checks).toContainText('Connection timed out');
  await expect(checks).not.toContainText('5000ms');
  await expect(page.locator('#uptime-inspector')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /빠른 확인/ })).toHaveCount(0);
  expect(state.requests.some((request) => request.path.endsWith('/metrics') || request.path.endsWith('/incidents') || request.path.endsWith('/uptime'))).toBe(false);
  expect(state.requests.some((request) => request.path === '/services' && request.query.includes('include=checks'))).toBe(true);
  await checks.focus(); await checks.press('Home');
  await expect(checks.locator('[aria-live="polite"]')).toContainText('120ms');
  await checks.press('End');
  await expect(checks.locator('[aria-live="polite"]')).toContainText('Connection timed out');
  await expect(page.getByRole('tooltip')).toContainText('Connection timed out');
  await row.getByText('10분 지속', { exact: true }).focus();
  await expect(page.getByRole('tooltip')).toContainText('장애 시작');
  await page.getByRole('link', { name: 'Public API', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime\/http-monitor$/);
});

// 목록에서 연 상세의 `모니터 목록` 링크는 목록의 주소(검색어 포함)로 돌아간다.
test('returning from a detail opened from the list keeps the search', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime?q=Public');
  await page.getByRole('link', { name: 'Public API', exact: true }).click();
  await expect(page).toHaveURL(/\/servers\/server-1\/uptime\/http-monitor$/);
  await expect(panel(page).getByRole('heading', { level: 2, name: 'Public API' })).toBeVisible();
  // 목록 → 상세 → 새로고침의 흐름에서 fixture가 처리하지 않은 요청이 없다.
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
  await page.getByRole('group', { name: '탭 조작' }).getByRole('link', { name: '모니터 목록', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '모니터 검색' })).toHaveValue('Public');
  expect(state.unhandled).toEqual([]);
});

test('automatic refresh updates card history while selection and pause actions remain independent', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  state.monitors[0].status = 'unhealthy';
  await page.goto('./servers/server-1/uptime?view=card');
  const card = page.getByRole('article').filter({ has: page.getByRole('link', { name: 'Public API', exact: true }) });
  await expect(card.getByRole('group', { name: /최근 체크 2회/ })).toContainText('Connection timed out');
  state.monitors[0].status = 'healthy';
  state.metrics = [{ ...state.metrics[1], responseTime: 91, checkedAt: new Date().toISOString() }];
  await page.clock.fastForward(30_000);
  await expect(card.getByRole('group', { name: /최근 체크 1회/ })).toContainText('91ms');
  await card.getByRole('checkbox', { name: 'Public API 선택' }).check();
  await expect(page.getByRole('region', { name: '선택한 대상 작업' })).toContainText('1개 선택');
  await card.getByRole('button', { name: 'Public API 일시정지' }).click();
  await expect(card.getByRole('group', { name: /최근 체크 1회/ })).toContainText('정지 전 기록');
  await expect(card.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: '그리드', exact: true }).click();
  await expect(page.getByRole('region', { name: '선택한 대상 작업' })).toHaveCount(0);
  await expect(page.getByRole('table').getByRole('checkbox')).toHaveCount(0);
});

for (const mode of ['waiting', 'unavailable', 'paused'] as const) {
  test('inline history distinguishes ' + mode + ' without inventing a healthy check or an active outage', async ({ page }) => {
    const state = await uptimeFixture(page);
    // 모니터가 하나면 서버 탭은 목록 없이 상세를 보인다. 목록의 행을 확인하도록 다른 모니터를 하나 더 둔다.
    state.monitors = [monitor('http-monitor', { status: mode === 'paused' ? 'unhealthy' : 'unknown', isActive: mode !== 'paused' }), monitor('tcp-monitor', { name: 'Database', type: 'tcp', url: 'db.example.com', port: 5432 })];
    state.metrics = [];
    state.monitors[0].activeIncident = { source: 'uptime', targetName: 'Public API', targetPath: '/servers/server-1/uptime/http-monitor', startedAt: new Date().toISOString(), durationSec: 60, active: true };
    if (mode === 'unavailable') state.responses.set('GET /services', state.monitors);
    await page.goto('./servers/server-1/uptime');
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Public API', exact: true }) });
    await expect(row).toContainText(mode === 'unavailable' ? '체크 기록 확인 불가' : mode === 'paused' ? '체크 기록 없음' : '첫 체크 대기');
    await expect(row.getByText(/지속$/)).toHaveCount(0);
  });
}

for (const width of [1024, 1280, 1440]) for (const theme of ['light', 'dark']) {
  test('inline checks keep compact rows and long content contained at ' + width + 'px in ' + theme, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
    const state = await uptimeFixture(page);
    const longName = '아주 긴 모니터 이름 '.repeat(10);
    state.monitors[0].name = longName;
    state.monitors[0].url = 'https://example.com/' + 'long-endpoint'.repeat(30);
    state.metrics[0].errorMessage = '긴 실패 메시지 '.repeat(80);
    await page.goto('./servers/server-1/uptime');
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: longName, exact: true }) });
    await expect(row.getByRole('group', { name: /최근 체크 2회/ })).toBeVisible();
    const table = page.getByRole('table', { name: '업타임 그리드' });
    expect(await table.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    if (width >= 1280) {
      expect((await row.boundingBox())!.height).toBeLessThanOrEqual(76);
      await expect(table.getByRole('columnheader', { name: '수집 간격', exact: true })).toBeVisible();
      expect((await table.getByRole('columnheader', { name: '대상 · 체크 주소' }).boundingBox())!.width).toBeGreaterThan(140);
    }
    await page.screenshot({ path: testInfo.outputPath('inline-' + theme + '-' + width + '.png') });
    await page.getByRole('button', { name: '카드', exact: true }).click();
    const card = page.getByRole('article').filter({ has: page.getByRole('link', { name: longName, exact: true }) });
    await expect(card.getByRole('group', { name: /최근 체크 2회/ })).toBeVisible();
    expect(await page.locator('main > div').first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });
}

test('mobile opens full detail with current check context and range controls beside the response chart', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await uptimeFixture(page);
  await page.goto('./servers/server-1/uptime');
  await expect(page.getByRole('button', { name: /빠른 확인/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Public API', exact: true }).click();
  // 최근 체크는 상세 헤더 상태 줄에 있다 — 모바일에서 속성 목록을 접어도 상태 줄은 보인다.
  const current = page.getByRole('group', { name: '최근 체크' });
  await expect(current).toContainText('Connection timed out');
  await expect(current).not.toContainText('5000ms');
  const chart = page.locator('section').filter({ has: page.getByRole('heading', { name: '응답 시간', exact: true }) });
  await expect(chart.getByRole('group', { name: '응답 시간 범위' })).toBeVisible();
  expect(await page.locator('main > div').first().evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('failed bucket requests keep range controls available and another range can recover', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.failures.set('GET /services/http-monitor/metrics/history', 500);
  await page.goto('./servers/server-1/uptime/http-monitor');
  const ranges = page.getByRole('group', { name: '응답 시간 범위' });
  await ranges.getByRole('button', { name: '6h', exact: true }).click();
  await expect(page.getByText('체크 이력 조회에 실패했습니다. 이전 데이터가 있으면 유지합니다.', { exact: true })).toBeVisible();
  await expect(ranges.getByRole('button', { name: '6h', exact: true })).toHaveAttribute('aria-pressed', 'true');
  state.failures.delete('GET /services/http-monitor/metrics/history');
  await ranges.getByRole('button', { name: '1h', exact: true }).click();
  await expect(page.getByRole('application', { name: /응답 시간 추이/ })).toBeVisible();
  await expect(page.getByText('체크 이력 조회에 실패했습니다. 이전 데이터가 있으면 유지합니다.', { exact: true })).toHaveCount(0);
});
