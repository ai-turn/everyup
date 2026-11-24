import { expect, test, type Locator } from '@playwright/test';
import { API_URL } from './fixtures/ports';

const menus = [
  ['logs', '전체 로그', '앱 그리드'],
  // 옛 인프라, API 요청, 메트릭 목록은 서버 목록이 대신한다. 서버 목록에는 보기 전환이 없다.
  ['alerts?tab=channels', '알림', '알림 채널 그리드'],
  ['alerts?tab=rules', '알림', '알림 규칙 그리드'],
  ['alerts?tab=history', '알림', '발송 이력 그리드'],
  // 옛 Docker 환경의 서비스 표는 Docker 서버의 컨테이너 탭이다(ADR 0012).
  ['servers/agent_demo_01/containers', 'prod-server', '컨테이너 그리드'],
] as const;

const hrefs = (scope: Locator) => scope.getByRole('link').evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute('href') ?? ''))]);
const switches = (scope: Locator) => scope.getByRole('switch').evaluateAll(elements => elements.map(element => ({ name: element.getAttribute('aria-label') ?? '', checked: element.getAttribute('aria-checked') })).sort((a, b) => a.name.localeCompare(b.name)));

for (const width of [1440, 375]) for (const [route, title, label] of menus) {
  test(`${width}px ${route} defaults to grid and retains its targets, URL and actions in cards`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(theme => localStorage.setItem('theme', theme), width === 375 ? 'dark' : 'light');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`./${route}${route.includes('?') ? '&' : '?'}view=unexpected`);
    // 목록 메뉴의 제목은 개수를 단다(`서버 13`, DESIGN.md §3.4).
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${title}( \\d+)?$`) })).toBeVisible();
    const toggle = page.getByRole('group', { name: '대상 보기 방식', exact: true });
    const table = page.getByRole('table', { name: label, exact: true });
    const main = page.locator('main');
    await expect(table).toBeVisible();
    await expect(page.getByText('로딩 중…', { exact: true })).toHaveCount(0);
    await expect(toggle.getByRole('button', { name: '그리드', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const originalHrefs = await hrefs(table);
    const originalSwitches = await switches(main);
    const messages = route === 'alerts?tab=history' ? await table.locator(`tbody tr td:nth-child(${width === 375 ? 1 : 4}) > p:first-child`).allTextContents() : [];
    const tab = new URL(page.url()).searchParams.get('tab');
    expect(await main.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('grid.png') });
    await toggle.getByRole('button', { name: '카드', exact: true }).click();
    await expect(table).toHaveCount(0);
    await expect(toggle.getByRole('button', { name: '카드', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(new URL(page.url()).searchParams.get('view')).toBe('card');
    expect(new URL(page.url()).searchParams.get('tab')).toBe(tab);
    await page.reload();
    await expect(toggle.getByRole('button', { name: '카드', exact: true })).toHaveAttribute('aria-pressed', 'true');
    if (originalHrefs.length) await expect.poll(async () => (await hrefs(main)).filter(href => originalHrefs.includes(href)).sort()).toEqual([...originalHrefs].sort());
    if (originalSwitches.length) await expect.poll(() => switches(main)).toEqual(originalSwitches);
    for (const message of new Set(messages)) await expect(main.getByText(message, { exact: true })).toHaveCount(messages.filter(item => item === message).length);
    expect(await main.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('card.png') });
    await toggle.getByRole('button', { name: '그리드', exact: true }).click();
    await expect(table).toBeVisible();
    expect(new URL(page.url()).searchParams.has('view')).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('alert target and local search stay intact while switching views', async ({ page }) => {
  await page.goto('./alerts?tab=rules&target=agent&agentId=agent_demo_01&serviceKey=shop%3Aapi');
  const search = page.getByRole('textbox', { name: '규칙 이름 또는 대상 검색' });
  await search.fill('Service Down');
  const toggle = page.getByRole('group', { name: '대상 보기 방식' });
  await toggle.getByRole('button', { name: '카드', exact: true }).click();
  await expect(search).toHaveValue('Service Down');
  await expect(page.getByRole('article', { name: 'Service Down', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('serviceKey')).toBe('shop:api');
  await expect(page.getByRole('status').filter({ hasText: '대상:' })).toContainText('api');
  await toggle.getByRole('button', { name: '그리드', exact: true }).click();
  await expect(search).toHaveValue('Service Down');
  await expect(page.getByRole('table', { name: '알림 규칙 그리드' })).toContainText('Service Down');
});

test('notification cards preserve the current page and filter without fetching a new page', async ({ page }) => {
  const historyRequests: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    let data: unknown = [];
    if (path === '/notification-history') {
      historyRequests.push(url.search);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 25);
      data = { total: 60, items: Array.from({ length: Math.min(limit, 60 - offset) }, (_, index) => ({ id: offset + index + 1, channelId: 'channel-1', channelName: 'Test Slack', channelType: 'slack', alertType: 'system', message: `Record #${offset + index + 1}`, status: 'sent', severity: 'info', retryCount: 0, createdAt: new Date().toISOString() })) };
    } else if (path === '/notification-history/stats') data = { totalSent: 60, totalFailed: 0, successRate: 100 };
    await route.fulfill({ json: { success: true, data } });
  });
  await page.goto(`${API_URL}alerts?tab=history`);
  const table = page.getByRole('table', { name: '발송 이력 그리드', exact: true });
  await expect(table.getByText('Record #1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(table.getByText('Record #26', { exact: true })).toBeVisible();
  const requests = historyRequests.length;
  await page.getByRole('group', { name: '대상 보기 방식' }).getByRole('button', { name: '카드', exact: true }).click();
  await expect(page.getByText('Record #26', { exact: true })).toBeVisible();
  await expect(page.getByText('총 60건 중 26~50', { exact: true })).toBeVisible();
  expect(historyRequests.length).toBe(requests);
  await page.getByRole('group', { name: '대상 보기 방식' }).getByRole('button', { name: '그리드', exact: true }).click();
  await expect(table.getByText('Record #26', { exact: true })).toBeVisible();
});

// URL(?q=)에 입력값을 직접 묶으면 react-router transition이 값을 한 박자 늦게 돌려줘 한글 조합이 깨졌다(ㄱ겨결결ㅈ제제).
// 옛 메트릭 목록의 검색은 서버 목록의 검색이, 옛 업타임 목록의 검색은 서버 업타임 탭의 모니터 검색이 대신한다.
for (const [route, name] of [['servers/server_mock_edge_host_01/uptime', '모니터 검색'], ['servers', '서버 또는 대상 검색']] as const) {
  test(`${route} search keeps Korean IME composition and fast typing, mirrored to ?q=`, async ({ page }) => {
    await page.goto(`./${route}`);
    const input = page.getByRole('textbox', { name, exact: true });
    await input.click();
    const cdp = await page.context().newCDPSession(page);
    for (const [kind, text] of [['compose', 'ㄱ'], ['compose', '겨'], ['compose', '결'], ['commit', '결'], ['compose', 'ㅈ'], ['compose', '제'], ['commit', '제']] as const) {
      if (kind === 'commit') await cdp.send('Input.insertText', { text });
      else await cdp.send('Input.imeSetComposition', { text, selectionStart: 1, selectionEnd: 1 });
    }
    await expect(input).toHaveValue('결제');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('결제');
    await input.fill('');
    await input.pressSequentially('payment');
    await expect(input).toHaveValue('payment');
  });
}
