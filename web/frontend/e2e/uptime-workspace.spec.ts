import { expect, test } from '@playwright/test';
import { deferred, monitor, uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });

test('manual refresh keeps filters, failed refresh keeps its last successful timestamp and recovery replaces stale status', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  await page.goto('./uptime?q=Public&view=card');
  const stamp = page.getByRole('group', { name: '업타임 갱신' }).locator('> p');
  await expect(stamp).toContainText('갱신');
  await expect(page.getByRole('article')).toHaveCount(1);
  const previous = await stamp.textContent();
  await page.clock.fastForward(5_000);
  state.failures.set('GET /services', 500);
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('업타임 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(stamp).toHaveText(previous!);
  await expect(page.getByRole('article').getByText('확인 불가', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Public API 일시정지' })).toBeDisabled();
  state.failures.clear();
  state.monitors[0].status = 'unhealthy';
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('업타임 정보를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('article').getByText('장애', { exact: true })).toBeVisible();
  await expect(stamp).not.toHaveText(previous!);
  await expect(page.getByRole('textbox', { name: '서비스 또는 대상 검색' })).toHaveValue('Public');
  await expect(page).toHaveURL(/view=card/);
});

test('30 second polling can be paused, skips hidden tabs and coalesces pending refreshes', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  await page.goto('./uptime');
  await expect(page.getByRole('table', { name: '업타임 그리드' })).toBeVisible();
  // 사이드바는 Docker 스냅샷과 모니터를 함께 조회한다. 그 요청 쌍을 빼고 목록 조회만 센다.
  const reads = () => state.requests.filter((request) => request.method === 'GET' && request.path === '/services').length
    - state.requests.filter((request) => request.method === 'GET' && request.path === '/agents/services/all').length;
  const initial = reads();
  state.monitors[0].status = 'unhealthy';
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Public API', exact: true }) })).toContainText('장애');
  expect(reads()).toBe(initial + 1);
  const auto = page.getByRole('switch', { name: '30초마다 자동 갱신' });
  await auto.click();
  await page.clock.fastForward(60_000);
  expect(reads()).toBe(initial + 1);
  await auto.click();
  await expect.poll(reads).toBe(initial + 2);
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(30_000);
  expect(reads()).toBe(initial + 2);
  const gate = deferred();
  state.holds.set('GET /services', gate.promise);
  try {
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(reads).toBe(initial + 3);
    await page.clock.fastForward(60_000);
    expect(reads()).toBe(initial + 3);
    await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeDisabled();
  } finally { state.holds.clear(); gate.resolve(); }
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled();
});

test('list shows recent checks and outage context inline without per-monitor requests', async ({ page }) => {
  const state = await uptimeFixture(page);
  state.monitors[0].status = 'unhealthy';
  state.monitors[0].activeIncident = { source: 'uptime', targetName: 'Public API', targetPath: '/uptime/http-monitor', startedAt: new Date(Date.now() - 600_000).toISOString(), durationSec: 600, active: true, message: 'Connection timed out' };
  await page.goto('./uptime?q=Public&inspect=http-monitor');
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
  await expect(page).toHaveURL(/\/uptime\/http-monitor$/);
  await page.getByRole('navigation', { name: '현재 위치' }).getByRole('link', { name: '업타임', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '서비스 또는 대상 검색' })).toHaveValue('Public');
});

test('automatic refresh updates card history while selection and pause actions remain independent', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.clock.install();
  state.monitors[0].status = 'unhealthy';
  await page.goto('./uptime?view=card');
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
    state.monitors = [monitor('http-monitor', { status: mode === 'paused' ? 'unhealthy' : 'unknown', isActive: mode !== 'paused' })];
    state.metrics = [];
    state.monitors[0].activeIncident = { source: 'uptime', targetName: 'Public API', targetPath: '/uptime/http-monitor', startedAt: new Date().toISOString(), durationSec: 60, active: true };
    if (mode === 'unavailable') state.responses.set('GET /services', state.monitors);
    await page.goto('./uptime');
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
    await page.goto('./uptime');
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
  await page.goto('./uptime');
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
  await page.goto('./uptime/http-monitor');
  const ranges = page.getByRole('group', { name: '응답 시간 범위' });
  await ranges.getByRole('button', { name: '6H', exact: true }).click();
  await expect(page.getByText('체크 이력 조회에 실패했습니다. 이전 데이터가 있으면 유지합니다.', { exact: true })).toBeVisible();
  await expect(ranges.getByRole('button', { name: '6H', exact: true })).toHaveAttribute('aria-pressed', 'true');
  state.failures.delete('GET /services/http-monitor/metrics/history');
  await ranges.getByRole('button', { name: '1H', exact: true }).click();
  await expect(page.getByRole('application', { name: /응답 시간 추이/ })).toBeVisible();
  await expect(page.getByText('체크 이력 조회에 실패했습니다. 이전 데이터가 있으면 유지합니다.', { exact: true })).toHaveCount(0);
});
