import { expect, test, type Locator } from '@playwright/test';

const menus = [
  ['projects', '그룹', '그룹 그리드'],
  ['environments', 'Docker 환경', 'Docker 환경 그리드'],
  ['logs', '로그', '로그 서비스 그리드'],
  ['infrastructure', '인프라', '인프라 대상 그리드'],
  ['api', 'API 요청', 'API 대상 그리드'],
  ['metrics', '메트릭', '메트릭 서비스 그리드'],
  ['alerts?tab=channels', '알림', '알림 채널 그리드'],
  ['alerts?tab=rules', '알림', '알림 규칙 그리드'],
  ['alerts?tab=history', '알림', '알림 로그 그리드'],
  ['agents/agent_demo_01', 'prod-server', 'Docker 서비스 그리드'],
  ['projects/project_mock_production', 'Production', '그룹 구성 그리드'],
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
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
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

test('Docker search and connect cleanup retain the chosen view and pending actions', async ({ page }) => {
  await page.goto('./environments?view=card&q=staging&connect=docker');
  await expect(page).not.toHaveURL(/connect=/);
  expect(new URL(page.url()).searchParams.get('view')).toBe('card');
  expect(new URL(page.url()).searchParams.get('q')).toBe('staging');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  const search = page.getByRole('textbox', { name: '서비스 또는 Docker 환경 검색' });
  await expect(search).toHaveValue('staging');
  await page.getByRole('group', { name: '대상 보기 방식' }).getByRole('button', { name: '그리드', exact: true }).click();
  await page.getByText('설치·작업', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'API Key', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '비활성화', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Docker 환경 비활성화', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  await page.reload();
  await expect(search).toHaveValue('staging');
  await expect(page.getByRole('table', { name: 'Docker 환경 그리드' })).toContainText('staging-api');
});

test('Group grid exposes editing, membership controls and deletion without changing views', async ({ page }) => {
  await page.goto('./projects');
  await page.getByRole('button', { name: 'Production 구성 관리', exact: true }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Production', exact: true }) });
  await expect(card.getByRole('button', { name: 'Docker 환경 해제', exact: true }).first()).toBeVisible();
  await card.getByRole('button', { name: '그룹 수정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '그룹 수정', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  await card.getByRole('button', { name: '그룹 삭제', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '그룹을 삭제할까요?', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('table', { name: '그룹 그리드', exact: true })).toBeVisible();
});

test('alert target and local search stay intact while switching views', async ({ page }) => {
  await page.goto('./alerts?tab=rules&target=agent&agentId=agent_123&serviceKey=api');
  const search = page.getByRole('textbox', { name: '규칙 이름 또는 대상 검색' });
  await search.fill('Service Down');
  const toggle = page.getByRole('group', { name: '대상 보기 방식' });
  await toggle.getByRole('button', { name: '카드', exact: true }).click();
  await expect(search).toHaveValue('Service Down');
  await expect(page.getByRole('article', { name: 'Service Down', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('serviceKey')).toBe('api');
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
  await page.goto('http://127.0.0.1:4174/alerts?tab=history');
  const table = page.getByRole('table', { name: '알림 로그 그리드', exact: true });
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
