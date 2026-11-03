import { expect, test } from '@playwright/test';
import { metricsFixture } from './fixtures/metrics';

const detail = 'http://127.0.0.1:4174/metrics/metrics-service';
const name = 'http.server.request.duration';

test('series beyond the default six can be selected and restored with the same distribution filters', async ({ page }) => {
  const state = await metricsFixture(page);
  state.points.set(name, Array.from({ length: 8 }, (_, index) => ({ id: index, metricName: name, metricType: 'histogram', unit: 's', attributes: { instance: `worker-${index}`, code: index % 2 ? '1' : 1 }, value: index + 1, createdAt: state.service.createdAt })));
  await page.goto(`${detail}?metric=${name}&keep=value`);
  await expect(page.locator('.recharts-line')).toHaveCount(6);
  await page.locator('summary').filter({ hasText: '시리즈 선택' }).click();
  const choices = page.getByLabel('시리즈 목록').getByRole('button');
  await expect(choices).toHaveCount(8);
  const first = choices.filter({ hasText: 'worker-0' });
  await first.click();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  const seventh = choices.filter({ hasText: 'worker-6' });
  await expect(seventh).toBeEnabled();
  await seventh.click();
  await expect(seventh).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/metricSeries=/);
  await page.reload();
  await page.locator('summary').filter({ hasText: '시리즈 선택' }).click();
  await expect(seventh).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/keep=value/);
  const query = state.reads.filter(read => read.path.endsWith('/query')).at(-1)!;
  await expect.poll(() => state.reads.filter(read => read.path.endsWith('/quantiles')).at(-1)?.series).toBe(query.series);
  const distribution = state.reads.filter(read => read.path.endsWith('/quantiles')).at(-1)!;
  expect([distribution.from, distribution.to, distribution.attributes]).toEqual([query.from, query.to, query.attributes]);

  await page.locator('summary').filter({ hasText: 'Attribute 필터' }).click();
  await page.getByRole('textbox', { name: 'Attribute key' }).fill('code');
  await page.getByRole('textbox', { name: '값', exact: true }).fill('1');
  await page.getByRole('button', { name: '필터 적용', exact: true }).click();
  await expect(page.locator('.recharts-line')).toHaveCount(4);
  await expect(page).not.toHaveURL(/metricSeries=/);
  await expect(page).toHaveURL(/metricAttributes=/);
  const filtered = state.reads.filter(read => read.path.endsWith('/query')).at(-1)!;
  expect(JSON.parse(filtered.attributes!)).toEqual({ code: '1' });
  await page.getByRole('button', { name: 'code 필터 제거', exact: true }).click();
  await expect(page.locator('.recharts-line')).toHaveCount(6);
});

test('sum rate mode survives reload, shows gaps for resets and explains legacy metadata', async ({ page }) => {
  const state = await metricsFixture(page);
  const counter = 'jobs.completed';
  state.names.push({ metricName: counter, metricType: 'sum', unit: '1', lastAt: state.service.createdAt });
  const now = Date.parse(state.service.createdAt);
  state.points.set(counter, [100, 130, 10, 50].map((value, index) => ({ id: index, metricName: counter, metricType: 'sum', unit: '1', attributes: { worker: 'a' }, value, temporality: 2, isMonotonic: true, startTimeUnixNano: (now - (index < 2 ? 60_000 : 25_000)) * 1_000_000, createdAt: new Date(now - (3 - index) * 10_000).toISOString() })));
  await page.goto(`${detail}?metric=${counter}`);
  await page.getByRole('button', { name: '초당 증가량', exact: true }).click();
  await expect(page).toHaveURL(/metricMode=rate/);
  await expect(page.getByText('sum, 초당 증가량, /s', { exact: true })).toBeVisible();
  await expect(page.getByText(/2개 포인트는 증가량을 계산하지 않았습니다/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '초당 증가량', exact: true })).toHaveAttribute('aria-pressed', 'true');
  state.points.set(counter, state.points.get(counter)!.map(point => ({ ...point, startTimeUnixNano: 0 })));
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText(/초당 증가량을 계산할 수 없습니다/)).toBeVisible();
  await page.getByRole('button', { name: '원값', exact: true }).click();
  await expect(page.locator('.recharts-line')).toHaveCount(1);
});

test('large metric grids request only the first twelve panels until expanded', async ({ page }) => {
  const state = await metricsFixture(page);
  for (let index = 0; index < 18; index++) state.names.push({ metricName: `custom.${index}`, metricType: 'gauge', lastAt: state.service.createdAt });
  await page.goto(detail);
  await expect(page.locator('.recharts-wrapper')).toHaveCount(12);
  expect(new Set(state.reads.filter(read => read.path.endsWith('/query')).map(read => read.name)).size).toBe(12);
  await page.getByRole('button', { name: '메트릭 12개 더 보기', exact: true }).click();
  await expect(page.locator('.recharts-wrapper')).toHaveCount(20);
});

test('filters and series controls fit a small viewport in both themes and support keyboard', async ({ page }) => {
  const state = await metricsFixture(page);
  state.points.set(name, Array.from({ length: 8 }, (_, index) => ({ id: index, metricName: name, metricType: 'histogram', unit: 's', value: 0.2, attributes: { 'deployment.environment': `${'long.attribute.'.repeat(12)}${index}` }, createdAt: state.service.createdAt })));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.goto(`${detail}?metric=${name}`);
    const summary = page.locator('summary').filter({ hasText: '시리즈 선택' });
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('시리즈 목록').getByRole('button')).toHaveCount(8);
    await page.locator('summary').filter({ hasText: 'Attribute 필터' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
