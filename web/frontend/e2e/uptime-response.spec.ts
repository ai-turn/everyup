import { expect, test, type Locator, type Page } from '@playwright/test';
import { uptimeFixture } from './fixtures/uptime';

test.use({ baseURL: 'http://127.0.0.1:4174/' });

const cardFor = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: '응답 시간', exact: true }) });
const step = 300_000;
const bucket = (t: number, latencyMs: number, uptimePct = 100, total = 1) => ({ time: new Date(t).toISOString(), latencyMs, uptimePct, total });

async function hoverTime(page: Page, card: Locator, t: number) {
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.getByRole('application').evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(200);
  const grid = await card.locator('.recharts-cartesian-grid-horizontal').evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  if (!grid) throw new Error('Chart grid missing');
  const to = Date.now();
  const from = Math.floor((to - 6 * 3_600_000) / step) * step;
  await page.mouse.move(grid.x + (t - from) / (to - from) * grid.width, grid.y + grid.height / 2);
  await expect(card.locator('[data-response-tooltip]')).toBeVisible();
}

test('weighted summary and tooltips preserve partial failures, all-failed buckets and valid zero latency', async ({ page }) => {
  const state = await uptimeFixture(page);
  const end = Math.floor(Date.now() / step) * step;
  state.responses.set('GET /services/http-monitor/metrics/history', [
    bucket(end - 5 * step, 0, 100, 2), bucket(end - 4 * step, 100, 50, 4),
    bucket(end - 3 * step, 200), bucket(end - 2 * step, 30_000, 0, 2), bucket(end - step, 120),
  ]);
  await page.goto('./uptime/http-monitor');
  const card = cardFor(page);
  await expect(card.locator('[data-response-average]')).toHaveText('87ms');
  await expect(card.locator('[data-response-counts]')).toHaveText('체크 10회 중 실패 4회');
  await expect(card.locator('.response-failure')).toHaveCount(2);
  await expect(card.locator('[data-response-point]')).toHaveCount(1);
  await hoverTime(page, card, end - 5 * step);
  await expect(card.locator('[data-response-tooltip]')).toContainText('0 ms');
  await hoverTime(page, card, end - 4 * step);
  await expect(card.locator('[data-response-tooltip]')).toContainText('100 ms');
  await expect(card.locator('[data-response-tooltip]')).toContainText('체크 4회 중 실패 2회');
  await hoverTime(page, card, end - 2 * step);
  await expect(card.locator('[data-response-tooltip]')).toContainText('응답 없음');
  await expect(card).not.toContainText('30,000');
});

test('collection gaps break the line and only confirmed incidents receive outage shading', async ({ page }) => {
  const state = await uptimeFixture(page);
  const end = Math.floor(Date.now() / step) * step;
  state.responses.set('GET /services/http-monitor/metrics/history', [
    bucket(end - 8 * step, 90), bucket(end - 7 * step, 100), bucket(end - 4 * step, 150), bucket(end - 3 * step, 160),
  ]);
  state.responses.set('GET /services/http-monitor/incidents', [{
    source: 'uptime', targetName: 'Public API', targetPath: '/uptime/http-monitor',
    startedAt: new Date(end - 2 * step).toISOString(), endedAt: new Date(end - step).toISOString(), durationSec: 300, active: false,
  }]);
  await page.goto('./uptime/http-monitor');
  const card = cardFor(page);
  const curve = card.locator('.recharts-line-curve');
  await expect(curve).toBeVisible();
  expect(((await curve.getAttribute('d')) ?? '').match(/M/g)).toHaveLength(2);
  await expect(card.locator('.response-outage')).toHaveCount(1);
  await hoverTime(page, card, end - 6 * step);
  await expect(card.locator('[data-response-tooltip]')).toContainText('수집 데이터 없음');
  await expect(card.locator('[data-response-tooltip]')).not.toContainText('실패');
});

