import { expect, test } from '@playwright/test';
import { metricsFixture } from './fixtures/metrics';

const detail = 'http://127.0.0.1:4174/metrics/metrics-service';

test('connection management starts closed and is operable by keyboard', async ({ page }) => {
  await metricsFixture(page);
  await page.goto(detail);
  const summary = page.locator('summary').filter({ hasText: '연결 관리' });
  const disclosure = summary.locator('..');
  await expect(disclosure).not.toHaveAttribute('open');
  await expect(page.getByRole('combobox', { name: '그룹 배정' })).toBeHidden();
  await expect(page.locator('.recharts-wrapper')).toHaveCount(2);
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(page.getByRole('combobox', { name: '그룹 배정' })).toBeVisible();
  await expect(page.getByRole('button', { name: '키 재발급', exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(disclosure).not.toHaveAttribute('open');
});

test('period, search and selected metric survive reload and browser history', async ({ page }) => {
  const state = await metricsFixture(page);
  for (let index = 0; index < 8; index += 1) state.names.push({ metricName: `custom.metric.${index}`, metricType: 'gauge', lastAt: state.service.createdAt });
  await page.goto(`${detail}?range=24h&metricSearch=JVM&keep=value`);
  await expect(page.getByRole('button', { name: '24H', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const search = page.getByRole('textbox', { name: '메트릭 이름으로 찾기' });
  await expect(search).toHaveValue('JVM');
  await expect(page.getByRole('heading', { name: 'jvm.memory.used', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'http.server.request.duration', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'jvm.memory.used', exact: true }).click();
  await expect(page).toHaveURL(/metric=jvm\.memory\.used/);
  const metadata = page.locator('dl[aria-label="메트릭 정보"]');
  await expect(metadata.locator('time')).toHaveAttribute('datetime', '2026-10-01T00:00:00Z');
  await page.reload();
  await expect(metadata).toBeVisible();
  await expect(page.getByRole('button', { name: '24H', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '1H', exact: true }).click();
  await expect(page).toHaveURL(/range=1h/);
  await page.goBack();
  await expect(page.getByRole('button', { name: '24H', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '전체 메트릭', exact: true }).click();
  await expect(search).toHaveValue('JVM');
  await expect(page).toHaveURL(/keep=value/);
  await expect(page).not.toHaveURL(/metric=/);
  await search.fill('no-such-metric');
  await expect(page.getByRole('heading', { name: '일치하는 메트릭이 없습니다', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '검색 초기화', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'http.server.request.duration', exact: true })).toBeVisible();
});

test('all chart and histogram reads share the same exact window, including retries', async ({ page }) => {
  const state = await metricsFixture(page);
  await page.goto(`${detail}?range=24h`);
  await expect(page.locator('.recharts-wrapper')).toHaveCount(2);
  await page.getByRole('button', { name: 'http.server.request.duration', exact: true }).click();
  await expect(page.getByText('선택한 시리즈의 기간 분포', { exact: true })).toBeVisible();
  const windows = state.reads.filter(read => read.path.endsWith('/query') || read.path.endsWith('/quantiles'));
  expect(windows.length).toBeGreaterThanOrEqual(3);
  expect(new Set(windows.map(read => `${read.from}/${read.to}`)).size).toBe(1);
  expect(Date.parse(windows[0].to!) - Date.parse(windows[0].from!)).toBe(24 * 3_600_000);
  state.failures.add('/observed-services/metrics-service/otel-metrics/quantiles');
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('선택한 시리즈의 기간 분포를 불러오지 못했습니다', { exact: true })).toBeVisible();
  const refreshed = state.reads.filter(read => read.path.endsWith('/quantiles')).at(-1)!;
  expect(refreshed.to).not.toBe(windows[0].to);
  state.failures.clear();
  await page.getByRole('button', { name: '분포 다시 시도', exact: true }).click();
  await expect(page.getByText('선택한 시리즈의 기간 분포', { exact: true })).toBeVisible();
  const retried = state.reads.filter(read => read.path.endsWith('/query') || read.path.endsWith('/quantiles')).slice(-2);
  expect(retried.map(read => [read.from, read.to])).toEqual([[refreshed.from, refreshed.to], [refreshed.from, refreshed.to]]);
});

test('full attribute names retain separate chart lines and per-series statistics', async ({ page }) => {
  const state = await metricsFixture(page);
  const now = state.service.createdAt;
  state.points.set('http.server.request.duration', [
    { id: 1, metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', value: 0.2, attributes: { 'http.method': 'GET' }, createdAt: now },
    { id: 2, metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's', value: 0.4, attributes: { 'rpc.method': 'GET' }, createdAt: now },
  ]);
  await page.goto(`${detail}?metric=http.server.request.duration`);
  await expect(page.locator('.recharts-line')).toHaveCount(2);
  const http = page.getByRole('row').filter({ hasText: 'http.method="GET"' });
  const rpc = page.getByRole('row').filter({ hasText: 'rpc.method="GET"' });
  await expect(http).toContainText('200');
  await expect(rpc).toContainText('400');
});

test('long names and attributes stay inside the mobile viewport in light and dark modes', async ({ page }) => {
  const state = await metricsFixture(page);
  const name = `application.${'very_long_metric_name.'.repeat(10)}duration`;
  state.names.push({ metricName: name, metricType: 'gauge', lastAt: state.service.createdAt });
  state.points.set(name, [
    { id: 1, metricName: name, metricType: 'gauge', value: 1, attributes: { 'deployment.environment': 'production'.repeat(20) }, createdAt: state.service.createdAt },
    { id: 2, metricName: name, metricType: 'gauge', value: 2, attributes: { 'deployment.environment': 'staging' }, createdAt: state.service.createdAt },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto(`${detail}?metric=${encodeURIComponent(name)}`);
    const heading = page.getByRole('heading', { name, exact: true });
    await expect(heading).toBeVisible();
    await expect(page.locator('.recharts-wrapper')).toHaveCount(1);
    expect(await heading.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.locator('#main-content').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole('button', { name: '전체 메트릭', exact: true }).click();
    await expect(page.locator('.recharts-wrapper')).toHaveCount(3);
    expect(await page.locator('#main-content').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});

test('Docker metric search does not reuse the log or request search', async ({ page }) => {
  await page.goto('./services/agent_demo_03/jobs%3Acatalog-worker?tab=metrics&range=24h&q=log-only-filter');
  await expect(page.getByRole('heading', { name: 'jvm.memory.used', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'http.server.request.duration', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '24H', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
