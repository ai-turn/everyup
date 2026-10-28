import { expect, test } from '@playwright/test';
import { uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

test('[14] successful latency, failed timeout, gaps, summaries and check rows agree', async ({ page }) => {
  const state = await uptimeFixture(page); const now = Date.now();
  const longError = 'upstream-error-'.repeat(45);
  state.metrics = [
    { id: 4, serviceId: 'http-monitor', status: 'failure', responseTime: 30_000, statusCode: 503, errorMessage: longError, checkedAt: new Date(now - 60_000).toISOString() },
    ...[200, 100, 0].map((responseTime, index) => ({ id: 3 - index, serviceId: 'http-monitor', status: 'success' as const, responseTime, statusCode: 200, checkedAt: new Date(now - (50 + index) * 60_000).toISOString() })),
  ];
  await page.goto('./uptime/http-monitor');
  const chart = page.locator('section').filter({ has: page.getByRole('heading', { name: '응답 시간', exact: true }) });
  const plot = chart.getByRole('group');
  const slots = plot.locator(':scope > div[style*="left:"]');
  await expect(slots).toHaveCount(4);
  await expect(chart.locator('[aria-live="polite"]')).toContainText('평균 100 ms');
  await expect(chart.locator('[aria-live="polite"]')).toContainText('최대 200 ms');
  await expect(chart.locator('[aria-live="polite"]')).toContainText('실패 1회');
  expect(await slots.last().locator('span.bg-status-error').last().evaluate((element) => element.getBoundingClientRect().height)).toBe(6);
  const positions = await slots.evaluateAll((elements) => elements.map((element) => { const box = element.getBoundingClientRect(); return { x: box.x, width: box.width }; }));
  expect(positions[3].x - positions[2].x).toBeGreaterThan(positions[2].width * 10);
  await plot.focus(); await plot.press('Home');
  await expect(chart.locator('[aria-live="polite"]')).toContainText('0ms, HTTP 200');
  await plot.press('ArrowRight');
  await expect(chart.locator('[aria-live="polite"]')).toContainText('100ms, HTTP 200');
  await plot.press('End');
  await expect(chart.locator('[aria-live="polite"]')).toContainText(`실패, HTTP 503, ${longError}`);
  await slots.nth(2).hover();
  await expect(chart.locator('[aria-live="polite"]')).toContainText('200ms, HTTP 200');
  // The per-check table is gone (folded into the chart and the outage history), so nothing else lists checks.
  await expect(page.getByRole('heading', { name: '체크 기록', exact: true })).toHaveCount(0);
});

test('[14] time tick labels stay inside the chart at its edges', async ({ page }) => {
  const state = await uptimeFixture(page);
  // One check spans ±30 min, so the right edge lands 2 s past a 10-minute tick (the CI failure).
  state.metrics = [{ ...state.metrics[1], checkedAt: '2026-10-19T12:40:02.000Z' }];
  await page.goto('./uptime/http-monitor');
  const plot = page.getByRole('group', { name: /체크별/ });
  await expect(plot).toBeVisible();
  expect(await plot.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

for (const mode of ['empty', 'single', 'tcp'] as const) {
  test(`[14] ${mode} checks have accurate empty/success/failure representation`, async ({ page }) => {
    const state = await uptimeFixture(page);
    state.metrics = mode === 'empty' ? [] : mode === 'single' ? [state.metrics[1]] : [{ ...state.metrics[0], statusCode: undefined, errorMessage: 'TCP connection refused' }];
    await page.goto(mode === 'tcp' ? './uptime/tcp-monitor' : './uptime/http-monitor');
    if (mode === 'empty') {
      await expect(page.getByText('이 기간에 데이터 없음', { exact: true })).toBeVisible();
      await expect(page.getByRole('group', { name: /체크별/ })).toHaveCount(0);
    } else {
      const plot = page.getByRole('group', { name: /체크별/ }); await plot.focus();
      const chart = page.locator('section').filter({ has: page.getByRole('heading', { name: '응답 시간', exact: true }) });
      await expect(chart.locator('[aria-live="polite"]')).toContainText(mode === 'single' ? '120ms, HTTP 200' : '실패, TCP connection refused');
      expect(await plot.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    }
  });
}