test('6H is the default and 1H / 24H use their own server ranges and aggregation labels', async ({ page }) => {
  const state = await uptimeFixture(page);
  await page.goto('./uptime/http-monitor');
  const ranges = page.getByRole('group', { name: '응답 시간 범위' });
  await expect(ranges.getByRole('button', { name: '6H', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const [label, range, caption] of [['1H', '1h', '2분 평균'], ['24H', '24h', '20분 평균']]) {
    await ranges.getByRole('button', { name: label, exact: true }).click();
    await expect(cardFor(page).getByText(caption, { exact: true }).first()).toBeVisible();
    await expect.poll(() => state.requests.some((request) => request.path.endsWith('/metrics/history') && request.query === '?range=' + range)).toBe(true);
  }
});

for (const mode of ['empty', 'single', 'failed'] as const) {
  test(`${mode} buckets preserve empty, isolated-point and no-response states`, async ({ page }) => {
    const state = await uptimeFixture(page);
    const t = Math.floor(Date.now() / step) * step - step;
    state.responses.set('GET /services/http-monitor/metrics/history', mode === 'empty' ? [] : [bucket(t, mode === 'failed' ? 30_000 : 120, mode === 'failed' ? 0 : 100, 2)]);
    await page.goto('./uptime/http-monitor');
    const card = cardFor(page);
    if (mode === 'empty') {
      await expect(card.getByText('이 기간에 데이터 없음', { exact: true })).toBeVisible();
      await expect(card.getByRole('application')).toHaveCount(0);
    } else {
      await expect(card.locator('[data-response-average]')).toHaveText(mode === 'failed' ? '—' : '120ms');
      await hoverTime(page, card, t);
      await expect(card.locator('[data-response-tooltip]')).toContainText(mode === 'failed' ? '응답 없음' : '120 ms');
      if (mode === 'single') await expect(card.locator('[data-response-point]')).toBeVisible();
      else {
        expect((await card.locator('.recharts-line-curve').getAttribute('d')) ?? '').not.toContain('M');
        await expect(card.getByText('성공한 응답이 없습니다', { exact: true })).toBeVisible();
        await expect(card.locator('[data-response-tooltip]')).toContainText('체크 2회 중 실패 2회');
      }
    }
  });
}

test('mobile time labels and tooltips remain inside the card, with keyboard exploration available', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await uptimeFixture(page);
  await page.goto('./uptime/http-monitor');
  const card = cardFor(page);
  await expect(card.locator('[data-response-average]')).toHaveText('120ms');
  const plot = card.getByRole('application', { name: /응답 시간 추이/ });
  await plot.scrollIntoViewIfNeeded();
  await expect.poll(() => plot.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(200);
  await plot.focus();
  await plot.press('ArrowRight');
  await expect(card.locator('[data-response-tooltip]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const tickValues = card.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value');
  await expect.poll(() => tickValues.count()).toBeGreaterThan(1);
  const bounds = await tickValues.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right };
  }));
  expect(bounds.length).toBeGreaterThan(1);
  for (let i = 1; i < bounds.length; i++) expect(bounds[i].left - bounds[i - 1].right).toBeGreaterThan(8);
});

test('failures in the window are listed with time, checks and message, and highlight their chart mark', async ({ page }) => {
  const state = await uptimeFixture(page);
  const end = Math.floor(Date.now() / step) * step;
  state.responses.set('GET /services/http-monitor/metrics/history', [
    bucket(end - 20 * step, 120), bucket(end - 19 * step, 30_000, 0, 10), bucket(end - 18 * step, 120, 50, 10),
    bucket(end - 10 * step, 120, 90, 10), bucket(end - step, 120),
  ]);
  // The outage starts mid-bucket: that bucket belongs to the outage, not to a separate failure.
  state.responses.set('GET /services/http-monitor/incidents', [{ source: 'uptime', targetName: 'Public API', targetPath: '/uptime/http-monitor',
    startedAt: new Date(end - 19 * step - 60_000).toISOString(), endedAt: new Date(end - 18 * step + 60_000).toISOString(), durationSec: 420, active: false, message: 'connection refused' }]);
  state.responses.set('GET /services/http-monitor/failures', [
    { id: 9, serviceId: 'http-monitor', status: 'failure', responseTime: 600, statusCode: 503, errorMessage: 'upstream connect error', checkedAt: new Date(end - 10 * step + 30_000).toISOString() },
  ]);
  await page.goto('./uptime/http-monitor');
  const card = cardFor(page);
  const list = card.getByRole('list', { name: '이 기간의 실패' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.locator('[data-response-event="failure"]')).toContainText('HTTP 503, upstream connect error');
  await expect(list.locator('[data-response-event="outage"]')).toContainText('connection refused');
  await expect(list.locator('[data-response-event="outage"]')).toContainText('15회');
  await expect(card.locator('.response-failure')).toHaveCount(1);
  await list.locator('[data-response-event="outage"]').hover();
  await expect(card.locator('.response-outage path, .response-outage rect').first()).toHaveAttribute('fill-opacity', '0.2');
  await hoverTime(page, card, end - 10 * step);
  await expect(card.locator('[data-response-tooltip]')).toContainText('upstream connect error');
});
