import { expect, test, type Page } from '@playwright/test';
import type { ApiRequest, ObservedService } from '../src/services/api';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

const service: ObservedService = {
  id: 'api-test', name: 'orders-api', signals: ['traces'], isActive: true,
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', apiExcludePaths: ['/health'],
};

interface ApiState {
  failList?: boolean;
  failSummary?: boolean;
  failRequests?: boolean;
  failStats?: boolean;
  failOptions?: boolean;
  truncated?: boolean;
  requests?: ApiRequest[];
  received?: boolean;
  serviceName?: string;
  beforeRequests?: (url: URL) => Promise<void>;
  queries: URL[];
}

async function mockApi(page: Page, state: ApiState) {
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    state.queries.push(url);
    const path = url.pathname.replace('/api/v1', '');
    const failed = (path === '/observed-services' && state.failList)
      || (path.endsWith('/request-status-summary') && state.failSummary)
      || (path.endsWith('/requests') && state.failRequests)
      || (path.endsWith('/request-stats') && state.failStats)
      || (path === '/projects' && state.failOptions);
    if (failed) {
      await route.fulfill({ status: 503, json: { success: false, error: { code: 'DATABASE_ERROR' } } });
      return;
    }
    let data: unknown = [];
    if (path === '/observed-services' && route.request().method() === 'POST') data = { ...service, name: route.request().postDataJSON().name, apiKey: 'test-only-key' };
    else if (path === '/observed-services') data = [{ ...service, name: state.serviceName ?? service.name }];
    else if (path === '/observed-services/api-test') data = { ...service, name: state.serviceName ?? service.name };
    else if (path.endsWith('/api-exclusions')) data = { paths: ['/health'] };
    else if (path.endsWith('/request-status-summary')) data = { count2xx: 2, count3xx: 0, count4xx: 1, count5xx: 1, countOther: 0, top5xxMethod: 'GET', top5xxPath: '/orders/:id', top5xxCount: 1 };
    else if (path.endsWith('/request-stats')) data = { buckets: [], truncated: state.truncated ?? false };
    else if (path.startsWith('/traces/')) data = { traceId: path.split('/').at(-1), spans: [], logs: [], apiRequests: [] };
    else if (path.endsWith('/requests')) {
      await state.beforeRequests?.(url);
      const rows = (state.requests ?? []).filter(row => (!url.searchParams.get('errorsOnly') || row.isError)
        && (!url.searchParams.get('traceId') || row.traceId === url.searchParams.get('traceId'))
        && (!url.searchParams.get('search') || row.path.includes(url.searchParams.get('search')!)));
      const offset = Number(url.searchParams.get('offset') ?? 0);
      data = { data: rows.slice(offset, offset + 25), total: rows.length };
    }
    else if (path.endsWith('/setup-status')) data = state.received ? [{ serviceName: service.name, signal: 'traces', firstReceivedAt: new Date().toISOString(), lastReceivedAt: new Date().toISOString() }] : [];
    else if (path === '/settings/connection') data = { publicUrl: 'https://monitor.example.com' };
    await route.fulfill({ json: { success: true, data } });
  });
}

test('API targets recover after a failed load', async ({ page }) => {
  const state: ApiState = { failList: true, queries: [] };
  await mockApi(page, state);
  await page.goto('./api');
  await expect(page.getByText('API 데이터를 불러오지 못했습니다', { exact: true })).toBeVisible();
  state.failList = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('link', { name: 'orders-api', exact: true })).toBeVisible();
  await expect(page.getByText('API 데이터를 불러오지 못했습니다', { exact: true })).toHaveCount(0);
});

test('limited statistics do not display a partial period as a complete chart', async ({ page }) => {
  await mockApi(page, { truncated: true, queries: [] });
  await page.goto('./api/api-test');
  await expect(page.getByText('조회 범위의 요청이 많아 추이를 표시하지 못했습니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '표시할 지표' })).toHaveCount(0);
});

test('request failures remain distinct from zero results and recover on retry', async ({ page }) => {
  const state: ApiState = { failRequests: true, queries: [] };
  await mockApi(page, state);
  await page.goto('./api/api-test');
  const results = page.getByRole('region', { name: '요청 결과' });
  await expect(results.getByText('API 요청을 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(results.getByText('이 기간에 수집된 HTTP 요청이 없습니다', { exact: true })).toHaveCount(0);
  state.failRequests = false;
  await results.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(results.getByText('이 기간에 수집된 HTTP 요청이 없습니다', { exact: true })).toBeVisible();
});

test('group options failing do not block request investigation', async ({ page }) => {
  await mockApi(page, { failOptions: true, queries: [] });
  await page.goto('./api/api-test');
  await expect(page.getByRole('heading', { name: 'orders-api', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '요청 결과' })).toBeVisible();
  await expect(page.getByText('그룹 목록을 불러오지 못했습니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'API 제외 경로' })).toBeHidden();
});

function requestRows(): ApiRequest[] {
  return Array.from({ length: 35 }, (_, index) => ({
    id: index + 1, serviceId: service.id, requestId: `request-${index}`, traceId: `trace-${index}`,
    method: 'GET', path: `/orders/${index}`, pathTemplate: '/orders/:id', statusCode: index === 1 ? 404 : index === 2 ? 500 : 200,
    isError: index === 0 || index === 2, durationMs: index === 3 ? 0 : 20,
    createdAt: new Date(Date.now() - (index + 1) * 1000).toISOString(),
  }));
}

test('request paths advertise their trace panel and support pointer and keyboard activation', async ({ page }, testInfo) => {
  const rows = requestRows().slice(0, 2);
  rows[0].path = '/v1/payments';
  rows[0].isError = false;
  rows[1].traceId = undefined;
  await mockApi(page, { requests: rows, queries: [] });
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./api/api-test');
    const table = page.getByRole('table', { name: 'API 요청 목록' });
    const trigger = table.getByRole('button', { name: 'GET 200 /v1/payments 트레이스 상세 열기', exact: true });
    await expect(trigger.getByText('트레이스 상세', { exact: true })).toHaveCount(0);
    const path = trigger.getByText('/v1/payments', { exact: true });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(table.getByRole('row').filter({ hasText: '/orders/1' }).getByRole('button')).toHaveCount(0);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme);
      await expect(path).toHaveCSS('text-decoration-line', 'none');
      await table.screenshot({ path: testInfo.outputPath(`request-actions-${width}-${theme}.png`) });
      await trigger.hover();
      await expect(path).toHaveCSS('text-decoration-line', 'underline');
      await expect(trigger).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await table.screenshot({ path: testInfo.outputPath(`request-actions-hover-${width}-${theme}.png`) });
      await page.mouse.move(0, 0);
      await expect(path).toHaveCSS('text-decoration-line', 'none');
    }
    await trigger.getByText('/v1/payments', { exact: true }).click();
    const panel = page.getByRole('dialog', { name: '트레이스 상세', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('trace-0', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: '닫기', exact: true }).click();
    // The reopened panel slides in under a resting pointer; its hover tooltip would replace the focus tooltip.
    await page.mouse.move(0, 0);
    await expect(trigger).toBeFocused();
    for (const key of ['Enter', 'Space']) {
      await trigger.press(key);
      await expect(panel).toBeVisible();
      await expect(page.getByRole('tooltip')).toHaveText('trace-0');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(panel).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  }
});

test('investigation range, filters, pagination and tabs survive reload', async ({ page }) => {
  const state: ApiState = { requests: requestRows(), queries: [] };
  await mockApi(page, state);
  await page.goto('./api/api-test?range=24h&keep=yes');
  const results = page.getByRole('region', { name: '요청 결과' });
  await expect(results.getByText('전체 35건', { exact: true })).toBeVisible();
  await results.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(results.getByText('/orders/25', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '트레이스', exact: true }).click();
  await page.getByRole('button', { name: '느린순', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('tab', { name: '트레이스', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: '느린순', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: 'API 요청', exact: true }).click();
  await expect(results.getByText('/orders/25', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'API 요청', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '트레이스', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'API 요청', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '에러만', exact: true }).click();
  await expect(results.getByText('검색 결과 2건', { exact: true })).toBeVisible();
  await expect(results.getByText('/orders/0', { exact: true })).toBeVisible();
  await expect(results.getByText('/orders/1', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: '에러만', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('keep')).toBe('yes');
  const listQuery = state.queries.find(url => url.pathname.endsWith('/requests'))!;
  const statsQuery = state.queries.find(url => url.pathname.endsWith('/request-stats'))!;
  expect(listQuery.searchParams.get('from')).toBe(statsQuery.searchParams.get('from'));
  expect(listQuery.searchParams.get('to')).toBe(statsQuery.searchParams.get('to'));
});

test('trace and path filters are visible, removable and preserve the range', async ({ page }) => {
  await mockApi(page, { requests: requestRows(), queries: [] });
  await page.goto('./api/api-test?range=1h&traceId=trace-0&q=orders');
  await expect(page.getByLabel('적용한 요청 필터')).toContainText('traceId: trace-0');
  await expect(page.getByRole('textbox', { name: '요청 경로 검색' })).toHaveValue('orders');
  await page.getByRole('button', { name: '필터 해제', exact: true }).click();
  await expect(page.getByRole('region', { name: '요청 결과' })).toContainText('전체 35건');
  const params = new URL(page.url()).searchParams;
  expect(params.get('range')).toBe('1h');
  expect(params.has('traceId')).toBe(false);
  expect(params.has('q')).toBe(false);
});

test('API connection recovers options and distinguishes registration from data receipt', async ({ page }) => {
  const state: ApiState = { failOptions: true, queries: [] };
  await page.clock.install();
  await mockApi(page, state);
  await page.goto('./api');
  await page.getByRole('button', { name: 'API 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'API 직접 연결' });
  await expect(dialog.getByText('연결 정보를 불러오지 못했습니다', { exact: true })).toBeVisible();
  state.failOptions = false;
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click();
  await dialog.getByRole('textbox', { name: '서비스 이름', exact: true }).fill('new-api');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'API 연결이 준비되었습니다', exact: true })).toBeVisible();
  const receipt = dialog.getByRole('region', { name: '데이터 수신 확인' });
  await expect(receipt).toContainText('수신 대기');
  await dialog.getByRole('button', { name: '처음 설정', exact: true }).click();
  await expect(dialog.locator('pre')).toContainText('OTEL_METRICS_EXPORTER=none');
  await expect(dialog.locator('pre')).not.toContainText('OTEL_TRACES_EXPORTER=none');
  await page.mouse.click(5, 5);
  await expect(dialog.getByText('API Key는 지금 한 번만 표시됩니다.', { exact: false })).toBeVisible();
  state.received = true;
  await page.clock.fastForward(5000);
  await expect(receipt).toContainText('수집 중');
});

test('an individual summary failure keeps its target visible and retries only that summary', async ({ page }) => {
  const state: ApiState = { failSummary: true, queries: [] };
  await mockApi(page, state);
  await page.goto('./api?range=24h');
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'orders-api', exact: true }) });
  await expect(row).toContainText('요약을 불러오지 못했습니다');
  await expect(row.getByRole('cell').nth(2)).toHaveText('—');
  const listRequests = state.queries.filter(url => url.pathname.endsWith('/observed-services')).length;
  state.failSummary = false;
  await row.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(row.getByRole('cell').nth(2)).toHaveText('4');
  expect(state.queries.filter(url => url.pathname.endsWith('/observed-services')).length).toBe(listRequests);
  const query = state.queries.find(url => url.pathname.endsWith('/request-status-summary'))!;
  expect(Date.parse(query.searchParams.get('to')!) - Date.parse(query.searchParams.get('from')!)).toBe(24 * 3_600_000);
});

test('late request responses cannot replace a newer search result', async ({ page }) => {
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const state: ApiState = { requests: requestRows(), queries: [], beforeRequests: url => url.searchParams.has('search') ? Promise.resolve() : gate };
  await mockApi(page, state);
  await page.goto('./api/api-test');
  const search = page.getByRole('textbox', { name: '요청 경로 검색' });
  await search.fill('/orders/0');
  await search.press('Enter');
  const results = page.getByRole('region', { name: '요청 결과' });
  await expect(results).toContainText('검색 결과 1건');
  const pending = page.waitForResponse(response => response.url().includes('/requests?') && !new URL(response.url()).searchParams.has('search'));
  release();
  await (await pending).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(null))));
  await expect(results).toContainText('검색 결과 1건');
  await expect(results.getByText('/orders/1', { exact: true })).toHaveCount(0);
});

test('long service names and request paths remain accessible on narrow screens', async ({ page }) => {
  const rows = requestRows().slice(0, 1);
  rows[0].path = `/orders/${'long-request-segment/'.repeat(20)}`;
  await mockApi(page, { serviceName: '아주 긴 주문 처리 서비스 '.repeat(8), requests: rows, queries: [] });
  for (const width of [360, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./api');
    await expect(page.getByRole('table', { name: 'API 대상 그리드' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto('./api/api-test');
    const path = page.getByRole('button', { name: `GET 200 ${rows[0].path} 트레이스 상세 열기`, exact: true });
    await expect(path).toBeVisible();
    await expect(path).not.toHaveAttribute('title');
    await path.focus();
    await expect(page.getByRole('tooltip')).toHaveText(`${rows[0].path} — 트레이스 상세를 오른쪽 패널에서 열기`);
    expect(await page.locator('#main-content').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});
